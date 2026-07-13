#!/usr/bin/env node
'use strict';

const UNKNOWN_SPEAKERS = new Set(['未知', '不明', '佚名', 'unknown', 'UNKNOWN']);
const IMPORTANCE = new Set(['核心', '重要', 'core', 'important']);
const MERIDIAN_NAMES = /^(任脉|督脉|冲脉|带脉|阴维脉|阳维脉|阴跷脉|阳跷脉|十二正经|奇经八脉|经脉)$/;
const ORDINARY_ACTIONS = /^(挥手|转身|抬手|迈步|后退|前进|跳起|落地|点头|摇头)$/;
const CAMELLIA_NAMES = new Set([
  '十八学士', '十三太保', '八仙过海', '落第秀才', '风尘三侠',
  '二乔', '满月', '眼儿媚', '红妆素裹', '抓破美人脸'
]);

function issue(code, path, message) {
  return { code, path, message };
}

function records(input, category) {
  return Array.isArray(input?.records_by_category?.[category])
    ? input.records_by_category[category]
    : [];
}

function characterIndexes(input) {
  const byKey = new Map();
  const byName = new Map();
  for (const character of records(input, 'character')) {
    const key = String(character.provisional_key ?? '');
    const name = String(character.name ?? character.canonical_name ?? '').trim();
    if (key) byKey.set(key, character);
    if (name) byName.set(name, character);
  }
  return { byKey, byName };
}

function auditDialogueSpeakers(input, indexes) {
  const errors = [];
  for (const [index, dialogue] of records(input, 'dialogue').entries()) {
    const label = String(dialogue.provisional_key ?? `dialogue#${index}`);
    if (!['persona', 'both'].includes(dialogue.selection_type)) continue;
    const speakerKey = String(dialogue.speaker ?? '').trim();
    const speakerName = String(dialogue.speaker_name ?? '').trim();
    const character = indexes.byKey.get(speakerKey);
    if (!speakerKey || !character || !speakerName || UNKNOWN_SPEAKERS.has(speakerName)
      || String(character.name ?? character.canonical_name ?? '').trim() !== speakerName) {
      errors.push(issue(
        'DIALOGUE_SPEAKER_INVALID',
        `dialogue.${label}.speaker`,
        'persona/both dialogue requires a real existing character speaker and a matching non-unknown name'
      ));
    }
  }
  return errors;
}

function exemptionKey(exemption) {
  return String(exemption?.provisional_key ?? exemption?.id ?? '').trim();
}

function exemptionHasSpecificEvidence(exemption) {
  const reason = String(exemption?.reason ?? '').trim();
  const scope = exemption?.search_scope;
  const refs = exemption?.source_refs;
  const generic = /^(?:没有|无|未找到|找不到)(?:关联|合适|相关)?对白$/.test(reason)
    || /^(?:原文)?(?:没有|无)(?:合适|相关)?证据$/.test(reason);
  return !generic && reason.length >= 8
    && Array.isArray(scope) && scope.length > 0
    && Array.isArray(refs) && refs.length > 0;
}

function auditPersonaCoverage(input, indexes) {
  const errors = [];
  const exemptions = new Map((input?.exemptions?.personas ?? [])
    .map(exemption => [exemptionKey(exemption), exemption]));
  const selectedSpeakers = new Set(records(input, 'dialogue')
    .filter(dialogue => ['persona', 'both'].includes(dialogue.selection_type))
    .map(dialogue => dialogue.speaker));
  const dialogueSignalNames = new Set((input?.dialogue_signals ?? [])
    .map(signal => String(signal?.speaker_name ?? '').trim())
    .filter(Boolean));

  for (const character of indexes.byKey.values()) {
    if (!IMPORTANCE.has(character.importance)) continue;
    const key = character.provisional_key;
    const name = String(character.name ?? character.canonical_name ?? '').trim();
    const exemption = exemptions.get(key);
    if (exemption) {
      if (!exemptionHasSpecificEvidence(exemption)) {
        errors.push(issue(
          'PERSONA_EXEMPTION_INVALID',
          `exemptions.personas.${key}`,
          'persona exemption requires a specific reason, searched scope, and locatable source evidence'
        ));
      }
      if (dialogueSignalNames.has(name)) {
        errors.push(issue(
          'PERSONA_EXEMPTION_CONTRADICTED',
          `exemptions.personas.${key}`,
          'source dialogue signals contradict the persona exemption'
        ));
      }
    } else if (!selectedSpeakers.has(key)) {
      errors.push(issue(
        'PERSONA_DIALOGUE_MISSING',
        `character.${key}`,
        'core/important character requires persona dialogue or a valid exemption'
      ));
    }
  }
  return errors;
}

