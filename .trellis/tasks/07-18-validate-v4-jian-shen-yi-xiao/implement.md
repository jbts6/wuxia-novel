# Jian Shen Yi Xiao V4 Semantic Contract V6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` for independent implementation/review tasks and `test-driven-development` for every behavior change. Chapter/domain workers may write only controller-issued staging paths; the main agent performs every accept and state transition.

**Goal:** Complete and validate a source-grounded V4 semantic-contract version 6 on the tracked `古龙/剑神一笑` corpus, then derive V5/deep skills from that proven contract.

**Architecture:** Carry the useful unfinished version-5 safety work forward, repair it first, and commit it separately. Introduce one executable v6 entity contract across chapter/domain/final stages, category-aware merge policies, persistent IDs, a fail-closed v5 chapter importer, and strict Dashboard consumers. Preserve exactly five installed YAML files; keep controller metadata and receipts outside Dashboard data.

**Tech Stack:** Node.js/CommonJS, Node test runner, YAML, SHA-256 receipts, React/TypeScript/Vite/Vitest, Trellis task evidence.

## Global Constraints

- Preserve commits `bc72e748` and `8c0a100d`; do not revert user or prior task work.
- Do not commit the current unfinished safety implementation until its downgrade and transaction gaps have RED tests and fixes.
- Keep the version-5 real run immutable; never edit accepted evidence or controller state in place.
- Use the tracked `C:\git\wuxia-novel\古龙\剑神一笑\剑神一笑.txt`, 20 chapters, and dynamic groups `[3, 3, 3, 3, 3, 3, 2]`.
- Every AI unit gets an initial submission and at most one automatic retry per cycle. Only confirmed `retry-unit` begins another bounded cycle.
- Final Dashboard data is exactly five YAML files. No ID-name map, inverse relation index, or controller registry is added to `data/`.
- Every production change follows RED, observed failure, minimal GREEN, focused regression, and full relevant regression before commit.
- V5/deep files remain untouched until the V4 real run passes installed verification and archive.

---

### Task 1: Finish The Work-Item Integrity Foundation

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/tests/semantic-work.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-flow.test.js`

**Interfaces:**
- `readWorkItem(paths, unit)` validates a mandatory known `hash_contract` and recomputes input, binding, source-file path, and source-file hashes.
- `refreshWorkPlanUnit(paths, nextPlan, unit)` validates the existing work item even when the computed hash is unchanged and fails if the old artifact required for rotation is absent.
- `refreshDomainWork(paths, manifest, unit, confirmed)` commits work item, plan, and progress as one rollback-capable operation.

- [ ] **Step 1: Add downgrade and equal-hash RED tests**

  Add focused tests that delete `bindings.hash_contract`, replace it with an unknown value, tamper or remove the equal-hash input/bindings/unit, and mismatch `progress.units[unit].input_hash` from the plan descriptor.

- [ ] **Step 2: Run the RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/semantic-work.test.js .agents/skills/generate-game-kb/tests/domain-flow.test.js`

  Expected: failures showing missing/unknown contracts and equal-hash tampering are currently accepted or skipped.

- [ ] **Step 3: Fail closed in work-item consumption and refresh**

  Require the exact supported hash contract before reading any work item. Move full existing-artifact validation before the equal-hash return. Compare progress and plan input hashes before refresh, and require a source artifact before changed-hash rotation.

- [ ] **Step 4: Add transaction failure RED tests**

  Inject failures after new work bytes, after plan bytes, and during progress save. Assert byte-for-byte restoration of the prior input, bindings, plan, progress, and staging draft, with no newly accepted or rotated artifact left behind.

- [ ] **Step 5: Run transaction RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/domain-flow.test.js`

  Expected: at least the progress-write failure leaves split state before the fix.

- [ ] **Step 6: Implement rollback-complete refresh**

  Snapshot existence plus bytes for every file in the refresh commit set, validate before mutation, and restore in reverse order on any exception. Preserve the original exception and leave the same request retryable.

- [ ] **Step 7: Verify and commit the safety foundation**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/semantic-work.test.js .agents/skills/generate-game-kb/tests/domain-work.test.js .agents/skills/generate-game-kb/tests/domain-flow.test.js`

  Then run `rtk git diff --check` and commit only Task 1 files:
  `fix(game-kb): harden domain work refresh`

