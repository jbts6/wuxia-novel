'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildCandidateRegistry } = require('../scripts/lib/candidate-registry');
const { normalizeChapterDraft } = require('../scripts/lib/chapter-contract');
const { assembleDomainMergedBook } = require('../scripts/lib/domain-assembly');
const { createDomainWorkPlan } = require('../scripts/lib/domain-work');
const { parseJsonLine, validChapterDraft, validDomainDraft } = require('./helpers');

const SKILL_ROOT = path.resolve(__dirname, '..');
const SCRIPTS_ROOT = path.join(SKILL_ROOT, 'scripts');
const FLOW_ENTRY = path.join(SCRIPTS_ROOT, 'flow.js');

const REMOVED_COMMANDS = [
  'check-coverage',
  'prepare-merge',
  'assemble-merge',
  'prepare-clean',
  'assemble-clean',
  'check-resolution',
  'build-final'
];

const RETAINED_COMMANDS = [
  'archive-existing',
  'prepare',
  'worker-backoff',
  'status',
  'reset-unit',
  'accept',
  'plan-domains',
  'assemble',
  'install',
  'archive-run',
  'archive-abandoned',
  'verify'
];

const REMOVED_PRODUCTION_FILES = [
  'scripts/lib/book-assembly.js',
  'scripts/lib/category-contract.js',
  'scripts/lib/clean-obligations.js',
  'scripts/lib/coverage.js',
  'scripts/lib/game-materials.js',
  'scripts/lib/gaps.js',
  'scripts/lib/priority.js',
  'scripts/lib/quality.js',
  'scripts/lib/quantity.js',
  'scripts/lib/supplements.js',
  'scripts/yaml2json.js'
];

const REMOVED_PROMPTS = [
  'prompts/clean-category.md',
  'prompts/sample-quality.md',
  'prompts/select-materials.md',
  'prompts/supplement-category.md'
];

