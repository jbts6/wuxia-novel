'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const {
  assertAcceptedArtifacts,
  readArtifactManifest,
  recordAcceptedArtifact
} = require('./candidate-ledger');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const { normalizeDomainDecisionDraft, validateDomainDecisionDraft } = require('./domain-contract');
const { GameKbError } = require('./errors');
const { isGroundingError } = require('./grounding');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const {
  loadProgress,
  recordSubmission,
  saveProgress
} = require('./progress');
const { DOMAIN_UNITS } = require('./semantic-contract');
const { quarantineRecord } = require('./quarantine');
const { sha256 } = require('./source');
const { readWorkItem, writeWorkItem } = require('./semantic-work');

const DOMAIN_DECISION_UNITS = new Set(DOMAIN_UNITS);

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function stagingFileName(unit, attempt) {
  return `${unit.replaceAll(':', '_')}_attempt_${String(attempt).padStart(2, '0')}.yaml`;
}

function nextAttempt(progress, unit, inputHash) {
  const state = progress.units[unit];
  return !state || state.input_hash !== inputHash ? 1 : state.attempts + 1;
}

function assertDraftPath(paths, draftPath, unit, attempt, expectedPath = null) {
  const resolved = path.resolve(draftPath);
  const expected = path.resolve(expectedPath || path.join(paths.staging, stagingFileName(unit, attempt)));
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
  return path.join(paths.chapters, `ch_${String(number).padStart(3, '0')}.yaml`);
}

function semanticDecisionFile(paths, unit, inputHash) {
  if (!DOMAIN_DECISION_UNITS.has(unit)) {
    throw new GameKbError('UNIT_UNSUPPORTED', 'Only domain decisions have semantic decision files', { unit });
  }
  const root = paths.domainDecisions;
  const base = unit.replaceAll(':', '_');
  const canonical = path.join(root, `${base}.yaml`);
  if (!inputHash || !fs.existsSync(canonical)) return canonical;
  const canonicalRelative = path.relative(paths.run, canonical).split(path.sep).join('/');
  const canonicalEntry = readArtifactManifest(paths).entries
    .find(entry => entry.relative_path === canonicalRelative);
  if (canonicalEntry?.input_hash === inputHash) return canonical;
  const match = /^sha256:([a-f0-9]{64})$/.exec(inputHash);
  if (!match) {
    throw new GameKbError('WORK_ITEM_STALE', 'Semantic decision requires a valid input hash', {
      unit,
      input_hash: inputHash
    });
  }
  return path.join(root, base, `${match[1]}.yaml`);
}

function unitContext(paths, manifest, progress, unit) {
  const number = chapterNumber(unit);
  if (number !== null) {
    const chapter = manifest.chapters.find(entry => entry.number === number);
    if (!chapter) throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
    return {
      kind: 'chapter',
      inputHash: chapter.input_hash,
      acceptedFile: acceptedChapterFile(paths, number),
      stagingPath: attempt => chapter.staging_paths?.[attempt - 1],
      validate: draft => validateChapterDraft(draft, {
        number: chapter.number,
        title: chapter.title,
        inputHash: chapter.input_hash,
        chapterText: fs.readFileSync(chapter.file, 'utf8')
      }),
      normalize: draft => normalizeChapterDraft(draft)
    };
  }
  if (DOMAIN_DECISION_UNITS.has(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      kind: 'domain',
      work,
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      stagingPath: attempt => {
        if (work.input.attempt !== attempt) {
          throw new GameKbError('WORK_ITEM_STALE', 'Worker input does not own the next submission attempt', {
            unit,
            attempt,
            work_attempt: work.input.attempt
          });
        }
        return work.input.staging_path;
      },
      validate: draft => validateDomainDecisionDraft(draft, work.input),
      normalize: draft => normalizeDomainDecisionDraft(draft, work.input)
    };
  }
  throw new GameKbError('UNIT_UNSUPPORTED', 'Unsupported accept unit', { unit });
}

function groundingRecordLocation(error) {
  if (!isGroundingError(error)) return null;
  const match = /^(characters|items|skills|factions)\[(\d+)\](?:\.|$)/.exec(error.path);
  return match ? { category: match[1], index: Number(match[2]) } : null;
}

