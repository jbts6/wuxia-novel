# Migrate Dashboard to YAML knowledge base

## Goal

Make Dashboard and library consumers use the installed five-file YAML knowledge base without stale JSON, removed-category, or field-shape ambiguity.

## Background

- The v4 installer already replaces the whole `data/` directory with exactly `characters.yaml`, `factions.yaml`, `skills.yaml`, `items.yaml`, and `chapter_summaries.yaml`; the previous directory is archived instead of merged.
- Dashboard now scans the installed YAML files, omits retired content surfaces, and displays v4 `level`, `rank`, and nested technique objects through field-level normalization.
- YAML is the storage contract. JSON remains only the HTTP response encoding after the server parses YAML into JavaScript values.

## Requirements

- `DATA_FILE_NAMES`, scanner completeness, entity counts, content coverage, and `/api/library/book-data` use exactly the five `.yaml` files.
- Server-side scanning and book-data loading use `js-yaml`, require a top-level array, apply the existing per-file minimum record validation, and isolate malformed books without aborting the library scan.
- A stale `.json` sibling is ignored even when its YAML counterpart is missing or malformed; there is no storage-format fallback.
- Dashboard normalization maps character `level ?? role` to the existing display field, maps `rank ?? power_rank`, preserves `summary`, and projects skill technique objects to their `name` values while continuing to accept legacy string techniques.
- Review list/read/write/backup flows accept and generate `.yaml` only. They do not probe `.json` or `.yml` alternatives.
- Routes, navigation, overview counts, and global entity filters stop exposing locations, dialogues, events, and game materials. The five supported content surfaces are characters, factions, skills, items, and chapter summaries.
- Update the owning backend and frontend Trellis contracts and focused tests.

## Acceptance Criteria

- [x] Scanner/API tests report exact four-entity counts and five-file completeness from valid YAML, and isolate missing, malformed, non-array, and contract-invalid YAML failures by book.
- [x] `/api/library/book-data` returns parsed structured data for exactly the five YAML files while the wire response remains JSON.
- [x] Dashboard displays characters, factions, skills, items, and chapter summaries from installed YAML.
- [x] Technique objects render by name; character level, rank, and summary display correctly; legacy field aliases remain field-level only.
- [x] Review tests prove YAML-only listing, loading, backup naming, deletion, and serialization with no JSON fallback request.
- [x] No stale JSON file can shadow a valid, missing, or malformed YAML dataset; the installer regression still proves old JSON is archived outside the new `data/` directory.
- [x] Removed-category and game-material routes, navigation entries, overview cards, and global filters are absent.
- [x] Backend and frontend Trellis specs describe the five-YAML storage contract and JSON API boundary.

## Out Of Scope

- Supporting `.json` or `.yml` final-file formats.
- Removing every now-unreferenced legacy page, optional-extras store, or generator module; the cleanup child owns physical deletion after the Dashboard no longer depends on them.
- Removing field-level `role` / `power_rank` / string-technique compatibility.
- Changing the HTTP API response encoding away from JSON.