---

### Task 2: Establish One Executable Version-6 Entity Contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-work.test.js`

**Interfaces:**
- `SEMANTIC_CONTRACT_VERSION` becomes `6` while version-5 run metadata remains readable only by the importer.
- `ENTITY_FIELD_CONTRACTS` is the single CommonJS owner of semantic fields, array fields, nullable fields, required strings, and forbidden legacy fields for all four domains.
- Chapter and domain validators consume this contract and add only their stage metadata/reference representation.

- [ ] **Step 1: Write exact-field RED tests**

  Assert the frozen final field table, chapter/domain cardinality parity, required `aliases`, plural `identities/types/factions`, nullable scalar preservation, and rejection of every legacy or inverse field, empty string, and placeholder unknown.

- [ ] **Step 2: Run contract RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/semantic-contract.test.js .agents/skills/generate-game-kb/tests/chapter-contract.test.js .agents/skills/generate-game-kb/tests/domain-contract.test.js`

  Expected: version and field-table assertions fail against version 5.

- [ ] **Step 3: Implement the shared field matrix**

  Export immutable definitions equivalent to:

  ```js
  {
    characters: { arrays: ['aliases', 'identities', 'factions', 'skills'], nullable: ['level', 'rank', 'description'] },
    skills: { arrays: ['aliases', 'types', 'factions', 'techniques'], nullable: ['rank', 'description'] },
    items: { arrays: ['aliases'], nullable: ['type', 'description'] },
    factions: { arrays: ['aliases'], nullable: ['type', 'description'] }
  }
  ```

  Derive final allowlists from this owner. Normalize absent arrays to `[]` and absent optional scalars to `null`; do not coerce unsupported values to strings.

- [ ] **Step 4: Apply the matrix at chapter/domain/book boundaries**

  Preserve `local_key` and complete `source_refs` in chapter drafts, registry references in domain decisions, and no evidence fields in final data. Keep nested techniques to `name/description` only.

- [ ] **Step 5: Verify and commit the v6 shape**

  Run the four focused suites, then all `*contract.test.js` files and `rtk git diff --check`.

  Commit:
  `feat(game-kb): define semantic contract v6`

---

### Task 3: Implement Category-Aware Merge Rules And Persistent IDs

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/ids.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Modify: `.agents/skills/generate-game-kb/tests/candidate-registry.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-assembly.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/finalize.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`

**Interfaces:**
- `mergeRecords(category, records)` returns deterministic ordered unions and conflict metadata instead of selecting the first scalar.
- Domain decisions own full-book canonical name, nullable rank, and synthesized description; unresolved semantic conflicts become manual review.
- `assignStableIds(recordsByCategory, priorRegistry)` reuses controller-issued IDs and persistent exact-name disambiguators.
- `writeFinalDataAtomic(paths, result)` commits five YAML files, ID registry/plan, and assembly metadata without a split state.

- [ ] **Step 1: Write per-field merge RED tests**

  Cover all four categories: canonical/alias behavior, first-confirmed array order, character level precedence, nullable verified rank, description conflict, skill techniques, singular item/faction type conflict, distinct same-name records, and alias-only non-merge.

- [ ] **Step 2: Run merge RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/candidate-registry.test.js .agents/skills/generate-game-kb/tests/domain-assembly.test.js`

  Expected: scalar-conflict tests expose `values[0]` behavior.

- [ ] **Step 3: Implement category-aware merge**

  Keep a complete ordered evidence timeline for semantic fields. Apply deterministic unions and level precedence in code. Require accepted domain patches for canonical naming and prose/rank decisions; emit structured manual-review conflicts when full-book decisions do not close contradictory evidence.

