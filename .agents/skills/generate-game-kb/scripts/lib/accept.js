'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateCleanedBook, validateMergedBook } = require('./book-contract');
const { validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { forceManualReview, loadProgress, recordSubmission, saveProgress } = require('./progress');
const { buildQuantityReport } = require('./quantity');
const { validateQualityReview } = require('./quality');
const { sha256 } = require('./source');
const { hashFinalData, loadData } = require('./verify');

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertDraftPath(paths, draftPath) {
  const resolved = path.resolve(draftPath);
  const forbidden = [
    paths.drafts,
    paths.chapters,
    path.dirname(paths.merged),
    path.dirname(paths.cleaned),
    paths.finalRoot
  ];
  if (forbidden.some(root => isWithin(root, resolved))) {
    throw new GameKbError('DRAFT_PATH_FORBIDDEN', 'Draft must not reuse an accepted or archived artifact path', {
      draft: resolved
    });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new GameKbError('DRAFT_MISSING', 'Draft file does not exist', { draft: resolved });
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
  const inputHash = stableHash({
    manifest: manifest.chapters.map(chapter => ({ number: chapter.number, input_hash: chapter.input_hash })),
    chapters
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
      })
    };
  }
  if (unit === 'merge:book') {
    const { inputHash } = mergeInput(paths, manifest, progress);
    return {
      inputHash,
      acceptedFile: paths.merged,
      validate: draft => validateMergedBook(draft, manifest),
      afterAccept: draft => atomicWriteJson(
        paths.preCleanQuantity,
        buildQuantityReport(draft, manifest.source_char_count, manifest.chapters.length)
      )
    };
  }
  if (unit === 'clean:book') {
    const merged = requireCurrentMerge(paths, manifest, progress);
    const quantity = preCleanQuantity(paths, manifest, merged);
    return {
      inputHash: stableHash({ merged, pre_clean_quantity: quantity }),
      acceptedFile: paths.cleaned,
      validate: draft => validateCleanedBook(draft, manifest)
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
  throw new GameKbError('UNIT_UNSUPPORTED', 'Unsupported accept unit', { unit });
}

function currentUnitInputHash(paths, manifest, progress, unit) {
  return unitContext(paths, manifest, progress, unit).inputHash;
}

function acceptDraft({ paths, unit, draftPath }) {
  const manifest = readJson(paths.manifest);
  const progress = loadProgress(paths, manifest);
  const context = unitContext(paths, manifest, progress, unit);
  const resolvedDraft = assertDraftPath(paths, draftPath);
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

  let updated = recordSubmission(progress, unit, context.inputHash, outputHash, errors);
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
  if (errors.length === 0) {
    acceptedFile = context.acceptedFile;
    atomicWriteJson(acceptedFile, context.normalize ? context.normalize(draft, assessment) : draft);
    if (context.afterAccept) context.afterAccept(draft);
  }
  saveProgress(paths, updated);

  const result = {
    unit,
    status: state.status,
    attempts: state.attempts,
    remaining_attempts: state.status === 'manual_review' ? 0 : Math.max(0, 3 - state.attempts),
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
