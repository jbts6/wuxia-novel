'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { FINAL_FILES } = require('../scripts/lib/semantic-contract');
const {
  FALLBACK_CONCURRENCY_LIMIT,
  INITIAL_CONCURRENCY_LIMIT,
  recordExplicit429
} = require('../scripts/lib/worker-pool');
const { pathsFor } = require('../scripts/lib/paths');
const {
  acceptAllChapters,
  makeNovel,
  readJson,
  runFlow,
  sourceRef,
  validChapterDraft
} = require('./helpers');

// 古龙/剑神一笑 is the canonical long-form corpus: 20 chapters, deterministically
// split by 第N回 headings. The simplification contract is exercised against it.
const CORPUS_TXT = path.resolve(
  __dirname, '..', '..', '..', '..', '古龙', '剑神一笑', '剑神一笑.txt'
);
const HAS_CORPUS = fs.existsSync(CORPUS_TXT);
const SKILL_ROOT = path.resolve(__dirname, '..');

function makeNovelFromCorpus() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ggkb-corpus-'));
  const novel = path.join(parent, '剑神一笑');
  fs.mkdirSync(novel, { recursive: true });
  fs.copyFileSync(CORPUS_TXT, path.join(novel, '剑神一笑.txt'));
  return novel;
}

function emptyEntityDraft(chapter) {
  const chapterText = fs.readFileSync(chapter.file, 'utf8');
  const evidenceText = chapterText.split(/\r?\n/).slice(1).find(line => line.trim() !== '')
    || chapter.title;
  return validChapterDraft({
    chapter: chapter.number,
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [],
    skills: [],
    items: [],
    factions: [],
    chapter_summary: {
      title: chapter.title,
      summary: `第${chapter.number}章摘要。`,
      source_refs: [sourceRef(chapter.number, evidenceText)]
    }
  });
}

function groundedEntityDraft(chapter) {
  const chapterText = fs.readFileSync(chapter.file, 'utf8');
  const bodyText = chapterText.split(/\r?\n/).slice(1).find(line => line.trim() !== '')
    || chapter.title;
  const name = (bodyText.match(/\p{Script=Han}/gu) || []).slice(0, 2).join('')
    || chapter.title;
  return validChapterDraft({
    chapter: chapter.number,
    title: chapter.title,
    source_hash: chapter.input_hash,
    characters: [{
      local_key: `character:fixture-${chapter.number}`,
      name,
      level: '核心',
      rank: '初窥门径',
      aliases: [],
      identities: [],
      description: null,
      factions: [],
      skills: [],
      source_refs: [sourceRef(chapter.number, bodyText)]
    }],
    skills: [],
    items: [],
    factions: [],
    chapter_summary: {
      title: chapter.title,
      summary: `第${chapter.number}章摘要。`,
      source_refs: [sourceRef(chapter.number, bodyText)]
    }
  });
}

function prepareInstalledNovel(name, runId) {
  const novel = makeNovel(name, '第一章 起始\n甲。\n');
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);
  assert.equal(runFlow(['assemble', novel, '--run', runId, '--json']).status, 0);
  assert.equal(runFlow(['verify', novel, '--run', runId, '--json']).status, 0);
  assert.equal(runFlow(['install', novel, '--run', runId, '--json']).status, 0);
  return { novel, paths: pathsFor(novel, runId), runId };
}

