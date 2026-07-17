# Migrate Dashboard to YAML Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dashboard consume exactly five installed YAML files while preserving a structured JSON HTTP boundary and removing obsolete visible categories.

**Architecture:** `libraryScanner.ts` parses and validates YAML on the server using the five-key `DATA_FILE_NAMES` contract. The frontend keeps field-level compatibility in `normalizeNovelData`, the review path is YAML-only, and existing route/navigation surfaces contract to the five supported outputs.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Vitest 4, `js-yaml`, Zustand, Trellis Markdown specs.

## Global Constraints

- Work only in `.worktrees/game-kb-yaml-flow` on `feat/game-kb-yaml-flow`.
- Do not commit, merge, push, archive tasks, or modify `CLAUDE.md`.
- Core storage reads exactly five `.yaml` files; JSON is only the HTTP response encoding.
- Do not add `.json` / `.yml` fallback reads or preserve removed categories in visible UI.
- Follow TDD for each behavioral change and keep the later cleanup child responsible for deleting broad orphaned legacy graphs.

### Task 1: Lock The Five-YAML Scanner And API Contract

**Files:**
- Modify: `dashboard/server/libraryScanner.test.ts`
- Modify: `dashboard/server/libraryApiPlugin.test.ts`

**Interfaces:**
- Produces: five-key `DATA_FILE_NAMES`, four-key `KNOWLEDGE_ENTITY_KEYS` / `CONTENT_ENTITY_KEYS`, and `RawNovelData` with the exact installed YAML payload.
- Proves: five-file completeness, four entity counts, per-book isolation, and JSON non-shadowing.

- [x] Replace JSON fixture writers with `js-yaml` fixtures for the five final keys.
- [x] Add failing cases for malformed YAML, non-array YAML, contract-invalid YAML, and one bad book beside one valid book.
- [x] Add a stale `characters.json` fixture and assert it cannot satisfy, replace, or hide `characters.yaml`.
- [x] Assert `/api/library/book-data` returns exactly `characters`, `factions`, `skills`, `items`, and `chapter_summaries` as structured arrays.
- [x] Run `rtk npm test -- --run server/libraryScanner.test.ts server/libraryApiPlugin.test.ts` from `dashboard/` and confirm RED on the old eight-JSON contract.

### Task 2: Parse And Validate YAML On The Server

**Files:**
- Modify: `dashboard/server/libraryScanner.ts`
- Modify: `dashboard/src/types/library.ts`
- Modify: `dashboard/src/lib/entityContent.ts`

**Interfaces:**
- Consumes: `DATA_FILE_NAMES` and existing path-discovery safeguards.
- Produces: `readYaml(target): unknown`, isolated `DataInspection`, and five-key `readBookData()` output serialized by the API as JSON.

- [x] Replace core `readJson` calls with `yaml.load(fs.readFileSync(target, 'utf8'))` while retaining JSON parsing only for non-core build/report artifacts that still use JSON.
- [x] Remove locations, techniques, and dialogues from required files, entity counts, and content coverage; nested skill techniques remain part of skill records.
- [x] Keep all key-specific array/record checks and make every error name the `.yaml` file.
- [x] Run the Task 1 focused tests and require GREEN.

### Task 3: Normalize V4 Character And Technique Fields

**Files:**
- Modify: `dashboard/src/lib/normalizeNovelData.test.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.ts`
- Modify: `dashboard/src/types/novel.ts`

**Interfaces:**
- Consumes: raw `level`, `role`, `rank`, `power_rank`, `summary`, and skill `techniques` values.
- Produces: stable current display fields and deduplicated technique-name strings.

- [x] Add failing tests proving `level` wins over `role`, `rank` wins over `power_rank`, `summary` survives, and `[{ name: '...' }]` techniques render alongside legacy strings.
- [x] Implement a focused technique-name projector that drops invalid/empty entries and deduplicates names.
- [x] Preserve empty defaults for removed top-level collections only where shared `NovelData` consumers still require them.
- [x] Run `rtk npm test -- --run src/lib/normalizeNovelData.test.ts` and require GREEN.

### Task 4: Make Review Reads And Writes YAML-Only

**Files:**
- Create: `dashboard/server/reviewApiPlugin.test.ts`
- Create: `dashboard/src/stores/useReviewStore.test.ts`
- Modify: `dashboard/server/reviewApiPlugin.ts`
- Modify: `dashboard/src/stores/useReviewStore.ts`

