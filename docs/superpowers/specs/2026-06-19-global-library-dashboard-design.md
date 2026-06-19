# Global Library Dashboard Design

## Context

The dashboard currently presents one selected novel at a time. That works for reading and validating a single deconstruction result, but it does not answer cross-novel questions such as "what are all top-tier martial arts across the novels I have processed?" The game-design workflow needs a library-level view that turns extracted novel entities into reusable material.

The existing app already has structured per-book JSON and a book registry:

- `dashboard/public/data/books.json` lists processed books.
- Each book directory exposes `characters.json`, `skills.json`, `items.json`, `locations.json`, `factions.json`, and `dialogues.json`.
- `Skill.rank`, `Skill.type`, `Skill.faction`, `Skill.techniques`, `Skill.effects`, and `Skill.progression` are enough to build a first useful martial-arts library.

## Goals

Add a first-class `全库总览` navigation entry that aggregates all processed novels without disturbing the current single-book views.

The initial global library should include:

- top-tier martial arts across all books;
- character archetype material;
- faction and sect resources;
- legendary item material;
- export support for game data;
- local game-design annotations, including tags and strength scores.

## Non-Goals

This change does not redesign the extraction schema or rewrite existing single-book routes. It should not require mutating source novel JSON just to display aggregate views.

Cross-book entity deduplication is not part of the first implementation. If two books contain similarly named skills, they remain separate records unless the user later adds an explicit merge layer.

## Product Shape

Add `全库总览` as a top-level item in the left navigation. This route is separate from the existing selected-book route set, so users can move between "library-level material" and "single-novel inspection" without changing mental modes.

The global library screen uses tabs or segmented sections:

- `总览`: counts and coverage across all processed books.
- `顶级武功`: martial arts ranked `返璞归真` or `登峰造极`.
- `人物原型`: characters grouped by role, archetype, identity, rank, and faction.
- `门派资源`: factions grouped by type, location, book, and related skills or characters.
- `神兵物品`: items filtered by rarity, type, owner, and related skills.
- `导出`: JSON/CSV export for selected material.

The first screen should make "game material" the main work surface, not a report page. Dense tables, filters, and compact cards are preferable to a marketing-style overview.

## Top-Tier Martial Arts

For the first version, "top-tier martial arts" means:

```ts
skill.rank === '返璞归真' || skill.rank === '登峰造极'
```

Each row or card should show:

- skill name;
- rank;
- type;
- source author, book, and book path;
- faction when available;
- one-line summary;
- technique count;
- effect count;
- optional progression count;
- available source references.

Filters:

- rank;
- author;
- book;
- type;
- faction;
- keyword search over name, summary, combat style, effect text, and technique names.

Actions:

- open a global detail panel;
- jump to the source book;
- copy/export selected records.

## Character Archetypes

Aggregate all characters with source metadata attached. The view should emphasize reusable game archetypes instead of only listing novel cast members.

Useful groupings:

- role: protagonist, companion, npc, villain;
- archetype: scholar, warrior, monk, assassin, healer, and observed non-standard values;
- faction;
- rank;
- author and book.

Each record should show name, identity, role, archetype, faction, rank, one-line summary, known skill count, and source book.

This view can later support "inspiration tags" such as mentor, rival, hidden boss, quest giver, merchant, healer, sect leader, or dungeon guardian.

## Faction Resources

Aggregate factions across books and retain source metadata. This view supports game world-building, sect design, and regional resource planning.

Each record should show faction name, type, location, sub-divisions, one-line summary, source book, related character count, and related skill count when derivable from current data.

Filters:

- author;
- book;
- faction type;
- location;
- keyword.

## Legendary Items

Aggregate items across books. The default focus should be high-value material, but the view should allow all item rarity values.

Initial "legendary" default:

```ts
item.rarity === '绝世神兵'
```

Each record should show item name, type, rarity, owner, origin, summary, related skills, and source book.

Filters:

- rarity;
- type;
- owner presence;
- related skill;
- author and book;
- keyword.

