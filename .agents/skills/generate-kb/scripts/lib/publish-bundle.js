#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  PipelineError,
  readJson,
  sha256,
  writeJsonAtomic
} = require('./atomic-json');
const {
  computeFinalDataHash,
  validateFinalData
} = require('./final-data-contract');
const { CATEGORY_PREFIXES, isValidId } = require('./id-contract');

const DATA_FILE_BY_CATEGORY = Object.freeze({
  character: 'characters.json',
  faction: 'factions.json',
  location: 'locations.json',
  skill: 'skills.json',
  technique: 'techniques.json',
  item: 'items.json',
  dialogue: 'dialogues.json',
  chapter_summary: 'chapter_summaries.json'
});
const ID_CATEGORIES = Object.freeze([
  'character', 'faction', 'location', 'skill', 'technique', 'item', 'dialogue'
]);
const PROVISIONAL_REFERENCE = /^(?:entity_|event_key_|dialogue_key_)/;
const REPORT_FILE_BY_INPUT = Object.freeze({
  source_validation: 'source_validation.json',
  verification_report: 'verification_report.json',
  cross_validation_report: 'cross_validation_report.json',
  semantic_audit_report: 'semantic_audit_report.json',
  quality_report: 'quality_report.json',
  review_packet: 'review_packet.json'
});
const REQUIRED_REPORT_FILES = Object.freeze([
  'final_data_validation.json',
  ...Object.values(REPORT_FILE_BY_INPUT)
]);
const BUNDLE_HASH_PATTERN = /^[a-f0-9]{64}$/;
const COMPATIBILITY_LINKS = Object.freeze({
  data: '.kb/current/data',
  reports: '.kb/current/reports'
});

function idSubjects(input) {
  const subjects = [];
  for (const category of ID_CATEGORIES) {
    for (const record of input?.records_by_category?.[category] ?? []) {
      subjects.push({
        category,
        provisional_key: String(record?.provisional_key ?? '').trim(),
        canonical_name: category === 'dialogue'
          ? null
          : String(record?.name ?? record?.canonical_name ?? '').trim()
      });
    }
  }
  for (const event of input?.events ?? []) {
    subjects.push({
      category: 'event',
      provisional_key: String(event?.provisional_key ?? '').trim(),
      canonical_name: String(event?.canonical_name ?? event?.name ?? '').trim()
    });
  }
  return subjects.sort((left, right) =>
    left.category.localeCompare(right.category)
      || left.provisional_key.localeCompare(right.provisional_key));
}

function hanCharacterCount(value) {
  return Array.from(String(value)).filter(character => /\p{Script=Han}/u.test(character)).length;
}

function buildIdPlan(input, tokenPlan) {
  if (!tokenPlan || typeof tokenPlan !== 'object' || Array.isArray(tokenPlan)) {
    throw new PipelineError('ID_PLAN_INVALID', 'Publish requires a provisional-key token plan');
  }
  const subjects = idSubjects(input);
  const seenKeys = new Set();
  const seenIds = new Map();
  const entries = [];
  for (const subject of subjects) {
    const { category, provisional_key: provisionalKey } = subject;
    if (!provisionalKey || seenKeys.has(provisionalKey)) {
      throw new PipelineError('ID_PLAN_INVALID', `Duplicate or missing provisional key: ${provisionalKey}`);
    }
    seenKeys.add(provisionalKey);
    const proposal = tokenPlan[provisionalKey];
    const canonicalName = String(proposal?.canonical_name ?? '').trim();
    const tokens = proposal?.pinyin_tokens;
    if (!proposal || !canonicalName || !Array.isArray(tokens) || tokens.length === 0
      || tokens.some(token => typeof token !== 'string' || !/^[a-z]+$/.test(token))) {
      throw new PipelineError(
        'ID_TOKENS_INVALID',
        `${provisionalKey} requires lowercase ASCII pinyin_tokens and canonical_name`
      );
    }
    if (subject.canonical_name && canonicalName !== subject.canonical_name) {
      throw new PipelineError(
        'ID_TOKENS_INVALID',
        `${provisionalKey} canonical_name does not match the accepted provisional record`
      );
    }
    const hanCount = hanCharacterCount(canonicalName);
    if (hanCount > 0 && tokens.length !== hanCount) {
      throw new PipelineError(
        'ID_TOKENS_INVALID',
        `${provisionalKey} requires one pinyin token per Chinese character (${hanCount})`
      );
    }
    const finalId = `${CATEGORY_PREFIXES[category]}${tokens.join('_')}`;
    if (!isValidId(finalId, category)) {
      throw new PipelineError('ID_TOKENS_INVALID', `${provisionalKey} produced invalid ID ${finalId}`);
    }
    if (seenIds.has(finalId)) {
      throw new PipelineError(
        'ID_COLLISION',
        `${provisionalKey} and ${seenIds.get(finalId)} both produce ${finalId}`
      );
    }
    seenIds.set(finalId, provisionalKey);
    entries.push({
      provisional_key: provisionalKey,
      category,
      canonical_name: canonicalName,
      pinyin_tokens: [...tokens],
      final_id: finalId
    });
  }
  const extraKeys = Object.keys(tokenPlan).filter(key => !seenKeys.has(key));
  if (extraKeys.length > 0) {
    throw new PipelineError('ID_PLAN_INVALID', `Token plan contains unknown keys: ${extraKeys.join(', ')}`);
  }
  return {
    schema_version: 1,
    entries,
    by_provisional_key: Object.fromEntries(entries.map(entry => [
      entry.provisional_key,
      entry.final_id
    ]))
  };
}

