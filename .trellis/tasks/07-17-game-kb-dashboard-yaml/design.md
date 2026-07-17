# Migrate Dashboard to YAML knowledge base - Design

## Decision

Parse the five installed YAML files on the Dashboard server with `js-yaml`, validate the resulting JavaScript values at the existing scanner boundary, and return structured JSON through the existing HTTP API. The browser does not parse core YAML and no `.json` or `.yml` storage fallback is introduced.

The UI contract contracts to four entity collections plus chapter summaries. Removed-category and game-material routes and navigation disappear now; deeper deletion of unused legacy modules remains ordered after this child in `game-kb-cleanup-performance`.

## Boundaries

### Storage and API

`DATA_FILE_NAMES` is the single Dashboard source of truth:

```ts
{
  characters: 'characters.yaml',
  factions: 'factions.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml',
}
```

`scanLibrary()` and `readBookData()` read only those paths. `yaml.load()` produces `unknown`; the scanner then requires an array and applies the key-specific minimum record shape. The API sends the validated values with `application/json`; it does not write a JSON mirror.

### Failure Isolation

Each required file contributes independently to `present`, `valid`, counts, missing entries, and errors. YAML syntax errors, non-array documents, and invalid records make only that book non-browseable. `scanLibrary()` continues scanning sibling books. A stale JSON sibling is never inspected and therefore cannot satisfy completeness or hide a YAML error.

### Frontend Normalization

The server returns raw validated arrays and `normalizeNovelData()` owns field-level compatibility:

- character display role receives `level ?? role`;
- character power rank receives `rank ?? power_rank`;
- character summary is retained for current cards and search;
- each skill technique accepts a legacy string or a v4 object with a non-empty `name` and becomes a deduplicated display string.

Removed top-level collections receive empty normalized defaults only where existing shared types still require them. They are not loaded from storage and are not reachable through routes or global filters.

### Review Flow

The review API lists `.yaml` files only. The store builds `${bookPath}/data/${fileType}.yaml`, parses and serializes YAML, and keeps backup extensions as `.yaml`. A failed YAML read is surfaced directly; no second JSON request is issued.

### Visible Surface

`App`, `SideNav`, `BookOverview`, and global library entity-kind contracts expose characters, factions, skills, items, and chapter summaries. Locations, dialogues, events, and game materials have no route, navigation item, count card, or global filter. Legacy implementation files may remain temporarily unreferenced so the cleanup child can remove the whole obsolete dependency graph together.

### Installation Dependency

The preceding assemble/verify child already makes installation an atomic whole-directory replacement and tests that legacy JSON is moved into the backup. This child relies on that invariant and adds consumer-side proof that JSON is ignored; it does not duplicate installer logic.

## Data Flow

```text
installed data/*.yaml
  -> server yaml.load + key-specific validation
  -> /api/library/status and /api/library/book-data JSON responses
  -> normalizeNovelData field projection
  -> five supported Dashboard surfaces
```

The review path is intentionally separate:

```text
data/*.yaml <-> review API raw text <-> review store js-yaml parse/dump
```

## Compatibility

Compatibility is allowed only inside record normalization. File names, extensions, required-file counts, scanner keys, API payload keys, review paths, and UI categories have no old-format fallback. This prevents an old JSON file from silently winning over a new YAML run.

## Testing

- Scanner tests cover exact five-file completeness, four entity counts, valid empty arrays, malformed YAML, non-array YAML, invalid records, per-book isolation, and stale JSON non-shadowing.
- API tests assert the five-key structured payload and JSON wire response.
- Normalizer tests cover `level`, `rank`, `summary`, technique objects, legacy strings, and deduplication.
- Review tests cover YAML-only listing and store read/delete behavior without a fallback request.
- Route/navigation/overview tests or structural assertions prove removed surfaces are absent.
- Final gates run Dashboard tests, lint, build, focused generate-game-kb installer regression, and `git diff --check HEAD`.

## Rollback Shape

All changes remain isolated in `feat/game-kb-yaml-flow`. No commit, merge, push, or archive is performed. If the Dashboard gate fails, revert only this child’s five-file consumer changes; installed YAML and the preceding assembler/verifier work remain untouched.
