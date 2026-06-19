# Global Library Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `全库总览` dashboard that aggregates all processed novels into game-design material views for top-tier martial arts, character archetypes, factions, legendary items, annotations, and export.

**Architecture:** Keep the existing selected-book dashboard isolated. Add a separate global library data path with pure aggregation/filter/export utilities, a bounded-concurrency loader hook, local annotation persistence, and a new route under the existing app layout. The global route uses source-aware entity keys so cross-book records never collide with single-book IDs. The Game Annotations requirement is implemented through `libraryAnnotations.ts`, `useLibraryStore`, and `LibraryDetailDrawer`.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Ant Design, Vitest, Testing Library, browser `localStorage`, browser `Blob` download APIs.

---

## File Structure

- Modify: `dashboard/package.json`  
  Add Vitest scripts and dev dependencies.
- Create: `dashboard/vitest.config.ts`  
  Vitest configuration for unit and component tests.
- Create: `dashboard/src/test/setup.ts`  
  Browser-like test setup.
- Create: `dashboard/src/types/library.ts`  
  Global library record, filter, annotation, and export types.
- Create: `dashboard/src/utils/libraryKeys.ts`  
  Stable global entity keys and parsing helpers.
- Create: `dashboard/src/utils/libraryAggregate.ts`  
  Pure source-aware aggregation helpers for skills, characters, factions, and items.
- Create: `dashboard/src/utils/libraryFilters.ts`  
  Pure filtering helpers for all global material views.
- Create: `dashboard/src/utils/libraryAnnotations.ts`  
  Local annotation loading, saving, updating, and record merge helpers.
- Create: `dashboard/src/utils/libraryExport.ts`  
  JSON and CSV export serialization.
- Create: `dashboard/src/hooks/useLibraryData.ts`  
  Bounded-concurrency global data loader.
- Create: `dashboard/src/stores/useLibraryStore.ts`  
  UI state for library filters, active section, selected global record, and annotations.
