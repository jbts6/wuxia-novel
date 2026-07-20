'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { semanticDecisionFile, stableHash } = require('./accept');
const { assembleRun } = require('./assemble');
const {
  ACCEPTED_SERIALIZATION,
  initializeArtifactManifest,
  recordAcceptedArtifact
} = require('./candidate-ledger');
const { buildCandidateRegistry } = require('./candidate-registry');
const { normalizeChapterDraft, validateChapterDraft } = require('./chapter-contract');
const {
  normalizeDomainDecisionDraft,
  validateDomainDecisionDraft
} = require('./domain-contract');
const { createDomainWorkPlan } = require('./domain-work');
const { GameKbError } = require('./errors');
const { atomicWriteFile, atomicWriteJson, readJson, writeImmutableFile } = require('./io');
const { rebuildLegacyEvidence } = require('./legacy-evidence');
const { mapLegacyBook } = require('./legacy-map');
const {
  loadExistingChapterInventory,
  loadLegacyFileSet,
  resolveLegacySource
} = require('./legacy-source');
const { pathsFor } = require('./paths');
const {
  PROFILE_V4,
  SEMANTIC_CONTRACT_VERSION,
  SEMANTIC_PROFILE
} = require('./semantic-contract');
const { sha256 } = require('./source');
const { writeWorkPlan } = require('./semantic-work');
const { verifyFinal } = require('./verify');

const OPERATION = 'legacy-json-to-v6';
const RECEIPT_CATEGORIES = Object.freeze([
  'characters',
  'skills',
  'items',
  'factions',
  'chapter_summaries'
]);

function migrationError(code, message, details = {}) {
  return new GameKbError(code, message, details);
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-Hans-CN');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map(key => [key, stableValue(value[key])]));
}

function stableRows(rows) {
  const unique = new Map((rows || []).map(row => [JSON.stringify(stableValue(row)), stableValue(row)]));
  return [...unique.values()].sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)));
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sourceSnapshot(inventory) {
  const originalFile = path.join(path.dirname(inventory.root), 'original.txt');
  if (fs.existsSync(originalFile) && fs.statSync(originalFile).isFile()) {
    const content = fs.readFileSync(originalFile, 'utf8');
    return { source_file: originalFile, content, source_hash: sha256(content) };
  }
  const content = inventory.chapters.map(chapter => chapter.text).join('\n');
  return {
    source_file: inventory.chapters[0]?.file || inventory.root,
    content,
    source_hash: sha256(content)
  };
}

function categoryCounts(value) {
  return Object.fromEntries(RECEIPT_CATEGORIES.map(category => [
    category,
    Array.isArray(value?.[category]) ? value[category].length : 0
  ]));
}

function rejectedCategory(row) {
  if (RECEIPT_CATEGORIES.includes(row?.category)) return row.category;
  if (String(row?.code || '').startsWith('LEGACY_SUMMARY_')) return 'chapter_summaries';
  return null;
}

function rejectedCounts(rows) {
  const counts = Object.fromEntries(RECEIPT_CATEGORIES.map(category => [category, 0]));
  for (const row of rows) {
    const category = rejectedCategory(row);
    if (category) counts[category] += 1;
  }
  return counts;
}

function rejectionRows(mapped, evidence) {
  const evidenceErrors = evidence.unresolved || [];
  const mapping = (mapped.rejected || []).map(row => ({ stage: 'mapping', ...row }));
  const grounding = (evidence.rejected || []).map(row => {
    const related = evidenceErrors.filter(issue => (
      issue.category === row.category
      && issue.record === row.record
      && !String(issue.code || '').startsWith('LEGACY_REFERENCE_')
    ));
    return {
      stage: 'evidence',
      ...row,
      ...(related.length > 0 ? { evidence_errors: stableRows(related) } : {})
    };
  });
  return stableRows([...mapping, ...grounding]);
}

function unresolvedReferenceRows(mapped, evidence) {
  return stableRows([...(mapped.unresolved || []), ...(evidence.unresolved || [])]
    .filter(row => String(row?.code || '').startsWith('LEGACY_REFERENCE_')));
}

