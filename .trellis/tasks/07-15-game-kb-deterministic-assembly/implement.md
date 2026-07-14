# Game KB Deterministic Semantic Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans in inline mode to implement this plan task-by-task. Do not dispatch implementation or check sub-agents while the repository is configured for inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace whole-book merge/clean AI payloads with bounded category decisions and deterministic compatible book assembly, then prove the v2 contract with fresh two-book runs.

**Architecture:** Existing chapter extraction and downstream finalization stay intact. New pure modules plan short-ref work items, validate semantic decisions, own private key bindings, assemble merge/clean books, migrate the candidate ledger, and enforce clean obligations; CLI orchestration exposes only category AI units while aggregate books use zero attempts.

**Tech Stack:** Node.js CommonJS, Node built-ins (`fs`, `path`, `crypto`), `node:test`, Markdown Skill prompts, Trellis task/spec artifacts.

## Global Constraints

- Do not modify any file under `.agents/skills/generate-kb/`.
- Build on the accepted contracts from `07-14-fast-kb-pipeline`; do not redesign chapter reading, final IDs, nine-file compatibility, installation, or run archival.
- New runs use `semantic_contract_version: 2`; legacy unversioned whole-book runs are read-only negative evidence.
- AI units are category/shard decisions only; `merge:book` and `clean:book` are deterministic attempts-0 aggregates.
- AI-visible payloads contain short refs and semantic facts only. Controller-owned candidate keys, local keys, bindings, final IDs, ledgers, and unchanged full-book arrays never enter AI drafts.
- Stable work-item limits are exactly 120 candidates and 96 KiB serialized AI input.
- Every semantic unit keeps the existing three-submission budget, exact staging consumption, no-progress circuit breaker, immutable acceptance, manual-review terminal state, persistent worker pool, and `10 → 5 → 2 → 1` 429 policy.
- Deterministic planning/assembly failures do not consume AI attempts and never trigger automatic reset.
- Use `apply_patch` for manual edits and prefix shell/git commands with `rtk`.
- Fresh positive evidence comes only from v2 runs; do not mutate the live or archived whole-book runs.

---

## Execution Plan

The observed Fly Fox run proves that a valid 47–69 万字节 JSON file can still fail because one AI response combines semantic deduplication with exact transport of 1,089 long keys, finite enums, reference rewrites, character enrichment, and a full-book copy. Tasks 1–8 replace only that boundary. They do not change direct chapter reading, nine-file compatibility, final ID generation, installation, or the audit-grade `generate-kb` Skill.

### Revision File Structure

```text
.agents/skills/generate-game-kb/
├── prompts/
│   ├── merge-category.md
│   ├── clean-category.md
│   └── select-materials.md
├── scripts/lib/
│   ├── semantic-work.js       # short refs, deterministic grouping/sharding, private bindings
│   ├── category-contract.js   # merge/clean/material decision draft validation
│   ├── clean-obligations.js   # deterministic cleanup obligations and closure checks
│   └── book-assembly.js       # category projection, ledger migration, compatible book assembly
└── tests/
    ├── fixtures/merge-clean-scale.js
    ├── semantic-work.test.js
    ├── category-contract.test.js
    └── book-assembly.test.js
```

### Task 1: Freeze category decision contracts and real-scale failure fixtures

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/fixtures/merge-clean-scale.js`
- Create: `.agents/skills/generate-game-kb/tests/category-contract.test.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/category-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`

**Interfaces:**
- Consumes: one immutable AI-visible work item with `unit`, `stage`, `category`, `input_hash`, and short refs.
- Produces: `validateMergeDecisionDraft(draft, workItem)`, `validateCleanDecisionDraft(draft, workItem)`, `validateMaterialDecisionDraft(draft, workItem)`, plus shared `REJECTION_REASONS` imported from `candidate-ledger.js`.

- [ ] **Step 1: Add the 1,089-candidate and 420-candidate fixtures**

The fixture generates exact-shaped keys without depending on the mutable live run:

```javascript
function candidateKey(index, category = 'characters') {
  const chapter = String((index % 20) + 1).padStart(3, '0');
  return `ch${chapter}:${category}:candidate:${String(index).padStart(4, '0')}`;
}

