# Semantic Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split overloaded `rank` / `rarity` data into canonical semantic fields, migrate existing source JSON with audit preservation, and switch dashboard filters/export to the new fields.

**Architecture:** Add one shared CommonJS semantic-field module under the `deconstruct-novel` scripts so validators, merge logic, and migration tooling use the same constants and mapping policy. Keep legacy `rank` / `rarity` as compatibility aliases while making `mastery_rank`, `power_rank`, `importance`, and `rarity_tier` the canonical fields for validation, dashboard filtering, and export.

**Tech Stack:** Node.js CommonJS scripts and `node --test` for migration/validator tests; React + TypeScript + Vitest for dashboard changes; existing `.agents/skills/deconstruct-novel` docs and scripts for extraction contracts.

---

## File Structure

- Create: `.agents/skills/deconstruct-novel/scripts/semantic-fields.js`
  Shared constants, canonical value lists, migration mapping helpers, legacy synchronization helpers.
- Create: `.agents/skills/deconstruct-novel/scripts/semantic-fields.test.js`
  Node built-in tests for rank, importance, rarity, unknown-value audit behavior, and idempotent migration of in-memory entities.
- Create: `tools/normalize/semantic-fields.js`
  CLI migration script with `--dry-run`, `--root`, optional target paths, stable JSON writes, and summary reporting.
- Create: `tools/normalize/semantic-fields.test.js`
  Node built-in tests for file migration, dry-run behavior, report counts, and invalid JSON handling.
- Modify: `.agents/skills/deconstruct-novel/scripts/validators.js`
  Validate new canonical fields and legacy alias consistency.
- Create: `.agents/skills/deconstruct-novel/scripts/validators.test.js`
  Node built-in tests for accepted canonical entities and rejected invalid fields.
- Modify: `.agents/skills/deconstruct-novel/scripts/merge-entities.js`
  Normalize new entities and updates before writing `entity_registry.json`.
- Modify: `.agents/skills/deconstruct-novel/constants.md`
  Document shared rank sequence, item rarity tiers, character importance, and legacy alias policy.
- Modify: `.agents/skills/deconstruct-novel/schemas.md`
  Require canonical fields in entity registry and chapter output.
- Modify: `.agents/skills/deconstruct-novel/subagent-template.md`
  Instruct extractors to emit new fields and not overload legacy fields.
- Modify: `dashboard/src/types/novel.ts`
  Add canonical fields and legacy audit fields to `Skill`, `Character`, and `Item`.
- Modify: `dashboard/src/types/library.ts`
  Replace generic `rank` / `rarity` filters with type-first and semantic filters.
- Modify: `dashboard/src/utils/libraryAggregate.ts`
  Use `mastery_rank` and `rarity_tier` for top-tier and legendary predicates.
- Modify: `dashboard/src/utils/libraryAggregate.test.ts`
  Cover canonical predicate fields and legacy fallback only where compatibility is intentional.
- Modify: `dashboard/src/utils/libraryFilters.ts`
  Add type-first filter shape and filter by `mastery_rank`, `power_rank`, `importance`, and `rarity_tier`.
- Modify: `dashboard/src/utils/libraryFilters.test.ts`
  Cover semantic filters and verify type-first filtering prevents cross-entity rank leakage.
- Modify: `dashboard/src/components/library/LibraryFilters.tsx`
  Show common filters first and only show semantic filters after material type selection.
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`
  Build section/type-specific filter options from canonical fields.
- Modify: `dashboard/src/components/library/LibraryRecordTable.tsx`
  Display canonical tags before legacy tags.
- Modify: `dashboard/src/components/library/LibraryDetailDrawer.tsx`
  Display canonical tags and audit legacy values when present.
- Modify: `dashboard/src/utils/libraryExport.ts`
  Export canonical columns and retain legacy columns for compatibility.
- Modify: `dashboard/src/utils/libraryExport.test.ts`
  Cover canonical CSV columns.
- Modify: `dashboard/src/hooks/useLibraryData.test.ts`
  Update fixtures to canonical fields.
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.test.tsx`
  Update mocked data and assert type-first filter labels.
- Modify: `dashboard/src/utils/graphHelper.ts`
  Color items by `rarity_tier` with legacy fallback.
- Modify: `dashboard/src/components/characters/CharacterList.tsx`
  Display `power_rank` with legacy fallback for selected-book character list.

---

### Task 1: Shared Semantic Field Module

