'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const {
  assertAcceptedArtifacts,
  readArtifactManifest
} = require('./candidate-ledger');
const { atomicWriteFile, atomicWriteJson, readJson, readYaml } = require('./io');
const { pathsFor } = require('./paths');
const { saveProgress, setDeterministicUnit } = require('./progress');
const {
  PROFILE_V4,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE
} = require('./semantic-contract');
const { sha256 } = require('./source');

const LEGACY_CONTRACT_VERSION = 5;
const CATEGORIES = Object.freeze(['characters', 'skills', 'items', 'factions']);
const LEGACY_FIELDS = Object.freeze({
  characters: new Set([
    'local_key', 'name', 'aliases', 'identity', 'identities', 'level', 'rank',
    'faction', 'factions', 'biography', 'description', 'skills', 'items',
    'source_refs', 'candidate_key'
  ]),
  skills: new Set([
    'local_key', 'name', 'aliases', 'type', 'types', 'rank', 'faction',
    'factions', 'description', 'techniques', 'holder', 'holders', 'holder_names',
    'user', 'users', 'user_names', 'source_refs', 'candidate_key'
  ]),
  items: new Set([
    'local_key', 'name', 'aliases', 'type', 'description', 'inclusion_reason',
    'holder', 'holders', 'holder_names', 'owner', 'owners', 'owner_name',
    'ownerships', 'source_refs', 'candidate_key'
  ]),
  factions: new Set([
    'local_key', 'name', 'aliases', 'type', 'description', 'member', 'members',
    'member_names', 'source_refs', 'candidate_key'
  ])
});

function importError(code, message, details = {}) {
  throw new GameKbError(code, message, details);
}

function assertFileHash(file, expectedHash, code, details = {}) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    importError(code, 'Chapter import source file is missing', { ...details, file });
  }
  const actualHash = sha256(fs.readFileSync(file));
  if (actualHash !== expectedHash) {
    importError(code, 'Chapter import source hash changed', {
      ...details,
      file,
      expected_hash: expectedHash,
      actual_hash: actualHash
    });
  }
}

function assertRunMetadata(metadata, runId, version, role) {
  if (!metadata || metadata.run_id !== runId
    || metadata.semantic_contract_version !== version
    || metadata.semantic_profile !== SEMANTIC_PROFILE
    || (metadata.profile ?? PROFILE_V4) !== PROFILE_V4) {
    importError('CHAPTER_IMPORT_RUN_INVALID', `Chapter import ${role} run is incompatible`, {
      role,
      run_id: metadata?.run_id ?? null,
      semantic_contract_version: metadata?.semantic_contract_version ?? null,
      semantic_profile: metadata?.semantic_profile ?? null,
      profile: metadata?.profile ?? null
    });
  }
}

function assertManifest(manifest, metadata, role) {
  if (!manifest || manifest.run_id !== metadata.run_id
    || manifest.source_hash !== metadata.source_hash
    || manifest.source_file !== metadata.source_file
    || !Array.isArray(manifest.chapters)
    || manifest.chapters.length === 0) {
    importError('CHAPTER_IMPORT_MANIFEST_INVALID', `Chapter import ${role} manifest is invalid`, {
      role,
      run_id: metadata.run_id
    });
  }
  assertFileHash(manifest.source_file, manifest.source_hash, 'CHAPTER_IMPORT_SOURCE_CHANGED', { role });
  if (typeof manifest.source_snapshot !== 'string') {
    importError('CHAPTER_IMPORT_MANIFEST_INVALID', 'Chapter import manifest has no source snapshot', { role });
  }
  assertFileHash(manifest.source_snapshot, manifest.source_hash, 'CHAPTER_IMPORT_SOURCE_CHANGED', { role });
}

