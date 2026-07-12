# Global Library Browser

## 1. Scope / Trigger

Use this contract when changing the Dashboard's `/browse` page, cross-book entity indexing, book-data concurrency, entity deep links, or large-list rendering. The browser remains a read-only consumer of the existing status and book-data APIs.

## 2. Signatures

```ts
buildGlobalLibraryRecords(book: LibraryBookStatus, data: NovelData): AnyLibraryRecord[]

filterGlobalLibraryRecords(
  records: AnyLibraryRecord[],
  filters: {
    keyword: string;
    author: string;
    bookPath: string;
    kind: 'all' | LibraryEntityKind;
    facet: string;
    sort: 'relevance' | 'name' | 'book' | 'type';
  },
): AnyLibraryRecord[]

loadGlobalLibraryRecords(
  books: LibraryBookStatus[],
  loadBook: (bookPath: string) => Promise<NovelData>,
  options?: { concurrency?: number; onProgress?: (completed: number, total: number) => void },
): Promise<GlobalLibraryLoadResult>

useLibraryStore.getState().loadGlobalLibrary(): Promise<AnyLibraryRecord[]>
```

The `/browse` URL owns these optional parameters:

```text
q, author, book, type, facet, sort, page, detail
```

Supported entity kinds are `character`, `skill`, `item`, `faction`, and `location`.

## 3. Contracts

- Only books with `LibraryBookStatus.browseable === true` enter the global index.
- Global loading reuses `loadBookData`, its normalized `NovelData` cache, and `GET /api/library/book-data`; it does not add a bulk API or bundle JSON into the client.
- The default client-side load limit is four books at a time. A failed book returns a warning and does not discard records loaded from other books.
- Every `AnyLibraryRecord` includes a stable key, discriminated entity kind, author/book/path source, name, summary, entity-specific facet, normalized search text, and deduplicated source evidence.
- File completeness and entity content coverage are separate contracts. `dataCompleteness` reports required files that exist and satisfy the minimum browsing shape; `contentCoverage` reports how many named entities contain meaningful structured fields beyond `id`, `name`, and `source_refs`.
- Content coverage applies to characters, factions, locations, skills, techniques, and items. Dialogues and chapter summaries keep their dedicated validation rules and do not inflate named-entity coverage.
- A browseable book may be `index-only` or `partial`, but it cannot be marked completed until named-entity coverage is complete and G1-G5 validation passes.
- Search text may include entity names, aliases, descriptions, entity-specific fields, related IDs/names, and source-ref text. Rendering code must not rebuild this contract.
- Entity IDs remain valid only for keys, routes, deep links, search indexing, and relationship lookup. Visible text in both global and single-book browsing must resolve relationships through the current book's entity maps.
- `resolveEntityName(id, map)` may return a mapped Chinese name or a legacy value that already contains Chinese text. It must return `null` for an unresolved technical ID. Required fields use a Chinese fallback such as `未注明势力`; optional relationship lists omit unresolved entries.
- English schema enums remain unchanged in JSON but pass through `displayTaxonomyValue` before rendering. Known values use explicit Chinese labels; unknown pure-English structured values use a Chinese fallback instead of appearing verbatim.
- Global details for an index-only entity show an explicit Chinese status notice and its available source evidence. They must not render empty metadata sections or placeholder rows such as `未分类`, `未注明`, and `暂无简介` as if those values were real content.
- `/browse` renders at most 50 records per page. The single-book dialogue page renders at most 100 dialogues per page.
- Query, filters, sorting, page, and selected global detail are URL state. Scroll position is stored in `sessionStorage` under the current `/browse` query and restored after returning from a book route.
- A global detail deep link uses the entity page plus `?detail=<entity-id>`. The five entity pages consume that parameter through `useEntityDetailParam` and open the existing detail sheet after book data loads.
- Navigation to a book carries `libraryReturnTo` in router state so the top navigation can return to the exact global-search URL.
- The fixed desktop layout is verified at 1440x1000. No mobile or responsive variant is required.
- The canonical Playwright quality gate contains `workbench.spec.ts` and `global-library.spec.ts`, runs with one worker, and binds the server to `127.0.0.1`. Legacy debug/screenshot specs are not part of the gate.

## 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Status request fails | Global error state with retry action |
| One browseable book fails to load | Warning names the book; other books remain searchable |
| No records match filters | Empty result row and `0` count; no exception |
| Requested page exceeds filtered page count | URL is replaced with the last valid page |
| `detail` key is unknown | Detail sheet remains closed |
| Single-book `detail` ID is unknown | Entity page remains usable; no sheet opens |
| Relationship ID is unknown | Raw ID is never rendered; required fields show a Chinese fallback and optional lists omit the entry |
| Structured field contains an English enum | Render its mapped Chinese label; unknown values render the field's Chinese fallback |
| Entity contains only `id`, `name`, and source evidence | Show `仅有索引记录`, omit empty metadata and summary, retain source evidence and navigation |
| Required data files exist but named entities are index-only | Book remains browseable, appears under `内容待补全`, and is not counted as completed |
| More than 5,000 dialogues match | Only the current 100-dialogue page creates content nodes |
| Base UI sheet width conflicts with defaults | Global detail must retain at least 540px width in desktop E2E |

## 5. Good / Base / Bad Cases

- Good: 16 browseable books load into one five-kind index, a keyword matches evidence text, and the user returns from the exact book entity to the same search and scroll position.
- Base: no query or filters; records are sorted deterministically and only the first 50 render.
- Bad: one book's JSON request fails; the page still shows every other result and exposes a failure summary instead of a blank screen.

## 6. Tests Required

- Unit: all five kinds are indexed with source metadata and evidence-search support.
- Unit: loader concurrency never exceeds the configured bound and one rejected book becomes a warning.
- Component: 60 global records create 50 rows on page one and 10 on page two.
- Component: alias search opens evidence and creates the exact single-book `?detail=` link.
- Unit: `char_duan_yu` resolves to `段誉`; an unknown `char_*` value never appears in rendered text.
- Unit: known enums such as `assassin` render as `刺客`; unknown English enums render a Chinese fallback.
- Unit: source refs do not count as structured entity content; current and legacy descriptive fields do.
- Server: index-only entity files remain browseable but produce `contentCoverage.state === 'index-only'` and cannot satisfy completion.
- Component: global detail and dialogue speaker rendering use Chinese entity names and hide unresolved IDs.
- Component: an index-only global detail shows its status and evidence without rendering empty metadata or summary sections.
- Component: the workbench filters `内容待补全` books and shows per-entity detailed/total coverage.
- Component: 5,001 dialogues create only 100 dialogue nodes per page.
- Desktop E2E: real repository index loads, each page has no more than 50 rows, detail width is at least 540px, entity deep link opens, and returning restores URL state and scroll position.
- Regression E2E: the Phase 1 workbench flow remains green in the same canonical suite.

## 7. Wrong vs Correct

### Wrong

```ts
// Loads every book without a bound and renders every match.
const data = await Promise.all(books.map((book) => loadBookData(book.path)));
return matches.map(renderRow);
```

### Correct

```ts
const { records, warnings } = await loadGlobalLibraryRecords(books, loadBookData, {
  concurrency: 4,
});
const visible = filterGlobalLibraryRecords(records, filters).slice(pageStart, pageStart + 50);

const holderNames = resolveIds(skill.holders, characterMap);
const factionName = resolveId(character.faction, factionMap, '未注明势力');
```

The bounded loader protects the local Vite server, per-book warnings preserve partial success, and pagination caps DOM growth independently of total record count.
The shared resolver keeps technical identifiers available for navigation and indexing without exposing them as novel content.
