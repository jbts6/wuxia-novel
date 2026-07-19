'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { validateChapterDraft } = require('./chapter-contract');
const { GameKbError } = require('./errors');
const { serializeYaml } = require('./io');
const { sha256 } = require('./source');

function comparisonPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(parent, candidate) {
  const relative = path.relative(comparisonPath(parent), comparisonPath(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeSource(resolvedSource, paths) {
  // Check lstatSync - must be a regular file and not a symlink
  let stat;
  try {
    stat = fs.lstatSync(resolvedSource);
  } catch (error) {
    throw new GameKbError('DRAFT_MISSING', 'Draft file does not exist', { draft: resolvedSource });
  }

  if (!stat.isFile()) {
    throw new GameKbError('DRAFT_MISSING', 'Draft path is not a file', { draft: resolvedSource });
  }

  if (stat.isSymbolicLink()) {
    throw new GameKbError('DRAFT_SOURCE_SYMLINK', 'Draft source must not be a symbolic link', {
      draft: resolvedSource
    });
  }

  // Verify realpath matches lexical path (no junctions)
  const realSource = fs.realpathSync(resolvedSource);
  const normalizedLexical = comparisonPath(resolvedSource);
  const normalizedReal = comparisonPath(realSource);

  if (normalizedLexical !== normalizedReal) {
    throw new GameKbError('DRAFT_SOURCE_SYMLINK', 'Draft source resolves to a different path (junction detected)', {
      draft: resolvedSource,
      real_path: realSource
    });
  }

  // Source must be within the current run directory
  const runRoot = path.resolve(paths.run);
  if (!isWithin(runRoot, resolvedSource)) {
    throw new GameKbError('DRAFT_SOURCE_CROSS_RUN', 'Draft source must be within the current run', {
      draft: resolvedSource,
      run: runRoot
    });
  }

  // Source must not be under another run's .game-kb-work/runs/<run-id>/
  const runsDir = path.resolve(paths.runs);
  if (isWithin(runsDir, resolvedSource)) {
    const relativeToRuns = path.relative(runsDir, resolvedSource);
    const firstSegment = relativeToRuns.split(path.sep)[0];
    if (firstSegment && firstSegment !== paths.runId) {
      throw new GameKbError('DRAFT_SOURCE_CROSS_RUN', 'Draft source is in another run directory', {
        draft: resolvedSource,
        current_run: paths.runId,
        source_run: firstSegment
      });
    }
  }
}

function matchChapterDraft(draft, manifest) {
  // Parse draft once and validate against each pending chapter
  const matches = [];
  for (const chapter of manifest.chapters) {
    try {
      const errors = validateChapterDraft(draft, {
        number: chapter.number,
        title: chapter.title,
        inputHash: chapter.input_hash,
        chapterText: '' // We don't need the full text for matching
      });
      if (errors.length === 0) {
        matches.push(chapter);
      }
    } catch {
      // Validation error means no match
    }
  }
  return matches;
}

function preflightChapterDraft({ paths, manifest, unit, draftPath }) {
  const resolved = path.resolve(draftPath);

  // Security checks before reading content
  assertSafeSource(resolved, paths);

  const chapterMatch = /^chapter:(\d{3})$/.exec(unit);
  if (!chapterMatch) {
    throw new GameKbError('UNIT_UNSUPPORTED', 'Only chapter units are supported by preflight', { unit });
  }

  const chapterNumber = Number(chapterMatch[1]);
  const chapter = manifest.chapters.find(c => c.number === chapterNumber);
  if (!chapter) {
    throw new GameKbError('UNIT_UNKNOWN', 'Chapter unit is not present in the manifest', { unit });
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  let draft;
  let errors;

  try {
    draft = yaml.load(raw);
  } catch (error) {
    return {
      valid: false,
      errors: [{ code: 'DRAFT_YAML_INVALID', path: '$', target: error.message }],
      value: null,
      canonical_yaml: null
    };
  }

  errors = validateChapterDraft(draft, {
    number: chapter.number,
    title: chapter.title,
    inputHash: chapter.input_hash,
    chapterText: fs.readFileSync(chapter.file, 'utf8')
  });

  const canonicalYaml = errors.length === 0 ? serializeYaml(draft) : null;

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? draft : null,
    canonical_yaml: canonicalYaml
  };
}

module.exports = { preflightChapterDraft };
