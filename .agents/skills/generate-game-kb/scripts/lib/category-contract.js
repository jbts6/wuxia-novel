'use strict';

const { REJECTION_REASONS } = require('./candidate-ledger');
const { MATERIAL_TYPES } = require('./game-materials');

const MERGE_ACTIONS = new Set(['merge', 'reject', 'ambiguous']);
const CLEAN_ACTIONS = new Set(['keep', 'edit', 'merge_into', 'drop']);
const FORBIDDEN_KEYS = /^(candidate_key|local_key|id|.*_id|.*_ids)$/;

const CATEGORY_FIELDS = Object.freeze({
  characters: new Set([
    'level', 'identity', 'biography', 'personality', 'relationship_names',
    'skill_names', 'item_names'
  ]),
  events: new Set([
    'cause', 'process', 'result', 'participant_names', 'location_names', 'importance'
  ]),
  items: new Set(['inclusion_reason', 'type', 'description']),
  skills: new Set(['type', 'description', 'holder_names', 'technique_names']),
  techniques: new Set(['named_in_source', 'source_skill_name', 'description']),
  factions: new Set(['type', 'description']),
  locations: new Set(['region', 'description']),
  dialogues: new Set(['event_ref', 'speaker_name', 'chapter', 'text'])
});

const CLEAN_PATCH_FIELDS = Object.freeze(Object.fromEntries(
  Object.entries(CATEGORY_FIELDS).map(([category, fields]) => [
    category,
    new Set(['canonical_name', 'aliases', ...fields])
  ])
));

function issue(code, path, target = '') {
  return { code, path, target };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function exactFields(value, allowed, path, issues) {
  if (!isObject(value)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', path));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', path ? `${path}.${key}` : key, key));
    }
  }
  return true;
}

function findMechanicalKeys(value, path, issues) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findMechanicalKeys(entry, `${path}[${index}]`, issues));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.test(key)) {
      issues.push(issue('MECHANICAL_KEY_FORBIDDEN', entryPath, key));
    }
    findMechanicalKeys(entry, entryPath, issues);
  }
}

function validateHeader(draft, workItem, expectedStage, allowedTopLevel, issues) {
  if (!exactFields(draft, allowedTopLevel, '', issues)) return false;
  if (draft.schema_version !== 1) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', 'schema_version', draft.schema_version));
  }
  if (draft.stage !== expectedStage) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', 'stage', draft.stage));
  }
  if (draft.unit !== workItem?.unit) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', 'unit', draft.unit));
  }
  return true;
}

function validateStringArray(value, path, issues, options = {}) {
  if (!Array.isArray(value)
    || (options.nonempty === true && value.length === 0)
    || value.some(entry => !nonempty(entry))) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', path));
    return [];
  }
  if (new Set(value).size !== value.length) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', path));
  }
  return value;
}

