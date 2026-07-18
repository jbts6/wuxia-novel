'use strict';

const { CANDIDATE_ARRAYS } = require('./chapter-contract');
const { GameKbError } = require('./errors');

const SINGLE_REFERENCE_FIELDS = Object.freeze({
  source_skill_local_key: ['skills', 'source_skill_registry_key'],
  character_local_key: ['characters', 'character_registry_key'],
  owner_local_key: ['characters', 'owner_registry_key'],
  item_local_key: ['items', 'item_registry_key'],
  faction_local_key: ['factions', 'faction_registry_key'],
});

const ARRAY_REFERENCE_FIELDS = Object.freeze({
  participant_local_keys: ['characters', 'participant_registry_keys'],
  character_local_keys: ['characters', 'character_registry_keys'],
  skill_local_keys: ['skills', 'skill_registry_keys'],
  technique_local_keys: ['techniques', 'technique_registry_keys'],
  item_local_keys: ['items', 'item_registry_keys'],
  faction_local_keys: ['factions', 'faction_registry_keys']
});

const GENERIC_ACTION_PATTERN = /^(?:挥手|反手|随手|抬手|翻手|回手|顺手|出手|连发)(?:一|两|三|四|五|六|七|八|九|十|数|几|数十|连)(?:击|掌|拳|刀|剑|指|爪|腿|脚)$/u;
const CONFLICT_FIELDS = Object.freeze([
  ['identity', candidate => candidate?.identity || candidate?.canonical_identity],
  ['type', candidate => candidate?.type]
]);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-Hans-CN');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map(key => [key, stableValue(value[key])]));
}

function stableMarker(value) {
  return JSON.stringify(stableValue(value));
}

function uniqueValues(values) {
  const byMarker = new Map();
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const marker = stableMarker(value);
    if (!byMarker.has(marker)) byMarker.set(marker, structuredClone(value));
  }
  return [...byMarker.entries()].sort(([left], [right]) => compareText(left, right)).map(([, value]) => value);
}

function normalizeCandidateName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[·•∙⋅・]/g, '·')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*([·-])\s*/g, '$1');
}

function isGenericActionDescription(name) {
  return GENERIC_ACTION_PATTERN.test(normalizeCandidateName(name).replace(/\s+/g, ''));
}

function compareSourceRefs(left, right) {
  return (Number(left?.chapter) - Number(right?.chapter))
    || compareText(left?.text, right?.text)
    || compareText(stableMarker(left), stableMarker(right));
}

function sortedSourceRefs(refs) {
  return uniqueValues(refs).sort(compareSourceRefs);
}

function candidateName(category, candidate) {
  return normalizeCandidateName(candidate?.name || candidate?.canonical_name || candidate?.local_key);
}

