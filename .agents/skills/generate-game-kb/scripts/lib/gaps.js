'use strict';

const fs = require('node:fs');

const { buildCandidateLedger } = require('./candidate-ledger');
const { buildChapterCoverage } = require('./coverage');
const { readJson } = require('./io');
const { isHighPriorityCategory } = require('./priority');

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function validNoneFound(value) {
  return Boolean(value)
    && value.conclusion === 'none_found'
    && Array.isArray(value.chapters)
    && value.chapters.length > 0
    && typeof value.reason === 'string'
    && value.reason.trim() !== '';
}

function readCoverageInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  if (input.coverage && typeof input.coverage === 'string' && fs.existsSync(input.coverage)) {
    return { ...readJson(input.coverage), ...input };
  }
  if (input.coverage && typeof input.coverage === 'object') return { ...input.coverage, ...input };
  if (input.coverage_path && fs.existsSync(input.coverage_path)) {
    return { ...readJson(input.coverage_path), ...input };
  }
  if (typeof input.chapters === 'string' && fs.existsSync(input.chapters)) {
    const chapters = fs.readdirSync(input.chapters)
      .filter(name => /^ch_\d+\.json$/.test(name))
      .sort()
      .map(name => readJson(`${input.chapters}/${name}`));
    const chapterCoverage = buildChapterCoverage(chapters);
    const merged = typeof input.merged === 'string' && fs.existsSync(input.merged)
      ? readJson(input.merged)
      : null;
    const ledger = merged ? buildCandidateLedger(chapters, merged) : null;
    const importantLevels = new Set(['核心', '重要', 'core', 'important']);
    const quotableEventChapters = new Set();
    for (const chapter of chapters) {
      for (const event of Array.isArray(chapter.events) ? chapter.events : []) {
        if (importantLevels.has(event.importance) && event.quote_status === 'quotable') {
          quotableEventChapters.add(chapter.chapter);
        }
      }
    }
    const manifest = typeof input.manifest === 'string' && fs.existsSync(input.manifest)
      ? readJson(input.manifest)
      : {};
    const itemRows = ledger ? ledger.rows.filter(row => row.category === 'items') : [];
    const noneFoundFile = typeof input.recalls === 'string'
      ? `${input.recalls}/items.json`
      : null;
    const noneFound = noneFoundFile && fs.existsSync(noneFoundFile)
      ? readJson(noneFoundFile).none_found
      : null;
    return {
      source_char_count: manifest.source_char_count,
      item_candidates: chapterCoverage.categories.items.candidate_count,
      merged_items: Array.isArray(merged?.items) ? merged.items.length : 0,
      item_resolutions_incomplete: Boolean(merged) && itemRows.some(row => row.resolution === 'ambiguous'),
      important_event_count: chapterCoverage.events.important_count,
      quotable_event_count: chapterCoverage.events.quotable_count,
      dialogue_covered: chapterCoverage.dialogues.quotable_event_count_with_candidates,
      quotable_event_chapters: [...quotableEventChapters].sort((a, b) => a - b),
      dialogue_chapters: [...chapterCoverage.dialogues.chapters],
      none_found,
      chapter_coverage: chapterCoverage,
      ...input
    };
  }
  return input;
}

function pushGap(gaps, gap) {
  if (!gaps.some(existing => existing.rule === gap.rule && existing.category === gap.category)) {
    gaps.push(gap);
  }
}

function checkCoverage(input) {
  const value = readCoverageInput(input);
  const blockingGaps = [];
  const warnings = [];
  const recallUnits = [];
  for (const gap of (Array.isArray(value.blocking_gaps) ? value.blocking_gaps : [])) {
    if (isHighPriorityCategory(gap?.category)) {
      blockingGaps.push(gap);
      recallUnits.push(`recall:${gap.category}`);
    } else {
      warnings.push(gap);
    }
  }
  const noneFound = validNoneFound(value.none_found) ? value.none_found : null;
  const emptyCategoryReview = value.none_found
    ? (noneFound
      ? { status: 'none_found', chapters: [...noneFound.chapters], reason: noneFound.reason }
      : { status: 'invalid', reason: 'none_found review is incomplete' })
    : { status: 'not_required' };

  const itemCandidates = asNumber(value.item_candidates ?? value.items?.candidate_count);
  const mergedItems = asNumber(value.merged_items ?? value.items?.merged_count);
  const sourceChars = asNumber(value.source_char_count);
  const importantEvents = asNumber(value.important_event_count ?? value.events?.important_count);
  const itemResolutionsIncomplete = Boolean(
    value.item_resolutions_incomplete ?? value.items?.resolutions_incomplete
  );
  if (itemCandidates > 0 && mergedItems === 0 && itemResolutionsIncomplete) {
    recallUnits.push('supplement:items');
    pushGap(blockingGaps, {
      category: 'items',
      rule: 'candidate_to_zero',
      candidate_count: itemCandidates,
      expected_evidence: '每个物品候选必须有 merged_to 或带理由的 rejected 去向',
      allowed_unit: 'supplement:items'
    });
  }

  if (itemCandidates === 0 && (sourceChars >= 150000 || importantEvents >= 20) && !noneFound) {
    recallUnits.push('recall:items');
    pushGap(blockingGaps, {
      category: 'items',
      rule: 'empty_item_category_without_review',
      source_char_count: sourceChars,
      important_event_count: importantEvents,
      expected_evidence: '复核触发章节并明确是否确实没有重要物品',
      allowed_unit: 'recall:items'
    });
  }

  const quotableCount = asNumber(value.quotable_event_count ?? value.events?.quotable_count);
  const dialogueCovered = asNumber(value.dialogue_covered ?? value.dialogues?.quotable_event_count_with_candidates);
  if (quotableCount > 0 && dialogueCovered / quotableCount < 0.7) {
    pushGap(warnings, {
      category: 'dialogues',
      rule: 'quotable_event_coverage_below_70_percent',
      quotable_event_count: quotableCount,
      dialogue_covered: dialogueCovered,
      expected_evidence: '可引用核心/重要事件的对白或 not_quotable 理由',
      severity: 'warning'
    });
  }

  const eventChapters = Array.isArray(value.quotable_event_chapters)
    ? value.quotable_event_chapters
    : (Array.isArray(value.events?.quotable_chapters) ? value.events.quotable_chapters : []);
  const dialogueChapters = Array.isArray(value.dialogue_chapters)
    ? value.dialogue_chapters
    : (Array.isArray(value.dialogues?.chapters) ? value.dialogues.chapters : []);
  if (eventChapters.length >= 8 && dialogueChapters.length / eventChapters.length < 0.3) {
    pushGap(warnings, {
      category: 'dialogues',
      rule: 'dialogue_chapter_coverage_below_30_percent',
      quotable_event_chapters: [...eventChapters],
      dialogue_chapters: [...dialogueChapters],
      expected_evidence: '覆盖分布异常章节中的可引用对白',
      severity: 'warning'
    });
  }

  return {
    blocking_gaps: blockingGaps,
    recall_units: [...new Set(recallUnits)],
    empty_category_review: emptyCategoryReview,
    warnings
  };
}

function resolutionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  if (input.resolution && typeof input.resolution === 'string' && fs.existsSync(input.resolution)) {
    return { ...readJson(input.resolution), ...input };
  }
  if (input.candidate_resolution && typeof input.candidate_resolution === 'string'
    && fs.existsSync(input.candidate_resolution)) {
    return { ...readJson(input.candidate_resolution), ...input };
  }
  if (typeof input.chapters === 'string' && fs.existsSync(input.chapters)
    && typeof input.merged === 'string' && fs.existsSync(input.merged)) {
    const chapters = fs.readdirSync(input.chapters)
      .filter(name => /^ch_\d+\.json$/.test(name))
      .sort()
      .map(name => readJson(`${input.chapters}/${name}`));
    return {
      ...input,
      chapters,
      merged: readJson(input.merged),
      cleaned: typeof input.cleaned === 'string' && fs.existsSync(input.cleaned)
        ? readJson(input.cleaned)
        : null
    };
  }
  return input;
}

function resolutionRows(value) {
  if (Array.isArray(value.candidate_rows)) {
    const decisions = Array.isArray(value.resolutions) ? value.resolutions : [];
    return { candidates: value.candidate_rows, decisions };
  }
  if (Array.isArray(value.rows)) return { candidates: value.rows, decisions: [] };
  return { candidates: [], decisions: [] };
}

function checkResolution(input) {
  const value = resolutionInput(input);
  let candidates;
  let decisions;
  let targets = value.category_targets && typeof value.category_targets === 'object'
    ? value.category_targets
    : {};

  if (Array.isArray(value.chapters) && value.merged) {
    const ledger = buildCandidateLedger(value.chapters, value.merged, value.cleaned);
    candidates = ledger.rows;
    decisions = [];
    targets = Object.fromEntries(Object.entries(value.merged)
      .filter(([, records]) => Array.isArray(records))
      .map(([category, records]) => [category, records.map(record => record?.local_key).filter(Boolean)]));
  } else {
    ({ candidates, decisions } = resolutionRows(value));
  }

  const byKey = new Map();
  for (const row of candidates) {
    if (row?.candidate_key) {
      const list = byKey.get(row.candidate_key) || [];
      list.push(row);
      byKey.set(row.candidate_key, list);
    }
  }
  const decisionMap = new Map();
  for (const decision of decisions) {
    if (!decision?.candidate_key) continue;
    const list = decisionMap.get(decision.candidate_key) || [];
    list.push(decision);
    decisionMap.set(decision.candidate_key, list);
  }

  const gaps = Array.isArray(value.blocking_gaps) ? [...value.blocking_gaps] : [];
  const units = new Set();
  const add = (row, reason, extra = {}) => {
    const category = row?.category || String(row?.candidate_key || '').split(':')[0] || 'unknown';
    const gap = { category, candidate_key: row?.candidate_key, reason, ...extra };
    if (!gaps.some(existing => existing.candidate_key === gap.candidate_key && existing.reason === reason)) gaps.push(gap);
    if (isHighPriorityCategory(category)) units.add(`supplement:${category}`);
  };

  for (const row of candidates) {
    if (row?.candidate_key && byKey.get(row.candidate_key)?.length > 1 && decisions.length === 0) {
      add(row, 'MULTIPLE_DECISIONS');
      continue;
    }
    const list = decisionMap.get(row.candidate_key) || [];
    const effective = list.length > 0 ? list : (row.resolution ? [row] : []);
    if (effective.length === 0) {
      add(row, 'MISSING_DECISION');
      continue;
    }
    if (effective.length > 1) {
      add(row, 'MULTIPLE_DECISIONS');
      continue;
    }
    const decision = effective[0];
    if (decision.resolution === 'ambiguous') {
      add(row, 'AMBIGUOUS_REFERENCE');
      continue;
    }
    if (decision.resolution === 'merged_to') {
      const category = row.category || String(row.candidate_key || '').split(':')[0];
      const known = new Set(Array.isArray(targets[category]) ? targets[category] : []);
      if (!known.has(decision.merged_to)) add(row, 'DANGLING_REFERENCE', { merged_to: decision.merged_to });
    }
  }

  return {
    blocking_gaps: gaps,
    supplement_units: [...units],
    passed: gaps.length === 0
  };
}

module.exports = { checkCoverage, checkResolution, validNoneFound };