function scaleCandidates(count = 1089, category = 'characters') {
  return Array.from({ length: count }, (_, index) => ({
    candidate_key: candidateKey(index, category),
    local_key: `candidate:${index}`,
    name: `候选${index}`,
    source_refs: [{ chapter: (index % 20) + 1, text: `证据${index}` }]
  }));
}
```

- [ ] **Step 2: Write failing contract tests**

```javascript
test('AI decision drafts cannot echo controller-owned keys', () => {
  const draft = validMergeDecision({ decisions: [{
    entity_ref: 'e001', member_refs: ['c001'], action: 'merge',
    canonical_name: '甲', fields: {}, candidate_key: 'ch001:characters:candidate:0001'
  }] });
  assert.ok(codes(validateMergeDecisionDraft(draft, mergeWorkItem()))
    .includes('MECHANICAL_KEY_FORBIDDEN'));
});

test('each short ref is decided exactly once', () => {
  const draft = validMergeDecision({ decisions: [
    mergeDecision('e001', ['c001']), mergeDecision('e002', ['c001'])
  ] });
  assert.ok(codes(validateMergeDecisionDraft(draft, mergeWorkItem()))
    .includes('WORK_REF_INVALID'));
});

test('clean drop reuses the single ledger rejection enum', () => {
  const draft = validCleanDecision({ decisions: [
    { entity_ref: 'e001', action: 'drop', reason: 'entity_removed_during_cleaning', detail: '删除' }
  ] });
  assert.ok(codes(validateCleanDecisionDraft(draft, cleanWorkItem()))
    .includes('SEMANTIC_DECISION_INVALID'));
});
```

- [ ] **Step 3: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/category-contract.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `category-contract.js`.

- [ ] **Step 4: Implement strict pure validators**

Define exact top-level fields, allowed actions, forbidden recursive key names, short-ref coverage, patch whitelists, nonempty detail requirements, and shared rejection enums. Return only `{ code, path, target }` issues; do not mutate drafts or work items.

```javascript
const MERGE_ACTIONS = new Set(['merge', 'reject', 'ambiguous']);
const CLEAN_ACTIONS = new Set(['keep', 'edit', 'merge_into', 'drop']);
const FORBIDDEN_KEYS = /^(candidate_key|local_key|id|.*_id|.*_ids)$/;
```

- [ ] **Step 5: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/category-contract.test.js`

Expected: PASS. Commit only the four files above with `feat(game-kb): define category decision contracts`.

### Task 2: Build deterministic short-ref work plans and bounded shards

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Create: `.agents/skills/generate-game-kb/tests/semantic-work.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`

**Interfaces:**
- Consumes: accepted chapter JSON plus accepted hashes for merge; accepted merged book plus its hash and clean obligations for cleanup.
- Produces: `createMergeWorkPlan(input)`, `createCleanWorkPlan(input)`, `writeWorkPlan(paths, plan)`, `readWorkItem(paths, unit)`, AI-visible `input.json`, and controller-only `bindings.json`.

- [ ] **Step 1: Write deterministic planning tests**