function assertMatchingManifests(source, target) {
  if (source.source_hash !== target.source_hash || source.chapters.length !== target.chapters.length) {
    importError('CHAPTER_IMPORT_SOURCE_MISMATCH', 'Source and target runs describe different novels');
  }
  const sourceNumbers = new Set();
  const targetByNumber = new Map(target.chapters.map(chapter => [chapter.number, chapter]));
  for (const chapter of source.chapters) {
    if (!Number.isInteger(chapter.number) || sourceNumbers.has(chapter.number)) {
      importError('CHAPTER_IMPORT_MANIFEST_INVALID', 'Source chapter numbers must be unique integers', {
        chapter: chapter.number
      });
    }
    sourceNumbers.add(chapter.number);
    const targetChapter = targetByNumber.get(chapter.number);
    if (!targetChapter || chapter.input_hash !== targetChapter.input_hash
      || chapter.title !== targetChapter.title) {
      importError('CHAPTER_IMPORT_SOURCE_MISMATCH', 'Source and target chapter descriptors differ', {
        chapter: chapter.number
      });
    }
    assertFileHash(chapter.file, chapter.input_hash, 'CHAPTER_IMPORT_CHAPTER_CHANGED', {
      role: 'source', chapter: chapter.number
    });
    assertFileHash(targetChapter.file, targetChapter.input_hash, 'CHAPTER_IMPORT_CHAPTER_CHANGED', {
      role: 'target', chapter: chapter.number
    });
  }
}

function normalizedArray(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy plural field is not an array', { field: label });
  }
  return [...value];
}

function pluralize(record, plural, singular, label) {
  if (record[plural] !== undefined && record[singular] !== undefined && record[singular] !== null) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy singular and plural fields are both populated', {
      field: label
    });
  }
  if (record[plural] !== undefined) return normalizedArray(record[plural], label);
  if (record[singular] === undefined || record[singular] === null) return [];
  if (typeof record[singular] !== 'string' || record[singular].trim() === '') {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy singular field is not a supported string', {
      field: label
    });
  }
  return [record[singular]];
}

function assertLegacyRecord(record, category, chapter, index) {
  const label = `${category}[${index}]`;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy chapter candidate is invalid', { chapter, field: label });
  }
  const unknown = Object.keys(record).filter(field => !LEGACY_FIELDS[category].has(field));
  if (unknown.length > 0) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy chapter candidate has unknown fields', {
      chapter,
      field: label,
      unknown_fields: unknown
    });
  }
  const expectedCandidateKey = `ch${String(chapter).padStart(3, '0')}:${category}:${record.local_key}`;
  if (record.candidate_key !== expectedCandidateKey) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy candidate key is missing or inconsistent', {
      chapter,
      field: `${label}.candidate_key`,
      expected: expectedCandidateKey,
      actual: record.candidate_key ?? null
    });
  }
}

function convertTechniques(value, chapter, index) {
  const techniques = normalizedArray(value, `skills[${index}].techniques`);
  return techniques.map((technique, techniqueIndex) => {
    if (!technique || typeof technique !== 'object' || Array.isArray(technique)
      || Object.keys(technique).some(field => !['name', 'description', 'named_in_source'].includes(field))) {
      importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy technique requires semantic interpretation', {
        chapter,
        field: `skills[${index}].techniques[${techniqueIndex}]`
      });
    }
    return { name: technique.name, description: technique.description ?? null };
  });
}