## Game Annotations

Game annotations should be stored separately from extracted source JSON. The extracted files remain evidence; annotations are the user's design layer.

Use a local annotation store keyed by stable global entity keys:

```ts
type GlobalEntityKind = 'skill' | 'character' | 'faction' | 'item';

type GlobalEntityKey = `${GlobalEntityKind}:${bookPath}:${entityId}`;
```

Annotation fields:

- `gameTags: string[]`;
- `strengthScore?: number` from 1 to 10;
- `designNotes?: string`;
- `exportEnabled?: boolean`.

Storage for the first implementation can be browser local storage or a generated local JSON file if the dashboard already has a write path. Prefer a file-backed path only if the current dev server supports safe writes; otherwise, start with local storage and make export include annotations.

## Data Architecture

Keep the current single-book store isolated:

- `useNovelStore` remains responsible for the selected book.
- `useDataLoader(bookPath)` remains responsible for current-book JSON.

Add global-library data as a separate path:

- `useLibraryData(books)` loads all relevant entity JSON files.
- `libraryAggregate` utilities normalize records and attach source metadata.
- `useLibraryStore` or component-local state tracks global filters, selected global entity, and annotations.

Normalized records should preserve the original entity object and add source metadata:

```ts
interface LibrarySource {
  author: string;
  bookName: string;
  bookPath: string;
}

interface LibraryRecord<T> {
  key: string;
  kind: 'skill' | 'character' | 'faction' | 'item';
  source: LibrarySource;
  entity: T;
}
```

The loader should tolerate missing files per book. A missing `items.json` in one book should not break the entire global view. The UI should surface a compact warning count rather than blocking the page.

## Navigation And Detail

Global detail panels should not reuse single-book detail state directly because IDs are only unique within a book. Use global keys that include kind, book path, and entity ID.

From a global detail panel, provide an `打开原书` action. It should select the source book and navigate to the relevant single-book route where possible:

- skill -> `/skills?detail=skill:<id>`;
- character -> `/characters?detail=character:<id>`;
- faction -> `/forces?detail=faction:<id>`;
- item -> `/items?detail=item:<id>`.

## Export

The export view should allow the user to export:

- all visible filtered records;
- selected records;
- top-tier martial arts only;
- annotations merged with extracted data.

Formats:

- JSON for game tooling;
- CSV for spreadsheets.

Exported JSON should include source metadata, original extracted fields, and annotation fields. This makes the data useful without losing provenance.

## Error Handling

Handle these cases explicitly:

- no books loaded;
- all global data files missing;
- one or more books missing an entity file;
- malformed JSON for one book;
- annotation storage unavailable;
- export attempted with no selected or visible records.

The page should remain usable when some books fail to load. Partial data is acceptable as long as warnings are visible.

## Testing

Unit tests should cover:

- top-tier skill predicate;
- global key generation;
- aggregation with source metadata;
- missing-file and malformed-file tolerance;
- filtering by rank, author, book, type, faction, rarity, role, and keyword;
- export shape with annotations.

UI verification should cover:

- `全库总览` appears in navigation;
- loading state for global data;
- top-tier skills render across multiple books;
- filters reduce visible records correctly;
- detail panel opens with the right source metadata;
- `打开原书` navigates to the source single-book detail;
- export produces JSON and CSV.

## Implementation Notes

The existing Vite middleware only serves one book and one file at a time through `/api/novel/:file?book=...`. The global loader can either call that endpoint for every book and file, or the middleware can add a read-only `/api/library/:file` endpoint that returns `{ book, data }[]` batches.

Prefer starting with a small reusable client-side loader unless performance becomes a real issue. The current processed-book count is small enough for parallel fetches, and this avoids adding server API surface before it is needed.

When fetching many books, use bounded concurrency in the client rather than firing every request at once.

## Acceptance Criteria

The design is complete when a user can open `全库总览`, see all processed-book material, filter top-tier martial arts across novels, inspect provenance, annotate records for game design, and export selected data without affecting the existing single-book dashboard.