function inspectLegacy(novelDir, options = {}) {
  const novel = path.resolve(novelDir);
  const sourcePlan = resolveLegacySource(novel, {
    explicitDataRoot: options.explicitDataRoot
  });
  const legacy = loadLegacyFileSet(sourcePlan);
  const inventory = loadExistingChapterInventory(novel);
  const snapshot = sourceSnapshot(inventory);
  const mapped = mapLegacyBook(legacy);
  const evidence = rebuildLegacyEvidence(mapped, inventory);
  const rejected = rejectionRows(mapped, evidence);
  const unresolvedReferences = unresolvedReferenceRows(mapped, evidence);
  const chapterDescriptors = inventory.chapters.map(chapter => ({
    number: chapter.number,
    title: chapter.title,
    source_file: chapter.file,
    input_hash: chapter.hash
  }));
  const inputHash = stableHash({
    source_hash: snapshot.source_hash,
    legacy_file_hashes: sourcePlan.hashes,
    chapters: chapterDescriptors.map(chapter => ({
      number: chapter.number,
      input_hash: chapter.input_hash
    }))
  });
  const publicPlan = {
    schema_version: 1,
    operation: OPERATION,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    profile: PROFILE_V4,
    novel_dir: novel,
    author: path.basename(path.dirname(novel)),
    book: path.basename(novel),
    input_hash: inputHash,
    source: {
      kind: sourcePlan.kind,
      data_root: sourcePlan.dataRoot,
      run_id: sourcePlan.runId || null,
      files: stableValue(sourcePlan.files),
      file_hashes: stableValue(sourcePlan.hashes)
    },
    chapter_inventory: {
      root: inventory.root,
      source_file: snapshot.source_file,
      source_hash: snapshot.source_hash,
      chapters: chapterDescriptors
    },
    counts: {
      input: categoryCounts(legacy),
      retained: Object.fromEntries(RECEIPT_CATEGORIES.map(category => [
        category,
        category === 'chapter_summaries'
          ? evidence.acceptedChapters.filter(chapter => chapter.chapter_summary).length
          : evidence.acceptedChapters.reduce((total, chapter) => total + (chapter[category] || []).length, 0)
      ])),
      rejected: rejectedCounts(rejected)
    },
    rejected,
    unresolved_references: unresolvedReferences
  };
  return { publicPlan, legacy, inventory, snapshot, mapped, evidence };
}

function planLegacyMigration(novelDir, options = {}) {
  return inspectLegacy(novelDir, options).publicPlan;
}

function assertCurrentPlan(plan) {
  if (!plan || plan.operation !== OPERATION || typeof plan.novel_dir !== 'string') {
    throw migrationError('MIGRATION_PLAN_INVALID', 'A valid legacy migration plan is required');
  }
  const current = inspectLegacy(plan.novel_dir, {
    explicitDataRoot: plan.source?.data_root
  });
  if (current.publicPlan.input_hash !== plan.input_hash) {
    throw migrationError('MIGRATION_PLAN_STALE', 'Legacy migration inputs changed after planning', {
      expected: plan.input_hash,
      actual: current.publicPlan.input_hash
    });
  }
  return current;
}

function chapterDraft(chapter) {
  const candidates = category => (chapter[category] || []).map(record => {
    const value = structuredClone(record);
    delete value.candidate_key;
    return value;
  });
  return {
    schema_version: 1,
    chapter: chapter.number,
    title: chapter.title,
    source_hash: chapter.hash,
    characters: candidates('characters'),
    items: candidates('items'),
    skills: candidates('skills'),
    factions: candidates('factions'),
    chapter_summary: chapter.chapter_summary
  };
}

function acceptedChapterFile(paths, number) {
  return path.join(paths.chapters, `ch_${String(number).padStart(3, '0')}.yaml`);
}

function acceptedHashMap(paths, chapters) {
  const hashes = {};
  for (const chapter of chapters) {
    const unit = `chapter:${String(chapter.chapter).padStart(3, '0')}`;
    const file = acceptedChapterFile(paths, chapter.chapter);
    const entry = recordAcceptedArtifact(paths, file, chapter.source_hash, chapter);
    hashes[unit] = entry.content_hash;
  }
  return hashes;
}