- [ ] **Step 4: Write stable-ID RED tests**

  Prove ID stability across input order, retries, canonical rename, alias changes, unrelated additions/removals, and removal of another same-name entity. Reject numeric/model-authored disambiguators. Prove final references resolve to IDs after merge.

- [ ] **Step 5: Run stable-ID RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/finalize.test.js`

  Expected: the current duplicate-name record loses its suffix when its peer is removed, and rename changes the base ID.

- [ ] **Step 6: Persist controller-owned identity state**

  Extend the existing `final/id_plan.json` with the evidence identity anchor,
  disambiguator, issued ID, current canonical name, and supported aliases. Reuse
  issued IDs before deriving a new pinyin ID. Keep it outside `data/` and bind
  its hash into assembly, install, and archive output.

- [ ] **Step 7: Add finalize transaction RED/GREEN coverage**

  Inject interruption after final-data promotion and before ID-plan/report write. Make the complete publication boundary atomic or recoverable, using existing install rollback patterns rather than leaving data and ID metadata split.

- [ ] **Step 8: Verify and commit merge/ID behavior**

  Run all five focused suites plus `verify-v4.test.js`, then `rtk git diff --check`.

  Commit:
  `feat(game-kb): merge v6 entities deterministically`

---

### Task 4: Add Controlled Chapter Import And Version-Aware Publication

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-import.js`
- Create: `.agents/skills/generate-game-kb/tests/chapter-import.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/overlay.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- Modify: lifecycle tests including `verify-v4.test.js`, `install-v4.test.js`, `install.test.js`, `overlay.test.js`, `run-archive.test.js`, and `artifact-immutability.test.js`

**Interfaces:**
- `importAcceptedChapters({ paths, fromRunId, targetRunId, confirmed })` validates first, transforms an allowlisted v5 shape, writes atomically, and returns a receipt with source/accepted/target hashes.
- CLI: `import-chapters <novel> --from-run <v5-run-id> --run <v6-run-id> --confirm`.
- Install receipt schema 2 and overlay/archive receipts bind semantic version 6, ID-registry hash,
  aggregate final-data hash, the exact raw SHA-256 of each of the five YAML
  files through `data_file_hashes`, verification hash, and migration-receipt
  hash when present.

- [ ] **Step 1: Write import RED tests**

  Cover a complete 20-chapter import, missing confirmation, wrong profile/version, Chinese path preservation, chapter/source/accepted hash tampering, forbidden non-mechanical conversion, injected write failure, unchanged source run, receipt hashes, and absence of copied version-5 domain artifacts. After the normal planning command, assert four fresh pending version-6 domain units.

- [ ] **Step 2: Run import RED tests**

  Run:
  `node --test .agents/skills/generate-game-kb/tests/chapter-import.test.js`

  Expected: module/command is absent.

- [ ] **Step 3: Implement the allowlisted importer**

  Validate every source artifact before creating target state. Convert `biography` to `description`, wrap supported singular values into arrays, remove forbidden item/inverse relationships, normalize absence, revalidate as v6, then commit all chapters and receipt together. Never copy domain decisions, progress, registry decisions, final data, or retry history.

- [ ] **Step 4: Write publication/overlay receipt RED tests**

  Prove installed-only verification is version-aware, rejects missing/wrong
  `data_file_hashes` and byte-only YAML drift, the previous `data/` is backed up
  on every overlay, overlays merge cumulatively from current data into a
  verified temporary revision, active files are never patched in place, and
  registry/migration hashes survive install and archive.

- [ ] **Step 5: Implement version-aware lifecycle binding**

  Retain the exact `FINAL_FILES` owner. Extend receipts/manifests without adding a sixth data file. Fail closed on missing registry/migration state, hash drift, stale overlay base, or partial promotion.

- [ ] **Step 6: Verify and commit import/publication**

  Run the new import suite and all lifecycle suites listed above, then `rtk git diff --check`.

  Commit:
  `feat(game-kb): migrate accepted chapters to v6`

---

### Task 5: Migrate Dashboard To Strict Version-6 Data

**Files:**
- Modify: `.trellis/spec/frontend/global-library-browser.md`
- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.ts`
- Modify: `dashboard/src/lib/resolveId.ts`
- Modify: `dashboard/src/lib/entityContent.ts`
- Modify: `dashboard/src/lib/globalLibrary.ts`
- Modify: `dashboard/src/stores/useNovelStore.ts`
- Modify: `dashboard/src/stores/useLibraryStore.ts`
- Modify: `dashboard/src/components/library/GlobalEntityDetail.tsx`
- Modify: `dashboard/src/pages/Characters.tsx`, `Skills.tsx`, `Items.tsx`, `Factions.tsx`, and `BookOverview.tsx`
- Modify/add the corresponding Vitest files identified in the design audit