function mergeTechniqueRecords(techniques) {
  const groups = new Map();
  for (const technique of techniques) {
    const normalizedName = normalizeCandidateName(technique?.name);
    const list = groups.get(normalizedName) || [];
    list.push(technique);
    groups.set(normalizedName, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([normalizedName, records]) => {
      const merged = mergeRecords(records);
      if (!merged.name) merged.name = normalizedName;
      return merged;
    });
}

function mergeRecords(records) {
  const output = {};
  const keys = uniqueValues(records.flatMap(record => Object.keys(record || {}))).sort(compareText);
  for (const key of keys) {
    if (key === 'candidate_key') continue;
    const values = records.map(record => record?.[key]).filter(value => value !== undefined && value !== null && value !== '');
    if (values.length === 0) continue;
    if (values.some(Array.isArray)) {
      const flattened = values.flatMap(value => Array.isArray(value) ? value : [value]);
      if (key === 'source_refs') output[key] = sortedSourceRefs(flattened);
      else if (key === 'techniques') output[key] = mergeTechniqueRecords(flattened);
      else output[key] = uniqueValues(flattened);
      continue;
    }
    if (values.every(value => value && typeof value === 'object')) {
      output[key] = mergeRecords(values);
      continue;
    }
    output[key] = structuredClone(values[0]);
  }
  return output;
}

function identityConflict(members) {
  const identities = uniqueValues(members.map(member => normalizeCandidateName(
    member.candidate?.identity || member.candidate?.canonical_identity
  )).filter(Boolean));
  return identities.length > 1;
}

function conflictingFields(members) {
  return CONFLICT_FIELDS.map(([field, project]) => {
    const values = uniqueValues(members
      .map(member => project(member.candidate))
      .filter(value => value !== undefined && value !== null && value !== '')
      .map(value => typeof value === 'string' ? normalizeCandidateName(value) : value));
    return { field, values };
  }).filter(item => item.values.length > 1);
}

function nearName(left, right) {
  if (!left || !right || left === right) return false;
  const compactLeft = left.replace(/[\s·・._-]/g, '');
  const compactRight = right.replace(/[\s·・._-]/g, '');
  if (compactLeft === compactRight) return true;
  const shorter = compactLeft.length <= compactRight.length ? compactLeft : compactRight;
  const longer = compactLeft.length > compactRight.length ? compactLeft : compactRight;
  return shorter.length >= 2 && longer.includes(shorter) && longer.length - shorter.length <= 2;
}

function referenceError(code, member, field, target, matches) {
  throw new GameKbError(code, 'Candidate registry reference cannot be resolved uniquely', {
    candidate_key: member.candidate.candidate_key,
    chapter: member.chapter,
    field,
    target,
    matches
  });
}

function resolveReference(localIndex, member, field, category, localKey) {
  const indexKey = `${member.chapter}\u0000${category}\u0000${localKey}`;
  const matches = [...(localIndex.get(indexKey) || [])].sort(compareText);
  if (matches.length === 0) referenceError('REGISTRY_REFERENCE_MISSING', member, field, localKey, []);
  if (matches.length !== 1) referenceError('REGISTRY_REFERENCE_AMBIGUOUS', member, field, localKey, matches);
  return matches[0];
}

function migrateRecordReferences(member, localIndex) {
  const record = structuredClone(member.candidate);
  delete record.candidate_key;
  for (const [field, [category, outputField]] of Object.entries(SINGLE_REFERENCE_FIELDS)) {
    if (record[field] === undefined || record[field] === null || record[field] === '') continue;
    record[outputField] = resolveReference(localIndex, member, field, category, record[field]);
    delete record[field];
  }
  for (const [field, [category, outputField]] of Object.entries(ARRAY_REFERENCE_FIELDS)) {
    if (!Array.isArray(record[field])) continue;
    record[outputField] = uniqueValues(record[field].map(localKey => (
      resolveReference(localIndex, member, field, category, localKey)
    )));
    delete record[field];
  }
  return record;
}

function pendingRow(reason, entries) {
  return {
    reason,
    registry_keys: entries.map(entry => entry.registry_key).sort(compareText),
    member_refs: uniqueValues(entries.flatMap(entry => entry.member_refs))
  };
}

function buildCandidateRegistry(chapters) {
  const membersByCategory = Object.fromEntries(CANDIDATE_ARRAYS.map(category => [category, []]));
  for (const chapter of [...(Array.isArray(chapters) ? chapters : [])].sort((a, b) => a.chapter - b.chapter)) {
    for (const category of CANDIDATE_ARRAYS) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        if (!candidate?.candidate_key || !candidate?.local_key) {
          throw new GameKbError('REGISTRY_CANDIDATE_INVALID', 'Candidate registry requires normalized chapter candidates', {
            chapter: chapter?.chapter,
            category,
            local_key: candidate?.local_key ?? null
          });
        }
        membersByCategory[category].push({ chapter: chapter.chapter, category, candidate: structuredClone(candidate) });
      }
    }
  }

  const categories = Object.fromEntries(CANDIDATE_ARRAYS.map(category => [category, []]));
  const bindings = {};
  const internalMembers = new Map();
  const pending = [];

  for (const category of CANDIDATE_ARRAYS) {
    const groups = new Map();
    for (const member of membersByCategory[category]) {
      const normalized = candidateName(category, member.candidate);
      const list = groups.get(normalized) || [];
      list.push(member);
      groups.set(normalized, list);
    }
    const planned = [];
    for (const [normalizedName, members] of [...groups.entries()].sort(([left], [right]) => compareText(left, right))) {
      const sorted = [...members].sort((left, right) => compareText(left.candidate.candidate_key, right.candidate.candidate_key));
      if (conflictingFields(sorted).length > 0) {
        for (const member of sorted) planned.push({ normalizedName, members: [member], conflict: true });
      } else {
        planned.push({ normalizedName, members: sorted, conflict: false });
      }
    }
    planned.sort((left, right) => compareText(
      `${left.normalizedName}\u0000${left.members[0].candidate.candidate_key}`,
      `${right.normalizedName}\u0000${right.members[0].candidate.candidate_key}`
    ));
    planned.forEach((plan, index) => {
      const registryKey = `registry:${category}:${String(index + 1).padStart(4, '0')}`;
      const names = uniqueValues(plan.members.map(member => normalizeCandidateName(
        member.candidate.name || member.candidate.canonical_name
      )).filter(Boolean));
      const entry = {
        registry_key: registryKey,
        category,
        canonical_name: names[0] || plan.normalizedName,
        normalized_name: plan.normalizedName,
        aliases: names.filter(name => name !== (names[0] || plan.normalizedName)),
        member_refs: plan.members.map(member => member.candidate.candidate_key).sort(compareText),
        record: null
      };
      categories[category].push(entry);
      internalMembers.set(registryKey, plan.members);
      for (const member of plan.members) {
        const candidateKey = member.candidate.candidate_key;
        if (bindings[candidateKey] && bindings[candidateKey] !== registryKey) {
          throw new GameKbError(
            'REGISTRY_REFERENCE_AMBIGUOUS',
            'Candidate key maps to multiple registry entries',
            { candidate_key: candidateKey, matches: [bindings[candidateKey], registryKey] }
          );
        }
        bindings[candidateKey] = registryKey;
      }
    });

    for (const group of [...groups.values()].filter(members => conflictingFields(members).length > 0)) {
      const keys = group.map(member => bindings[member.candidate.candidate_key]);
      const reason = identityConflict(group) ? 'IDENTITY_CONFLICT' : 'RECORD_CONFLICT';
      pending.push(pendingRow(reason, categories[category].filter(entry => keys.includes(entry.registry_key))));
    }
  }

  const localIndex = new Map();
  for (const category of CANDIDATE_ARRAYS) {
    for (const member of membersByCategory[category]) {
      const indexKey = `${member.chapter}\u0000${category}\u0000${member.candidate.local_key}`;
      if (!localIndex.has(indexKey)) localIndex.set(indexKey, new Set());
      localIndex.get(indexKey).add(bindings[member.candidate.candidate_key]);
    }
  }
  for (const category of CANDIDATE_ARRAYS) {
    for (const entry of categories[category]) {
      const records = internalMembers.get(entry.registry_key).map(member => migrateRecordReferences(member, localIndex));
      entry.record = mergeRecords(records);
      entry.record.source_refs = sortedSourceRefs(records.flatMap(record => record.source_refs || []));
      entry.source_chapters = uniqueValues(entry.record.source_refs.map(ref => ref.chapter)).sort((a, b) => a - b);
    }
  }

  for (const category of CANDIDATE_ARRAYS) {
    const entries = categories[category];
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        if (nearName(entries[left].normalized_name, entries[right].normalized_name)) {
          pending.push(pendingRow('NEAR_NAME', [entries[left], entries[right]]));
        }
      }
    }
  }

  const namesAcrossCategories = new Map();
  for (const category of CANDIDATE_ARRAYS) {
    for (const entry of categories[category]) {
      const list = namesAcrossCategories.get(entry.normalized_name) || [];
      list.push(entry);
      namesAcrossCategories.set(entry.normalized_name, list);
    }
  }
  for (const entries of namesAcrossCategories.values()) {
    if (new Set(entries.map(entry => entry.category)).size > 1) {
      pending.push(pendingRow('CROSS_CATEGORY_NAME', entries));
    }
  }

  pending.sort((left, right) => compareText(
    `${left.reason}\u0000${left.registry_keys.join('|')}`,
    `${right.reason}\u0000${right.registry_keys.join('|')}`
  ));
  const orderedBindings = Object.fromEntries(Object.entries(bindings).sort(([left], [right]) => compareText(left, right)));
  const inputCandidates = Object.values(membersByCategory).reduce((sum, members) => sum + members.length, 0);
  const registeredEntries = Object.values(categories).reduce((sum, entries) => sum + entries.length, 0);
  return {
    schema_version: 1,
    categories,
    bindings: orderedBindings,
    pending,
    stats: {
      input_candidates: inputCandidates,
      registered_entries: registeredEntries,
      exact_merges: inputCandidates - registeredEntries,
      pending_groups: pending.length
    }
  };
}