**Files:**
- Create: `.agents/skills/deconstruct-novel/scripts/semantic-fields.js`
- Create: `.agents/skills/deconstruct-novel/scripts/semantic-fields.test.js`

- [ ] **Step 1: Write failing semantic mapping tests**

```javascript
// .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  RANK_VALUES,
  ITEM_RARITY_VALUES,
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
} = require('./semantic-fields');

test('rank values are ordered from weakest to strongest', () => {
  assert.deepEqual(RANK_VALUES, ['平平无奇', '初窥门径', '略有小成', '登堂入室', '炉火纯青', '出神入化', '登峰造极', '返璞归真']);
});

test('normalizes skill mastery from legacy rank and preserves original dirty value', () => {
  const skill = { id: 'skill_x', name: '小李飞刀', rank: 'top' };
  const result = normalizeSkill(skill);
  assert.equal(result.entity.mastery_rank, '登峰造极');
  assert.equal(result.entity.rank, '登峰造极');
  assert.equal(result.entity.legacy_rank, 'top');
  assert.equal(result.changed, true);
});

test('normalizes character power and importance from overloaded legacy rank', () => {
  const character = { id: 'char_x', name: '李寻欢', rank: '主要人物' };
  const result = normalizeCharacter(character);
  assert.equal(result.entity.power_rank, '平平无奇');
  assert.equal(result.entity.importance, '主要人物');
  assert.equal(result.entity.legacy_rank, '主要人物');
});

test('normalizes numeric power rank using the shared 1-8 order', () => {
  const character = { id: 'char_y', name: '扫地僧', rank: 8 };
  const result = normalizeCharacter(character);
  assert.equal(result.entity.power_rank, '返璞归真');
  assert.equal(result.entity.rank, '返璞归真');
});

test('normalizes item rarity and keeps unknown descriptive values auditable', () => {
  const rare = normalizeItem({ id: 'item_x', name: '宝刀', rarity: 'rare' });
  assert.equal(rare.entity.rarity_tier, '稀世珍品');
  assert.equal(rare.entity.rarity, '稀世珍品');
  assert.equal(rare.entity.legacy_rarity, 'rare');

  const unknown = normalizeItem({ id: 'item_y', name: '令牌', rarity: '危险' });
  assert.equal(unknown.entity.rarity_tier, '未知');
  assert.equal(unknown.entity.legacy_rarity, '危险');
  assert.ok(unknown.entity.migration_notes.includes('unresolved rarity: 危险'));
});

test('item rarity values include unknown fallback', () => {
  assert.deepEqual(ITEM_RARITY_VALUES, ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵', '未知']);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js`

Expected: FAIL with `Cannot find module './semantic-fields'`.

- [ ] **Step 3: Implement shared semantic field module**

