#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  REVIEW_CATEGORIES,
  buildReviewPacket,
  plausibilityAlerts
} = require('../scripts/lib/review-readiness');

function emptyStats() {
  return Object.fromEntries(REVIEW_CATEGORIES.map(category => [category, {
    candidates: 0,
    retained_candidates: 0,
    rejected_candidates: 0,
    unresolved_candidates: 0,
    final_records: 0,
    candidate_retention_ratio: null,
    finalization_ratio: null
  }]));
}

function longScale() {
  return {
    chapter_count: 30,
    line_count: 15000,
    window_count: 120,
    scale: 'long'
  };
}

function candidate(category, index, name, discoveryPass = 'named-inventory') {
  return {
    candidate_id: 'cand_ch001_w001_' + String(index).padStart(4, '0'),
    category_hint: category,
    name,
    chapter: 1,
    window_id: 'ch001_w001',
    discovery_pass: discoveryPass,
    source_ref: { line_start: 1, line_end: 1, text: name }
  };
}

function alphaToken(index) {
  let value = index;
  let token = '';
  while (value > 0) {
    value -= 1;
    token = String.fromCharCode(97 + (value % 26)) + token;
    value = Math.floor(value / 26);
  }
  return token;
}

function categoryPrefix(category) {
  return { skill: 'skill_', technique: 'tech_', item: 'item_' }[category] ?? `${category}_`;
}

function keep(candidateRecord, index) {
  return {
    candidate_ids: [candidateRecord.candidate_id],
    decision: 'keep',
    canonical_name: candidateRecord.name,
    final_category: candidateRecord.category_hint,
    final_id: `${categoryPrefix(candidateRecord.category_hint)}test_${alphaToken(index)}`
  };
}

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}

function writeJsonl(filename, rows) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}