function prepareGroundedChapter(paths, context, unit, draft, errors) {
  if (context.kind !== 'chapter' || errors.length === 0) {
    return { draft, errors, quarantineFiles: [] };
  }
  const groups = new Map();
  for (const error of errors) {
    const location = groundingRecordLocation(error);
    if (!location) return { draft, errors, quarantineFiles: [] };
    const key = `${location.category}:${location.index}`;
    const current = groups.get(key) || { ...location, errors: [] };
    current.errors.push(error);
    groups.set(key, current);
  }

  const sanitized = structuredClone(draft);
  const removals = new Map();
  for (const group of groups.values()) {
    const indexes = removals.get(group.category) || new Set();
    indexes.add(group.index);
    removals.set(group.category, indexes);
  }
  for (const [category, indexes] of removals) {
    sanitized[category] = sanitized[category].filter((record, index) => !indexes.has(index));
  }
  const remainingErrors = context.validate(sanitized);
  if (remainingErrors.length > 0) return { draft, errors, quarantineFiles: [] };

  const quarantineFiles = [...groups.values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.index - right.index)
    .map(group => quarantineRecord(paths, {
      unit,
      category: group.category,
      record: draft[group.category][group.index],
      errors: group.errors,
      inputHash: context.inputHash
    }));
  return { draft: sanitized, errors: [], quarantineFiles };
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
  const existing = progress.units[unit];
  if (existing?.input_hash === context.inputHash && existing.status === 'done') {
    throw new GameKbError('UNIT_ALREADY_DONE', 'Completed unchanged unit cannot be resubmitted', { unit });
  }
  if (existing?.input_hash === context.inputHash && existing.status === 'manual_review') {
    throw new GameKbError('UNIT_MANUAL_REVIEW', 'Manual-review unit requires an explicit reset', { unit });
  }
  const attempt = nextAttempt(progress, unit, context.inputHash);
  const resolvedDraft = assertDraftPath(paths, draftPath, unit, attempt, context.stagingPath(attempt));
  const raw = fs.readFileSync(resolvedDraft, 'utf8');
  const outputHash = sha256(raw);
  let draft;
  let errors;
  let quarantineFiles = [];
  try {
    draft = yaml.load(raw);
  } catch (error) {
    errors = [{ code: 'DRAFT_YAML_INVALID', path: '$', target: error.message }];
  }
  if (errors === undefined) {
    errors = context.validate(draft);
    const prepared = prepareGroundedChapter(paths, context, unit, draft, errors);
    draft = prepared.draft;
    errors = prepared.errors;
    quarantineFiles = prepared.quarantineFiles;
  }

  let updated = recordSubmission(progress, unit, context.inputHash, outputHash, errors);
  const state = updated.units[unit];
  const archiveDir = path.join(paths.drafts, unit.replaceAll(':', '_'));
  const archive = path.join(
    archiveDir,
    `attempt_${String(state.attempts).padStart(2, '0')}_${outputHash.slice(7, 19)}.yaml`
  );
  if (fs.existsSync(archive)) {
    throw new GameKbError('DRAFT_ARCHIVE_EXISTS', 'Submission archive is immutable', { unit, archive });
  }
  atomicWriteFile(archive, raw);

  let acceptedFile = null;
  if (errors.length === 0) {
    acceptedFile = context.acceptedFile;
    const acceptedValue = context.normalize ? context.normalize(draft) : draft;
    recordAcceptedArtifact(paths, acceptedFile, context.inputHash, acceptedValue);
  }
  const submissionRecord = archive.replace(/\.yaml$/, '.json');
  if (fs.existsSync(submissionRecord)) {
    throw new GameKbError('DRAFT_ARCHIVE_EXISTS', 'Submission record is immutable', {
      unit,
      record: submissionRecord
    });
  }
  atomicWriteJson(submissionRecord, {
    schema_version: 1,
    unit,
    input_hash: context.inputHash,
    attempt: state.attempts,
    status: errors.length === 0 ? 'accepted' : 'rejected',
    staging_path: resolvedDraft,
    output_hash: outputHash,
    archive_path: archive,
    archive_hash: outputHash,
    accepted_file: acceptedFile,
    consumed: errors.length === 0,
    errors
  });
  if (errors.length > 0 && state.status === 'pending' && context.kind === 'domain') {
    writeWorkItem(paths, 'domain', context.work.input, context.work.bindings, {
      advanceAttempt: true,
      attempt: state.attempts + 1
    });
  }
  saveProgress(paths, updated);
  if (errors.length === 0) {
    try {
      fs.rmSync(resolvedDraft);
    } catch (error) {
      throw new GameKbError('DRAFT_STAGING_CONSUME_FAILED', 'Submitted staging draft could not be removed safely', {
        unit,
        draft: resolvedDraft,
        cause: error.message
      });
    }
  }

  const result = {
    unit,
    status: state.status,
    attempts: state.attempts,
    remaining_attempts: state.status === 'manual_review'
      ? 0
      : Math.max(0, 2 - state.attempts),
    errors,
    quarantine_files: quarantineFiles,
    draft_archive: archive,
    draft_archive_hash: outputHash,
    submission_record: submissionRecord,
    error_record: errors.length > 0 ? submissionRecord : null,
    consumed_path: errors.length === 0 ? resolvedDraft : null,
    accepted_file: acceptedFile
  };
  if (errors.length > 0) {
    const pending = errors.some(error => error.code === 'DOMAIN_PENDING_UNRESOLVED');
    throw new GameKbError(
      pending ? 'DOMAIN_PENDING_UNRESOLVED' : 'DRAFT_REJECTED',
      pending ? 'Domain draft contains unresolved pending decisions' : 'Draft failed validation',
      result
    );
  }
  return result;
}

module.exports = { acceptDraft, assertDraftPath, currentUnitInputHash, semanticDecisionFile, stableHash };
