'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const skillRoot = path.resolve(__dirname, '..');
const obsoleteProductPattern = (
  /\bv5\b|generate-game-kb-v5|version[ -]5|semantic_contract_version\s*:\s*5/i
);

function worktreePaths() {
  return childProcess.execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).split('\0').filter(Boolean).filter(file => fs.existsSync(path.join(repoRoot, file)));
}

function readProductionJavaScript() {
  const root = path.join(skillRoot, 'scripts');
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.js')) files.push(file);
    }
  }
  walk(root);
  return files.map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
}

function readRepoFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

test('tracked product and test paths use Lite rather than V5', () => {
  const forbidden = worktreePaths().filter(file => (
    /(?:^|\/)generate-game-kb-v5(?:\/|$)/i.test(file)
    || /(?:^|\/)v5-[^/]+(?:\/|$)/i.test(file)
    || /(?:^|\/)\d{2}-\d{2}-game-kb-v5-skill-contracts(?:\/|$)/i.test(file)
  ));
  assert.deepEqual(forbidden, []);
});

test('production runtime exposes no public v5 commands or current V5 symbols', () => {
  for (const { file, text } of readProductionJavaScript()) {
    assert.doesNotMatch(text, /\bv5-[a-z0-9-]+\b/i, file);
    const currentV5Symbols = [...text.matchAll(
      /\b[A-Za-z_$][\w$]*V5[\w$]*\b/g
    )].map(match => match[0]).filter(symbol => symbol !== 'LEGACY_PROFILE_V5');
    assert.deepEqual(currentV5Symbols, [], file);
  }
});

test('Lite is the only current lightweight Skill directory', () => {
  const skillsRoot = path.resolve(skillRoot, '..');
  assert.equal(fs.existsSync(path.join(skillsRoot, 'generate-game-kb-lite', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(skillsRoot, 'generate-game-kb-v5')), false);
});

test('historical product narratives use Lite naming', () => {
  const archiveRoot = '.trellis/tasks/archive/2026-07/07-18-game-kb-lite-skill-contracts/';
  const productNarratives = [
    '.superpowers/sdd/task-2-skill-split-report.md',
    'docs/superpowers/plans/2026-07-18-generate-game-kb-fast-path-plan.md',
    'docs/superpowers/plans/2026-07-18-generate-game-kb-skill-split-plan.md',
    'docs/superpowers/specs/2026-07-18-generate-game-kb-skill-split-design.md'
  ].concat(worktreePaths().filter(file => file.startsWith(archiveRoot)));
  for (const file of productNarratives) {
    assert.doesNotMatch(readRepoFile(file), obsoleteProductPattern, file);
  }

  const parentTask = JSON.parse(readRepoFile(
    '.trellis/tasks/archive/2026-07/07-17-generate-game-kb-flow/task.json'
  ));
  assert.ok(parentTask.children.includes('07-18-game-kb-lite-skill-contracts'));
  assert.ok(!parentTask.children.includes('07-18-game-kb-v5-skill-contracts'));

  const workspaceIndex = '.trellis/workspace/jbts6/index.md';
  assert.doesNotMatch(readRepoFile(workspaceIndex), obsoleteProductPattern, workspaceIndex);

  const journal = '.trellis/workspace/jbts6/journal-1.md';
  const unexpectedJournalLines = readRepoFile(journal).split(/\r?\n/).filter(line => (
    obsoleteProductPattern.test(line)
    && !/旧 V5 run.*树哈希.*确认未修改/.test(line)
  ));
  assert.deepEqual(unexpectedJournalLines, [], journal);
});
