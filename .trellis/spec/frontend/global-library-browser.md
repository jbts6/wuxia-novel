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

Supported global entity kinds are `character`, `faction`, `skill`, and `item`. Chapter summaries are the fifth visible Dashboard content surface and use the dedicated `/:author/:book/chapter-summaries` route; they are not a global entity kind, entity-count category, or content-coverage category.

## 3. Contracts

- Only books with `LibraryBookStatus.browseable === true` enter the global index.
- Global loading reuses `loadBookData`, its normalized `NovelData` cache, and `GET /api/library/book-data`; it does not add a bulk API or bundle core files into the client.
- The client consumes the structured JSON response from the API after server-side YAML parsing. It must not probe or request `.json` or `.yml` core-data alternatives.
- The default client-side load limit is four books at a time. A failed book returns a warning and does not discard records loaded from other books.
- Every `AnyLibraryRecord` includes a stable key, discriminated entity kind, author/book/path source, name, summary, entity-specific facet, normalized search text, and deduplicated source evidence.
- File completeness and entity content coverage are separate contracts. `dataCompleteness` reports the five required YAML files that exist and satisfy the minimum browsing shape; `contentCoverage` reports how many characters, factions, skills, and items contain meaningful structured fields beyond `id`, `name`, and `source_refs`.
- A browseable book may be `index-only` or `partial`, but it cannot be marked completed until four-entity coverage is complete and the existing validation gate passes. Chapter-summary validation remains separate and does not inflate named-entity coverage.
- Search text may include entity names, aliases, descriptions, entity-specific fields, related names, and source-ref text. Rendering code must not rebuild this contract.
- Entity IDs remain valid only for keys, routes, deep links, search indexing, and relationship lookup. Visible text resolves relationships through the current book's entity maps; unresolved technical IDs do not appear as visible content.
- English schema enums remain unchanged in the JSON payload but pass through `displayTaxonomyValue` before rendering. Known values use explicit Chinese labels; unknown pure-English structured values use a Chinese fallback instead of appearing verbatim.
- Global details for an index-only entity show an explicit Chinese status notice and available source evidence. They must not render empty metadata sections or placeholder rows as if those values were real content.
- `normalizeNovelData` maintains field-level compatibility only: character display fields use `level ?? role` and `rank ?? power_rank`, retain `summary`, and project nested skill-technique objects to their `name` while continuing to accept legacy string techniques. This is not storage-format fallback.
- `/browse` renders at most 50 records per page.
- Query, filters, sorting, page, and selected global detail are URL state. Scroll position is stored in `sessionStorage` under the current `/browse` query and restored after returning from a book route.
- A global detail deep link uses the entity page plus `?detail=<entity-id>`. The four entity pages consume that parameter through `useEntityDetailParam` and open the existing detail sheet after book data loads.
- Navigation to a book carries `libraryReturnTo` in router state so the top navigation can return to the exact global-search URL.
- The fixed desktop layout is verified at 1440x1000. No mobile or responsive variant is required.

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
| Base UI sheet width conflicts with defaults | Global detail retains at least 540px width in desktop E2E |

## 5. Good / Base / Bad Cases

- Good: 16 browseable books load into one four-kind index, a keyword matches evidence text, and the user returns from the exact book entity to the same search and scroll position.
- Base: no query or filters; records are sorted deterministically and only the first 50 render.
- Bad: one book-data request fails; the page still shows every other result and exposes a failure summary instead of a blank screen.
- Compatibility: a v4 character with `level`, `rank`, and `summary`, plus an object technique with a `name`, renders through the existing display shape; legacy field aliases and string techniques continue to work at that boundary only.

## 6. Tests Required

- Unit: all four global entity kinds are indexed with source metadata and evidence-search support.
- Unit: loader concurrency never exceeds the configured bound and one rejected book becomes a warning.
- Component: 60 global records create 50 rows on page one and 10 on page two.
- Component: alias search opens evidence and creates the exact single-book `?detail=` link.
- Unit: character `level`, `rank`, and `summary` and object or string skill techniques normalize to the expected display shape.
- Server or component: the five YAML files determine completeness, while only four entity categories determine status counts and coverage.
- Component: locations, dialogues, events, and game-material surfaces do not appear in routes, navigation, overview cards, chapter-summary views or details, workbench copy, or global filters.
- Desktop E2E: real repository index loads, each page has no more than 50 rows, an entity deep link opens, and returning restores URL state and scroll position.

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
```

The bounded loader protects the local Vite server, per-book warnings preserve partial success, and pagination caps DOM growth independently of total record count. The shared resolver keeps technical identifiers available for navigation and indexing without exposing them as novel content.