function convertCandidate(record, category, chapter, index) {
  assertLegacyRecord(record, category, chapter, index);
  const common = {
    local_key: record.local_key,
    name: record.name,
    aliases: normalizedArray(record.aliases, `${category}[${index}].aliases`)
  };
  if (category === 'characters') {
    if (record.biography !== undefined && record.description !== undefined) {
      importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Character has both biography and description', {
        chapter,
        field: `characters[${index}]`
      });
    }
    return {
      ...common,
      identities: pluralize(record, 'identities', 'identity', `characters[${index}].identities`),
      level: record.level ?? null,
      rank: record.rank ?? null,
      description: record.biography ?? record.description ?? null,
      factions: pluralize(record, 'factions', 'faction', `characters[${index}].factions`),
      skills: normalizedArray(record.skills, `characters[${index}].skills`),
      source_refs: record.source_refs
    };
  }
  if (category === 'skills') {
    return {
      ...common,
      types: pluralize(record, 'types', 'type', `skills[${index}].types`),
      factions: pluralize(record, 'factions', 'faction', `skills[${index}].factions`),
      rank: record.rank ?? null,
      description: record.description ?? null,
      techniques: convertTechniques(record.techniques, chapter, index),
      source_refs: record.source_refs
    };
  }
  return {
    ...common,
    type: record.type ?? null,
    description: record.description ?? null,
    source_refs: record.source_refs
  };
}

function convertChapter(draft, sourceChapter, targetChapter) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)
    || draft.chapter !== sourceChapter.number
    || draft.source_hash !== sourceChapter.input_hash
    || draft.title !== sourceChapter.title) {
    importError('CHAPTER_IMPORT_CHAPTER_INVALID', 'Legacy accepted chapter does not match its manifest', {
      chapter: sourceChapter.number
    });
  }
  const allowedTopLevel = new Set([
    'schema_version', 'chapter', 'title', 'source_hash', ...CATEGORIES, 'chapter_summary'
  ]);
  const unknown = Object.keys(draft).filter(field => !allowedTopLevel.has(field));
  if (unknown.length > 0 || CATEGORIES.some(category => !Array.isArray(draft[category]))) {
    importError('CHAPTER_IMPORT_NON_MECHANICAL', 'Legacy accepted chapter has an unsupported shape', {
      chapter: sourceChapter.number,
      unknown_fields: unknown
    });
  }
  const converted = {
    schema_version: draft.schema_version,
    chapter: draft.chapter,
    title: draft.title,
    source_hash: draft.source_hash,
    ...Object.fromEntries(CATEGORIES.map(category => [
      category,
      draft[category].map((record, index) => convertCandidate(record, category, draft.chapter, index))
    ])),
    chapter_summary: draft.chapter_summary
  };
  const errors = validateChapterDraft(converted, {
    number: targetChapter.number,
    title: targetChapter.title,
    inputHash: targetChapter.input_hash,
    chapterText: fs.readFileSync(targetChapter.file, 'utf8')
  });
  if (errors.length > 0) {
    importError('CHAPTER_IMPORT_V6_INVALID', 'Mechanically converted chapter fails the v6 contract', {
      chapter: sourceChapter.number,
      errors
    });
  }
  return normalizeChapterDraft(converted);
}

function assertTargetFresh(paths, manifest) {
  const artifacts = readArtifactManifest(paths);
  if (!fs.existsSync(paths.progress)) {
    importError('CHAPTER_IMPORT_TARGET_INVALID', 'Prepared target progress is missing');
  }
  const progress = readJson(paths.progress);
  if (!progress || typeof progress !== 'object' || !progress.units || !Array.isArray(progress.history)) {
    importError('CHAPTER_IMPORT_TARGET_INVALID', 'Prepared target progress is invalid');
  }
  const chapterDirectoryEntries = fs.existsSync(paths.chapters) ? fs.readdirSync(paths.chapters) : [];
  const chapterUnitsFresh = manifest.chapters.every(chapter => {
    const unit = progress.units[`chapter:${String(chapter.number).padStart(3, '0')}`];
    return unit?.input_hash === chapter.input_hash && unit.status === 'pending'
      && unit.attempts === 0 && unit.output_hashes.length === 0;
  });
  const forbiddenFiles = [
    paths.chapterImportReceipt,
    paths.candidateRegistry,
    paths.finalData,
    paths.finalIdPlan
  ];
  if (artifacts.entries.length > 0 || chapterDirectoryEntries.length > 0
    || progress.history.length > 0 || !chapterUnitsFresh
    || forbiddenFiles.some(file => fs.existsSync(file))
    || (fs.existsSync(paths.domainDecisions) && fs.readdirSync(paths.domainDecisions).length > 0)) {
    importError('CHAPTER_IMPORT_TARGET_NOT_FRESH', 'Chapter import requires a fresh prepared v6 target run');
  }
  return progress;
}

