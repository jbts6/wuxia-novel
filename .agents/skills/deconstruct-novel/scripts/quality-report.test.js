const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildQualityReport } = require('./quality-report');

const scriptPath = path.join(__dirname, 'quality-report.js');

function makeNovelDir() {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-report-'));
  fs.mkdirSync(path.join(novelDir, 'batch_json'), { recursive: true });
  return novelDir;
}

function writeRegistry(novelDir, registry) {
  fs.writeFileSync(path.join(novelDir, 'entity_registry.json'), JSON.stringify(registry, null, 2), 'utf8');
}

test('reports human-facing placeholders and weak raw extraction data', () => {
  const novelDir = makeNovelDir();
  writeRegistry(novelDir, {
    characters: [{
      id: 'char_hei_yi_ren',
      name: '黑衣人',
      power_rank: '平平无奇',
      importance: '龙套',
      one_line: '未知',
      personality: { traits: ['沉默'] },
      source_refs: [{ chapter: 1, line_start: 1, line_end: 1, text: '他' }],
    }],
    skills: [{
      id: 'skill_jian_fa',
      name: '剑法',
      mastery_rank: '初窥门径',
      one_line: '剑法',
      source_refs: [{ chapter: 1, line_start: 2, line_end: 2, text: '剑法' }],
    }],
    techniques: [{
      id: 'tech_jian_fa_bian_hua',
      name: '剑法变化',
      type: 'attack',
      description: '剑法的代表性变化：刺出',
      source_skill: 'skill_jian_fa',
      source_refs: [{ chapter: 1, line_start: 3, line_end: 3, text: '刺出' }],
    }],
    factions: [],
    locations: [],
    items: [{
      id: 'item_unknown',
      name: '???',
      type: 'weapon',
      one_line: 'unknown weapon?',
      description: 'weapon?',
      rarity_tier: '未知',
      source_refs: [{ chapter: 1, line_start: 4, line_end: 4, text: '物' }],
    }],
  });

  fs.writeFileSync(path.join(novelDir, 'dialogues.json'), JSON.stringify([
    { speaker: null, speaker_name: '黑衣人', text: '你是谁？', tone: '疑问', chapter: 1, line_start: 5, line_end: 5 },
  ], null, 2), 'utf8');

  const report = buildQualityReport(novelDir);
  const categories = new Set(report.issues.map((issue) => issue.category));

  assert.ok(categories.has('human_field_placeholder'));
  assert.ok(categories.has('generic_character_name'));
  assert.ok(categories.has('short_item_description'));
  assert.ok(categories.has('invalid_item_type'));
  assert.ok(categories.has('templated_technique_description'));
  assert.ok(categories.has('dialogue_missing_speaker'));
});

test('cli writes markdown and json reports', () => {
  const novelDir = makeNovelDir();
  writeRegistry(novelDir, {
    characters: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    items: [],
  });

  execFileSync(process.execPath, [scriptPath, novelDir], { encoding: 'utf8' });

  assert.ok(fs.existsSync(path.join(novelDir, 'deconstruct_report.json')));
  assert.ok(fs.existsSync(path.join(novelDir, 'deconstruct_report.md')));
});
