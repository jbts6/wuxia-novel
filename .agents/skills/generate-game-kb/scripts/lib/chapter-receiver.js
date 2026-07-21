'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { GameKbError } = require('./errors');
const { chapterAttemptPaths } = require('./paths');
const { transitionProgress } = require('./chapter-progress');
const { validateWorkerChapterDraft, normalizeAcceptedChapterDraft } = require('./chapter-contract');
const { sha256 } = require('./source');

const MECHANICAL_ERROR_CODES = new Set([
  'YAML_CODE_FENCE', 'YAML_INDENTATION', 'YAML_QUOTE', 'YAML_EMPTY_COLLECTION'
]);

function classifyYamlErrors(raw) {
  const errors = [];
  if (/^```/m.test(raw)) {
    errors.push({ code: 'YAML_CODE_FENCE', path: '$', target: 'code fence detected' });
    return errors;
  }
  try {
    const docs = [];
    yaml.loadAll(raw, doc => docs.push(doc));
    if (docs.length > 1) {
      errors.push({ code: 'YAML_MULTI_DOCUMENT', path: '$', target: `${docs.length} documents` });
    }
  } catch (err) {
    if (/indent/i.test(err.message)) {
      errors.push({ code: 'YAML_INDENTATION', path: '$', target: err.message });
    } else if (/quote|expected.*['"]/i.test(err.message)) {
      errors.push({ code: 'YAML_QUOTE', path: '$', target: err.message });
    } else {
      errors.push({ code: 'YAML_PARSE_ERROR', path: '$', target: err.message });
    }
  }
  return errors;
}

function isMechanicalOnly(errors) {
  return errors.length > 0 && errors.every(e => MECHANICAL_ERROR_CODES.has(e.code));
}

function stripCodeFence(raw) {
  return raw.replace(/^```(?:ya?ml)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
}

function receiveAvailableChapterOutputs({ paths, manifest, progress }) {
  const received = [];
  let current = progress;

  for (const unit of [...current.active_units]) {
    const state = current.units[unit];
    if (state.status !== 'active') continue;

    const jobPaths = chapterAttemptPaths(paths, unit, state.cycle, state.attempt);
    if (!fs.existsSync(jobPaths.output)) continue;

    const raw = fs.readFileSync(jobPaths.output, 'utf8');
    const outputHash = `sha256:${sha256(raw)}`;
    const chapter = manifest.chapters.find(
      ch => `chapter:${String(ch.number).padStart(3, '0')}` === unit
    );
    const expected = { number: chapter.number, title: chapter.title, inputHash: chapter.input_hash };

    const yamlErrors = classifyYamlErrors(raw);
    if (yamlErrors.length > 0 && !isMechanicalOnly(yamlErrors)) {
      archiveFailure(paths, unit, state, raw, yamlErrors);
      current = transitionProgress(current, {
        type: 'rejected', unit, reason: 'yaml_parse', repair_allowed: false, manifest
      });
      received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: false, errors: yamlErrors });
      continue;
    }

    let draft;
    if (yamlErrors.length > 0 && isMechanicalOnly(yamlErrors)) {
      const stripped = stripCodeFence(raw);
      try {
        draft = yaml.load(stripped);
      } catch {
        archiveFailure(paths, unit, state, raw, yamlErrors);
        current = transitionProgress(current, {
          type: 'rejected', unit, reason: 'yaml_mechanical', repair_allowed: true, manifest
        });
        received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: true, errors: yamlErrors });
        continue;
      }
      archiveFailure(paths, unit, state, raw, yamlErrors);
      current = transitionProgress(current, {
        type: 'rejected', unit, reason: 'yaml_mechanical', repair_allowed: true, manifest
      });
      received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: true, errors: yamlErrors });
      continue;
    }

    try {
      draft = yaml.load(raw);
    } catch (err) {
      const parseErrors = [{ code: 'YAML_PARSE_ERROR', path: '$', target: err.message }];
      archiveFailure(paths, unit, state, raw, parseErrors);
      current = transitionProgress(current, {
        type: 'rejected', unit, reason: 'yaml_parse', repair_allowed: false, manifest
      });
      received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: false, errors: parseErrors });
      continue;
    }

    const validationErrors = validateWorkerChapterDraft(draft, expected);
    if (validationErrors.length > 0) {
      const mechanical = isMechanicalOnly(validationErrors);
      archiveFailure(paths, unit, state, raw, validationErrors);
      current = transitionProgress(current, {
        type: 'rejected', unit, reason: 'validation', repair_allowed: mechanical, manifest
      });
      received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: mechanical, errors: validationErrors });
      continue;
    }

    const { chapter: accepted, errors: normErrors } = normalizeAcceptedChapterDraft(draft, expected);
    if (normErrors.length > 0) {
      archiveFailure(paths, unit, state, raw, normErrors);
      current = transitionProgress(current, {
        type: 'rejected', unit, reason: 'normalization', repair_allowed: false, manifest
      });
      received.push({ unit, status: 'rejected', output_hash: outputHash, repair_allowed: false, errors: normErrors });
      continue;
    }

    writeAcceptedChapter(paths, unit, accepted);
    moveRawToDrafts(paths, unit, state, raw);
    fs.unlinkSync(jobPaths.output);
    current = transitionProgress(current, {
      type: 'accepted', unit, output_hash: outputHash, manifest
    });
    received.push({ unit, status: 'accepted', output_hash: outputHash, repair_allowed: false, errors: [] });
  }

  return { progress: current, received };
}

function writeAcceptedChapter(paths, unit, chapter) {
  fs.mkdirSync(paths.chapters, { recursive: true });
  const safe = unit.replaceAll(':', '_');
  const file = path.join(paths.chapters, `${safe}.yaml`);
  fs.writeFileSync(file, yaml.dump(chapter, { noRefs: true, lineWidth: -1 }), 'utf8');
}

function moveRawToDrafts(paths, unit, state, raw) {
  const safe = unit.replaceAll(':', '_');
  const dir = path.join(paths.drafts, safe, `cycle_${String(state.cycle).padStart(2, '0')}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `attempt_${String(state.attempt).padStart(2, '0')}.yaml`);
  fs.writeFileSync(file, raw, 'utf8');
}

function archiveFailure(paths, unit, state, raw, errors) {
  const safe = unit.replaceAll(':', '_');
  const dir = path.join(paths.revisions, safe, `cycle_${String(state.cycle).padStart(2, '0')}`);
  fs.mkdirSync(dir, { recursive: true });
  const draftFile = path.join(dir, `attempt_${String(state.attempt).padStart(2, '0')}.yaml`);
  const errorFile = path.join(dir, `attempt_${String(state.attempt).padStart(2, '0')}.errors.json`);
  fs.writeFileSync(draftFile, raw, 'utf8');
  fs.writeFileSync(errorFile, `${JSON.stringify({ unit, cycle: state.cycle, attempt: state.attempt, errors }, null, 2)}\n`, 'utf8');
}

module.exports = { MECHANICAL_ERROR_CODES, receiveAvailableChapterOutputs };
