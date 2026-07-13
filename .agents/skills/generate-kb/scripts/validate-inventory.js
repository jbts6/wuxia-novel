#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSourceIndex,
  discoverChapterFiles,
  matchCompleteCitation,
  splitLines
} = require('./lib/source');
const { PipelineError, writeJsonAtomic } = require('./lib/atomic-json');
const { expectedIdFormat, isValidId } = require('./lib/id-contract');
const { readJsonl, validateLedgerClosure } = require('./lib/ledger');
const { getPipelinePaths } = require('./lib/pipeline-paths');
const { loadActiveRun } = require('./lib/pipeline-state');
const { resolveArtifactRoots } = require('./lib/report-context');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');
const { validateInventoryStage } = require('./lib/staged-inventory');

const FINAL_FILES = [
  'characters.json', 'factions.json', 'locations.json', 'skills.json',
  'techniques.json', 'items.json', 'dialogues.json', 'chapter_summaries.json'
];

const FINAL_FILE_CATEGORIES = {
  'characters.json': 'character',
  'factions.json': 'faction',
  'locations.json': 'location',
  'skills.json': 'skill',
  'techniques.json': 'technique',
  'items.json': 'item',
  'dialogues.json': 'dialogue'
};

function loadJson(filename, fallback = null) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function collectFinalIds(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  const ids = new Set();
  for (const filename of FINAL_FILES) {
    const records = loadJson(path.join(roots.dataRoot, filename), []);
    const category = FINAL_FILE_CATEGORIES[filename];
    if (!category || !Array.isArray(records)) continue;
    for (const record of records) {
      if (isValidId(record?.id, category)) ids.add(record.id);
    }
  }
  const events = loadJson(path.join(roots.buildRoot, 'events.json'), []);
  for (const event of Array.isArray(events) ? events : []) {
    if (isValidId(event?.id, 'event')) ids.add(event.id);
  }
  return ids;
}

function validateId(value, category, label, errors) {
  if (!isValidId(value, category)) {
    errors.push(
      `${label}: invalid ${category} ID ${JSON.stringify(value)}; ` +
      `expected ${expectedIdFormat(category)}`
    );
    return false;
  }
  return true;
}

function validateSourceRefs(record, label, errors) {
  if (!Array.isArray(record?.source_refs) || record.source_refs.length === 0) {
    errors.push(`${label}.source_refs must be a non-empty array`);
    return;
  }
  for (const [index, ref] of record.source_refs.entries()) {
    const refLabel = `${label}.source_refs[${index}]`;
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      errors.push(`${refLabel} must be an object`);
      continue;
    }
    if (!Number.isInteger(ref.chapter) || ref.chapter < 1 ||
        !Number.isInteger(ref.line_start) || ref.line_start < 1 ||
        !Number.isInteger(ref.line_end) || ref.line_end < ref.line_start ||
        !String(ref.text ?? '').trim()) {
      errors.push(`${refLabel} requires valid chapter, line_start, line_end, and text`);
    }
  }
}

