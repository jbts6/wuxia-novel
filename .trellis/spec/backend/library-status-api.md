# Library Status API

## 1. Scope / Trigger

Use this contract when changing the Dashboard's local knowledge-base discovery, status derivation, entity counts, or book-data loading. The library status and book-data controller is a read-only projection over repository files: the server parses YAML into JavaScript values and sends those values in JSON HTTP responses. It must never execute generation commands, write knowledge-base files, watch directories, or poll automatically.

## 2. Signatures

```http
GET /api/library/status
GET /api/library/book-data?path=<author>/<book>
```

```ts
type KnowledgeEntityKey =
  | 'characters'
  | 'factions'
  | 'skills'
  | 'items';

type CoreDataFileKey = KnowledgeEntityKey | 'chapter_summaries';

const DATA_FILE_NAMES: Record<CoreDataFileKey, string> = {
  characters: 'characters.yaml',
  factions: 'factions.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml',
};

type KnowledgeEntityCounts = Record<KnowledgeEntityKey, number | null>;
type BookData = Record<CoreDataFileKey, unknown[]>;
```

Both Vite development and preview servers must install the same `libraryApiPlugin` middleware.

## 3. Contracts

`GET /api/library/status` scans once per request and returns `LibraryStatusResponse` with `Cache-Control: no-store`.

Each `LibraryBookStatus` contains:

- The existing generation stage and manifest window-coverage counters.
- Five-file YAML completeness and browseability state.
- Four `entityCounts` values: characters, factions, skills, and items.
- Four-entity content coverage, validation state, completion state, errors, missing artifacts, and a suggested read-only command string.

`chapter_summaries.yaml` is required for completeness and `/book-data`, but chapter summaries are not an entity count or content-coverage category.

The server reads each required file with `js-yaml`. `yaml.load()` produces `unknown`; the scanner requires a top-level array and applies the existing key-specific minimum record validation before deriving status or returning data. Every validation error identifies the YAML file that caused it.

For the four entity YAML files only, a missing, malformed, non-array, or contract-invalid file produces `null` for that entity's count, not `0`; a valid empty entity array produces `0`. A missing, malformed, non-array, or contract-invalid `chapter_summaries.yaml` records a file-specific error and makes the book incomplete and non-browseable, but leaves all four entity counts unchanged.

The core storage boundary is exactly the five files in `DATA_FILE_NAMES`. Core scanning and loading do not probe `.json` or `.yml` alternatives, and a stale JSON sibling is ignored even when its YAML counterpart is missing or invalid.

Window coverage and entity counts are different measurements:

- `scanProgress.*` counts processed source windows from `scan-manifest.json`.
- `entityCounts.*` counts records in validated YAML arrays for the four entity categories.

`GET /api/library/book-data` accepts only a discovered `author/book` path whose five required YAML files are browseable. It returns a structured object with exactly the five `CoreDataFileKey` values and `Content-Type: application/json`. JSON is the HTTP response encoding after server-side YAML parsing; the server does not create or read a JSON core-data mirror.

## 4. Review Path Contract (Separate Controller)

`/api/review/*` is a separate, write-capable review controller. It is not part of the read-only library status/book-data controller described above and does not change `/api/library/book-data` server-parse -> JSON-value semantics.

- Review list, read, write, and backup operations accept `.yaml` data files only. Listings ignore `.json` and `.yml`; direct operations reject them, and no operation probes either extension as a fallback.
- Review HTTP requests and responses still use JSON envelopes. A review read returns the stored YAML document as a JSON string field; a review write receives YAML document content in a JSON request body. The frontend/store parses and serializes that string with `js-yaml` load/dump operations; the review server does not replace this intentional raw-content editing boundary with server-side parse/dump.
- Record deletion is a read -> YAML-preserving backup -> YAML write sequence. A failed backup or write must not be reported as a successful deletion.
- Backup names preserve the source `.yaml` filename so the stored format remains explicit.
- Existing path confinement remains mandatory for both data-file and backup targets; review operations cannot escape the allowed data and backup roots.

## 5. Validation & Error Matrix

| Condition | Result |
|---|---|
| Non-GET request under `/api/library/` | `405`, read-only error |
| Missing `path` query | `400` |
| Unknown API path | `404` |
| Unsafe, undiscovered, or non-browseable book path | `422` |
| Missing entity YAML file | Corresponding entity count `null`, missing artifact recorded, book not browseable |
| Malformed, non-array, or contract-invalid entity YAML file | Corresponding entity count `null`, file-specific error recorded, book not browseable |
| Missing, malformed, non-array, or contract-invalid `chapter_summaries.yaml` | Filename-specific failure recorded, book incomplete and non-browseable, four entity counts unchanged |
| Valid empty entity array | Count `0` |
| One book fails inspection | Other books remain in the status response |

## 6. Good / Base / Bad Cases

- Good: all five YAML files are valid, four entity counts are returned, and the book is browseable.
- Base: only source text exists; every entity count is `null`, and the book remains visible as not generated.
- Bad: `characters.yaml` cannot parse; `characters` is `null`, an error names the file, and the failure does not abort the library scan.
- Bad summary: `chapter_summaries.yaml` cannot parse; the book is incomplete and non-browseable, an error names the file, and the four entity counts retain their independently validated values.
- Stale sibling: `characters.json` is present alongside missing or invalid `characters.yaml`; the book remains non-browseable based on the YAML failure.

## 7. Tests Required

- Scanner unit test: valid fixtures return exact four-entity record counts, including a valid zero count, and require all five YAML files.
- Scanner unit test: missing, malformed, non-array, and contract-invalid YAML each produce a file-specific failure while other books remain scannable.
- Scanner unit test: missing, malformed, non-array, and contract-invalid `chapter_summaries.yaml` each make the book incomplete and non-browseable without changing the four independently derived entity counts; these assertions must be distinct from entity-file count-failure assertions.
- Scanner unit test: a stale JSON sibling cannot satisfy completeness or shadow valid or invalid YAML.
- API test: status requests return the projection, reject non-GET methods, and preserve per-book failure isolation.
- API test: `/book-data` returns exactly the five parsed YAML arrays with an `application/json` response.
- Component or API presentation test: chapter summaries are required data but are not included in the four entity counts or content-coverage categories.
- Review focused tests: listing, raw-text read/write, parse/dump, backup naming, deletion sequencing, extension rejection/no-fallback behavior, and allowed-root confinement remain YAML-only.

## 8. Wrong vs Correct

### Wrong

```ts
// A completed source-window pass is not an entity total.
const characterCount = book.scanProgress['named-inventory'].completed;
```

### Correct

```ts
const value = readYaml('data/characters.yaml');
const characterCount = validateDataFile('characters', value)
  ? value.length
  : null;
```

The table may summarize character, skill, and item counts for density. The detail sheet is the authoritative four-category count view; chapter summaries and window coverage belong to separate views.
