#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PipelineError } = require('../scripts/lib/atomic-json');
const { buildCompleteData } = require('./helpers/final-data-fixture');

let publishBundle = {};
try {
  publishBundle = require('../scripts/lib/publish-bundle');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const CHARACTER_KEY = 'entity_character_0123456789abcdef';
const SKILL_KEY = 'entity_skill_1111111111111111';
const DIALOGUE_KEY = 'dialogue_key_2222222222222222';
const EVENT_KEY = 'event_key_3333333333333333';

function provisionalBundleInput() {
  const complete = buildCompleteData();
  const character = {
    ...complete['characters.json'][0],
    provisional_key: CHARACTER_KEY,
    known_skills: [SKILL_KEY],
    related_skills: [SKILL_KEY]
  };
  const skill = {
    ...complete['skills.json'][0],
    provisional_key: SKILL_KEY
  };
  const dialogue = {
    ...complete['dialogues.json'][0],
    provisional_key: DIALOGUE_KEY,
    speaker: CHARACTER_KEY,
    event_id: EVENT_KEY
  };
  const chapterSummary = {
    ...complete['chapter_summaries.json'][0],
    key_characters: [CHARACTER_KEY]
  };
  delete character.id;
  delete skill.id;
  delete dialogue.id;
  return {
    records_by_category: {
      character: [character],
      faction: [],
      location: [],
      skill: [skill],
      technique: [],
      item: [],
      dialogue: [dialogue],
      chapter_summary: [chapterSummary]
    },
    events: [{
      provisional_key: EVENT_KEY,
      canonical_name: '主角说明所学',
      final_category: 'event'
    }]
  };
}

function tokenPlan() {
  return {
    [CHARACTER_KEY]: { canonical_name: '主角', pinyin_tokens: ['zhu', 'jue'] },
    [SKILL_KEY]: {
      canonical_name: '北冥神功',
      pinyin_tokens: ['bei', 'ming', 'shen', 'gong']
    },
    [DIALOGUE_KEY]: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    },
    [EVENT_KEY]: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    }
  };
}

function reportInputs() {
  return {
    source_validation: { passed: true, errors: [], source_hash: 'source-hash' },
    verification_report: {
      file_errors: [],
      grand_total: { entities: 2, refs: 2, grounded: 2, weak: 0, unverified: 0 }
    },
    cross_validation_report: {
      summary: { total: 0, errors: 0, warnings: 0, info: 0 },
      issues: []
    },
    semantic_audit_report: { passed: true, errors: [], high_risk_decisions: [] },
    quality_report: {
      completion_gate_passed: true,
      gates: Object.fromEntries(['G1', 'G2', 'G3', 'G4', 'G5'].map(id => [
        id,
        { passed: true, reasons: [] }
      ]))
    },
    review_packet: { review_readiness: { status: 'ready_for_summary' } }
  };
}

function buildBundle(novelDir, runId) {
  return publishBundle.buildStagingBundle({
    novelDir,
    stagingParent: path.join(novelDir, 'build', 'staging'),
    runId,
    sourceHash: 'source-hash',
    reconcileHash: `reconcile-${runId}`,
    enrichHash: `enrich-${runId}`,
    semanticAuditHash: `semantic-${runId}`,
    provisionalInput: provisionalBundleInput(),
    tokenPlan: tokenPlan(),
    reportInputs: reportInputs(),
    gateVersions: { publish: 'publish-v1' },
    createdAt: `2026-07-13T${runId.slice(-2).padStart(2, '0')}:00:00.000Z`
  });
}