function validateSemanticFields(fields, category, allowedByCategory, path, issues) {
  if (!isObject(fields)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', path));
    return;
  }
  const allowed = allowedByCategory[category] || new Set();
  for (const key of Object.keys(fields)) {
    if (!allowed.has(key)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.${key}`, key));
    }
  }
}

function mergeInputRefs(workItem) {
  const candidates = Array.isArray(workItem?.candidates) ? workItem.candidates : [];
  if (candidates.length > 0) return candidates.map(candidate => candidate?.candidate_ref).filter(nonempty);
  return (Array.isArray(workItem?.entities) ? workItem.entities : [])
    .map(entity => entity?.entity_ref)
    .filter(nonempty);
}

function validateRefCoverage(expectedRefs, seenRefs, path, issues) {
  const expected = new Set(expectedRefs);
  const counts = new Map();
  for (const ref of seenRefs) counts.set(ref, (counts.get(ref) || 0) + 1);
  const invalid = [];
  for (const ref of expected) {
    if (counts.get(ref) !== 1) invalid.push(ref);
  }
  for (const [ref, count] of counts) {
    if (!expected.has(ref) || count !== 1) invalid.push(ref);
  }
  if (invalid.length > 0) {
    issues.push(issue('WORK_REF_INVALID', path, [...new Set(invalid)].sort().join(',')));
  }
}

function validateMergeEntry(decision, category, path, issues) {
  const common = new Set(['entity_ref', 'member_refs', 'action', 'canonical_name', 'aliases', 'fields', 'reason', 'detail']);
  if (!exactFields(decision, common, path, issues)) return [];
  const refs = validateStringArray(decision.member_refs, `${path}.member_refs`, issues, { nonempty: true });
  if (!MERGE_ACTIONS.has(decision.action)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.action`, decision.action));
    return refs;
  }

  if (decision.action === 'merge') {
    const required = category === 'dialogues'
      ? new Set(['entity_ref', 'member_refs', 'action', 'aliases', 'fields'])
      : new Set(['entity_ref', 'member_refs', 'action', 'canonical_name', 'aliases', 'fields']);
    exactFields(decision, required, path, issues);
    if (!nonempty(decision.entity_ref)) issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.entity_ref`));
    if (category !== 'dialogues' && !nonempty(decision.canonical_name)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.canonical_name`));
    }
    validateStringArray(decision.aliases, `${path}.aliases`, issues);
    validateSemanticFields(decision.fields, category, CATEGORY_FIELDS, `${path}.fields`, issues);
  } else if (decision.action === 'reject') {
    exactFields(decision, new Set(['member_refs', 'action', 'reason', 'detail']), path, issues);
    if (!REJECTION_REASONS.has(decision.reason) || !nonempty(decision.detail)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', path, decision.reason));
    }
  } else {
    exactFields(decision, new Set(['member_refs', 'action', 'detail']), path, issues);
    if (!nonempty(decision.detail)) issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.detail`));
  }
  return refs;
}

function validateMergeDecisionDraft(draft, workItem) {
  const issues = [];
  findMechanicalKeys(draft, '', issues);
  if (!validateHeader(
    draft,
    workItem,
    'merge_decision',
    new Set(['schema_version', 'stage', 'unit', 'decisions', 'ambiguities']),
    issues
  )) return dedupe(issues);
  if (!Array.isArray(draft.decisions)) issues.push(issue('SEMANTIC_DECISION_INVALID', 'decisions'));
  if (!Array.isArray(draft.ambiguities)) issues.push(issue('SEMANTIC_DECISION_INVALID', 'ambiguities'));

  const entries = [
    ...(Array.isArray(draft.decisions) ? draft.decisions.map((value, index) => ({ value, path: `decisions[${index}]` })) : []),
    ...(Array.isArray(draft.ambiguities) ? draft.ambiguities.map((value, index) => ({ value, path: `ambiguities[${index}]` })) : [])
  ];
  const seenRefs = [];
  const entityRefs = new Set();
  for (const entry of entries) {
    seenRefs.push(...validateMergeEntry(entry.value, workItem?.category, entry.path, issues));
    if (entry.value?.action === 'merge' && nonempty(entry.value.entity_ref)) {
      if (entityRefs.has(entry.value.entity_ref)) {
        issues.push(issue('SEMANTIC_DECISION_INVALID', `${entry.path}.entity_ref`, entry.value.entity_ref));
      }
      entityRefs.add(entry.value.entity_ref);
    }
  }
  validateRefCoverage(mergeInputRefs(workItem), seenRefs, 'decisions.member_refs', issues);
  return dedupe(issues);
}

function cleanEntityRefs(workItem) {
  return (Array.isArray(workItem?.entities) ? workItem.entities : [])
    .map(entity => entity?.entity_ref)
    .filter(nonempty);
}

function cleanObligationRefs(workItem) {
  return new Set((Array.isArray(workItem?.obligations) ? workItem.obligations : [])
    .map(obligation => obligation?.obligation_ref)
    .filter(nonempty));
}

function validateCleanEntry(decision, category, knownObligations, path, issues) {
  const common = new Set(['entity_ref', 'action', 'patch', 'target_ref', 'reason', 'detail', 'resolves']);
  if (!exactFields(decision, common, path, issues)) return;
  if (!nonempty(decision.entity_ref) || !CLEAN_ACTIONS.has(decision.action)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', path, decision.entity_ref));
    return;
  }
  const resolves = validateStringArray(decision.resolves, `${path}.resolves`, issues);
  for (const ref of resolves) {
    if (!knownObligations.has(ref)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.resolves`, ref));
    }
  }

  if (decision.action === 'keep') {
    exactFields(decision, new Set(['entity_ref', 'action', 'resolves']), path, issues);
  } else if (decision.action === 'edit') {
    exactFields(decision, new Set(['entity_ref', 'action', 'patch', 'resolves']), path, issues);
    validateSemanticFields(decision.patch, category, CLEAN_PATCH_FIELDS, `${path}.patch`, issues);
  } else if (decision.action === 'merge_into') {
    exactFields(decision, new Set(['entity_ref', 'action', 'target_ref', 'reason', 'detail', 'resolves']), path, issues);
    if (!nonempty(decision.target_ref) || decision.reason !== 'duplicate' || !nonempty(decision.detail)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', path, decision.target_ref));
    }
  } else {
    exactFields(decision, new Set(['entity_ref', 'action', 'reason', 'detail', 'resolves']), path, issues);
    if (!REJECTION_REASONS.has(decision.reason) || !nonempty(decision.detail)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', path, decision.reason));
    }
  }
}