const LEGACY_REACHABLE_PATTERNS = [
  ...REMOVED_COMMANDS.map(command => ({
    label: `route:${command}`,
    pattern: new RegExp(`\\b${command}\\b`)
  })),
  { label: 'unit:merge:*', pattern: /merge:/ },
  { label: 'unit:clean:*', pattern: /clean:/ },
  { label: 'unit:recall:*', pattern: /\brecall\b/i },
  { label: 'unit:supplement:*', pattern: /\bsupplement\b/i },
  { label: 'unit:quality:sample', pattern: /quality:sample/ },
  { label: 'error:GAP_UNITS_BLOCK_INSTALL', pattern: /\bGAP_UNITS_BLOCK_INSTALL\b/ },
  {
    label: 'error:MERGE_CHAPTERS_INCOMPLETE',
    pattern: /\bMERGE_CHAPTERS_INCOMPLETE\b|merge planning/i
  },
  { label: 'adapter:coverage', pattern: /delete\s+[A-Za-z_$][\w$]*\.coverage\b/ },
  { label: 'path:mergeWork', pattern: /\bmergeWork\b/ },
  { label: 'path:cleanWork', pattern: /\bcleanWork\b/ },
  { label: 'path:cleanObligations', pattern: /\bcleanObligations\b/ },
  { label: 'path:recalls', pattern: /\brecalls\b/ },
  { label: 'path:mergeDecisions', pattern: /\bmergeDecisions\b/ },
  { label: 'path:cleanDecisions', pattern: /\bcleanDecisions\b/ },
  { label: 'path:mergeCategories', pattern: /\bmergeCategories\b/ },
  { label: 'path:cleanCategories', pattern: /\bcleanCategories\b/ },
  { label: 'path:domainBook', pattern: /\bdomainBook\b/ },
  { label: 'path:merged projection', pattern: /\bpaths\.merged\b|\bmerged\s*:\s*path\.join/ },
  { label: 'path:supplements', pattern: /\bpaths\.supplements\b|\bsupplements\s*:\s*path\.join/ },
  { label: 'path:preCleanQuantity', pattern: /\bpreCleanQuantity\b/ },
  { label: 'path:cleaned projection', pattern: /\bpaths\.cleaned\b|\bcleaned\s*:\s*path\.join/ },
  { label: 'path:materialized', pattern: /\bmaterialized(?:Candidates|Merged)?\b/ },
  { label: 'report:coverage', pattern: /\bpaths\.coverage\b|\bcoverage\s*:\s*path\.join/ },
  { label: 'report:candidateResolution', pattern: /\bcandidateResolution\b/ },
  { label: 'report:gameMaterials', pattern: /\bgameMaterials\b/ },
  { label: 'report:quantityReport', pattern: /\bquantityReport\b/ },
  { label: 'report:qualitySample', pattern: /\bqualitySample\b/ },
  { label: 'report:qualityReport', pattern: /\bqualityReport\b/ },
  { label: 'projection:quantity_review', pattern: /\bquantity_review\b/ },
  { label: 'projection:quantity_review_consumed', pattern: /\bquantity_review_consumed\b/ },
  { label: 'projection:quantity_report', pattern: /\bquantity_report\b/ },
  { label: 'projection:game_material_candidates', pattern: /\bgame_material_candidates\b/ },
  { label: 'category:events', pattern: /['"]events['"]|\bevents\s*:/ },
  { label: 'category:locations', pattern: /['"]locations['"]|\blocations\s*:/ },
  { label: 'category:dialogues', pattern: /['"]dialogues['"]|\bdialogues\s*:/ },
  { label: 'attempt:semantic_attempts', pattern: /\bsemantic_attempts\b/ },
  { label: 'attempt:format_attempts', pattern: /\bformat_attempts\b/ },
  { label: 'projection file:merged-with-supplements', pattern: /merged-with-supplements\.json/ },
  { label: 'projection file:pre-clean-quantity', pattern: /pre_clean_quantity\.json/ },
  { label: 'report file:coverage', pattern: /coverage\.json/ },
  { label: 'report file:candidate-resolution', pattern: /candidate-resolution\.json/ },
  { label: 'report file:game-materials', pattern: /game_materials\.json/ },
  { label: 'report file:quantity', pattern: /quantity_report\.json/ },
  { label: 'report file:quality-sample', pattern: /quality_sample\.json/ },
  { label: 'report file:quality', pattern: /quality_report\.json/ }
];

function runFlow(command) {
  return spawnSync(process.execPath, [FLOW_ENTRY, command, '--json'], {
    cwd: SKILL_ROOT,
    encoding: 'utf8'
  });
}

function cliFailure(result) {
  const stderr = (result.stderr || '').trim();
  let payload;
  try {
    payload = parseJsonLine(stderr);
  } catch {
    payload = { code: 'NON_JSON_ERROR', message: stderr };
  }
  return {
    nonzero: result.status !== 0,
    code: payload.code,
    message: payload.message
  };
}

function resolveLocalRequire(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  const match = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return match ? fs.realpathSync(match) : null;
}

function collectProductionGraph(entry) {
  const pending = [fs.realpathSync(entry)];
  const reachable = new Set();
  const unresolved = [];

  while (pending.length > 0) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    if (path.extname(file) !== '.js') continue;

    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const dependency = resolveLocalRequire(file, specifier);
      if (!dependency) {
        unresolved.push(`${path.relative(SKILL_ROOT, file)} -> ${specifier}`);
        continue;
      }
      assert.equal(
        dependency.startsWith(`${fs.realpathSync(SKILL_ROOT)}${path.sep}`),
        true,
        `production dependency escapes the skill root: ${dependency}`
      );
      pending.push(dependency);
    }
  }

  return {
    reachable: [...reachable].sort(),
    unresolved: unresolved.sort()
  };
}

function relativeToSkill(file) {
  return path.relative(SKILL_ROOT, file).replaceAll(path.sep, '/');
}

function collisionAssemblyFixture() {
  const chapter = normalizeChapterDraft(validChapterDraft({
    characters: [
      {
        local_key: 'character:north', name: '同名客', aliases: [], identities: ['北地刀客'],
        level: '次要', rank: '初窥门径', description: null, factions: [], skills: [],
        source_refs: [{ chapter: 1, text: '北地刀客自报名号同名客。' }]
      },
      {
        local_key: 'character:south', name: '同名客', aliases: [], identities: ['南疆剑客'],
        level: '次要', rank: '初窥门径', description: null, factions: [], skills: [],
        source_refs: [{ chapter: 1, text: '南疆剑客亦称同名客。' }]
      }
    ],
    items: [],
    skills: [],
    factions: []
  }));
  const registry = buildCandidateRegistry([chapter]);
  const plan = createDomainWorkPlan({ registry, accepted_hashes: {} });
  const decisions = plan.inputs.map(input => validDomainDraft(input));
  return {
    manifest: { chapters: [{ number: 1, title: chapter.title }] },
    chapters: [chapter],
    registry,
    work_plan: plan,
    decisions
  };
}

test('removed CLI routes are unknown commands rather than parameter errors', () => {
  const actual = Object.fromEntries(REMOVED_COMMANDS.map(command => [command, cliFailure(runFlow(command))]));
  const expected = Object.fromEntries(REMOVED_COMMANDS.map(command => [command, {
    nonzero: true,
    code: 'COMMAND_UNKNOWN',
    message: `Unknown command: ${command}`
  }]));

  assert.deepEqual(actual, expected);
});

test('retained v4 and maintenance CLI routes remain registered', () => {
  const actual = Object.fromEntries(RETAINED_COMMANDS.map(command => [command, cliFailure(runFlow(command)).code]));
  const expected = Object.fromEntries(RETAINED_COMMANDS.map(command => [command, 'NOVEL_DIR_REQUIRED']));

  assert.deepEqual(actual, expected);
});

test('retained v4 production entry modules load their real exports', () => {
  const contracts = [
    ['scripts/flow.js', ['main']],
    ['scripts/lib/assemble.js', ['assembleRun']],
    ['scripts/lib/verify.js', ['verifyFinal']],
    ['scripts/lib/install.js', ['installVerifiedData', 'verifyInstalled']],
    ['scripts/lib/accept.js', ['acceptDraft']],
    ['scripts/lib/domain-work.js', ['createDomainWorkPlan']],
    ['scripts/lib/candidate-ledger.js', [
      'acceptedArtifactHash',
      'assertAcceptedArtifacts',
      'initializeArtifactManifest',
      'readArtifactManifest',
      'recordAcceptedArtifact'
    ]],
    ['scripts/lib/semantic-work.js', [
      'readWorkItem',
      'readWorkPlan',
      'serializedInputBytes',
      'writeWorkPlan'
    ]]
  ];
  const missing = [];

  for (const [relativeFile, exports] of contracts) {
    const loaded = require(path.join(SKILL_ROOT, relativeFile));
    for (const name of exports) {
      if (typeof loaded[name] !== 'function') missing.push(`${relativeFile}#${name}`);
    }
  }

  assert.deepEqual(missing, []);
});

test('accepted domain evidence has no production release API', () => {
  const relativeFile = 'scripts/lib/candidate-ledger.js';
  const ledger = require(path.join(SKILL_ROOT, relativeFile));
  const source = fs.readFileSync(path.join(SKILL_ROOT, relativeFile), 'utf8');

  assert.equal(Object.hasOwn(ledger, 'releaseAcceptedDomainDecision'), false);
  assert.doesNotMatch(source, /\breleaseAcceptedDomainDecision\b/);
});

test('domain assembly owns exact stable collision suffixes across input order and repeated runs', () => {
  const fixture = collisionAssemblyFixture();
  const expected = [
    'character:同名客#4110ae10',
    'character:同名客#9ccdae2d'
  ];
  const first = assembleDomainMergedBook(fixture);
  const repeated = assembleDomainMergedBook(fixture);
  const reversed = assembleDomainMergedBook({
    ...fixture,
    registry: {
      ...fixture.registry,
      categories: {
        ...fixture.registry.categories,
        characters: [...fixture.registry.categories.characters].reverse()
      }
    },
    work_plan: {
      ...fixture.work_plan,
      inputs: [...fixture.work_plan.inputs].reverse(),
      bindings: [...fixture.work_plan.bindings].reverse()
    },
    decisions: [...fixture.decisions].reverse()
  });

  assert.deepEqual(first.characters.map(record => record.local_key), expected);
  assert.deepEqual(repeated.characters.map(record => record.local_key), expected);
  assert.deepEqual(reversed.characters.map(record => record.local_key), expected);
});

test('legacy production modules and yaml2json entry are absent from the filesystem', () => {
  const present = REMOVED_PRODUCTION_FILES.filter(relativeFile => fs.existsSync(path.join(SKILL_ROOT, relativeFile)));

  assert.deepEqual(present, []);
});

test('legacy prompts are absent from the filesystem', () => {
  const present = REMOVED_PROMPTS.filter(relativeFile => fs.existsSync(path.join(SKILL_ROOT, relativeFile)));

  assert.deepEqual(present, []);
});

test('the real flow production graph resolves without reaching a deletion target', () => {
  const graph = collectProductionGraph(FLOW_ENTRY);
  const removed = graph.reachable.map(relativeToSkill).filter(file => REMOVED_PRODUCTION_FILES.includes(file));

  assert.deepEqual({ unresolved: graph.unresolved, removed }, { unresolved: [], removed: [] });
});

test('the real flow production graph contains no legacy route, unit, path, report, category, projection, or attempt strings', () => {
  const graph = collectProductionGraph(FLOW_ENTRY);
  const violations = [];

  for (const { label, pattern } of LEGACY_REACHABLE_PATTERNS) {
    for (const file of graph.reachable.filter(candidate => path.extname(candidate) === '.js')) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      const index = lines.findIndex(line => pattern.test(line));
      if (index >= 0) {
        violations.push(`${label} @ ${relativeToSkill(file)}:${index + 1}`);
        break;
      }
    }
  }

  assert.deepEqual(violations, []);
});