```javascript
// .agents/skills/deconstruct-novel/scripts/semantic-fields.js
const RANK_VALUES = ['平平无奇', '初窥门径', '略有小成', '登堂入室', '炉火纯青', '出神入化', '登峰造极', '返璞归真'];
const CHARACTER_IMPORTANCE_VALUES = ['主角', '主要人物', '配角', '路人', '未知'];
const ITEM_RARITY_VALUES = ['寻常凡品', '上乘佳品', '稀世珍品', '绝世神兵', '未知'];

const DIRECT_RANK = new Set(RANK_VALUES);
const DIRECT_IMPORTANCE = new Set(CHARACTER_IMPORTANCE_VALUES);
const DIRECT_RARITY = new Set(ITEM_RARITY_VALUES);

const POWER_ALIASES = new Map([
  ['top', '登峰造极'],
  ['绝顶高手', '登峰造极'],
  ['绝顶', '登峰造极'],
  ['宗师', '登峰造极'],
  ['高手', '出神入化'],
  ['一流高手', '出神入化'],
  ['一流', '出神入化'],
  ['二流高手', '炉火纯青'],
  ['二流', '炉火纯青'],
  ['三流', '登堂入室'],
  ['普通', '平平无奇'],
  ['凡', '平平无奇'],
  ['不入流', '平平无奇'],
  ['未知', '平平无奇'],
]);

const IMPORTANCE_ALIASES = new Map([
  ['protagonist', '主角'],
  ['主角', '主角'],
  ['主要人物', '主要人物'],
  ['重要人物', '主要人物'],
  ['major', '主要人物'],
  ['companion', '主要人物'],
  ['配角', '配角'],
  ['minor', '配角'],
  ['npc', '配角'],
  ['villain', '配角'],
  ['路人', '路人'],
  ['群众', '路人'],
  ['unknown', '未知'],
  ['未知', '未知'],
]);

const RARITY_ALIASES = new Map([
  ['legendary', '绝世神兵'],
  ['绝世', '绝世神兵'],
  ['神兵', '绝世神兵'],
  ['绝世神兵', '绝世神兵'],
  ['rare', '稀世珍品'],
  ['稀有', '稀世珍品'],
  ['珍稀', '稀世珍品'],
  ['稀世', '稀世珍品'],
  ['稀世珍品', '稀世珍品'],
  ['uncommon', '上乘佳品'],
  ['上乘', '上乘佳品'],
  ['珍贵', '上乘佳品'],
  ['上乘佳品', '上乘佳品'],
  ['common', '寻常凡品'],
  ['普通', '寻常凡品'],
  ['寻常', '寻常凡品'],
  ['寻常凡品', '寻常凡品'],
]);

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function appendNote(entity, note) {
  const notes = Array.isArray(entity.migration_notes) ? entity.migration_notes : [];
  if (!notes.includes(note)) entity.migration_notes = [...notes, note];
}

function preserveLegacy(entity, field, legacyField, original, canonical) {
  const raw = clean(original);
  if (!raw || raw === canonical) return;
  if (!entity[legacyField]) entity[legacyField] = raw;
}

function rankFrom(value) {
  const raw = clean(value);
  if (DIRECT_RANK.has(raw)) return raw;
  if (/^[1-8]$/.test(raw)) return RANK_VALUES[Number(raw) - 1];
  return POWER_ALIASES.get(raw) || null;
}

function importanceFrom(value) {
  const raw = clean(value);
  if (DIRECT_IMPORTANCE.has(raw)) return raw;
  return IMPORTANCE_ALIASES.get(raw) || null;
}

function rarityFrom(value) {
  const raw = clean(value);
  if (DIRECT_RARITY.has(raw)) return raw;
  return RARITY_ALIASES.get(raw) || null;
}

function normalizeSkill(input) {
  const entity = { ...input };
  const original = entity.mastery_rank || entity.rank;
  const mapped = rankFrom(original) || '平平无奇';
  entity.mastery_rank = mapped;
  preserveLegacy(entity, 'rank', 'legacy_rank', entity.rank, mapped);
  entity.rank = mapped;
  if (!rankFrom(original)) appendNote(entity, `unresolved mastery rank: ${clean(original) || '<blank>'}`);
  return { entity, changed: JSON.stringify(entity) !== JSON.stringify(input) };
}

function normalizeCharacter(input) {
  const entity = { ...input };
  const rawRank = entity.power_rank || entity.rank;
  const rawImportance = entity.importance || entity.rank || entity.role;
  const mappedRank = rankFrom(rawRank) || '平平无奇';
  const mappedImportance = importanceFrom(rawImportance) || '未知';
  entity.power_rank = mappedRank;
  entity.importance = mappedImportance;
  preserveLegacy(entity, 'rank', 'legacy_rank', entity.rank, mappedRank);
  entity.rank = mappedRank;
  if (!rankFrom(rawRank)) appendNote(entity, `unresolved power rank: ${clean(rawRank) || '<blank>'}`);
  if (!importanceFrom(rawImportance)) appendNote(entity, `unresolved importance: ${clean(rawImportance) || '<blank>'}`);
  return { entity, changed: JSON.stringify(entity) !== JSON.stringify(input) };
}

function normalizeItem(input) {
  const entity = { ...input };
  const original = entity.rarity_tier || entity.rarity;
  const mapped = rarityFrom(original) || '未知';
  entity.rarity_tier = mapped;
  preserveLegacy(entity, 'rarity', 'legacy_rarity', entity.rarity, mapped);
  entity.rarity = mapped;
  if (!rarityFrom(original)) appendNote(entity, `unresolved rarity: ${clean(original) || '<blank>'}`);
  return { entity, changed: JSON.stringify(entity) !== JSON.stringify(input) };
}

module.exports = {
  RANK_VALUES,
  CHARACTER_IMPORTANCE_VALUES,
  ITEM_RARITY_VALUES,
  rankFrom,
  importanceFrom,
  rarityFrom,
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
};
```

- [ ] **Step 4: Run semantic mapping tests and verify GREEN**

Run: `node --test .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js`

