# Library Status API

## 1. Scope / Trigger

Use this contract when changing the Dashboard's local knowledge-base discovery, status derivation, entity counts, or book-data loading. The API is a read-only projection over repository files. It must never execute generation commands, write knowledge-base files, watch directories, or poll automatically.

## 2. Signatures

```http
GET /api/library/status
GET /api/library/book-data?path=<author>/<book>
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

Legacy dialogues without an `id` are valid only when they contain speaker, chapter, and text fields needed by the Dashboard normalizer.

## 5. Good / Base / Bad Cases

- Good: all eight files are valid, seven real counts are returned, and the book is browseable.
- Base: only source text exists; every entity count is `null`, and the book remains visible as not generated.
- Bad: `characters.json` cannot parse; `characters` is `null`, an error names the file, and the failure does not abort the library scan.

## 6. Tests Required

- Scanner unit test: valid fixtures return exact seven-file record counts, including a valid zero count.
- Scanner unit test: malformed files produce `null` for that category and keep other books scannable.
- API test: status requests return the projection and reject non-GET methods.
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
```

The table may summarize character, skill, and item counts for density. The detail sheet is the authoritative seven-category count view; window coverage belongs in a separate production-evidence section.
