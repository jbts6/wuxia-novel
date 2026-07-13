#!/usr/bin/env node
'use strict';

const { stableStringify } = require('./atomic-json');
const {
  evidenceFieldsFor,
  validateProvisionalRecord
} = require('./final-data-contract');
const { validateCandidate } = require('./ledger');
const {
  DECISIONS,
  PROVISIONAL_CATEGORIES,
  REJECT_REASONS,
  RISK_LEVELS,
  provisionalKey
} = require('./provisional-contracts');
const { matchCompleteCitation } = require('./source');

const EMPTY_REASONS = Object.freeze({
  'named-inventory': 'no_named_entities',
  'event-dialogue': 'no_events_or_dialogues'
});

const ENRICH_FILES = Object.freeze({
  character: 'characters.json',
  faction: 'factions.json',
  location: 'locations.json',
  skill: 'skills.json',
  technique: 'techniques.json',
  item: 'items.json',
  dialogue: 'dialogues.json',
  chapter_summary: 'chapter_summaries.json'
});

function failure(code, errors) {
  return { passed: false, code, errors, output_count: null, empty_result: null };
}

function validateEmptyResult(payload, kind) {
  const expected = EMPTY_REASONS[kind];
  const empty = payload?.empty_result;
  if (!empty || empty.reason !== expected || typeof empty.detail !== 'string' || empty.detail.trim().length < 6) {
    return failure(
      'DRAFT_EMPTY_REASON_REQUIRED',
      [`zero-output ${kind} draft requires ${expected} and a specific detail`]
    );
  }
  return { passed: true, errors: [], output_count: 0, empty_result: empty };
}

function citationMatchesWindow(candidate, sourcePayload) {
  const ref = candidate?.source_ref;
  if (!ref || ref.line_start < sourcePayload.line_start || ref.line_end > sourcePayload.line_end) return false;
  const lines = String(sourcePayload.text || '').split(/\r?\n/);
  const relativeStart = ref.line_start - sourcePayload.line_start;
  const relativeEnd = ref.line_end - sourcePayload.line_start + 1;
  if (relativeStart < 0 || relativeEnd > lines.length || relativeStart >= relativeEnd) return false;
  return matchCompleteCitation(lines.slice(relativeStart, relativeEnd), ref.text).matched;
}

function validateWindowInventory(payload, definition, kind) {
  if (!Array.isArray(payload?.candidates)) {
    return failure('DRAFT_SCHEMA_INVALID', [`${kind} payload.candidates must be an array`]);
  }
  if (payload.candidates.length === 0) return validateEmptyResult(payload, kind);

  const source = definition.source_payload;
  const errors = [];
  let sourceError = false;
  for (const candidate of payload.candidates) {
    errors.push(...validateCandidate(candidate).map(error => `${candidate?.candidate_id || '<unknown>'}: ${error}`));
    if (candidate?.window_id !== source.window_id
      || candidate?.chapter !== source.chapter
      || candidate?.discovery_pass !== kind
      || !citationMatchesWindow(candidate, source)) {
      sourceError = true;
      errors.push(`${candidate?.candidate_id || '<unknown>'}: candidate identity or complete citation does not match packet window`);
    }
  }
  if (errors.length > 0) {
    return failure(sourceError ? 'INVENTORY_SOURCE_REF_INVALID' : 'DRAFT_SCHEMA_INVALID', errors);
  }
  return { passed: true, errors: [], output_count: payload.candidates.length, empty_result: null };
}

function validateChapterSummary(payload, definition) {
  const summary = payload?.chapter_summary;
  const errors = [];
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    errors.push('chapter_summary must be an object');
  } else {
    if (summary.chapter !== definition.source_payload.chapter) errors.push('chapter does not match packet');
    if (typeof summary.summary !== 'string' || summary.summary.trim().length < 10) {
      errors.push('summary must contain at least 10 characters');
    }
    if (!Array.isArray(summary.key_events) || summary.key_events.length === 0) {
      errors.push('key_events must be a non-empty array');
    }
    if (!Array.isArray(summary.key_character_names)) {
      errors.push('key_character_names must be an array');
    }
  }
  return errors.length > 0
    ? failure('DRAFT_SCHEMA_INVALID', errors)
    : { passed: true, errors: [], output_count: 1, empty_result: null };
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function normalizedRefs(refs) {
  return [...(Array.isArray(refs) ? refs : [])]
    .map(ref => stableStringify(ref))
    .sort();
}

function sameRefs(left, right) {
  return sameStringSet(normalizedRefs(left), normalizedRefs(right));
}

