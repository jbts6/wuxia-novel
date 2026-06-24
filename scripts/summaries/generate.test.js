#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateDetailedSummaries } = require('./generate');

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function makeNovelDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-summary-'));
  fs.mkdirSync(path.join(dir, 'archive/reports'), { recursive: true });
  writeJson(path.join(dir, 'characters.json'), [
    { id: 'duan_yu', name: '段誉', role: '核心', identity: '大理世子', faction: '大理段氏', one_line: '误入江湖的主角。' },
  ]);
  writeJson(path.join(dir, 'items.json'), [
    { id: 'wine_item', name: '竹叶青', type: 'wine', rarity_tier: '寻常凡品', one_line: '酒。' },
    { id: 'mask_item', name: '黑布面具', type: '面具', rarity_tier: '寻常凡品', one_line: '用于遮掩身份。' },
    { id: 'sword_item', name: '青锋剑', type: '兵器', rarity_tier: '上乘佳品', owner: 'duan_yu' },
  ]);
  writeJson(path.join(dir, 'archive/reports/items.pending.json'), [
    { id: 'wine_item', reason: 'type_not_in_map', value: 'wine' },
    { id: 'mask_item', reason: 'type_not_in_map', value: '面具' },
  ]);
  writeJson(path.join(dir, 'factions.json'), [
    { id: 'dali', name: '大理段氏', type: '王族', location: '大理', leader: '段正明', one_line: '大理皇族。' },
  ]);
  writeJson(path.join(dir, 'locations.json'), [
    { id: 'dali_palace', name: '大理皇宫', region: '大理', type: '宫殿', one_line: '大理权力中心。' },
  ]);
  writeJson(path.join(dir, 'skills.json'), [
    { id: 'bei_ming', name: '北冥神功', type: '内功', category: 'internal', one_line: '吸纳内力。' },
  ]);
  writeJson(path.join(dir, 'techniques.json'), [
    { id: 'bei_ming_absorb', name: '北冥吸力', type: 'internal', source_skill: 'bei_ming', effect: '吸取内力' },
  ]);
  return dir;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err.stack || err.message);
    process.exitCode = 1;
  }
}

test('generates detailed summaries with names and readable item decisions', () => {
  const novelDir = makeNovelDir();
  generateDetailedSummaries(novelDir);

  const items = read(path.join(novelDir, 'items_summary.md'));
  assert(items.includes('| 竹叶青 | 酒。 | wine | 改类型为 `食物` | 英文 wine 表示酒，通常归入食物；若只是普通酒且无剧情作用，可删除。 |'));
  assert(items.includes('| 黑布面具 | 用于遮掩身份。 | 面具 | 保留，建议改类型为 `饰品` 或 `工具` | 面具通常有身份遮掩作用；无剧情作用时再删。 |'));
  assert(items.includes('| 青锋剑 |  | 兵器 | 上乘佳品 | 段誉 |'));

  const characters = read(path.join(novelDir, 'characters_summary.md'));
  assert(characters.includes('| 段誉 | 误入江湖的主角。 | 核心 | 大理世子 | 大理段氏 |'));

  const skills = read(path.join(novelDir, 'skills_summary.md'));
  assert(skills.includes('| 北冥神功 | 吸纳内力。 | 内功 | 1 |'));

  const techniques = read(path.join(novelDir, 'techniques_summary.md'));
  assert(techniques.includes('| 北冥吸力 | 吸取内力 | 北冥神功 | internal |'));
});
