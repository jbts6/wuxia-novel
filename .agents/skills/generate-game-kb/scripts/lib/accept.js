'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson } = require('./io');
const { loadProgress, recordSubmission, saveProgress } = require('./progress');
const { sha256 } = require('./source');

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
  if (!match) throw new GameKbError('UNIT_UNSUPPORTED', 'Only chapter units are available at this stage', { unit });
  return Number(match[1]);
}

function acceptDraft({ paths, unit, draftPath }) {
  const manifest = readJson(paths.manifest);
  const progress = loadProgress(paths, manifest);
  const number = chapterNumber(unit);
  const chapter = manifest.chapters.find(entry => entry.number === number);
  if (!chapter) throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
  const resolvedDraft = assertDraftPath(paths, draftPath);
  const raw = fs.readFileSync(resolvedDraft, 'utf8');
  const outputHash = sha256(raw);
  let draft;
  let errors;
  try {
    draft = JSON.parse(raw.replace(/^\uFEFF/, ''));
    errors = validateChapterDraft(draft, {
      number: chapter.number,
      title: chapter.title,
      inputHash: chapter.input_hash
    });
  } catch (error) {
    errors = [{ code: 'DRAFT_JSON_INVALID', path: '$', target: error.message }];
  }

  const updated = recordSubmission(progress, unit, chapter.input_hash, outputHash, errors);
  const state = updated.units[unit];
  const archiveDir = path.join(paths.drafts, unit.replace(':', '_'));
  const archive = path.join(
    archiveDir,
    `attempt_${String(state.attempts).padStart(2, '0')}_${outputHash.slice(7, 19)}.json`
  );
  atomicWriteFile(archive, raw);

  let acceptedFile = null;
  if (errors.length === 0) {
    acceptedFile = path.join(paths.chapters, `ch_${String(number).padStart(3, '0')}.json`);
    atomicWriteJson(acceptedFile, draft);
  }
  saveProgress(paths, updated);

  const result = {
    unit,
    status: state.status,
    attempts: state.attempts,
    remaining_attempts: Math.max(0, 3 - state.attempts),
    errors,
    draft_archive: archive,
    accepted_file: acceptedFile
  };
  if (errors.length > 0) {
    throw new GameKbError('DRAFT_REJECTED', 'Draft failed validation', result);
  }
  return result;
}

module.exports = { acceptDraft, assertDraftPath };
