'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  validateCleanDecisionDraft,
  validateMaterialDecisionDraft,
  validateMergeDecisionDraft
} = require('./category-contract');
const {
  acceptedArtifactHash,
  assertAcceptedArtifacts,
  readArtifactManifest,
  recordAcceptedArtifact
} = require('./candidate-ledger');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const { normalizeDomainDecisionDraft, validateDomainDecisionDraft } = require('./domain-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, readJson, readYaml } = require('./io');
const {
  forceManualReview,
  loadProgress,
  recordSubmission,
  recordTargetedSubmission,
  saveProgress
} = require('./progress');
const { validateQualityReview } = require('./quality');
const { SEMANTIC_CONTRACT_VERSION, SEMANTIC_PROFILE, isPowerRank } = require('./semantic-contract');
const { sha256 } = require('./source');
const { hashFinalData, loadData } = require('./verify');
const { applyRecall, applySupplement } = require('./supplements');
const { readWorkItem, readWorkPlan } = require('./semantic-work');

const MERGE_DECISION_UNIT = /^merge:(characters|events|items|skills|techniques|factions|locations|dialogues):(\d{3}|consolidate)$/;
const CLEAN_DECISION_UNIT = /^clean:(characters|events|items|skills|techniques|factions|locations|dialogues):\d{3}$/;
const MATERIAL_DECISION_UNIT = /^clean:materials:001$/;
const DOMAIN_DECISION_UNIT = /^distill:(plot|martial|items|world)$/;

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

function validateTargetedDraft(draft, category) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return [{ code: 'TARGETED_DRAFT_INVALID', path: '$', target: category }];
  }
  if (!Array.isArray(draft[category])) {
    return [{ code: 'TARGETED_CATEGORY_REQUIRED', path: category, target: category }];
  }
  return draft[category].flatMap((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return [{ code: 'TARGETED_RECORD_INVALID', path: `${category}[${index}]`, target: category }];
    }
    if (category !== 'characters' && category !== 'skills') return [];
    const rankPath = `${category}[${index}].rank`;
    if (typeof record.rank !== 'string' || record.rank === '') {
      return [{ code: 'POWER_RANK_REQUIRED', path: rankPath, target: category }];
    }
    return isPowerRank(record.rank)
      ? []
      : [{ code: 'POWER_RANK_INVALID', path: rankPath, target: record.rank }];
  });
}

function semanticDecisionFile(paths, unit, inputHash) {
  const root = unit.startsWith('distill:')
    ? paths.domainDecisions
    : unit.startsWith('merge:') ? paths.mergeDecisions : paths.cleanDecisions;
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

function semanticAggregateInputHash(paths, stage) {
  if (stage === 'clean') {
    return stableHash({
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      semantic_profile: SEMANTIC_PROFILE,
      stage: 'clean_aggregate',
      merged: acceptedArtifactHash(paths, paths.merged)
    });
  }
  const plan = readWorkPlan(paths, 'domain');
  const inputs = [...plan.inputs];
  const decisions = Object.fromEntries(inputs
    .map(input => [
      input.unit,
      acceptedArtifactHash(paths, semanticDecisionFile(paths, input.unit, input.input_hash))
    ])
    .sort(([left], [right]) => left.localeCompare(right)));
  return stableHash({
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    stage: `${stage}_aggregate`,
    upstream_hashes: plan.upstream_hashes,
    units: inputs.map(input => ({ unit: input.unit, input_hash: input.input_hash })),
    decisions
  });
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
  if (unit === 'merge:book' || unit === 'clean:book') {
    throw new GameKbError(
      'WHOLE_BOOK_AI_UNIT_FORBIDDEN',
      'Whole-book merge and cleanup are deterministic aggregate units',
      { unit }
    );
  }
  if (DOMAIN_DECISION_UNIT.test(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      validate: draft => validateDomainDecisionDraft(draft, work.input),
      normalize: draft => normalizeDomainDecisionDraft(draft, work.input)
    };
  }
  if (MERGE_DECISION_UNIT.test(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      validate: draft => validateMergeDecisionDraft(draft, work.input)
    };
  }
  if (CLEAN_DECISION_UNIT.test(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      validate: draft => validateCleanDecisionDraft(draft, work.input)
    };
  }
  if (MATERIAL_DECISION_UNIT.test(unit)) {
    const work = readWorkItem(paths, unit);
    return {
      inputHash: work.input.input_hash,
      acceptedFile: semanticDecisionFile(paths, unit, work.input.input_hash),
      validate: draft => validateMaterialDecisionDraft(draft, work.input)
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
      ? path.join(paths.recalls, `${category}.yaml`)
      : path.join(paths.supplements, `${category}.yaml`);
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
  if (unit === 'merge:book') return semanticAggregateInputHash(paths, 'merge');
  if (unit === 'clean:book') return semanticAggregateInputHash(paths, 'clean');
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
    draft = readYaml(resolvedDraft);
    if (context.assess) {
      assessment = context.assess(draft);
      errors = assessment.errors;
    } else {
      errors = context.validate(draft);
    }
  } catch (error) {
    errors = [{ code: 'DRAFT_YAML_INVALID', path: '$', target: error.message }];
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
    `attempt_${String(state.attempts).padStart(2, '0')}_${outputHash.slice(7, 19)}.yaml`
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
    const pending = errors.some(error => error.code === 'DOMAIN_PENDING_UNRESOLVED');
    throw new GameKbError(
      pending ? 'DOMAIN_PENDING_UNRESOLVED' : 'DRAFT_REJECTED',
      pending ? 'Domain draft contains unresolved pending decisions' : 'Draft failed validation',
      result
    );
  }
  if (terminalErrors.length > 0) {
    throw new GameKbError('QUALITY_SAMPLE_FAILED', 'Fixed quality sample did not reach the 95% threshold', result);
  }
  return result;
}

module.exports = { acceptDraft, assertDraftPath, currentUnitInputHash, semanticDecisionFile, stableHash };
