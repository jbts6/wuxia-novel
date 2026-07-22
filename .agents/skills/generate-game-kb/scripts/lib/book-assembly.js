'use strict';

const { normalizeName } = require('./book-contract');
const { POWER_RANKS, CHARACTER_LEVELS } = require('./semantic-contract');

const GENERIC_CHARACTERS = new Set(['表哥', '管家婆', '店小二']);
const GENERIC_FACTIONS = new Set(['武林', '江湖']);

const LEVEL_PRIORITY = Object.freeze(Object.fromEntries(CHARACTER_LEVELS.map((level, i) => [level, i])));
const RANK_INDEX = Object.freeze(Object.fromEntries(POWER_RANKS.map((rank, i) => [rank, i])));

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-CN');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map(key => [key, stableValue(value[key])]));
}

function stableMarker(value) {
  return JSON.stringify(stableValue(value));
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const marker = stableMarker(value);
    if (seen.has(marker)) continue;
    seen.add(marker);
    result.push(structuredClone(value));
  }
  return result;
}

function compareSourceRefs(left, right) {
  return (Number(left?.chapter) - Number(right?.chapter))
    || ((Number.isInteger(left?.line_start) ? left.line_start : Number.MAX_SAFE_INTEGER)
      - (Number.isInteger(right?.line_start) ? right.line_start : Number.MAX_SAFE_INTEGER))
    || ((Number.isInteger(left?.line_end) ? left.line_end : Number.MAX_SAFE_INTEGER)
      - (Number.isInteger(right?.line_end) ? right.line_end : Number.MAX_SAFE_INTEGER))
    || compareText(left?.text, right?.text)
    || compareText(stableMarker(left), stableMarker(right));
}

function sortedSourceRefs(refs) {
  return uniqueInOrder(refs || []).sort(compareSourceRefs);
}

function memberRef(category, chapter, entity, index) {
  const local = entity?.candidate_key || entity?.registry_key || entity?.local_key || `${category}:${index}`;
  return `ch${String(chapter).padStart(3, '0')}:${local}`;
}

function orderedMembers(category, chapters) {
  const members = [];
  for (const chapter of chapters) {
    const entities = Array.isArray(chapter?.[category]) ? chapter[category] : [];
    entities.forEach((entity, index) => {
      members.push({
        category,
        chapter: Number(chapter.chapter),
        entity,
        index,
        member_ref: memberRef(category, chapter.chapter, entity, index),
        source_refs: sortedSourceRefs(entity?.source_refs || [])
      });
    });
  }
  return members;
}

function isGeneric(category, normalizedName) {
  if (category === 'characters') return GENERIC_CHARACTERS.has(normalizedName);
  if (category === 'factions') return GENERIC_FACTIONS.has(normalizedName);
  return false;
}

function canonicalName(members) {
  return String(members[0]?.entity?.name ?? '').normalize('NFKC').trim();
}

function groupSourceRefs(members) {
  return sortedSourceRefs(members.flatMap(member => member.source_refs));
}

function groupMemberRefs(members) {
  return uniqueInOrder(members.map(member => member.member_ref));
}

function evidencePosition(member) {
  const first = member.source_refs[0];
  return {
    chapter: Number.isInteger(first?.chapter) ? first.chapter : member.chapter,
    line_start: Number.isInteger(first?.line_start) ? first.line_start : Number.MAX_SAFE_INTEGER,
    line_end: Number.isInteger(first?.line_end) ? first.line_end : Number.MAX_SAFE_INTEGER
  };
}

function compareEvidencePosition(left, right) {
  return (left.chapter - right.chapter)
    || (left.line_start - right.line_start)
    || (left.line_end - right.line_end);
}

function latestEvidenceChapter(member) {
  const chapters = member.source_refs
    .map(ref => ref?.chapter)
    .filter(Number.isInteger);
  return chapters.length > 0 ? Math.max(...chapters) : member.chapter;
}

function resolveDescription(members, field = 'description') {
  const candidates = members.filter(member => (
    typeof member.entity?.[field] === 'string' && member.entity[field] !== ''
  ));
  if (candidates.length === 0) return { value: null, rule: 'all_null' };
  const ordered = [...candidates].sort((left, right) => (
    [...right.entity[field]].length - [...left.entity[field]].length
    || compareEvidencePosition(evidencePosition(left), evidencePosition(right))
    || compareText(left.entity[field], right.entity[field])
    || compareText(left.member_ref, right.member_ref)
  ));
  return {
    value: ordered[0].entity[field],
    rule: 'longest_unicode_then_earliest_source_ref_then_text'
  };
}