function auditParticipantClosure(input, indexes) {
  const errors = [];
  const participantExemptions = new Set((input?.exemptions?.event_participants ?? [])
    .filter(exemptionHasSpecificEvidence)
    .map(exemption => `${exemption.event_key}\0${exemption.participant_name || exemption.participant_key}`));
  for (const [index, event] of (input?.events ?? []).entries()) {
    const eventKey = String(event.provisional_key ?? `event#${index}`);
    for (const key of event.participant_keys ?? []) {
      if (!indexes.byKey.has(key)
        && !participantExemptions.has(`${eventKey}\0${key}`)) {
        errors.push(issue(
          'EVENT_PARTICIPANT_UNRESOLVED',
          `event.${eventKey}.participant.${key}`,
          'event participant key does not resolve to a character'
        ));
      }
    }
    for (const name of event.participant_names ?? []) {
      if (!indexes.byName.has(name)
        && !participantExemptions.has(`${eventKey}\0${name}`)) {
        errors.push(issue(
          'EVENT_PARTICIPANT_UNRESOLVED',
          `event.${eventKey}.participant.${name}`,
          'event participant name does not resolve to a character'
        ));
      }
    }
  }
  for (const summary of records(input, 'chapter_summary')) {
    for (const key of summary.key_characters ?? []) {
      if (!indexes.byKey.has(key)) {
        errors.push(issue(
          'SUMMARY_CHARACTER_UNRESOLVED',
          `chapter_summary.${summary.chapter}.key_characters.${key}`,
          'chapter key character does not resolve to a character'
        ));
      }
    }
  }
  return errors;
}

function auditSharedEvidence(input) {
  const errors = [];
  for (const [index, justification] of (
    input?.shared_evidence_justifications ?? []
  ).entries()) {
    const label = `shared_evidence.${justification.provisional_key ?? index}`;
    const fields = Array.isArray(justification.fields) ? justification.fields : [];
    const facts = justification.field_facts;
    let invalid = fields.length < 3
      || !Array.isArray(justification.source_refs)
      || justification.source_refs.length === 0
      || !facts || typeof facts !== 'object' || Array.isArray(facts);
    const normalizedFacts = [];
    for (const field of fields) {
      const fact = String(facts?.[field] ?? '').trim();
      const compact = fact.replace(/\s/g, '');
      normalizedFacts.push(compact);
      if (fact.length < 8
        || [`原文支持${field}`, `支持${field}`, `${field}有原文支持`].includes(compact)
        || compact === field) {
        invalid = true;
      }
    }
    if (new Set(normalizedFacts).size !== normalizedFacts.length) invalid = true;
    if (invalid) {
      errors.push(issue(
        'SHARED_EVIDENCE_JUSTIFICATION_INVALID',
        label,
        'shared evidence must map each field to a distinct, non-circular source fact'
      ));
    }
  }
  return errors;
}