```javascript
test('1089 candidates receive stable short refs without leaking candidate keys', () => {
  const first = createMergeWorkPlan({ chapters: chaptersWith(scaleCandidates()), accepted_hashes: hashes() });
  const second = createMergeWorkPlan({ chapters: chaptersWith(scaleCandidates()), accepted_hashes: hashes() });
  assert.deepEqual(first, second);
  assert.equal(first.bindings.length, 1089);
  assert.equal(JSON.stringify(first.inputs).includes('candidate_key'), false);
  assert.equal(new Set(first.bindings.map(row => row.candidate_ref)).size, 1089);
});

test('shards obey both stable limits', () => {
  const plan = createMergeWorkPlan({ chapters: largeChapters(), accepted_hashes: hashes() });
  for (const item of plan.inputs) {
    assert.ok(item.candidates.length <= 120);
    assert.ok(Buffer.byteLength(JSON.stringify(item)) <= 96 * 1024);
  }
});
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/semantic-work.test.js`

Expected: FAIL because `semantic-work.js` does not exist.

- [ ] **Step 3: Implement stable grouping, refs, hashes, and private bindings**

```javascript
const WORK_CONTRACT_VERSION = 2;
const MAX_WORK_ITEM_CANDIDATES = 120;
const MAX_WORK_ITEM_BYTES = 96 * 1024;

function shortRef(prefix, index) {
  return `${prefix}${String(index + 1).padStart(4, '0')}`;
}
```

Sort by category, normalized name, chapter, and original candidate key before assigning refs. Never truncate a candidate. Split an oversize name group into contiguous subgroups and set `requires_consolidation: true`. Hash the contract version, AI input, private bindings, and accepted upstream hashes.

- [ ] **Step 4: Add run-scoped paths and immutable writes**

Add `mergeWork`, `cleanWork`, `mergeDecisions`, `cleanDecisions`, `mergeCategories`, `cleanCategories`, and `cleanObligations` below the selected run. `writeWorkPlan` may rewrite an existing file only when bytes are identical; otherwise it returns `WORK_ITEM_STALE` and lets progress rotate only affected units.

- [ ] **Step 5: Run focused tests and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/semantic-work.test.js .agents/skills/generate-game-kb/tests/run-isolation.test.js`

Expected: PASS. Commit with `feat(game-kb): add deterministic semantic work plans`.

### Task 3: Assemble merge categories and the compatible merged book

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Create: `.agents/skills/generate-game-kb/tests/book-assembly.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`

**Interfaces:**
- Consumes: merge work plan, private bindings, all accepted merge decisions, manifest, and accepted chapters.
- Produces: `applyMergeDecision(workItem, bindings, draft)`, `assembleMergedBook(input)`, exact compatible `candidate_resolutions`, deterministic category records, and unchanged one-summary-per-chapter projection.

- [ ] **Step 1: Write failing assembly tests**

```javascript
test('short refs expand to all 1089 exact candidate keys once', () => {
  const result = assembleMergedBook(acceptedScaleMerge());
  assert.equal(result.candidate_resolutions.length, 1089);
  assert.equal(new Set(result.candidate_resolutions.map(row => row.candidate_key)).size, 1089);
  assert.deepEqual(validateMergedBook(result, manifest20(), chapters20()), []);
});