Expected: PASS for all tests.

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add .agents/skills/deconstruct-novel/scripts/semantic-fields.js .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js
rtk git commit -m "feat: add semantic field normalizers"
```

---

### Task 2: Migration CLI

**Files:**
- Create: `tools/normalize/semantic-fields.js`
- Create: `tools/normalize/semantic-fields.test.js`

- [ ] **Step 1: Write failing migration CLI tests**

```javascript
// tools/normalize/semantic-fields.test.js
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
```

- [ ] **Step 2: Run migration tests and verify RED**

Run: `node --test tools/normalize/semantic-fields.test.js`

Expected: FAIL with `Cannot find module './semantic-fields'`.

- [ ] **Step 3: Implement migration CLI**

```javascript
// tools/normalize/semantic-fields.js
const fs = require('fs');
const path = require('path');
const {
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
} = require('../../.agents/skills/deconstruct-novel/scripts/semantic-fields');

const ENTITY_FILES = new Map([
  ['skills.json', { key: 'skills', normalize: normalizeSkill }],
  ['characters.json', { key: 'characters', normalize: normalizeCharacter }],
  ['items.json', { key: 'items', normalize: normalizeItem }],
]);

function createReport() {
  return {
    scannedFiles: 0,
    changedFiles: 0,
    entitiesChanged: { skills: 0, characters: 0, items: 0 },
    errors: [],
    files: [],
  };
}

function stableWrite(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function migrateArrayFile(file, config, options, report) {
  report.scannedFiles += 1;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    report.errors.push({ file, message: error.message });
    return;
  }
  if (!Array.isArray(data)) return;
  let changed = false;
  const next = data.map((entity) => {
    const result = config.normalize(entity);
    if (result.changed) {
      changed = true;
      report.entitiesChanged[config.key] += 1;
    }
    return result.entity;
  });
  if (changed) {
    report.changedFiles += 1;
    report.files.push(file);
    if (!options.dryRun) stableWrite(file, next);
  }
}

function migrateRegistryFile(file, options, report) {
  report.scannedFiles += 1;
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    report.errors.push({ file, message: error.message });
    return;
  }
  let changed = false;
  const next = { ...registry };
  for (const [fileName, config] of ENTITY_FILES) {
    const arr = registry[config.key];
    if (!Array.isArray(arr)) continue;
    next[config.key] = arr.map((entity) => {
      const result = config.normalize(entity);
      if (result.changed) {
        changed = true;
        report.entitiesChanged[config.key] += 1;
      }
      return result.entity;
    });
  }
  if (changed) {
    report.changedFiles += 1;
    report.files.push(file);
    if (!options.dryRun) stableWrite(file, next);
  }
}

function migrateBookDir(bookDir, options, report) {
  for (const [fileName, config] of ENTITY_FILES) {
    const file = path.join(bookDir, fileName);
    if (fs.existsSync(file)) migrateArrayFile(file, config, options, report);
  }
  const registry = path.join(bookDir, 'entity_registry.json');
  if (fs.existsSync(registry)) migrateRegistryFile(registry, options, report);
}

function findBookDirs(root) {
  const dirs = [];
  function walk(dir, depth) {
    if (depth > 3) return;
    const names = fs.readdirSync(dir);
    if (names.some((name) => ENTITY_FILES.has(name) || name === 'entity_registry.json')) {
      dirs.push(dir);
      return;
    }
    for (const name of names) {
      if (name.startsWith('.') || name === 'dashboard' || name === 'node_modules') continue;
      const child = path.join(dir, name);
      if (fs.existsSync(child) && fs.statSync(child).isDirectory()) walk(child, depth + 1);
    }
  }
  walk(root, 0);
  return dirs;
}

function migratePath(targetPath, options = {}) {
  const report = createReport();
  const dryRun = Boolean(options.dryRun);
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const directFiles = fs.readdirSync(targetPath);
    if (directFiles.some((name) => ENTITY_FILES.has(name) || name === 'entity_registry.json')) {
      migrateBookDir(targetPath, { dryRun }, report);
    } else {
      findBookDirs(targetPath).forEach((dir) => migrateBookDir(dir, { dryRun }, report));
    }
  }
  return report;
}

function parseArgs(argv) {
  const options = { dryRun: false, target: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--root') {
      options.target = argv[i + 1];
      i += 1;
    } else {
      options.target = arg;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = migratePath(path.resolve(options.target), options);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0) process.exitCode = 1;
}

module.exports = { migratePath, parseArgs };
```

- [ ] **Step 4: Run migration tests and verify GREEN**

Run: `node --test tools/normalize/semantic-fields.test.js`

Expected: PASS for all tests.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add tools/normalize/semantic-fields.js tools/normalize/semantic-fields.test.js
rtk git commit -m "feat: add semantic field migration cli"
```