**Interfaces:**
- `normalizeNovelData(unknown)` accepts strict v6 only and throws a structured data error for legacy fields, duplicate IDs, placeholders, or dangling references.
- `buildIdMaps(data)` returns entity name maps plus character-derived `skillUsers` and `factionMembers` reverse indexes.
- `useNovelStore.loadData` rebuilds maps/indexes on every load; `clearData` removes them.

- [ ] **Step 1: Replace legacy normalization expectations with RED v6 tests**

  Test all four exact shapes, nullable values, empty arrays, structured techniques, duplicate IDs, dangling references, and rejection of every singular/legacy/inverse field. Invert tests that currently expect rank fallbacks, string techniques, raw ID fallback, or `未注明` placeholders.

- [ ] **Step 2: Run Dashboard RED tests**

  Run:
  `npm test -- --run src/lib/normalizeNovelData.test.ts src/lib/resolveId.test.ts src/stores/useNovelStore.test.ts`

  Workdir: `dashboard`.

  Expected: strict-v6 and reverse-index assertions fail.

- [ ] **Step 3: Implement strict types, normalization, maps, and store state**

  Remove character `alias/identity/faction/role/power_rank/bio/items`, skill singular `type/faction` and `holders`, item ownership, faction members, and all legacy fallback reads. Preserve technique objects. Raise, do not silently drop, unresolved non-null IDs.

- [ ] **Step 4: Add search/render RED tests**

  Cover plural filters, aliases/identities/types, nullable-row omission, technique descriptions, derived skill users/faction members, overlay reload replacement, and visible unresolved-reference errors with no raw ID or placeholder.

- [ ] **Step 5: Implement v6 search and rendering**

  Make content/search projections consume normalized typed data and shared reverse indexes. Rendering may format values but must not rebuild contract parsing.

- [ ] **Step 6: Update the frontend spec and verify**

  Replace the v4 compatibility section with strict-v6 boundary rules. Run `npm test`, `npm run lint`, and `npm run build` in `dashboard`, then `rtk git diff --check`.

  Commit:
  `feat(dashboard): consume game kb contract v6`

---

### Task 6: Update V4 Skill Instructions, Prompts, And Real Examples

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/SKILL-cn.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Create: `.agents/skills/generate-game-kb/examples.md`
- Create: `.agents/skills/generate-game-kb/examples-cn.md`
- Modify: V4 skill/schema/prompt contract tests

**Interfaces:**
- SKILL is procedural and concise; schemas/examples are referenced resources.
- Every command has a real `古龙/剑神一笑` example, including unit retry and version-5 chapter import.
- English and `-cn` resources describe the same executable contract.

- [ ] **Step 1: Run a baseline skill application scenario**

  Give a fresh read-only subagent the current V4 skill and a controller-issued chapter/domain descriptor. Record any legacy field, guessed path, batch-size, retry, or product misunderstanding before editing docs.

- [ ] **Step 2: Add failing documentation-contract tests**

  Assert version 6, the frozen fields, chapter/domain/final examples, no forbidden terms/fields, dynamic 2-3 chapter groups, one automatic retry, controlled import, final product/receipts, and exact real commands.

- [ ] **Step 3: Run documentation RED tests**

  Run all `*skill-contract.test.js`, schema/example tests, and prompt contract tests. Expected: old examples and version-5 prose fail.