function resolveRank(members) {
  const groups = new Map();
  for (const member of members) {
    const value = member.entity?.rank;
    if (value == null) continue;
    const list = groups.get(value) || [];
    list.push(member);
    groups.set(value, list);
  }
  if (groups.size === 0) return { value: null, rule: 'all_null' };
  const ordered = [...groups.entries()].sort(([leftRank, leftMembers], [rightRank, rightMembers]) => (
    rightMembers.length - leftMembers.length
    || Math.max(...rightMembers.map(latestEvidenceChapter))
      - Math.max(...leftMembers.map(latestEvidenceChapter))
    || (RANK_INDEX[leftRank] ?? Number.MAX_SAFE_INTEGER)
      - (RANK_INDEX[rightRank] ?? Number.MAX_SAFE_INTEGER)
  ));
  return {
    value: ordered[0][0],
    rule: 'vote_count_then_latest_evidence_then_lower_power_rank_index'
  };
}

function resolveLevel(members) {
  const values = members.map(member => member.entity?.level).filter(value => value != null);
  if (values.length === 0) return { value: null, rule: 'all_null' };
  const value = [...values].sort((left, right) => (
    (LEVEL_PRIORITY[left] ?? Number.MAX_SAFE_INTEGER)
    - (LEVEL_PRIORITY[right] ?? Number.MAX_SAFE_INTEGER)
  ))[0];
  return { value, rule: 'highest_story_priority' };
}

function resolveTypes(members) {
  return {
    value: uniqueInOrder(members.flatMap(member => member.entity?.types || [])),
    rule: 'stable_union_in_chapter_order'
  };
}

function mergeArrays(members, field) {
  return uniqueInOrder(members.flatMap(member => member.entity?.[field] || []));
}

function summarizeCandidateValues(members, field) {
  const groups = new Map();
  for (const member of members) {
    const value = member.entity?.[field] ?? null;
    const marker = stableMarker(value);
    if (!groups.has(marker)) {
      groups.set(marker, {
        value: structuredClone(value),
        member_refs: [],
        source_refs: [],
        occurrences: 0
      });
    }
    const group = groups.get(marker);
    group.member_refs.push(member.member_ref);
    group.source_refs.push(...member.source_refs);
    group.occurrences += 1;
  }
  return [...groups.values()].map(group => ({
    ...group,
    member_refs: uniqueInOrder(group.member_refs),
    source_refs: sortedSourceRefs(group.source_refs),
    ...(field === 'description' && typeof group.value === 'string'
      ? { unicode_length: [...group.value].length }
      : {}),
    ...(field === 'rank'
      ? { latest_evidence_chapter: Math.max(...group.member_refs.map(ref => {
        const member = members.find(entry => entry.member_ref === ref);
        return member ? latestEvidenceChapter(member) : Number.MIN_SAFE_INTEGER;
      })) }
      : {})
  }));
}

function fieldDecision(category, name, members, field, result) {
  return {
    category,
    canonical_name: name,
    member_refs: groupMemberRefs(members),
    source_refs: groupSourceRefs(members),
    field,
    candidate_values: summarizeCandidateValues(members, field),
    selected_value: structuredClone(result.value),
    selection_rule: result.rule
  };
}

function resolveTechniques(members) {
  const groups = new Map();
  for (const member of members) {
    for (const technique of member.entity?.techniques || []) {
      const normalizedName = normalizeName(technique?.name);
      if (!normalizedName) continue;
      const list = groups.get(normalizedName) || [];
      list.push({
        ...member,
        entity: technique,
        member_ref: `${member.member_ref}:technique:${normalizedName}`
      });
      groups.set(normalizedName, list);
    }
  }
  return [...groups.values()].map(group => ({
    name: canonicalName(group),
    description: resolveDescription(group).value
  }));
}

function identityCollisionChapters(members) {
  const byChapter = new Map();
  for (const member of members) {
    const keys = byChapter.get(member.chapter) || new Set();
    keys.add(member.entity?.local_key);
    byChapter.set(member.chapter, keys);
  }
  return [...byChapter.entries()]
    .filter(([, keys]) => keys.size > 1)
    .map(([chapter]) => chapter)
    .sort((left, right) => left - right);
}

function genericWarning(category, name, members) {
  return {
    code: 'GENERIC_CANDIDATE_FILTERED',
    severity: 'warning',
    category,
    name,
    chapter_numbers: uniqueInOrder(members.map(member => member.chapter)).sort((a, b) => a - b),
    source_refs: groupSourceRefs(members),
    member_refs: groupMemberRefs(members),
    reason: 'confirmed_generic_name',
    resolution: 'filtered'
  };
}