---

### Task 3: Validator, Merge, And Extraction Contract

**Files:**
- Modify: `.agents/skills/deconstruct-novel/scripts/validators.js`
- Create: `.agents/skills/deconstruct-novel/scripts/validators.test.js`
- Modify: `.agents/skills/deconstruct-novel/scripts/merge-entities.js`
- Modify: `.agents/skills/deconstruct-novel/constants.md`
- Modify: `.agents/skills/deconstruct-novel/schemas.md`
- Modify: `.agents/skills/deconstruct-novel/subagent-template.md`

- [ ] **Step 1: Write failing validator tests**

```javascript
// .agents/skills/deconstruct-novel/scripts/validators.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const { validateEntityCollections } = require('./validators');

const ref = [{ chapter: 1, line_start: 1, line_end: 2, text: '原文' }];

test('accepts entities with canonical semantic fields', () => {
  const errors = validateEntityCollections({
    characters: [{ id: 'char_li_xun_huan', name: '李寻欢', power_rank: '返璞归真', importance: '主角', source_refs: ref }],
    skills: [{ id: 'skill_xiao_li_fei_dao', name: '小李飞刀', mastery_rank: '登峰造极', source_refs: ref }],
    techniques: [],
    factions: [],
    locations: [],
    items: [{ id: 'item_fei_dao', name: '飞刀', rarity_tier: '绝世神兵', source_refs: ref }],
  }, 'test');
  assert.deepEqual(errors, []);
});

test('rejects missing or invalid canonical fields', () => {
  const errors = validateEntityCollections({
    characters: [{ id: 'char_a_b', name: '阿宝', rank: '绝顶', source_refs: ref }],
    skills: [{ id: 'skill_a_b', name: '武功', mastery_rank: '绝顶高手', source_refs: ref }],
    techniques: [],
    factions: [],
    locations: [],
    items: [{ id: 'item_a_b', name: '宝物', rarity_tier: 'rare', source_refs: ref }],
  }, 'test');
  assert.ok(errors.some((line) => line.includes('power_rank')));
  assert.ok(errors.some((line) => line.includes('importance')));
  assert.ok(errors.some((line) => line.includes('mastery_rank')));
  assert.ok(errors.some((line) => line.includes('rarity_tier')));
});
```

- [ ] **Step 2: Run validator tests and verify RED**

Run: `node --test .agents/skills/deconstruct-novel/scripts/validators.test.js`

Expected: FAIL because current validators do not require semantic fields.

- [ ] **Step 3: Implement validator enum checks**

Add imports at the top of `validators.js`:

```javascript
const {
  RANK_VALUES,
  CHARACTER_IMPORTANCE_VALUES,
  ITEM_RARITY_VALUES,
} = require('./semantic-fields');
```

Add helper functions near the existing validation helpers:

```javascript
function validateEnum(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return [`${label}: 必须是 ${allowed.join(' / ')} 之一`];
  }
  return [];
}

function validateLegacyAlias(entity, legacyKey, canonicalKey, auditKey, label) {
  if (entity[legacyKey] === undefined || entity[legacyKey] === null) return [];
  if (entity[legacyKey] === entity[canonicalKey]) return [];
  if (entity[auditKey] === entity[legacyKey]) return [];
  return [`${label}.${legacyKey}: legacy alias 必须等于 ${canonicalKey} 或记录在 ${auditKey}`];
}
```

Inside `validateEntity`, add type-specific checks:

```javascript
if (type === 'characters') {
  errors.push(...validateEnum(entity.power_rank, RANK_VALUES, `${label}.power_rank`));
  errors.push(...validateEnum(entity.importance, CHARACTER_IMPORTANCE_VALUES, `${label}.importance`));
  errors.push(...validateLegacyAlias(entity, 'rank', 'power_rank', 'legacy_rank', label));
}

if (type === 'skills') {
  errors.push(...validateEnum(entity.mastery_rank, RANK_VALUES, `${label}.mastery_rank`));
  errors.push(...validateLegacyAlias(entity, 'rank', 'mastery_rank', 'legacy_rank', label));
}

if (type === 'items') {
  errors.push(...validateEnum(entity.rarity_tier, ITEM_RARITY_VALUES, `${label}.rarity_tier`));
  errors.push(...validateLegacyAlias(entity, 'rarity', 'rarity_tier', 'legacy_rarity', label));
}
```

- [ ] **Step 4: Normalize merged entities and updates**

