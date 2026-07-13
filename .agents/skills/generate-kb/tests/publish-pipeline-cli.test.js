#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildCompleteData } = require('./helpers/final-data-fixture');
const { PipelineError, sha256, stableStringify } = require('../scripts/lib/atomic-json');
const { execute } = require('../scripts/pipeline');
const {
  appendPipelineEvent,
  initializePipelineRun,
  loadActivePipelineState
} = require('../scripts/lib/pipeline-state');
const { getPipelinePaths } = require('../scripts/lib/pipeline-paths');

function provisionalInput() {
  const complete = buildCompleteData();
  const character = {
    ...complete['characters.json'][0],
    provisional_key: 'entity_character_aaaaaaaaaaaaaaaa',
    known_skills: ['entity_skill_bbbbbbbbbbbbbbbb'],
    related_skills: ['entity_skill_bbbbbbbbbbbbbbbb']
  };
  const skill = {
    ...complete['skills.json'][0],
    provisional_key: 'entity_skill_bbbbbbbbbbbbbbbb'
  };
  const dialogue = {
    ...complete['dialogues.json'][0],
    provisional_key: 'dialogue_key_cccccccccccccccc',
    speaker: character.provisional_key,
    event_id: 'event_key_dddddddddddddddd'
  };
  const summary = {
    ...complete['chapter_summaries.json'][0],
    key_characters: [character.provisional_key]
  };
  delete character.id;
  delete skill.id;
  delete dialogue.id;
  return {
    records_by_category: {
      character: [character], faction: [], location: [], skill: [skill],
      technique: [], item: [], dialogue: [dialogue], chapter_summary: [summary]
    },
    events: [{
      provisional_key: 'event_key_dddddddddddddddd',
      canonical_name: '主角说明所学',
      final_category: 'event'
    }]
  };
}

function tokenPlan() {
  return {
    entity_character_aaaaaaaaaaaaaaaa: {
      canonical_name: '主角', pinyin_tokens: ['zhu', 'jue']
    },
    entity_skill_bbbbbbbbbbbbbbbb: {
      canonical_name: '北冥神功', pinyin_tokens: ['bei', 'ming', 'shen', 'gong']
    },
    dialogue_key_cccccccccccccccc: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    },
    event_key_dddddddddddddddd: {
      canonical_name: '主角说明所学',
      pinyin_tokens: ['zhu', 'jue', 'shuo', 'ming', 'suo', 'xue']
    }
  };
}

function reportInputs() {
  return {
    verification_report: {
      file_errors: [],
      grand_total: { entities: 2, refs: 2, grounded: 2, weak: 0, unverified: 0 }
    },
    cross_validation_report: { summary: { total: 0, errors: 0, warnings: 0, info: 0 }, issues: [] },
    quality_report: {
      completion_gate_passed: true,
      gates: Object.fromEntries(['G1', 'G2', 'G3', 'G4', 'G5'].map(id => [id, { passed: true, reasons: [] }]))
    }
  };
}

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function writePublishArtifacts(novelDir, runId) {
  writeGroundedSource(novelDir);
  const paths = getPipelinePaths(novelDir, runId);
  const input = provisionalInput();
  const reconcile = {
    decisions: [],
    entities: input.events,
    strong_signals: [],
    signal_resolutions: [],
    chapter_summaries: []
  };
  const reconcileHash = sha256(stableStringify(reconcile));
  const reconcileDir = path.join(paths.materialized, 'reconcile');
  fs.mkdirSync(reconcileDir, { recursive: true });
  fs.writeFileSync(path.join(reconcileDir, 'decisions.jsonl'), '');
  writeJson(path.join(reconcileDir, 'provisional-entities.json'), reconcile.entities);
  writeJson(path.join(reconcileDir, 'strong-signals.json'), {
    signals: reconcile.strong_signals,
    resolutions: reconcile.signal_resolutions
  });
  writeJson(path.join(reconcileDir, 'chapter-summary-drafts.json'), reconcile.chapter_summaries);

  const enrich = {
    records_by_category: input.records_by_category,
    field_evidence_claims: [],
    shared_evidence_justifications: [],
    discovery_alerts: []
  };
  const enrichHash = sha256(stableStringify(enrich));
  const enrichDir = path.join(paths.materialized, 'enrich');
  for (const [category, records] of Object.entries(enrich.records_by_category)) {
    writeJson(path.join(enrichDir, `${category}.json`), records);
  }
  writeJson(path.join(enrichDir, 'field-evidence-claims.json'), enrich.field_evidence_claims);
  writeJson(
    path.join(enrichDir, 'shared-evidence-justifications.json'),
    enrich.shared_evidence_justifications
  );
  writeJson(path.join(enrichDir, 'discovery-alerts.json'), enrich.discovery_alerts);

  const semanticReport = {
    passed: true,
    errors: [],
    high_risk_decisions: [],
    schema_version: 1,
    run_id: runId,
    input_hash: enrichHash
  };
  semanticReport.output_hash = sha256(stableStringify(semanticReport));
  writeJson(path.join(paths.materialized, 'semantic-audit', 'report.json'), semanticReport);
  writeJson(path.join(paths.source, 'source-index.json'), {
    schema_version: 1,
    source_hash: 'source-hash',
    source_alignment_valid: true
  });
  writeJson(path.join(paths.review, 'recall-packet.json'), {
    schema_version: 1,
    run_id: runId,
    source_hash: 'source-hash',
    reconcile_output_hash: reconcileHash,
    status: 'auto_approved',
    review_readiness: { status: 'ready_for_summary' }
  });

  return { paths, reconcileHash, enrichHash, semanticHash: semanticReport.output_hash };
}

