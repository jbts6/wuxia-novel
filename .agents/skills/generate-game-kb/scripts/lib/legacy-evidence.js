'use strict';

const crypto = require('node:crypto');

const { buildCandidateRegistry } = require('./candidate-registry');
const { validateGroundedRecord } = require('./grounding');

const ENTITY_CATEGORIES = Object.freeze(['characters', 'skills', 'items', 'factions']);

function candidateKey(category, localKey, chapter, refs) {
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify({ category, localKey, chapter, refs }))
    .digest('hex')
    .slice(0, 16);
  return `legacy:${category}:${digest}`;
}

function normalizeChapters(value) {
  const chapters = Array.isArray(value) ? value : value?.chapters;
  return [...(Array.isArray(chapters) ? chapters : [])]
    .filter(chapter => chapter && Number.isInteger(Number(chapter.number)))
    .map(chapter => ({
      ...chapter,
      number: Number(chapter.number),
      text: String(chapter.text ?? chapter.content ?? ''),
      title: String(chapter.title ?? `第${chapter.number}章`),
      hash: chapter.hash || chapter.input_hash || null
    }))
    .sort((left, right) => left.number - right.number);
}

function issue(code, details = {}) {
  return { code, ...details };
}

function cloneCandidate(category, record, refs, chapter) {
  const candidate = structuredClone(record);
  delete candidate.registry_key;
  delete candidate.id;
  delete candidate.candidate_key;
  candidate.local_key = record.local_key || `${record.name}:${chapter.number}`;
  candidate.candidate_key = candidateKey(
    category,
    candidate.local_key,
    chapter.number,
    refs
  );
  candidate.source_refs = refs;
  return candidate;
}

function refsByChapter(record) {
  const refs = Array.isArray(record?.source_refs) ? record.source_refs : [];
  const grouped = new Map();
  for (const ref of refs) {
    const chapter = Number(ref?.chapter);
    const list = grouped.get(chapter) || [];
    list.push(ref);
    grouped.set(chapter, list);
  }
  return grouped;
}

function validateRecordEvidence(category, record, chaptersByNumber, unresolved) {
  const validByChapter = new Map();
  for (const [chapterNumber, refs] of refsByChapter(record)) {
    const chapter = chaptersByNumber.get(chapterNumber);
    if (!chapter) {
      unresolved.push(issue('SOURCE_CHAPTER_MISMATCH', {
        category,
        record: record.local_key || record.name,
        chapter: chapterNumber
      }));
      continue;
    }
    const validRefs = [];
    for (const ref of refs) {
      const result = validateGroundedRecord(
        { ...record, source_refs: [ref] },
        {
          chapterNumber,
          chapterText: chapter.text,
          label: `${category}:${record.local_key || record.name}`
        }
      );
      if (result.errors.length > 0) {
        unresolved.push(...result.errors.map(error => ({
          ...error,
          category,
          record: record.local_key || record.name,
          chapter: chapterNumber
        })));
        continue;
      }
      const normalized = result.normalizedRefs[0] || { chapter: chapterNumber, text: ref.text };
      if (ref.anchor !== undefined) normalized.anchor = ref.anchor;
      validRefs.push(normalized);
    }
    if (validRefs.length > 0) validByChapter.set(chapterNumber, validRefs);
  }
  return validByChapter;
}

function bindChapterSummaries(mapped, chaptersByNumber, chapters, rejected, unresolved) {
  const summaries = Array.isArray(mapped?.book?.chapter_summaries)
    ? mapped.book.chapter_summaries
    : [];
  const byChapter = new Map();
  for (const [index, summary] of summaries.entries()) {
    const number = Number(summary?.chapter);
    if (!Number.isInteger(number) || !chaptersByNumber.has(number) || byChapter.has(number)) {
      const coverage = issue('LEGACY_SUMMARY_COVERAGE_INVALID', {
        index,
        chapter: summary?.chapter ?? null
      });
      rejected.push(coverage);
      unresolved.push(coverage);
      continue;
    }
    const chapter = chaptersByNumber.get(number);
    const refs = Array.isArray(summary.source_refs) ? summary.source_refs : [];
    const chapterHashRef = [{
      chapter: number,
      text: chapter.title,
      content_hash: chapter.hash
    }];
    let normalizedRefs = chapterHashRef;
    if (refs.length > 0) {
      const valid = validateRecordEvidence('chapter_summaries', {
        ...summary,
        name: '',
        source_refs: refs
      }, chaptersByNumber, unresolved);
      normalizedRefs = valid.get(number) || [];
      if (normalizedRefs.length === 0) {
        normalizedRefs = chapterHashRef;
      }
    }
    byChapter.set(number, {
      chapter: number,
      title: typeof summary.title === 'string' ? summary.title : chapter.title,
      summary: typeof summary.summary === 'string' ? summary.summary : null,
      source_refs: normalizedRefs
    });
  }
  for (const chapter of chapters) {
    if (!byChapter.has(chapter.number)) {
      const coverage = issue('LEGACY_SUMMARY_COVERAGE_INVALID', {
        chapter: chapter.number,
        reason: 'missing'
      });
      rejected.push(coverage);
      unresolved.push(coverage);
    }
  }
  return byChapter;
}