In `merge-entities.js`, import the normalizers:

```javascript
const { normalizeSkill, normalizeCharacter, normalizeItem } = require('./semantic-fields');
```

Add helper:

```javascript
function normalizeEntityForType(type, entity) {
  if (type === 'skills') return normalizeSkill(entity).entity;
  if (type === 'characters') return normalizeCharacter(entity).entity;
  if (type === 'items') return normalizeItem(entity).entity;
  return entity;
}
```

Use it when adding new entities and after applying `update.updates`:

```javascript
const normalized = normalizeEntityForType(type, entity);
registry[type].push(normalized);
entityIndex[type].set(normalized.id, normalized);
```

```javascript
const normalized = normalizeEntityForType(entityType, entity);
Object.assign(entity, normalized);
```

- [ ] **Step 5: Run validator tests and verify GREEN**

Run: `node --test .agents/skills/deconstruct-novel/scripts/validators.test.js .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js`

Expected: PASS for both test files.

- [ ] **Step 6: Update extraction docs**

Edit `.agents/skills/deconstruct-novel/constants.md` to include:

```markdown
## Rank

| 顺序 | rank |
|------|------|
| 1 | 平平无奇 |
| 2 | 初窥门径 |
| 3 | 略有小成 |
| 4 | 登堂入室 |
| 5 | 炉火纯青 |
| 6 | 出神入化 |
| 7 | 登峰造极 |
| 8 | 返璞归真 |

`返璞归真` 最强。功法 `mastery_rank` 与角色 `power_rank` 都使用这条序列。

## 语义字段枚举

| 字段 | 允许值 |
|------|--------|
| `character.importance` | 主角 / 主要人物 / 配角 / 路人 / 未知 |
| `item.rarity_tier` | 寻常凡品 / 上乘佳品 / 稀世珍品 / 绝世神兵 / 未知 |
```

Edit `.agents/skills/deconstruct-novel/schemas.md` so character, skill, and item required field lists include:

```markdown
角色必填：`power_rank`、`importance`。`rank` 仅为兼容别名，不承载其它语义。
功法必填：`mastery_rank`。`rank` 仅为兼容别名，不承载其它语义。
物品必填：`rarity_tier`。`rarity` 仅为兼容别名，不承载其它语义。
```

Edit `.agents/skills/deconstruct-novel/subagent-template.md` to include:

```markdown
实体输出必须使用语义字段：功法写 `mastery_rank`，角色写 `power_rank` 与 `importance`，物品写 `rarity_tier`。不要把角色重要性、英文标签、数字评分或物品稀有度塞进 `rank`。
```

- [ ] **Step 7: Commit Task 3**

```bash
rtk git add .agents/skills/deconstruct-novel/scripts/validators.js .agents/skills/deconstruct-novel/scripts/validators.test.js .agents/skills/deconstruct-novel/scripts/merge-entities.js .agents/skills/deconstruct-novel/constants.md .agents/skills/deconstruct-novel/schemas.md .agents/skills/deconstruct-novel/subagent-template.md
rtk git commit -m "feat: enforce semantic fields in deconstruction"
```

---

### Task 4: Dashboard Canonical Field Consumption