function records(category, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${categoryPrefix(category)}test_${alphaToken(index + 1)}`,
    name: `${category}_${index + 1}`
  }));
}

function withNovel(options, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-review-'));
  const chapters = Array.from({ length: options.chapterCount ?? 30 }, (_, index) => ({
    chapter: index + 1,
    file: 'ch_split/ch_' + String(index + 1).padStart(3, '0') + '.txt',
    line_count: options.linesPerChapter ?? 500,
    sha256: 'hash_' + (index + 1)
  }));

  writeJson(path.join(root, 'build', 'source-index.json'), {
    novel: '测试小说',
    source_hash: 'a'.repeat(64),
    chapters,
    windows: []
  });
  writeJsonl(path.join(root, 'build', 'candidates.jsonl'), options.candidates ?? []);
  writeJsonl(path.join(root, 'build', 'decisions.jsonl'), options.decisions ?? []);
  writeJson(path.join(root, 'build', 'events.json'), []);
  writeJson(path.join(root, 'data', 'characters.json'), []);
  writeJson(path.join(root, 'data', 'factions.json'), []);
  writeJson(path.join(root, 'data', 'locations.json'), []);
  writeJson(path.join(root, 'data', 'skills.json'), records('skill', options.skillCount ?? 0));
  writeJson(
    path.join(root, 'data', 'techniques.json'),
    records('technique', options.techniqueCount ?? 0)
  );
  writeJson(path.join(root, 'data', 'items.json'), records('item', options.itemCount ?? 0));
  writeJson(path.join(root, 'data', 'dialogues.json'), []);
  writeJson(path.join(root, 'data', 'chapter_summaries.json'), []);

  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function passingQuality() {
  return {
    completion_gate_passed: true,
    gates: Object.fromEntries(
      ['G1', 'G2', 'G3', 'G4', 'G5'].map(id => [id, { passed: true, reasons: [] }])
    )
  };
}

describe('review readiness plausibility alerts', () => {
  it('does not apply long-novel quantity thresholds to a short story', () => {
    const alerts = plausibilityAlerts({
      chapter_count: 1,
      line_count: 500,
      window_count: 5,
      scale: 'short'
    }, emptyStats());

    assert.deepEqual(alerts, []);
  });

  it('blocks a long novel with fewer than 10 final martial records', () => {
    const stats = emptyStats();
    stats.skill.final_records = 6;
    stats.technique.final_records = 3;
    stats.item.final_records = 8;

    const alerts = plausibilityAlerts(longScale(), stats);
    assert.ok(alerts.some(alert =>
      alert.id === 'long_martial_inventory_too_small' && alert.severity === 'blocking'
    ));
  });

  it('blocks a long novel with fewer than 5 final items', () => {
    const stats = emptyStats();
    stats.skill.final_records = 12;
    stats.technique.final_records = 8;
    stats.item.final_records = 4;

    const alerts = plausibilityAlerts(longScale(), stats);
    assert.ok(alerts.some(alert =>
      alert.id === 'long_item_inventory_too_small' && alert.severity === 'blocking'
    ));
  });

  it('blocks a candidate retention collapse below 10 percent', () => {
    const stats = emptyStats();
    stats.skill.candidates = 20;
    stats.skill.retained_candidates = 1;
    stats.skill.final_records = 10;
    stats.technique.final_records = 10;
    stats.item.final_records = 8;

    const alerts = plausibilityAlerts(longScale(), stats);
    assert.ok(alerts.some(alert =>
      alert.id === 'martial_candidate_retention_collapse' &&
      alert.evidence.retention_ratio === 0.05
    ));
  });
});

describe('review packet generation', () => {
  it('marks a plausible long novel ready for short human review', () => {
    const candidates = [];
    const decisions = [];
    let index = 1;
    for (const [category, count] of [['skill', 20], ['technique', 10], ['item', 10]]) {
      for (let offset = 0; offset < count; offset += 1) {
        const record = candidate(category, index, category + '_' + index);
        candidates.push(record);
        decisions.push(keep(record, index));
        index += 1;
      }
    }

    withNovel({
      candidates,
      decisions,
      skillCount: 20,
      techniqueCount: 10,
      itemCount: 10
    }, root => {
      const packet = buildReviewPacket(root, { qualityReport: passingQuality() });
      assert.equal(packet.review_readiness.status, 'ready_for_human_review');
      assert.equal(packet.review_readiness.blocking_alert_count, 0);
      assert.equal(packet.high_risk_decisions.length, 0);
    });
  });

  it('caps high-risk review at 10 and keeps omitted risks out of certainty samples', () => {
    const candidates = [];
    const decisions = [];

    for (let index = 1; index <= 12; index += 1) {
      const record = candidate('item', index, '高风险物品' + index, 'gap-audit');
      candidates.push(record);
      decisions.push({
        candidate_ids: [record.candidate_id],
        decision: 'redirect',
        canonical_name: record.name,
        final_category: 'skill',
        final_id: `skill_redirect_${alphaToken(index)}`,
        ai_review: { status: 'needs_human' }
      });
    }

    const retained = candidate('item', 13, '确定保留样本');
    const rejected = candidate('item', 14, '确定拒绝样本');
    candidates.push(retained, rejected);
    decisions.push(keep(retained, 13), {
      candidate_ids: [rejected.candidate_id],
      decision: 'reject',
      reason: 'generic_unnamed',
      canonical_name: rejected.name
    });

    withNovel({
      candidates,
      decisions,
      skillCount: 10,
      itemCount: 5
    }, root => {
      const packet = buildReviewPacket(root, { qualityReport: passingQuality() });
      assert.equal(packet.review_readiness.status, 'needs_ai_rerun');
      assert.equal(packet.review_readiness.high_risk_total, 12);
      assert.equal(packet.high_risk_decisions.length, 10);
      assert.equal(packet.high_risk_omitted, 2);
      assert.deepEqual(
        packet.deterministic_samples.retained.map(row => row.canonical_name),
        ['确定保留样本']
      );
      assert.deepEqual(
        packet.deterministic_samples.rejected.map(row => row.canonical_name),
        ['确定拒绝样本']
      );
    });
  });
});