test('local keys are controller generated and stable for same-name people', () => {
  const first = assembleMergedBook(sameNamePeople());
  const second = assembleMergedBook(sameNamePeople());
  assert.deepEqual(first.characters.map(row => row.local_key), second.characters.map(row => row.local_key));
  assert.equal(new Set(first.characters.map(row => row.local_key)).size, 2);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/book-assembly.test.js`

Expected: FAIL with missing `book-assembly.js` exports.

- [ ] **Step 3: Implement merge projection**

For a unique canonical name use `<singular-category>:<canonical_name>`. For collisions append the first eight hex characters of the hash of sorted bound candidate keys. Union source refs mechanically and take semantic fields only from validated decision fields.

```javascript
function collisionLocalKey(prefix, name, candidateKeys) {
  const suffix = sha256(JSON.stringify([...candidateKeys].sort())).slice(0, 8);
  return `${prefix}:${name}#${suffix}`;
}
```

Every binding must end in exactly one `merged_to`, `rejected`, or blocking `ambiguous` row. Concatenate accepted chapter summaries by manifest chapter order; AI decisions cannot replace them.

- [ ] **Step 4: Block incomplete assembly without spending attempts**

Return `MERGE_AMBIGUITY_UNRESOLVED` or `BOOK_ASSEMBLY_INCOMPLETE` before any write. The pure function never changes progress and never overwrites an accepted book.

- [ ] **Step 5: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/book-assembly.test.js .agents/skills/generate-game-kb/tests/book-contract.test.js`

Expected: PASS. Commit with `feat(game-kb): assemble merged books deterministically`.

### Task 4: Derive cleanup obligations and migrate the ledger mechanically

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/clean-obligations.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Modify: `.agents/skills/generate-game-kb/tests/book-assembly.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/book-contract.test.js`

**Interfaces:**
- Consumes: the current accepted merged book, manifest, accepted chapters, clean work plan, and accepted clean decisions.
- Produces: `buildCleanObligations(merged, manifest, chapters)`, `applyCleanDecision(...)`, `validateCleanClosure(...)`, and `assembleCleanedBook(input)`.

- [ ] **Step 1: Write RED tests for the observed failures**

```javascript
test('one entity drop migrates 420 mapped candidates with one legal reason', () => {
  const cleaned = assembleCleanedBook(cleanDropFixture(420, {
    action: 'drop', reason: 'misclassified', detail: '同一错类实体'
  }));
  const rows = cleaned.candidate_resolutions.filter(row => row.resolution === 'rejected');
  assert.equal(rows.length, 420);
  assert.ok(rows.every(row => row.reason === 'misclassified'));
});

test('keep-all cannot bypass an unresolved detailed-character obligation', () => {
  const result = validateCleanClosure(keepAllFixtureWithMissingBiography());
  assert.ok(result.errors.some(error => error.code === 'CLEAN_OBLIGATION_UNRESOLVED'));
});

test('a named technique and an important character cannot be dropped', () => {
  assert.ok(applyErrors(dropNamedTechnique()).includes('PROTECTED_ENTITY_REMOVAL'));
  assert.ok(applyErrors(dropImportantCharacter()).includes('PROTECTED_ENTITY_REMOVAL'));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/book-assembly.test.js`

Expected: FAIL because clean obligation and migration functions are missing.

- [ ] **Step 3: Implement deterministic obligations**

Generate stable obligation refs `o0001...` after sorting by code, category, entity key, and path. Cover ambiguities, detailed/minor character rules, item reasons, dialogue event existence/chapter/uniqueness, ledger closure, and existing cleaned-book deterministic errors.

- [ ] **Step 4: Implement action application and ledger migration**

```javascript
function migrateResolution(row, transition) {
  if (row.resolution === 'rejected') return row;
  if (transition.action === 'merge_into') return { ...row, merged_to: transition.target_local_key };
  if (transition.action === 'drop') return {
    candidate_key: row.candidate_key,
    resolution: 'rejected', reason: transition.reason, detail: transition.detail
  };
  return row;
}
```

Apply only whitelisted patches, inherit all untouched fields, rerun the cleaned-book contract, and require every obligation to be both claimed and actually removed. Allow keep-all only when obligations are empty and every entity ref is explicitly covered.

- [ ] **Step 5: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/book-assembly.test.js .agents/skills/generate-game-kb/tests/book-contract.test.js`

Expected: PASS. Commit with `feat(game-kb): make cleanup ledger transitions deterministic`.

### Task 5: Integrate category units, progress, staging, and deterministic assembly commands

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`

**Interfaces:**
- Consumes: `prepare-merge`, category `accept`, `assemble-merge`, `prepare-clean`, category/material `accept`, and `assemble-clean` internal commands.
- Produces: dynamic category units, existing compatible accepted book paths, attempts-0 aggregate units, and unchanged downstream `build-final` input.

- [ ] **Step 1: Write CLI and progress RED tests**

```javascript
test('v2 run rejects whole-book semantic submissions', () => {
  const result = cli('accept', novel, '--unit', 'merge:book', '--draft', draft);
  assert.equal(result.code, 'WHOLE_BOOK_AI_UNIT_FORBIDDEN');
});

test('category failure does not reset accepted siblings', () => {
  acceptUnit('merge:characters:001');
  rejectUnit('merge:items:001');
  assert.equal(status('merge:characters:001').status, 'done');
  assert.equal(status('merge:characters:001').attempts, 1);
});

test('aggregate units use zero attempts', () => {
  completeAllMergeUnits();
  cli('assemble-merge', novel);
  assert.equal(status('merge:book').attempts, 0);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/tests/progress.test.js .agents/skills/generate-game-kb/tests/integration.test.js`

Expected: FAIL with unknown prepare/assemble commands and unsupported category units.

- [ ] **Step 3: Add dynamic unit contexts**

Match only these v2 AI units:

```javascript
const MERGE_UNIT = /^merge:(characters|events|items|skills|techniques|factions|locations|dialogues):(\d{3}|consolidate)$/;
const CLEAN_UNIT = /^clean:(characters|events|items|skills|techniques|factions|locations|dialogues):(\d{3})$/;
const MATERIAL_UNIT = /^clean:materials:001$/;
```

Load exact work item and private binding hashes into the unit input hash. Reuse exact staging path enforcement, draft archival, progress recording, no-progress detection, and consumption after both success and rejection.

- [ ] **Step 4: Add deterministic prepare and assemble commands**

`prepare-merge` and `prepare-clean` are idempotent plan writers. `assemble-merge` and `assemble-clean` require every dependency done, call pure assembly, record the derived artifact in `artifact-manifest.json`, set the aggregate unit done with attempts 0, and refuse overwrite on a different existing hash.

- [ ] **Step 5: Preserve downstream compatibility**

Keep `paths.merged`, `paths.cleaned`, `validateMergedBook`, `validateCleanedBook`, `build-final`, `verify`, `install`, and `archive-run` consumers unchanged. Add a regression that builds the same nine final arrays from a v2 category run.

- [ ] **Step 6: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/tests/progress.test.js .agents/skills/generate-game-kb/tests/artifact-immutability.test.js .agents/skills/generate-game-kb/tests/integration.test.js`

Expected: PASS. Commit with `feat(game-kb): route category semantic units`.

### Task 6: Replace whole-book prompts with isolated category workers

**Files:**
- Create: `.agents/skills/generate-game-kb/prompts/merge-category.md`
- Create: `.agents/skills/generate-game-kb/prompts/clean-category.md`
- Create: `.agents/skills/generate-game-kb/prompts/select-materials.md`
- Delete: `.agents/skills/generate-game-kb/prompts/merge-book.md`
- Delete: `.agents/skills/generate-game-kb/prompts/clean-book.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/worker-pool.test.js`

**Interfaces:**
- Consumes: one Skill invocation plus novel directory, status work-item paths, and the existing persistent worker pool.
- Produces: autonomous category-worker dispatch, path-only worker results, serial accept, dependency-aware merge/clean assembly, and no user-authored script sequence.

- [ ] **Step 1: Write Skill contract RED tests**

Assert that the Skill names `prepare-merge`, `merge:<category>:<shard>`, optional `merge:<category>:consolidate`, `assemble-merge`, `prepare-clean`, `clean:<category>:<shard>`, `clean:materials:001`, and `assemble-clean`; forbids whole-book merge/clean JSON; gives candidate/local key ownership to scripts; and retains manual-review/reset rules.

```javascript
assert.match(skill, /AI.*不得.*candidate_key|candidate_key.*脚本/);
assert.doesNotMatch(skill, /生成一次全书合并草稿|生成唯一一轮清理草稿/);
assert.match(skill, /10\s*→\s*5\s*→\s*2\s*→\s*1/);
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js .agents/skills/generate-game-kb/tests/worker-pool.test.js`

Expected: FAIL because the current Skill still invokes whole-book prompts.

- [ ] **Step 3: Write exact category prompts and schema examples**

Each worker receives only schemas, one prompt, one AI-visible work item, and one run-scoped staging path. Merge prompts require complete short-ref coverage; clean prompts require one action per entity and obligation refs; materials prompt reads only the surviving compact catalog. None may read CTX summaries, root data, another run, private bindings, or final IDs.

- [ ] **Step 4: Update autonomous orchestration**

Dispatch independent non-dialogue category workers through the same run-level pool and 429 batch contract; accept serially. Complete events before dialogue work planning, all entity cleanup before materials, and every category before deterministic assembly. A context compaction resumes from status/work-item files without replaying done units.

- [ ] **Step 5: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js .agents/skills/generate-game-kb/tests/worker-pool.test.js`

Expected: PASS. Commit with `docs(game-kb): route merge and cleanup by category`.

### Task 7: Version the semantic contract and fail closed on legacy runs

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/install.test.js`

**Interfaces:**
- Consumes: `run.json.semantic_contract_version` and any existing unversioned active run.
- Produces: v2-only semantic continuation, `LEGACY_SEMANTIC_CONTRACT`, read-only status/evidence access, and explicitly confirmed abandoned archival.

- [ ] **Step 1: Write legacy safety RED tests**

```javascript
test('an unversioned run cannot enter v2 semantic stages or install', () => {
  const run = makeLegacyRun();
  assert.equal(cli('prepare-merge', run).code, 'LEGACY_SEMANTIC_CONTRACT');
  assert.equal(cli('install', run).code, 'LEGACY_SEMANTIC_CONTRACT');
  assert.equal(cli('status', run).exitCode, 0);
});

test('legacy evidence archival requires explicit confirmation', () => {
  assert.equal(cli('archive-abandoned', legacyRun).code, 'ABANDON_CONFIRM_REQUIRED');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test .agents/skills/generate-game-kb/tests/run-isolation.test.js .agents/skills/generate-game-kb/tests/run-archive.test.js .agents/skills/generate-game-kb/tests/install.test.js`

Expected: FAIL because run metadata lacks the semantic contract and legacy commands are not guarded.

- [ ] **Step 3: Persist and enforce version 2**

New runs write `semantic_contract_version: 2`; the value is included in merge/clean work-item hashes and final verification evidence. Missing or different versions allow observational status but block semantic planning, accept, assembly, build-final, install, and positive acceptance.

- [ ] **Step 4: Add confirmed abandoned archival**

`archive-abandoned <novel> --run <id> --confirm` writes `abandonment.json` containing run ID, contract version, reason, current unit states, and artifact-manifest hash, then moves the complete run under `_archive/generate-game-kb/abandoned/`. It never marks quality passed and never deletes drafts.

- [ ] **Step 5: Run GREEN and checkpoint**

Run: `node --test .agents/skills/generate-game-kb/tests/run-isolation.test.js .agents/skills/generate-game-kb/tests/run-archive.test.js .agents/skills/generate-game-kb/tests/install.test.js`

Expected: PASS. Commit with `fix(game-kb): fail closed on legacy semantic runs`.

### Task 8: Complete verification, project contract, and fresh two-book evidence

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`
- Create: `.trellis/tasks/07-15-game-kb-deterministic-assembly/evidence/feihu-merge-clean-audit.json`
- Create: `.trellis/tasks/07-15-game-kb-deterministic-assembly/evidence/v2-two-book-comparison.json`
- Modify: `.trellis/tasks/07-15-game-kb-deterministic-assembly/prd.md`
- Modify: `.trellis/tasks/07-15-game-kb-deterministic-assembly/implement.md`

**Interfaces:**
- Consumes: completed Tasks 1–7 and fresh `semantic_contract_version: 2` runs.
- Produces: deterministic suite evidence, fast-profile spec update, immutable negative evidence from the old Fly Fox run, and forward acceptance evidence for both books.

- [ ] **Step 1: Add the full v2 integration fixture**

Run a three-chapter fixture through archive-existing → prepare → chapters → coverage → prepare-merge → category accepts → assemble-merge → resolution → prepare-clean → category/material accepts → assemble-clean → build-final → quality → install → installed verify → archive-run. Assert no AI `merge:book`/`clean:book` draft exists and both aggregate attempts are 0.

- [ ] **Step 2: Run focused and full deterministic checks**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
for file in .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/scripts/lib/*.js; do node --check "$file"; done
git diff --check
git status --short -- .agents/skills/generate-kb
```

Expected: all Node tests and syntax checks pass, `git diff --check` is clean, and the audit-grade Skill command prints nothing. Run `quick_validate.py` only if its existing environment dependencies are present; do not install global PyYAML to force it.

- [ ] **Step 3: Update only the fast-profile project spec**

Record v2 units, private bindings, 120/96-KiB work limits, attempts-0 aggregates, clean obligations, ledger migration, legacy fail-closed behavior, error matrix, and required tests under the existing fast profile. Confirm `.agents/skills/generate-kb/` remains unchanged.

- [ ] **Step 4: Preserve the old Fly Fox run as negative evidence**

Generate `feihu-merge-clean-audit.json` from immutable draft hashes and history. Include 1,089 candidates, three merge failure distributions, clean `877 = 840 + 36 + 1`, 420 invalid invented reasons, 76 removed named techniques, keep-all retry counts, and unauthorized reset timestamps. Do not modify the live/archived run while deriving the receipt.

- [ ] **Step 5: Run fresh v2 acceptance on both books**

Invoke only the Skill plus each novel directory. The main model autonomously follows v2 work items. Record run ID, contract version, category/shard counts, maximum AI input bytes, attempts per unit, candidate closure, cleanup decision counts, quality result, installed hash, archive hash, and timing. Also record that isolated chapter workers read one complete chapter without whole-book context accumulation, plus the persisted worker-pool limit and any naturally observed 429 batch transition; automated backoff tests remain the evidence when no external 429 occurs. Only fresh v2 runs can check PRD acceptance boxes.

- [ ] **Step 6: Self-review and final checkpoint**

Run the plan-writing placeholder scan, then check contradictory unit names, mismatched function signatures, whole-book AI instructions, and any automatic reset language. Update results and PRD checkboxes only from passing evidence. Commit the exact Task 1–8 files with `feat(game-kb): make merge and cleanup deterministic` after the user approves execution and all checks pass.

## Final Review Checklist

- [ ] Every requirement in `prd.md` maps to a task and an explicit assertion or evidence field.
- [ ] `.agents/skills/generate-kb/` has no diff.
- [ ] 1,089-candidate short-ref expansion and 420-candidate clean migration pass.
- [ ] Stable 120-candidate/96-KiB sharding and consolidation pass on repeated inputs.
- [ ] Mechanical keys and final IDs are absent from every AI-visible input and accepted draft.
- [ ] Every merge member and clean entity ref is decided exactly once.
- [ ] Clean obligations block semantic keep-all bypasses while valid no-op cleanup remains legal.
- [ ] Named techniques and core/important characters cannot be directly dropped.
- [ ] Category failure isolation, exact staging, immutable accepted artifacts, and persistent 429 backoff pass.
- [ ] `merge:book` and `clean:book` use attempts 0 and downstream nine-file output remains byte-compatible.
- [ ] Legacy runs fail closed without losing observational evidence.
- [ ] Only fresh v2 runs provide the two-book quality, install, archive, timing, context-isolation, and worker-pool evidence.
- [ ] Plan/spec placeholder and interface-consistency scans pass.
