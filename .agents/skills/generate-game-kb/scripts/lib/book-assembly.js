'use strict';

const { POWER_RANKS, CHARACTER_LEVELS } = require('./semantic-contract');

const GENERIC_CHARACTERS = new Set(['表哥', '管家婆', '店小二']);
const GENERIC_FACTIONS = new Set(['武林', '江湖']);

const LEVEL_PRIORITY = Object.freeze(Object.fromEntries(CHARACTER_LEVELS.map((level, i) => [level, i])));
const RANK_INDEX = Object.freeze(Object.fromEntries(POWER_RANKS.map((rank, i) => [rank, i])));

function isGeneric(category, name) {
  if (category === 'characters') return GENERIC_CHARACTERS.has(name);
  if (category === 'factions') return GENERIC_FACTIONS.has(name);
  return false;
}

function mergeArrays(seen, values) {
  for (const value of values || []) {
    if (typeof value === 'string' && !seen.includes(value)) {
      seen.push(value);
    }
  }
  return seen;
}

function resolveDescription(candidates) {
  if (candidates.length === 0) return { value: null, rule: 'no_candidates' };
  const nonNull = candidates.filter(c => c.value != null && c.value !== '');
  if (nonNull.length === 0) return { value: null, rule: 'all_null' };
  if (nonNull.length === 1) return { value: nonNull[0].value, rule: 'single' };
  let best = nonNull[0];
  for (let i = 1; i < nonNull.length; i++) {
    const current = nonNull[i];
    if ([...current.value].length > [...best.value].length) {
      best = current;
    } else if ([...current.value].length === [...best.value].length && current.chapter < best.chapter) {
      best = current;
    }
  }
  return { value: best.value, rule: nonNull.length > 1 ? 'longest' : 'single' };
}

