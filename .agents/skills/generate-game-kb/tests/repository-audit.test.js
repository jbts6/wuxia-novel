'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { stableHash } = require('../scripts/lib/accept');
const { DATA_FILES, promoteVerifiedData, verifyInstalled } = require('../scripts/lib/install');
const { pathsFor } = require('../scripts/lib/paths');
const { auditRepository, writeAuditReports } = require('../scripts/lib/repository-audit');
const { verifyDataRoot } = require('../scripts/lib/verify');

const AUDIT = path.resolve(__dirname, '..', 'scripts', 'audit-v6.js');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeBook(repo, author, book) {
  const novel = path.join(repo, author, book);
  fs.mkdirSync(novel, { recursive: true });
  fs.writeFileSync(path.join(novel, `${book}.txt`), `第一章 ${book}\n正文。\n`, 'utf8');
  return novel;
}

function installQualifiedBook(repo, author, book) {
  const novel = writeBook(repo, author, book);
  const sourceData = path.join(repo, '.audit-fixtures', book);
  fs.mkdirSync(sourceData, { recursive: true });
  for (const filename of DATA_FILES) fs.writeFileSync(path.join(sourceData, filename), '[]\n', 'utf8');
  const verified = verifyDataRoot(sourceData, { chapters: [] });
  assert.equal(verified.passed, true, JSON.stringify(verified.blocking_errors));

  const runId = 'qualified-fixture';
  const runPaths = pathsFor(novel, runId);
  const idPlan = { schema_version: 1, entries: [] };
  writeJson(runPaths.finalIdPlan, idPlan);
  const sourceHash = stableHash({ fixture: `${author}/${book}` });
  const verificationReport = {
    schema_version: 1,
    passed: true,
    source_hash: sourceHash,
    final_data_hash: verified.final_data_hash,
    counts: verified.counts,
    blocking_errors: [],
    warnings: []
  };
  promoteVerifiedData(novel, {
    sourceData,
    sourceHash,
    finalDataHash: verified.final_data_hash,
    idPlanHash: stableHash(idPlan),
    chapters: [],
    profile: 'v4',
    runId,
    verificationReportContent: `${JSON.stringify(verificationReport, null, 2)}\n`
  });
  assert.equal(verifyInstalled(novel).passed, true);
  return novel;
}

function writeLegacyBook(repo, author, book) {
  const novel = writeBook(repo, author, book);
  const chapters = path.join(novel, '.game-kb-work', 'runs', 'legacy-source', 'source', 'chapters');
  fs.mkdirSync(chapters, { recursive: true });
  fs.writeFileSync(path.join(chapters, 'ch_001.txt'), `第一章 ${book}\n旧资料人物出场。\n`, 'utf8');
  const data = path.join(novel, 'data');
  writeJson(path.join(data, 'characters.json'), [{
    id: 'char_legacy',
    name: '旧资料人物',
    source_refs: [{ chapter: 1, text: '旧资料人物出场。' }]
  }]);
  writeJson(path.join(data, 'skills.json'), []);
  writeJson(path.join(data, 'items.json'), []);
  writeJson(path.join(data, 'factions.json'), []);
  writeJson(path.join(data, 'chapter_summaries.json'), [{
    chapter: 1,
    title: `第一章 ${book}`,
    summary: '旧资料人物出场。',
    source_refs: []
  }]);
  return novel;
}

function writeDamagedBook(repo, author, book) {
  const novel = writeBook(repo, author, book);
  fs.mkdirSync(path.join(novel, 'data'), { recursive: true });
  fs.writeFileSync(path.join(novel, 'data', 'characters.yaml'), 'not: [valid\n', 'utf8');
  return novel;
}

