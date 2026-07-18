'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeNovel, readJson, runFlow } = require('./helpers');
const { recordAcceptedArtifact } = require('../scripts/lib/candidate-ledger');
const { pathsFor } = require('../scripts/lib/paths');

function loadBasicCurate() {
  return require('../scripts/lib/basic-curate');
}

function sourceRef(chapter, quote) {
  return {
    chapter,
    source_hash: `sha256:chapter-${chapter}`,
    quote
  };
}

function registryFixture() {
  return {
    schema_version: 1,
    categories: {
      characters: [
        {
          registry_key: 'characters:a-qing',
          category: 'characters',
          canonical_name: '阿青',
          normalized_name: '阿青',
          aliases: [],
          member_refs: ['character:a-qing'],
          record: {
            name: '阿青',
            identity: '越女',
            source_refs: [sourceRef(1, '阿青手持竹棒。')]
          }
        },
        {
          registry_key: 'characters:yue-nv',
          category: 'characters',
          canonical_name: '越女阿青',
          normalized_name: '越女阿青',
          aliases: [],
          member_refs: ['character:yue-nv'],
          record: {
            name: '越女阿青',
            source_refs: [sourceRef(2, '越女阿青传下剑法。')]
          }
        }
      ],
      factions: [],
      items: [
        {
          registry_key: 'items:stone',
          category: 'items',
          canonical_name: '石块',
          normalized_name: '石块',
          aliases: [],
          member_refs: ['item:stone'],
          record: {
            name: '石块',
            source_refs: [sourceRef(1, '地上有一块石块。')]
          }
        }
      ],
      skills: []
    },
    bindings: {
      'character:a-qing': 'characters:a-qing',
      'character:yue-nv': 'characters:yue-nv',
      'item:stone': 'items:stone'
    },
    pending: [],
    stats: { groups: 3, pending_groups: 0 }
  };
}

function validDraft() {
  return {
    schema_version: 1,
    decisions: [
      { action: 'keep', registry_key: 'characters:a-qing' },
      {
        action: 'merge',
        registry_key: 'characters:yue-nv',
        target_registry_key: 'characters:a-qing'
      },
      { action: 'drop', registry_key: 'items:stone' }
    ]
  };
}

test('validates constrained keep, merge, and drop decisions', () => {
  const { validateBasicCurateDraft } = loadBasicCurate();

  assert.deepEqual(validateBasicCurateDraft(validDraft(), registryFixture()), []);
});

test('rejects unknown source and merge-target registry references', () => {
  const { validateBasicCurateDraft } = loadBasicCurate();
  const draft = validDraft();
  draft.decisions[0].registry_key = 'characters:invented';
  draft.decisions[1].target_registry_key = 'characters:missing';

  const errors = validateBasicCurateDraft(draft, registryFixture());
  assert.deepEqual(errors.map(error => error.code), [
    'BASIC_CURATE_REFERENCE_UNKNOWN',
    'BASIC_CURATE_REFERENCE_UNKNOWN'
  ]);
});

test('rejects invented entities, changed evidence, and free-form patches', () => {
  const { validateBasicCurateDraft } = loadBasicCurate();
  const forbiddenFields = ['entity', 'source_refs', 'description', 'rank', 'biography', 'patch'];

  for (const field of forbiddenFields) {
    const draft = {
      schema_version: 1,
      decisions: [{ action: 'keep', registry_key: 'characters:a-qing', [field]: {} }]
    };
    const errors = validateBasicCurateDraft(draft, registryFixture());
    assert.equal(errors.some(error => error.code === 'BASIC_CURATE_FIELD_FORBIDDEN'), true, field);
  }
});

test('rejects duplicate decisions for the same registry entry', () => {
  const { validateBasicCurateDraft } = loadBasicCurate();
  const draft = {
    schema_version: 1,
    decisions: [
      { action: 'keep', registry_key: 'characters:a-qing' },
      { action: 'drop', registry_key: 'characters:a-qing' }
    ]
  };

  assert.equal(
    validateBasicCurateDraft(draft, registryFixture()).some(error => error.code === 'BASIC_CURATE_DECISION_DUPLICATE'),
    true
  );
});