**Files:**
- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/types/library.ts`
- Modify: `dashboard/src/utils/libraryAggregate.ts`
- Modify: `dashboard/src/utils/libraryAggregate.test.ts`
- Modify: `dashboard/src/utils/libraryFilters.ts`
- Modify: `dashboard/src/utils/libraryFilters.test.ts`
- Modify: `dashboard/src/components/library/LibraryFilters.tsx`
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`
- Modify: `dashboard/src/components/library/LibraryRecordTable.tsx`
- Modify: `dashboard/src/components/library/LibraryDetailDrawer.tsx`
- Modify: `dashboard/src/utils/libraryExport.ts`
- Modify: `dashboard/src/utils/libraryExport.test.ts`
- Modify: `dashboard/src/hooks/useLibraryData.test.ts`
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.test.tsx`
- Modify: `dashboard/src/utils/graphHelper.ts`
- Modify: `dashboard/src/components/characters/CharacterList.tsx`

- [ ] **Step 1: Write failing dashboard aggregate and export tests**

Update `dashboard/src/utils/libraryAggregate.test.ts` predicate fixtures:

```typescript
expect(isTopTierSkill({ mastery_rank: '返璞归真' } as Skill)).toBe(true);
expect(isTopTierSkill({ mastery_rank: '登峰造极' } as Skill)).toBe(true);
expect(isTopTierSkill({ mastery_rank: '出神入化' } as Skill)).toBe(false);
expect(isLegendaryItem({ rarity_tier: '绝世神兵' } as Item)).toBe(true);
expect(isLegendaryItem({ rarity_tier: '稀世珍品' } as Item)).toBe(false);
```

Update `dashboard/src/utils/libraryExport.test.ts` CSV header expectation:

```typescript
expect(csv).toContain('key,kind,author,bookName,bookPath,name,mastery_rank,power_rank,importance,rarity_tier,rank,rarity,type,role,archetype,faction,gameTags,strengthScore,designNotes');
```

- [ ] **Step 2: Write failing dashboard filter tests**

In `dashboard/src/utils/libraryFilters.test.ts`, add:

```typescript
it('filters skills, characters, and items by separate semantic fields', () => {
  const skills: LibraryRecord<Skill>[] = [{
    key: 'skill:a:s1',
    kind: 'skill',
    source,
    entity: { id: 's1', name: '小李飞刀', mastery_rank: '登峰造极', rank: '登峰造极', type: '暗器', faction: null, one_line: '例不虚发', combat_style: '精准爆发', techniques: [], effects: [], progression: [], source_refs: [] },
  }];
  const characters: LibraryRecord<Character>[] = [{
    key: 'character:a:c1',
    kind: 'character',
    source,
    entity: { id: 'c1', name: '李寻欢', power_rank: '返璞归真', rank: '返璞归真', importance: '主角', role: 'protagonist', archetype: 'scholar', faction: null, identity: '探花', one_line: '重情重义' } as Character,
  }];
  const items: LibraryRecord<Item>[] = [{
    key: 'item:a:i1',
    kind: 'item',
    source,
    entity: { id: 'i1', name: '飞刀', type: '暗器', rarity_tier: '绝世神兵', rarity: '绝世神兵', owner: 'char_li_xun_huan', one_line: '例不虚发', description: '薄刃', effects: [], origin: '李家', related_skills: ['s1'], source_refs: [] },
  }];

  expect(filterSkills(skills, { ...empty, materialType: 'skill', masteryRank: ['登峰造极'] })).toHaveLength(1);
  expect(filterCharacters(characters, { ...empty, materialType: 'character', powerRank: ['返璞归真'], importance: ['主角'] })).toHaveLength(1);
  expect(filterItems(items, { ...empty, materialType: 'item', rarityTier: ['绝世神兵'] })).toHaveLength(1);
  expect(filterItems(items, { ...empty, materialType: 'item', masteryRank: ['登峰造极'] })).toHaveLength(1);
});
```

- [ ] **Step 3: Run dashboard tests and verify RED**

Run: `cd dashboard && npm test -- src/utils/libraryAggregate.test.ts src/utils/libraryFilters.test.ts src/utils/libraryExport.test.ts`

Expected: FAIL because TypeScript types and implementation still use `rank` / `rarity`.

- [ ] **Step 4: Update TypeScript types**

Add optional compatibility/audit fields to `dashboard/src/types/novel.ts`:

```typescript
mastery_rank: string;
legacy_rank?: string;
migration_notes?: string[];
```

on `Skill`, add:

```typescript
power_rank: string;
importance: string;
legacy_rank?: string;
migration_notes?: string[];
```

on `Character`, and add:

```typescript
rarity_tier: string;
legacy_rarity?: string;
migration_notes?: string[];
```

on `Item`.

Update `dashboard/src/types/library.ts` filters:

```typescript
export type LibraryMaterialType = 'all' | 'skill' | 'character' | 'faction' | 'item';

export interface LibraryFilters {
  keyword: string;
  materialType: LibraryMaterialType;
  masteryRank: string[];
  powerRank: string[];
  importance: string[];
  author: string[];
  bookPath: string[];
  type: string[];
  faction: string[];
  role: string[];
  archetype: string[];
  rarityTier: string[];
}
```

- [ ] **Step 5: Update dashboard utilities and components**

In `libraryAggregate.ts`, change predicates:

```typescript
export function isTopTierSkill(skill: Pick<Skill, 'mastery_rank' | 'rank'>): boolean {
  const rank = skill.mastery_rank ?? skill.rank;
  return rank === '返璞归真' || rank === '登峰造极';
}