function startPublish(novelDir, runId, hashes) {
  passStage(novelDir, runId, 'prepare', 'source-v1', 'prepared-v1');
  passStage(novelDir, runId, 'inventory', 'prepared-v1', 'inventory-v1');
  passStage(novelDir, runId, 'reconcile', 'inventory-v1', hashes.reconcileHash);
  passStage(novelDir, runId, 'enrich', hashes.reconcileHash, hashes.enrichHash);
  passStage(novelDir, runId, 'semantic-audit', hashes.enrichHash, hashes.semanticHash);
  return execute(['advance', novelDir, '--input-hash', hashes.semanticHash]);
}

function writePublishDraft(novelDir, runId, semanticHash) {
  const draftPath = path.join(novelDir, 'publish-draft.json');
  writeJson(draftPath, {
    schema_version: 1,
    run_id: runId,
    semantic_audit_hash: semanticHash,
    token_plan: tokenPlan(),
    report_inputs: reportInputs()
  });
  return draftPath;
}

function writeTokenOnlyPublishDraft(novelDir, runId, semanticHash) {
  const draftPath = path.join(novelDir, 'publish-token-only-draft.json');
  writeJson(draftPath, {
    schema_version: 1,
    run_id: runId,
    semantic_audit_hash: semanticHash,
    token_plan: tokenPlan()
  });
  return draftPath;
}

function writeGroundedSource(novelDir) {
  const sourceText = '主角说道：“我练的是北冥神功。”';
  fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), sourceText);
  fs.writeFileSync(path.join(novelDir, `${path.basename(novelDir)}.txt`), sourceText);
}

function passStage(root, runId, stage, inputHash, outputHash) {
  appendPipelineEvent(root, runId, 'stage_started', {
    stage, input_hash: inputHash, gate_version: `${stage}-v1`
  });
  return appendPipelineEvent(root, runId, 'stage_passed', {
    stage, input_hash: inputHash, output_hash: outputHash, gate_version: `${stage}-v1`
  });
}

it('executes publish CLI commands through state events and an atomic current pointer', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-cli-'));
  try {
    const runId = 'run-cli-001';
    initializePipelineRun(novelDir, { runId, config: {} });
    const hashes = writePublishArtifacts(novelDir, runId);
    const started = startPublish(novelDir, runId, hashes);
    assert.equal(started.stages.publish.status, 'running');

    const draftPath = writeTokenOnlyPublishDraft(novelDir, runId, hashes.semanticHash);
    const builtState = execute(['build-publish', novelDir, '--draft', draftPath]);
    assert.equal(builtState.state.publish.status, 'built');
    assert.equal(path.dirname(builtState.bundle_root), path.join(hashes.paths.publish, 'staging'));
    assert.equal(builtState.manifest.reconcile_hash, hashes.reconcileHash);
    assert.equal(builtState.manifest.enrich_hash, hashes.enrichHash);
    assert.equal(builtState.manifest.semantic_audit_hash, hashes.semanticHash);
    assert.equal(fs.existsSync(path.join(hashes.paths.publish, 'id-plan.json')), true);
    const promoted = execute([
      'promote', novelDir,
      '--bundle', builtState.manifest.bundle_hash,
      '--expected-current', 'none'
    ]);
    assert.equal(promoted.state.stages.publish.status, 'published');
    assert.equal(promoted.state.publish.status, 'promoted');
    assert.equal(
      fs.readlinkSync(path.join(novelDir, '.kb', 'current')),
      `versions/${builtState.manifest.bundle_hash}`
    );
    assert.equal(loadActivePipelineState(novelDir).last_seq, promoted.state.last_seq);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});