function createLegacyLayout(novelDir) {
  for (const [filename, records] of Object.entries(buildCompleteData())) {
    fs.mkdirSync(path.join(novelDir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(novelDir, 'data', filename), `${JSON.stringify(records, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(novelDir, 'data', 'legacy-note.txt'), 'legacy data bytes\n');
  fs.mkdirSync(path.join(novelDir, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(novelDir, 'reports', 'legacy-only.json'), '{"legacy":true}\n');
}

function currentBundleHash(novelDir) {
  const currentPath = path.join(novelDir, '.kb', 'current');
  return fs.existsSync(currentPath) || fs.lstatSync(currentPath).isSymbolicLink()
    ? path.basename(fs.readlinkSync(currentPath))
    : null;
}

describe('publish-time ID plan and projection', () => {
  it('mints formal IDs only in the publish projection and rewrites every reference', () => {
    assert.equal(typeof publishBundle.buildIdPlan, 'function');
    assert.equal(typeof publishBundle.projectFinalData, 'function');
    const input = provisionalBundleInput();
    const plan = publishBundle.buildIdPlan(input, tokenPlan());
    const data = publishBundle.projectFinalData(input, plan);

    assert.equal(input.records_by_category.character[0].id, undefined);
    assert.equal(plan.by_provisional_key[CHARACTER_KEY], 'char_zhu_jue');
    assert.equal(plan.by_provisional_key[SKILL_KEY], 'skill_bei_ming_shen_gong');
    assert.equal(data['characters.json'][0].id, 'char_zhu_jue');
    assert.deepEqual(data['characters.json'][0].known_skills, ['skill_bei_ming_shen_gong']);
    assert.deepEqual(data['characters.json'][0].related_skills, ['skill_bei_ming_shen_gong']);
    assert.equal(data['dialogues.json'][0].speaker, 'char_zhu_jue');
    assert.equal(data['dialogues.json'][0].event_id, 'event_zhu_jue_shuo_ming_suo_xue');
    assert.deepEqual(data['chapter_summaries.json'][0].key_characters, ['char_zhu_jue']);
    assert.equal(Object.hasOwn(data['characters.json'][0], 'provisional_key'), false);
    assert.deepEqual(Object.keys(data).sort(), [
      'chapter_summaries.json', 'characters.json', 'dialogues.json', 'factions.json',
      'items.json', 'locations.json', 'skills.json', 'techniques.json'
    ]);
  });

  it('rejects non-per-character token plans and final ID collisions', () => {
    const input = provisionalBundleInput();
    const invalidTokens = tokenPlan();
    invalidTokens[SKILL_KEY].pinyin_tokens = ['bei', 'ming'];
    assert.throws(
      () => publishBundle.buildIdPlan(input, invalidTokens),
      error => error instanceof PipelineError && error.code === 'ID_TOKENS_INVALID'
    );

    const duplicate = provisionalBundleInput();
    duplicate.records_by_category.character.push({
      ...duplicate.records_by_category.character[0],
      provisional_key: 'entity_character_4444444444444444'
    });
    const collisions = tokenPlan();
    collisions.entity_character_4444444444444444 = {
      canonical_name: '主角',
      pinyin_tokens: ['zhu', 'jue']
    };
    assert.throws(
      () => publishBundle.buildIdPlan(duplicate, collisions),
      error => error instanceof PipelineError && error.code === 'ID_COLLISION'
    );
  });
});

describe('staging bundle manifest and hard verification', () => {
  it('builds all data and reports under one final-data hash', () => {
    assert.equal(typeof publishBundle.buildStagingBundle, 'function');
    assert.equal(typeof publishBundle.verifyStagingBundle, 'function');
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-publish-'));
    try {
      const built = publishBundle.buildStagingBundle({
        novelDir,
        stagingParent: path.join(novelDir, 'build', 'staging'),
        runId: 'run-publish',
        sourceHash: 'source-hash',
        reconcileHash: 'reconcile-hash',
        enrichHash: 'enrich-hash',
        semanticAuditHash: 'semantic-hash',
        provisionalInput: provisionalBundleInput(),
        tokenPlan: tokenPlan(),
        reportInputs: reportInputs(),
        gateVersions: { publish: 'publish-v1' },
        createdAt: '2026-07-13T08:00:00.000Z'
      });

      assert.equal(path.basename(built.bundle_root), built.manifest.bundle_hash);
      assert.equal(built.verification.passed, true, built.verification.errors.join('; '));
      for (const filename of Object.keys(publishBundle.DATA_FILE_BY_CATEGORY).map(
        category => publishBundle.DATA_FILE_BY_CATEGORY[category]
      )) {
        assert.equal(fs.existsSync(path.join(built.bundle_root, 'data', filename)), true, filename);
      }
      for (const filename of publishBundle.REQUIRED_REPORT_FILES) {
        const report = JSON.parse(fs.readFileSync(path.join(built.bundle_root, 'reports', filename), 'utf8'));
        assert.equal(report.final_data_hash, built.manifest.final_data_hash, filename);
      }
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });

  it('fails verification after a report hash is stale or a data file is removed', () => {
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-publish-tamper-'));
    try {
      const built = publishBundle.buildStagingBundle({
        novelDir,
        stagingParent: path.join(novelDir, 'build', 'staging'),
        runId: 'run-publish-tamper',
        sourceHash: 'source-hash',
        reconcileHash: 'reconcile-hash',
        enrichHash: 'enrich-hash',
        semanticAuditHash: 'semantic-hash',
        provisionalInput: provisionalBundleInput(),
        tokenPlan: tokenPlan(),
        reportInputs: reportInputs(),
        gateVersions: { publish: 'publish-v1' }
      });
      const crossPath = path.join(built.bundle_root, 'reports', 'cross_validation_report.json');
      const cross = JSON.parse(fs.readFileSync(crossPath, 'utf8'));
      cross.final_data_hash = 'stale-hash';
      fs.writeFileSync(crossPath, `${JSON.stringify(cross, null, 2)}\n`);
      let verification = publishBundle.verifyStagingBundle(built.bundle_root);
      assert.equal(verification.passed, false);
      assert.ok(verification.errors.some(error => error.includes('cross_validation_report.json')));

      fs.unlinkSync(path.join(built.bundle_root, 'data', 'items.json'));
      verification = publishBundle.verifyStagingBundle(built.bundle_root);
      assert.equal(verification.passed, false);
      assert.ok(verification.errors.some(error => error.includes('items.json')));
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });
});

describe('versioned publish, migration, and rollback', () => {
  it('archives every legacy file before atomically promoting a staged bundle', () => {
    assert.equal(typeof publishBundle.promoteBundle, 'function');
    assert.equal(typeof publishBundle.verifyVersionBundle, 'function');
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-promote-legacy-'));
    try {
      createLegacyLayout(novelDir);
      const legacyDataBytes = fs.readFileSync(path.join(novelDir, 'data', 'legacy-note.txt'));
      const legacyReportBytes = fs.readFileSync(path.join(novelDir, 'reports', 'legacy-only.json'));
      const built = buildBundle(novelDir, 'run-01');
      const result = publishBundle.promoteBundle(novelDir, built.bundle_root, {
        expectedCurrent: 'none',
        createdAt: '2026-07-13T09:00:00.000Z'
      });

      assert.equal(result.bundle_hash, built.manifest.bundle_hash);
      assert.match(result.legacy_bundle_hash, /^[a-f0-9]{64}$/);
      assert.equal(currentBundleHash(novelDir), built.manifest.bundle_hash);
      assert.equal(fs.readlinkSync(path.join(novelDir, 'data')), '.kb/current/data');
      assert.equal(fs.readlinkSync(path.join(novelDir, 'reports')), '.kb/current/reports');

      const legacyRoot = path.join(novelDir, '.kb', 'versions', result.legacy_bundle_hash);
      assert.deepEqual(
        fs.readFileSync(path.join(legacyRoot, 'data', 'legacy-note.txt')),
        legacyDataBytes
      );
      assert.deepEqual(
        fs.readFileSync(path.join(legacyRoot, 'reports', 'legacy-only.json')),
        legacyReportBytes
      );
      const legacyVerification = publishBundle.verifyVersionBundle(legacyRoot);
      assert.equal(legacyVerification.passed, true, legacyVerification.errors.join('; '));
      assert.equal(legacyVerification.manifest.bundle_kind, 'legacy');
      assert.equal(fs.existsSync(path.join(novelDir, '.kb', 'migration-journal.json')), false);
      assert.equal(fs.existsSync(result.receipt_path), true);
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });

  it('recovers an interrupted legacy migration before retrying promote', () => {
    assert.equal(typeof publishBundle.promoteBundle, 'function');
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-promote-recover-'));
    try {
      createLegacyLayout(novelDir);
      const built = buildBundle(novelDir, 'run-02');
      assert.throws(
        () => publishBundle.promoteBundle(novelDir, built.bundle_root, {
          expectedCurrent: 'none',
          injectFailure(step) {
            if (step === 'legacy_data_backed_up') throw new Error('injected migration failure');
          }
        }),
        /injected migration failure/
      );
      assert.equal(fs.existsSync(path.join(novelDir, '.kb', 'migration-journal.json')), true);

      const recovered = publishBundle.promoteBundle(novelDir, built.bundle_root, {
        expectedCurrent: 'none'
      });
      assert.equal(currentBundleHash(novelDir), built.manifest.bundle_hash);
      assert.match(recovered.legacy_bundle_hash, /^[a-f0-9]{64}$/);
      assert.equal(fs.existsSync(path.join(novelDir, '.kb', 'migration-journal.json')), false);
      assert.equal(fs.readlinkSync(path.join(novelDir, 'data')), '.kb/current/data');
      assert.equal(fs.readlinkSync(path.join(novelDir, 'reports')), '.kb/current/reports');
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });

  it('keeps current unchanged for invalid staging and rejects a concurrent pointer change', () => {
    assert.equal(typeof publishBundle.promoteBundle, 'function');
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-promote-current-'));
    try {
      const first = buildBundle(novelDir, 'run-03');
      publishBundle.promoteBundle(novelDir, first.bundle_root, { expectedCurrent: 'none' });
      assert.equal(currentBundleHash(novelDir), first.manifest.bundle_hash);

      const invalid = buildBundle(novelDir, 'run-04');
      fs.unlinkSync(path.join(invalid.bundle_root, 'data', 'items.json'));
      assert.throws(
        () => publishBundle.promoteBundle(novelDir, invalid.bundle_root, {
          expectedCurrent: first.manifest.bundle_hash
        }),
        error => error instanceof PipelineError && error.code === 'BUNDLE_VERIFICATION_FAILED'
      );
      assert.equal(currentBundleHash(novelDir), first.manifest.bundle_hash);

      const second = buildBundle(novelDir, 'run-05');
      const concurrent = buildBundle(novelDir, 'run-06');
      assert.throws(
        () => publishBundle.promoteBundle(novelDir, second.bundle_root, {
          expectedCurrent: first.manifest.bundle_hash,
          injectFailure(step) {
            if (step === 'before_current_swap') {
              publishBundle.promoteBundle(novelDir, concurrent.bundle_root, {
                expectedCurrent: first.manifest.bundle_hash
              });
            }
          }
        }),
        error => error instanceof PipelineError && error.code === 'CURRENT_CHANGED'
      );
      assert.equal(currentBundleHash(novelDir), concurrent.manifest.bundle_hash);
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });

  it('rolls back only to a complete archived bundle and writes an audit receipt', () => {
    assert.equal(typeof publishBundle.rollbackBundle, 'function');
    const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-rollback-'));
    try {
      const first = buildBundle(novelDir, 'run-07');
      publishBundle.promoteBundle(novelDir, first.bundle_root, { expectedCurrent: 'none' });
      const second = buildBundle(novelDir, 'run-08');
      publishBundle.promoteBundle(novelDir, second.bundle_root, {
        expectedCurrent: first.manifest.bundle_hash
      });

      const rolledBack = publishBundle.rollbackBundle(novelDir, first.manifest.bundle_hash, {
        expectedCurrent: second.manifest.bundle_hash,
        createdAt: '2026-07-13T10:00:00.000Z'
      });
      assert.equal(currentBundleHash(novelDir), first.manifest.bundle_hash);
      assert.equal(rolledBack.receipt.action, 'rollback');
      assert.equal(fs.existsSync(rolledBack.receipt_path), true);

      fs.unlinkSync(path.join(
        novelDir,
        '.kb',
        'versions',
        second.manifest.bundle_hash,
        'reports',
        'quality_report.json'
      ));
      assert.throws(
        () => publishBundle.rollbackBundle(novelDir, second.manifest.bundle_hash, {
          expectedCurrent: first.manifest.bundle_hash
        }),
        error => error instanceof PipelineError && error.code === 'BUNDLE_VERIFICATION_FAILED'
      );
      assert.equal(currentBundleHash(novelDir), first.manifest.bundle_hash);
    } finally {
      fs.rmSync(novelDir, { recursive: true, force: true });
    }
  });
});