function domainPatch(input, entry) {
  const patch = Object.fromEntries((input.allowed_patch_fields || [])
    .filter(field => entry.facts?.[field] !== undefined)
    .map(field => [field, structuredClone(entry.facts[field])]));
  if (entry.category === 'items' && patch.inclusion_reason === undefined) {
    patch.inclusion_reason = entry.facts?.type === '秘籍' ? '秘籍' : '其他稀有特殊';
  }
  return patch;
}

function acceptedDomainDecision(input) {
  const draft = {
    schema_version: 1,
    semantic_contract_version: input.semantic_contract_version,
    unit: input.unit,
    input_hash: input.input_hash,
    decisions: (input.entries || []).map(entry => ({
      entry_ref: entry.entry_ref,
      action: 'keep',
      patch: domainPatch(input, entry)
    })),
    notes: []
  };
  const errors = validateDomainDecisionDraft(draft, input);
  if (errors.length > 0) {
    throw migrationError('MIGRATION_DOMAIN_INVALID', 'Legacy records cannot satisfy the V6 domain contract', {
      unit: input.unit,
      errors
    });
  }
  return normalizeDomainDecisionDraft(draft, input);
}

function fileHash(file) {
  return sha256(fs.readFileSync(file));
}

function finalHashes(paths) {
  const finalData = Object.fromEntries(fs.readdirSync(paths.finalData).sort(compareText)
    .map(filename => [filename, fileHash(path.join(paths.finalData, filename))]));
  return {
    final_data: finalData,
    id_plan: fileHash(paths.finalIdPlan),
    assembly_report: fileHash(paths.assemblyReport),
    verification_report: fileHash(paths.verificationReport)
  };
}

function writeMigrationReceipt(paths, receipt) {
  const content = `${JSON.stringify(stableValue(receipt), null, 2)}\n`;
  writeImmutableFile(paths.migrationReceipt, content, 'MIGRATION_RECEIPT_CONFLICT');
  return sha256(content);
}

function assertStagingRoot(novelDir, stagingRoot) {
  if (typeof stagingRoot !== 'string' || stagingRoot.trim() === '') {
    throw migrationError('MIGRATION_STAGING_REQUIRED', 'An explicit migration staging root is required');
  }
  const novel = path.resolve(novelDir);
  const staging = path.resolve(stagingRoot);
  if (isWithin(novel, staging)) {
    throw migrationError('MIGRATION_STAGING_INSIDE_NOVEL', 'Migration staging must stay outside the novel directory', {
      novel,
      staging_root: staging
    });
  }
  if (path.parse(novel).root.toLowerCase() !== path.parse(staging).root.toLowerCase()) {
    throw migrationError('MIGRATION_STAGING_VOLUME_MISMATCH', 'Migration staging must use the same volume as the novel', {
      novel,
      staging_root: staging
    });
  }
  return staging;
}

