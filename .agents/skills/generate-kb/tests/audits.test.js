#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateEvidenceIntegrity,
  evaluateSemanticCoverage
} = require('../scripts/lib/audits');

function finalData(recordsByFile = {}) {
  return {
    missing_data_files: [],
    invalid_data_files: [],
    schema_errors: [],
    enrichment_errors: [],
    final_data_hash: 'final-hash',
    records_by_file: {
      'characters.json': [],
      'factions.json': [],
      'locations.json': [],
      'skills.json': [],
      'techniques.json': [],
      'items.json': [],
      'dialogues.json': [],
      'chapter_summaries.json': [],
      ...recordsByFile
    }
  };
}

describe('pure legacy evidence and semantic audits', () => {
  it('rejects an empty evidence check set instead of vacuously passing', () => {
    const report = evaluateEvidenceIntegrity({
      chapters: new Map(),
      finalData: finalData(),
      events: [],
      verification: {
        final_data_hash: 'final-hash',
        file_errors: [],
        grand_total: { weak: 0, unverified: 0 },
        grand_grounded_ratio: 1
      }
    });

    assert.deepEqual(report.evidence_non_vacuity_errors, [
      'no entities, events, chapter summaries, or dialogues were available for evidence checks'
    ]);
  });

  it('rejects a generic persona exemption in the pure semantic audit', () => {
    const report = evaluateSemanticCoverage({
      finalData: finalData({
        'characters.json': [{ id: 'char_xu_zhu', name: '虚竹', importance: '核心' }],
        'dialogues.json': [{
          id: 'dialogue_event',
          speaker: 'char_xu_zhu',
          speaker_name: '虚竹',
          selection_type: 'event',
          selection_reason: '这句话直接推动主要事件的冲突。',
          context: '虚竹当时面对群雄追问。',
          context_line_start: 1,
          context_line_end: 1,
          event_id: 'event_one'
        }]
      }),
      events: [{ id: 'event_one', importance: 'main' }],
      eventsPresent: true,
      exemptions: {
        personas: [{ id: 'char_xu_zhu', reason: '没有关联对白' }]
      },
      crossValidation: {
        final_data_hash: 'final-hash',
        summary: { errors: 0 }
      }
    });

    assert.deepEqual(report.personas_missing_dialogue, ['char_xu_zhu']);
    assert.ok(report.blocking_schema_errors.some(error =>
      error.includes('persona exemption char_xu_zhu') && error.includes('specific evidence')
    ));
  });
});