- Create: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`  
  Route-level page shell for `全库总览`.
- Create: `dashboard/src/components/library/LibrarySummary.tsx`  
  Aggregate count panels and load warnings.
- Create: `dashboard/src/components/library/LibraryFilters.tsx`  
  Shared filter controls.
- Create: `dashboard/src/components/library/LibraryRecordTable.tsx`  
  Reusable dense table/list for library records.
- Create: `dashboard/src/components/library/LibraryDetailDrawer.tsx`  
  Source-aware detail drawer with annotations and `打开原书`.
- Create: `dashboard/src/components/library/LibraryExportPanel.tsx`  
  Export controls and preview counts.
- Modify: `dashboard/src/components/layout/AppLayout.tsx`  
  Add the `全库总览` navigation entry.
- Modify: `dashboard/src/App.tsx`  
  Add the `/library` route.
- Test: `dashboard/src/utils/*.test.ts`, `dashboard/src/hooks/useLibraryData.test.ts`, `dashboard/src/components/library/*.test.tsx`

## Task 1: Test Harness

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/src/test/setup.ts`

- [ ] **Step 1: Install test dependencies**

Run:

```bash
cd dashboard
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Expected: `package.json` and `package-lock.json` include `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`.

- [ ] **Step 2: Add test scripts**

Modify `dashboard/package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ux": "node scripts/verify-dashboard-ux.mjs",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 3: Add Vitest config**

Create `dashboard/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

- [ ] **Step 4: Add browser test setup**

Create `dashboard/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 5: Run the empty test suite**

Run:

```bash
cd dashboard
npm run test
```

Expected: Vitest starts and reports no test files or passes once later tests exist. If Vitest exits non-zero because no tests exist, continue to Task 2 and use the first test file to validate the harness.

- [ ] **Step 6: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/vitest.config.ts dashboard/src/test/setup.ts
git commit -m "test: add dashboard vitest harness"
```

## Task 2: Global Library Types And Keys

**Files:**
- Create: `dashboard/src/types/library.ts`
- Create: `dashboard/src/utils/libraryKeys.ts`
- Test: `dashboard/src/utils/libraryKeys.test.ts`

- [ ] **Step 1: Write failing key tests**

Create `dashboard/src/utils/libraryKeys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildLibraryKey, parseLibraryKey } from './libraryKeys';

describe('library keys', () => {
  it('builds a stable source-aware key', () => {
    expect(buildLibraryKey('skill', '金庸/射雕英雄传', 'skill_jiu_yin')).toBe(
      'skill:金庸%2F射雕英雄传:skill_jiu_yin',
    );
  });

  it('parses a stable source-aware key', () => {
    expect(parseLibraryKey('item:古龙%2F多情剑客无情剑:item_xiao_li_fei_dao')).toEqual({
      kind: 'item',
      bookPath: '古龙/多情剑客无情剑',
      entityId: 'item_xiao_li_fei_dao',
    });
  });

  it('rejects malformed keys', () => {
    expect(parseLibraryKey('skill:only-two-parts')).toBeNull();
  });
});
```

- [ ] **Step 2: Run key tests and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryKeys.test.ts
```

Expected: FAIL because `libraryKeys.ts` does not exist.

- [ ] **Step 3: Add global library types**

Create `dashboard/src/types/library.ts`:

```ts
import type { Character, Faction, Item, Skill } from './novel';

export type LibraryEntityKind = 'skill' | 'character' | 'faction' | 'item';

export interface LibrarySource {
  author: string;
  bookName: string;
  bookPath: string;
}

export interface LibraryRecord<T> {
  key: string;
  kind: LibraryEntityKind;
  source: LibrarySource;
  entity: T;
}

export type LibrarySkillRecord = LibraryRecord<Skill>;
export type LibraryCharacterRecord = LibraryRecord<Character>;
export type LibraryFactionRecord = LibraryRecord<Faction>;
export type LibraryItemRecord = LibraryRecord<Item>;

export interface LibraryCollections {
  skills: LibrarySkillRecord[];
  characters: LibraryCharacterRecord[];
  factions: LibraryFactionRecord[];
  items: LibraryItemRecord[];
}

export interface LibraryLoadWarning {
  bookPath: string;
  bookName: string;
  file: string;
  message: string;
}

export interface LibraryDataState extends LibraryCollections {
  loading: boolean;
  error: string | null;
  warnings: LibraryLoadWarning[];
}

export interface LibraryFilters {
  keyword: string;
  rank: string[];
  author: string[];
  bookPath: string[];
  type: string[];
  faction: string[];
  role: string[];
  archetype: string[];
  rarity: string[];
}

export interface LibraryAnnotation {
  key: string;
  gameTags: string[];
  strengthScore?: number;
  designNotes?: string;
  exportEnabled?: boolean;
  updatedAt: string;
}

export type LibraryAnnotationMap = Record<string, LibraryAnnotation>;

export interface AnnotatedLibraryRecord<T> extends LibraryRecord<T> {
  annotation: LibraryAnnotation | null;
}

export type LibrarySection = 'overview' | 'skills' | 'characters' | 'factions' | 'items' | 'export';
```

- [ ] **Step 4: Add key helpers**

Create `dashboard/src/utils/libraryKeys.ts`:

```ts
import type { LibraryEntityKind } from '../types/library';

const VALID_KINDS = new Set<LibraryEntityKind>(['skill', 'character', 'faction', 'item']);

export interface ParsedLibraryKey {
  kind: LibraryEntityKind;
  bookPath: string;
  entityId: string;
}

export function buildLibraryKey(kind: LibraryEntityKind, bookPath: string, entityId: string): string {
  return `${kind}:${encodeURIComponent(bookPath)}:${entityId}`;
}

export function parseLibraryKey(key: string): ParsedLibraryKey | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;

  const [kind, encodedBookPath, entityId] = parts;
  if (!VALID_KINDS.has(kind as LibraryEntityKind)) return null;
  if (!encodedBookPath || !entityId) return null;

  return {
    kind: kind as LibraryEntityKind,
    bookPath: decodeURIComponent(encodedBookPath),
    entityId,
  };
}
```

- [ ] **Step 5: Run key tests and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryKeys.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/types/library.ts dashboard/src/utils/libraryKeys.ts dashboard/src/utils/libraryKeys.test.ts
git commit -m "feat: add global library entity keys"
```

## Task 3: Aggregation Utilities

**Files:**
- Create: `dashboard/src/utils/libraryAggregate.ts`
- Test: `dashboard/src/utils/libraryAggregate.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Create `dashboard/src/utils/libraryAggregate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Character, Faction, Item, Skill } from '../types/novel';
import {
  aggregateLibraryCollections,
  isLegendaryItem,
  isTopTierSkill,
  summarizeLibrary,
} from './libraryAggregate';

const source = { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' };

describe('library aggregation', () => {
  it('classifies top-tier martial arts by current rank policy', () => {
    expect(isTopTierSkill({ rank: '返璞归真' } as Skill)).toBe(true);
    expect(isTopTierSkill({ rank: '登峰造极' } as Skill)).toBe(true);
    expect(isTopTierSkill({ rank: '出神入化' } as Skill)).toBe(false);
  });

  it('classifies legendary items by current rarity policy', () => {
    expect(isLegendaryItem({ rarity: '绝世神兵' } as Item)).toBe(true);
    expect(isLegendaryItem({ rarity: '稀世珍品' } as Item)).toBe(false);
  });

  it('attaches source metadata and stable keys', () => {
    const collections = aggregateLibraryCollections([
      {
        source,
        skills: [{ id: 'skill_1', name: '九阴真经', rank: '返璞归真' } as Skill],
        characters: [{ id: 'char_1', name: '郭靖', role: 'protagonist' } as Character],
        factions: [{ id: 'faction_1', name: '全真教' } as Faction],
        items: [{ id: 'item_1', name: '打狗棒', rarity: '绝世神兵' } as Item],
      },
    ]);

    expect(collections.skills[0].key).toBe('skill:金庸%2F射雕英雄传:skill_1');
    expect(collections.skills[0].source.bookName).toBe('射雕英雄传');
    expect(collections.characters[0].kind).toBe('character');
    expect(collections.factions[0].kind).toBe('faction');
    expect(collections.items[0].kind).toBe('item');
  });

  it('summarizes all library material', () => {
    const summary = summarizeLibrary({
      skills: [
        { key: 'a', kind: 'skill', source, entity: { id: 's1', rank: '返璞归真' } as Skill },
        { key: 'b', kind: 'skill', source, entity: { id: 's2', rank: '炉火纯青' } as Skill },
      ],
      characters: [{ key: 'c', kind: 'character', source, entity: { id: 'c1' } as Character }],
      factions: [{ key: 'f', kind: 'faction', source, entity: { id: 'f1' } as Faction }],
      items: [{ key: 'i', kind: 'item', source, entity: { id: 'i1', rarity: '绝世神兵' } as Item }],
    });

    expect(summary).toEqual({
      authors: 1,
      books: 1,
      skills: 2,
      topTierSkills: 1,
      characters: 1,
      factions: 1,
      items: 1,
      legendaryItems: 1,
    });
  });
});
```

- [ ] **Step 2: Run aggregation tests and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryAggregate.test.ts
```

Expected: FAIL because `libraryAggregate.ts` does not exist.

- [ ] **Step 3: Implement aggregation utilities**

Create `dashboard/src/utils/libraryAggregate.ts`:

```ts
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryCollections, LibrarySource } from '../types/library';
import { buildLibraryKey } from './libraryKeys';

export interface RawBookLibraryData {
  source: LibrarySource;
  skills: Skill[];
  characters: Character[];
  factions: Faction[];
  items: Item[];
}

export interface LibrarySummary {
  authors: number;
  books: number;
  skills: number;
  topTierSkills: number;
  characters: number;
  factions: number;
  items: number;
  legendaryItems: number;
}

export function isTopTierSkill(skill: Pick<Skill, 'rank'>): boolean {
  return skill.rank === '返璞归真' || skill.rank === '登峰造极';
}

export function isLegendaryItem(item: Pick<Item, 'rarity'>): boolean {
  return item.rarity === '绝世神兵';
}

export function aggregateLibraryCollections(books: RawBookLibraryData[]): LibraryCollections {
  return books.reduce<LibraryCollections>(
    (collections, book) => {
      book.skills.forEach((skill) => {
        collections.skills.push({
          key: buildLibraryKey('skill', book.source.bookPath, skill.id),
          kind: 'skill',
          source: book.source,
          entity: skill,
        });
      });

      book.characters.forEach((character) => {
        collections.characters.push({
          key: buildLibraryKey('character', book.source.bookPath, character.id),
          kind: 'character',
          source: book.source,
          entity: character,
        });
      });

      book.factions.forEach((faction) => {
        collections.factions.push({
          key: buildLibraryKey('faction', book.source.bookPath, faction.id),
          kind: 'faction',
          source: book.source,
          entity: faction,
        });
      });

      book.items.forEach((item) => {
        collections.items.push({
          key: buildLibraryKey('item', book.source.bookPath, item.id),
          kind: 'item',
          source: book.source,
          entity: item,
        });
      });

      return collections;
    },
    { skills: [], characters: [], factions: [], items: [] },
  );
}

export function summarizeLibrary(collections: LibraryCollections): LibrarySummary {
  const sourceRecords = [
    ...collections.skills,
    ...collections.characters,
    ...collections.factions,
    ...collections.items,
  ];

  return {
    authors: new Set(sourceRecords.map((record) => record.source.author)).size,
    books: new Set(sourceRecords.map((record) => record.source.bookPath)).size,
    skills: collections.skills.length,
    topTierSkills: collections.skills.filter((record) => isTopTierSkill(record.entity)).length,
    characters: collections.characters.length,
    factions: collections.factions.length,
    items: collections.items.length,
    legendaryItems: collections.items.filter((record) => isLegendaryItem(record.entity)).length,
  };
}
```

- [ ] **Step 4: Run aggregation tests and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryAggregate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/utils/libraryAggregate.ts dashboard/src/utils/libraryAggregate.test.ts
git commit -m "feat: aggregate cross-book library records"
```

## Task 4: Filters And Search

**Files:**
- Create: `dashboard/src/utils/libraryFilters.ts`
- Test: `dashboard/src/utils/libraryFilters.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `dashboard/src/utils/libraryFilters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryFilters, LibraryRecord } from '../types/library';
import {
  createEmptyLibraryFilters,
  filterCharacters,
  filterFactions,
  filterItems,
  filterSkills,
  getUniqueFilterValues,
} from './libraryFilters';

const source = { author: '古龙', bookName: '多情剑客无情剑', bookPath: '古龙/多情剑客无情剑' };
const empty = createEmptyLibraryFilters();

describe('library filters', () => {
  it('filters skills by top fields and keyword content', () => {
    const records: LibraryRecord<Skill>[] = [
      {
        key: 'skill:a:s1',
        kind: 'skill',
        source,
        entity: {
          id: 's1',
          name: '小李飞刀',
          rank: '登峰造极',
          type: '暗器',
          faction: null,
          one_line: '例不虚发',
          combat_style: '精准爆发',
          techniques: [{ id: 't1', name: '飞刀一击', type: 'attack', description: '极快' }],
          effects: [{ type: 'burst', description: '瞬间爆发' }],
          progression: [],
          source_refs: [],
        },
      },
    ];

    expect(filterSkills(records, { ...empty, rank: ['登峰造极'], keyword: '爆发' })).toHaveLength(1);
    expect(filterSkills(records, { ...empty, type: ['拳掌'] })).toHaveLength(0);
  });

  it('filters character archetypes', () => {
    const records: LibraryRecord<Character>[] = [
      {
        key: 'character:a:c1',
        kind: 'character',
        source,
        entity: { id: 'c1', name: '李寻欢', role: 'protagonist', archetype: 'scholar', faction: null, rank: '绝顶', identity: '探花', one_line: '重情重义' } as Character,
      },
    ];

    expect(filterCharacters(records, { ...empty, role: ['protagonist'], archetype: ['scholar'] })).toHaveLength(1);
    expect(filterCharacters(records, { ...empty, role: ['villain'] })).toHaveLength(0);
  });

  it('filters factions and items', () => {
    const factions: LibraryRecord<Faction>[] = [
      { key: 'faction:a:f1', kind: 'faction', source, entity: { id: 'f1', name: '金钱帮', type: '帮会', location: '关中', sub_divisions: [], one_line: '势力庞大', source_refs: [] } },
    ];
    const items: LibraryRecord<Item>[] = [
      { key: 'item:a:i1', kind: 'item', source, entity: { id: 'i1', name: '小李飞刀', type: '暗器', rarity: '绝世神兵', owner: 'char_li_xun_huan', one_line: '例不虚发', description: '薄刃', effects: [], origin: '李家', related_skills: ['s1'], source_refs: [] } },
    ];

    expect(filterFactions(factions, { ...empty, type: ['帮会'], keyword: '关中' })).toHaveLength(1);
    expect(filterItems(items, { ...empty, rarity: ['绝世神兵'], keyword: '薄刃' })).toHaveLength(1);
  });

  it('collects unique filter values without blanks', () => {
    expect(getUniqueFilterValues(['古龙', '', null, '金庸', '古龙'])).toEqual(['古龙', '金庸']);
  });
});
```

- [ ] **Step 2: Run filter tests and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryFilters.test.ts
```

Expected: FAIL because `libraryFilters.ts` does not exist.

- [ ] **Step 3: Implement filtering utilities**

Create `dashboard/src/utils/libraryFilters.ts`:

```ts
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryFilters, LibraryRecord } from '../types/library';

export function createEmptyLibraryFilters(): LibraryFilters {
  return {
    keyword: '',
    rank: [],
    author: [],
    bookPath: [],
    type: [],
    faction: [],
    role: [],
    archetype: [],
    rarity: [],
  };
}

export function getUniqueFilterValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, 'zh'),
  );
}

function includesAny(value: string | null | undefined, selected: string[]): boolean {
  return selected.length === 0 || (Boolean(value) && selected.includes(value as string));
}

function sourceMatches<T>(record: LibraryRecord<T>, filters: LibraryFilters): boolean {
  return includesAny(record.source.author, filters.author) && includesAny(record.source.bookPath, filters.bookPath);
}

function keywordMatches(keyword: string, values: Array<string | null | undefined>): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => value?.toLowerCase().includes(q));
}

export function filterSkills(records: LibraryRecord<Skill>[], filters: LibraryFilters): LibraryRecord<Skill>[] {
  return records.filter((record) => {
    const skill = record.entity;
    const techniqueText = Array.isArray(skill.techniques)
      ? skill.techniques.map((technique) => `${technique.name} ${technique.description}`).join(' ')
      : '';
    const effectText = Array.isArray(skill.effects)
      ? skill.effects.map((effect) => `${effect.type ?? ''} ${effect.description ?? ''}`).join(' ')
      : '';

    return (
      sourceMatches(record, filters) &&
      includesAny(skill.rank, filters.rank) &&
      includesAny(skill.type, filters.type) &&
      includesAny(skill.faction, filters.faction) &&
      keywordMatches(filters.keyword, [skill.name, skill.one_line, skill.combat_style, techniqueText, effectText])
    );
  });
}

export function filterCharacters(records: LibraryRecord<Character>[], filters: LibraryFilters): LibraryRecord<Character>[] {
  return records.filter((record) => {
    const character = record.entity;
    return (
      sourceMatches(record, filters) &&
      includesAny(character.role, filters.role) &&
      includesAny(character.archetype, filters.archetype) &&
      includesAny(character.faction, filters.faction) &&
      keywordMatches(filters.keyword, [
        character.name,
        character.identity,
        character.rank,
        character.one_line,
        character.personality?.temperament,
        character.personality?.speech_style,
      ])
    );
  });
}

export function filterFactions(records: LibraryRecord<Faction>[], filters: LibraryFilters): LibraryRecord<Faction>[] {
  return records.filter((record) => {
    const faction = record.entity;
    return (
      sourceMatches(record, filters) &&
      includesAny(faction.type, filters.type) &&
      keywordMatches(filters.keyword, [faction.name, faction.type, faction.location, faction.one_line, faction.sub_divisions?.join(' ')])
    );
  });
}

export function filterItems(records: LibraryRecord<Item>[], filters: LibraryFilters): LibraryRecord<Item>[] {
  return records.filter((record) => {
    const item = record.entity;
    return (
      sourceMatches(record, filters) &&
      includesAny(item.type, filters.type) &&
      includesAny(item.rarity, filters.rarity) &&
      keywordMatches(filters.keyword, [item.name, item.type, item.owner, item.one_line, item.description, item.origin])
    );
  });
}
```

- [ ] **Step 4: Run filter tests and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryFilters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/utils/libraryFilters.ts dashboard/src/utils/libraryFilters.test.ts
git commit -m "feat: filter global library material"
```

## Task 5: Annotation And Export Utilities

**Files:**
- Create: `dashboard/src/utils/libraryAnnotations.ts`
- Create: `dashboard/src/utils/libraryExport.ts`
- Test: `dashboard/src/utils/libraryAnnotations.test.ts`
- Test: `dashboard/src/utils/libraryExport.test.ts`

- [ ] **Step 1: Write failing annotation tests**

Create `dashboard/src/utils/libraryAnnotations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Skill } from '../types/novel';
import type { LibraryAnnotationMap, LibraryRecord } from '../types/library';
import {
  LIBRARY_ANNOTATIONS_STORAGE_KEY,
  annotateRecords,
  loadLibraryAnnotations,
  saveLibraryAnnotations,
  updateLibraryAnnotation,
} from './libraryAnnotations';

describe('library annotations', () => {
  it('loads an empty map when storage is empty or malformed', () => {
    expect(loadLibraryAnnotations()).toEqual({});
    localStorage.setItem(LIBRARY_ANNOTATIONS_STORAGE_KEY, '{broken');
    expect(loadLibraryAnnotations()).toEqual({});
  });

  it('saves and updates annotations by global key', () => {
    const map = updateLibraryAnnotation({}, 'skill:book:s1', {
      gameTags: ['boss-drop'],
      strengthScore: 9,
      designNotes: 'Use as late-game burst skill',
      exportEnabled: true,
    });
    saveLibraryAnnotations(map);

    expect(loadLibraryAnnotations()['skill:book:s1'].strengthScore).toBe(9);
    expect(loadLibraryAnnotations()['skill:book:s1'].gameTags).toEqual(['boss-drop']);
  });

  it('merges annotations onto records', () => {
    const records: LibraryRecord<Skill>[] = [
      { key: 'skill:book:s1', kind: 'skill', source: { author: '金庸', bookName: '书', bookPath: 'book' }, entity: { id: 's1', name: '九阴真经' } as Skill },
    ];
    const annotations: LibraryAnnotationMap = {
      'skill:book:s1': {
        key: 'skill:book:s1',
        gameTags: ['core'],
        updatedAt: '2026-06-19T00:00:00.000Z',
      },
    };

    expect(annotateRecords(records, annotations)[0].annotation?.gameTags).toEqual(['core']);
  });
});
```

- [ ] **Step 2: Write failing export tests**

Create `dashboard/src/utils/libraryExport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Skill } from '../types/novel';
import type { AnnotatedLibraryRecord } from '../types/library';
import { serializeLibraryCsv, serializeLibraryJson } from './libraryExport';

const record: AnnotatedLibraryRecord<Skill> = {
  key: 'skill:book:s1',
  kind: 'skill',
  source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
  entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', faction: null, one_line: '武学总纲' } as Skill,
  annotation: {
    key: 'skill:book:s1',
    gameTags: ['ultimate'],
    strengthScore: 10,
    designNotes: 'Endgame reward',
    exportEnabled: true,
    updatedAt: '2026-06-19T00:00:00.000Z',
  },
};

describe('library export', () => {
  it('serializes source, entity, and annotation to JSON', () => {
    const parsed = JSON.parse(serializeLibraryJson([record]));
    expect(parsed.records[0].source.bookName).toBe('射雕英雄传');
    expect(parsed.records[0].annotation.strengthScore).toBe(10);
  });

  it('serializes CSV with escaped fields', () => {
    const csv = serializeLibraryCsv([record]);
    expect(csv).toContain('key,kind,author,bookName,bookPath,name,rank,type,rarity,role,archetype,faction,gameTags,strengthScore,designNotes');
    expect(csv).toContain('"九阴真经"');
    expect(csv).toContain('"ultimate"');
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryAnnotations.test.ts src/utils/libraryExport.test.ts
```

Expected: FAIL because annotation and export utility files do not exist.

- [ ] **Step 4: Implement annotation utilities**

Create `dashboard/src/utils/libraryAnnotations.ts`:

```ts
import type { AnnotatedLibraryRecord, LibraryAnnotation, LibraryAnnotationMap, LibraryRecord } from '../types/library';

export const LIBRARY_ANNOTATIONS_STORAGE_KEY = 'novel-dashboard-library-annotations';

export function loadLibraryAnnotations(): LibraryAnnotationMap {
  try {
    const raw = localStorage.getItem(LIBRARY_ANNOTATIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLibraryAnnotations(annotations: LibraryAnnotationMap): void {
  localStorage.setItem(LIBRARY_ANNOTATIONS_STORAGE_KEY, JSON.stringify(annotations));
}

export function updateLibraryAnnotation(
  annotations: LibraryAnnotationMap,
  key: string,
  patch: Partial<Omit<LibraryAnnotation, 'key' | 'updatedAt'>>,
): LibraryAnnotationMap {
  const previous = annotations[key] ?? { key, gameTags: [], updatedAt: new Date(0).toISOString() };
  return {
    ...annotations,
    [key]: {
      ...previous,
      ...patch,
      key,
      gameTags: patch.gameTags ?? previous.gameTags,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function annotateRecords<T>(
  records: LibraryRecord<T>[],
  annotations: LibraryAnnotationMap,
): AnnotatedLibraryRecord<T>[] {
  return records.map((record) => ({
    ...record,
    annotation: annotations[record.key] ?? null,
  }));
}
```

- [ ] **Step 5: Implement export utilities**

Create `dashboard/src/utils/libraryExport.ts`:

```ts
import type { AnnotatedLibraryRecord } from '../types/library';

type ExportableEntity = {
  name?: string;
  rank?: string;
  type?: string;
  rarity?: string;
  role?: string;
  archetype?: string;
  faction?: string | null;
};

export function serializeLibraryJson(records: AnnotatedLibraryRecord<unknown>[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: records.length,
      records,
    },
    null,
    2,
  );
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeLibraryCsv(records: AnnotatedLibraryRecord<unknown>[]): string {
  const headers = [
    'key',
    'kind',
    'author',
    'bookName',
    'bookPath',
    'name',
    'rank',
    'type',
    'rarity',
    'role',
    'archetype',
    'faction',
    'gameTags',
    'strengthScore',
    'designNotes',
  ];

  const rows = records.map((record) => {
    const entity = record.entity as ExportableEntity;
    return [
      record.key,
      record.kind,
      record.source.author,
      record.source.bookName,
      record.source.bookPath,
      entity.name,
      entity.rank,
      entity.type,
      entity.rarity,
      entity.role,
      entity.archetype,
      entity.faction,
      record.annotation?.gameTags ?? [],
      record.annotation?.strengthScore ?? '',
      record.annotation?.designNotes ?? '',
    ].map(csvCell).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
```

- [ ] **Step 6: Run tests and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/utils/libraryAnnotations.test.ts src/utils/libraryExport.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/utils/libraryAnnotations.ts dashboard/src/utils/libraryAnnotations.test.ts dashboard/src/utils/libraryExport.ts dashboard/src/utils/libraryExport.test.ts
git commit -m "feat: add library annotations and export serializers"
```

## Task 6: Global Data Loader

**Files:**
- Create: `dashboard/src/hooks/useLibraryData.ts`
- Test: `dashboard/src/hooks/useLibraryData.test.ts`

- [ ] **Step 1: Write failing loader tests**

Create `dashboard/src/hooks/useLibraryData.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { BookMeta } from '../stores/useBookStore';
import { loadLibraryData } from './useLibraryData';

const books: BookMeta[] = [
  { author: '金庸', name: '射雕英雄传', path: '金庸/射雕英雄传', characters: 2 },
  { author: '古龙', name: '多情剑客无情剑', path: '古龙/多情剑客无情剑', characters: 1 },
];

describe('loadLibraryData', () => {
  it('loads all global material and keeps partial warnings', async () => {
    const fetcher = vi.fn(async (file: string, book: BookMeta) => {
      if (book.author === '古龙' && file === 'items.json') {
        throw new Error('missing items');
      }
      if (file === 'skills.json') return [{ id: `${book.author}_skill`, name: '武功', rank: '登峰造极' }];
      if (file === 'characters.json') return [{ id: `${book.author}_char`, name: '人物', role: 'protagonist', archetype: 'warrior' }];
      if (file === 'factions.json') return [{ id: `${book.author}_faction`, name: '门派', type: '门派' }];
      if (file === 'items.json') return [{ id: `${book.author}_item`, name: '神兵', rarity: '绝世神兵' }];
      return [];
    });

    const data = await loadLibraryData(books, fetcher, 2);

    expect(data.skills).toHaveLength(2);
    expect(data.characters).toHaveLength(2);
    expect(data.factions).toHaveLength(2);
    expect(data.items).toHaveLength(1);
    expect(data.warnings).toEqual([
      {
        bookPath: '古龙/多情剑客无情剑',
        bookName: '多情剑客无情剑',
        file: 'items.json',
        message: 'missing items',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run loader tests and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/hooks/useLibraryData.test.ts
```

Expected: FAIL because `useLibraryData.ts` does not exist.

- [ ] **Step 3: Implement loader hook and pure loader**

Create `dashboard/src/hooks/useLibraryData.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryCollections, LibraryDataState, LibraryLoadWarning } from '../types/library';
import type { BookMeta } from '../stores/useBookStore';
import { aggregateLibraryCollections, type RawBookLibraryData } from '../utils/libraryAggregate';

const LIBRARY_FILES = ['skills.json', 'characters.json', 'factions.json', 'items.json'] as const;
type LibraryFile = (typeof LIBRARY_FILES)[number];

type EntityByFile = {
  'skills.json': Skill[];
  'characters.json': Character[];
  'factions.json': Faction[];
  'items.json': Item[];
};

export type LibraryFileFetcher = <TFile extends LibraryFile>(file: TFile, book: BookMeta) => Promise<EntityByFile[TFile]>;

const EMPTY_COLLECTIONS: LibraryCollections = { skills: [], characters: [], factions: [], items: [] };

export async function defaultLibraryFileFetcher<TFile extends LibraryFile>(
  file: TFile,
  book: BookMeta,
): Promise<EntityByFile[TFile]> {
  const encodedBook = encodeURIComponent(book.path);
  const response = await fetch(`/api/novel/${file}?book=${encodedBook}`);
  if (!response.ok) throw new Error(`Failed to load ${file}`);
  return response.json();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function loadLibraryData(
  books: BookMeta[],
  fetcher: LibraryFileFetcher = defaultLibraryFileFetcher,
  concurrency = 4,
): Promise<LibraryCollections & { warnings: LibraryLoadWarning[] }> {
  const warnings: LibraryLoadWarning[] = [];

  const rawBooks = await mapWithConcurrency(books, concurrency, async (book): Promise<RawBookLibraryData> => {
    const data: RawBookLibraryData = {
      source: { author: book.author, bookName: book.name, bookPath: book.path },
      skills: [],
      characters: [],
      factions: [],
      items: [],
    };

    await Promise.all(
      LIBRARY_FILES.map(async (file) => {
        try {
          const loaded = await fetcher(file, book);
          if (file === 'skills.json') data.skills = loaded as Skill[];
          if (file === 'characters.json') data.characters = loaded as Character[];
          if (file === 'factions.json') data.factions = loaded as Faction[];
          if (file === 'items.json') data.items = loaded as Item[];
        } catch (error) {
          warnings.push({
            bookPath: book.path,
            bookName: book.name,
            file,
            message: error instanceof Error ? error.message : '加载失败',
          });
        }
      }),
    );

    return data;
  });

  return { ...aggregateLibraryCollections(rawBooks), warnings };
}

export function useLibraryData(books: BookMeta[]): LibraryDataState {
  const [state, setState] = useState<LibraryDataState>({
    ...EMPTY_COLLECTIONS,
    loading: false,
    error: null,
    warnings: [],
  });

  useEffect(() => {
    if (books.length === 0) {
      setState({ ...EMPTY_COLLECTIONS, loading: false, error: null, warnings: [] });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loadLibraryData(books)
      .then((data) => {
        if (!cancelled) setState({ ...data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            ...EMPTY_COLLECTIONS,
            loading: false,
            error: error instanceof Error ? error.message : '加载全库数据失败',
            warnings: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [books]);

  return state;
}
```

- [ ] **Step 4: Run loader tests and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/hooks/useLibraryData.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/hooks/useLibraryData.ts dashboard/src/hooks/useLibraryData.test.ts
git commit -m "feat: load global library data"
```

## Task 7: Library Store And Page Shell

**Files:**
- Create: `dashboard/src/stores/useLibraryStore.ts`
- Create: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`
- Create: `dashboard/src/components/library/LibrarySummary.tsx`
- Modify: `dashboard/src/components/layout/AppLayout.tsx`
- Modify: `dashboard/src/App.tsx`
- Test: `dashboard/src/components/library/GlobalLibraryDashboard.test.tsx`

- [ ] **Step 1: Write failing page shell test**

Create `dashboard/src/components/library/GlobalLibraryDashboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalLibraryDashboard from './GlobalLibraryDashboard';

vi.mock('../../stores/useBookStore', () => ({
  useBookStore: (selector?: unknown) => {
    const state = {
      books: [{ author: '金庸', name: '射雕英雄传', path: '金庸/射雕英雄传', characters: 2 }],
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => ({
    skills: [{ key: 'skill:book:s1', kind: 'skill', source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' }, entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', techniques: [], effects: [] } }],
    characters: [],
    factions: [],
    items: [],
    loading: false,
    error: null,
    warnings: [],
  }),
}));

describe('GlobalLibraryDashboard', () => {
  it('renders the global library summary and sections', () => {
    render(<GlobalLibraryDashboard />);

    expect(screen.getByText('全库总览')).toBeInTheDocument();
    expect(screen.getByText('顶级武功')).toBeInTheDocument();
    expect(screen.getByText('人物原型')).toBeInTheDocument();
    expect(screen.getByText('门派资源')).toBeInTheDocument();
    expect(screen.getByText('神兵物品')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run page shell test and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/components/library/GlobalLibraryDashboard.test.tsx
```

Expected: FAIL because the component files do not exist.

- [ ] **Step 3: Add library UI store**

Create `dashboard/src/stores/useLibraryStore.ts`:

```ts
import { create } from 'zustand';
import type { LibraryAnnotationMap, LibraryFilters, LibrarySection } from '../types/library';
import { createEmptyLibraryFilters } from '../utils/libraryFilters';
import { loadLibraryAnnotations, saveLibraryAnnotations, updateLibraryAnnotation } from '../utils/libraryAnnotations';

interface LibraryStore {
  section: LibrarySection;
  filters: LibraryFilters;
  selectedKey: string | null;
  annotations: LibraryAnnotationMap;
  setSection: (section: LibrarySection) => void;
  setFilters: (filters: Partial<LibraryFilters>) => void;
  resetFilters: () => void;
  selectRecord: (key: string | null) => void;
  hydrateAnnotations: () => void;
  updateAnnotation: (key: string, patch: Parameters<typeof updateLibraryAnnotation>[2]) => void;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  section: 'overview',
  filters: createEmptyLibraryFilters(),
  selectedKey: null,
  annotations: {},

  setSection: (section) => set({ section }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: createEmptyLibraryFilters() }),
  selectRecord: (selectedKey) => set({ selectedKey }),
  hydrateAnnotations: () => set({ annotations: loadLibraryAnnotations() }),
  updateAnnotation: (key, patch) => {
    const annotations = updateLibraryAnnotation(get().annotations, key, patch);
    saveLibraryAnnotations(annotations);
    set({ annotations });
  },
}));
```

- [ ] **Step 4: Add summary component**

Create `dashboard/src/components/library/LibrarySummary.tsx`:

```tsx
import React from 'react';
import { Alert, Col, Row, Statistic } from 'antd';
import type { LibraryCollections, LibraryLoadWarning } from '../../types/library';
import { summarizeLibrary } from '../../utils/libraryAggregate';

interface LibrarySummaryProps {
  collections: LibraryCollections;
  warnings: LibraryLoadWarning[];
}

const LibrarySummary: React.FC<LibrarySummaryProps> = ({ collections, warnings }) => {
  const summary = summarizeLibrary(collections);

  return (
    <div style={{ marginBottom: 20 }}>
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`有 ${warnings.length} 个数据文件未加载，当前展示可用的部分数据。`}
        />
      )}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Statistic title="作品" value={summary.books} /></Col>
        <Col xs={12} md={6}><Statistic title="作者" value={summary.authors} /></Col>
        <Col xs={12} md={6}><Statistic title="武功" value={summary.skills} /></Col>
        <Col xs={12} md={6}><Statistic title="顶级武功" value={summary.topTierSkills} /></Col>
        <Col xs={12} md={6}><Statistic title="人物" value={summary.characters} /></Col>
        <Col xs={12} md={6}><Statistic title="门派" value={summary.factions} /></Col>
        <Col xs={12} md={6}><Statistic title="物品" value={summary.items} /></Col>
        <Col xs={12} md={6}><Statistic title="神兵" value={summary.legendaryItems} /></Col>
      </Row>
    </div>
  );
};

export default LibrarySummary;
```

- [ ] **Step 5: Add global page shell**

Create `dashboard/src/components/library/GlobalLibraryDashboard.tsx`:

```tsx
import React, { useEffect } from 'react';
import { Empty, Segmented, Spin, Typography } from 'antd';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import type { LibrarySection } from '../../types/library';
import LibrarySummary from './LibrarySummary';

const { Paragraph, Title } = Typography;

const SECTION_OPTIONS: Array<{ label: string; value: LibrarySection }> = [
  { label: '总览', value: 'overview' },
  { label: '顶级武功', value: 'skills' },
  { label: '人物原型', value: 'characters' },
  { label: '门派资源', value: 'factions' },
  { label: '神兵物品', value: 'items' },
  { label: '导出', value: 'export' },
];

const GlobalLibraryDashboard: React.FC = () => {
  const books = useBookStore((state) => state.books);
  const data = useLibraryData(books);
  const { section, setSection, hydrateAnnotations } = useLibraryStore();

  useEffect(() => {
    hydrateAnnotations();
  }, [hydrateAnnotations]);

  if (data.loading) return <Spin size="large" />;
  if (data.error) return <Empty description={data.error} />;

  const collections = {
    skills: data.skills,
    characters: data.characters,
    factions: data.factions,
    items: data.items,
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>全库总览</Title>
        <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
          跨作品整理武功、人物原型、门派资源和神兵物品，为游戏设计提供可筛选素材。
        </Paragraph>
      </div>
      <Segmented
        options={SECTION_OPTIONS}
        value={section}
        onChange={(value) => setSection(value as LibrarySection)}
        style={{ marginBottom: 20 }}
      />
      <LibrarySummary collections={collections} warnings={data.warnings} />
      <div data-testid="library-section">{SECTION_OPTIONS.find((option) => option.value === section)?.label}</div>
    </div>
  );
};

export default GlobalLibraryDashboard;
```

- [ ] **Step 6: Add navigation and route**

Modify `dashboard/src/components/layout/AppLayout.tsx` imports:

```tsx
import {
  AppstoreOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CommentOutlined,
  DashboardOutlined,
  UserOutlined,
  ToolOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
```

Add this item before the existing `/` overview item:

```tsx
{
  key: '/library',
  icon: <AppstoreOutlined />,
  label: '全库总览',
},
```

Modify `dashboard/src/App.tsx` imports:

```tsx
import GlobalLibraryDashboard from './components/library/GlobalLibraryDashboard';
```

Add the route inside the root route:

```tsx
<Route path="library" element={<GlobalLibraryDashboard />} />
```

- [ ] **Step 7: Run page shell test and verify pass**

Run:

```bash
cd dashboard
npm run test -- src/components/library/GlobalLibraryDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/stores/useLibraryStore.ts dashboard/src/components/library/GlobalLibraryDashboard.tsx dashboard/src/components/library/LibrarySummary.tsx dashboard/src/components/layout/AppLayout.tsx dashboard/src/App.tsx dashboard/src/components/library/GlobalLibraryDashboard.test.tsx
git commit -m "feat: add global library dashboard route"
```

## Task 8: Material Lists, Filters, And Detail Drawer

**Files:**
- Create: `dashboard/src/components/library/LibraryFilters.tsx`
- Create: `dashboard/src/components/library/LibraryRecordTable.tsx`
- Create: `dashboard/src/components/library/LibraryDetailDrawer.tsx`
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`
- Test: `dashboard/src/components/library/LibraryRecordTable.test.tsx`

- [ ] **Step 1: Write failing record table test**

Create `dashboard/src/components/library/LibraryRecordTable.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '../../types/novel';
import type { LibraryRecord } from '../../types/library';
import LibraryRecordTable from './LibraryRecordTable';

describe('LibraryRecordTable', () => {
  it('renders source-aware records and opens details', () => {
    const onOpen = vi.fn();
    const records: LibraryRecord<Skill>[] = [
      {
        key: 'skill:book:s1',
        kind: 'skill',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
        entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', one_line: '武学总纲' } as Skill,
      },
    ];

    render(<LibraryRecordTable records={records} onOpen={onOpen} />);

    expect(screen.getByText('九阴真经')).toBeInTheDocument();
    expect(screen.getByText('射雕英雄传')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看' }));
    expect(onOpen).toHaveBeenCalledWith('skill:book:s1');
  });
});
```

- [ ] **Step 2: Run record table test and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/components/library/LibraryRecordTable.test.tsx
```

Expected: FAIL because `LibraryRecordTable.tsx` does not exist.

- [ ] **Step 3: Add shared filter controls**

Create `dashboard/src/components/library/LibraryFilters.tsx`:

```tsx
import React from 'react';
import { Button, Input, Select, Space } from 'antd';
import type { LibraryFilters } from '../../types/library';

interface LibraryFiltersProps {
  filters: LibraryFilters;
  options: {
    rank?: string[];
    author?: string[];
    bookPath?: Array<{ label: string; value: string }>;
    type?: string[];
    faction?: string[];
    role?: string[];
    archetype?: string[];
    rarity?: string[];
  };
  onChange: (filters: Partial<LibraryFilters>) => void;
  onReset: () => void;
}

const LibraryFiltersPanel: React.FC<LibraryFiltersProps> = ({ filters, options, onChange, onReset }) => (
  <Space wrap style={{ marginBottom: 16 }}>
    <Input.Search
      allowClear
      placeholder="搜索名称、简介、招式、效果..."
      value={filters.keyword}
      onChange={(event) => onChange({ keyword: event.target.value })}
      style={{ width: 260 }}
    />
    {options.rank && <Select mode="multiple" allowClear placeholder="等级" value={filters.rank} options={options.rank.map((value) => ({ value, label: value }))} onChange={(rank) => onChange({ rank })} style={{ minWidth: 160 }} />}
    {options.author && <Select mode="multiple" allowClear placeholder="作者" value={filters.author} options={options.author.map((value) => ({ value, label: value }))} onChange={(author) => onChange({ author })} style={{ minWidth: 150 }} />}
    {options.bookPath && <Select mode="multiple" allowClear placeholder="作品" value={filters.bookPath} options={options.bookPath} onChange={(bookPath) => onChange({ bookPath })} style={{ minWidth: 190 }} />}
    {options.type && <Select mode="multiple" allowClear placeholder="类型" value={filters.type} options={options.type.map((value) => ({ value, label: value }))} onChange={(type) => onChange({ type })} style={{ minWidth: 150 }} />}
    {options.faction && <Select mode="multiple" allowClear placeholder="门派" value={filters.faction} options={options.faction.map((value) => ({ value, label: value }))} onChange={(faction) => onChange({ faction })} style={{ minWidth: 150 }} />}
    {options.role && <Select mode="multiple" allowClear placeholder="角色定位" value={filters.role} options={options.role.map((value) => ({ value, label: value }))} onChange={(role) => onChange({ role })} style={{ minWidth: 150 }} />}
    {options.archetype && <Select mode="multiple" allowClear placeholder="原型" value={filters.archetype} options={options.archetype.map((value) => ({ value, label: value }))} onChange={(archetype) => onChange({ archetype })} style={{ minWidth: 150 }} />}
    {options.rarity && <Select mode="multiple" allowClear placeholder="稀有度" value={filters.rarity} options={options.rarity.map((value) => ({ value, label: value }))} onChange={(rarity) => onChange({ rarity })} style={{ minWidth: 150 }} />}
    <Button onClick={onReset}>重置</Button>
  </Space>
);

export default LibraryFiltersPanel;
```

- [ ] **Step 4: Add reusable record table**

Create `dashboard/src/components/library/LibraryRecordTable.tsx`:

```tsx
import React from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AnnotatedLibraryRecord, LibraryRecord } from '../../types/library';

const { Text } = Typography;

type EntityPreview = {
  name?: string;
  rank?: string;
  type?: string;
  rarity?: string;
  role?: string;
  archetype?: string;
  faction?: string | null;
  one_line?: string;
};

interface LibraryRecordTableProps<T> {
  records: Array<LibraryRecord<T> | AnnotatedLibraryRecord<T>>;
  onOpen: (key: string) => void;
}

const LibraryRecordTable = <T,>({ records, onOpen }: LibraryRecordTableProps<T>) => {
  const columns: ColumnsType<LibraryRecord<T> | AnnotatedLibraryRecord<T>> = [
    {
      title: '名称',
      key: 'name',
      render: (_, record) => {
        const entity = record.entity as EntityPreview;
        return (
          <Space direction="vertical" size={2}>
            <Text strong>{entity.name ?? record.key}</Text>
            {entity.one_line && <Text type="secondary">{entity.one_line}</Text>}
          </Space>
        );
      },
    },
    {
      title: '来源',
      key: 'source',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.source.bookName}</Text>
          <Text type="secondary">{record.source.author}</Text>
        </Space>
      ),
    },
    {
      title: '标签',
      key: 'meta',
      render: (_, record) => {
        const entity = record.entity as EntityPreview;
        return (
          <Space wrap size={4}>
            {entity.rank && <Tag color="red">{entity.rank}</Tag>}
            {entity.rarity && <Tag color="gold">{entity.rarity}</Tag>}
            {entity.type && <Tag>{entity.type}</Tag>}
            {entity.role && <Tag color="blue">{entity.role}</Tag>}
            {entity.archetype && <Tag color="green">{entity.archetype}</Tag>}
            {entity.faction && <Tag color="cyan">{entity.faction}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => <Button size="small" onClick={() => onOpen(record.key)}>查看</Button>,
    },
  ];

  return <Table rowKey="key" size="small" columns={columns} dataSource={records} pagination={{ pageSize: 20 }} />;
};

export default LibraryRecordTable;
```

- [ ] **Step 5: Add detail drawer**

Create `dashboard/src/components/library/LibraryDetailDrawer.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { Button, Drawer, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import type { LibraryCollections, LibraryRecord } from '../../types/library';
import { parseLibraryKey } from '../../utils/libraryKeys';

const { Paragraph, Text, Title } = Typography;

interface LibraryDetailDrawerProps {
  collections: LibraryCollections;
}

const LibraryDetailDrawer: React.FC<LibraryDetailDrawerProps> = ({ collections }) => {
  const navigate = useNavigate();
  const selectBook = useBookStore((state) => state.selectBook);
  const { selectedKey, selectRecord, annotations, updateAnnotation } = useLibraryStore();
  const [tagInput, setTagInput] = useState('');

  const record = useMemo<LibraryRecord<unknown> | null>(() => {
    if (!selectedKey) return null;
    return ([...collections.skills, ...collections.characters, ...collections.factions, ...collections.items] as LibraryRecord<unknown>[])
      .find((item) => item.key === selectedKey) ?? null;
  }, [collections, selectedKey]);

  const annotation = selectedKey ? annotations[selectedKey] : null;
  const entity = (record?.entity ?? {}) as { id?: string; name?: string; one_line?: string; rank?: string; type?: string; rarity?: string; role?: string; archetype?: string; faction?: string | null };

  const openSourceBook = () => {
    if (!selectedKey || !record) return;
    const parsed = parseLibraryKey(selectedKey);
    if (!parsed) return;
    selectBook(parsed.bookPath);
    const routeByKind = {
      skill: 'skills',
      character: 'characters',
      faction: 'forces',
      item: 'items',
    };
    navigate(`/${routeByKind[parsed.kind]}?detail=${parsed.kind}:${parsed.entityId}`);
  };

  const addTag = () => {
    if (!selectedKey) return;
    const tag = tagInput.trim();
    if (!tag) return;
    const tags = Array.from(new Set([...(annotation?.gameTags ?? []), tag]));
    updateAnnotation(selectedKey, { gameTags: tags });
    setTagInput('');
  };

  return (
    <Drawer
      title={entity.name ?? '素材详情'}
      placement="right"
      size="large"
      open={Boolean(selectedKey)}
      onClose={() => selectRecord(null)}
    >
      {record && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={4}>{entity.name}</Title>
            <Text type="secondary">{record.source.author} / {record.source.bookName}</Text>
            <Paragraph style={{ marginTop: 12 }}>{entity.one_line}</Paragraph>
            <Space wrap>
              {entity.rank && <Tag color="red">{entity.rank}</Tag>}
              {entity.rarity && <Tag color="gold">{entity.rarity}</Tag>}
              {entity.type && <Tag>{entity.type}</Tag>}
              {entity.role && <Tag color="blue">{entity.role}</Tag>}
              {entity.archetype && <Tag color="green">{entity.archetype}</Tag>}
              {entity.faction && <Tag color="cyan">{entity.faction}</Tag>}
            </Space>
          </div>

          <Button type="primary" onClick={openSourceBook}>打开原书</Button>

          <div>
            <Text strong>游戏标签</Text>
            <Space wrap style={{ display: 'flex', marginTop: 8 }}>
              {(annotation?.gameTags ?? []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
              <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onPressEnter={addTag} placeholder="新增标签" style={{ width: 140 }} />
              <Button onClick={addTag}>添加</Button>
            </Space>
          </div>

          <div>
            <Text strong>强度评分</Text>
            <InputNumber min={1} max={10} value={annotation?.strengthScore} onChange={(value) => selectedKey && updateAnnotation(selectedKey, { strengthScore: value ?? undefined })} style={{ display: 'block', marginTop: 8 }} />
          </div>

          <div>
            <Text strong>设计备注</Text>
            <Input.TextArea value={annotation?.designNotes} onChange={(event) => selectedKey && updateAnnotation(selectedKey, { designNotes: event.target.value })} rows={4} style={{ marginTop: 8 }} />
          </div>

          <div>
            <Text strong>导出状态</Text>
            <Select
              value={annotation?.exportEnabled ?? true}
              onChange={(exportEnabled) => selectedKey && updateAnnotation(selectedKey, { exportEnabled })}
              options={[
                { value: true, label: '参与导出' },
                { value: false, label: '不参与导出' },
              ]}
              style={{ display: 'block', width: 160, marginTop: 8 }}
            />
          </div>
        </Space>
      )}
    </Drawer>
  );
};

export default LibraryDetailDrawer;
```

- [ ] **Step 6: Wire filters, sections, records, and drawer into the page**

Modify `GlobalLibraryDashboard.tsx` to import:

```tsx
import { useMemo } from 'react';
import { annotateRecords } from '../../utils/libraryAnnotations';
import { filterCharacters, filterFactions, filterItems, filterSkills, getUniqueFilterValues } from '../../utils/libraryFilters';
import { isLegendaryItem, isTopTierSkill } from '../../utils/libraryAggregate';
import LibraryDetailDrawer from './LibraryDetailDrawer';
import LibraryFiltersPanel from './LibraryFilters';
import LibraryRecordTable from './LibraryRecordTable';
```

Inside the component, read these store values:

```tsx
const { section, setSection, filters, setFilters, resetFilters, selectRecord, annotations, hydrateAnnotations } = useLibraryStore();
```

After `collections`, compute:

```tsx
const filterOptions = useMemo(() => ({
  rank: getUniqueFilterValues(data.skills.map((record) => record.entity.rank)),
  author: getUniqueFilterValues(books.map((book) => book.author)),
  bookPath: books.map((book) => ({ label: `${book.author} / ${book.name}`, value: book.path })),
  type: getUniqueFilterValues([
    ...data.skills.map((record) => record.entity.type),
    ...data.factions.map((record) => record.entity.type),
    ...data.items.map((record) => record.entity.type),
  ]),
  faction: getUniqueFilterValues([
    ...data.skills.map((record) => record.entity.faction),
    ...data.characters.map((record) => record.entity.faction),
  ]),
  role: getUniqueFilterValues(data.characters.map((record) => record.entity.role)),
  archetype: getUniqueFilterValues(data.characters.map((record) => record.entity.archetype)),
  rarity: getUniqueFilterValues(data.items.map((record) => record.entity.rarity)),
}), [books, data.characters, data.factions, data.items, data.skills]);

const topSkills = useMemo(() => filterSkills(data.skills.filter((record) => isTopTierSkill(record.entity)), filters), [data.skills, filters]);
const characters = useMemo(() => filterCharacters(data.characters, filters), [data.characters, filters]);
const factions = useMemo(() => filterFactions(data.factions, filters), [data.factions, filters]);
const legendaryItems = useMemo(() => filterItems(data.items.filter((record) => isLegendaryItem(record.entity)), filters), [data.items, filters]);
```

Replace the placeholder section body with:

```tsx
{section !== 'overview' && section !== 'export' && (
  <LibraryFiltersPanel
    filters={filters}
    options={filterOptions}
    onChange={setFilters}
    onReset={resetFilters}
  />
)}
{section === 'skills' && <LibraryRecordTable records={annotateRecords(topSkills, annotations)} onOpen={selectRecord} />}
{section === 'characters' && <LibraryRecordTable records={annotateRecords(characters, annotations)} onOpen={selectRecord} />}
{section === 'factions' && <LibraryRecordTable records={annotateRecords(factions, annotations)} onOpen={selectRecord} />}
{section === 'items' && <LibraryRecordTable records={annotateRecords(legendaryItems, annotations)} onOpen={selectRecord} />}
{section === 'overview' && <LibraryRecordTable records={annotateRecords(topSkills.slice(0, 20), annotations)} onOpen={selectRecord} />}
<LibraryDetailDrawer collections={collections} />
```

- [ ] **Step 7: Run record table test and page test**

Run:

```bash
cd dashboard
npm run test -- src/components/library/LibraryRecordTable.test.tsx src/components/library/GlobalLibraryDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/library/LibraryFilters.tsx dashboard/src/components/library/LibraryRecordTable.tsx dashboard/src/components/library/LibraryDetailDrawer.tsx dashboard/src/components/library/GlobalLibraryDashboard.tsx dashboard/src/components/library/LibraryRecordTable.test.tsx
git commit -m "feat: render global library material views"
```

## Task 9: Export Panel

**Files:**
- Create: `dashboard/src/components/library/LibraryExportPanel.tsx`
- Modify: `dashboard/src/components/library/GlobalLibraryDashboard.tsx`
- Test: `dashboard/src/components/library/LibraryExportPanel.test.tsx`

- [ ] **Step 1: Write failing export panel test**

Create `dashboard/src/components/library/LibraryExportPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '../../types/novel';
import type { AnnotatedLibraryRecord } from '../../types/library';
import LibraryExportPanel from './LibraryExportPanel';

describe('LibraryExportPanel', () => {
  it('shows export counts and creates a download', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL });

    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLAnchorElement;
      if (tagName === 'a') element.click = click;
      return element;
    });

    const records: AnnotatedLibraryRecord<Skill>[] = [
      { key: 'skill:book:s1', kind: 'skill', source: { author: '金庸', bookName: '射雕英雄传', bookPath: 'book' }, entity: { id: 's1', name: '九阴真经' } as Skill, annotation: null },
    ];

    render(<LibraryExportPanel records={records} />);

    expect(screen.getByText('可导出素材 1 条')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run export panel test and verify failure**

Run:

```bash
cd dashboard
npm run test -- src/components/library/LibraryExportPanel.test.tsx
```

Expected: FAIL because `LibraryExportPanel.tsx` does not exist.

- [ ] **Step 3: Implement export panel**

Create `dashboard/src/components/library/LibraryExportPanel.tsx`:

```tsx
import React from 'react';
import { Button, Space, Typography } from 'antd';
import type { AnnotatedLibraryRecord } from '../../types/library';
import { serializeLibraryCsv, serializeLibraryJson } from '../../utils/libraryExport';

const { Paragraph, Text } = Typography;

interface LibraryExportPanelProps {
  records: AnnotatedLibraryRecord<unknown>[];
}

function downloadText(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const LibraryExportPanel: React.FC<LibraryExportPanelProps> = ({ records }) => {
  const exportableRecords = records.filter((record) => record.annotation?.exportEnabled !== false);

  return (
    <div>
      <Paragraph>
        <Text strong>可导出素材 {exportableRecords.length} 条</Text>
      </Paragraph>
      <Space>
        <Button
          type="primary"
          disabled={exportableRecords.length === 0}
          onClick={() => downloadText('wuxia-library-export.json', 'application/json;charset=utf-8', serializeLibraryJson(exportableRecords))}
        >
          导出 JSON
        </Button>
        <Button
          disabled={exportableRecords.length === 0}
          onClick={() => downloadText('wuxia-library-export.csv', 'text/csv;charset=utf-8', serializeLibraryCsv(exportableRecords))}
        >
          导出 CSV
        </Button>
      </Space>
    </div>
  );
};

export default LibraryExportPanel;
```

- [ ] **Step 4: Wire export panel into global page**

In `GlobalLibraryDashboard.tsx`, import:

```tsx
import LibraryExportPanel from './LibraryExportPanel';
```

Compute export records:

```tsx
const exportRecords = useMemo(
  () => annotateRecords([...topSkills, ...characters, ...factions, ...legendaryItems], annotations),
  [annotations, characters, factions, legendaryItems, topSkills],
);
```

Add section rendering:

```tsx
{section === 'export' && <LibraryExportPanel records={exportRecords} />}
```

- [ ] **Step 5: Run export panel and page tests**

Run:

```bash
cd dashboard
npm run test -- src/components/library/LibraryExportPanel.test.tsx src/components/library/GlobalLibraryDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/library/LibraryExportPanel.tsx dashboard/src/components/library/LibraryExportPanel.test.tsx dashboard/src/components/library/GlobalLibraryDashboard.tsx
git commit -m "feat: export global library material"
```

## Task 10: Final Verification And UX Check

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Run all unit and component tests**

Run:

```bash
cd dashboard
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
cd dashboard
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
cd dashboard
npm run build
```

Expected: PASS and Vite emits `dashboard/dist`.

- [ ] **Step 4: Run existing UX verification**

Run:

```bash
cd dashboard
npm run test:ux
```

Expected: PASS. If the script requires a running app, run `npm run dev -- --host 127.0.0.1` in one terminal, then rerun `npm run test:ux` in another terminal.

- [ ] **Step 5: Manual browser smoke test**

Run:

```bash
cd dashboard
npm run dev -- --host 127.0.0.1
```

Open the printed local URL and verify:

- `全库总览` appears in the left navigation.
- `总览` shows non-zero counts for the current processed library.
- `顶级武功` shows records from multiple books.
- Rank, author, book, type, faction, role, archetype, rarity, and keyword filters reduce visible records.
- Opening a record shows source metadata and annotation controls.
- `打开原书` selects the source book and opens the single-book detail route.
- `导出 JSON` and `导出 CSV` download files with source metadata and annotations.

- [ ] **Step 6: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended implementation files are modified. Do not add `.superpowers/` or unrelated untracked files such as `skills-lock.json`.

- [ ] **Step 7: Commit verification fixes**

If Step 1 through Step 5 required code changes, commit them:

```bash
git add dashboard
git commit -m "fix: polish global library dashboard"
```

If no changes were required, do not create an empty commit.