function buildLegacyCandidate(plan, { stagingRoot, runId, faultAt } = {}) {
  const current = assertCurrentPlan(plan);
  const workRoot = assertStagingRoot(plan.novel_dir, stagingRoot);
  const paths = pathsFor(plan.novel_dir, runId, { workRoot });
  if (fs.existsSync(paths.run)) {
    throw migrationError('MIGRATION_CANDIDATE_EXISTS', 'Migration candidate run already exists', {
      run: paths.run
    });
  }

  fs.mkdirSync(paths.run, { recursive: true });
  const run = {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    semantic_profile: SEMANTIC_PROFILE,
    accepted_serialization: ACCEPTED_SERIALIZATION,
    profile: PROFILE_V4,
    operation: OPERATION,
    run_id: paths.runId,
    source_file: current.snapshot.source_file,
    source_hash: current.snapshot.source_hash,
    status: 'active',
    started_at: new Date().toISOString()
  };
  atomicWriteJson(paths.runJson, run);
  initializeArtifactManifest(paths);
  atomicWriteFile(paths.sourceOriginal, current.snapshot.content);

  const manifestChapters = current.inventory.chapters.map(chapter => {
    const file = path.join(paths.sourceChapters, `ch_${String(chapter.number).padStart(3, '0')}.txt`);
    atomicWriteFile(file, chapter.text);
    return {
      number: chapter.number,
      title: chapter.title,
      file,
      input_hash: chapter.hash,
      source_char_count: [...chapter.text].filter(character => /[\u3400-\u9fff\uf900-\ufaff]/u.test(character)).length,
      staging_paths: []
    };
  });
  const manifest = {
    schema_version: 1,
    run_id: paths.runId,
    novel_dir: paths.novel,
    source_file: current.snapshot.source_file,
    source_snapshot: paths.sourceOriginal,
    source_hash: current.snapshot.source_hash,
    source_char_count: manifestChapters.reduce((total, chapter) => total + chapter.source_char_count, 0),
    chapters: manifestChapters,
    prepared_at: new Date().toISOString()
  };
  atomicWriteJson(paths.manifest, manifest);

  const drafts = current.evidence.acceptedChapters.map(chapterDraft);
  for (const draft of drafts) {
    const errors = validateChapterDraft(draft, {
      number: draft.chapter,
      inputHash: draft.source_hash
    });
    if (errors.length > 0) {
      throw migrationError('MIGRATION_CHAPTER_INVALID', 'Legacy evidence cannot satisfy the V6 chapter contract', {
        chapter: draft.chapter,
        errors
      });
    }
  }
  const chapters = drafts.map(normalizeChapterDraft);
  const acceptedHashes = acceptedHashMap(paths, chapters);
  const registry = buildCandidateRegistry(chapters);
  const registryInputHash = stableHash({
    semantic_profile: SEMANTIC_PROFILE,
    accepted_hashes: acceptedHashes
  });
  recordAcceptedArtifact(paths, paths.candidateRegistry, registryInputHash, registry);

  const domainPlan = createDomainWorkPlan({
    registry,
    source_hash: manifest.source_hash,
    accepted_hashes: acceptedHashes,
    source_files: manifest.chapters.map(chapter => ({
      chapter: chapter.number,
      title: chapter.title,
      source_file: chapter.file,
      input_hash: chapter.input_hash
    }))
  });
  writeWorkPlan(paths, domainPlan);
  for (const input of domainPlan.inputs) {
    const decision = acceptedDomainDecision(input);
    recordAcceptedArtifact(
      paths,
      semanticDecisionFile(paths, input.unit),
      input.input_hash,
      decision
    );
  }

  atomicWriteJson(paths.manualReview, []);
  atomicWriteJson(paths.finalIdPlan, current.mapped.priorRegistry);
  const assembly = assembleRun({ paths, profile: PROFILE_V4 });
  const verification = verifyFinal(paths, { profile: PROFILE_V4 });
  if (!verification.passed) {
    throw migrationError('MIGRATION_CANDIDATE_INVALID', 'Migration candidate failed canonical V6 verification', {
      blocking_errors: verification.blocking_errors
    });
  }
  if (faultAt === 'after-candidate-write') {
    throw migrationError('MIGRATION_FAULT_INJECTED', 'Injected migration fault', { fault_at: faultAt });
  }

  const hashes = finalHashes(paths);
  const receipt = {
    schema_version: 1,
    operation: OPERATION,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    profile: PROFILE_V4,
    run_id: paths.runId,
    author: plan.author,
    book: plan.book,
    novel_dir: paths.novel,
    input_hash: plan.input_hash,
    source: stableValue(plan.source),
    chapters: plan.chapter_inventory.chapters.map(chapter => ({
      number: chapter.number,
      title: chapter.title,
      input_hash: chapter.input_hash
    })),
    counts: {
      input: plan.counts.input,
      converted: verification.counts,
      rejected: plan.counts.rejected
    },
    rejected: plan.rejected,
    unresolved_references: plan.unresolved_references,
    id_mapping: readJson(paths.finalIdPlan),
    hashes,
    verification: {
      passed: true,
      source_hash: verification.source_hash,
      final_data_hash: verification.final_data_hash,
      id_plan_hash: verification.id_plan_hash
    },
    transaction: {
      state: 'candidate_verified',
      status: 'candidate_verified'
    }
  };
  const receiptHash = writeMigrationReceipt(paths, receipt);
  return {
    paths,
    assembly,
    verification,
    receipt,
    receipt_hash: receiptHash,
    hashes
  };
}

module.exports = {
  OPERATION,
  buildLegacyCandidate,
  planLegacyMigration,
  writeMigrationReceipt
};