function pruneReferences(chapters, unresolved) {
  for (const chapter of chapters) {
    const keys = Object.fromEntries(ENTITY_CATEGORIES.map(category => [
      category,
      new Set((chapter[category] || []).map(record => record.local_key))
    ]));
    for (const record of chapter.characters || []) {
      for (const [field, targetCategory] of [['skills', 'skills'], ['factions', 'factions']]) {
        if (!Array.isArray(record[field])) continue;
        record[field] = record[field].filter(target => {
          if (keys[targetCategory].has(target)) return true;
          unresolved.push(issue('LEGACY_REFERENCE_UNRESOLVED', {
            category: 'characters',
            record: record.local_key,
            field,
            target,
            chapter: chapter.chapter
          }));
          return false;
        });
      }
    }
    for (const record of chapter.skills || []) {
      if (!Array.isArray(record.factions)) continue;
      record.factions = record.factions.filter(target => {
        if (keys.factions.has(target)) return true;
        unresolved.push(issue('LEGACY_REFERENCE_UNRESOLVED', {
          category: 'skills',
          record: record.local_key,
          field: 'factions',
          target,
          chapter: chapter.chapter
        }));
        return false;
      });
    }
  }
}

function collectLegacyGroups(chapters) {
  const groups = [];
  const byCategory = Object.fromEntries(ENTITY_CATEGORIES.map(category => [category, new Map()]));
  for (const chapter of chapters) {
    for (const category of ENTITY_CATEGORIES) {
      for (const candidate of chapter[category] || []) {
        const members = byCategory[category].get(candidate.local_key) || [];
        members.push(candidate.candidate_key);
        byCategory[category].set(candidate.local_key, members);
      }
    }
  }
  for (const category of ENTITY_CATEGORIES) {
    for (const [localKey, memberRefs] of byCategory[category]) {
      const ordered = [...new Set(memberRefs)].sort();
      if (ordered.length > 1) {
        groups.push({
          category,
          local_key: localKey,
          anchor_member_ref: ordered[0],
          member_refs: ordered
        });
      }
    }
  }

  return groups.sort((left, right) => (
    `${left.category}\u0000${left.local_key}` < `${right.category}\u0000${right.local_key}` ? -1
      : `${left.category}\u0000${left.local_key}` > `${right.category}\u0000${right.local_key}` ? 1 : 0
  ));
}

function rebuildLegacyEvidence(mapped, chaptersInput) {
  const chapters = normalizeChapters(chaptersInput);
  const chaptersByNumber = new Map(chapters.map(chapter => [chapter.number, chapter]));
  const rejected = [];
  const unresolved = [];
  const acceptedChapters = chapters.map(chapter => ({
    ...chapter,
    chapter: chapter.number,
    characters: [],
    items: [],
    skills: [],
    factions: [],
    chapter_summary: null
  }));
  const acceptedByNumber = new Map(acceptedChapters.map(chapter => [chapter.number, chapter]));

  const summaries = bindChapterSummaries(mapped, chaptersByNumber, chapters, rejected, unresolved);
  for (const [number, summary] of summaries) acceptedByNumber.get(number).chapter_summary = summary;

  for (const category of ENTITY_CATEGORIES) {
    for (const record of Array.isArray(mapped?.book?.[category]) ? mapped.book[category] : []) {
      const validByChapter = validateRecordEvidence(category, record, chaptersByNumber, unresolved);
      if (validByChapter.size === 0) {
        rejected.push({
          code: 'LEGACY_ENTITY_EVIDENCE_INVALID',
          category,
          record: record.local_key || record.name
        });
        continue;
      }
      for (const [number, refs] of validByChapter) {
        acceptedByNumber.get(number)[category].push(cloneCandidate(category, record, refs, { number }));
      }
    }
  }

  pruneReferences(acceptedChapters, unresolved);
  const candidateRegistry = buildCandidateRegistry(acceptedChapters);
  return {
    acceptedChapters,
    candidateRegistry,
    rejected,
    unresolved
  };
}

module.exports = { collectLegacyGroups, rebuildLegacyEvidence };