function validateDiscoveryAlerts(alerts, errors) {
  if (!Array.isArray(alerts)) {
    errors.push('discovery_alerts must be an array');
    return;
  }
  for (const [index, alert] of alerts.entries()) {
    const label = `discovery_alerts[${index}]`;
    if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (typeof alert.name !== 'string' || !alert.name.trim()) {
      errors.push(`${label}.name must be non-empty`);
    }
    if (!PROVISIONAL_CATEGORIES.has(alert.category_hint)) {
      errors.push(`${label}.category_hint is invalid`);
    }
    if (typeof alert.reason !== 'string' || alert.reason.trim().length < 6) {
      errors.push(`${label}.reason must contain specific evidence`);
    }
    if (!Array.isArray(alert.source_refs) || alert.source_refs.length === 0) {
      errors.push(`${label}.source_refs must be a non-empty array`);
    }
  }
}

function validateSharedEvidence(payload, requiredGroups, errors) {
  const justifications = payload.shared_evidence_justification ?? [];
  if (!Array.isArray(justifications)) {
    errors.push('shared_evidence_justification must be an array');
    return;
  }
  for (const group of requiredGroups) {
    const match = justifications.find(justification =>
      justification && typeof justification === 'object' && !Array.isArray(justification)
      && sameRefs(justification.source_refs, group.source_refs)
      && Array.isArray(justification.fields)
      && group.fields.every(field => justification.fields.includes(field))
    );
    if (!match) {
      errors.push(`fields ${group.fields.join(', ')} reuse identical evidence without justification`);
      continue;
    }
    if (new Set(match.fields).size !== match.fields.length) {
      errors.push('shared evidence fields must be unique');
    }
    if (!match.field_facts || typeof match.field_facts !== 'object' || Array.isArray(match.field_facts)) {
      errors.push(`shared evidence for ${group.fields.join(', ')} requires field_facts`);
      continue;
    }
    for (const field of group.fields) {
      if (typeof match.field_facts[field] !== 'string' || match.field_facts[field].trim().length < 6) {
        errors.push(`shared evidence field_facts.${field} must state a specific supporting fact`);
      }
    }
  }
}

function validateEnrichEntity(payload, definition) {
  const category = definition.instructions.category;
  const expectedKey = definition.instructions.provisional_key;
  const record = payload?.record;
  const errors = [];
  if (!ENRICH_FILES[category]) return failure('DRAFT_SCHEMA_INVALID', [`unsupported enrich category: ${category}`]);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return failure('DRAFT_SCHEMA_INVALID', ['record must be an object']);
  }
  if (category !== 'chapter_summary' && record.provisional_key !== expectedKey) {
    errors.push('record.provisional_key does not match packet');
  }
  if (category !== 'chapter_summary') {
    const reconciled = definition.source_payload?.entity ?? {};
    if (category !== 'dialogue' && record.name !== reconciled.canonical_name) {
      errors.push('record.name must match reconcile canonical_name');
    }
    if (Object.hasOwn(record, 'importance')
      && Object.hasOwn(reconciled, 'importance')
      && record.importance !== reconciled.importance) {
      errors.push('record.importance must match reconcile importance');
    }
    if (Object.hasOwn(record, 'final_category') && record.final_category !== category) {
      errors.push('record.final_category must match reconcile final_category');
    }
  }

  const provisional = validateProvisionalRecord(category, record);
  errors.push(...provisional.schema_errors, ...provisional.enrichment_errors);
  validateDiscoveryAlerts(payload.discovery_alerts, errors);

  const claims = payload.field_evidence_claims;
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    errors.push('field_evidence_claims must be an object');
  }
  const groups = new Map();
  for (const field of evidenceFieldsFor(ENRICH_FILES[category], record)) {
    const claim = claims?.[field];
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
      errors.push(`field_evidence_claims.${field} is required`);
      continue;
    }
    if (typeof claim.claim !== 'string' || claim.claim.trim().length < 6) {
      errors.push(`field_evidence_claims.${field}.claim must state a specific source fact`);
    }
    if (!Array.isArray(claim.source_refs) || claim.source_refs.length === 0) {
      errors.push(`field_evidence_claims.${field}.source_refs must be non-empty`);
      continue;
    }
    if (!sameRefs(claim.source_refs, record.field_source_refs?.[field])) {
      errors.push(`field_evidence_claims.${field}.source_refs must match record.field_source_refs`);
    }
    const signature = stableStringify(normalizedRefs(claim.source_refs));
    if (!groups.has(signature)) groups.set(signature, { fields: [], source_refs: claim.source_refs });
    groups.get(signature).fields.push(field);
  }
  if (errors.length > 0) return failure('DRAFT_SCHEMA_INVALID', errors);

  const paddingGroups = [...groups.values()].filter(group => group.fields.length >= 3);
  const paddingErrors = [];
  validateSharedEvidence(payload, paddingGroups, paddingErrors);
  if (paddingErrors.length > 0) return failure('EVIDENCE_PADDING', paddingErrors);
  return { passed: true, errors: [], output_count: 1, empty_result: null };
}

