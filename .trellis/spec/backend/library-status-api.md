# Library Status API

## 1. Scope / Trigger

Use this contract when changing the Dashboard's local knowledge-base discovery, status derivation, entity counts, or book-data loading. The API is a read-only projection over repository files. It must never execute generation commands, write knowledge-base files, watch directories, or poll automatically.

## 2. Signatures

```http
GET /api/library/status
GET /api/library/book-data?path=<author>/<book>
GET /api/library/book-extras?path=<author>/<book>
```

```ts
type KnowledgeEntityKey =
  | 'characters'
  | 'factions'
  | 'locations'
  | 'skills'
  | 'techniques'
  | 'items'
  | 'dialogues';

type KnowledgeEntityCounts = Record<KnowledgeEntityKey, number | null>;

type OptionalResourceResult<T> =
  | { status: 'available'; data: T }
  | { status: 'missing'; data: null }
  | { status: 'invalid'; data: null; error: string };

interface RawBookExtrasResponse {
  events: OptionalResourceResult<unknown[]>;
  gameMaterials: OptionalResourceResult<unknown>;
}
```

Both Vite development and preview servers must install the same `libraryApiPlugin` middleware.

## 3. Contracts

`GET /api/library/status` scans once per request and returns `LibraryStatusResponse` with `Cache-Control: no-store`.

Each `LibraryBookStatus` contains:

- Generation stage and three manifest window-coverage counters.
- Eight-file completeness and browseability state.
- Seven `entityCounts` values. `chapter_summaries.json` is intentionally excluded.
- Validation state, completion state, errors, missing artifacts, and a suggested read-only command string.

An entity count is the length of a parsed array only after that file satisfies its minimum Dashboard contract. Missing, malformed, or contract-invalid files return `null`, not `0`. A valid empty array returns `0`.

Window coverage and entity counts are different measurements:

- `scanProgress.*` counts processed source windows from `scan-manifest.json`.
- `entityCounts.*` counts records in validated `data/*.json` arrays.

`GET /api/library/book-data` accepts only a discovered `author/book` path whose eight consumer files are browseable. Successful data is normalized by the frontend before page components consume it.

`GET /api/library/book-extras` applies the same discovered-path and browseability checks, but reads only `data/events.json` and `reports/game_materials.json`. Each optional file has an independent `available`, `missing`, or `invalid` result. An optional-file failure must not change `dataCompleteness.required === 8`, `browseable`, the seven entity counts, or the `/book-data` payload.

`scanLibrary()` must not read or count the optional files. This keeps status scans and the global `/browse` index on the eight-file core contract.

## 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Non-GET request under `/api/library/` | `405`, read-only error |
| Missing `path` query | `400` |
| Unknown API path | `404` |
| Unsafe, undiscovered, or non-browseable book path | `422` |
| Missing entity file | Corresponding count `null`, missing artifact recorded, book not browseable |
| Malformed or invalid entity file | Corresponding count `null`, error recorded, book not browseable |
| Valid empty entity array | Count `0` |
| One book fails inspection | Other books remain in the status response |
| Both optional files missing | `/book-extras` returns `200`; both resources are `missing` |
| One optional file is malformed or has an invalid minimum shape | `/book-extras` returns `200`; that resource is `invalid` with a file-specific error and the other resource is preserved |
| Optional file contains a valid empty array/report | Resource is `available` with empty data, not `missing` |
| Extras request targets an unsafe, undiscovered, or non-browseable book | `422`; core status and book-data behavior remain unchanged |

Legacy dialogues without an `id` are valid only when they contain speaker, chapter, and text fields needed by the Dashboard normalizer.

## 5. Good / Base / Bad Cases

- Good: all eight files are valid, seven real counts are returned, and the book is browseable.
- Base: only source text exists; every entity count is `null`, and the book remains visible as not generated.
- Bad: `characters.json` cannot parse; `characters` is `null`, an error names the file, and the failure does not abort the library scan.
- Optional good: both extension files are valid and returned without adding keys to `/book-data`.
- Optional base: an eight-file legacy book has no extension files; it stays browseable and both extension resources are `missing`.
- Optional bad: `events.json` is malformed while `game_materials.json` is valid; events are `invalid`, game materials remain `available`, and the core book still opens.

## 6. Tests Required

- Scanner unit test: valid fixtures return exact seven-file record counts, including a valid zero count.
- Scanner unit test: malformed files produce `null` for that category and keep other books scannable.
- API test: status requests return the projection and reject non-GET methods.
- Scanner/API test: optional files do not change the eight-file completeness gate or seven entity counts.
- API test: `/book-data` remains exactly the eight `DATA_FILE_NAMES`; `/book-extras` distinguishes missing, valid empty, invalid, and available resources.
- API test: a malformed optional file does not suppress the other optional resource and does not block a core data request.
- Component test: the table shows only character, skill, and item counts; the detail sheet shows all seven categories.
- Desktop E2E: status is loaded from the real API, table cells do not overflow, and the detail sheet remains keyboard-accessible.

## 7. Wrong vs Correct

### Wrong

```ts
// A completed source-window pass is not an entity total.
const characterCount = book.scanProgress['named-inventory'].completed;
```

### Correct

```ts
const value = readJson('data/characters.json');
const characterCount = validateDataFile('characters', value)
  ? value.length
  : null;

const extras = {
  events: readOptionalResource('data/events.json', validateEvents),
  gameMaterials: readOptionalResource('reports/game_materials.json', validateGameMaterials),
};
```

The table may summarize character, skill, and item counts for density. The detail sheet is the authoritative seven-category count view; window coverage belongs in a separate production-evidence section.
Optional resources belong to `/book-extras`; adding them to `DATA_FILE_NAMES`, `/book-data`, or `scanLibrary()` would silently turn an optional game-design projection into a core browseability gate.