function rewriteReferences(value, mapping) {
  if (Array.isArray(value)) return value.map(item => rewriteReferences(item, mapping));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      rewriteReferences(item, mapping)
    ]));
  }
  if (typeof value === 'string' && Object.hasOwn(mapping, value)) return mapping[value];
  return value;
}

function findDanglingProvisional(value, path = '$', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findDanglingProvisional(item, `${path}[${index}]`, errors));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findDanglingProvisional(item, `${path}.${key}`, errors);
    }
  } else if (typeof value === 'string' && PROVISIONAL_REFERENCE.test(value)) {
    errors.push(`${path}: ${value}`);
  }
  return errors;
}

function projectFinalData(input, idPlan) {
  const mapping = idPlan?.by_provisional_key;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new PipelineError('ID_PLAN_INVALID', 'ID plan mapping is missing');
  }
  const output = Object.fromEntries(Object.values(DATA_FILE_BY_CATEGORY).map(filename => [filename, []]));
  for (const [category, filename] of Object.entries(DATA_FILE_BY_CATEGORY)) {
    for (const sourceRecord of input?.records_by_category?.[category] ?? []) {
      const provisionalKey = sourceRecord?.provisional_key;
      const record = rewriteReferences(sourceRecord, mapping);
      if (category !== 'chapter_summary') {
        const finalId = mapping[provisionalKey];
        if (!finalId) {
          throw new PipelineError('ID_PLAN_INVALID', `ID plan is missing ${provisionalKey}`);
        }
        record.id = finalId;
      }
      delete record.provisional_key;
      delete record.final_category;
      delete record.pinyin_tokens;
      output[filename].push(record);
    }
  }
  const dangling = findDanglingProvisional(output);
  if (dangling.length > 0) {
    throw new PipelineError(
      'PROVISIONAL_REFERENCE_UNRESOLVED',
      `Publish projection left provisional references: ${dangling.join('; ')}`
    );
  }
  return output;
}

function namedFilesHash(root, filenames) {
  const parts = [];
  for (const filename of filenames) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) return null;
    parts.push(Buffer.from(filename));
    parts.push(Buffer.from([0]));
    parts.push(fs.readFileSync(filePath));
    parts.push(Buffer.from([0]));
  }
  return sha256(Buffer.concat(parts));
}

function finalValidationReport(novelDir, validation) {
  return {
    generated_at: new Date().toISOString(),
    novel: path.basename(novelDir),
    passed: [
      validation.missing_data_files,
      validation.invalid_data_files,
      validation.schema_errors,
      validation.enrichment_errors
    ].every(items => items.length === 0) && Boolean(validation.final_data_hash),
    final_data_hash: validation.final_data_hash,
    counts: validation.counts,
    missing_data_files: validation.missing_data_files,
    invalid_data_files: validation.invalid_data_files,
    schema_errors: validation.schema_errors,
    enrichment_errors: validation.enrichment_errors
  };
}

function bindReportToFinalData(report, finalDataHash) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new PipelineError('PUBLISH_REPORT_INVALID', 'Publish reports must be JSON objects');
  }
  return {
    ...report,
    final_data_hash: finalDataHash
  };
}

function reportHardGateErrors(filename, report, manifest) {
  const errors = [];
  if (filename === 'final_data_validation.json' && report.passed !== true) {
    errors.push(`${filename}: final data contract did not pass`);
  }
  if (filename === 'source_validation.json') {
    if (report.passed !== true || (report.errors?.length ?? 0) > 0) {
      errors.push(`${filename}: source validation did not pass`);
    }
    if (report.source_hash !== manifest.source_hash) {
      errors.push(`${filename}: source_hash does not match manifest`);
    }
  }
  if (filename === 'verification_report.json') {
    if ((report.file_errors?.length ?? 0) > 0) {
      errors.push(`${filename}: file_errors must be empty`);
    }
    const grand = report.grand_total;
    if (!grand || grand.weak !== 0 || grand.unverified !== 0) {
      errors.push(`${filename}: grand_total weak and unverified must both be zero`);
    }
  }
  if (filename === 'cross_validation_report.json') {
    const errorIssues = Array.isArray(report.issues)
      ? report.issues.filter(issue => issue?.severity === 'error' || issue?.level === 'error')
      : [];
    if (report.summary?.errors !== 0 || errorIssues.length > 0) {
      errors.push(`${filename}: cross validation contains blocking errors`);
    }
  }
  if (filename === 'semantic_audit_report.json'
    && (report.passed !== true || (report.errors?.length ?? 0) > 0)) {
    errors.push(`${filename}: semantic audit did not pass`);
  }
  if (filename === 'quality_report.json') {
    if (report.completion_gate_passed !== true) {
      errors.push(`${filename}: completion gate did not pass`);
    }
    for (const gateId of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      const gate = report.gates?.[gateId];
      if (!gate || (gate.passed !== true && gate.status !== 'PASS')) {
        errors.push(`${filename}: ${gateId} did not pass`);
      }
    }
  }
  return errors;
}