test('rejects unsupported actions and cross-category merges', () => {
  const { validateBasicCurateDraft } = loadBasicCurate();
  const draft = {
    schema_version: 1,
    decisions: [
      { action: 'patch', registry_key: 'characters:a-qing' },
      {
        action: 'merge',
        registry_key: 'items:stone',
        target_registry_key: 'characters:a-qing'
      }
    ]
  };

  const codes = validateBasicCurateDraft(draft, registryFixture()).map(error => error.code);
  assert.equal(codes.includes('BASIC_CURATE_ACTION_INVALID'), true);
  assert.equal(codes.includes('BASIC_CURATE_MERGE_CATEGORY_MISMATCH'), true);
});

test('applies decisions deterministically without inventing records or evidence', () => {
  const { applyBasicCurate } = loadBasicCurate();
  const registry = registryFixture();
  const decisions = validDraft().decisions;

  const result = applyBasicCurate(registry, decisions);
  const repeated = applyBasicCurate(registry, [...decisions].reverse());

  assert.deepEqual(result, repeated);
  assert.equal(JSON.stringify(result), JSON.stringify(repeated));
  assert.equal(result.categories.characters.length, 1);
  assert.equal(result.categories.items.length, 0);
  assert.deepEqual(result.categories.characters[0].member_refs, [
    'character:a-qing',
    'character:yue-nv'
  ]);
  assert.deepEqual(result.categories.characters[0].record.source_refs, [
    sourceRef(1, '阿青手持竹棒。'),
    sourceRef(2, '越女阿青传下剑法。')
  ]);
  assert.deepEqual(registry, registryFixture());
});

test('invalid decisions fail closed without mutating the deterministic registry', () => {
  const { applyBasicCurate } = loadBasicCurate();
  const registry = registryFixture();

  assert.throws(
    () => applyBasicCurate(registry, [{ action: 'drop', registry_key: 'items:invented' }]),
    { code: 'BASIC_CURATE_INVALID' }
  );
  assert.deepEqual(registry, registryFixture());
});

test('basic-curate CLI can skip the optional unit without changing the registry', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['prepare', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;
  const paths = pathsFor(novel, runId);
  const registry = registryFixture();
  recordAcceptedArtifact(paths, paths.candidateRegistry, 'sha256:registry-input', registry);

  const result = runFlow(['basic-curate', novel, '--run', runId, '--skip', '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'skipped');
  assert.equal(readJson(paths.progress).units['basic-curate'].status, 'skipped');
  assert.deepEqual(readJson(paths.candidateRegistry), registry);
});

test('accepted basic-curate remains terminal after a later invalid submission', () => {
  const novel = makeNovel('试书', '第一章 起始\n甲。\n');
  const prepared = runFlow(['prepare', novel, '--json']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const runId = JSON.parse(prepared.stdout).run_id;
  const paths = pathsFor(novel, runId);
  const registry = registryFixture();
  recordAcceptedArtifact(paths, paths.candidateRegistry, 'sha256:registry-input', registry);
  const draftPath = path.join(novel, 'basic-curate.json');
  fs.writeFileSync(draftPath, `${JSON.stringify(validDraft(), null, 2)}\n`, 'utf8');

  const accepted = runFlow(['basic-curate', novel, '--run', runId, '--draft', draftPath, '--json']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(readJson(paths.progress).units['basic-curate'].status, 'done');

  const invalidPath = path.join(novel, 'basic-curate-invalid.json');
  fs.writeFileSync(invalidPath, JSON.stringify({
    schema_version: 1,
    decisions: [{ action: 'drop', registry_key: 'items:invented' }]
  }), 'utf8');
  const rejected = runFlow(['basic-curate', novel, '--run', runId, '--draft', invalidPath, '--json']);

  assert.notEqual(rejected.status, 0);
  assert.equal(readJson(paths.progress).units['basic-curate'].status, 'done');
  assert.deepEqual(readJson(paths.candidateRegistry), registry);
});