it('rejects publish when accepted enrich materialized data was changed after its stage passed', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-stale-'));
  try {
    const runId = 'run-cli-stale';
    initializePipelineRun(novelDir, { runId, config: {} });
    const hashes = writePublishArtifacts(novelDir, runId);
    startPublish(novelDir, runId, hashes);
    const draftPath = writeTokenOnlyPublishDraft(novelDir, runId, hashes.semanticHash);
    writeJson(path.join(hashes.paths.materialized, 'enrich', 'character.json'), []);

    assert.throws(
      () => execute(['build-publish', novelDir, '--draft', draftPath]),
      error => error instanceof PipelineError && error.code === 'PUBLISH_ARTIFACT_STALE'
    );
    assert.equal(loadActivePipelineState(novelDir).publish, null);
    assert.equal(fs.existsSync(path.join(hashes.paths.publish, 'staging')), false);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});

it('generates publish reports from staged data without AI-provided report inputs', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-reports-'));
  try {
    const runId = 'run-cli-reports';
    initializePipelineRun(novelDir, { runId, config: {} });
    writeGroundedSource(novelDir);
    const hashes = writePublishArtifacts(novelDir, runId);
    startPublish(novelDir, runId, hashes);

    const draftPath = writeTokenOnlyPublishDraft(novelDir, runId, hashes.semanticHash);
    const built = execute(['build-publish', novelDir, '--draft', draftPath]);
    const reportsRoot = path.join(built.bundle_root, 'reports');
    const verification = JSON.parse(
      fs.readFileSync(path.join(reportsRoot, 'verification_report.json'), 'utf8')
    );
    const crossValidation = JSON.parse(
      fs.readFileSync(path.join(reportsRoot, 'cross_validation_report.json'), 'utf8')
    );
    const quality = JSON.parse(
      fs.readFileSync(path.join(reportsRoot, 'quality_report.json'), 'utf8')
    );

    assert.equal(verification.grand_total.refs, 2);
    assert.equal(verification.grand_total.unverified, 0);
    assert.equal(crossValidation.summary.errors, 0);
    assert.equal(quality.completion_gate_passed, true);
    assert.equal(quality.gates.G2.details.stage, 'reconcile');
    assert.equal(quality.gates.G2.details.status, 'passed');
    assert.equal(quality.gates.G3.details.final_data_validation.passed, true);
    assert.equal(quality.gates.G3.details.verification.grand_total.unverified, 0);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});

it('rejects AI-provided publish report inputs instead of treating them as gate evidence', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-forged-reports-'));
  try {
    const runId = 'run-cli-forged-reports';
    initializePipelineRun(novelDir, { runId, config: {} });
    const hashes = writePublishArtifacts(novelDir, runId);
    startPublish(novelDir, runId, hashes);
    const draftPath = writePublishDraft(novelDir, runId, hashes.semanticHash);

    assert.throws(
      () => execute(['build-publish', novelDir, '--draft', draftPath]),
      error => error instanceof PipelineError && error.code === 'PUBLISH_DRAFT_INVALID'
    );
    assert.equal(loadActivePipelineState(novelDir).publish, null);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});

it('blocks ungrounded staged data and removes the failed staging bundle', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-pipeline-bad-report-'));
  try {
    const runId = 'run-cli-bad-report';
    initializePipelineRun(novelDir, { runId, config: {} });
    const hashes = writePublishArtifacts(novelDir, runId);
    startPublish(novelDir, runId, hashes);
    fs.writeFileSync(
      path.join(novelDir, 'ch_split', 'ch_001.txt'),
      '这一行与知识库引用完全无关。'
    );
    const draftPath = writeTokenOnlyPublishDraft(novelDir, runId, hashes.semanticHash);

    assert.throws(
      () => execute(['build-publish', novelDir, '--draft', draftPath]),
      error => error instanceof PipelineError && error.code === 'BUNDLE_VERIFICATION_FAILED'
    );
    assert.equal(loadActivePipelineState(novelDir).publish, null);
    const stagingRoot = path.join(hashes.paths.publish, 'staging');
    assert.deepEqual(fs.existsSync(stagingRoot) ? fs.readdirSync(stagingRoot) : [], []);
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});