function validateSemanticEvidenceAudit(payload, definition) {
  const verdicts = payload?.evidence_verdicts;
  const expectedFields = definition.instructions.fields ?? [];
  const expectedKey = definition.instructions.provisional_key;
  const errors = [];
  if (!Array.isArray(verdicts)) {
    return failure('DRAFT_SCHEMA_INVALID', ['evidence_verdicts must be an array']);
  }
  if (!sameStringSet(verdicts.map(verdict => verdict?.field), expectedFields)) {
    errors.push('evidence_verdicts must close every packet field exactly once');
  }
  if (new Set(verdicts.map(verdict => verdict?.field)).size !== verdicts.length) {
    errors.push('evidence_verdicts fields must be unique');
  }
  for (const [index, verdict] of verdicts.entries()) {
    const label = `evidence_verdicts[${index}]`;
    if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (verdict.provisional_key !== expectedKey) {
      errors.push(`${label}.provisional_key does not match packet`);
    }
    if (!expectedFields.includes(verdict.field)) {
      errors.push(`${label}.field is not present in the packet`);
    }
    if (typeof verdict.supported !== 'boolean') {
      errors.push(`${label}.supported must be boolean`);
    }
    if (typeof verdict.reason !== 'string' || verdict.reason.trim().length < 8) {
      errors.push(`${label}.reason must state a specific audit finding`);
    }
  }
  return errors.length > 0
    ? failure('DRAFT_SCHEMA_INVALID', errors)
    : { passed: true, errors: [], output_count: verdicts.length, empty_result: null };
}

function validateSignalResolutions(payload, definition, errors) {
  const resolutions = payload.character_signal_resolutions ?? [];
  if (!Array.isArray(resolutions)) {
    errors.push('character_signal_resolutions must be an array');
    return;
  }
  const names = new Set();
  for (const [index, resolution] of resolutions.entries()) {
    const label = `character_signal_resolutions[${index}]`;
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    const name = String(resolution.name ?? '').trim();
    if (!name) errors.push(`${label}.name must be non-empty`);
    else if (names.has(name)) errors.push(`${label}.name is duplicated`);
    names.add(name);
    if (!['keep', 'reject'].includes(resolution.decision)) {
      errors.push(`${label}.decision must be keep or reject`);
    }
    if (typeof resolution.reason !== 'string' || resolution.reason.trim().length < 6) {
      errors.push(`${label}.reason must contain specific evidence`);
    }
    if (resolution.decision === 'keep'
      && (typeof resolution.importance !== 'string' || !resolution.importance.trim())) {
      errors.push(`${label}.importance must be non-empty for keep`);
    }
    if (resolution.decision === 'reject' && !REJECT_REASONS.has(resolution.reject_reason)) {
      errors.push(`${label}.reject_reason is invalid`);
    }
  }
}

