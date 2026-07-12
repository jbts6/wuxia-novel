#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildSourceIndex,
  hashText,
  matchCompleteCitation,
  normalizeNewlines
} = require('../scripts/lib/source');
const {
  deduplicateCandidateOccurrences,
  parseJsonl,
  validateCandidate,
  validateDecision,
  validateLedgerClosure
} = require('../scripts/lib/ledger');
const { verifyDialogues } = require('../scripts/verify_dialogues');
const { extractLexicalSignals } = require('../scripts/audit-recall');
const { prepareSource } = require('../scripts/prepare-source');
const {
  validateCandidateSourceRefs,
  validateEventGraph
} = require('../scripts/validate-inventory');

function withNovel(chapters, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-kb-source-'));
  const splitDir = path.join(root, 'ch_split');
  fs.mkdirSync(splitDir, { recursive: true });
  chapters.forEach((text, index) => {
    fs.writeFileSync(
      path.join(splitDir, `ch_${String(index + 1).padStart(3, '0')}.txt`),
      text
    );
  });

  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('source infrastructure', () => {
  it('normalizes CRLF before hashing', () => {
    assert.equal(normalizeNewlines('甲\r\n乙\r丙'), '甲\n乙\n丙');
    assert.equal(hashText('甲\r\n乙'), hashText('甲\n乙'));
  });

  it('builds stable overlapping windows with chapter-local line numbers', () => {
    withNovel(['一\r\n二\r\n三\r\n四\r\n五', '甲\n乙'], root => {
      const index = buildSourceIndex(root, { windowLines: 3, overlapLines: 1 });
      assert.match(index.source_hash, /^[a-f0-9]{64}$/);
      assert.equal(index.chapters.length, 2);
      assert.deepEqual(
        index.windows.map(window => [window.id, window.chapter, window.line_start, window.line_end]),
        [
          ['ch001_w001', 1, 1, 3],
          ['ch001_w002', 1, 3, 5],
          ['ch002_w001', 2, 1, 2]
        ]
      );

      const changed = buildSourceIndex(root, { windowLines: 3, overlapLines: 1 });
      assert.equal(changed.source_hash, index.source_hash);
      fs.appendFileSync(path.join(root, 'ch_split', 'ch_002.txt'), '\n丙');
      assert.notEqual(
        buildSourceIndex(root, { windowLines: 3, overlapLines: 1 }).source_hash,
        index.source_hash
      );
    });
  });

  it('detects chapter splits that no longer align with the original text', () => {
    withNovel(['原文第一章。'], root => {
      fs.writeFileSync(path.join(root, `${path.basename(root)}.txt`), '原文第一章。');
      assert.equal(buildSourceIndex(root).source_alignment_valid, true);
      fs.writeFileSync(path.join(root, 'ch_split', 'ch_001.txt'), '被改写的第一章。');
      assert.equal(buildSourceIndex(root).source_alignment_valid, false);
    });
  });

  it('preserves completed scan windows on an idempotent prepare rerun', () => {
    withNovel(['原文第一章。'], root => {
      const first = prepareSource(root, { windowLines: 20, overlapLines: 2 });
      first.scanManifest.passes['named-inventory'].completed_window_ids = ['ch001_w001'];
      fs.writeFileSync(
        path.join(root, 'build', 'scan-manifest.json'),
        JSON.stringify(first.scanManifest)
      );

      const second = prepareSource(root, { windowLines: 20, overlapLines: 2 });
      assert.deepEqual(
        second.scanManifest.passes['named-inventory'].completed_window_ids,
        ['ch001_w001']
      );

      fs.writeFileSync(path.join(root, 'ch_split', 'ch_001.txt'), '原文已经改变。');
      const changed = prepareSource(root, { windowLines: 20, overlapLines: 2 });
      assert.deepEqual(changed.scanManifest.passes['named-inventory'].completed_window_ids, []);
    });
  });

  it('requires the complete normalized citation instead of a matching prefix', () => {
    const lines = ['段誉说道：“我不学武功。”', '木婉清冷笑一声。'];
    const exact = matchCompleteCitation(lines, '段誉说道：“我不学武功。”');
    assert.equal(exact.matched, true);
    assert.deepEqual([exact.line_start, exact.line_end], [1, 1]);

    assert.equal(
      matchCompleteCitation(lines, '段誉说道：“我不学武功。”这句并不存在').matched,
      false
    );
    assert.equal(matchCompleteCitation(lines, '段誉说道').matched, true);
  });

  it('rejects a dialogue whose prefix is real but whose full text is fabricated', () => {
    withNovel(['此处有一段真实的开头，但原文后半句完全不同。'], root => {
      const dataDir = path.join(root, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      const dialogueFile = path.join(dataDir, 'dialogues.json');
      fs.writeFileSync(dialogueFile, JSON.stringify([{
        chapter: 1,
        line_start: 1,
        line_end: 1,
        text: '此处有一段真实的开头，但这是伪造的后半句。'
      }]));

      const result = verifyDialogues(dialogueFile);
      assert.equal(result.grounded, 0);
      assert.equal(result.unverified, 1);
    });
  });
});

describe('candidate and decision ledger', () => {
  const candidates = [
    {
      candidate_id: 'cand_ch001_w001_0001',
      category_hint: 'skill',
      name: '躺尸剑法',
      chapter: 1,
      source_ref: { line_start: 1, line_end: 1, text: '躺尸剑法' },
      discovery_pass: 'named-inventory',
      window_id: 'ch001_w001'
    },
    {
      candidate_id: 'cand_ch001_w001_0002',
      category_hint: 'item',
      name: '铁锁',
      chapter: 1,
      source_ref: { line_start: 2, line_end: 2, text: '铁锁' },
      discovery_pass: 'named-inventory',
      window_id: 'ch001_w001'
    }
  ];

  it('reports malformed JSONL with its line number', () => {
    assert.throws(() => parseJsonl('{"ok":true}\n{bad}\n', 'candidates.jsonl'), /line 2/i);
  });

  it('requires stable candidate IDs and exact source-grounded candidate refs', () => {
    const malformed = { ...candidates[0], candidate_id: 'skill_1' };
    assert.ok(validateCandidate(malformed).some(error => error.includes('candidate_id')));

    const sourceIndex = {
      windows: [{ id: 'ch001_w001', chapter: 1, line_start: 1, line_end: 1 }]
    };
    const chapters = new Map([[1, ['原文只有真实的前半句。']]]);
    const errors = validateCandidateSourceRefs([{
      ...candidates[0],
      source_ref: { line_start: 1, line_end: 1, text: '原文只有真实的前半句，但后面是伪造。' }
    }], sourceIndex, chapters);
    assert.ok(errors.some(error => error.includes('not found')));
  });

  it('deduplicates overlap hits while preserving every occurrence and pass', () => {
    const duplicate = {
      ...candidates[0],
      candidate_id: 'cand_ch001_w002_0001',
      window_id: 'ch001_w002',
      discovery_pass: 'gap-audit'
    };
    const groups = deduplicateCandidateOccurrences([candidates[0], duplicate, candidates[1]]);
    const skillGroup = groups.find(group => group.name === '躺尸剑法');

    assert.deepEqual(skillGroup.candidate_ids, [
      'cand_ch001_w001_0001',
      'cand_ch001_w002_0001'
    ]);
    assert.equal(skillGroup.occurrences.length, 2);
    assert.deepEqual(skillGroup.discovery_passes, ['gap-audit', 'named-inventory']);
  });

  it('fails unresolved candidates', () => {
    const result = validateLedgerClosure(candidates, [{
      candidate_ids: ['cand_ch001_w001_0001'],
      decision: 'keep',
      canonical_name: '躺尸剑法',
      final_category: 'skill',
      importance: 'important',
      reason: '原文明确定名',
      final_id: 'skill_tang_shi_jian_fa'
    }], { finalIds: new Set(['skill_tang_shi_jian_fa']) });

    assert.equal(result.passed, false);
    assert.deepEqual(result.unresolved_candidate_ids, ['cand_ch001_w001_0002']);
  });

  it('forbids importance-based rejection of named skills and techniques', () => {
    const result = validateLedgerClosure([candidates[0]], [{
      candidate_ids: ['cand_ch001_w001_0001'],
      decision: 'reject',
      reason: 'non_major'
    }]);

    assert.equal(result.passed, false);
    assert.ok(result.errors.some(error => error.includes('non_major')));
  });

  it('requires retained candidates to resolve to an existing final ID', () => {
    const decisions = candidates.map((candidate, index) => ({
      candidate_ids: [candidate.candidate_id],
      decision: index === 0 ? 'keep' : 'reject',
      canonical_name: candidate.name,
      final_category: candidate.category_hint,
      importance: 'important',
      reason: index === 0 ? '原文明确定名' : 'trivial',
      final_id: index === 0 ? 'skill_missing' : undefined
    }));
    const result = validateLedgerClosure(candidates, decisions, { finalIds: new Set() });

    assert.equal(result.passed, false);
    assert.ok(result.errors.some(error => error.includes('skill_missing')));
  });

  it('requires final IDs to match their declared category and pinyin format', () => {
    const base = {
      candidate_ids: ['cand_ch001_w001_0001'],
      decision: 'keep',
      canonical_name: '左子穆',
      final_category: 'character',
      importance: 'important',
      reason: '原文明确定名'
    };

    assert.ok(validateDecision({ ...base, final_id: 'char_左子穆' }).some(error =>
      error.includes('does not match final_category')
    ));
    assert.ok(validateDecision({ ...base, final_id: 'skill_zuo_zi_mu' }).some(error =>
      error.includes('does not match final_category')
    ));
    assert.deepEqual(validateDecision({ ...base, final_id: 'char_zuo_zi_mu' }), []);
  });

  it('accepts structured AI review status on a decision', () => {
    const errors = validateDecision({
      candidate_ids: ['cand_ch001_w001_0002'],
      decision: 'reject',
      reason: 'trivial',
      ai_review: { status: 'confirmed' }
    });

    assert.deepEqual(errors, []);
  });

  it('validates event, dialogue, participant, and exemption IDs as one graph', () => {
    withNovel(['左子穆说道：“住手。”'], root => {
      fs.mkdirSync(path.join(root, 'data'), { recursive: true });
      fs.mkdirSync(path.join(root, 'build'), { recursive: true });
      fs.writeFileSync(path.join(root, 'data', 'characters.json'), JSON.stringify([
        { id: 'char_zuo_zi_mu' }
      ]));
      fs.writeFileSync(path.join(root, 'data', 'dialogues.json'), JSON.stringify([{
        id: 'dialogue_zuo_zi_mu_he_zhi',
        selection_type: 'event',
        event_id: 'event_zuo_zi_mu_he_zhi'
      }]));
      fs.writeFileSync(path.join(root, 'build', 'events.json'), JSON.stringify([{
        id: 'event_zuo_zi_mu_he_zhi',
        name: '左子穆喝止众人',
        importance: 'main',
        source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '左子穆说道：“住手。”' }],
        participants: ['char_左子穆'],
        dialogue_ids: ['dialogue_1']
      }]));
      fs.writeFileSync(path.join(root, 'build', 'semantic-exemptions.json'), JSON.stringify({
        main_events: [],
        personas: [{ id: 'char_左子穆', reason: '测试非法 ID' }]
      }));

      const result = validateEventGraph(root);
      assert.equal(result.passed, false);
      assert.ok(result.errors.some(error => error.includes('participants[0]') && error.includes('invalid character ID')));
      assert.ok(result.errors.some(error => error.includes('dialogue_ids[0]') && error.includes('invalid dialogue ID')));
      assert.ok(result.errors.some(error => error.includes('personas[0].id') && error.includes('invalid character ID')));
    });
  });

  it('requires retained decisions to record reconciliation and enrichment intent', () => {
    const errors = validateDecision({
      candidate_ids: ['cand_ch001_w001_0001'],
      decision: 'keep',
      final_category: 'skill',
      final_id: 'skill_tang_shi_jian_fa'
    });

    assert.ok(errors.some(error => error.includes('canonical_name')));
    assert.ok(errors.some(error => error.includes('importance')));
    assert.ok(errors.some(error => error.includes('reason')));
  });

  it('rejects an unknown AI review status', () => {
    const errors = validateDecision({
      candidate_ids: ['cand_ch001_w001_0002'],
      decision: 'reject',
      reason: 'trivial',
      ai_review: { status: 'maybe' }
    });

    assert.ok(errors.some(error => error.includes('ai_review.status')));
  });
});

describe('deterministic recall signals', () => {
  it('keeps named martial arts while ignoring generic martial narration', () => {
    const signals = extractLexicalSignals({ windows: [{
      id: 'ch001_w001',
      chapter: 1,
      line_start: 1,
      text: [
        '这套剑法变化很快，两人剑法各有千秋。',
        '这门武功名为北冥神功。',
        '后来又谈到北冥神功的修炼法门。'
      ].join('\n')
    }] });

    assert.ok(signals.some(signal => signal.text === '北冥神功'));
    assert.ok(signals.every(signal => !['这套剑法', '两人剑法'].includes(signal.text)));
  });
});
