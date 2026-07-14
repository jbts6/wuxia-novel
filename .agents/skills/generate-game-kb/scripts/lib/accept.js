'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateCleanedBook, validateMergedBook } = require('./book-contract');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  recordAcceptedArtifact
} = require('./candidate-ledger');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const {
  forceManualReview,
  loadProgress,
  recordSubmission,
  recordTargetedSubmission,
  saveProgress
} = require('./progress');
const { buildQuantityReport } = require('./quantity');
const { validateQualityReview } = require('./quality');
const { sha256 } = require('./source');
const { hashFinalData, loadData } = require('./verify');
const { applyRecall, applySupplement } = require('./supplements');

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function stagingFileName(unit, attempt) {
  return `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}.json`;
}

function nextAttempt(progress, unit, inputHash) {
  const state = progress.units[unit];
  return !state || state.input_hash !== inputHash ? 1 : state.attempts + 1;
}

function assertDraftPath(paths, draftPath, unit, attempt) {
  const resolved = path.resolve(draftPath);
  const expected = path.resolve(paths.staging, stagingFileName(unit, attempt));
  if (resolved !== expected) {
    throw new GameKbError('DRAFT_STAGING_MISMATCH', 'Draft must use the next unsubmitted run-scoped staging path', {
      unit,
      attempt,
      draft: resolved,
      expected
    });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new GameKbError('DRAFT_MISSING', 'Draft file does not exist', { draft: resolved });
  }
  const realStaging = fs.realpathSync(paths.staging);
  const realDraft = fs.realpathSync(resolved);
  if (!isWithin(realStaging, realDraft)) {
    throw new GameKbError('DRAFT_STAGING_ESCAPE', 'Draft staging path must not escape the selected run', {
      unit,
      draft: resolved
    });
  }
  return resolved;
}

function chapterNumber(unit) {
  const match = /^chapter:(\d{3})$/.exec(unit);
  return match ? Number(match[1]) : null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

function stableHash(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function acceptedChapterFile(paths, number) {
  return path.join(paths.chapters, `ch_${String(number).padStart(3, '0')}.json`);
}

function requireAcceptedChapters(paths, manifest, progress) {
  const missing = [];
  const chapters = [];
  for (const chapter of manifest.chapters) {
    const unit = `chapter:${String(chapter.number).padStart(3, '0')}`;
    const file = acceptedChapterFile(paths, chapter.number);
    if (progress.units[unit]?.status !== 'done' || !fs.existsSync(file)) {
      missing.push(unit);
    } else {
      chapters.push(readJson(file));
    }
  }
  if (missing.length > 0) {
    throw new GameKbError('MERGE_CHAPTERS_INCOMPLETE', 'Every chapter must be accepted before merge', { missing });
  }
  return chapters;
}

function mergeInput(paths, manifest, progress) {
  const chapters = requireAcceptedChapters(paths, manifest, progress);
  const acceptedHashes = manifest.chapters.map(chapter => ({
    number: chapter.number,
    content_hash: acceptedArtifactHash(paths, acceptedChapterFile(paths, chapter.number))
  }));
  const inputHash = stableHash({
    manifest: manifest.chapters.map(chapter => ({ number: chapter.number, input_hash: chapter.input_hash })),
    accepted_hashes: acceptedHashes
  });
  return { chapters, inputHash };
}

function requireCurrentMerge(paths, manifest, progress) {
  const current = mergeInput(paths, manifest, progress);
  const unit = progress.units['merge:book'];
  if (unit?.status !== 'done' || unit.input_hash !== current.inputHash || !fs.existsSync(paths.merged)) {
    throw new GameKbError('CLEAN_MERGE_REQUIRED', 'A current accepted merge is required before cleanup');
  }
  return readJson(paths.merged);
}

function preCleanQuantity(paths, manifest, merged) {
  if (fs.existsSync(paths.preCleanQuantity)) return readJson(paths.preCleanQuantity);
  const report = buildQuantityReport(merged, manifest.source_char_count, manifest.chapters.length);
  atomicWriteJson(paths.preCleanQuantity, report);
  return report;
}

function validateTargetedDraft(draft, category) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [{ code: 'TARGETED_DRAFT_INVALID', path: '$', target: category }];
  }
  if (!Array.isArray(draft[category])) {
    return [{ code: 'TARGETED_CATEGORY_REQUIRED', path: category, target: category }];
  }
  return draft[category].flatMap((record, index) => (
    record && typeof record === 'object' && !Array.isArray(record)
      ? []
      : [{ code: 'TARGETED_RECORD_INVALID', path: `${category}[${index}]`, target: category }]
  ));
}