function quarantineGenericAction({ category, chapter, record, parent }) {
  const ownSourceRefs = Array.isArray(record?.source_refs) ? record.source_refs : [];
  const parentSourceRefs = Array.isArray(parent?.source_refs) ? parent.source_refs : [];
  return {
    reason: 'GENERIC_ACTION_DESCRIPTION',
    category,
    normalized_name: normalizeCandidateName(record?.name),
    chapter,
    ...(record?.candidate_key ? { candidate_key: record.candidate_key } : {}),
    ...(parent?.candidate_key ? { parent_candidate_key: parent.candidate_key } : {}),
    record: structuredClone(record),
    source_refs: sortedSourceRefs(ownSourceRefs.length > 0 ? ownSourceRefs : parentSourceRefs)
  };
}

function sanitizeBasicChapters(chapters, quarantine) {
  return [...(Array.isArray(chapters) ? chapters : [])]
    .sort((left, right) => Number(left?.chapter) - Number(right?.chapter))
    .map(chapter => {
      const sanitized = structuredClone(chapter);
      for (const category of CANDIDATE_ARRAYS) {
        const candidates = [];
        for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
          if (category === 'skills' && isGenericActionDescription(candidate?.name)) {
            quarantine.push(quarantineGenericAction({ category, chapter: chapter.chapter, record: candidate }));
            continue;
          }
          const record = structuredClone(candidate);
          if (category === 'skills') {
            const techniques = [];
            for (const technique of Array.isArray(candidate?.techniques) ? candidate.techniques : []) {
              if (isGenericActionDescription(technique?.name)) {
                quarantine.push(quarantineGenericAction({
                  category: 'techniques',
                  chapter: chapter.chapter,
                  record: technique,
                  parent: candidate
                }));
              } else {
                techniques.push(technique);
              }
            }
            record.techniques = mergeTechniqueRecords(techniques);
          }
          candidates.push(record);
        }
        sanitized[category] = candidates;
      }
      return sanitized;
    });
}