function validateEventGraph(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  const errors = [];
  const eventsPath = path.join(roots.buildRoot, 'events.json');
  const exemptionsPath = path.join(roots.buildRoot, 'semantic-exemptions.json');
  const rawEvents = loadJson(eventsPath, null);
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  if (rawEvents === null) errors.push('missing build/events.json');
  else if (!Array.isArray(rawEvents)) errors.push('build/events.json must contain an array');

  const characters = loadJson(path.join(roots.dataRoot, 'characters.json'), []);
  const dialogues = loadJson(path.join(roots.dataRoot, 'dialogues.json'), []);
  const characterIds = new Set((Array.isArray(characters) ? characters : [])
    .map(record => record?.id)
    .filter(id => isValidId(id, 'character')));
  const dialogueIds = new Set((Array.isArray(dialogues) ? dialogues : [])
    .map(record => record?.id)
    .filter(id => isValidId(id, 'dialogue')));
  const dialogueById = new Map((Array.isArray(dialogues) ? dialogues : [])
    .filter(record => isValidId(record?.id, 'dialogue'))
    .map(record => [record.id, record]));
  const eventIds = new Set();

  for (const [index, event] of events.entries()) {
    const label = `events.json/${event?.id ?? `#${index}`}`;
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      errors.push(`${label}: event must be an object`);
      continue;
    }
    if (validateId(event.id, 'event', `${label}.id`, errors)) {
      if (eventIds.has(event.id)) errors.push(`${label}.id: duplicate ID`);
      eventIds.add(event.id);
    }
    if (!String(event.name ?? '').trim()) errors.push(`${label}.name must be non-empty`);
    if (!String(event.importance ?? '').trim()) errors.push(`${label}.importance must be non-empty`);
    validateSourceRefs(event, label, errors);

    if (!Array.isArray(event.participants) || event.participants.length === 0) {
      errors.push(`${label}.participants must be a non-empty array`);
    } else {
      for (const [participantIndex, participantId] of event.participants.entries()) {
        const participantLabel = `${label}.participants[${participantIndex}]`;
        if (validateId(participantId, 'character', participantLabel, errors) &&
            !characterIds.has(participantId)) {
          errors.push(`${participantLabel}: references unknown character ID ${JSON.stringify(participantId)}`);
        }
      }
    }

    if (event.dialogue_ids !== undefined && !Array.isArray(event.dialogue_ids)) {
      errors.push(`${label}.dialogue_ids must be an array when provided`);
    }
    const linkedDialogueIds = Array.isArray(event.dialogue_ids) ? event.dialogue_ids : [];
    for (const [dialogueIndex, dialogueId] of linkedDialogueIds.entries()) {
      const dialogueLabel = `${label}.dialogue_ids[${dialogueIndex}]`;
      if (validateId(dialogueId, 'dialogue', dialogueLabel, errors) &&
          !dialogueIds.has(dialogueId)) {
        errors.push(`${dialogueLabel}: references unknown dialogue ID ${JSON.stringify(dialogueId)}`);
      }
    }
  }

  for (const [index, dialogue] of (Array.isArray(dialogues) ? dialogues : []).entries()) {
    if (!['event', 'both'].includes(dialogue?.selection_type)) continue;
    const label = `dialogues.json/${dialogue?.id ?? `#${index}`}.event_id`;
    if (validateId(dialogue?.event_id, 'event', label, errors) &&
        !eventIds.has(dialogue.event_id)) {
      errors.push(`${label}: references unknown event ID ${JSON.stringify(dialogue.event_id)}`);
    }
  }

  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) continue;
    const label = `events.json/${event.id ?? `#${index}`}`;
    const linkedDialogueIds = Array.isArray(event.dialogue_ids) ? event.dialogue_ids : [];
    for (const [dialogueIndex, dialogueId] of linkedDialogueIds.entries()) {
      const dialogue = dialogueById.get(dialogueId);
      if (dialogue && dialogue.event_id && dialogue.event_id !== event.id) {
        errors.push(
          `${label}.dialogue_ids[${dialogueIndex}]: ${JSON.stringify(dialogueId)} ` +
          `points to ${JSON.stringify(dialogue.event_id)} instead of ${JSON.stringify(event.id)}`
        );
      }
    }
  }

  const rawExemptions = loadJson(exemptionsPath, {});
  if (!rawExemptions || typeof rawExemptions !== 'object' || Array.isArray(rawExemptions)) {
    errors.push('build/semantic-exemptions.json must contain an object');
  }
  const exemptions = rawExemptions && typeof rawExemptions === 'object' && !Array.isArray(rawExemptions)
    ? rawExemptions
    : {};
  const mainEventExemptions = new Set();
  for (const [group, category, knownIds] of [
    ['main_events', 'event', eventIds],
    ['personas', 'character', characterIds]
  ]) {
    const entries = exemptions[group] ?? [];
    if (!Array.isArray(entries)) {
      errors.push(`semantic-exemptions.json.${group} must be an array`);
      continue;
    }
    for (const [index, entry] of entries.entries()) {
      const label = `semantic-exemptions.json.${group}[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${label} must be an object`);
        continue;
      }
      if (validateId(entry.id, category, `${label}.id`, errors)) {
        if (!knownIds.has(entry.id)) {
          errors.push(`${label}.id: references unknown ${category} ID ${JSON.stringify(entry.id)}`);
        }
        if (group === 'main_events') mainEventExemptions.add(entry.id);
      }
      if (!String(entry.reason ?? '').trim()) errors.push(`${label}.reason must be non-empty`);
    }
  }

  for (const [index, event] of events.entries()) {
    if (event?.importance !== 'main' || !isValidId(event.id, 'event')) continue;
    const linkedDialogueIds = Array.isArray(event.dialogue_ids) ? event.dialogue_ids : [];
    const hasDialogue = linkedDialogueIds.some(id => dialogueIds.has(id)) ||
      (Array.isArray(dialogues) ? dialogues : []).some(dialogue => dialogue?.event_id === event.id);
    if (!hasDialogue && !mainEventExemptions.has(event.id)) {
      errors.push(
        `events.json/${event.id}: main event requires a linked dialogue or semantic exemption`
      );
    }
  }

  return {
    passed: errors.length === 0,
    event_count: events.length,
    exemption_count: [...mainEventExemptions].length + (Array.isArray(exemptions.personas)
      ? exemptions.personas.length
      : 0),
    errors
  };
}

