'use strict';

const {
  DOMAIN_UNITS,
  isPowerRank,
  requiredDomainUnitsForContract
} = require('./semantic-contract');

const ACTIONS = new Set(['keep', 'merge', 'reject', 'pending']);
const DOMAIN_UNIT_SET = new Set(DOMAIN_UNITS);
const CONTROLLER_FIELDS = new Set([
  'candidate_key', 'local_key', 'registry_key', 'member_refs', 'formal_id', 'final_id'
]);
const COMMON_REJECTIONS = Object.freeze(['duplicate', 'not_source_grounded']);
const REJECTION_REASONS = Object.freeze({
  characters: Object.freeze([...COMMON_REJECTIONS, 'duplicate_identity', 'not_character', 'background_only']),
  skills: Object.freeze([...COMMON_REJECTIONS, 'duplicate_skill', 'unnamed_action', 'not_martial']),
  items: Object.freeze([...COMMON_REJECTIONS, 'duplicate_item', 'ordinary_item', 'not_item']),
  factions: Object.freeze([...COMMON_REJECTIONS, 'duplicate_faction', 'incidental_group', 'not_faction'])
});

function issue(code, path, target = '') {
  return { code, path, target };
}

function nonempty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function controllerFieldPaths(value, prefix = '$', paths = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => controllerFieldPaths(entry, `${prefix}[${index}]`, paths));
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, nested] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    if (CONTROLLER_FIELDS.has(key) || key.endsWith('_registry_key') || key.endsWith('_registry_keys')) paths.push(path);
    controllerFieldPaths(nested, path, paths);
  }
  return paths;
}

function validatePatch(patch, input, entry, label, entriesByRef, errors) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    errors.push(issue('DOMAIN_PATCH_INVALID', `${label}.patch`));
    return;
  }
  const allowed = new Set(input.allowed_patch_fields || []);
  for (const field of Object.keys(patch)) {
    if (!allowed.has(field)) errors.push(issue('DOMAIN_PATCH_FIELD_FORBIDDEN', `${label}.patch.${field}`, field));
  }
  for (const [field, value] of Object.entries(patch)) {
    if (field === 'faction') {
      if (value === null || value === '') continue;
      const allowedFactionRefs = new Set(input.allowed_faction_refs || []);
      if (allowedFactionRefs.has(value)) continue;
      errors.push(issue(
        entriesByRef.has(value) ? 'DOMAIN_REFERENCE_UNAUTHORIZED' : 'DOMAIN_REFERENCE_UNKNOWN',
        `${label}.patch.${field}`,
        value
      ));
      continue;
    }
    if (!(field.endsWith('_ref') || field.endsWith('_refs'))) continue;
    const refs = Array.isArray(value) ? value : [value];
    for (const ref of refs) {
      if (!entriesByRef.has(ref)) errors.push(issue('DOMAIN_REFERENCE_UNKNOWN', `${label}.patch.${field}`, ref));
    }
  }
  if (entry.category === 'skills' && patch.techniques !== undefined) {
    if (!Array.isArray(patch.techniques)) {
      errors.push(issue('TECHNIQUES_INVALID', `${label}.patch.techniques`));
    } else {
      patch.techniques.forEach((technique, index) => {
        const techniquePath = `${label}.patch.techniques[${index}]`;
        if (!technique || typeof technique !== 'object' || Array.isArray(technique)) {
          errors.push(issue('TECHNIQUE_INVALID', techniquePath));
          return;
        }
        if (!nonempty(technique.name)) {
          errors.push(issue('TECHNIQUE_NAME_REQUIRED', `${techniquePath}.name`));
        }
        if (technique.named_in_source !== true) {
          errors.push(issue('TECHNIQUE_NOT_NAMED', `${techniquePath}.named_in_source`, technique.name));
        }
      });
    }
  }
}

function validatePowerRankPatch(patch, label, errors) {
  if (patch?.rank === undefined || patch.rank === null || patch.rank === '') {
    errors.push(issue('POWER_RANK_REQUIRED', `${label}.patch.rank`));
    return;
  }
  if (!isPowerRank(patch.rank)) {
    errors.push(issue('POWER_RANK_INVALID', `${label}.patch.rank`, patch.rank));
  }
}

function validateItemInclusionReason(patch, entry, label, errors) {
  const hasFallback = nonempty(entry.facts?.inclusion_reason)
    || ['关键', '稀有', '重要'].includes(entry.facts?.importance);
  const hasPatchValue = patch && typeof patch === 'object' && !Array.isArray(patch)
    && Object.hasOwn(patch, 'inclusion_reason');
  const value = patch?.inclusion_reason;

  if (!hasPatchValue || value === null) {
    if (!hasFallback) {
      errors.push(issue('ITEM_INCLUSION_REASON_REQUIRED', `${label}.patch.inclusion_reason`, entry.entry_ref));
    }
    return;
  }
  if (!nonempty(value)) {
    errors.push(issue('ITEM_INCLUSION_REASON_INVALID', `${label}.patch.inclusion_reason`, value));
  }
}

