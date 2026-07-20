'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { normalizeSource, sha256 } = require('./source');

const LEGACY_FILE_NAMES = Object.freeze({
  characters: 'characters.json',
  skills: 'skills.json',
  items: 'items.json',
  factions: 'factions.json',
  chapter_summaries: 'chapter_summaries.json'
});

function error(code, message, details = {}) {
  return new GameKbError(code, message, details);
}

function assertNovelDirectory(novelDir) {
  const novel = path.resolve(novelDir);
  if (!fs.existsSync(novel) || !fs.statSync(novel).isDirectory()) {
    throw error('NOVEL_DIR_MISSING', 'Novel directory does not exist', { novel });
  }
  return novel;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafePath(novel, candidate, code = 'LEGACY_SOURCE_OUTSIDE_NOVEL') {
  const lexical = path.resolve(candidate);
  if (!isWithin(novel, lexical)) {
    throw error(code, 'Legacy source path is outside the novel directory', {
      novel,
      path: lexical
    });
  }
  if (!fs.existsSync(lexical)) return lexical;
  const realNovel = fs.realpathSync(novel);
  const realCandidate = fs.realpathSync(lexical);
  if (!isWithin(realNovel, realCandidate)) {
    throw error(code, 'Legacy source path escapes the novel directory through a symlink', {
      novel: realNovel,
      path: lexical,
      target: realCandidate
    });
  }
  return lexical;
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readLegacyRoot(novel, candidate) {
  const root = assertSafePath(novel, candidate.dataRoot);
  if (!fs.existsSync(root)) {
    return { ok: false, code: 'LEGACY_SOURCE_NOT_FOUND', dataRoot: root };
  }
  if (!fs.statSync(root).isDirectory()) {
    return { ok: false, code: 'LEGACY_SOURCE_INVALID', dataRoot: root };
  }

  const missing = [];
  const files = {};
  const hashes = {};
  const values = {};
  for (const [category, filename] of Object.entries(LEGACY_FILE_NAMES)) {
    const file = assertSafePath(novel, path.join(root, filename));
    if (!fs.existsSync(file)) {
      missing.push(filename);
      continue;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) {
      return {
        ok: false,
        code: 'LEGACY_SOURCE_INVALID',
        dataRoot: root,
        path: file,
        reason: 'not-file'
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (cause) {
      return {
        ok: false,
        code: 'LEGACY_JSON_INVALID',
        dataRoot: root,
        path: file,
        reason: cause.message
      };
    }
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        code: 'LEGACY_JSON_INVALID',
        dataRoot: root,
        path: file,
        reason: 'category must be an array'
      };
    }
    files[category] = file;
    hashes[category] = sha256File(file);
    values[category] = parsed;
  }
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'LEGACY_SOURCE_INCOMPLETE',
      dataRoot: root,
      missing
    };
  }
  const stat = fs.statSync(root);
  return {
    ok: true,
    dataRoot: root,
    files,
    hashes,
    values,
    modifiedAt: stat.mtimeMs
  };
}

function directoryChildren(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => path.join(root, entry.name))
    .sort();
}

function retainedCandidates(novel) {
  return directoryChildren(path.join(novel, '.game-kb-work', 'runs'))
    .map(runRoot => ({
      kind: 'retained-run',
      runId: path.basename(runRoot),
      dataRoot: path.join(runRoot, 'final', 'data')
    }));
}

function archiveCandidates(novel) {
  const archiveRoot = path.join(novel, '_archive', 'generate-game-kb');
  const direct = directoryChildren(archiveRoot).map(runRoot => ({
    kind: 'archive-final',
    runId: path.basename(runRoot),
    dataRoot: path.join(runRoot, 'final', 'data')
  }));
  const abandoned = directoryChildren(path.join(archiveRoot, 'abandoned'))
    .map(runRoot => ({
      kind: 'archive-final',
      runId: path.basename(runRoot),
      dataRoot: path.join(runRoot, 'final', 'data')
    }));
  return [...direct, ...abandoned];
}

function candidateDescriptor(candidate) {
  return {
    kind: candidate.kind,
    ...(candidate.runId ? { runId: candidate.runId } : {}),
    dataRoot: path.resolve(candidate.dataRoot)
  };
}

