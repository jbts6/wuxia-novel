'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  assertAcceptedArtifacts,
  readArtifactManifest,
  recordAcceptedArtifact
} = require('./candidate-ledger');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const { normalizeDomainDecisionDraft, validateDomainDecisionDraft } = require('./domain-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, readJson, readYaml } = require('./io');
const {
  loadProgress,
  recordSubmission,
  saveProgress
} = require('./progress');
const { DOMAIN_UNITS } = require('./semantic-contract');
const { sha256 } = require('./source');
const { readWorkItem } = require('./semantic-work');

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
  if (DOMAIN_DECISION_UNITS.has(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      validate: draft => validateDomainDecisionDraft(draft, work.input),
      normalize: draft => normalizeDomainDecisionDraft(draft, work.input)
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
  try {
    draft = readYaml(resolvedDraft);
    errors = context.validate(draft);
  } catch (error) {
    errors = [{ code: 'DRAFT_YAML_INVALID', path: '$', target: error.message }];
  }

  let updated = recordSubmission(progress, unit, context.inputHash, outputHash, errors);
  const state = updated.units[unit];
  const archiveDir = path.join(paths.drafts, unit.replaceAll(':', '_'));
  const archive = path.join(
    archiveDir,
    `attempt_${String(state.attempts).padStart(2, '0')}_${outputHash.slice(7, 19)}.yaml`
  );
  atomicWriteFile(archive, raw);

  let acceptedFile = null;
  if (errors.length === 0) {
    acceptedFile = context.acceptedFile;
    const acceptedValue = context.normalize ? context.normalize(draft) : draft;
    recordAcceptedArtifact(paths, acceptedFile, context.inputHash, acceptedValue);
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
      : Math.max(0, 2 - state.attempts),
    errors,
    draft_archive: archive,
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