function validateCleanDecisionDraft(draft, workItem) {
  const issues = [];
  findMechanicalKeys(draft, '', issues);
  if (!validateHeader(
    draft,
    workItem,
    'clean_decision',
    new Set(['schema_version', 'stage', 'unit', 'decisions', 'quantity_explanation']),
    issues
  )) return dedupe(issues);
  if (!Array.isArray(draft.decisions)) issues.push(issue('SEMANTIC_DECISION_INVALID', 'decisions'));
  if (draft.quantity_explanation !== null && !nonempty(draft.quantity_explanation)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', 'quantity_explanation'));
  }

  const knownRefs = new Set(cleanEntityRefs(workItem));
  const seenRefs = [];
  const knownObligations = cleanObligationRefs(workItem);
  for (const [index, decision] of (Array.isArray(draft.decisions) ? draft.decisions : []).entries()) {
    const path = `decisions[${index}]`;
    validateCleanEntry(decision, workItem?.category, knownObligations, path, issues);
    if (nonempty(decision?.entity_ref)) seenRefs.push(decision.entity_ref);
    if (decision?.action === 'merge_into' && !knownRefs.has(decision.target_ref)) {
      issues.push(issue('WORK_REF_INVALID', `${path}.target_ref`, decision.target_ref));
    }
    if (decision?.action === 'merge_into' && decision.target_ref === decision.entity_ref) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.target_ref`, decision.target_ref));
    }
  }
  validateRefCoverage([...knownRefs], seenRefs, 'decisions.entity_ref', issues);
  return dedupe(issues);
}

function validateMaterialDecisionDraft(draft, workItem) {
  const issues = [];
  findMechanicalKeys(draft, '', issues);
  if (!validateHeader(
    draft,
    workItem,
    'material_decision',
    new Set(['schema_version', 'stage', 'unit', 'materials']),
    issues
  )) return dedupe(issues);
  if (!Array.isArray(draft.materials)) {
    issues.push(issue('SEMANTIC_DECISION_INVALID', 'materials'));
    return dedupe(issues);
  }

  const knownRefs = new Set((Array.isArray(workItem?.catalog) ? workItem.catalog : [])
    .map(entry => entry?.entity_ref)
    .filter(nonempty));
  const seen = new Set();
  draft.materials.forEach((material, index) => {
    const path = `materials[${index}]`;
    if (!exactFields(
      material,
      new Set(['material_type', 'source_ref', 'relevance', 'suggested_use', 'reason']),
      path,
      issues
    )) return;
    if (!MATERIAL_TYPES.has(material.material_type)) {
      issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.material_type`, material.material_type));
    }
    if (!knownRefs.has(material.source_ref)) {
      issues.push(issue('WORK_REF_INVALID', `${path}.source_ref`, material.source_ref));
    }
    const selectionKey = `${material.material_type}\0${material.source_ref}`;
    if (seen.has(selectionKey)) issues.push(issue('SEMANTIC_DECISION_INVALID', path, material.source_ref));
    seen.add(selectionKey);
    for (const field of ['relevance', 'suggested_use', 'reason']) {
      if (!nonempty(material[field])) issues.push(issue('SEMANTIC_DECISION_INVALID', `${path}.${field}`));
    }
  });
  return dedupe(issues);
}

function dedupe(issues) {
  return [...new Map(issues.map(value => [JSON.stringify(value), value])).values()];
}

module.exports = {
  CLEAN_ACTIONS,
  FORBIDDEN_KEYS,
  MERGE_ACTIONS,
  validateCleanDecisionDraft,
  validateMaterialDecisionDraft,
  validateMergeDecisionDraft
};