test('single skill documentation exposes only the simplified command surface', () => {
  const skill = fs.readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
  const examples = fs.readFileSync(path.join(SKILL_ROOT, 'examples.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(SKILL_ROOT, 'prompts', 'extract-chapters.md'), 'utf8');
  const combined = `${skill}\n${examples}\n${prompt}`;

  for (const required of [
    'extract-plan', 'submit', 'run', '--deep', 'source_refs', 'LOW_RECALL',
    '逐章穷尽扫描', '一次性出场', '主动合并或去重'
  ]) {
    assert.match(combined, new RegExp(required));
  }
  for (const removed of [
    'guard-open', 'guard-check', 'submit-draft', 'basic-curate', 'migrate-legacy', 'lite-'
  ]) {
    assert.equal(combined.includes(removed), false, `obsolete command remains: ${removed}`);
  }
  assert.doesNotMatch(skill, /默认 profile 为 `lite`|profile 为 `v4`/);
  assert.equal(fs.existsSync(path.join(SKILL_ROOT, 'SKILL-cn.md')), false);
  assert.equal(fs.existsSync(path.join(SKILL_ROOT, 'examples-cn.md')), false);
  for (const splitSkill of [
    'generate-game-kb-lite',
    'generate-game-kb-deep-characters',
    'generate-game-kb-deep-factions',
    'generate-game-kb-deep-items',
    'generate-game-kb-deep-skills'
  ]) {
    assert.equal(fs.existsSync(path.join(SKILL_ROOT, '..', splitSkill)), false, splitSkill);
  }
});

test('extract-plan on 古龙/剑神一笑 yields twenty flat chapter units at five-wide concurrency', { skip: !HAS_CORPUS }, () => {
  const novel = makeNovelFromCorpus();
  const runId = 'run-corpus-plan';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);

  const result = runFlow(['extract-plan', novel, '--run', runId, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);

  assert.equal(plan.stage, 'extract');
  assert.equal(plan.concurrency, INITIAL_CONCURRENCY_LIMIT);
  assert.equal(plan.concurrency, 5);
  assert.equal(plan.count, 20);
  assert.equal(plan.chapters.length, 20);
  assert.equal(plan.batch, undefined);
  assert.equal(plan.batches, undefined);
  for (const item of plan.chapters) {
    assert.match(item.unit, /^chapter:\d{3}$/);
    assert.equal(typeof item.number, 'number');
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.input_hash, 'string');
    assert.equal(item.attempt, 1);
  }
});

test('an explicit 429 lowers the run concurrency from five to three without consuming attempts', () => {
  const novel = makeNovel('限流书', '第一章 起始\n甲。\n第二章 转折\n乙。\n');
  const runId = 'run-rate-limit';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  const paths = pathsFor(novel, runId);
  const progressBefore = fs.readFileSync(paths.progress, 'utf8');

  assert.throws(
    () => recordExplicit429(paths, { reason: 'timeout' }),
    error => error?.code === 'WORKER_BACKOFF_REASON_INVALID'
  );
  const first = recordExplicit429(paths, { reason: '429' });
  assert.equal(first.changed, true);
  assert.equal(first.worker_pool.concurrency_limit, FALLBACK_CONCURRENCY_LIMIT);
  const repeated = recordExplicit429(paths, { reason: '429' });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.worker_pool.concurrency_limit, FALLBACK_CONCURRENCY_LIMIT);

  const plan = runFlow(['extract-plan', novel, '--run', runId, '--json']);
  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(JSON.parse(plan.stdout).concurrency, 3);
  assert.equal(fs.readFileSync(paths.progress, 'utf8'), progressBefore);
});

test('LOW_RECALL gate blocks install/archive when 5+ chapters yield <=9 entities', () => {
  const novel = makeNovel('低召回书', '第一章 a\n第二章 b\n第三章 c\n第四章 d\n第五章 e\n');
  const runId = 'run-low-recall';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId, emptyEntityDraft);
  assert.equal(runFlow(['assemble', novel, '--run', runId, '--json']).status, 0);

  const verified = runFlow(['verify', novel, '--run', runId, '--json']);
  assert.notEqual(verified.status, 0);
  const report = JSON.parse(verified.stderr);
  assert.equal(report.code, 'FINAL_VERIFICATION_FAILED');
  assert.ok(
    report.details.blocking_errors.some(error => error.code === 'LOW_RECALL'),
    JSON.stringify(report.details.blocking_errors)
  );

  // The run must not reach install/archive: running it throws on verification.
  const ran = runFlow(['run', novel, '--run', runId, '--json']);
  assert.notEqual(ran.status, 0);
  assert.match(ran.stderr, /FINAL_VERIFICATION_FAILED|LOW_RECALL/);
});

