const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { migratePath } = require('./semantic-fields');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-fields-'));
}

test('dry-run reports changes without writing files', () => {
  const root = tempDir();
  const book = path.join(root, '金庸', '测试书');
  fs.mkdirSync(book, { recursive: true });
  const file = path.join(book, 'skills.json');
  fs.writeFileSync(file, JSON.stringify([{ id: 'skill_x', name: '武功', rank: '8' }], null, 2));

  const report = migratePath(book, { dryRun: true });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.equal(after[0].mastery_rank, undefined);
  assert.equal(report.changedFiles, 1);
  assert.equal(report.entitiesChanged.skills, 1);
});

test('writes canonical fields and preserves legacy values', () => {
  const root = tempDir();
  const book = path.join(root, '古龙', '测试书');
  fs.mkdirSync(book, { recursive: true });
  fs.writeFileSync(path.join(book, 'characters.json'), JSON.stringify([{ id: 'char_x', name: '角色', rank: '主要人物' }], null, 2));
  fs.writeFileSync(path.join(book, 'items.json'), JSON.stringify([{ id: 'item_x', name: '物品', rarity: 'rare' }], null, 2));

  const report = migratePath(book, { dryRun: false });
  const chars = JSON.parse(fs.readFileSync(path.join(book, 'characters.json'), 'utf8'));
  const items = JSON.parse(fs.readFileSync(path.join(book, 'items.json'), 'utf8'));

  assert.equal(chars[0].power_rank, '平平无奇');
  assert.equal(chars[0].importance, '主要人物');
  assert.equal(chars[0].legacy_rank, '主要人物');
  assert.equal(items[0].rarity_tier, '稀世珍品');
  assert.equal(items[0].legacy_rarity, 'rare');
  assert.equal(report.changedFiles, 2);
});

test('invalid json is reported without stopping other files', () => {
  const root = tempDir();
  const book = path.join(root, '梁羽生', '测试书');
  fs.mkdirSync(book, { recursive: true });
  fs.writeFileSync(path.join(book, 'skills.json'), '{bad json');
  fs.writeFileSync(path.join(book, 'items.json'), JSON.stringify([{ id: 'item_x', name: '物品', rarity: 'common' }]));

  const report = migratePath(book, { dryRun: true });

  assert.equal(report.errors.length, 1);
  assert.equal(report.entitiesChanged.items, 1);
});