function validateReconcileCluster(payload, definition) {
  const decision = payload?.decision;
  const errors = [];
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return failure('DRAFT_SCHEMA_INVALID', ['decision must be an object']);
  }
  const expectedCandidateIds = definition.source_payload.candidates
    .map(candidate => candidate.candidate_id);
  if (decision.decision_id !== definition.instructions.decision_id) {
    errors.push('decision_id does not match packet');
  }
  if (!sameStringSet(decision.candidate_ids, expectedCandidateIds)) {
    errors.push('candidate_ids must close exactly the packet candidate cluster');
  }
  if (!DECISIONS.has(decision.decision)) errors.push('decision is invalid');
  if (decision.decision === 'reject') {
    if (!REJECT_REASONS.has(decision.reason)) errors.push('reject reason is invalid');
    const martial = definition.source_payload.candidates
      .some(candidate => ['skill', 'technique'].includes(candidate.category_hint));
    if (martial && ['trivial', 'non_major'].includes(decision.reason)) {
      errors.push('named martial candidates cannot be rejected for importance');
    }
  } else {
    if (typeof decision.canonical_name !== 'string' || !decision.canonical_name.trim()) {
      errors.push('canonical_name must be non-empty');
    }
    if (!PROVISIONAL_CATEGORIES.has(decision.final_category)) {
      errors.push('final_category is invalid');
    }
    if (typeof decision.importance !== 'string' || !decision.importance.trim()) {
      errors.push('importance must be non-empty');
    }
    if (typeof decision.reason !== 'string' || decision.reason.trim().length < 6) {
      errors.push('reason must contain specific evidence');
    }
    const expectedKey = provisionalKey(decision.final_category, definition.instructions.cluster_id);
    if (decision.provisional_key !== expectedKey) {
      errors.push('provisional_key does not match cluster and final_category');
    }
  }
  const risk = decision.risk;
  if (!risk || !RISK_LEVELS.has(risk.level) || !Array.isArray(risk.reasons)) {
    errors.push('risk requires level and reasons');
  } else if (risk.level === 'high' && risk.reasons.length === 0) {
    errors.push('high risk decisions require reasons');
  }
  validateSignalResolutions(payload, definition, errors);
  return errors.length > 0
    ? failure('DRAFT_SCHEMA_INVALID', errors)
    : {
        passed: true,
        errors: [],
        output_count: 1 + (payload.character_signal_resolutions?.length || 0),
        empty_result: null
      };
}

function validateGapAudit(payload, definition) {
  const kind = 'gap-audit';
  if (!Array.isArray(payload?.candidates)) {
    return failure('DRAFT_SCHEMA_INVALID', ['gap-audit payload.candidates must be an array']);
  }
  if (payload.candidates.length === 0) {
    const empty = payload.empty_result;
    if (!empty || empty.reason !== 'no_gap_candidates'
      || typeof empty.detail !== 'string' || empty.detail.trim().length < 6) {
      return failure(
        'DRAFT_EMPTY_REASON_REQUIRED',
        ['zero-output gap-audit requires no_gap_candidates and a specific detail']
      );
    }
    return { passed: true, errors: [], output_count: 0, empty_result: empty };
  }
  const source = definition.source_payload;
  const errors = [];
  let sourceError = false;
  const start = definition.instructions.candidate_id_start;
  const end = definition.instructions.candidate_id_end;
  for (const candidate of payload.candidates) {
    errors.push(...validateCandidate(candidate)
      .map(error => `${candidate?.candidate_id || '<unknown>'}: ${error}`));
    const ordinal = Number(String(candidate?.candidate_id || '').split('_').at(-1));
    if (candidate?.window_id !== source.window_id
      || candidate?.chapter !== source.chapter
      || candidate?.discovery_pass !== kind
      || !Number.isInteger(ordinal) || ordinal < start || ordinal > end
      || !citationMatchesWindow(candidate, source)) {
      sourceError = true;
      errors.push(`${candidate?.candidate_id || '<unknown>'}: gap candidate does not match blind packet window or reserved ID range`);
    }
  }
  return errors.length > 0
    ? failure(sourceError ? 'INVENTORY_SOURCE_REF_INVALID' : 'DRAFT_SCHEMA_INVALID', errors)
    : { passed: true, errors: [], output_count: payload.candidates.length, empty_result: null };
}

function validateStageDraft(stage, payload, definition) {
  if (!definition?.instructions?.kind) {
    return { passed: true, errors: [], output_count: null, empty_result: null };
  }
  const kind = definition.instructions.kind;
  if (stage === 'reconcile' && kind === 'reconcile-cluster') {
    return validateReconcileCluster(payload, definition);
  }
  if (stage === 'reconcile' && kind === 'gap-audit') {
    return validateGapAudit(payload, definition);
  }
  if (stage === 'enrich' && kind === 'enrich-entity') {
    return validateEnrichEntity(payload, definition);
  }
  if (stage === 'semantic-audit' && kind === 'semantic-evidence-audit') {
    return validateSemanticEvidenceAudit(payload, definition);
  }
  if (stage !== 'inventory') {
    return { passed: true, errors: [], output_count: null, empty_result: null };
  }
  if (kind === 'chapter-summary') return validateChapterSummary(payload, definition);
  if (kind === 'named-inventory' || kind === 'event-dialogue') {
    return validateWindowInventory(payload, definition, kind);
  }
  return failure('DRAFT_SCHEMA_INVALID', [`Unknown inventory work item kind: ${kind}`]);
}

module.exports = {
  EMPTY_REASONS,
  validateStageDraft
};
