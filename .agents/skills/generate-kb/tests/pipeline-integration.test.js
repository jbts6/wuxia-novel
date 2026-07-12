#!/usr/bin/env node
'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { prepareSource } = require('../scripts/prepare-source');
const { assessQuality } = require('../scripts/assess-quality');

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

it('passes an end-to-end source-grounded minimal knowledge base', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-integration-'));
  const sourceText = '主角说道：“我练的是北冥神功。”';
  try {
    fs.mkdirSync(path.join(novelDir, 'ch_split'), { recursive: true });
    fs.writeFileSync(path.join(novelDir, 'ch_split', 'ch_001.txt'), sourceText);
    fs.writeFileSync(path.join(novelDir, `${path.basename(novelDir)}.txt`), sourceText);
    const { sourceIndex, scanManifest } = prepareSource(novelDir, {
      windowLines: 20,
      overlapLines: 2
    });
    const windowIds = sourceIndex.windows.map(window => window.id);
    for (const pass of Object.values(scanManifest.passes)) {
      pass.completed_window_ids = windowIds;
    }
    scanManifest.chapter_summary_chapters = [1];
    writeJson(path.join(novelDir, 'build', 'scan-manifest.json'), scanManifest);

    const character = {
      id: 'char_main',
      name: '主角',
      importance: '核心',
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '主角' }]
    };
    const skill = {
      id: 'skill_bei_ming',
      name: '北冥神功',
      importance: '核心',
      description: '主角所修习的武功。',
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '北冥神功' }],
      field_source_refs: {
        description: [{ chapter: 1, line_start: 1, line_end: 1, text: sourceText }]
      }
    };
    const dialogue = {
      id: 'dialogue_1',
      speaker: 'char_main',
      speaker_name: '主角',
      text: '我练的是北冥神功。',
      chapter: 1,
      line_start: 1,
      line_end: 1,
      event_id: 'event_training',
      selection_type: 'both',
      selection_reason: '推动事件并体现人物自信',
      trait_tags: ['自信'],
      context: sourceText,
      context_line_start: 1,
      context_line_end: 1
    };
    writeJson(path.join(novelDir, 'data', 'characters.json'), [character]);
    writeJson(path.join(novelDir, 'data', 'skills.json'), [skill]);
    writeJson(path.join(novelDir, 'data', 'dialogues.json'), [dialogue]);
    const chapterSummary = {
      chapter: 1,
      title: '第一章',
      summary: '主角说明自己修习北冥神功。',
      key_events: ['主角说明所学'],
      key_characters: ['char_main'],
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: sourceText }],
      field_source_refs: {
        summary: [{ chapter: 1, line_start: 1, line_end: 1, text: sourceText }],
        key_events: [{ chapter: 1, line_start: 1, line_end: 1, text: sourceText }]
      }
    };
    writeJson(path.join(novelDir, 'data', 'chapter_summaries.json'), [chapterSummary]);
    for (const filename of ['factions.json', 'locations.json', 'techniques.json', 'items.json']) {
      writeJson(path.join(novelDir, 'data', filename), []);
    }
    writeJson(path.join(novelDir, 'build', 'events.json'), [{
      id: 'event_training',
      name: '主角说明所学',
      importance: 'main',
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: sourceText }],
      participants: ['char_main'],
      dialogue_ids: ['dialogue_1']
    }]);
    writeJson(path.join(novelDir, 'build', 'gap-audit.json'), {
      rounds: [{ round: 1, completed_window_ids: windowIds, new_candidate_ids: [] }]
    });

    const candidates = [
      ['cand_ch001_w001_0001', 'character', '主角', 'char_main'],
      ['cand_ch001_w001_0002', 'skill', '北冥神功', 'skill_bei_ming'],
      ['cand_ch001_w001_0003', 'event', '主角说明所学', 'event_training'],
      ['cand_ch001_w001_0004', 'dialogue', '主角：我练的是北冥神功', 'dialogue_1']
    ].map(([candidate_id, category_hint, name, final_id]) => ({
      candidate_id,
      category_hint,
      name,
      chapter: 1,
      source_ref: { line_start: 1, line_end: 1, text: sourceText },
      discovery_pass: category_hint === 'event' || category_hint === 'dialogue'
        ? 'event-dialogue'
        : 'named-inventory',
      window_id: 'ch001_w001',
      final_id
    }));
    fs.writeFileSync(
      path.join(novelDir, 'build', 'candidates.jsonl'),
      `${candidates.map(item => JSON.stringify(item)).join('\n')}\n`
    );
    fs.writeFileSync(
      path.join(novelDir, 'build', 'decisions.jsonl'),
      `${candidates.map(candidate => JSON.stringify({
        candidate_ids: [candidate.candidate_id],
        decision: 'keep',
        canonical_name: candidate.name,
        final_category: candidate.category_hint,
        importance: 'important',
        reason: '原文可证',
        final_id: candidate.final_id
      })).join('\n')}\n`
    );
    writeJson(path.join(novelDir, 'reports', 'verification_report.json'), {
      grand_total: { entities: 2, refs: 2, grounded: 2, weak: 0, unverified: 0 },
      grand_grounded_ratio: 1
    });
    writeJson(path.join(novelDir, 'reports', 'cross_validation_report.json'), {
      summary: { total: 0, errors: 0, warnings: 0, info: 0 },
      issues: []
    });

    const report = assessQuality(novelDir);
    assert.equal(report.completion_gate_passed, true);
    assert.ok(Object.values(report.gates).every(gate => gate.passed));
    assert.equal(report.gates.G4.details.category_decisions.skill.kept.length, 1);

    const originalFile = path.join(novelDir, `${path.basename(novelDir)}.txt`);
    fs.unlinkSync(originalFile);
    const missingOriginal = assessQuality(novelDir);
    assert.equal(missingOriginal.gates.G1.passed, false);
    assert.ok(missingOriginal.gates.G1.reasons.some(reason => reason.includes('original novel source')));
    fs.writeFileSync(originalFile, sourceText);

    delete dialogue.context;
    writeJson(path.join(novelDir, 'data', 'dialogues.json'), [dialogue]);
    const missingDialogueContext = assessQuality(novelDir);
    assert.equal(missingDialogueContext.gates.G5.passed, false);
    assert.ok(missingDialogueContext.gates.G5.reasons.some(reason => reason.includes('context')));
    dialogue.context = sourceText;
    writeJson(path.join(novelDir, 'data', 'dialogues.json'), [dialogue]);

    dialogue.context = '主角说道：“我练的是凌波微步。”';
    writeJson(path.join(novelDir, 'data', 'dialogues.json'), [dialogue]);
    const fabricatedDialogueContext = assessQuality(novelDir);
    assert.equal(fabricatedDialogueContext.gates.G3.passed, false);
    assert.ok(fabricatedDialogueContext.gates.G3.reasons.some(reason =>
      reason.includes('dialogue_1.context')
    ));
    dialogue.context = sourceText;
    writeJson(path.join(novelDir, 'data', 'dialogues.json'), [dialogue]);

    chapterSummary.key_events = [];
    writeJson(path.join(novelDir, 'data', 'chapter_summaries.json'), [chapterSummary]);
    const emptySummaryEvents = assessQuality(novelDir);
    assert.equal(emptySummaryEvents.gates.G1.passed, false);
    assert.ok(emptySummaryEvents.gates.G1.reasons.some(reason => reason.includes('key_events')));
    chapterSummary.key_events = ['主角说明所学'];
    writeJson(path.join(novelDir, 'data', 'chapter_summaries.json'), [chapterSummary]);

    const chapterSummaryFieldRefs = chapterSummary.field_source_refs;
    delete chapterSummary.field_source_refs;
    writeJson(path.join(novelDir, 'data', 'chapter_summaries.json'), [chapterSummary]);
    const missingSummaryEvidence = assessQuality(novelDir);
    assert.equal(missingSummaryEvidence.gates.G3.passed, false);
    assert.ok(missingSummaryEvidence.gates.G3.reasons.some(reason =>
      reason.includes('chapter_summary:1.summary')
    ));
    chapterSummary.field_source_refs = chapterSummaryFieldRefs;
    writeJson(path.join(novelDir, 'data', 'chapter_summaries.json'), [chapterSummary]);

    delete skill.field_source_refs;
    writeJson(path.join(novelDir, 'data', 'skills.json'), [skill]);
    const missingDescriptionEvidence = assessQuality(novelDir);
    assert.equal(missingDescriptionEvidence.gates.G3.passed, false);
    assert.ok(missingDescriptionEvidence.gates.G3.reasons.some(reason =>
      reason.includes('skill_bei_ming.description')
    ));
  } finally {
    fs.rmSync(novelDir, { recursive: true, force: true });
  }
});