function snapshotPath(target) {
  if (!fs.existsSync(target)) return { target, type: 'missing' };
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) {
    importError('CHAPTER_IMPORT_TARGET_INVALID', 'Chapter import cannot mutate a symbolic link', { path: target });
  }
  if (stat.isFile()) return { target, type: 'file', bytes: fs.readFileSync(target) };
  if (!stat.isDirectory()) {
    importError('CHAPTER_IMPORT_TARGET_INVALID', 'Chapter import target has an unsupported type', { path: target });
  }
  return {
    target,
    type: 'directory',
    entries: fs.readdirSync(target).sort().map(name => snapshotPath(path.join(target, name)))
  };
}

function restorePath(snapshot) {
  fs.rmSync(snapshot.target, { recursive: true, force: true });
  if (snapshot.type === 'missing') return;
  if (snapshot.type === 'file') {
    atomicWriteFile(snapshot.target, snapshot.bytes);
    return;
  }
  fs.mkdirSync(snapshot.target, { recursive: true });
  for (const entry of snapshot.entries) restorePath(entry);
}

function maybeFault(options, point) {
  if (typeof options.injectFault === 'function') options.injectFault(point);
  if (options.faultAt === point) {
    importError('IMPORT_FAULT_INJECTED', `Injected chapter import fault at ${point}`, { point });
  }
}