function manifestHash(manifest) {
  const { bundle_hash: ignored, ...hashInput } = manifest;
  return sha256(hashInput);
}

function pathExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function directoryTreeHash(root) {
  if (!pathExists(root) || !fs.lstatSync(root).isDirectory()) return null;
  const parts = [];
  function visit(directory, relativeRoot = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeRoot, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        parts.push(Buffer.from(`directory\0${relativePath}\0`));
        visit(absolutePath, relativePath);
      } else if (entry.isSymbolicLink()) {
        parts.push(Buffer.from(`symlink\0${relativePath}\0${fs.readlinkSync(absolutePath)}\0`));
      } else if (entry.isFile()) {
        parts.push(Buffer.from(`file\0${relativePath}\0`));
        parts.push(fs.readFileSync(absolutePath));
        parts.push(Buffer.from([0]));
      } else {
        throw new PipelineError('LEGACY_FILE_UNSUPPORTED', `Unsupported legacy file: ${absolutePath}`);
      }
    }
  }
  visit(root);
  return sha256(Buffer.concat(parts));
}

function publishPaths(novelDir) {
  const novelRoot = path.resolve(novelDir);
  const kbRoot = path.join(novelRoot, '.kb');
  return {
    novelRoot,
    kbRoot,
    versionsRoot: path.join(kbRoot, 'versions'),
    current: path.join(kbRoot, 'current'),
    currentNext: path.join(kbRoot, 'current.next'),
    receiptsRoot: path.join(kbRoot, 'receipts'),
    migrationJournal: path.join(kbRoot, 'migration-journal.json'),
    migrationReceipt: path.join(kbRoot, 'migration-receipt.json'),
    migrationBackup: path.join(kbRoot, 'migration-backup')
  };
}

function normalizedExpectedCurrent(value) {
  if (value === undefined || value === null || value === '') {
    throw new PipelineError('EXPECTED_CURRENT_REQUIRED', 'expectedCurrent is required');
  }
  if (value === 'none') return null;
  if (!BUNDLE_HASH_PATTERN.test(value)) {
    throw new PipelineError('EXPECTED_CURRENT_INVALID', `Invalid expected current bundle hash: ${value}`);
  }
  return value;
}

function currentBundleHash(novelDir) {
  const paths = publishPaths(novelDir);
  if (!pathExists(paths.current)) return null;
  const stat = fs.lstatSync(paths.current);
  if (!stat.isSymbolicLink()) {
    throw new PipelineError('CURRENT_POINTER_INVALID', '.kb/current must be a symbolic link');
  }
  const resolved = path.resolve(path.dirname(paths.current), fs.readlinkSync(paths.current));
  const relative = path.relative(paths.versionsRoot, resolved);
  if (!BUNDLE_HASH_PATTERN.test(relative) || relative.includes(path.sep)) {
    throw new PipelineError('CURRENT_POINTER_INVALID', `.kb/current points outside versions: ${relative}`);
  }
  return relative;
}

function assertExpectedCurrent(actual, expected) {
  const normalized = normalizedExpectedCurrent(expected);
  if (actual !== normalized) {
    throw new PipelineError(
      'CURRENT_CHANGED',
      `Expected current bundle ${normalized ?? 'none'}, received ${actual ?? 'none'}`,
      { expected: normalized, actual }
    );
  }
  return normalized;
}

function maybeInjectFailure(options, step, details = {}) {
  if (typeof options?.injectFailure === 'function') options.injectFailure(step, details);
}

function computeReceiptHash(action, expectedCurrent, bundleHash, finalDataHash) {
  return sha256({
    action,
    expected_current: expectedCurrent,
    bundle_hash: bundleHash,
    final_data_hash: finalDataHash
  });
}

function assertBundleHash(value, label = 'bundle hash') {
  if (!BUNDLE_HASH_PATTERN.test(value)) {
    throw new PipelineError('BUNDLE_HASH_INVALID', `Invalid ${label}: ${value}`);
  }
  return value;
}