function validateCandidateSourceRefs(candidates, sourceIndex, chapterLines) {
  const errors = [];
  const windowById = new Map((sourceIndex?.windows ?? []).map(window => [window.id, window]));
  for (const candidate of candidates) {
    const label = candidate.candidate_id ?? '<unknown>';
    const window = windowById.get(candidate.window_id);
    if (!window) {
      errors.push(`${label}: source window not found: ${candidate.window_id}`);
      continue;
    }
    if (window.chapter !== candidate.chapter) {
      errors.push(`${label}: candidate chapter does not match source window`);
    }
    const ref = candidate.source_ref;
    if (ref?.line_start < window.line_start || ref?.line_end > window.line_end) {
      errors.push(`${label}: source_ref is outside source window`);
    }
    const lines = chapterLines.get(candidate.chapter);
    const match = lines && ref?.text
      ? matchCompleteCitation(lines, ref.text, {
        lineStart: ref.line_start,
        lineEnd: ref.line_end
      })
      : { matched: false };
    if (!match.matched) errors.push(`${label}: complete source_ref text not found in declared lines`);
  }
  return errors;
}

function validateInventory(novelDir, options = {}) {
  const roots = resolveArtifactRoots(novelDir, options);
  const buildDir = roots.buildRoot;
  const sourceIndex = loadJson(path.join(buildDir, 'source-index.json'));
  const manifest = loadJson(path.join(buildDir, 'scan-manifest.json'));
  const errors = [];
  if (!sourceIndex) errors.push('missing build/source-index.json');
  if (!manifest) errors.push('missing build/scan-manifest.json');

  let source = {
    passed: false,
    source_hash_valid: false,
    source_file_valid: false,
    missing_windows_by_pass: {},
    chapter_summary_issues: [],
    errors: []
  };
  if (sourceIndex && manifest) {
    const current = buildSourceIndex(novelDir, {
      windowLines: sourceIndex.window_lines,
      overlapLines: sourceIndex.overlap_lines
    });
    const sourceErrors = [];
    const sourceFileValid = Boolean(sourceIndex.source_file && current.source_file);
    if (!sourceFileValid) {
      sourceErrors.push('original novel source file is missing');
    }
    const sourceHashValid = current.source_hash === sourceIndex.source_hash &&
      manifest.source_hash === sourceIndex.source_hash;
    if (!sourceHashValid) {
      sourceErrors.push('source hash does not match current original text');
    }
    if (current.chapter_corpus_hash !== sourceIndex.chapter_corpus_hash ||
        manifest.chapter_corpus_hash !== sourceIndex.chapter_corpus_hash) {
      sourceErrors.push('chapter corpus hash does not match current ch_split files');
    }
    if (current.source_alignment_valid !== true || sourceIndex.source_alignment_valid !== true) {
      sourceErrors.push('ch_split chapters are not aligned with the current original text');
    }
    const required = new Set(sourceIndex.windows.map(window => window.id));
    const missingWindowsByPass = {};
    for (const pass of ['named-inventory', 'event-dialogue', 'gap-audit']) {
      const completed = new Set(manifest.passes?.[pass]?.completed_window_ids ?? []);
      const missing = [...required].filter(id => !completed.has(id));
      missingWindowsByPass[pass] = missing;
      const unknown = [...completed].filter(id => !required.has(id));
      if (missing.length) sourceErrors.push(`${pass} missing ${missing.length} source windows`);
      if (unknown.length) sourceErrors.push(`${pass} contains ${unknown.length} unknown source windows`);
    }

    const summaries = loadJson(path.join(roots.dataRoot, 'chapter_summaries.json'), []);
    const summaryCounts = new Map();
    const chapterSummaryIssues = [];
    for (const [index, summary] of summaries.entries()) {
      const label = `chapter summary ${summary?.chapter ?? `#${index}`}`;
      const summaryChapter = summary?.chapter;
      summaryCounts.set(summaryChapter, (summaryCounts.get(summaryChapter) ?? 0) + 1);
      if (!Number.isInteger(summary?.chapter)) chapterSummaryIssues.push(`${label} has invalid chapter`);
      if (!String(summary?.title ?? '').trim()) chapterSummaryIssues.push(`${label} is missing title`);
      if (!String(summary?.summary ?? '').trim()) chapterSummaryIssues.push(`${label} is missing summary`);
      if (!Array.isArray(summary?.key_events) || summary.key_events.length === 0) {
        chapterSummaryIssues.push(`${label} must contain key_events`);
      }
      if (!Array.isArray(summary?.key_characters) || summary.key_characters.length === 0) {
        chapterSummaryIssues.push(`${label} must contain key_characters`);
      }
    }
    for (const chapter of sourceIndex.chapters) {
      if (summaryCounts.get(chapter.chapter) !== 1) {
        const issue = `chapter ${chapter.chapter} must have exactly one chapter summary`;
        chapterSummaryIssues.push(issue);
        sourceErrors.push(issue);
      }
    }
    const validChapters = new Set(sourceIndex.chapters.map(chapter => chapter.chapter));
    for (const chapter of summaryCounts.keys()) {
      if (!validChapters.has(chapter)) {
        const issue = `chapter summary references unknown chapter ${chapter}`;
        chapterSummaryIssues.push(issue);
        sourceErrors.push(issue);
      }
    }
    sourceErrors.push(...chapterSummaryIssues.filter(issue => !sourceErrors.includes(issue)));
    source = {
      passed: sourceErrors.length === 0,
      source_hash_valid: sourceHashValid,
      source_file_valid: sourceFileValid,
      missing_windows_by_pass: missingWindowsByPass,
      chapter_summary_issues: chapterSummaryIssues,
      errors: sourceErrors
    };
    errors.push(...sourceErrors);
  }

  const candidatePath = path.join(buildDir, 'candidates.jsonl');
  const decisionPath = path.join(buildDir, 'decisions.jsonl');
  const candidates = readJsonl(candidatePath, { optional: true });
  const decisions = readJsonl(decisionPath, { optional: true });
  const ledger = validateLedgerClosure(candidates, decisions, {
    finalIds: collectFinalIds(novelDir, options)
  });
  if (!fs.existsSync(candidatePath)) ledger.errors.unshift('missing build/candidates.jsonl');
  if (!fs.existsSync(decisionPath)) ledger.errors.unshift('missing build/decisions.jsonl');
  if (sourceIndex) {
    const chapterLines = new Map(discoverChapterFiles(novelDir).map(entry => [
      entry.chapter,
      splitLines(fs.readFileSync(entry.file, 'utf8'))
    ]));
    ledger.errors.push(...validateCandidateSourceRefs(candidates, sourceIndex, chapterLines));
  }
  ledger.passed = ledger.errors.length === 0;
  errors.push(...ledger.errors);

  const eventGraph = validateEventGraph(novelDir, options);
  errors.push(...eventGraph.errors);

  return {
    passed: errors.length === 0,
    source,
    ledger,
    event_graph: eventGraph,
    errors
  };
}