test('LOW_RECALL gate exempts novels with fewer than five chapters', () => {
  const novel = makeNovel('短篇书', '第一章 a\n第二章 b\n第三章 c\n');
  const runId = 'run-short';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId, emptyEntityDraft);
  assert.equal(runFlow(['assemble', novel, '--run', runId, '--json']).status, 0);

  const verified = runFlow(['verify', novel, '--run', runId, '--json']);
  assert.equal(verified.status, 0, verified.stderr);
});

test('lite assembly ignores obsolete basic-curate artifacts', () => {
  const novel = makeNovel('旧精简产物', '第一章 起始\n甲。\n');
  const runId = 'run-obsolete-curate';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  acceptAllChapters(novel, runId);
  assert.equal(runFlow(['assemble', novel, '--run', runId, '--json']).status, 0);

  const paths = pathsFor(novel, runId);
  const obsolete = path.join(path.dirname(paths.candidateRegistry), 'basic-curate.json');
  fs.writeFileSync(obsolete, '{"schema_version":1,"decisions":[]}\n', 'utf8');

  const assembled = runFlow(['assemble', novel, '--run', runId, '--json']);
  assert.equal(assembled.status, 0, assembled.stderr);
  const verified = runFlow(['verify', novel, '--run', runId, '--json']);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).counts.characters, 1);
});

test('installed verification reports id-plan drift as a warning', () => {
  const fixture = prepareInstalledNovel('安装辅助哈希', 'run-installed-warning');
  const idPlan = readJson(fixture.paths.finalIdPlan);
  fs.writeFileSync(
    fixture.paths.finalIdPlan,
    `${JSON.stringify({ ...idPlan, fixture_note: 'drift' }, null, 2)}\n`,
    'utf8'
  );

  const result = runFlow(['verify', fixture.novel, '--installed', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.ok(report.warnings.some(error => error.code === 'INSTALL_ID_PLAN_HASH_MISMATCH'));
});

test('archive reports auxiliary metadata hash drift as warnings', () => {
  const fixture = prepareInstalledNovel('归档辅助哈希', 'run-archive-warning');
  const metadata = readJson(fixture.paths.runJson);
  fs.writeFileSync(fixture.paths.runJson, `${JSON.stringify({
    ...metadata,
    verification_report_hash: 'sha256:stale-verification',
    id_plan_hash: 'sha256:stale-id-plan',
    migration_receipt_hash: 'sha256:stale-migration'
  }, null, 2)}\n`, 'utf8');

  const result = runFlow(['archive-run', fixture.novel, '--run', fixture.runId, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.ok(receipt.warnings.some(error => error.code === 'VERIFICATION_REPORT_HASH_MISMATCH'));
  assert.ok(receipt.warnings.some(error => error.code === 'ID_PLAN_HASH_MISMATCH'));
  assert.ok(receipt.warnings.some(error => error.code === 'MIGRATION_RECEIPT_HASH_MISMATCH'));
});

test('real-corpus 古龙/剑神一笑 runs the full lite pipeline and installs exactly five YAML files', { skip: !HAS_CORPUS }, () => {
  const novel = makeNovelFromCorpus();
  const runId = 'run-jian-shen';
  assert.equal(runFlow(['prepare', novel, '--run', runId, '--json']).status, 0);
  // Each chapter carries one source-grounded fixture entity, so the 20-chapter
  // run stays above the LOW_RECALL floor without weakening grounding checks.
  acceptAllChapters(novel, runId, groundedEntityDraft);

  const ran = runFlow(['run', novel, '--run', runId, '--json']);
  assert.equal(ran.status, 0, ran.stderr);
  const report = JSON.parse(ran.stdout);
  assert.equal(report.stage, 'archived');

  const installed = fs.readdirSync(path.join(novel, 'data')).sort();
  assert.deepEqual(installed, [...Object.values(FINAL_FILES)].sort());
  assert.equal(installed.length, 5);

  // Installed data must pass the installed-verification gate.
  const verified = runFlow(['verify', novel, '--installed', '--json']);
  assert.equal(verified.status, 0, verified.stderr);
  const counts = JSON.parse(verified.stdout).counts;
  const total = (counts.characters || 0) + (counts.skills || 0) + (counts.items || 0) + (counts.factions || 0);
  assert.ok(total > 9, `expected high recall, got ${total} entities`);
});