function inspectChapterBinding(inspected, inventory) {
  if (!inventory) return { ok: true, status: 'unavailable' };
  const expected = inventory.chapters.map(chapter => chapter.number).sort((left, right) => left - right);
  const actual = inspected.values.chapter_summaries
    .map(summary => Number(summary?.chapter))
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
  const unique = [...new Set(actual)];
  if (actual.length !== unique.length || JSON.stringify(unique) !== JSON.stringify(expected)) {
    return {
      ok: false,
      code: 'LEGACY_SOURCE_CHAPTER_BINDING_MISMATCH',
      expected,
      actual
    };
  }
  return {
    ok: true,
    status: 'matched',
    chapterCount: expected.length,
    chapterRoot: inventory.root
  };
}

function resolveLegacySource(novelDir, options = {}) {
  const novel = assertNovelDirectory(novelDir);
  if (options.explicitDataRoot !== undefined) {
    const candidate = { kind: 'explicit', dataRoot: options.explicitDataRoot };
    const inspected = readLegacyRoot(novel, candidate);
    if (!inspected.ok) {
      throw error(inspected.code, 'Explicit legacy source is not usable', {
        ...candidateDescriptor(candidate),
        ...inspected
      });
    }
    return {
      schema_version: 1,
      novelDir: novel,
      ...candidateDescriptor(candidate),
      files: inspected.files,
      hashes: inspected.hashes,
      candidates: [{ ...candidateDescriptor(candidate), selected: true }],
      rejections: []
    };
  }

  const excludedDataRoots = new Set((options.excludeDataRoots || []).map(dataRoot => (
    path.resolve(dataRoot)
  )));
  const candidates = [
    { kind: 'active-data', dataRoot: path.join(novel, 'data') },
    ...retainedCandidates(novel),
    ...archiveCandidates(novel)
  ].filter(candidate => !excludedDataRoots.has(path.resolve(candidate.dataRoot)));
  const rejections = [];
  const inspectedCandidates = [];
  const successful = [];
  let inventory = null;
  try {
    inventory = loadExistingChapterInventory(novel);
  } catch (cause) {
    if (cause?.code !== 'LEGACY_CHAPTER_INVENTORY_NOT_FOUND') throw cause;
  }
  for (const candidate of candidates) {
    const inspected = readLegacyRoot(novel, candidate);
    const descriptor = candidateDescriptor(candidate);
    if (inspected.ok) {
      const binding = candidate.kind === 'active-data'
        ? { ok: true, status: 'active' }
        : inspectChapterBinding(inspected, inventory);
      if (!binding.ok) {
        const rejection = { ...descriptor, ...binding, selected: false };
        delete rejection.ok;
        rejections.push(rejection);
        inspectedCandidates.push(rejection);
        continue;
      }
      inspectedCandidates.push({
        ...descriptor,
        selected: false,
        modifiedAt: inspected.modifiedAt,
        binding
      });
      successful.push({ candidate, inspected, binding });
      continue;
    }
    const rejection = { ...descriptor, ...inspected, selected: false };
    delete rejection.ok;
    rejections.push(rejection);
    inspectedCandidates.push(rejection);
  }
  if (successful.length === 0) {
    const preferred = rejections.find(item => item.code === 'LEGACY_JSON_INVALID')
      || rejections.find(item => item.code === 'LEGACY_SOURCE_CHAPTER_BINDING_MISMATCH')
      || rejections.find(item => item.code === 'LEGACY_SOURCE_INCOMPLETE')
      || rejections[0];
    throw error(
      preferred?.code || 'LEGACY_SOURCE_NOT_FOUND',
      'No complete legacy JSON source was found',
      { novel, candidates: rejections }
    );
  }
  const priority = candidate => ({
    'active-data': 0,
    'retained-run': 1,
    'archive-final': 2
  }[candidate.kind] ?? 99);
  successful.sort((left, right) => (
    priority(left.candidate) - priority(right.candidate)
    || right.inspected.modifiedAt - left.inspected.modifiedAt
    || left.candidate.dataRoot.localeCompare(right.candidate.dataRoot)
  ));
  const selected = successful[0];
  const selectedDescriptor = candidateDescriptor(selected.candidate);
  const candidateReports = inspectedCandidates.map(item => ({
    ...item,
    selected: item.dataRoot === selectedDescriptor.dataRoot
  }));
  return {
    schema_version: 1,
    novelDir: novel,
    ...selectedDescriptor,
    files: selected.inspected.files,
    hashes: selected.inspected.hashes,
    binding: selected.binding,
    candidates: candidateReports,
    rejections
  };
}