function auditFieldEvidence(input) {
  const errors = [];
  const evidenceEntries = input?.field_evidence_claims ?? [];
  const verdicts = input?.evidence_audit_verdicts ?? [];
  if (!Array.isArray(evidenceEntries) || evidenceEntries.length === 0) {
    const entityCount = ['character', 'faction', 'location', 'skill', 'technique', 'item']
      .reduce((total, category) => total + records(input, category).length, 0);
    if (entityCount > 0) {
      errors.push(issue(
        'FIELD_EVIDENCE_AUDIT_EMPTY',
        'field_evidence_claims',
        'semantic audit cannot pass with an empty field-evidence check set'
      ));
    }
    return errors;
  }
  const verdictsByClaim = new Map();
  for (const verdict of Array.isArray(verdicts) ? verdicts : []) {
    const key = `${verdict?.provisional_key}\0${verdict?.field}`;
    if (verdictsByClaim.has(key)) {
      errors.push(issue(
        'FIELD_EVIDENCE_AUDIT_INVALID',
        `evidence_verdict.${verdict?.provisional_key}.${verdict?.field}`,
        'field evidence verdict is duplicated'
      ));
    } else {
      verdictsByClaim.set(key, verdict);
    }
  }
  for (const entry of evidenceEntries) {
    for (const field of Object.keys(entry?.field_evidence_claims ?? {})) {
      const path = `field_evidence.${entry.provisional_key}.${field}`;
      const verdict = verdictsByClaim.get(`${entry.provisional_key}\0${field}`);
      if (!verdict) {
        errors.push(issue(
          'FIELD_EVIDENCE_AUDIT_MISSING',
          path,
          'field evidence claim requires an independent semantic-audit verdict'
        ));
      } else if (verdict.supported !== true) {
        errors.push(issue(
          'FIELD_EVIDENCE_UNSUPPORTED',
          path,
          String(verdict.reason ?? 'semantic auditor found no supporting source fact')
        ));
      } else if (typeof verdict.reason !== 'string' || verdict.reason.trim().length < 8) {
        errors.push(issue(
          'FIELD_EVIDENCE_AUDIT_INVALID',
          path,
          'supported verdict requires a specific reason'
        ));
      }
    }
  }
  return errors;
}

function auditClassification(input) {
  const errors = [];
  const highRisk = [];
  for (const skill of records(input, 'skill')) {
    const name = String(skill.name ?? skill.canonical_name ?? '').trim();
    if (MERIDIAN_NAMES.test(name) && !skill.independent_martial_identity) {
      errors.push(issue('CLASSIFICATION_ERROR', `skill.${name}`, 'meridian is not a named skill without independent martial identity'));
    }
  }
  for (const technique of records(input, 'technique')) {
    const name = String(technique.name ?? technique.canonical_name ?? '').trim();
    if (name === '一阳指') {
      errors.push(issue('CLASSIFICATION_ERROR', `technique.${name}`, '一阳指 is a complete named martial skill, not a single technique'));
    } else if ((/穴$/.test(name) || ORDINARY_ACTIONS.test(name))
      && !technique.independent_martial_identity) {
      errors.push(issue('CLASSIFICATION_ERROR', `technique.${name}`, 'acupoint or ordinary action is not a named technique'));
    }
  }
  for (const item of records(input, 'item')) {
    const name = String(item.name ?? item.canonical_name ?? '').trim();
    if (CAMELLIA_NAMES.has(name) && !item.plot_relevance_evidence) {
      errors.push(issue('CLASSIFICATION_ERROR', `item.${name}`, 'ordinary named camellia requires independent item identity and plot relevance evidence'));
    }
    if (!name || !item.type) {
      highRisk.push({
        provisional_key: item.provisional_key ?? null,
        canonical_name: name,
        reason: 'item identity or type remains semantically ambiguous'
      });
    }
  }
  return { errors, high_risk_decisions: highRisk };
}

function runSemanticGates(input) {
  const indexes = characterIndexes(input);
  const classification = auditClassification(input);
  const checks = {
    dialogue_speakers: auditDialogueSpeakers(input, indexes),
    persona_coverage: auditPersonaCoverage(input, indexes),
    participant_closure: auditParticipantClosure(input, indexes),
    field_evidence: auditFieldEvidence(input),
    shared_evidence: auditSharedEvidence(input),
    classification: classification.errors
  };
  const errors = Object.values(checks).flat();
  return {
    passed: errors.length === 0 && classification.high_risk_decisions.length === 0,
    errors,
    high_risk_decisions: classification.high_risk_decisions,
    checks: Object.fromEntries(Object.entries(checks).map(([name, values]) => [name, {
      passed: values.length === 0,
      error_count: values.length
    }]))
  };
}

module.exports = {
  auditClassification,
  auditDialogueSpeakers,
  auditFieldEvidence,
  auditParticipantClosure,
  auditPersonaCoverage,
  auditSharedEvidence,
  exemptionHasSpecificEvidence,
  runSemanticGates
};