function validateDomainDecisionDraft(draft, input) {
  const errors = [];
  try {
    requiredDomainUnitsForContract(input?.semantic_contract_version);
  } catch (error) {
    if (error.code === 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED') {
      return [issue(error.code, 'input.semantic_contract_version', input?.semantic_contract_version)];
    }
    throw error;
  }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return [issue('DOMAIN_DRAFT_INVALID', '$')];
  for (const path of controllerFieldPaths(draft)) errors.push(issue('CONTROLLER_FIELD_FORBIDDEN', path));
  if (draft.schema_version !== 1) errors.push(issue('SCHEMA_VERSION_INVALID', 'schema_version', draft.schema_version));
  if (!DOMAIN_UNIT_SET.has(input?.unit)) errors.push(issue('DOMAIN_UNIT_INVALID', 'input.unit', input?.unit));
  if (!DOMAIN_UNIT_SET.has(draft.unit)) errors.push(issue('DOMAIN_UNIT_INVALID', 'unit', draft.unit));
  let draftVersionSupported = true;
  try {
    requiredDomainUnitsForContract(draft.semantic_contract_version);
  } catch (error) {
    if (error.code !== 'SEMANTIC_CONTRACT_VERSION_UNSUPPORTED') throw error;
    errors.push(issue(error.code, 'semantic_contract_version', draft.semantic_contract_version));
    draftVersionSupported = false;
  }
  if (draftVersionSupported && draft.semantic_contract_version !== input.semantic_contract_version) {
    errors.push(issue('SEMANTIC_CONTRACT_MISMATCH', 'semantic_contract_version', draft.semantic_contract_version));
  }
  if (draft.unit !== input?.unit) errors.push(issue('UNIT_MISMATCH', 'unit', draft.unit));
  if (draft.input_hash !== input?.input_hash) errors.push(issue('INPUT_HASH_MISMATCH', 'input_hash', draft.input_hash));
  const topFields = new Set(['schema_version', 'semantic_contract_version', 'unit', 'input_hash', 'decisions', 'notes']);
  for (const field of Object.keys(draft)) {
    if (!topFields.has(field)) errors.push(issue('DOMAIN_DRAFT_FIELD_FORBIDDEN', field, field));
  }
  if (!Array.isArray(draft.decisions)) {
    errors.push(issue('DOMAIN_DECISIONS_REQUIRED', 'decisions'));
    return errors;
  }
  if (!Array.isArray(draft.notes)) errors.push(issue('DOMAIN_NOTES_INVALID', 'notes'));

  const entriesByRef = new Map((input?.entries || []).map(entry => [entry.entry_ref, entry]));
  const decisionsByRef = new Map();
  draft.decisions.forEach((decision, index) => {
    const label = `decisions[${index}]`;
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      errors.push(issue('DOMAIN_DECISION_INVALID', label));
      return;
    }
    const entry = entriesByRef.get(decision.entry_ref);
    if (!entry) {
      errors.push(issue('DOMAIN_ENTRY_UNKNOWN', `${label}.entry_ref`, decision.entry_ref));
      return;
    }
    const seen = decisionsByRef.get(decision.entry_ref) || 0;
    decisionsByRef.set(decision.entry_ref, seen + 1);
    if (!ACTIONS.has(decision.action)) {
      errors.push(issue('DOMAIN_ACTION_INVALID', `${label}.action`, decision.action));
      return;
    }
    if (decision.action === 'keep') {
      validatePatch(decision.patch, input, entry, label, entriesByRef, errors);
      if ((entry.category === 'characters' || entry.category === 'skills')
        && decision.patch && typeof decision.patch === 'object' && !Array.isArray(decision.patch)) {
        validatePowerRankPatch(decision.patch, label, errors);
      }
      if (entry.category === 'items') {
        validateItemInclusionReason(decision.patch, entry, label, errors);
      }
    }
    if (decision.action === 'merge') {
      const target = entriesByRef.get(decision.target_ref);
      if (!target) errors.push(issue('DOMAIN_MERGE_TARGET_UNKNOWN', `${label}.target_ref`, decision.target_ref));
      else if (target.category !== entry.category) {
        errors.push(issue('DOMAIN_MERGE_CATEGORY_MISMATCH', `${label}.target_ref`, decision.target_ref));
      } else if (target.entry_ref === entry.entry_ref) {
        errors.push(issue('DOMAIN_MERGE_SELF', `${label}.target_ref`, decision.target_ref));
      }
      validatePatch(decision.patch || {}, input, entry, label, entriesByRef, errors);
    }
    if (decision.action === 'reject') {
      if (!(REJECTION_REASONS[entry.category] || []).includes(decision.reason)) {
        errors.push(issue('DOMAIN_REJECTION_REASON_INVALID', `${label}.reason`, decision.reason));
      }
      if (!nonempty(decision.detail)) errors.push(issue('DOMAIN_REJECTION_DETAIL_REQUIRED', `${label}.detail`));
    }
    if (decision.action === 'pending') {
      if (!nonempty(decision.detail)) {
        errors.push(issue('DOMAIN_PENDING_DETAIL_REQUIRED', `${label}.detail`));
      }
      errors.push(issue('DOMAIN_PENDING_UNRESOLVED', `${label}.action`, decision.entry_ref));
    }
  });

  for (const entryRef of entriesByRef.keys()) {
    const count = decisionsByRef.get(entryRef) || 0;
    if (count === 0) errors.push(issue('DOMAIN_DECISION_MISSING', 'decisions', entryRef));
    if (count > 1) errors.push(issue('DOMAIN_DECISION_DUPLICATE', 'decisions', entryRef));
  }
  return errors;
}

function normalizeDomainDecisionDraft(draft, input) {
  const order = new Map((input?.entries || []).map((entry, index) => [entry.entry_ref, index]));
  return {
    schema_version: 1,
    semantic_contract_version: input.semantic_contract_version,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: structuredClone(draft.decisions || []).sort((left, right) => (
      (order.get(left.entry_ref) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.entry_ref) ?? Number.MAX_SAFE_INTEGER)
    )),
    notes: structuredClone(draft.notes || [])
  };
}

module.exports = {
  ACTIONS,
  REJECTION_REASONS,
  normalizeDomainDecisionDraft,
  validateDomainDecisionDraft
};