function parseCliArguments(argv) {
  const positional = [];
  const options = {
    dryRun: false,
    json: false,
    legacy: false,
    runId: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    if (value === '--dry-run') options.dryRun = true;
    else if (value === '--json') options.json = true;
    else if (value === '--legacy') options.legacy = true;
    else if (value === '--run-id') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
        throw new PipelineError('INVALID_ARGUMENT', '--run-id requires a value');
      }
      options.runId = argv[index + 1];
      index += 1;
    } else {
      throw new PipelineError('INVALID_ARGUMENT', `Unknown option: ${value}`);
    }
  }
  if (positional.length !== 1) {
    throw new PipelineError(
      'INVALID_ARGUMENT',
      'Usage: node validate-inventory.js <novel-dir> [--run-id ID] [--legacy] [--dry-run] [--json]'
    );
  }
  if (options.legacy && options.runId) {
    throw new PipelineError('INVALID_ARGUMENT', '--legacy cannot be combined with --run-id');
  }
  return { novelDir: path.resolve(positional[0]), ...options };
}

function resolveValidationMode(novelDir, options = {}) {
  if (options.legacy) return { mode: 'legacy', runId: null };
  if (options.runId) return { mode: 'staged', runId: options.runId };
  try {
    return { mode: 'staged', runId: loadActiveRun(novelDir).run_id };
  } catch (error) {
    if (error instanceof PipelineError && error.code === 'RUN_NOT_FOUND') {
      return { mode: 'legacy', runId: null };
    }
    throw error;
  }
}