function collisionReview(category, name, members, chapterNumbers) {
  return {
    code: 'IDENTITY_COLLISION_REVIEW_REQUIRED',
    severity: 'warning',
    category,
    name,
    chapter_numbers: chapterNumbers,
    source_refs: groupSourceRefs(members),
    member_refs: groupMemberRefs(members),
    reason: 'distinct_local_keys_share_exact_name_in_one_chapter',
    resolution: 'manual_review_required'
  };
}

function assembleGroup(category, members, fieldDecisions) {
  const name = canonicalName(members);
  const merged = {
    name,
    aliases: mergeArrays(members, 'aliases'),
    member_local_keys: uniqueInOrder(members.map(member => member.entity?.local_key).filter(Boolean))
  };

  const description = resolveDescription(members);

  if (category === 'characters') {
    merged.identities = mergeArrays(members, 'identities');
    merged.factions = mergeArrays(members, 'factions');
    merged.skills = mergeArrays(members, 'skills');
    const rank = resolveRank(members);
    const level = resolveLevel(members);
    merged.level = level.value;
    merged.rank = rank.value;
    merged.description = description.value;
    fieldDecisions.push(fieldDecision(category, name, members, 'description', description));
    fieldDecisions.push(fieldDecision(category, name, members, 'rank', rank));
    fieldDecisions.push(fieldDecision(category, name, members, 'level', level));
  } else if (category === 'skills') {
    const rank = resolveRank(members);
    const types = resolveTypes(members);
    merged.types = types.value;
    merged.factions = mergeArrays(members, 'factions');
    merged.rank = rank.value;
    merged.description = description.value;
    merged.techniques = resolveTechniques(members);
    fieldDecisions.push(fieldDecision(category, name, members, 'description', description));
    fieldDecisions.push(fieldDecision(category, name, members, 'rank', rank));
    fieldDecisions.push(fieldDecision(category, name, members, 'types', types));
  } else {
    const types = resolveTypes(members);
    merged.types = types.value;
    merged.description = description.value;
    fieldDecisions.push(fieldDecision(category, name, members, 'description', description));
    fieldDecisions.push(fieldDecision(category, name, members, 'types', types));
  }

  merged.source_refs = groupSourceRefs(members);
  return merged;
}

function assembleDeterministicBook({ manifest, chapters }) {
  void manifest;
  const categories = ['characters', 'skills', 'items', 'factions'];
  const orderedChapters = [...(Array.isArray(chapters) ? chapters : [])].sort((left, right) => (
    Number(left?.chapter) - Number(right?.chapter)
    || compareText(stableMarker(left), stableMarker(right))
  ));
  const book = { characters: [], skills: [], items: [], factions: [], chapter_summaries: [] };
  const fieldDecisions = [];
  const reviewWarnings = [];
  const manualReview = [];
  const typeNormalizations = [];

  for (const chapter of orderedChapters) {
    typeNormalizations.push(...structuredClone(chapter.normalizations || []));
    book.chapter_summaries.push({
      chapter: chapter.chapter,
      title: chapter.title,
      summary: chapter.chapter_summary?.summary || '',
      source_refs: sortedSourceRefs(chapter.chapter_summary?.source_refs || [])
    });
  }

  for (const category of categories) {
    const groups = new Map();
    for (const member of orderedMembers(category, orderedChapters)) {
      const normalizedName = normalizeName(member.entity?.name);
      if (!normalizedName) continue;
      const group = groups.get(normalizedName) || [];
      group.push(member);
      groups.set(normalizedName, group);
    }

    for (const [normalizedName, members] of groups) {
      const name = canonicalName(members);
      if (isGeneric(category, normalizedName)) {
        reviewWarnings.push(genericWarning(category, name, members));
        continue;
      }

      const collisionChapters = identityCollisionChapters(members);
      if (collisionChapters.length > 0) {
        manualReview.push(collisionReview(category, name, members, collisionChapters));
        continue;
      }

      book[category].push(assembleGroup(category, members, fieldDecisions));
    }
  }

  return {
    book,
    deterministic_audit: { field_decisions: fieldDecisions, type_normalizations: typeNormalizations },
    review_warnings: reviewWarnings,
    manual_review: manualReview
  };
}

module.exports = { GENERIC_CHARACTERS, GENERIC_FACTIONS, assembleDeterministicBook };