function treeHash(root) {
  const hash = crypto.createHash('sha256');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${relative}\0`);
      if (entry.isDirectory()) visit(file);
      else hash.update(fs.readFileSync(file));
    }
  };
  visit(root);
  return `sha256:${hash.digest('hex')}`;
}

function auditFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-audit-'));
  installQualifiedBook(repo, '乙作者', '合格书');
  writeLegacyBook(repo, '甲作者', '旧版书');
  writeBook(repo, '甲作者', '普通书');
  writeDamagedBook(repo, '丙作者', '损坏书');
  fs.mkdirSync(path.join(repo, 'dashboard', 'dist', 'data'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'dashboard', 'dist', 'data', 'asset.json'), '{}\n', 'utf8');
  return repo;
}

test('classifies repository books deterministically without modifying the repository', () => {
  const repo = auditFixture();
  try {
    const before = treeHash(repo);
    const audit = auditRepository(repo);

    assert.equal(treeHash(repo), before);
    assert.deepEqual(audit.counts, {
      books: 4,
      knowledge_bases: 3,
      qualified: 1,
      unqualified: 2,
      migratable: 1,
      non_migratable: 1,
      not_knowledge_base: 1
    });
    assert.deepEqual(audit.books.map(row => `${row.author}/${row.book}`), [
      '丙作者/损坏书',
      '乙作者/合格书',
      '甲作者/旧版书',
      '甲作者/普通书'
    ].sort());

    const byBook = Object.fromEntries(audit.books.map(row => [row.book, row]));
    assert.equal(byBook['合格书'].classification, 'qualified');
    assert.equal(byBook['合格书'].qualification.passed, true);
    assert.equal(byBook['合格书'].migration.status, 'not_required');
    assert.deepEqual(Object.keys(byBook['合格书'].protection_hashes.data_files).sort(), [...DATA_FILES].sort());
    assert.match(byBook['合格书'].protection_hashes.install_receipt.hash, /^sha256:[a-f0-9]{64}$/);
    assert.ok(Object.keys(byBook['合格书'].protection_hashes.published_run.files).length > 0);
    assert.equal(byBook['旧版书'].classification, 'unqualified');
    assert.equal(byBook['旧版书'].migration.status, 'migratable');
    assert.equal(byBook['旧版书'].migration.plan.operation, 'legacy-json-to-v6');
    assert.equal(byBook['普通书'].classification, 'not_knowledge_base');
    assert.equal(byBook['普通书'].qualification, null);
    assert.equal(byBook['损坏书'].classification, 'unqualified');
    assert.equal(byBook['损坏书'].migration.status, 'non_migratable');
    assert.ok(byBook['损坏书'].reasons.length > 0);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('writes stable JSON and Markdown audit reports with complete classifications', () => {
  const repo = auditFixture();
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-audit-output-'));
  try {
    const audit = auditRepository(repo);
    const written = writeAuditReports(audit, output);
    const firstJson = fs.readFileSync(written.jsonPath, 'utf8');
    const firstMarkdown = fs.readFileSync(written.markdownPath, 'utf8');
    const migrationPlanPath = path.join(output, 'migration-plan.json');
    const firstMigrationPlan = fs.readFileSync(migrationPlanPath, 'utf8');

    assert.equal(path.basename(written.jsonPath), 'initial-audit.json');
    assert.equal(path.basename(written.markdownPath), 'initial-audit.md');
    assert.deepEqual(JSON.parse(firstJson), audit);
    const migrationPlan = JSON.parse(firstMigrationPlan);
    assert.equal(migrationPlan.semantic_contract_version, 6);
    assert.equal(migrationPlan.migrations.length, 1);
    assert.equal(migrationPlan.migrations[0].book, '旧版书');
    assert.equal(migrationPlan.migrations[0].plan.operation, 'legacy-json-to-v6');
    assert.doesNotMatch(firstMigrationPlan, /extract-chapters|distill-domain|model-authored/);
    for (const book of ['合格书', '旧版书', '普通书', '损坏书']) assert.match(firstMarkdown, new RegExp(book));

    writeAuditReports(audit, output);
    assert.equal(fs.readFileSync(written.jsonPath, 'utf8'), firstJson);
    assert.equal(fs.readFileSync(written.markdownPath, 'utf8'), firstMarkdown);
    assert.equal(fs.readFileSync(migrationPlanPath, 'utf8'), firstMigrationPlan);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('audit-v6 CLI emits only report paths and aggregate counts', () => {
  const repo = auditFixture();
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-audit-cli-'));
  try {
    const result = spawnSync(process.execPath, [AUDIT, repo, '--output', output], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(payload).sort(), ['counts', 'jsonPath', 'markdownPath']);
    assert.equal(payload.counts.books, 4);
    assert.equal(fs.existsSync(payload.jsonPath), true);
    assert.equal(fs.existsSync(payload.markdownPath), true);
    assert.doesNotMatch(result.stdout, /"books"\s*:\s*\[/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(output, { recursive: true, force: true });
  }
});