export function isLegendaryItem(item: Pick<Item, 'rarity_tier' | 'rarity'>): boolean {
  return (item.rarity_tier ?? item.rarity) === '绝世神兵';
}
```

In `libraryFilters.ts`, create empty filters with the new keys and use canonical fields:

```typescript
materialType: 'all',
masteryRank: [],
powerRank: [],
importance: [],
rarityTier: [],
```

Use `record.entity.mastery_rank ?? record.entity.rank`, `record.entity.power_rank ?? record.entity.rank`, and `record.entity.rarity_tier ?? record.entity.rarity` in filter comparisons.

In `LibraryFilters.tsx`, add a material-type select before semantic selects and render semantic filters only for the selected type.

In `GlobalLibraryDashboard.tsx`, compute options from `mastery_rank`, `power_rank`, `importance`, and `rarity_tier`.

In table/detail/export components, show/export canonical fields first and legacy fields after them.

- [ ] **Step 6: Run dashboard tests and verify GREEN**

Run: `cd dashboard && npm test -- src/utils/libraryAggregate.test.ts src/utils/libraryFilters.test.ts src/utils/libraryExport.test.ts src/components/library/GlobalLibraryDashboard.test.tsx src/hooks/useLibraryData.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
rtk git add dashboard/src/types/novel.ts dashboard/src/types/library.ts dashboard/src/utils/libraryAggregate.ts dashboard/src/utils/libraryAggregate.test.ts dashboard/src/utils/libraryFilters.ts dashboard/src/utils/libraryFilters.test.ts dashboard/src/components/library/LibraryFilters.tsx dashboard/src/components/library/GlobalLibraryDashboard.tsx dashboard/src/components/library/LibraryRecordTable.tsx dashboard/src/components/library/LibraryDetailDrawer.tsx dashboard/src/utils/libraryExport.ts dashboard/src/utils/libraryExport.test.ts dashboard/src/hooks/useLibraryData.test.ts dashboard/src/components/library/GlobalLibraryDashboard.test.tsx dashboard/src/utils/graphHelper.ts dashboard/src/components/characters/CharacterList.tsx
rtk git commit -m "feat: use semantic fields in dashboard"
```

---

### Task 5: Data Migration And Full Verification

**Files:**
- Modify generated source JSON under author/book directories when running the migration script.

- [ ] **Step 1: Run dry-run migration**

Run: `node tools/normalize/semantic-fields.js --dry-run --root .`

Expected: JSON report with changed file counts, changed entity counts, and any invalid JSON errors.

- [ ] **Step 2: Run actual migration**

Run: `node tools/normalize/semantic-fields.js --root .`

Expected: JSON report with changed file counts and no process crash. Invalid JSON files, if any, are listed in `errors`.

- [ ] **Step 3: Verify migration idempotency**

Run: `node tools/normalize/semantic-fields.js --dry-run --root .`

Expected: `changedFiles` is `0` or only files with pre-existing invalid JSON are listed under `errors`.

- [ ] **Step 4: Run script tests**

Run: `node --test .agents/skills/deconstruct-novel/scripts/semantic-fields.test.js .agents/skills/deconstruct-novel/scripts/validators.test.js tools/normalize/semantic-fields.test.js`

Expected: PASS.

- [ ] **Step 5: Run dashboard tests**

Run: `cd dashboard && npm test`

Expected: PASS.

- [ ] **Step 6: Run dashboard build**

Run: `cd dashboard && npm run build`

Expected: PASS, with TypeScript and Vite build completing.

- [ ] **Step 7: Inspect remaining legacy references**

Run: `rg -n --glob '!dashboard/node_modules/**' --glob '!dashboard/dist/**' '\\b(rank|rarity)\\b' dashboard/src .agents/skills/deconstruct-novel tools/normalize`

Expected: Remaining references are compatibility aliases, tests, migration code, docs, or selected-book legacy UI fallbacks.

- [ ] **Step 8: Commit migrated data and final fixes**

```bash
rtk git add .agents/skills/deconstruct-novel dashboard/src tools/normalize docs/superpowers/plans/2026-06-20-semantic-fields.md
rtk git add 古龙 梁羽生 金庸 黄易
rtk git commit -m "feat: migrate semantic fields"
```

---

## Self-Review

- Spec coverage: The plan covers canonical fields, legacy audit fields, migration, extraction docs, validators, merge normalization, dashboard filters/export, and actual source JSON migration.
- Placeholder scan: No placeholder markers or incomplete implementation notes are intentionally present.
- Type consistency: The canonical dashboard fields are `mastery_rank`, `power_rank`, `importance`, and `rarity_tier`; migration audit fields are `legacy_rank`, `legacy_rarity`, and `migration_notes`.