function resolveRank(candidates) {
  const nonNull = candidates.filter(c => c.value != null);
  if (nonNull.length === 0) return { value: null, rule: 'no_candidates' };
  if (nonNull.length === 1) return { value: nonNull[0].value, rule: 'single' };
  const votes = {};
  for (const c of nonNull) {
    votes[c.value] = (votes[c.value] || 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(votes));
  const tied = Object.keys(votes).filter(r => votes[r] === maxVotes);
  if (tied.length === 1) return { value: tied[0], rule: 'majority' };
  const latest = nonNull
    .filter(c => tied.includes(c.value))
    .sort((a, b) => b.chapter - a.chapter)[0];
  const latestChapter = latest.chapter;
  const latestTied = tied.filter(r =>
    nonNull.some(c => c.value === r && c.chapter === latestChapter)
  );
  if (latestTied.length === 1) return { value: latestTied[0], rule: 'latest_chapter' };
  const byIndex = latestTied.sort((a, b) => (RANK_INDEX[a] ?? 99) - (RANK_INDEX[b] ?? 99));
  return { value: byIndex[0], rule: 'lower_index_tiebreak' };
}

function resolveLevel(candidates) {
  const nonNull = candidates.filter(c => c.value != null);
  if (nonNull.length === 0) return { value: null, rule: 'no_candidates' };
  if (nonNull.length === 1) return { value: nonNull[0].value, rule: 'single' };
  let best = nonNull[0];
  for (let i = 1; i < nonNull.length; i++) {
    if ((LEVEL_PRIORITY[nonNull[i].value] ?? 99) < (LEVEL_PRIORITY[best.value] ?? 99)) {
      best = nonNull[i];
    }
  }
  return { value: best.value, rule: 'priority' };
}

function resolveTypes(candidates) {
  const merged = [];
  for (const c of candidates) {
    mergeArrays(merged, c.value);
  }
  return { value: merged, rule: candidates.length > 1 ? 'union' : 'single' };
}

function resolveTechniques(candidates) {
  const byName = new Map();
  for (const c of candidates) {
    for (const tech of c.value || []) {
      if (!tech || typeof tech.name !== 'string') continue;
      if (!byName.has(tech.name)) {
        byName.set(tech.name, []);
      }
      byName.get(tech.name).push({ ...tech, chapter: c.chapter });
    }
  }
  const result = [];
  for (const [name, entries] of byName) {
    const desc = resolveDescription(entries.map(e => ({ value: e.description, chapter: e.chapter })));
    result.push({ name, description: desc.value });
  }
  return result;
}

function assembleDeterministicBook({ manifest, chapters }) {
  const categories = ['characters', 'skills', 'items', 'factions'];
  const book = { characters: [], skills: [], items: [], factions: [], chapter_summaries: [] };
  const fieldDecisions = [];
  const reviewWarnings = [];
  const manualReview = [];
  const typeNormalizations = [];

  for (const chapter of chapters) {
    if (chapter.normalizations) {
      typeNormalizations.push(...chapter.normalizations);
    }
    book.chapter_summaries.push({
      chapter: chapter.chapter,
      title: chapter.title,
      summary: chapter.chapter_summary?.summary || '',
      source_refs: chapter.chapter_summary?.source_refs || []
    });
  }

  for (const category of categories) {
    const groups = new Map();
    const collisions = [];

    for (const chapter of chapters) {
      const entities = chapter[category] || [];
      const seenInChapter = new Set();
      for (const entity of entities) {
        const key = entity.name;
        if (seenInChapter.has(key)) {
          collisions.push({ category, name: key, chapter: chapter.chapter });
          continue;
        }
        seenInChapter.add(key);

        if (isGeneric(category, key)) {
          reviewWarnings.push({
            code: 'GENERIC_CANDIDATE_FILTERED',
            category,
            name: key,
            chapter: chapter.chapter
          });
          continue;
        }

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push({ ...entity, _chapter: chapter.chapter });
      }
    }

    for (const collision of collisions) {
      manualReview.push({
        code: 'IDENTITY_COLLISION_REVIEW_REQUIRED',
        ...collision
      });
    }

    for (const [name, candidates] of groups) {
      const merged = { name };
      const decisions = { category, name, fields: {} };

      merged.aliases = candidates.reduce((acc, c) => mergeArrays(acc, c.aliases), []);

      if (category === 'characters') {
        merged.identities = candidates.reduce((acc, c) => mergeArrays(acc, c.identities), []);
        merged.factions = candidates.reduce((acc, c) => mergeArrays(acc, c.factions), []);
        merged.skills = candidates.reduce((acc, c) => mergeArrays(acc, c.skills), []);

        const levelResult = resolveLevel(candidates.map(c => ({ value: c.level, chapter: c._chapter })));
        merged.level = levelResult.value;
        decisions.fields.level = levelResult;

        const rankResult = resolveRank(candidates.map(c => ({ value: c.rank, chapter: c._chapter })));
        merged.rank = rankResult.value;
        decisions.fields.rank = rankResult;
      }

      if (category === 'skills') {
        merged.types = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter }))).value;
        merged.factions = candidates.reduce((acc, c) => mergeArrays(acc, c.factions), []);
        merged.techniques = resolveTechniques(candidates.map(c => ({ value: c.techniques, chapter: c._chapter })));

        const rankResult = resolveRank(candidates.map(c => ({ value: c.rank, chapter: c._chapter })));
        merged.rank = rankResult.value;
        decisions.fields.rank = rankResult;

        const typesResult = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter })));
        decisions.fields.types = typesResult;
      }

      if (category === 'items') {
        merged.types = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter }))).value;
        const typesResult = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter })));
        decisions.fields.types = typesResult;
      }

      if (category === 'factions') {
        merged.types = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter }))).value;
        const typesResult = resolveTypes(candidates.map(c => ({ value: c.types, chapter: c._chapter })));
        decisions.fields.types = typesResult;
      }

      const descResult = resolveDescription(candidates.map(c => ({ value: c.description, chapter: c._chapter })));
      merged.description = descResult.value;
      decisions.fields.description = descResult;

      merged.source_refs = candidates.reduce((acc, c) => {
        for (const ref of c.source_refs || []) {
          if (!acc.some(r => r.chapter === ref.chapter && r.text === ref.text)) {
            acc.push(ref);
          }
        }
        return acc;
      }, []);

      book[category].push(merged);
      fieldDecisions.push(decisions);
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