function importAcceptedChapters({ novelDir, sourceRunId, targetRunId, confirmed, ...options }) {
  if (!confirmed) {
    importError('IMPORT_CONFIRM_REQUIRED', 'import-chapters requires --confirm');
  }
  if (!sourceRunId || !targetRunId || sourceRunId === targetRunId) {
    importError('CHAPTER_IMPORT_RUN_REQUIRED', 'Distinct source and target run ids are required');
  }
  const sourcePaths = pathsFor(novelDir, sourceRunId);
  const targetPaths = pathsFor(novelDir, targetRunId);
  if (!fs.existsSync(sourcePaths.runJson) || !fs.existsSync(targetPaths.runJson)) {
    importError('RUN_MISSING', 'Chapter import source or target run does not exist');
  }

  const sourceRun = readJson(sourcePaths.runJson);
  const targetRun = readJson(targetPaths.runJson);
  assertRunMetadata(sourceRun, sourceRunId, LEGACY_CONTRACT_VERSION, 'source');
  assertRunMetadata(targetRun, targetRunId, SEMANTIC_CONTRACT_VERSION, 'target');
  const sourceManifest = readJson(sourcePaths.manifest);
  const targetManifest = readJson(targetPaths.manifest);
  assertManifest(sourceManifest, sourceRun, 'source');
  assertManifest(targetManifest, targetRun, 'target');
  assertMatchingManifests(sourceManifest, targetManifest);
  assertAcceptedArtifacts(sourcePaths);
  const targetProgress = assertTargetFresh(targetPaths, targetManifest);

  const sourceArtifactManifest = readArtifactManifest(sourcePaths);
  const sourceEntries = new Map(sourceArtifactManifest.entries.map(entry => [entry.relative_path, entry]));
  const targetByNumber = new Map(targetManifest.chapters.map(chapter => [chapter.number, chapter]));
  const converted = sourceManifest.chapters.map(sourceChapter => {
    const fileName = `ch_${String(sourceChapter.number).padStart(3, '0')}.yaml`;
    const relativePath = `accepted/chapters/${fileName}`;
    const sourceFile = path.join(sourcePaths.chapters, fileName);
    const sourceEntry = sourceEntries.get(relativePath);
    if (!sourceEntry || !fs.existsSync(sourceFile)) {
      importError('CHAPTER_IMPORT_ACCEPTED_MISSING', 'Legacy accepted chapter is missing', {
        chapter: sourceChapter.number,
        relative_path: relativePath
      });
    }
    assertFileHash(sourceFile, sourceEntry.content_hash, 'ACCEPTED_ARTIFACT_MUTATED', {
      chapter: sourceChapter.number,
      relative_path: relativePath
    });
    const value = convertChapter(readYaml(sourceFile), sourceChapter, targetByNumber.get(sourceChapter.number));
    const content = `${JSON.stringify(value, null, 2)}\n`;
    return {
      chapter: sourceChapter.number,
      inputHash: sourceChapter.input_hash,
      relativePath,
      sourceHash: sourceEntry.content_hash,
      targetHash: sha256(content),
      content,
      targetFile: path.join(targetPaths.chapters, fileName)
    };
  });

  const snapshots = [
    snapshotPath(targetPaths.chapters),
    snapshotPath(targetPaths.artifactManifest),
    snapshotPath(targetPaths.progress),
    snapshotPath(targetPaths.manualReview),
    snapshotPath(targetPaths.chapterImportReceipt)
  ];
  try {
    const acceptedAt = new Date().toISOString();
    for (const chapter of converted) {
      atomicWriteFile(chapter.targetFile, chapter.content);
      maybeFault(options, `after-chapter-${chapter.chapter}`);
    }
    const artifactManifest = {
      schema_version: 1,
      run_id: targetRunId,
      entries: converted.map(chapter => ({
        relative_path: chapter.relativePath,
        input_hash: chapter.inputHash,
        content_hash: chapter.targetHash,
        accepted_at: acceptedAt
      }))
    };
    atomicWriteJson(targetPaths.artifactManifest, artifactManifest);
    maybeFault(options, 'after-artifact-manifest');

    let progress = targetProgress;
    for (const chapter of converted) {
      const unit = `chapter:${String(chapter.chapter).padStart(3, '0')}`;
      progress = setDeterministicUnit(progress, unit, chapter.inputHash, []);
    }
    saveProgress(targetPaths, progress);
    maybeFault(options, 'after-progress');
    assertAcceptedArtifacts(targetPaths);

    const receipt = {
      schema_version: 1,
      operation: 'import-chapters',
      source_run_id: sourceRunId,
      target_run_id: targetRunId,
      source_semantic_contract_version: LEGACY_CONTRACT_VERSION,
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      source_hash: sourceManifest.source_hash,
      source_artifact_manifest_hash: sha256(fs.readFileSync(sourcePaths.artifactManifest)),
      target_artifact_manifest_hash: sha256(fs.readFileSync(targetPaths.artifactManifest)),
      chapters: converted.map(chapter => ({
        chapter: chapter.chapter,
        input_hash: chapter.inputHash,
        source_content_hash: chapter.sourceHash,
        target_content_hash: chapter.targetHash
      })),
      imported_at: new Date().toISOString()
    };
    atomicWriteJson(targetPaths.chapterImportReceipt, receipt);
    maybeFault(options, 'after-receipt');
    return {
      source_run_id: sourceRunId,
      run_id: targetRunId,
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      chapter_count: converted.length,
      migration_receipt: targetPaths.chapterImportReceipt
    };
  } catch (error) {
    let rollbackError = null;
    for (const snapshot of [...snapshots].reverse()) {
      try {
        restorePath(snapshot);
      } catch (candidate) {
        if (!rollbackError) rollbackError = candidate;
      }
    }
    if (rollbackError) {
      error.details = { ...(error.details || {}), rollback_error: rollbackError.message };
    }
    throw error;
  }
}

module.exports = { importAcceptedChapters };