function unitContext(paths, manifest, progress, unit) {
  const number = chapterNumber(unit);
  if (number !== null) {
    const chapter = manifest.chapters.find(entry => entry.number === number);
    if (!chapter) throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
    return {
      inputHash: chapter.input_hash,
      acceptedFile: acceptedChapterFile(paths, number),
      validate: draft => validateChapterDraft(draft, {
        number: chapter.number,
        title: chapter.title,
        inputHash: chapter.input_hash
      }),
      normalize: draft => normalizeChapterDraft(draft)
    };
  }
  if (unit === 'merge:book') {
    const { chapters, inputHash } = mergeInput(paths, manifest, progress);
    return {
      inputHash,
      acceptedFile: paths.merged,
      validate: draft => validateMergedBook(draft, manifest, chapters),
      afterAccept: draft => atomicWriteJson(
        paths.preCleanQuantity,
        buildQuantityReport(draft, manifest.source_char_count, manifest.chapters.length)
      )
    };
  }
  if (unit === 'clean:book') {
    const merged = requireCurrentMerge(paths, manifest, progress);
    const chapters = requireAcceptedChapters(paths, manifest, progress);
    const quantity = preCleanQuantity(paths, manifest, merged);
    return {
      inputHash: stableHash({
        merged_content_hash: acceptedArtifactHash(paths, paths.merged),
        pre_clean_quantity: quantity
      }),
      acceptedFile: paths.cleaned,
      validate: draft => validateCleanedBook(draft, manifest, chapters)
    };
  }
  if (unit === 'quality:sample') {
    if (!fs.existsSync(paths.qualitySample)) {
      throw new GameKbError('QUALITY_SAMPLE_REQUIRED', 'Run verify to persist the fixed quality sample first');
    }
    const loaded = loadData(paths.finalData);
    if (loaded.errors.length > 0) {
      throw new GameKbError('FINAL_DATA_INVALID', 'Final data must be complete before quality review', {
        errors: loaded.errors
      });
    }
    const sample = readJson(paths.qualitySample);
    const finalDataHash = hashFinalData(loaded.data);
    if (sample.final_data_hash !== finalDataHash || !Array.isArray(sample.items)) {
      throw new GameKbError('QUALITY_SAMPLE_STALE', 'Quality sample does not match current final data');
    }
    return {
      inputHash: stableHash({ final_data: loaded.data, sample }),
      acceptedFile: paths.qualityReport,
      assess: draft => validateQualityReview(draft, sample.items),
      normalize: (draft, assessment) => ({ ...assessment.report, final_data_hash: finalDataHash })
    };
  }
  const targeted = /^(recall|supplement):([a-z][a-z_]*)$/.exec(unit);
  if (targeted) {
    const [, kind, category] = targeted;
    const acceptedFile = kind === 'recall'
      ? path.join(paths.recalls, `${category}.json`)
      : path.join(paths.supplements, `${category}.json`);
    if (kind === 'supplement' && !fs.existsSync(paths.merged)) {
      throw new GameKbError('CLEAN_MERGE_REQUIRED', 'An accepted merge is required before a supplement');
    }
    return {
      inputHash: stableHash({
        kind,
        category,
        manifest: manifest.source_hash,
        coverage: fs.existsSync(paths.coverage) ? readJson(paths.coverage) : null,
        merged: kind === 'supplement' && fs.existsSync(paths.merged)
          ? acceptedArtifactHash(paths, paths.merged)
          : null
      }),
      acceptedFile,
      targeted: true,
      validate: draft => validateTargetedDraft(draft, category),
      afterAccept: draft => kind === 'recall'
        ? applyRecall(paths, category, draft)
        : applySupplement(paths, category, draft)
    };
  }
  throw new GameKbError('UNIT_UNSUPPORTED', 'Unsupported accept unit', { unit });
}