function writeCurrentPointer(novelDir, bundleHash) {
  const paths = publishPaths(novelDir);
  assertBundleHash(bundleHash);
  const versionRoot = path.join(paths.versionsRoot, bundleHash);
  if (!pathExists(versionRoot)) {
    throw new PipelineError('BUNDLE_NOT_FOUND', `Version bundle does not exist: ${bundleHash}`);
  }
  fs.mkdirSync(paths.kbRoot, { recursive: true });
  if (pathExists(paths.current) && !fs.lstatSync(paths.current).isSymbolicLink()) {
    throw new PipelineError('CURRENT_POINTER_INVALID', '.kb/current must be a symbolic link');
  }
  fs.rmSync(paths.currentNext, { force: true });
  fs.symlinkSync(path.join('versions', bundleHash), paths.currentNext, 'dir');
  fs.renameSync(paths.currentNext, paths.current);
  if (currentBundleHash(novelDir) !== bundleHash) {
    throw new PipelineError('CURRENT_POINTER_INVALID', 'Atomic current pointer replacement did not persist');
  }
}

function verifyLegacyBundle(bundleRoot) {
  const root = path.resolve(bundleRoot);
  const errors = [];
  let manifest = null;
  try {
    manifest = readJson(path.join(root, 'manifest.json'));
  } catch (error) {
    errors.push(`manifest.json: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { passed: false, errors, manifest: null };
  }
  if (manifest.bundle_kind !== 'legacy') errors.push('manifest.json: bundle_kind must be legacy');
  if (manifest.bundle_hash !== manifestHash(manifest)) {
    errors.push('manifest.json: bundle_hash does not match manifest contents');
  }
  if (path.basename(root) !== manifest.bundle_hash) {
    errors.push('bundle directory name does not match manifest.bundle_hash');
  }
  const dataRoot = path.join(root, 'data');
  const reportsRoot = path.join(root, 'reports');
  if (directoryTreeHash(dataRoot) !== manifest.data_hash) {
    errors.push('manifest.json: data_hash does not match archived data');
  }
  if (directoryTreeHash(reportsRoot) !== manifest.reports_hash) {
    errors.push('manifest.json: reports_hash does not match archived reports');
  }
  if (computeFinalDataHash(root, { dataRoot }) !== manifest.final_data_hash) {
    errors.push('manifest.json: final_data_hash does not match archived data');
  }
  return { passed: errors.length === 0, errors, manifest };
}

function verifyVersionBundle(bundleRoot) {
  let manifest;
  try {
    manifest = readJson(path.join(path.resolve(bundleRoot), 'manifest.json'));
  } catch (error) {
    return { passed: false, errors: [`manifest.json: ${error.message}`], manifest: null };
  }
  return manifest?.bundle_kind === 'legacy'
    ? verifyLegacyBundle(bundleRoot)
    : verifyStagingBundle(bundleRoot);
}

function requireVerifiedBundle(bundleRoot) {
  const verification = verifyVersionBundle(bundleRoot);
  if (!verification.passed) {
    throw new PipelineError(
      'BUNDLE_VERIFICATION_FAILED',
      verification.errors.join('; '),
      verification
    );
  }
  return verification;
}

function installVersionBundle(novelDir, bundleRoot) {
  const sourceRoot = path.resolve(bundleRoot);
  const sourceVerification = requireVerifiedBundle(sourceRoot);
  const bundleHash = assertBundleHash(sourceVerification.manifest.bundle_hash);
  const paths = publishPaths(novelDir);
  const targetRoot = path.join(paths.versionsRoot, bundleHash);
  fs.mkdirSync(paths.versionsRoot, { recursive: true });
  if (sourceRoot === targetRoot) return { bundleHash, targetRoot, verification: sourceVerification };
  if (pathExists(targetRoot)) {
    const existing = requireVerifiedBundle(targetRoot);
    return { bundleHash, targetRoot, verification: existing };
  }

  const temporaryRoot = path.join(paths.versionsRoot, `.installing-${bundleHash}-${process.pid}`);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  try {
    fs.cpSync(sourceRoot, temporaryRoot, { recursive: true, errorOnExist: true, force: false });
    fs.renameSync(temporaryRoot, targetRoot);
    const verification = requireVerifiedBundle(targetRoot);
    return { bundleHash, targetRoot, verification };
  } catch (error) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    if (pathExists(targetRoot)) fs.rmSync(targetRoot, { recursive: true, force: true });
    throw error;
  }
}

function legacySourceHash(novelDir) {
  try {
    return readJson(path.join(novelDir, 'build', 'source-index.json')).source_hash ?? null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function buildLegacyManifest(novelDir, createdAt) {
  const dataRoot = path.join(novelDir, 'data');
  const reportsRoot = path.join(novelDir, 'reports');
  const manifest = {
    schema_version: 1,
    bundle_kind: 'legacy',
    source_hash: legacySourceHash(novelDir),
    final_data_hash: computeFinalDataHash(novelDir, { dataRoot }),
    data_hash: directoryTreeHash(dataRoot),
    reports_hash: directoryTreeHash(reportsRoot),
    created_at: createdAt
  };
  manifest.bundle_hash = manifestHash(manifest);
  return manifest;
}

function compatibilityLinkTarget(name) {
  return COMPATIBILITY_LINKS[name];
}

function compatibilityPath(novelDir, name) {
  return path.join(path.resolve(novelDir), name);
}

function assertCompatibilityLink(novelDir, name) {
  const linkPath = compatibilityPath(novelDir, name);
  if (!pathExists(linkPath) || !fs.lstatSync(linkPath).isSymbolicLink()) {
    throw new PipelineError('COMPATIBILITY_LINK_INVALID', `${name}/ must be a symbolic link`);
  }
  const target = fs.readlinkSync(linkPath);
  if (target !== compatibilityLinkTarget(name)) {
    throw new PipelineError(
      'COMPATIBILITY_LINK_INVALID',
      `${name}/ points to ${target}, expected ${compatibilityLinkTarget(name)}`
    );
  }
}

function ensureCompatibilityLinks(novelDir) {
  for (const name of Object.keys(COMPATIBILITY_LINKS)) {
    const linkPath = compatibilityPath(novelDir, name);
    if (pathExists(linkPath)) {
      assertCompatibilityLink(novelDir, name);
      continue;
    }
    fs.symlinkSync(compatibilityLinkTarget(name), linkPath, 'dir');
    assertCompatibilityLink(novelDir, name);
  }
}

function legacyInputPath(paths, name) {
  const backup = path.join(paths.migrationBackup, name);
  return pathExists(backup) ? backup : path.join(paths.novelRoot, name);
}

function ensureLegacyVersion(paths, journal) {
  const bundleHash = assertBundleHash(journal.legacy_bundle_hash, 'legacy bundle hash');
  const targetRoot = path.join(paths.versionsRoot, bundleHash);
  if (pathExists(targetRoot)) return requireVerifiedBundle(targetRoot);
  const dataSource = legacyInputPath(paths, 'data');
  const reportsSource = legacyInputPath(paths, 'reports');
  for (const [name, source] of [['data', dataSource], ['reports', reportsSource]]) {
    if (!pathExists(source) || !fs.lstatSync(source).isDirectory()) {
      throw new PipelineError('LEGACY_LAYOUT_INCOMPLETE', `Legacy ${name}/ directory is unavailable`);
    }
  }

  fs.mkdirSync(paths.versionsRoot, { recursive: true });
  const temporaryRoot = path.join(paths.versionsRoot, `.legacy-${bundleHash}-${process.pid}`);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  try {
    fs.mkdirSync(temporaryRoot, { recursive: true });
    fs.cpSync(dataSource, path.join(temporaryRoot, 'data'), { recursive: true });
    fs.cpSync(reportsSource, path.join(temporaryRoot, 'reports'), { recursive: true });
    writeJsonAtomic(path.join(temporaryRoot, 'manifest.json'), journal.legacy_manifest);
    fs.renameSync(temporaryRoot, targetRoot);
    return requireVerifiedBundle(targetRoot);
  } catch (error) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    if (pathExists(targetRoot)) fs.rmSync(targetRoot, { recursive: true, force: true });
    throw error;
  }
}

function migrateCompatibilityPath(paths, journal, name, options) {
  const livePath = path.join(paths.novelRoot, name);
  const backupPath = path.join(paths.migrationBackup, name);
  if (pathExists(livePath) && fs.lstatSync(livePath).isSymbolicLink()) {
    assertCompatibilityLink(paths.novelRoot, name);
    return;
  }
  if (pathExists(livePath)) {
    if (!fs.lstatSync(livePath).isDirectory() || pathExists(backupPath)) {
      throw new PipelineError('LEGACY_LAYOUT_CONFLICT', `Cannot migrate legacy ${name}/`);
    }
    fs.mkdirSync(paths.migrationBackup, { recursive: true });
    fs.renameSync(livePath, backupPath);
    writeJsonAtomic(paths.migrationJournal, { ...journal, phase: `${name}_backed_up` });
    maybeInjectFailure(options, `legacy_${name}_backed_up`);
  }
  if (!pathExists(backupPath)) {
    throw new PipelineError('LEGACY_LAYOUT_INCOMPLETE', `Legacy ${name}/ backup is unavailable`);
  }
  fs.symlinkSync(compatibilityLinkTarget(name), livePath, 'dir');
  assertCompatibilityLink(paths.novelRoot, name);
  writeJsonAtomic(paths.migrationJournal, { ...journal, phase: `${name}_linked` });
  maybeInjectFailure(options, `legacy_${name}_linked`);
}

function recoverLegacyMigration(novelDir, options = {}) {
  const paths = publishPaths(novelDir);
  const journal = readJson(paths.migrationJournal, null);
  if (!journal) return null;
  if (!journal.legacy_manifest
    || journal.legacy_bundle_hash !== journal.legacy_manifest.bundle_hash
    || manifestHash(journal.legacy_manifest) !== journal.legacy_bundle_hash) {
    throw new PipelineError('MIGRATION_JOURNAL_INVALID', 'Legacy migration journal is invalid');
  }

  ensureLegacyVersion(paths, journal);
  writeJsonAtomic(paths.migrationJournal, { ...journal, phase: 'legacy_bundle_copied' });
  maybeInjectFailure(options, 'legacy_bundle_copied');

  const initialCurrent = journal.initial_current === 'none' ? null : journal.initial_current;
  const actualCurrent = currentBundleHash(novelDir);
  if (actualCurrent !== journal.legacy_bundle_hash) {
    if (actualCurrent !== initialCurrent) {
      throw new PipelineError(
        'CURRENT_CHANGED',
        `Current changed during legacy migration: ${actualCurrent ?? 'none'}`
      );
    }
    writeCurrentPointer(novelDir, journal.legacy_bundle_hash);
  }
  writeJsonAtomic(paths.migrationJournal, { ...journal, phase: 'legacy_current_set' });
  maybeInjectFailure(options, 'legacy_current_set');

  migrateCompatibilityPath(paths, journal, 'data', options);
  migrateCompatibilityPath(paths, journal, 'reports', options);
  const verification = requireVerifiedBundle(path.join(paths.versionsRoot, journal.legacy_bundle_hash));
  const receipt = {
    schema_version: 1,
    action: 'legacy_migration',
    initial_current: journal.initial_current,
    legacy_bundle_hash: journal.legacy_bundle_hash,
    final_data_hash: verification.manifest.final_data_hash,
    created_at: journal.created_at
  };
  writeJsonAtomic(paths.migrationReceipt, receipt);
  fs.rmSync(paths.migrationBackup, { recursive: true, force: true });
  fs.rmSync(paths.migrationJournal, { force: true });
  maybeInjectFailure(options, 'legacy_migration_completed');
  return receipt;
}

function migrateLegacyLayout(novelDir, options = {}) {
  const paths = publishPaths(novelDir);
  const recovered = recoverLegacyMigration(novelDir, options);
  if (recovered) return recovered;

  const states = Object.fromEntries(Object.keys(COMPATIBILITY_LINKS).map(name => {
    const livePath = path.join(paths.novelRoot, name);
    if (!pathExists(livePath)) return [name, 'missing'];
    const stat = fs.lstatSync(livePath);
    return [name, stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'other'];
  }));
  if (states.data === 'missing' && states.reports === 'missing') return null;
  if (states.data === 'symlink' && states.reports === 'symlink') {
    ensureCompatibilityLinks(novelDir);
    return readJson(paths.migrationReceipt, null);
  }
  if (states.data !== 'directory' || states.reports !== 'directory') {
    throw new PipelineError(
      'LEGACY_LAYOUT_INCOMPLETE',
      `Legacy layout must contain both data/ and reports/ directories: ${JSON.stringify(states)}`
    );
  }
  if (currentBundleHash(novelDir) !== null) {
    throw new PipelineError('LEGACY_LAYOUT_CONFLICT', 'Legacy directories cannot coexist with .kb/current');
  }

  const createdAt = options.createdAt ?? new Date().toISOString();
  const manifest = buildLegacyManifest(novelDir, createdAt);
  const journal = {
    schema_version: 1,
    phase: 'planned',
    initial_current: 'none',
    legacy_bundle_hash: manifest.bundle_hash,
    legacy_manifest: manifest,
    created_at: createdAt
  };
  fs.mkdirSync(paths.kbRoot, { recursive: true });
  writeJsonAtomic(paths.migrationJournal, journal);
  return recoverLegacyMigration(novelDir, options);
}

function logicalCurrentHash(novelDir, migrationReceipt = null) {
  const actual = currentBundleHash(novelDir);
  if (migrationReceipt?.initial_current === 'none'
    && actual === migrationReceipt.legacy_bundle_hash) {
    return null;
  }
  return actual;
}

function promoteBundle(novelDir, bundleRoot, options = {}) {
  requireVerifiedBundle(bundleRoot);
  const paths = publishPaths(novelDir);
  const recovered = recoverLegacyMigration(novelDir, options);
  const existingMigration = recovered ?? readJson(paths.migrationReceipt, null);
  assertExpectedCurrent(logicalCurrentHash(novelDir, existingMigration), options.expectedCurrent);

  const installed = installVersionBundle(novelDir, bundleRoot);
  maybeInjectFailure(options, 'bundle_installed', { bundle_hash: installed.bundleHash });
  assertExpectedCurrent(logicalCurrentHash(novelDir, existingMigration), options.expectedCurrent);

  const migration = migrateLegacyLayout(novelDir, options) ?? existingMigration;
  ensureCompatibilityLinks(novelDir);
  const baselineCurrent = currentBundleHash(novelDir);
  maybeInjectFailure(options, 'before_current_swap', {
    from_bundle_hash: baselineCurrent,
    to_bundle_hash: installed.bundleHash
  });
  if (currentBundleHash(novelDir) !== baselineCurrent) {
    throw new PipelineError('CURRENT_CHANGED', 'Current bundle changed before promote');
  }
  writeCurrentPointer(novelDir, installed.bundleHash);

  const createdAt = options.createdAt ?? new Date().toISOString();
  const receipt = {
    schema_version: 1,
    action: 'promote',
    expected_current: options.expectedCurrent,
    from_bundle_hash: baselineCurrent,
    to_bundle_hash: installed.bundleHash,
    final_data_hash: installed.verification.manifest.final_data_hash,
    created_at: createdAt
  };
  receipt.receipt_hash = computeReceiptHash(
    'promote',
    options.expectedCurrent,
    installed.bundleHash,
    installed.verification.manifest.final_data_hash
  );
  const receiptPath = path.join(installed.targetRoot, 'promote-receipt.json');
  writeJsonAtomic(receiptPath, receipt);
  maybeInjectFailure(options, 'after_current_swap', receipt);
  return {
    bundle_hash: installed.bundleHash,
    legacy_bundle_hash: migration?.legacy_bundle_hash ?? null,
    receipt,
    receipt_path: receiptPath,
    verification: installed.verification
  };
}

function rollbackBundle(novelDir, bundleHash, options = {}) {
  assertBundleHash(bundleHash);
  const paths = publishPaths(novelDir);
  const actualCurrent = currentBundleHash(novelDir);
  assertExpectedCurrent(actualCurrent, options.expectedCurrent);
  const targetRoot = path.join(paths.versionsRoot, bundleHash);
  const verification = requireVerifiedBundle(targetRoot);
  ensureCompatibilityLinks(novelDir);
  maybeInjectFailure(options, 'before_current_swap', {
    action: 'rollback',
    from_bundle_hash: actualCurrent,
    to_bundle_hash: bundleHash
  });
  if (currentBundleHash(novelDir) !== actualCurrent) {
    throw new PipelineError('CURRENT_CHANGED', 'Current bundle changed before rollback');
  }
  writeCurrentPointer(novelDir, bundleHash);

  const createdAt = options.createdAt ?? new Date().toISOString();
  const receipt = {
    schema_version: 1,
    action: 'rollback',
    expected_current: options.expectedCurrent,
    from_bundle_hash: actualCurrent,
    to_bundle_hash: bundleHash,
    final_data_hash: verification.manifest.final_data_hash,
    created_at: createdAt
  };
  receipt.receipt_hash = computeReceiptHash(
    'rollback',
    options.expectedCurrent,
    bundleHash,
    verification.manifest.final_data_hash
  );
  fs.mkdirSync(paths.receiptsRoot, { recursive: true });
  const receiptPath = path.join(
    paths.receiptsRoot,
    `rollback-${createdAt.replace(/[^0-9]/g, '')}-${bundleHash}.json`
  );
  writeJsonAtomic(receiptPath, receipt);
  return { bundle_hash: bundleHash, receipt, receipt_path: receiptPath, verification };
}

function verifyStagingBundle(bundleRoot) {
  const root = path.resolve(bundleRoot);
  const errors = [];
  let manifest = null;
  try {
    manifest = readJson(path.join(root, 'manifest.json'));
  } catch (error) {
    errors.push(`manifest.json: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { passed: false, errors, manifest: null };
  }

  const dataRoot = path.join(root, 'data');
  const validation = validateFinalData(root, { dataRoot });
  for (const filename of validation.missing_data_files) {
    errors.push(`data/${filename}: required data file is missing`);
  }
  for (const issue of validation.invalid_data_files) errors.push(`data: ${issue}`);
  for (const issue of validation.schema_errors) errors.push(`schema: ${issue}`);
  for (const issue of validation.enrichment_errors) errors.push(`enrichment: ${issue}`);

  const finalDataHash = computeFinalDataHash(root, { dataRoot });
  if (!finalDataHash || finalDataHash !== manifest.final_data_hash) {
    errors.push('manifest.json: final_data_hash does not match staged data');
  }

  const reportsRoot = path.join(root, 'reports');
  for (const filename of REQUIRED_REPORT_FILES) {
    const reportPath = path.join(reportsRoot, filename);
    let report;
    try {
      report = readJson(reportPath);
    } catch (error) {
      errors.push(`reports/${filename}: ${error.code === 'ENOENT' ? 'required report is missing' : error.message}`);
      continue;
    }
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      errors.push(`reports/${filename}: report must be a JSON object`);
      continue;
    }
    if (report.final_data_hash !== manifest.final_data_hash) {
      errors.push(`reports/${filename}: final_data_hash does not match manifest`);
    }
    errors.push(...reportHardGateErrors(filename, report, manifest));
  }

  const reportsHash = namedFilesHash(reportsRoot, REQUIRED_REPORT_FILES);
  if (!reportsHash || reportsHash !== manifest.reports_hash) {
    errors.push('manifest.json: reports_hash does not match staged reports');
  }

  let idPlan = null;
  try {
    idPlan = readJson(path.join(root, 'id-plan.json'));
  } catch (error) {
    errors.push(`id-plan.json: ${error.code === 'ENOENT' ? 'required ID plan is missing' : error.message}`);
  }
  if (!idPlan || sha256(idPlan) !== manifest.id_plan_hash) {
    errors.push('manifest.json: id_plan_hash does not match id-plan.json');
  }

  const expectedBundleHash = manifestHash(manifest);
  if (manifest.bundle_hash !== expectedBundleHash) {
    errors.push('manifest.json: bundle_hash does not match manifest contents');
  }
  if (path.basename(root) !== manifest.bundle_hash) {
    errors.push('bundle directory name does not match manifest.bundle_hash');
  }

  return {
    passed: errors.length === 0,
    errors,
    manifest,
    validation
  };
}