function loadLegacyFileSet(plan) {
  if (!plan || typeof plan !== 'object' || typeof plan.dataRoot !== 'string') {
    throw error('LEGACY_SOURCE_PLAN_INVALID', 'Legacy source plan is invalid');
  }
  const novel = typeof plan.novelDir === 'string' ? path.resolve(plan.novelDir) : path.dirname(plan.dataRoot);
  const inspected = readLegacyRoot(novel, { dataRoot: plan.dataRoot });
  if (!inspected.ok) {
    throw error(inspected.code, 'Legacy source is no longer readable', { ...inspected });
  }
  return inspected.values;
}

function chapterRootCandidates(novel) {
  const roots = [path.join(novel, 'ch_split')];
  const runs = directoryChildren(path.join(novel, '.game-kb-work', 'runs'));
  for (const run of runs) roots.push(path.join(run, 'source', 'chapters'));
  const genericArchives = directoryChildren(path.join(novel, '_archive'));
  for (const archive of genericArchives) {
    const archivedRuns = directoryChildren(path.join(archive, '.game-kb-work', 'runs'));
    for (const run of archivedRuns) roots.push(path.join(run, 'source', 'chapters'));
  }
  const archives = directoryChildren(path.join(novel, '_archive', 'generate-game-kb'));
  for (const archive of archives) roots.push(path.join(archive, 'source', 'chapters'));
  for (const archive of directoryChildren(path.join(novel, '_archive', 'generate-game-kb', 'abandoned'))) {
    roots.push(path.join(archive, 'source', 'chapters'));
  }
  return roots;
}

function chapterNumberFromFilename(filename) {
  const match = /(?:^|[_-])(\d+)\.(?:txt|md)$/iu.exec(filename);
  return match ? Number(match[1]) : null;
}

function readChapterRoot(novel, root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  const chapters = [];
  const seen = new Set();
  for (const filename of fs.readdirSync(root).sort()) {
    const number = chapterNumberFromFilename(filename);
    if (number === null) continue;
    if (seen.has(number)) {
      throw error('LEGACY_CHAPTER_INVENTORY_INVALID', 'Chapter inventory contains duplicate numbers', {
        root,
        chapter: number
      });
    }
    const file = assertSafePath(novel, path.join(root, filename), 'LEGACY_SOURCE_OUTSIDE_NOVEL');
    const text = normalizeSource(fs.readFileSync(file, 'utf8'));
    const title = text.split(/\r?\n/u).find(line => line.trim() !== '')?.trim() || `第${number}章`;
    chapters.push({
      number,
      title,
      text,
      file,
      hash: sha256(text)
    });
    seen.add(number);
  }
  if (chapters.length === 0) return null;
  return {
    root,
    modifiedAt: fs.statSync(root).mtimeMs,
    chapters: chapters.sort((left, right) => left.number - right.number)
  };
}

function loadExistingChapterInventory(novelDir) {
  const novel = assertNovelDirectory(novelDir);
  const roots = chapterRootCandidates(novel);
  const inventories = roots.map(root => readChapterRoot(novel, root)).filter(Boolean);
  if (inventories.length === 0) {
    throw error('LEGACY_CHAPTER_INVENTORY_NOT_FOUND', 'No retained chapter inventory was found', { novel });
  }
  inventories.sort((left, right) => (
    right.chapters.length - left.chapters.length
    || right.modifiedAt - left.modifiedAt
    || left.root.localeCompare(right.root)
  ));
  return inventories[0];
}

module.exports = {
  LEGACY_FILE_NAMES,
  loadExistingChapterInventory,
  loadLegacyFileSet,
  resolveLegacySource
};