function collectConflictWarnings(chapters) {
  const warnings = [];
  for (const category of CANDIDATE_ARRAYS) {
    const groups = new Map();
    for (const chapter of chapters) {
      for (const candidate of Array.isArray(chapter?.[category]) ? chapter[category] : []) {
        const normalizedName = candidateName(category, candidate);
        const list = groups.get(normalizedName) || [];
        list.push({ chapter: chapter.chapter, category, candidate });
        groups.set(normalizedName, list);
      }
    }
    for (const [normalizedName, members] of groups) {
      const fields = conflictingFields(members);
      if (fields.length === 0) continue;
      warnings.push({
        code: 'CANDIDATE_CONFLICT',
        category,
        normalized_name: normalizedName,
        conflicting_fields: fields,
        member_refs: members.map(member => member.candidate.candidate_key).sort(compareText),
        source_refs: sortedSourceRefs(members.flatMap(member => member.candidate.source_refs || []))
      });
    }
  }
  return warnings.sort((left, right) => compareText(
    `${left.category}\u0000${left.normalized_name}`,
    `${right.category}\u0000${right.normalized_name}`
  ));
}

function buildBasicCandidateRegistry(chapters) {
  const quarantine = [];
  const sanitizedChapters = sanitizeBasicChapters(chapters, quarantine);
  const registry = buildCandidateRegistry(sanitizedChapters);
  registry.pending = [];
  registry.stats.pending_groups = 0;
  return {
    registry,
    quarantine: quarantine.sort((left, right) => compareText(
      `${left.normalized_name}\u0000${left.category}\u0000${left.chapter}\u0000${left.candidate_key || left.parent_candidate_key || ''}`,
      `${right.normalized_name}\u0000${right.category}\u0000${right.chapter}\u0000${right.candidate_key || right.parent_candidate_key || ''}`
    )),
    warnings: collectConflictWarnings(sanitizedChapters)
  };
}

module.exports = {
  ARRAY_REFERENCE_FIELDS,
  SINGLE_REFERENCE_FIELDS,
  buildBasicCandidateRegistry,
  buildCandidateRegistry,
  isGenericActionDescription,
  mergeRegistryRecords: mergeRecords,
  normalizeCandidateName,
  normalizeRegistryName: normalizeCandidateName
};