function validateSelectedInventory(novelDir, options = {}) {
  const selected = resolveValidationMode(novelDir, options);
  if (selected.mode === 'legacy') {
    return {
      mode: 'legacy',
      run_id: null,
      validation: validateInventory(novelDir)
    };
  }
  return {
    mode: 'staged',
    run_id: selected.runId,
    validation: validateInventoryStage(novelDir, selected.runId)
  };
}

function validationReportPath(novelDir, result) {
  if (result.mode === 'legacy') {
    return path.join(novelDir, 'reports', 'inventory_validation.json');
  }
  const paths = getPipelinePaths(novelDir, result.run_id);
  return path.join(paths.materialized, 'inventory', 'validation.json');
}

function main(argv = process.argv.slice(2)) {
  let options = null;
  try {
    options = parseCliArguments(argv);
    const result = validateSelectedInventory(options.novelDir, options);
    if (!options.dryRun) {
      assertLegacyWriteAllowed(options.novelDir, { operation: 'validate-inventory report' });
      const report = result.mode === 'legacy' ? result.validation : result;
      writeJsonAtomic(validationReportPath(options.novelDir, result), report);
    }
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const label = result.mode === 'staged' ? `staged run ${result.run_id}` : 'legacy artifacts';
      process.stdout.write(result.validation.passed
        ? `Inventory validation passed (${label}).\n`
        : `Inventory validation failed (${label}; ${result.validation.errors.length} errors).\n`);
    }
    return result.validation.passed ? 0 : 1;
  } catch (error) {
    if (options?.json || argv.includes('--json')) {
      process.stderr.write(`${JSON.stringify({
        error: {
          code: error instanceof PipelineError ? error.code : 'INTERNAL_ERROR',
          message: error.message,
          details: error.details || null
        }
      }, null, 2)}\n`);
    } else {
      process.stderr.write(`${error.message}\n`);
    }
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  FINAL_FILES,
  collectFinalIds,
  main,
  parseCliArguments,
  resolveValidationMode,
  validateCandidateSourceRefs,
  validateEventGraph,
  validateInventory,
  validateSelectedInventory,
  validationReportPath
};