- [ ] **Step 4: Update the skill resources**

  Keep workflow choices in SKILL, complete schemas in `schemas.md`, and real commands in `examples*.md`. Update the chapter draft example together with domain/final examples. Do not mention planned but unimplemented extraction categories or reintroduce removed relationship fields.

- [ ] **Step 5: Forward-test and validate the skill**

  Run the same fresh-agent scenario with the revised skill and compare compliance. Run Node contract tests and:
  `python C:\Users\fh345\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/generate-game-kb`

  Run `rtk git diff --check` and commit:
  `docs(game-kb): document semantic contract v6`

---

### Task 7: Run Jian Shen Yi Xiao Through The Complete V6 Lifecycle

**Run IDs:**
- Read-only source: `run-jian-shen-yi-xiao-v4-real-20260718`
- New target: `run-jian-shen-yi-xiao-v4-v6-final-20260719`

- [x] **Step 1: Run all deterministic gates**

  Run the complete V4 Node suite, JavaScript syntax checks, skill validator,
  `dashboard` test/lint/build, and `rtk git diff --check`. Stop on any failure.

- [x] **Step 2: Prepare the explicit v6 run**

  Use production `prepare` with the target run ID and confirm semantic version 6,
  profile V4, Chinese paths, 20 chapters, and seven groups `[3,3,3,3,3,3,2]`.

- [x] **Step 3: Import the 20 accepted version-5 chapters**

  Run the real `import-chapters` command with both run IDs and `--confirm`.
  Record the migration receipt and old/new hashes; verify the source run bytes are unchanged.

- [x] **Step 4: Generate and accept all four v6 domains**

  Dispatch only current controller descriptors. Workers read the complete ordered source/evidence timeline and write exact staging paths. The main agent accepts serially. Apply one automatic retry maximum; stop at manual review.

- [x] **Step 5: Assemble, verify, install, verify installed, and archive**

  Record the five filenames, five raw file hashes, final-data hash, ID-registry
  hash, verification-report hash, backup path, install receipt, installed
  verification, archive manifest, and archive receipt.

- [x] **Step 6: Verify Dashboard data and commit evidence**

  Load the installed book through Dashboard tests or the local app, confirm name resolution/reverse indexes and no legacy fields, append exact evidence to the Trellis journal, rerun all gates, and commit:
  `test(game-kb): validate Jian Shen Yi Xiao v6 lifecycle`

---

### Task 8: Derive V5 And Deep Skills Only From The Proven V4 Contract

**Files:**
- Modify: `.agents/skills/generate-game-kb-v5/`
- Modify: `.agents/skills/generate-game-kb-deep-characters/`
- Modify: `.agents/skills/generate-game-kb-deep-skills/`
- Modify: `.agents/skills/generate-game-kb-deep-items/`
- Modify: `.agents/skills/generate-game-kb-deep-factions/`
- Modify: V5/deep CLI, skill, and overlay tests

- [ ] **Step 1: Add RED contracts from the archived V4 v6 artifacts**

  Assert V5 is YAML, omits expensive domain distill by default, exposes final product and commands, leaves nullable deep fields empty until requested, and never invokes unimplemented relation extraction. Assert each deep skill binds the archived base manifest and current installed hash.

- [ ] **Step 2: Implement the lightweight V5 projection**

  Reuse V4 chapter/evidence, schema, publication, and retry owners. Separate only the expensive domain phases; do not fork the v6 field contract.

- [ ] **Step 3: Update deep skills and cumulative overlays**

  Preserve copied five-file verification, per-apply old-data backup, cumulative merge from current data, atomic promotion, and Dashboard reload. Use the v6 fields and reject singular fallbacks.

- [ ] **Step 4: Forward-test each skill independently**

  Test V5 first, then each deep skill with a fresh task-local subagent. Do not batch unverified skill edits. Run their validators and complete test suites after each skill.

- [ ] **Step 5: Commit V5/deep extraction**

  Commit V5 and deep changes only after all V4 evidence remains green:
  `feat(game-kb): derive v5 and deep skills from v6`
