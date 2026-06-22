const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.join(__dirname, 'merge-entities.js');

test('normalizes semantic aliases before writing entity registry', () => {
  const novelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-entities-'));
  const batchDir = path.join(novelDir, 'batch_json');
  fs.mkdirSync(batchDir, { recursive: true });

  fs.writeFileSync(path.join(novelDir, 'entity_registry.json'), JSON.stringify({
    characters: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    items: [],
  }, null, 2));

  fs.writeFileSync(path.join(batchDir, 'ch_001.json'), JSON.stringify({
    chapter: 1,
    chapter_summary: '测试章节',
    dialogues: [],
    new_entities: {
      characters: [{
        id: 'char_li_xun_huan',
        name: '李寻欢',
        power_rank: '返璞归真',
        importance: '主角',
        source_refs: [{ chapter: 1, line_start: 1, line_end: 2, text: '李寻欢出手。' }],
      }],
      skills: [{
        id: 'skill_xiao_li_fei_dao',
        name: '小李飞刀',
        mastery_rank: '登峰造极',
        source_refs: [{ chapter: 1, line_start: 1, line_end: 2, text: '小李飞刀例不虚发。' }],
      }],
      techniques: [],
      factions: [],
      locations: [],
      items: [{
        id: 'item_fei_dao',
        name: '飞刀',
        rarity_tier: '绝世神兵',
        source_refs: [{ chapter: 1, line_start: 1, line_end: 2, text: '飞刀薄如柳叶。' }],
      }],
    },
    entity_updates: [],
  }, null, 2));

  execFileSync(process.execPath, [scriptPath, novelDir], { encoding: 'utf8' });
  const registry = JSON.parse(fs.readFileSync(path.join(novelDir, 'entity_registry.json'), 'utf8'));

  assert.equal(registry.characters[0].rank, '返璞归真');
  assert.equal(registry.skills[0].rank, '登峰造极');
  assert.equal(registry.items[0].rarity, '绝世神兵');
});