function buildStagingBundle(options) {
  const {
    novelDir,
    stagingParent,
    runId,
    sourceHash,
    reconcileHash,
    enrichHash,
    semanticAuditHash,
    provisionalInput,
    tokenPlan,
    reportInputs,
    reportBuilder = null,
    gateVersions = {},
    createdAt = new Date().toISOString()
  } = options ?? {};
  if (!novelDir || !stagingParent || !runId || !sourceHash || !reconcileHash
    || !enrichHash || !semanticAuditHash) {
    throw new PipelineError('PUBLISH_INPUT_INVALID', 'Publish bundle metadata is incomplete');
  }

  const idPlan = buildIdPlan(provisionalInput, tokenPlan);
  const finalData = projectFinalData(provisionalInput, idPlan);
  const parent = path.resolve(stagingParent);
  fs.mkdirSync(parent, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(path.join(parent, '.building-'));
  let renamedBundleRoot = null;

  try {
    const dataRoot = path.join(temporaryRoot, 'data');
    const reportsRoot = path.join(temporaryRoot, 'reports');
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.mkdirSync(reportsRoot, { recursive: true });
    for (const filename of Object.values(DATA_FILE_BY_CATEGORY)) {
      writeJsonAtomic(path.join(dataRoot, filename), finalData[filename]);
    }

    const validation = validateFinalData(novelDir, { dataRoot });
    const finalReport = finalValidationReport(novelDir, validation);
    if (!finalReport.passed) {
      throw new PipelineError(
        'FINAL_DATA_VALIDATION_FAILED',
        'Staged final data did not pass the final data contract',
        finalReport
      );
    }
    const finalDataHash = validation.final_data_hash;
    const resolvedReportInputs = reportBuilder
      ? reportBuilder({
        novelDir,
        dataRoot,
        finalDataHash,
        generatedAt: createdAt,
        finalDataValidation: finalReport,
        reportInputs: reportInputs ?? {}
      })
      : reportInputs;
    const missingReports = Object.keys(REPORT_FILE_BY_INPUT)
      .filter(key => !resolvedReportInputs || !Object.hasOwn(resolvedReportInputs, key));
    if (missingReports.length > 0) {
      throw new PipelineError(
        'PUBLISH_REPORT_MISSING',
        `Publish reports are missing: ${missingReports.join(', ')}`
      );
    }
    writeJsonAtomic(path.join(reportsRoot, 'final_data_validation.json'), finalReport);
    for (const [inputKey, filename] of Object.entries(REPORT_FILE_BY_INPUT)) {
      writeJsonAtomic(
        path.join(reportsRoot, filename),
        bindReportToFinalData(resolvedReportInputs[inputKey], finalDataHash)
      );
    }
    writeJsonAtomic(path.join(temporaryRoot, 'id-plan.json'), idPlan);

    const manifest = {
      schema_version: 1,
      run_id: runId,
      source_hash: sourceHash,
      reconcile_hash: reconcileHash,
      enrich_hash: enrichHash,
      semantic_audit_hash: semanticAuditHash,
      final_data_hash: finalDataHash,
      reports_hash: namedFilesHash(reportsRoot, REQUIRED_REPORT_FILES),
      id_plan_hash: sha256(idPlan),
      gate_versions: { ...gateVersions },
      created_at: createdAt
    };
    manifest.bundle_hash = manifestHash(manifest);
    writeJsonAtomic(path.join(temporaryRoot, 'manifest.json'), manifest);

    const bundleRoot = path.join(parent, manifest.bundle_hash);
    if (fs.existsSync(bundleRoot)) {
      throw new PipelineError('BUNDLE_ALREADY_EXISTS', `Bundle already exists: ${manifest.bundle_hash}`);
    }
    fs.renameSync(temporaryRoot, bundleRoot);
    renamedBundleRoot = bundleRoot;
    const verification = verifyStagingBundle(bundleRoot);
    if (!verification.passed) {
      throw new PipelineError(
        'BUNDLE_VERIFICATION_FAILED',
        verification.errors.join('; '),
        verification
      );
    }
    return {
      bundle_root: bundleRoot,
      manifest,
      id_plan: idPlan,
      verification
    };
  } catch (error) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    if (renamedBundleRoot) {
      fs.rmSync(renamedBundleRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

module.exports = {
  DATA_FILE_BY_CATEGORY,
  REQUIRED_REPORT_FILES,
  buildIdPlan,
  buildStagingBundle,
  computeReceiptHash,
  currentBundleHash,
  migrateLegacyLayout,
  projectFinalData,
  promoteBundle,
  recoverLegacyMigration,
  rewriteReferences,
  rollbackBundle,
  verifyLegacyBundle,
  verifyStagingBundle,
  verifyVersionBundle
};