**Interfaces:**
- Produces: `.yaml`-only review listing, direct YAML read/write/backup paths, and no fallback network request.

- [x] Add server tests that list `.yaml`, ignore `.json` and `.yml`, and reject read/write/backup targets outside the allowed YAML data paths.
- [x] Add store tests that mock fetch, assert one `.yaml` read request, parse YAML entities, serialize deletions as YAML, and preserve `.yaml` in backup names.
- [x] Remove extension branching from parse/serialize and remove both JSON fallback probes.
- [x] Run the two focused review test files and require GREEN.

### Task 5: Remove Obsolete Visible Dashboard Surfaces

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.test.tsx`
- Modify: `dashboard/src/components/layout/SideNav.tsx`
- Modify: `dashboard/src/components/layout/SideNav.test.tsx`
- Modify: `dashboard/src/pages/BookOverview.tsx`
- Modify: `dashboard/src/pages/BookOverview.test.tsx`
- Modify: `dashboard/src/pages/ChapterSummaries.tsx`
- Modify: `dashboard/src/pages/ChapterSummaries.test.tsx`
- Modify: `dashboard/src/pages/Library.tsx`
- Modify: `dashboard/src/pages/Library.test.tsx`
- Modify: `dashboard/src/pages/BrowseLibrary.tsx`
- Modify: `dashboard/src/pages/BrowseLibrary.test.tsx`
- Modify: `dashboard/src/components/library/GlobalEntityDetail.tsx`
- Modify: `dashboard/src/lib/globalLibrary.ts`
- Modify: `dashboard/src/lib/globalLibrary.test.ts`
- Modify: `dashboard/src/lib/libraryStatusPresentation.ts`
- Modify: `dashboard/src/hooks/useBookData.test.tsx`
- Modify: `dashboard/src/stores/useLibraryStore.test.ts`
- Modify: `dashboard/src/pages/ReviewPage.tsx`
- Modify: `dashboard/src/types/library.ts`

**Interfaces:**
- Produces: routes, nav, overview cards, and global filters for characters, factions, skills, items, and chapter summaries only.

- [x] Add or update assertions that locations, dialogues, events, and game materials have no visible route, nav item, overview card, chapter-summary view/detail, workbench copy, or global filter.
- [x] Remove their route imports/definitions and visible links/counts; keep the review tool route.
- [x] Contract `LIBRARY_ENTITY_KINDS` and entity unions so global browsing cannot index locations.
- [x] Remove stale removed-category fields from affected test fixtures and fix the ReviewPage filter callback so the contracted union type-checks without casts to an obsolete category.
- [x] Leave now-unreferenced legacy modules for the ordered cleanup child instead of mixing broad deletion into this migration.
- [x] Run all affected component/store tests and require GREEN.
- [x] Run `rtk npx tsc -b --pretty false` and require GREEN; the pre-task baseline is 15 errors across eight files.

### Task 6: Update Executable Trellis Contracts

**Files:**
- Modify: `.trellis/spec/backend/library-status-api.md`
- Modify: `.trellis/spec/frontend/global-library-browser.md`
- Modify: `.trellis/tasks/07-17-game-kb-dashboard-yaml/prd.md`

**Interfaces:**
- Produces: project guidance that names the five YAML files, four entity counts, JSON API boundary, YAML-only review path, field compatibility, and removed surfaces.

- [x] Replace all eight-JSON/seven-entity core statements and examples with the five-YAML/four-entity contract.
- [x] Remove optional event/game-material UI requirements from the frontend contract and record the field-level compatibility boundary.
- [x] Check every PRD acceptance criterion only after its focused evidence passes.

### Task 7: Dashboard YAML Quality Gate

**Files:**
- Modify: `.trellis/tasks/07-17-game-kb-dashboard-yaml/implement.md`
- Modify: `.trellis/workspace/jbts6/journal-1.md`

**Interfaces:**
- Produces: repeatable evidence for the child task without committing or archiving it.

- [x] Run `rtk npm test` from `dashboard/`.
- [x] Run `rtk npm run lint` from `dashboard/`.
- [x] Run `rtk npm run build` from `dashboard/`.
- [x] Run `rtk node --test .agents/skills/generate-game-kb/tests/install-v4.test.js` from the worktree root.
- [x] Run `rtk git diff --check HEAD` and verify `CLAUDE.md` is unchanged.
- [x] Record commands, pass/fail counts, known unrelated failures, and the no-commit blocker in the developer journal.