function currentUnitInputHash(paths, manifest, progress, unit) {
  assertAcceptedArtifacts(paths);
  return unitContext(paths, manifest, progress, unit).inputHash;
}

function acceptDraft({ paths, unit, draftPath }) {
  assertAcceptedArtifacts(paths);
  const manifest = readJson(paths.manifest);
  const progress = loadProgress(paths, manifest);
  const context = unitContext(paths, manifest, progress, unit);
  const attempt = nextAttempt(progress, unit, context.inputHash);
  const resolvedDraft = assertDraftPath(paths, draftPath, unit, attempt);
  const raw = fs.readFileSync(resolvedDraft, 'utf8');
  const outputHash = sha256(raw);
  let draft;
  let errors;
  let assessment = null;
  try {
    draft = JSON.parse(raw.replace(/^\uFEFF/, ''));
    if (context.assess) {
      assessment = context.assess(draft);
      errors = assessment.errors;
    } else {
      errors = context.validate(draft);
    }
  } catch (error) {
    errors = [{ code: 'DRAFT_JSON_INVALID', path: '$', target: error.message }];
  }

  let updated = context.targeted
    ? recordTargetedSubmission(progress, unit, context.inputHash, outputHash, draft, errors)
    : recordSubmission(progress, unit, context.inputHash, outputHash, errors);
  const terminalErrors = assessment && errors.length === 0 && !assessment.passed
    ? [{
        code: 'QUALITY_SAMPLE_FAILED',
        path: 'results',
        target: `${assessment.pass_count}/${assessment.sample_size}; threshold=${assessment.threshold}`
      }]
    : [];
  if (terminalErrors.length > 0) {
    updated = forceManualReview(updated, unit, terminalErrors, 'QUALITY_SAMPLE_FAILED');
  }
  const state = updated.units[unit];
  const archiveDir = path.join(paths.drafts, unit.replaceAll(':', '_'));
  const archive = path.join(
    archiveDir,
    `attempt_${String(state.attempts).padStart(2, '0')}_${outputHash.slice(7, 19)}.json`
  );
  atomicWriteFile(archive, raw);

  let acceptedFile = null;
  if (errors.length === 0 && terminalErrors.length === 0) {
    acceptedFile = context.acceptedFile;
    const acceptedValue = context.normalize ? context.normalize(draft, assessment) : draft;
    recordAcceptedArtifact(paths, acceptedFile, context.inputHash, acceptedValue);
    if (context.afterAccept) context.afterAccept(draft);
  }
  saveProgress(paths, updated);
  try {
    fs.rmSync(resolvedDraft);
  } catch (error) {
    throw new GameKbError('DRAFT_STAGING_CONSUME_FAILED', 'Submitted staging draft could not be removed safely', {
      unit,
      draft: resolvedDraft,
      cause: error.message
    });
  }

  const result = {
    unit,
    status: state.status,
    attempts: state.attempts,
    remaining_attempts: state.status === 'manual_review'
      ? 0
      : Math.max(0, (context.targeted ? 2 : 3) - state.attempts),
    errors: terminalErrors.length > 0 ? terminalErrors : errors,
    draft_archive: archive,
    accepted_file: acceptedFile,
    quantity_report: unit === 'merge:book' && errors.length === 0 ? paths.preCleanQuantity : null,
    quantity_review_consumed: unit === 'clean:book' && errors.length === 0
  };
  if (errors.length > 0) {
    throw new GameKbError('DRAFT_REJECTED', 'Draft failed validation', result);
  }
  if (terminalErrors.length > 0) {
    throw new GameKbError('QUALITY_SAMPLE_FAILED', 'Fixed quality sample did not reach the 95% threshold', result);
  }
  return result;
}

module.exports = { acceptDraft, assertDraftPath, currentUnitInputHash, stableHash };
