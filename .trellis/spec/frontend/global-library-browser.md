# Global Library Browser

## 1. Scope / Trigger

Use this contract when changing Dashboard book-data scanning/loading, strict semantic-contract V6 normalization, entity ID resolution, reverse relationship indexes, the `/browse` cross-book index, entity pages, deep links, or large-list rendering. The Dashboard is a read-only consumer of exactly five installed YAML files.

## 2. Signatures

```ts
normalizeNovelData(value: unknown): NovelData

buildIdMaps(data: NovelData): {
  characterMap: Map<string, string>;
  skillMap: Map<string, string>;
  itemMap: Map<string, string>;
  factionMap: Map<string, string>;
  skillUsers: Map<string, string[]>;
  factionMembers: Map<string, string[]>;
}

useNovelStore.getState().loadData(value: unknown): void
useNovelStore.getState().clearData(): void

buildGlobalLibraryRecords(book: LibraryBookStatus, data: NovelData): AnyLibraryRecord[]

loadGlobalLibraryRecords(
  books: LibraryBookStatus[],
  loadBook: (bookPath: string) => Promise<NovelData>,
  options?: { concurrency?: number; onProgress?: (completed: number, total: number) => void },
): Promise<GlobalLibraryLoadResult>
```

`GET /api/library/book-data?path=<author/book>` returns these arrays and no alternatives:

```text
characters, skills, items, factions, chapter_summaries
```

The `/browse` URL owns `q`, `author`, `book`, `type`, `facet`, `sort`, `page`, and `detail`. Global entity kinds are `character`, `skill`, `item`, and `faction`; chapter summaries use their dedicated route and are not a global entity kind.

## 3. Contracts

- Server scanning parses the five YAML files and calls `normalizeNovelData` on the combined payload before setting `browseable: true`. A payload that the client would reject must never be advertised as browseable.
- V6 entity records have exact fields:
  - character: `id`, `name`, `aliases[]`, `identities[]`, `level`, `rank`, `description`, `factions[]`, `skills[]`;
  - skill: `id`, `name`, `aliases[]`, `types[]`, `factions[]`, `rank`, `description`, `techniques[]` where each technique is exactly `{ name, description }`;
  - item/faction: `id`, `name`, `aliases[]`, `type`, `description`;
  - chapter summary: `chapter`, `title`, `summary`.
- Arrays are always present and use `[]` for absence. Optional scalars use `null`. Empty strings and placeholder values such as `未知`, `未分类`, `未注明`, or `暂无描述` are invalid data, not display values.
- Singular or legacy fields, inverse relationship fields, extra fields, duplicate IDs, display-name references, and dangling references are rejected. There is no field-level V4 compatibility fallback.
- `buildIdMaps` derives name maps only from the currently loaded four entity arrays. `skillUsers` and `factionMembers` are derived only from character `skills[]` and `factions[]`; no holder/member field or separate mapping artifact exists.
- Every `loadData` call rebuilds all maps and reverse indexes from scratch. This makes an overlay reload replace stale names and inverse relationships. `clearData` removes both entity data and all derived state.
- Entity IDs are retained only for keys, routes, deep links, and relationship lookup. A non-null unresolved ID throws `UnresolvedEntityError`; renderers never show a raw ID or substitute fallback text.
- Search projections consume normalized data. They include canonical names, aliases, identities/types, descriptions, nested technique names/descriptions, and resolved related names. Rendering code does not reparse raw payloads.
- Plural filters match any member of the corresponding array. Nullable rows and empty sections are omitted rather than rendered with placeholders.
- `AnyLibraryRecord` contains the entity, source book metadata, summary, facet, and normalized search text. Final V6 data has no `source_refs`, so the global record and UI do not expose an evidence field or evidence copy.
- Only books with `browseable === true` enter the global index. Loading is bounded to four books by default; one rejected book becomes a warning without discarding successful books.
- `/browse` renders at most 50 records per page. Query/filter/sort/page/detail are URL state, and the return URL plus scroll position survive navigation to a single-book entity.
- Core browseability and entity coverage use exactly five YAML files and four entity categories. Optional extras are outside this contract and must not change core file completeness.

## 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| A required YAML file is missing, malformed, or not an array | Book is not browseable; API book-data reads return `422` |
| Any entity or chapter record violates the exact V6 shape | Scanner reports the owning YAML file as failing the V6 contract; book is not browseable |
| Legacy/singular/inverse/extra field is present | `DataContractError`; no fallback or silent field removal |
| Duplicate ID or dangling/display-name reference is present | `DataContractError`; publication cannot be consumed |
| A runtime relationship lookup receives an unknown non-null ID | `UnresolvedEntityError`; raw ID and placeholder text are not rendered |
| One browseable book fails while building the global index | Warning names the book; other books remain searchable |
| Optional scalar is `null` or an array is empty | Corresponding row/section is omitted |
| Entity has only required V6 fields with `[]`/`null` content | Show `仅有索引记录`; do not invent metadata or evidence |
| Overlay reload changes/removes entities or references | Maps and reverse indexes are rebuilt; no stale entry survives |
| Requested page exceeds the filtered page count | URL is replaced with the last valid page |
| `detail` key is unknown | Detail sheet remains closed |

## 5. Good / Base / Bad Cases

- Good: a five-file V6 payload passes server scanning, loads into typed data, rebuilds maps/indexes, supports plural filtering and resolved-name search, and opens an exact deep link without exposing IDs.
- Base: a valid V6 index-only entity uses required `[]` and `null` values; it remains browseable but incomplete and renders no placeholder rows.
- Bad: a character uses singular `identity`, a skill uses `holders`, or a reference targets an absent ID. Scanning fails closed before the book enters the global index.
- Overlay: the newly installed five-file revision is loaded after backup/promotion; old name maps and inverse relationships disappear on the same load.

## 6. Tests Required

- Unit: exact V6 fields, nullable values, empty arrays, and structured techniques normalize unchanged.
- Unit: legacy/singular/inverse/extra fields, placeholders, duplicate IDs, and dangling references throw structured errors.
- Server: the scanner rejects legacy-shaped YAML before setting `browseable`, while exact V6 index-only files remain browseable but incomplete.
- Unit: current entity maps plus character-derived `skillUsers` and `factionMembers` rebuild on every load and clear completely.
- Component: aliases, identities, plural types/factions, and nested technique descriptions are searchable/filterable.
- Component: skill users and faction members render from reverse indexes; nullable metadata produces no placeholder row.
- Component: unresolved IDs surface as data errors and neither raw IDs nor fallback labels appear.
- Unit: all four global kinds are indexed without an evidence field; loader concurrency is bounded and one rejected book becomes a warning.
- Component: 60 global records create 50 rows on page one and 10 on page two; entity deep links preserve the return URL.
- Integration: API book-data returns exactly the five parsed V6 arrays and rejects a non-browseable book with `422`.

## 7. Wrong vs Correct

### Wrong

```ts
const identity = raw.identity ?? raw.identities?.[0] ?? '未注明';
const users = raw.holders ?? [];
const factionName = maps.factionMap.get(raw.faction) ?? raw.faction;
```

This silently accepts an obsolete shape, invents display content, trusts inverse fields, and can leak a technical ID.

### Correct

```ts
const data = normalizeNovelData(raw);
const maps = buildIdMaps(data);

const identities = data.characters[0].identities;
const users = maps.skillUsers.get(skillId) ?? [];
const factionNames = resolveIds(character.factions, maps.factionMap);
```

The strict boundary owns parsing once, derived state comes only from current normalized entities, and unresolved non-null IDs fail explicitly.
