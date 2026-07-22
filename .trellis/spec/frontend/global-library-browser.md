# Global Library Browser

## 1. Scope / Trigger

Use this contract when changing Dashboard book-data scanning/loading, legacy/current type normalization, entity ID resolution, reverse relationship indexes, the `/browse` cross-book index, entity pages, deep links, review-warning presentation, or large-list rendering. The Dashboard is a read-only consumer of exactly five installed YAML files plus an optional game-KB review report.

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

fetchReviewReport(bookPath: string): Promise<ReviewReport>

ReviewReportPanel(props: {
  bookPath: string;
  status: ReviewSummary;
}): JSX.Element
```

`GET /api/library/book-data?path=<author/book>` returns these arrays and no alternatives:

```text
characters, skills, items, factions, chapter_summaries
```

The `/browse` URL owns `q`, `author`, `book`, `type`, `facet`, `sort`, `page`, and `detail`. Global entity kinds are `character`, `skill`, `item`, and `faction`; chapter summaries use their dedicated route and are not a global entity kind.

## 3. Contracts

- Server scanning parses the five YAML files and calls `normalizeNovelData` on the combined payload before setting `browseable: true`. A payload that the client would reject must never be advertised as browseable.
- Entity records have exact fields:
  - character: `id`, `name`, `aliases[]`, `identities[]`, `level`, `rank`, `description`, `factions[]`, `skills[]`;
  - skill: `id`, `name`, `aliases[]`, `types[]`, `factions[]`, `rank`, `description`, `techniques[]` where each technique is exactly `{ name, description }`;
  - item/faction: `id`, `name`, `aliases[]`, `types[]`, `description`;
  - chapter summary: `chapter`, `title`, `summary`.
- On disk, skill/item/faction may use exactly one of legacy `type: string` or current `types: string[]`. `normalizeNovelData` converts both to the in-memory `types: string[]` shape. If both fields are present, it throws `LEGACY_TYPE_AND_TYPES_CONFLICT`; renderers never branch on the raw form.
- Arrays are always present and use `[]` for absence. Optional scalars use `null`. Empty strings and placeholder values such as `未知`, `未分类`, `未注明`, or `暂无描述` are invalid data, not display values.
- Singular fields outside the controlled `type` compatibility boundary, inverse relationship fields, extra fields, duplicate IDs, display-name references, and dangling references are rejected. There is no general field-level compatibility fallback.
- `buildIdMaps` derives name maps only from the currently loaded four entity arrays. `skillUsers` and `factionMembers` are derived only from character `skills[]` and `factions[]`; no holder/member field or separate mapping artifact exists.
- Every `loadData` call rebuilds all maps and reverse indexes from scratch. This makes an overlay reload replace stale names and inverse relationships. `clearData` removes both entity data and all derived state.
- Entity IDs are retained only for keys, routes, deep links, and relationship lookup. A non-null unresolved ID throws `UnresolvedEntityError`; renderers never show a raw ID or substitute fallback text.
- Search projections consume normalized data. They include canonical names, aliases, identities/types, descriptions, nested technique names/descriptions, and resolved related names. Rendering code does not reparse raw payloads.
- Plural filters match any member of the corresponding array. Skill, item, and faction lists, cards, global search, facets, and detail sheets present all normalized types rather than only the first. Nullable rows and empty sections are omitted rather than rendered with placeholders.
- `AnyLibraryRecord` contains the entity, source book metadata, summary, facet, and normalized search text. Installed core data has no `source_refs`, so the global record and entity UI do not expose an evidence field or evidence copy.
- Only books with `browseable === true` enter the global index. Loading is bounded to four books by default; one rejected book becomes a warning without discarding successful books.
- `/browse` renders at most 50 records per page. Query/filter/sort/page/detail are URL state, and the return URL plus scroll position survive navigation to a single-book entity.
- Core browseability and entity coverage use exactly five YAML files and four entity categories. Optional extras are outside this contract and must not change core file completeness.
- Library cards and the book status sheet consume `LibraryBookStatus.review` without loading report entries. Opening the sheet alone does not fetch details. When `warningCount > 0`, an explicit “查看审查警告” action loads `/api/library/review-report` on demand.
- Review detail supports `missing`, `current`, `stale`, and `invalid` summaries plus loading, empty, request error, and retry states. Current entries group by category then code and display name, chapter numbers, reason, resolution, source refs, and member refs.
- Review warnings are read-only explanations, not an editing surface. Long names, evidence, reasons, and resolutions must wrap inside the 520px status sheet (`break-words` / `overflow-wrap:anywhere`) and must not force horizontal expansion.

## 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| A required YAML file is missing, malformed, or not an array | Book is not browseable; API book-data reads return `422` |
| Any entity or chapter record violates the exact normalized shape | Scanner reports the owning YAML file as contract-invalid; book is not browseable |
| Both `type` and `types` are present | `LEGACY_TYPE_AND_TYPES_CONFLICT`; book is not browseable |
| Unsupported singular/inverse/extra field is present | `DataContractError`; no fallback or silent field removal |
| Duplicate ID or dangling/display-name reference is present | `DataContractError`; publication cannot be consumed |
| A runtime relationship lookup receives an unknown non-null ID | `UnresolvedEntityError`; raw ID and placeholder text are not rendered |
| One browseable book fails while building the global index | Warning names the book; other books remain searchable |
| Optional scalar is `null` or an array is empty | Corresponding row/section is omitted |
| Entity has only required fields with `[]`/`null` content | Show `仅有索引记录`; do not invent metadata or evidence |
| Overlay reload changes/removes entities or references | Maps and reverse indexes are rebuilt; no stale entry survives |
| Requested page exceeds the filtered page count | URL is replaced with the last valid page |
| `detail` key is unknown | Detail sheet remains closed |
| Review summary has zero warnings | Show the summary/empty state; do not request details automatically |
| Review detail request fails | Preserve the sheet, show an error, and offer explicit retry |
| Review status is stale/missing/invalid | Explain that state without disabling core browsing or inventing entries |

## 5. Good / Base / Bad Cases

- Good: a five-file current payload passes server scanning, loads into typed data, rebuilds maps/indexes, supports multi-type filtering and resolved-name search, and opens an exact deep link without exposing IDs.
- Legacy base: singular `type` becomes a one-element `types` array and follows the same rendering/search path as current data.
- Base: a valid index-only entity uses required `[]` and `null` values; it remains browseable but incomplete and renders no placeholder rows.
- Bad: a character uses singular `identity`, a skill uses `holders`, or a reference targets an absent ID. Scanning fails closed before the book enters the global index.
- Overlay: the newly installed five-file revision is loaded after backup/promotion; old name maps and inverse relationships disappear on the same load.
- Warning detail: the card shows a count, the sheet waits for an explicit click, then groups entries and keeps long evidence inside the sheet width.

## 6. Tests Required

- Unit: exact fields, nullable values, empty arrays, and structured techniques normalize unchanged.
- Unit: legacy `type` and current `types` normalize to one `types[]` model; both together throw `LEGACY_TYPE_AND_TYPES_CONFLICT`.
- Unit: unsupported singular/inverse/extra fields, placeholders, duplicate IDs, and dangling references throw structured errors.
- Server: the scanner accepts both controlled type forms before setting `browseable`, while contract-invalid index-only files remain unbrowseable.
- Unit: current entity maps plus character-derived `skillUsers` and `factionMembers` rebuild on every load and clear completely.
- Component: aliases, identities, all types/factions, and nested technique descriptions are searchable/filterable; item/faction/skill views do not drop secondary types.
- Component: skill users and faction members render from reverse indexes; nullable metadata produces no placeholder row.
- Component: unresolved IDs surface as data errors and neither raw IDs nor fallback labels appear.
- Unit: all four global kinds are indexed without an evidence field; loader concurrency is bounded and one rejected book becomes a warning.
- Component: 60 global records create 50 rows on page one and 10 on page two; entity deep links preserve the return URL.
- Integration: API book-data returns exactly the five parsed arrays and rejects a non-browseable book with `422`.
- Component: card warning count and sheet summary render without a detail request; explicit load covers grouped details, current-empty, stale, missing, invalid, loading, request error, and retry.
- Component: long review text wraps within the status sheet and never widens the 520px panel.

## 7. Wrong vs Correct

### Wrong

```ts
const types = raw.types ?? (raw.type ? [raw.type] : []);
const users = raw.holders ?? [];
const factionName = maps.factionMap.get(raw.faction) ?? raw.faction;
```

This duplicates the compatibility boundary in a renderer, silently chooses conflicting fields, trusts inverse data, and can leak a technical ID.

### Correct

```ts
const data = normalizeNovelData(raw);
const maps = buildIdMaps(data);

const identities = data.characters[0].identities;
const types = data.items[0].types;
const users = maps.skillUsers.get(skillId) ?? [];
const factionNames = resolveIds(character.factions, maps.factionMap);
```

The strict boundary owns parsing once, derived state comes only from current normalized entities, and unresolved non-null IDs fail explicitly.
