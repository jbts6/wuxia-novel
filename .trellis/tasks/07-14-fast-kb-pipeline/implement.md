# generate-game-kb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` and implement this plan inline, task-by-task, with a review checkpoint after each task. Do not dispatch implementation or review sub-agents for this task.

**Goal:** Build an independent `generate-game-kb` Skill that reads a novel chapter by chapter, produces nine compatible knowledge-base JSON files plus a game-material index, isolates and archives every run, detects unexplained category loss, performs only bounded category-level recall, and safely installs verified output into the novel's `data/` directory.

**Architecture:** A file-derived checklist replaces the existing managed state machine. Node.js scripts first archive every previous-build root entry except the source text, `ch_split/`, and `_archive/`, then create an isolated `.game-kb-work/runs/<run-id>/`. Deterministic coverage and candidate-resolution ledgers open bounded `recall:*` or `supplement:*` units only for affected categories. Merge and cleanup use category/shard semantic decisions over short references; deterministic scripts own candidate keys, local keys, ledger migration, inheritance, and compatible whole-book assembly. Accepted artifacts are hash-immutable, final data and reports install from a clean baseline, and the complete run is archived after installed verification.

**Tech Stack:** Node.js CommonJS, Node built-ins (`fs`, `path`, `crypto`), `node:test`, exact-lockfile `pinyin-pro` dependency for deterministic lowercase pinyin IDs, Markdown Skill prompts.

## Global Constraints

- Do not modify any file under `.agents/skills/generate-kb/`.
- New implementation root: `.agents/skills/generate-game-kb/`.
- Final data contains exactly nine top-level-array JSON files: characters, events, items, skills, techniques, factions, locations, dialogues, and chapter summaries.
- `reports/game_materials.json` is an index over those nine files, not a tenth entity category.
- AI never writes final IDs or rewrites cross-file references.
- Each AI unit has at most three total submissions; identical output, identical error, or `A → B → A` stops earlier.
- Each `recall:*` or `supplement:*` unit has at most one semantic generation; any remaining attempt may correct structure only.
- Attempts persist for unchanged input hashes and reset only when the unit input hash changes or the user explicitly runs a confirmed reset.
- Quantity review runs once, reports only, and never opens a recall unit by itself.
- Final source accuracy is chapter-level; line numbers are optional.
- Ordinary unnamed actions never become techniques or a separate action category.
- Any unresolved manual-review issue prevents installation but does not stop unrelated chapter extraction.
- A new run requires a clean root containing only the unique source text, `ch_split/`, and `_archive/`; every other previous-build entry is reversibly archived with a manifest before `prepare`.
- Every run is isolated under `.game-kb-work/runs/<run-id>/`; commands never consume another run's intermediate files or root-level build artifacts.
- Every accepted artifact is hash-immutable, and `ACCEPTED_ARTIFACT_MUTATED` blocks downstream work on mismatch.
- Candidate coverage and category quotas cannot be satisfied by moving counts or samples from another category.
- Dashboard code remains read-only and is not modified; the ninth `events.json` is an additional compatible artifact.
- Use `apply_patch` for manual file edits and `rtk` for shell/git commands.

> **Execution status:** Tasks 1–10 and the file structure immediately below are the implemented historical baseline. Do not execute their unchecked boxes. Current revision work starts at Task 11, whose contracts supersede any conflicting baseline text.

> **2026-07-15 closure boundary:** This task closes the first implementation iteration and preserves its whole-book merge/clean trials as negative evidence. Fresh two-book acceptance, category merge/clean work items, deterministic assembly, and semantic contract v2 are owned by `07-15-game-kb-deterministic-assembly`. Archiving this task does not claim that legacy whole-book runs satisfy v2 acceptance.

## Baseline File Structure (Superseded by Task 11)

```text
.agents/skills/generate-game-kb/
├── SKILL.md                         # AI-facing workflow and stop conditions
├── schemas.md                       # Nine final schemas and intermediate contracts
├── prompts/
│   ├── extract-chapters.md          # Read 2–3 chapters, emit one file per chapter
│   ├── merge-book.md                # Resolve aliases, homonyms, cross-chapter events
│   ├── clean-book.md                # One semantic cleanup and one quantity review
│   └── sample-quality.md            # Review script-selected sample only
├── scripts/
│   ├── flow.js                      # CLI dispatch; no model calls or next_action
│   └── lib/
│       ├── errors.js                # Stable error codes
│       ├── io.js                    # Atomic JSON and filesystem helpers
│       ├── paths.js                 # Workspace and artifact paths
│       ├── source.js                # Source discovery, splitting, hashing
│       ├── progress.js              # Attempts, fingerprints, manual-review ledger
│       ├── chapter-contract.js      # Chapter-draft validation
│       ├── book-contract.js         # Merge/clean validation and semantic invariants
│       ├── quantity.js              # One-time count guidance
│       ├── ids.js                   # Pinyin IDs and stable collision suffixes
│       ├── finalize.js              # Nine-file projection and reference rewrite
│       ├── quality.js               # Deterministic sampling and score validation
│       ├── game-materials.js        # Game-material index projection
│       ├── verify.js                # Final blocking/non-blocking report
│       └── install.js               # Backup, swap, restore, install receipt
└── tests/
    ├── helpers.js
    ├── source.test.js
    ├── progress.test.js
    ├── chapter-contract.test.js
    ├── book-contract.test.js
    ├── finalize.test.js
    ├── quality.test.js
    ├── install.test.js
    ├── cli.test.js
    └── integration.test.js
```

---

### Task 1: Workspace, source discovery, chapter splitting, and prepare CLI

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/errors.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/io.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/source.js`
- Create: `.agents/skills/generate-game-kb/scripts/flow.js`
- Create: `.agents/skills/generate-game-kb/tests/helpers.js`
- Create: `.agents/skills/generate-game-kb/tests/source.test.js`
- Create: `.agents/skills/generate-game-kb/tests/cli.test.js`

**Interfaces:**
- Produces: `GameKbError(code, message, details)`, `atomicWriteJson(file, value)`, `readJson(file)`, `pathsFor(novelDir)`, `prepareNovel(novelDir) -> Manifest`, `splitChapters(sourceText) -> Chapter[]`.
- `Manifest` fields: `schema_version`, `novel_dir`, `source_file`, `source_hash`, `source_char_count`, `chapters[{number,title,file,input_hash}]`, `prepared_at`.
- Later tasks consume `.game-kb-work/manifest.json` and `source/chapters/ch_NNN.txt`.

- [ ] **Step 1: Write source and CLI failure tests**

Add tests that create temporary novels and assert:

```js
test('prepare splits CRLF Chinese chapter headings and hashes normalized content', () => {
  const novel = makeNovel('试书', '第一章 起始\r\n甲。\r\n第二章 转折\r\n乙。');
  const manifest = prepareNovel(novel);
  assert.equal(manifest.chapters.length, 2);
  assert.equal(readFileSync(manifest.chapters[0].file, 'utf8'), '第一章 起始\n甲。\n');
  assert.match(manifest.source_hash, /^sha256:[a-f0-9]{64}$/);
});

test('prepare treats a headingless novella as one chapter', () => {
  const novel = makeNovel('短篇', '越女临江。\n故事结束。');
  assert.equal(prepareNovel(novel).chapters.length, 1);
});

test('prepare rejects ambiguous root source files', () => {
  const novel = makeNovelDirectory(['甲.txt', '乙.txt']);
  assert.throws(() => prepareNovel(novel), { code: 'SOURCE_AMBIGUOUS' });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/source.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for the new libraries.

- [ ] **Step 3: Implement the workspace and source primitives**

Implement these exact exports:

```js
// errors.js
class GameKbError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GameKbError';
    this.code = code;
    this.details = details;
  }
}
module.exports = { GameKbError };

// paths.js
function pathsFor(novelDir) {
  const work = path.join(path.resolve(novelDir), '.game-kb-work');
  return {
    novel: path.resolve(novelDir), work,
    manifest: path.join(work, 'manifest.json'),
    progress: path.join(work, 'progress.json'),
    manualReview: path.join(work, 'manual_review.json'),
    sourceChapters: path.join(work, 'source', 'chapters'),
    drafts: path.join(work, 'drafts'),
    chapters: path.join(work, 'chapters'),
    merged: path.join(work, 'merged', 'book.json'),
    cleaned: path.join(work, 'cleaned', 'book.json'),
    finalRoot: path.join(work, 'final'),
    finalData: path.join(work, 'final', 'data'),
    finalReports: path.join(work, 'final', 'reports')
  };
}
```

`atomicWriteJson` must create the parent, write `<file>.tmp-<pid>-<nonce>`, `fsyncSync` the file, then rename it over the destination. `prepareNovel` must prefer `<novelDir>/<basename>.txt`; otherwise it accepts exactly one root `.txt`. It must normalize CRLF, preserve chapter headings, create a single chapter when no heading exists, write chapter files atomically, and avoid rewriting unchanged files.

Wire `flow.js prepare <novel>` and JSON-safe error output with nonzero exit status.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/source.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: all Task 1 tests PASS; missing/ambiguous source cases exit nonzero with stable codes.

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add .agents/skills/generate-game-kb/scripts .agents/skills/generate-game-kb/tests
rtk git commit -m "feat(game-kb): prepare source workspace"
```

---

### Task 2: Persistent submission budget and no-progress circuit breaker

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Create: `.agents/skills/generate-game-kb/tests/progress.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/source.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`

**Interfaces:**
- Consumes: `atomicWriteJson`, `readJson`, `pathsFor`, manifest chapter hashes.
- Produces: `loadProgress(paths, manifest)`, `recordSubmission(progress, unit, inputHash, outputHash, errors)`, `resetUnit(progress, unit, confirmed)`, `statusReport(paths)`, `normalizeErrorFingerprint(errors)`.
- Unit state is `{ input_hash, status, attempts, output_hashes, error_fingerprints, last_errors }`.

- [ ] **Step 1: Write failure and restart tests**

Cover all bounded-loop rules:

```js
test('third total submission exhausts the unit', () => {
  let state = freshUnit('sha256:input');
  state = recordSubmission(state, 'sha256:a', [{ code: 'E1', path: 'x' }]);
  state = recordSubmission(state, 'sha256:b', [{ code: 'E2', path: 'y' }]);
  state = recordSubmission(state, 'sha256:c', [{ code: 'E3', path: 'z' }]);
  assert.equal(state.status, 'manual_review');
  assert.equal(state.attempts, 3);
});

test('a valid third submission completes instead of exhausting the unit', () => {});
test('identical output and identical error stop on the second submission', () => {});
test('A-B-A output or error history stops on the third submission', () => {});
test('reload keeps attempts when input hash is unchanged', () => {});
test('changed chapter hash creates a stale unit with a fresh budget', () => {});
test('reset requires confirmed=true and affects only one unit', () => {});
test('done unchanged unit rejects resubmission without consuming attempts', () => {});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/progress.test.js
```

Expected: FAIL because `progress.js` does not exist.

- [ ] **Step 3: Implement progress and fingerprints**

Use this decision order in `recordSubmission`:

```js
const attempts = unit.attempts + 1;
const outputs = [...unit.output_hashes, outputHash].slice(-3);
const fingerprint = normalizeErrorFingerprint(errors);
const fingerprints = [...unit.error_fingerprints, fingerprint].slice(-3);
const repeatedOutput = outputs.length >= 2 && outputs.at(-1) === outputs.at(-2);
const repeatedError = fingerprints.length >= 2 && fingerprints.at(-1) === fingerprints.at(-2);
const outputAba = outputs.length === 3 && outputs[0] === outputs[2];
const errorAba = fingerprints.length === 3 && fingerprints[0] === fingerprints[2];
const exhausted = attempts >= 3;
const status = errors.length === 0
  ? 'done'
  : repeatedOutput || repeatedError || outputAba || errorAba || exhausted
    ? 'manual_review'
    : 'pending';
```

Normalize fingerprints from sorted `{code,path,target}` triples only. Persist `progress.json` and `manual_review.json` atomically after every submission. A changed input hash must archive the previous unit state under `history` and create `status: 'stale'`, `attempts: 0`.

Every route must pass a deterministic upstream input hash into `recordSubmission`: `chapter:NNN` uses that manifest chapter's `input_hash`; `merge:book` uses the stable hash of all accepted normalized chapter files and their manifest hashes; `clean:book` uses the stable hash of the accepted merged book plus the persisted pre-clean quantity report; `quality:sample` uses the stable hash of final data plus the persisted sample manifest. A `done` unit with the same input hash rejects resubmission without incrementing attempts; a changed upstream hash archives the previous state and opens a fresh budget.

Add `status <novel>` and `reset-unit <novel> --unit <id> --confirm` CLI commands. `status --json` must return counts and file paths only; it must not contain `next_action`, `command`, or an executable instruction.

- [ ] **Step 4: Run focused tests and CLI probes**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/progress.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: PASS; persisted attempts survive a new Node process; reset without `--confirm` exits nonzero.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add .agents/skills/generate-game-kb/scripts .agents/skills/generate-game-kb/tests
rtk git commit -m "feat(game-kb): bound correction attempts"
```

---

### Task 3: Chapter draft contract, extraction prompt, and accept command

**Files:**
- Create: `.agents/skills/generate-game-kb/schemas.md`
- Create: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Create: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`

**Interfaces:**
- Consumes: manifest chapter number/hash and submission budget.
- Produces: `validateChapterDraft(draft, expected) -> ErrorDetail[]`, `acceptDraft({paths, unit, draftPath}) -> AcceptResult`.
- A valid chapter draft has the nine intermediate keys plus a singular `summary`; candidates use `local_key`, names, name-based links, and chapter refs, never final IDs.

- [ ] **Step 1: Write chapter-contract tests**

Test these exact cases:

```js
test('accepts one chapter containing all candidate arrays and one summary', () => {});
test('rejects wrong chapter number or source hash', () => {});
test('rejects source refs to another chapter during chapter extraction', () => {});
test('rejects a technique unless named_in_source is true and name is nonempty', () => {});
test('rejects unnamed ordinary actions represented as techniques', () => {});
test('rejects a dialogue without event_local_key', () => {});
test('rejects two dialogues for the same event_local_key', () => {});
test('counts malformed drafts against the three-submission budget', () => {});
```

Use a valid intermediate technique shaped as:

```js
{
  local_key: 'tech:胡家刀法:八方藏刀式',
  name: '八方藏刀式',
  named_in_source: true,
  source_skill_name: '胡家刀法',
  description: '以守为攻的有名刀式',
  importance: '重要',
  source_refs: [{ chapter: 3, text: '八方藏刀' }]
}
```

- [ ] **Step 2: Run test and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/chapter-contract.test.js
```

Expected: FAIL with missing `chapter-contract.js`.

- [ ] **Step 3: Write the intermediate and final schema contract**

`schemas.md` must define all keys and explicitly state:

- `chapter` and nonempty `text` are required in source refs; line fields are optional.
- Chapter drafts may reference only their own chapter.
- Final events may reference multiple chapters.
- Final IDs are forbidden in chapter, merge, and clean AI drafts.
- Techniques require `named_in_source: true` in intermediate data.
- Dialogues require event linkage and at most one per event.
- Characters have five levels; only core/important require detailed biography/personality.
- Important-item inclusion reasons are `秘籍`, `剧情关键`, `高级药毒`, `神兵利器`, or `其他稀有特殊`.

Write `extract-chapters.md` as a complete prompt with input/output examples, the game-material bias, ordinary-action exclusion, chapter-only evidence, per-event dialogue cap, and an instruction to output one JSON object per chapter even when reading 2–3 chapters together.

- [ ] **Step 4: Implement validation and accept routing**

`validateChapterDraft` must return stable objects:

```js
{ code: 'CHAPTER_DRAFT_INVALID', path: 'techniques[0].named_in_source', target: '八方藏刀式' }
```

`flow.js accept <novel> --unit chapter:003 --draft <path>` must:

1. load manifest and progress;
2. verify the draft is outside accepted artifact paths;
3. hash the raw draft;
4. validate it against chapter 3 and pass the manifest chapter `input_hash` as the unit input hash;
5. record the attempt before returning;
6. on success atomically copy normalized JSON to `chapters/ch_003.json`;
7. on failure preserve the immutable draft and print the remaining budget or manual-review state.

- [ ] **Step 5: Run focused tests**

```bash
node --test .agents/skills/generate-game-kb/tests/chapter-contract.test.js .agents/skills/generate-game-kb/tests/progress.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: PASS; no accepted file is written for an invalid draft.

- [ ] **Step 6: Commit Task 3**

```bash
rtk git add .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): validate chapter extraction"
```

---

### Task 4: Book merge, one cleanup, character tiers, and one-time quantity review

**Files:**
- Create: `.agents/skills/generate-game-kb/prompts/merge-book.md`
- Create: `.agents/skills/generate-game-kb/prompts/clean-book.md`
- Create: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/quantity.js`
- Create: `.agents/skills/generate-game-kb/tests/book-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Consumes: all accepted `chapters/ch_NNN.json`, manifest character count, merged and cleaned drafts.
- Produces: `normalizeName(name)`, `groupCandidates(chapters)`, `validateMergedBook(book, manifest)`, `validateCleanedBook(book, manifest)`, `buildQuantityReport(cleaned, sourceCharCount)`, accepted units `merge:book` and `clean:book`.

- [ ] **Step 1: Write merge and cleanup tests**

Cover:

```js
test('groups exact normalized names but leaves homonyms unresolved', () => {});
test('merges one event across non-contiguous source chapters', () => {});
test('cleaned book keeps detailed fields only for core and important characters', () => {});
test('rejects ordinary items without an approved inclusion reason', () => {});
test('keeps named low-frequency techniques and rejects unnamed actions', () => {});
test('allows at most one dialogue per merged event', () => {});
test('quantity report chooses short medium and long ranges by Han character count', () => {});
test('accepting clean:book marks quantity_review_consumed exactly once', () => {});
test('a second automatic clean submission is rejected after done', () => {});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/book-contract.test.js
```

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement deterministic pre-grouping and quantity ranges**

`normalizeName` must use Unicode NFKC, trim whitespace and surrounding book-title punctuation, lowercase ASCII, and preserve Chinese characters. It must not strip meaningful internal punctuation blindly.

`buildQuantityReport` must encode the approved ranges:

```js
const RANGES = {
  short: { characters:[10,35], events:[20,80], items:[3,12], skills:[5,20], techniques:[0,20], factions:[2,12], locations:[5,25], dialogues:[5,25] },
  medium:{ characters:[25,75], events:[60,220], items:[6,20], skills:[10,35], techniques:[5,45], factions:[5,25], locations:[10,50], dialogues:[20,60] },
  long:  { characters:[45,120], events:[150,400], items:[10,30], skills:[15,50], techniques:[10,80], factions:[10,40], locations:[20,80], dialogues:[40,100] }
};
```

Return actual counts, ranges, per-chapter density, and warnings. Never return `passed`, `failed`, or an instruction to add entities.

- [ ] **Step 4: Implement merged and cleaned contracts**

Merged validation must allow unresolved name links only when they appear in a structured `ambiguities` list. Cleaned validation must require ambiguities to be empty or copied to `manual_review`.

Character projection rules:

```js
const DETAILED_CHARACTER_LEVELS = new Set(['核心', '重要']);
const SUMMARY_CHARACTER_LEVELS = new Set(['次要', '龙套', '背景']);
```

For summary levels, reject long/template biographies rather than requiring five traits. Enforce approved item reasons, named techniques, event-linked dialogues, one chapter summary per manifest chapter, and no tenth category.

Write `merge-book.md` and `clean-book.md` with one-pass instructions. The cleanup prompt must receive the pre-clean quantity report, may make one evidence-based addition/deletion decision, and must emit `quantity_review: { consumed: true, explanations: [...] }`.

- [ ] **Step 5: Wire `accept` for merge and cleanup**

`accept <novel> --unit merge:book` is legal only when all non-manual chapter units are done and no missing chapter exists. `accept <novel> --unit clean:book` is legal only after merge is done and may complete once. Failed drafts consume the same three-attempt budget; a successful clean prevents further automatic cleanup submissions.

Before recording either submission, compute the exact upstream input hash defined in Task 2. Persist the pre-clean quantity report before accepting `clean:book`, so a restart cannot silently change the cleanup budget or consume quantity review twice.

- [ ] **Step 6: Run focused tests**

```bash
node --test .agents/skills/generate-game-kb/tests/book-contract.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: PASS; quantity warnings do not change exit status; a second cleanup is rejected.

- [ ] **Step 7: Commit Task 4**

```bash
rtk git add .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): merge and clean book data"
```

---

### Task 5: Deterministic pinyin IDs, collision handling, and nine-file projection

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.agents/skills/generate-game-kb/scripts/lib/ids.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Create: `.agents/skills/generate-game-kb/tests/finalize.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Consumes: accepted cleaned book with canonical names and name-based links.
- Produces: `makeBaseId(category, canonicalName)`, `assignStableIds(recordsByCategory)`, `resolveReferences(recordsByCategory, idPlan)`, `buildFinalData(cleaned, manifest)`, and `build-final` CLI command.

- [ ] **Step 1: Lock the sole runtime dependency**

Run:

```bash
rtk npm install --save-exact pinyin-pro@3.28.1
```

Expected: `package.json` and `package-lock.json` record exact version `3.28.1`; no other dependency changes.

- [ ] **Step 2: Write deterministic ID and reference tests**

```js
test('北冥神功 receives skill_bei_ming_shen_gong', () => {});
test('same category and canonical name always produce the same ID', () => {});
test('same pinyin collision uses a stable alphabetic sha256 name suffix', () => {});
test('input ordering does not change IDs or final JSON ordering', () => {});
test('all name links are rewritten once without AI IDs', () => {});
test('zero-match and multi-match links create manual-review issues', () => {});
test('build emits exactly nine array JSON files', () => {});
test('source refs require valid chapters but allow omitted line numbers', () => {});
```

- [ ] **Step 3: Run tests and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/finalize.test.js
```

Expected: FAIL with missing `ids.js` or `finalize.js`.

- [ ] **Step 4: Implement ID generation**

Use CommonJS `const { pinyin } = require('pinyin-pro')` and `pinyin(name, { toneType: 'none', type: 'array' })`. Normalize each token to lowercase ASCII letters `[a-z]+` and join with `_`. Prefix map:

```js
const PREFIX = {
  characters: 'char', events: 'event', items: 'item', skills: 'skill',
  techniques: 'tech', factions: 'faction', locations: 'loc', dialogues: 'dialogue'
};
```

Chapter summaries retain chapter identity and do not need a synthetic entity ID. When two distinct canonical names in one category share a base slug, map the first eight hex characters of `sha256(category + '\0' + canonicalName)` deterministically from `0`–`f` to `a`–`p`, then append that eight-letter token to every colliding ID so ordering cannot change the winner. Every final entity ID must match `^(char|event|item|skill|tech|faction|loc|dialogue)_[a-z]+(?:_[a-z]+)*$`.

- [ ] **Step 5: Implement one-shot reference projection**

Build an immutable plan from category, canonical name, and accepted aliases. Resolve references by expected target category. Do not perform fuzzy matching. Emit structured issues:

```js
{ code: 'REFERENCE_UNRESOLVED', path: 'dialogues[2].event_id', target: '雪山对决' }
{ code: 'REFERENCE_AMBIGUOUS', path: 'characters[4].relationships[0].target', target: '平四' }
```

Only write `.game-kb-work/final/data/*.json` when every reference resolves. Sort entity files by stable ID and summaries by chapter so repeated builds are byte-stable.

- [ ] **Step 6: Wire and verify `build-final`**

`flow.js build-final <novel>` must reject missing/invalid clean data, unresolved manual issues, or an unconsumed quantity review. It must never read old `data/*.json` as generation input.

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/finalize.test.js .agents/skills/generate-game-kb/tests/book-contract.test.js
```

Expected: PASS; two builds over the same cleaned fixture produce identical hashes.

- [ ] **Step 7: Commit Task 5**

```bash
rtk git add package.json package-lock.json .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): project stable final IDs"
```

---

### Task 6: Game-material index, deterministic quality sample, and final verifier

**Files:**
- Create: `.agents/skills/generate-game-kb/prompts/sample-quality.md`
- Create: `.agents/skills/generate-game-kb/scripts/lib/game-materials.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/quality.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Create: `.agents/skills/generate-game-kb/tests/quality.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Consumes: final nine JSON files, cleaned material candidates, manifest, accepted `quality:sample` draft.
- Produces: `buildGameMaterials(finalData, candidates)`, `selectQualitySample(finalData, seed)`, `validateQualityReview(review, sample)`, `verifyFinal(paths)`, `reports/game_materials.json`, `reports/quantity_report.json`, `reports/quality_report.json`.

- [ ] **Step 1: Write quality and index tests**

Test:

```js
test('game-material entries reference existing final IDs only', () => {});
test('sample uses fixed category quotas and stable seed ordering', () => {});
test('short category quota is redistributed deterministically', () => {});
test('standard sample passes at 38 of 40 and fails at 37', () => {});
test('small sample requires ceil(n * 0.95) passes', () => {});
test('quality failure creates manual review without cleanup action', () => {});
test('line precision warnings never block chapter-valid source refs', () => {});
test('verify rejects missing arrays IDs refs summaries and dialogue event links', () => {});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/quality.test.js
```

Expected: FAIL with missing quality modules.

- [ ] **Step 3: Implement game-material projection**

Allow only:

```js
const MATERIAL_TYPES = new Set([
  '战斗系统原型', '经典剧情桥段', '角色原型/彩蛋', '标志性物品', '门派与世界观素材'
]);
```

Each entry must contain `material_type`, `source_id`, `relevance`, `suggested_use`, and `reason`. Reject any source ID absent from final data and any embedded invented entity object.

- [ ] **Step 4: Implement deterministic sample selection**

Use exact quotas `{ martial:15, events:10, characters:5, items:5, other:5 }`. Derive rank keys from `sha256(seed + '\0' + category + '\0' + id)`, take the lowest keys, and redistribute deficits in fixed order `martial, events, characters, items, other`. Persist the selected IDs before AI review.

`sample-quality.md` must instruct the reviewer to inspect only selected records and their referenced chapters, mark each record pass/fail for name, category, key facts, and chapter, and never repair data.

- [ ] **Step 5: Implement quality acceptance and verifier**

A valid review includes exactly the sampled IDs once each. Passing threshold is `38` for a 40-row sample or `Math.ceil(n * 0.95)` otherwise. A valid low score immediately records `QUALITY_SAMPLE_FAILED` in manual review; it must not create a cleanup unit or return a retry command.

`verifyFinal` must separate `blocking_errors` from `warnings`. Quantity and line precision appear only in warnings. Missing files, non-arrays, invalid required fields, duplicate IDs, unresolved refs, missing summaries, bad dialogue links, invalid game index, low quality, or manual issues block.

- [ ] **Step 6: Wire review submission and verify CLI**

`verify <novel>` creates the deterministic sample manifest when absent and reports `QUALITY_REVIEW_REQUIRED` without an executable next action. AI submits its review through `accept <novel> --unit quality:sample`; malformed reviews use the three-attempt budget, but a valid score below threshold goes directly to manual review.

The `quality:sample` submission input hash is the stable hash of final data plus the already persisted sample manifest. Re-running `verify` must reuse that manifest and must not reset, replace, or reshuffle the review budget.

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/quality.test.js .agents/skills/generate-game-kb/tests/finalize.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: PASS; quantity-only warnings leave `verifyFinal().passed === true`.

- [ ] **Step 7: Commit Task 6**

```bash
rtk git add .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): verify game material quality"
```

---

### Task 7: Safe data backup, directory swap, recovery, and receipt

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Create: `.agents/skills/generate-game-kb/tests/install.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`

**Interfaces:**
- Consumes: `verifyFinal(paths).passed`, final data/reports, existing novel `data/` and `reports/`.
- Produces: `installVerifiedData(novelDir, options)`, `recoverInterruptedInstall(novelDir)`, `verifyInstalled(novelDir)`, archive directory, `reports/generate_game_kb_install.json`, and `verify <novel> --installed`.

- [ ] **Step 1: Write installation and fault-injection tests**

Cover:

```js
test('install refuses blocking verification or manual-review issues', () => {});
test('install preserves unknown non-target data files', () => {});
test('install records but removes REBUILD_REQUIRED.md after success', () => {});
test('install backs up the entire previous data directory', () => {});
test('failure before old-data move leaves data unchanged', () => {});
test('failure after old-data move restores the archive', () => {});
test('recovery reports fail closed when both data and archive are ambiguous', () => {});
test('successful retry does not create duplicate or misleading receipts', () => {});
test('verify --installed validates installed data reports and receipt without reading work final', () => {});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/install.test.js
```

Expected: FAIL with missing `install.js`.

- [ ] **Step 3: Implement staging and preservation**

Create `data.next-generate-game-kb-<run-token>` on the same filesystem. Copy the nine verified JSON files first. Then copy every existing `data/` entry whose name is not one of the nine JSON files and is not `REBUILD_REQUIRED.md`; reject collisions and unsafe path traversal. Re-run final data validation against the staged directory.

- [ ] **Step 4: Implement swap and restoration**

Use this order:

```js
renameSync(existingData, archiveData);
try {
  renameSync(nextData, existingData);
} catch (error) {
  renameSync(archiveData, existingData);
  throw new GameKbError('INSTALL_SWAP_FAILED', 'Restored previous data after swap failure', { cause: error.message });
}
```

Create `_archive/<UTC timestamp>-pre-generate-game-kb/data/`. If `data/` is missing or empty, still use a unique archive receipt but do not create a fake nonempty backup. Write the install receipt only after final `data/` re-verifies; include source hash, final hash, archive path, preserved entries, removed stale markers, and timestamps.

- [ ] **Step 5: Wire `install`, installed verification, and run tests**

`install <novel>` must refuse unless work-final verification passes. `verify <novel> --installed` must read `<novel>/data/`, the named `reports/` artifacts, and `generate_game_kb_install.json`; it must not fall back to `.game-kb-work/final` when installed files are missing or stale.

```bash
node --test .agents/skills/generate-game-kb/tests/install.test.js .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: PASS; injected post-move failure leaves the original data visible.

- [ ] **Step 6: Commit Task 7**

```bash
rtk git add .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): install verified data safely"
```

---

### Task 8: Complete Skill instructions and end-to-end integration fixture

**Files:**
- Create: `.agents/skills/generate-game-kb/SKILL.md`
- Create: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Modify: `.agents/skills/generate-game-kb/prompts/*.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`

**Interfaces:**
- Consumes: all Task 1–7 CLI commands and artifacts.
- Produces: complete user-facing workflow and a three-chapter fixture that exercises prepare → accept chapters → merge → clean → build-final → quality review → verify → install.

- [ ] **Step 1: Read skill-authoring instructions before editing the Skill**

At execution time, fully read and apply `skill-creator`, `writing-skills`, and `writing-great-skills`. Keep project/user requirements authoritative when their defaults differ.

- [ ] **Step 2: Write the failing integration test**

The fixture must include:

- one core and one minor character;
- one cross-chapter event;
- one named skill and technique;
- one ordinary unnamed action that must disappear;
- one important medicine and one ordinary dagger that must disappear;
- one faction, one location, one event-linked dialogue per event, and three summaries;
- one game-material entry of each supported type.

Assert that installation produces nine arrays, no ordinary action/item, concise minor character data, valid event/dialogue links, empty manual review, and a passing install receipt.

- [ ] **Step 3: Run integration test and confirm failure**

```bash
node --test .agents/skills/generate-game-kb/tests/integration.test.js
```

Expected: FAIL until `SKILL.md` and the complete workflow contracts are present.

- [ ] **Step 4: Write complete `SKILL.md`**

The Skill must:

- identify itself as a fast, game-oriented, source-grounded alternative, not the audit-grade managed `generate-kb`;
- require reading `schemas.md` and the current stage prompt;
- run `prepare` and observational `status` at start/resume;
- process 2–3 chapters per AI turn while writing one draft per chapter;
- never loop on `status`, never reset a budget automatically, and stop automatic work on `manual_review` units;
- proceed with unrelated chapters after one unit fails;
- perform exactly one merge, one cleanup, one quantity review, and one fixed sample review;
- forbid final ID creation by AI;
- require `verify` before `install` and refuse completion unless installed data re-verifies;
- state the 60/90 minute targets as benchmarks, not correctness gates.

- [ ] **Step 5: Complete prompts and schema examples**

Ensure all prompts use the same property names defined in `schemas.md` and tested by contracts. Include fully valid examples for chapter draft, merged/cleaned book, quality review, manual issue, each final category, and game-material index. Do not include placeholder text or example final IDs in AI-produced intermediate output.

- [ ] **Step 6: Run full new-Skill tests and syntax checks**

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

```bash
find .agents/skills/generate-game-kb/scripts -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: all tests PASS; every JavaScript file passes syntax checking.

- [ ] **Step 7: Confirm existing implementation isolation**

```bash
rtk git diff --exit-code -- .agents/skills/generate-kb
```

Expected: exit 0 with no diff.

- [ ] **Step 8: Commit Task 8**

```bash
rtk git add .agents/skills/generate-game-kb
rtk git commit -m "feat(game-kb): document complete generation workflow"
```

---

### Task 9: Record the separate fast-profile contract in project specs

**Files:**
- Modify: `.trellis/spec/backend/quality-guidelines.md`
- Test: `.agents/skills/generate-game-kb/tests/integration.test.js`

**Interfaces:**
- Consumes: completed implementation behavior.
- Produces: a scoped project contract that distinguishes audit-grade managed `generate-kb` from fast game-material `generate-game-kb` without weakening the former.

- [ ] **Step 1: Run `trellis-update-spec` against the completed implementation**

Add a separate scenario titled `Fast Game-Material Knowledge Base Profile` that states:

- existing six-stage `generate-kb`, G1–G5, and `.kb/current` rules remain unchanged for audit-grade runs;
- `generate-game-kb` is a separate source-grounded, chapter-level, 95%-sampled profile;
- it may write verified nine-file data directly only through its backup/swap installer;
- it cannot claim G1–G5 completion, recall completeness, or exact evidence;
- quantity is advisory only;
- three-attempt and no-progress circuit breakers are mandatory;
- named martial skills/techniques remain high recall, ordinary actions remain excluded.

Also document that the Dashboard's existing eight browseability files remain unchanged and `events.json` is an additional compatible file.

- [ ] **Step 2: Review the spec for contradictions**

Verify the existing managed scenario still says `scripts/pipeline.js` is the only managed-run writer. Scope that statement explicitly to `.agents/skills/generate-kb` so it does not accidentally prohibit the new independent installer, without loosening managed write guards.

- [ ] **Step 3: Run full tests after spec update**

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

Expected: all tests PASS; documentation examples match the implemented commands and schema names.

- [ ] **Step 4: Commit Task 9**

```bash
rtk git add .trellis/spec/backend/quality-guidelines.md .agents/skills/generate-game-kb
rtk git commit -m "docs: define fast game knowledge profile"
```

---

### Task 10: Fly Fox of Snowy Mountain end-to-end trial and final evidence

**Files:**
- Generated: `金庸/飞狐外传/.game-kb-work/**`
- Generated: `金庸/飞狐外传/data/*.json`
- Generated: `金庸/飞狐外传/reports/game_materials.json`
- Generated: `金庸/飞狐外传/reports/quantity_report.json`
- Generated: `金庸/飞狐外传/reports/quality_report.json`
- Generated: `金庸/飞狐外传/reports/generate_game_kb_install.json`
- Modify: `.trellis/tasks/07-14-fast-kb-pipeline/implement.md` only to check completed boxes and record commands/results.

**Interfaces:**
- Consumes: the completed Skill and `金庸/飞狐外传/飞狐外传.txt`.
- Produces: installed nine-file knowledge base, game-material index, quality/quantity/install evidence, and measured timing.

- [x] **Step 1: Verify the trial preconditions**

Run:

```bash
node .agents/skills/generate-game-kb/scripts/flow.js prepare "金庸/飞狐外传"
node .agents/skills/generate-game-kb/scripts/flow.js status "金庸/飞狐外传" --json
```

Expected: about 38.2万 Han characters, 20 chapters, empty or non-installed current data, no preexisting manual issues.

Result: `prepare` recorded 382,100 source characters and 20 chapters. The run started with no manual-review items and no installed target data.

- [x] **Step 2: Record start time and process chapter batches**

Record an ISO start timestamp in the run report. Follow `SKILL.md`, reading 2–3 full chapters per turn and submitting one draft per chapter. After each batch, run observational status and verify completed counts only; do not execute a generated next action because none exists.

Expected: all 20 chapter units become done or unrelated work continues until any manual issues are consolidated.

Result: all 20 chapter units reached `done` on their first submission; no chapter entered `manual_review`.

- [x] **Step 3: Perform one merge and one cleanup**

Generate and accept `merge:book`, then generate and accept `clean:book` exactly once. Confirm quantity output uses the medium ranges and `quantity_review.consumed === true`.

Expected: ordinary items/actions are absent; only core/important characters are detailed; dialogues are event-linked and within the 20–60 guidance range unless an explanation records a legitimate exception.

Result: `merge:book` and `clean:book` each succeeded on the first submission. The one-shot quantity review was consumed; ordinary actions/items were absent. Dialogue count remained 9 with an explicit non-blocking explanation instead of padding.

- [x] **Step 4: Build final data and complete the fixed quality sample**

Run:

```bash
node .agents/skills/generate-game-kb/scripts/flow.js build-final "金庸/飞狐外传"
node .agents/skills/generate-game-kb/scripts/flow.js verify "金庸/飞狐外传"
```

Review only the persisted sample, submit `quality:sample`, then rerun verify.

Expected: at least 38/40 pass, or `ceil(n*0.95)` for a smaller sample; no automatic whole-book correction is triggered.

Result: the fixed 40-record sample passed 38/40. The two failed records were retained as honest sample findings; the flow did not return to merge or cleanup.

- [x] **Step 5: Install and reverify**

```bash
node .agents/skills/generate-game-kb/scripts/flow.js install "金庸/飞狐外传"
node .agents/skills/generate-game-kb/scripts/flow.js verify "金庸/飞狐外传" --installed
```

Expected: nine array JSON files in `data/`, valid game index, empty manual review, install receipt present, and previous data archived if nonempty.

Result: all nine arrays and four named reports were installed. `verify --installed` passed with final hash `sha256:fafc2ca45ee283df091a93da307a27375642a4a3b5925df762bbb0bbcf49da2a`; manual-review count remained zero.

- [x] **Step 6: Record benchmark results**

Record end timestamp and these durations in the run report:

- AI chapter extraction;
- AI merge/cleanup/review;
- script processing;
- human wait;
- total wall time.

Expected target: total no more than 60 minutes for this medium novel. If slower, preserve valid output and report the benchmark miss as non-blocking performance evidence.

Result: the run report records 1,756.789 seconds total wall time (about 29 minutes 17 seconds): 1,378.020 seconds chapter extraction, 330.003 seconds merge/cleanup/review, 48.766 seconds script processing, and 0 seconds human wait. This also meets the user-approved relaxed 90-minute ceiling.

- [x] **Step 7: Run final regression and isolation checks**

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

```bash
find .agents/skills/generate-game-kb/scripts -name '*.js' -print0 | xargs -0 -n1 node --check
```

```bash
rtk git diff --exit-code -- .agents/skills/generate-kb
```

Expected: all new tests PASS, syntax checks pass, and existing `generate-kb` has no diff.

Result: 71/71 new-Skill tests passed; all 16 script files passed `node --check`; installed-data verification passed; and `rtk git diff --exit-code -- .agents/skills/generate-kb` exited zero.

- [ ] **Step 8: Commit final trial evidence**

Before committing generated novel data, inspect repository policy and file sizes. Stage only intended final `data/`, named reports, task artifacts, Skill implementation, dependency lockfiles, and spec update; do not stage transient `.game-kb-work/drafts` unless repository policy explicitly requires it.

```bash
rtk git status --short
```

Suggested final commit message if a squash/final evidence commit is needed:

```bash
rtk git commit -m "feat: add fast game knowledge generation"
```

---

## 2026-07-14 Revision: Isolated Runs, Complete Archival, and Targeted Recall

Tasks 1–10 describe the implemented baseline and its first Fly Fox trial. The tasks below are the pending revision prompted by the Laughing in the Wind trial. They supersede conflicting baseline statements about a shared `.game-kb-work/`, data-only backup, reallocatable quality quotas, dialogue extraction limits, and quantity-driven recall.

| Revised contract | Implementation task |
|---|---|
| `archive-existing` leaves only source text, `ch_split/`, and `_archive/`; `archive-manifest.json` supports rollback | Task 11 |
| `.game-kb-work/runs/<run-id>/` isolates all intermediates and source hashes | Task 11 |
| Candidate ledger uses `merged_to`, `rejected`, or `ambiguous`; accepted files are immutable | Task 12 |
| `recall:items` triggers at zero candidates for at least 150,000 Han characters or at least 20 core/important events | Task 13 |
| `recall:dialogues` triggers below 70% quotable-event coverage or below 30% chapter coverage across at least eight event-bearing chapters | Task 13 |
| Fixed sample quotas are skills/techniques 12, events 8, characters 5, items 5, dialogues 4, factions/locations 4, summaries 2 | Task 14 |
| Clean install, `archive-run`, and `started_at` / `installed_at` / `archived_at` timing | Task 14 |
| Regression fixtures and fast-profile project contract | Task 15 |
| Same generic flow passes Laughing in the Wind and Fly Fox acceptance | Task 16 |

### Task 11: Clean-root archival and run-id isolation

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/source.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Create: `.agents/skills/generate-game-kb/tests/archive.test.js`
- Create: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`

**Interfaces:**
- `buildArchivePlan(novelDir) -> { source_file, retained, entries, archive_dir }`
- `archiveExisting(novelDir, options) -> archive receipt`
- `assertCleanNovelRoot(novelDir) -> void`
- `createOrResumeRun(novelDir, options) -> { run_id, run_dir, source_hash }`
- `resolveRun(novelDir, runId?) -> run paths`; more than one eligible run without `runId` throws `RUN_AMBIGUOUS`.

- [x] **Step 1: Write failing archival contract and fault-injection tests**

Cover the exact root allowlist: one source `.txt`, `ch_split/`, and `_archive/`. Assert `data/`, `reports/`, `build/`, `prompts/`, `review/`, `summary.md`, `split-config.json`, old `.game-kb-work/`, hidden files, and any other root entry appear in the archive plan and retain their relative paths. Reject multiple root texts, out-of-root symlinks, archive path collisions, and nested archive targets. Inject failure after each move and assert all prior moves roll back.

The first test must be executable against the wished-for API and fail because the module does not exist yet:

```javascript
const { buildArchivePlan, archiveExisting, assertCleanNovelRoot } = require('../scripts/lib/archive');

test('archives every non-source root entry and leaves the allowlist', () => {
  const novel = makeNovelDirectory({ '试书.txt': '第一章\\n正文\\n', 'summary.md': 'old\\n', '.hidden': 'old\\n' });
  for (const entry of ['data', 'reports', 'build', 'prompts', 'review', '.game-kb-work']) {
    fs.mkdirSync(path.join(novel, entry), { recursive: true });
    fs.writeFileSync(path.join(novel, entry, 'old.json'), '{}\\n');
  }
  fs.mkdirSync(path.join(novel, 'ch_split'), { recursive: true });
  fs.writeFileSync(path.join(novel, 'ch_split', 'ch_001.txt'), '第一章\\n正文\\n');

  const plan = buildArchivePlan(novel, { archiveId: 'before-run-1' });
  assert.deepEqual(plan.retained.sort(), ['_archive', 'ch_split', '试书.txt']);
  assert.ok(plan.entries.some(entry => entry.relative_path === 'data/old.json'));
  assert.ok(plan.entries.some(entry => entry.relative_path === '.game-kb-work/old.json'));
  assert.equal(plan.entries.every(entry => entry.archive_path.startsWith(plan.archive_dir)), true);

  const receipt = archiveExisting(novel, { archiveId: 'before-run-1' });
  assert.equal(receipt.status, 'archived');
  assertCleanNovelRoot(novel);
  assert.equal(fs.existsSync(path.join(novel, '_archive', 'before-run-1', 'archive-manifest.json')), true);
});

test('rolls back all moves when a later move fails', () => {
  const novel = makeNovelDirectory({ '试书.txt': '正文\\n', 'summary.md': 'old\\n', 'notes.md': 'old\\n' });
  const before = snapshotTree(novel);
  assert.throws(
    () => archiveExisting(novel, { archiveId: 'fault', failAfterMoves: 1 }),
    error => error.code === 'ARCHIVE_MOVE_FAILED'
  );
  assert.deepEqual(snapshotTree(novel), before);
});
```

Expected RED result: `MODULE_NOT_FOUND` for `../scripts/lib/archive` (or, after the test file is scaffolded, `TypeError: buildArchivePlan is not a function`). `snapshotTree` is a test-only helper that returns sorted relative paths plus SHA-256 contents; it must not be used by production code.

- [x] **Step 2: Implement manifest-first reversible archival**

Write `archive-manifest.json` before moving entries. Include source path, destination path, kind, size, and stable hash for every file. Move on the same filesystem, update receipt status atomically, and rescan the novel root after completion. Success requires no root entries outside the allowlist. Never delete an entry; recovery restores only into empty or manifest-identical targets.

The minimum implementation shape is:

```javascript
function archiveExisting(novelDir, options = {}) {
  const plan = buildArchivePlan(novelDir, options);
  atomicWriteJson(path.join(plan.archive_dir, 'archive-manifest.json'), plan);
  const moved = [];
  try {
    for (const entry of plan.entries) {
      moveEntry(entry.source_path, entry.archive_path, options);
      moved.push(entry);
    }
    assertCleanNovelRoot(novelDir);
    return { archive_dir: plan.archive_dir, status: 'archived', entries: moved.length };
  } catch (cause) {
    rollbackMoves(moved);
    throw new GameKbError('ARCHIVE_MOVE_FAILED', 'Archive failed and was rolled back', { cause: cause.message });
  }
}
```

`buildArchivePlan` must reject `SOURCE_AMBIGUOUS`, `ARCHIVE_PATH_COLLISION`, `ARCHIVE_SYMLINK_ESCAPE`, and `ARCHIVE_NESTED_TARGET` before writing or moving anything. Hashes are SHA-256 over file bytes; directory entries are represented in the plan but only files carry `size` and `sha256`.

- [x] **Step 3: Write failing run-isolation and source-boundary tests**

Assert each run writes under `.game-kb-work/runs/<run-id>/`, records source and chapter hashes, and never reads root `build/`, `data/`, `reports/`, `review/`, `prompts/`, or an adjacent run. A matching single run resumes; a changed source requires the old run to be archived; two eligible runs require explicit `--run`.

Use this concrete test shape:

```javascript
const { createOrResumeRun, resolveRun } = require('../scripts/lib/run');
const { pathsFor } = require('../scripts/lib/paths');

test('run metadata and all paths are scoped by run id', () => {
  const novel = makeNovel('试书', '第一章\\n正文\\n');
  const first = createOrResumeRun(novel, { runId: 'run-a' });
  const second = createOrResumeRun(novel, { runId: 'run-b' });
  assert.match(first.run_dir, /\\.game-kb-work\\/runs\\/run-a$/);
  assert.match(second.run_dir, /\\.game-kb-work\\/runs\\/run-b$/);
  assert.notEqual(first.source_hash, '');
  assert.equal(readJson(path.join(first.run_dir, 'run.json')).run_id, 'run-a');
  assert.equal(pathsFor(novel, 'run-a').manifest.startsWith(first.run_dir), true);
  assert.equal(pathsFor(novel, 'run-b').manifest.startsWith(second.run_dir), true);
});

test('implicit resolution rejects multiple eligible runs', () => {
  const novel = makeNovel('试书', '第一章\\n正文\\n');
  createOrResumeRun(novel, { runId: 'run-a' });
  createOrResumeRun(novel, { runId: 'run-b' });
  assert.throws(() => resolveRun(novel), error => error.code === 'RUN_AMBIGUOUS');
  assert.equal(resolveRun(novel, 'run-a').run_id, 'run-a');
});
```

Expected RED result: `TypeError: createOrResumeRun is not a function`; the second assertion must remain RED until `resolveRun` refuses implicit selection.

- [x] **Step 4: Implement run metadata and CLI commands**

Add `archive-existing`, `--run`, clean-root enforcement, `run.json`, and run-scoped paths. `run.json` starts with `started_at` and accumulates phase durations without acting as a multi-stage event state machine. Preserve the current file-derived progress model within each run.

`pathsFor(novelDir, runId)` must return `run`, `manifest`, `progress`, `manualReview`, `sourceChapters`, `drafts`, `chapters`, `merged`, `cleaned`, `finalData`, and reports below `runs/<runId>/`; calling it without a run id is allowed only for root discovery and must throw `RUN_REQUIRED` for artifact paths. `prepare` calls `archiveExisting` before `createOrResumeRun`, then copies only the freshly split source into that run. `flow.js` forwards `--run` to every command and exposes `archive-existing`; no command may read the old root manifest or a sibling run.

- [x] **Step 5: Run focused tests**

```bash
node --test \
  .agents/skills/generate-game-kb/tests/archive.test.js \
  .agents/skills/generate-game-kb/tests/run-isolation.test.js \
  .agents/skills/generate-game-kb/tests/source.test.js \
  .agents/skills/generate-game-kb/tests/cli.test.js
```

Expected: archive rollback and clean-root assertions pass; no test reads or writes a shared work artifact.

### Task 12: Candidate coverage ledger and immutable accepted artifacts

**Files:**
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/merge-book.md`
- Modify: `.agents/skills/generate-game-kb/prompts/clean-book.md`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/coverage.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Create: `.agents/skills/generate-game-kb/tests/coverage.test.js`
- Create: `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`

**Interfaces:**
- `buildChapterCoverage(chapters) -> category counts, chapter distribution, important/quotable event counts`
- `buildCandidateLedger(chapters, merged, cleaned?) -> resolution rows`
- Candidate resolution is exactly one of `merged_to`, `rejected`, or `ambiguous`.
- `assertAcceptedArtifacts(paths, expectedHashes) -> void`, throwing `ACCEPTED_ARTIFACT_MUTATED` on mismatch.

- [x] **Step 1: Write failing coverage and mutation regression tests**

Include the Laughing in the Wind failure shape: seven distinct important-item candidates followed by zero merged items and no rejection reasons. It must fail with an explicit missing-resolution list. Modify an accepted chapter or cleaned file after acceptance and assert every downstream command fails before producing output.

The regression must assert the exact ledger contract:

```javascript
const { buildCandidateLedger, assertAcceptedArtifacts } = require('../scripts/lib/candidate-ledger');

test('candidate loss without a reason is a blocking resolution error', () => {
  const chapters = [{ chapter: 1, items: Array.from({ length: 7 }, (_, i) => ({
    candidate_key: `item:${i + 1}`, name: `重要物品${i + 1}`, importance: '重要', source_refs: [sourceRef(1)]
  })) }];
  const ledger = buildCandidateLedger(chapters, { items: [] }, { items: [] });
  assert.equal(ledger.passed, false);
  assert.deepEqual(ledger.missing_resolution.map(row => row.candidate_key), [
    'item:1', 'item:2', 'item:3', 'item:4', 'item:5', 'item:6', 'item:7'
  ]);
});

test('accepted artifact mutation blocks downstream input', () => {
  const expected = { 'accepted/chapters/ch_001.json': 'sha256:original' };
  assert.throws(
    () => assertAcceptedArtifacts({ 'accepted/chapters/ch_001.json': 'sha256:changed' }, expected),
    error => error.code === 'ACCEPTED_ARTIFACT_MUTATED'
  );
});
```

Expected RED result: `MODULE_NOT_FOUND` for `candidate-ledger` followed by the explicit `ACCEPTED_ARTIFACT_MUTATED` assertion once the test module is scaffolded.

- [x] **Step 2: Extend chapter and event/dialogue contracts**

Add stable candidate keys and chapter `coverage`. Core/important events carry `importance` and `quote_status`. Chapter extraction may emit multiple short dialogue candidates for the same event; the one-dialogue limit applies only to final selection. A quotable event without candidates is a coverage gap, while a non-quotable event requires a reason.

Add these contract assertions before implementation:

```javascript
assert.equal(validateChapterDraft({ ...validChapterDraft(), coverage: { item_candidates: 1 } }).valid, true);
assert.equal(validateChapterDraft({
  ...validChapterDraft(),
  events: [{ ...validChapterDraft().events[0], quote_status: 'quotable' }],
  dialogues: [
    { ...validChapterDraft().dialogues[0], local_key: 'dialogue:a' },
    { ...validChapterDraft().dialogues[0], local_key: 'dialogue:b' }
  ]
}).valid, true);
assert.equal(validateChapterDraft({
  ...validChapterDraft(),
  events: [{ ...validChapterDraft().events[0], quote_status: 'quotable' }],
  dialogues: []
}).errors.some(error => error.code === 'QUOTABLE_EVENT_DIALOGUE_MISSING'), true);
```

The finite resolution enum is `merged_to | rejected | ambiguous`; `rejected` requires one of `ordinary_item`, `duplicate`, `misclassified`, `no_evidence`, or `not_game_relevant` plus a non-empty `detail`.

- [x] **Step 3: Require complete merge and cleanup resolutions**

Merge drafts resolve every candidate to a kept entity, structured rejection, or ambiguity. Cleanup drafts resolve every removed high-value entity. Rejection reasons use a finite enum plus source-grounded detail; free-text presence alone cannot close a candidate.

`buildCandidateLedger` should reduce every chapter candidate into one row:

```javascript
return candidates.map(candidate => {
  const decision = decisionsByKey.get(candidate.candidate_key);
  if (!decision) return { ...candidate, resolution: 'ambiguous', reason: 'MISSING_DECISION' };
  if (decision.merged_to) return { ...candidate, resolution: 'merged_to', merged_to: decision.merged_to };
  if (decision.rejected && VALID_REJECTION_REASONS.has(decision.reason) && decision.detail?.trim()) {
    return { ...candidate, resolution: 'rejected', reason: decision.reason, detail: decision.detail };
  }
  return { ...candidate, resolution: 'ambiguous', reason: 'INVALID_DECISION' };
});
```

- [x] **Step 4: Persist the hash chain**

On acceptance, append `{relative_path, input_hash, content_hash, accepted_at}` to the run artifact manifest. All downstream input hashes include accepted content hashes. Never refresh an expected hash from a mutated file.

The acceptance write must be atomic and immutable:

```javascript
function recordAcceptedArtifact(paths, relativePath, inputHash, content) {
  const contentHash = stableHash(content);
  const existing = readArtifactManifest(paths);
  if (existing.entries.some(entry => entry.relative_path === relativePath)) {
    throw new GameKbError('ACCEPTED_ARTIFACT_EXISTS', `Accepted artifact already exists: ${relativePath}`);
  }
  atomicWriteFile(path.join(paths.run, relativePath), content);
  atomicWriteJson(paths.artifactManifest, {
    ...existing,
    entries: [...existing.entries, { relative_path: relativePath, input_hash: inputHash, content_hash: contentHash, accepted_at: new Date().toISOString() }]
  });
}
```

- [x] **Step 5: Run focused tests**

```bash
node --test \
  .agents/skills/generate-game-kb/tests/coverage.test.js \
  .agents/skills/generate-game-kb/tests/artifact-immutability.test.js \
  .agents/skills/generate-game-kb/tests/contracts.test.js \
  .agents/skills/generate-game-kb/tests/merge-clean.test.js
```

### Task 13: Deterministic gap detection and bounded category recall

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Create: `.agents/skills/generate-game-kb/prompts/recall-category.md`
- Create: `.agents/skills/generate-game-kb/prompts/supplement-category.md`
- Create: `.agents/skills/generate-game-kb/scripts/lib/gaps.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/supplements.js`
- Create: `.agents/skills/generate-game-kb/tests/targeted-recall.test.js`

**Interfaces:**
- `checkCoverage(paths) -> { blocking_gaps, recall_units }`
- `checkResolution(paths) -> { blocking_gaps, supplement_units }`
- `applyRecall(paths, category, acceptedDraft) -> materialized/candidates.json`
- `applySupplement(paths, category, acceptedDraft) -> materialized/merged-with-supplements.json`

- [x] **Step 1: Write failing trigger and non-trigger tests**

Cover candidate-to-zero loss; zero item candidates when source Han characters are at least 150,000 or core/important events are at least 20; less than 70% coverage of quotable core/important events; dialogue candidates covering less than 30% of event-bearing chapters when quotable core/important events span at least eight chapters; incomplete resolutions; and broken references. Also prove that advisory quantity ranges alone do not create a recall unit and that a grounded `none_found` item review can close a legitimate empty category.

Use a table-driven test with exact expected units:

```javascript
test('coverage opens only the affected bounded unit', () => {
  const cases = [
    [{ item_candidates: 7, merged_items: 0, item_resolutions_incomplete: true }, ['supplement:items']],
    [{ item_candidates: 0, merged_items: 0, source_char_count: 150000 }, ['recall:items']],
    [{ quotable_event_count: 10, dialogue_covered: 6 }, ['recall:dialogues']],
    [{ quotable_event_chapters: [1, 2, 3, 4, 5, 6, 7, 8], dialogue_chapters: [1, 2] }, ['recall:dialogues']],
    [{ quantity_out_of_range: true }, []]
  ];
  for (const [input, expected] of cases) assert.deepEqual(checkCoverage(input).recall_units, expected);
});

test('grounded none_found closes a legitimate empty item category', () => {
  const result = checkCoverage({ source_char_count: 120000, item_candidates: 0, none_found: {
    chapters: [1, 2, 3], conclusion: 'none_found', reason: '仅有普通日用品，无特殊作用。'
  }});
  assert.deepEqual(result.recall_units, []);
  assert.equal(result.empty_category_review.status, 'none_found');
});
```

Expected RED result: `MODULE_NOT_FOUND` for `../scripts/lib/gaps`; after scaffolding, the unit arrays must fail until all four trigger rules are implemented.

- [x] **Step 2: Implement `check-coverage` and `check-resolution`**

Both commands are deterministic and model-free. Reports name the category, rule, candidate keys, affected chapters, expected evidence, and allowed unit. The commands never return an executable `next_action` and never open a whole-book retry.

The core trigger implementation must be pure and side-effect free:

```javascript
function checkCoverage(input) {
  const recallUnits = [];
  if (input.item_candidates > 0 && input.merged_items === 0 && input.item_resolutions_incomplete) recallUnits.push('supplement:items');
  if (input.item_candidates === 0 && (input.source_char_count >= 150000 || input.important_event_count >= 20) && !input.none_found) recallUnits.push('recall:items');
  if (input.quotable_event_count > 0 && input.dialogue_covered / input.quotable_event_count < 0.7) recallUnits.push('recall:dialogues');
  if ((input.quotable_event_chapters?.length ?? 0) >= 8 && (input.dialogue_chapters?.length ?? 0) / input.quotable_event_chapters.length < 0.3) recallUnits.push('recall:dialogues');
  return { blocking_gaps: input.blocking_gaps ?? [], recall_units: [...new Set(recallUnits)] };
}
```

`checkResolution` returns `supplement_units` only for unresolved ledger rows or zero/multi-match references. The CLI serializes the report without `next_action`, `command`, or an automatic retry field.

- [x] **Step 3: Implement bounded `recall:*` and `supplement:*` acceptance**

Each category receives one semantic generation. One additional submission is permitted only when the first draft is semantically unchanged and fixes schema/format errors; otherwise it consumes the normal no-progress circuit breaker. `recall:*` can read only affected source chapters and related accepted events. `supplement:*` can read only the candidate ledger and accepted merge.

Persist the semantic-generation count separately from ordinary format retries:

```javascript
function assertRecallAttempt(state, unit, draft) {
  const next = { ...(state.units[unit] ?? { semantic_attempts: 0, attempts: 0 }) };
  const semanticHash = semanticContentHash(draft);
  if (next.semantic_attempts === 0) next.semantic_attempts = 1;
  else if (semanticHash === next.semantic_hash && draftSchemaIsValid(draft)) next.attempts += 1;
  else throw new GameKbError('NO_PROGRESS', `Recall unit ${unit} exceeded its semantic budget`);
  next.semantic_hash = semanticHash;
  return next;
}
```

Tests must restart by reloading `progress.json` before the second submission and still observe `semantic_attempts === 1`.

- [x] **Step 4: Apply supplements deterministically**

Project accepted recall candidates or supplements into new files under `materialized/` without mutating any accepted chapter, merge, recall, or supplement. Recompute the ledger from accepted inputs plus the projection, then permit exactly one clean-book acceptance. A remaining gap becomes `manual_review` and blocks `build-final`.

`applyRecall` and `applySupplement` must write a new projection and return its path:

```javascript
function applySupplement(paths, category, acceptedDraft) {
  const merged = readJson(paths.acceptedMerged);
  const projection = mergeCategory(merged, category, acceptedDraft[category] ?? []);
  atomicWriteJson(paths.materializedMerged, { ...merged, [category]: projection, supplement: category });
  return paths.materializedMerged;
}
```

Tests hash `accepted/merged/book.json` and `accepted/supplements/items.json` before and after application and assert both hashes are unchanged.

- [x] **Step 5: Run focused tests**

```bash
node --test \
  .agents/skills/generate-game-kb/tests/targeted-recall.test.js \
  .agents/skills/generate-game-kb/tests/progress.test.js \
  .agents/skills/generate-game-kb/tests/cli.test.js
```

### Task 14: Non-reallocating quality sample, clean installation, and run archive

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/quality.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/prompts/sample-quality.md`
- Modify: `.agents/skills/generate-game-kb/tests/quality.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/install.test.js`
- Create: `.agents/skills/generate-game-kb/tests/run-archive.test.js`

**Interfaces:**
- `buildQualitySample(finalData, reviews, options?) -> { quotas, categories, items, total_checks }`
- `verifyFinal(paths) -> { passed, blocking_errors, final_data_hash }`
- `installVerifiedData(novelDir, runId) -> install receipt`
- `archiveRun(novelDir, runId) -> archive receipt`

- [x] **Step 1: Write failing fixed-category sample tests**

Use quotas: skills/techniques 12, events 8, characters 5, items 5, dialogues 4, factions/locations 4, chapter summaries 2. Never reassign a missing category's quota. When a category is legitimately empty, sample its persisted empty-category review; an unexplained empty category remains blocking.

The test must assert the quota map and non-reallocation explicitly:

```javascript
const EXPECTED_QUOTAS = { skills_techniques: 12, events: 8, characters: 5, items: 5, dialogues: 4, factions_locations: 4, chapter_summaries: 2 };

test('quality sample keeps category quotas fixed', () => {
  const sample = buildQualitySample(makeFinalData({ items: [], dialogues: [], skills: many(30), techniques: many(30) }), { seed: 'fixed' });
  assert.deepEqual(sample.quotas, EXPECTED_QUOTAS);
  assert.equal(sample.categories.items.kind, 'empty-review-required');
  assert.equal(sample.categories.dialogues.kind, 'empty-review-required');
  assert.equal(sample.total_checks, 40);
});
```

Expected RED result: `buildQualitySample is not a function` or a quota mismatch; a missing item quota must never be filled by a skill record.

- [x] **Step 2: Bind final verification to ledgers and accepted hashes**

`verify` must check candidate resolution completeness, dialogue coverage, category review receipts, immutable accepted hashes, final-data hash, quality sample, and empty manual review. `build-final` and `install` refuse unresolved gap units.

Add one blocking assertion per boundary:

```javascript
assert.equal(verifyFinal({ ...fixture, candidateResolution: { passed: false } }).blocking_errors[0].code, 'CANDIDATE_RESOLUTION_INCOMPLETE');
assert.equal(verifyFinal({ ...fixture, acceptedHashes: { stale: true } }).blocking_errors[0].code, 'ACCEPTED_ARTIFACT_MUTATED');
assert.equal(verifyFinal({ ...fixture, manualReview: [{ unit: 'recall:items' }] }).blocking_errors[0].code, 'MANUAL_REVIEW_BLOCKS_FINAL');
```

- [x] **Step 3: Install only from a clean baseline**

Install nine data arrays and named consumer reports through temporary sibling directories. Unexpected root `data/`, `reports/`, or an unbound activity directory produces `DIRTY_INSTALL_BASELINE`; it must not merge unknown old files. Record `installed_at`, final hash, and report hashes in `run.json` and the install receipt.

The failure test must leave the existing directory byte-identical:

```javascript
test('install refuses a dirty baseline without merging files', () => {
  const novel = preparedVerifiedNovel();
  fs.mkdirSync(path.join(novel, 'data'), { recursive: true });
  fs.writeFileSync(path.join(novel, 'data', 'unknown.json'), '{"keep":true}\\n');
  const before = snapshotTree(path.join(novel, 'data'));
  assert.throws(() => installVerifiedData(novel), error => error.code === 'DIRTY_INSTALL_BASELINE');
  assert.deepEqual(snapshotTree(path.join(novel, 'data')), before);
});
```

- [x] **Step 4: Implement complete `archive-run`**

After `verify --installed`, validate every artifact-manifest entry, add `archived_at` and duration totals, then move the whole run to `_archive/generate-game-kb/<run-id>/`. Revalidate the archive and assert no active `.game-kb-work` remains. Current `data/` and consumer `reports/` remain installed until the next `archive-existing`.

The archive operation is closed by these invariants:

```javascript
const receipt = archiveRun(novel, 'run-a');
assert.equal(receipt.status, 'archived');
assert.equal(fs.existsSync(path.join(novel, '.game-kb-work', 'runs', 'run-a')), false);
assert.equal(fs.existsSync(path.join(novel, '_archive', 'generate-game-kb', 'run-a', 'artifact-manifest.json')), true);
assert.equal(fs.existsSync(path.join(novel, 'data', 'characters.json')), true);
assert.equal(readJson(path.join(novel, '_archive', 'generate-game-kb', 'run-a', 'run.json')).archived_at !== undefined, true);
```

- [x] **Step 5: Run focused tests**

```bash
node --test \
  .agents/skills/generate-game-kb/tests/quality.test.js \
  .agents/skills/generate-game-kb/tests/install.test.js \
  .agents/skills/generate-game-kb/tests/run-archive.test.js \
  .agents/skills/generate-game-kb/tests/finalize.test.js
```

### Task 15: Workflow documentation, integration regressions, and project contract

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Consumes the CLI and report contracts completed by Tasks 11–14.
- Produces the operator workflow in `SKILL.md`, three end-to-end regressions, and the executable fast-profile contract in `quality-guidelines.md`.

- [x] **Step 1: Update the Skill workflow and stop conditions**

Document `archive-existing`, run-id selection, the three normal AI stages, conditional coverage/resolution checks, bounded category recall, installed verification, and complete run archival. Remove any instruction that can be interpreted as limiting chapter extraction to one dialogue candidate per event.

The documentation test reads `SKILL.md` and asserts the literal phrases `archive-existing`, `--run`, `check-coverage`, `recall:items`, `recall:dialogues`, `verify --installed`, and `archive-run`; it also asserts that no sentence matching `/每个事件最多一条.*逐章|最多一条对白.*提取/` remains.

- [x] **Step 2: Add end-to-end regression fixtures**

The integration suite must include: seven item candidates disappearing at merge, dialogue candidates confined to early chapters while important events span the book, and a quality sampler that previously filled item/dialogue quota with another category. Each fixture asserts the exact recall/blocking unit and that no full-book rerun is created.

Each fixture must be a three-chapter or smaller `node:test` case and assert the persisted unit name:

```javascript
assert.deepEqual(readJson(paths.coverage).recall_units, ['supplement:items']);
assert.deepEqual(readJson(paths.coverage).dialogue.recall_units, ['recall:dialogues']);
assert.equal(readJson(paths.progress).units['merge:book'].attempts, 1);
assert.equal(Object.keys(readJson(paths.progress).units).some(unit => unit === 'book:full-retry'), false);
```

- [x] **Step 3: Update the fast-profile code-spec**

Record run directories, clean-root archive command, accepted-artifact hash contract, coverage ledger, recall/supplement units, quality quotas, validation/error matrix, Good/Base/Bad cases, and required tests. Keep audit-grade `generate-kb` rules unchanged.

The spec update must add the fast-profile section without changing the audit-grade section. `git diff -- .agents/skills/generate-kb` must be empty, while `rg -n "Fast Game-Material|archive-existing|ACCEPTED_ARTIFACT_MUTATED" .trellis/spec/backend/quality-guidelines.md` must return matches.

- [x] **Step 4: Run all deterministic checks**

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

```bash
find .agents/skills/generate-game-kb/scripts -name '*.js' -print0 | xargs -0 -n1 node --check
```

```bash
rtk git diff --exit-code -- .agents/skills/generate-kb
```

Expected output: the Node test command reports zero failures, every `node --check` exits 0, and the final diff command exits 0 with no output.

### Transferred forward acceptance: two-book v2 evidence

The former Task 16 live acceptance steps were not completed under the whole-book merge/clean contract. They are intentionally transferred to Task 8 of `07-15-game-kb-deterministic-assembly`, where only fresh `semantic_contract_version: 2` runs may produce positive evidence. The existing Fly Fox failure timeline and completed Laughing in the Wind run remain immutable observational evidence for this first iteration.

### Task 17: Autonomous Skill invocation and direct source grounding (chapter executor superseded by Task 18)

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Create: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Delete: `.trellis/tasks/07-14-fast-kb-pipeline/scripts/semantic-extract.js`
- Delete: `.trellis/tasks/07-14-fast-kb-pipeline/scripts/semantic-extract.test.js`

**Interfaces:**
- Consumes: a Skill invocation plus one novel directory and the persisted run filesystem.
- Produces: the autonomous zero/one/multiple-run routing contract and the original direct-source grounding rule. Task 18 keeps routing in the main model but moves chapter reads into isolated native workers.

- [x] **Step 1: Write and run the failing Skill contract test**

Assert that `SKILL.md` assigns routing to the current main model, distinguishes zero/one/multiple active runs, and requires end-to-end continuation through `archive-run`. The original test assigned direct chapter reading to the main model; Task 18 replaces that assertion with isolated host-native chapter workers while retaining exclusion of CTX/context-mode, search summaries, heuristic extraction, and external model CLIs.

Run: `node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js`. Expected: FAIL because the current Skill documents commands but does not yet own autonomous invocation or prohibit delegated semantic reading.

- [x] **Step 2: Implement the minimal autonomous routing contract**

Add a concise startup decision table and a normal-stage loop to `SKILL.md`. Keep command details as implementation instructions for the model, not instructions that the user must supply. Add direct-source grounding to the extraction prompt and preserve existing accepted-artifact, bounded-attempt, and manual-review rules; Task 18 owns the current executor boundary.

- [x] **Step 3: Remove the external-model acceptance probe**

Delete the temporary `semantic-extract.js` and its local regression test. The production Skill must not depend on `claude -p`, `codex exec`, or any model subprocess; Task 18 separately permits only host-native chapter workers under main-model orchestration.

- [x] **Step 4: Run focused and full verification**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

Expected: all tests pass, `.agents/skills/generate-kb/` has zero diff, and the Skill contains no book/author/entity special case.

### Task 18: Isolated chapter workers and run-scoped staging

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.trellis/tasks/07-14-fast-kb-pipeline/prd.md`
- Modify: `.trellis/tasks/07-14-fast-kb-pipeline/design.md`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Consumes: pending `chapter:NNN` units, run-scoped source files, manifest hashes, persisted attempt counts, and host-native subagent slots.
- Produces: one isolated direct-source read per chapter, a unique `<run-dir>/staging/<unit>_attempt_<NN>.json`, and main-model-only serial `accept` calls.

- [x] **Step 1: Write and run the failing Skill contract regression**

Replace the obsolete main-context reading assertion with requirements for one native worker per chapter, direct complete source reading inside that worker, path-only return, and serial acceptance by the main model. Add a regression requiring the main model to derive staging paths from `run-id + unit + attempt` and forbidding arbitrary `/tmp` names.

Run: `node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js`. Expected RED result: the old Skill fails on missing `原生子代理` and missing run-scoped staging language.

- [x] **Step 2: Implement the isolated worker contract**

Keep the current main model as the only workflow/state owner. It may dispatch independent chapters concurrently up to the host's native slot limit, but each worker reads exactly one complete source chapter, writes only the assigned staging path, never calls `accept`, and returns no source or JSON body. The main model serially accepts completed drafts and discards worker context after durable acceptance.

Expose `paths.staging` below the selected run and make both new-run creation and resume recreate that directory. Use flat `<unit>_attempt_<NN>.json` names so workers never need to invent or create nested directories.

On context compaction or resume, reload the Skill/schema/prompt and one persisted status snapshot. Skip unchanged `done` chapters; restart an unsubmitted chapter in a fresh worker from the full source. Do not use a model subprocess, CTX summary, or arbitrary temporary path as a fallback.

- [x] **Step 3: Run focused and full deterministic verification**

Run:

```bash
node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js
node --test .agents/skills/generate-game-kb/tests/*.test.js
find .agents/skills/generate-game-kb/scripts -name '*.js' -print0 | xargs -0 -n1 node --check
git diff --check
git diff --exit-code -- .agents/skills/generate-kb
```

Expected: all checks pass, the fast Skill contains no book-specific branch, and the audit-grade Skill has zero diff.

Result: `115/115` Node tests passed; all 23 Skill scripts passed `node --check`; `git diff --check` passed; `.agents/skills/generate-kb/` has zero diff. The additional regressions require nonzero successful-CLI timing, derive chapter/recall/merge/clean durations from persisted unit timestamps during `archive-run`, and keep installed verification available after the active run is archived. `quick_validate.py` could not start because the local Python environment lacks `PyYAML` (`ModuleNotFoundError: yaml`), so no global Python dependency was changed.

- [x] **Step 4: Transfer fresh-run context-isolation evidence to the v2 task**

The automated isolation contract remains part of this task's verification. Live proof that chapter workers directly read one chapter without accumulating whole-book context is now an acceptance output of Task 8 in `07-15-game-kb-deterministic-assembly`.

### Task 19: Persistent chapter-worker concurrency and 429 backoff

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- Create: `.agents/skills/generate-game-kb/tests/worker-pool.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Consumes: the selected run, pending chapter units, host-native worker slots, a dispatch-batch ID, and an explicit 429 result.
- Produces: run-scoped `worker-pool.json`, `status --json.worker_pool`, and internal `worker-backoff --batch <id> --reason 429` handling.

- [x] **Step 1: Write and run the failing adaptive-concurrency regressions**

Assert a default limit of 10, one backoff per dispatch batch, `10 → 5 → 2 → 1`, persistence across prepare/status recovery, reset only for a new run, no `progress.json` attempt consumption, and a halt when concurrency one receives a fresh 429. Expected RED results are a missing `worker-pool.json`, `COMMAND_UNKNOWN` for `worker-backoff`, and missing Skill orchestration language.

- [x] **Step 2: Implement run-scoped worker-pool state**

Create `worker-pool.json` for every new run and backfill it during explicit resume without replacing existing state. Keep the initial limit and current limit separate, persist one incident per batch, expose the state through observational status, and reject non-429 reasons.

- [x] **Step 3: Implement the Skill-level dispatch contract**

Each batch dispatches at most `min(current limit, host slots, pending chapters)`. One or more 429 results in the same batch call the internal backoff command once. A 429 never calls `accept`, never consumes semantic/submission attempts, and retries in a fresh worker that rereads the complete chapter. Do not auto-increase within a run; stop on a fresh 429 at concurrency one.

- [x] **Step 4: Run focused and full deterministic verification**

Run the worker-pool and Skill contract tests, the complete `generate-game-kb` Node suite, syntax checks for every Skill JavaScript file, `git diff --check`, and the zero-diff guard for `.agents/skills/generate-kb/`.

Result: the focused RED assertions failed on the missing file/command/contract, then `125/125` Node tests passed; all 24 Skill JavaScript files passed `node --check`; `git diff --check` passed; and `.agents/skills/generate-kb/` retained zero diff. `quick_validate.py` remains unavailable because the local Python environment has no PyYAML, so no global dependency was installed.

- [x] **Step 5: Transfer fresh-run adaptive-dispatch observation to the v2 task**

The deterministic worker-pool and 429 regression tests remain part of this task's quality gate. Fresh-run telemetry is collected with the v2 two-book evidence; the test must not manufacture an external 429 merely to populate telemetry.

### Task 20: Attempt-bound staging consumption and safe resume

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/tests/helpers.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.trellis/tasks/07-14-fast-kb-pipeline/{prd.md,design.md,implement.md}`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Consumes: selected run paths, unit input hash, persisted attempts, and one run-scoped staging draft.
- Produces: exact `<unit>_attempt_<attempts+1>.json` enforcement, immutable draft archival, and one-time staging consumption without stale-replay budget loss.

- [x] **Step 1: Capture the real failure and write RED regressions**

The active Fly Fox run proved that `chapter_002_attempt_01.json` was submitted twice, entered `REPEATED_OUTPUT,REPEATED_ERROR`, and was then automatically reset despite the manual-review contract. Add CLI and Skill regressions requiring one-time staging consumption and next-attempt-only resume. Expected RED results are a retained rejected staging file and missing resume language.

- [x] **Step 2: Bind `accept` to the next run-scoped attempt**

Derive the only legal path from the selected run, unit, and persisted `attempts + 1`. Reject path or realpath mismatches before progress changes. After archival and progress persistence, consume the staging file for both successful and rejected submissions; a reconstructed stale path cannot spend another attempt.

- [x] **Step 3: Update autonomous resume and manual-review contracts**

Make the Skill resume only the exact next attempt, launch a fresh full-source worker when that file is absent, and treat lower-numbered files as consumed residues. Keep `manual_review` terminal unless the user explicitly authorizes a specific reset.

- [x] **Step 4: Run focused and full deterministic verification**

Run the staging regressions, complete Node suite, syntax checks, `git diff --check`, audit-profile zero-diff guard, and Skill validation when its local dependencies are available.

Result: the focused stale-replay and staging-escape regressions passed, then the complete suite passed `128/128`; all 24 Skill JavaScript files passed `node --check`; `git diff --check` passed; `.agents/skills/generate-kb/` had no tracked or untracked diff; and a source scan found no test that submits a direct `/tmp` draft. `writeStagingDraft` derives every accepted test draft from the selected run's `paths.staging`. `quick_validate.py` still cannot start because the local Python environment lacks PyYAML, so no global dependency was installed.

- [x] **Step 5: Record forward-run evidence without mutating it from Codex**

Inspect the independently running Fly Fox run after Claude Code reaches a stable stage. Record staging consumption, attempt histories, worker-pool state, timing, final verification, and any policy violation such as an unauthorized reset.

Result: the read-only receipt is `evidence/feihu-resume-audit.json`. The observed run has all 20 chapter units done and an empty staging directory, but it is still active at `merge:book` attempt 2 with 4,085 validation errors; it has no `worker-pool.json`, final data, install receipt, installed `data/`, or run archive. Its archived progress history proves `chapter:001` and `chapter:002` reached terminal `manual_review` and were later returned to `done` without a reset-authorization receipt. This records the pre-fix policy violation but does not satisfy the open Task 16, Task 18, or Task 19 forward-acceptance steps.

## Final Review Checklist

- [x] Every requirement in `prd.md` maps to an implementation task and test.
- [x] Existing `.agents/skills/generate-kb/` has no diff.
- [x] New Skill contains no claim/lease/stage-lock/event-log/next-action mechanism.
- [x] Every AI unit is bounded to three submissions and no-progress tests pass.
- [x] Quantity review can execute only once and never blocks solely on count.
- [x] Nine files, game-material index, chapter-level evidence, five character levels, important-item policy, event-linked dialogue, and ordinary-action exclusion are covered.
- [x] Clean-root archival leaves only source text, `ch_split/`, and `_archive/`, and fault injection proves rollback without data loss.
- [x] Run-id isolation prevents every cross-run and root-artifact read.
- [x] Every candidate has a resolution; candidate-to-zero item loss and sparse-dialogue regressions open only bounded category units.
- [x] Accepted artifacts are hash-immutable and mutation blocks downstream work.
- [x] Quality quotas cannot be reassigned away from items or dialogues; legitimate empty categories have review receipts.
- [x] Deterministic IDs and references are byte-stable across repeated builds.
- [x] Clean installation, installed verification, complete run archival, and archive restoration tests pass.
- [x] Project spec distinguishes fast profile from audit-grade managed profile.
- [x] Invoking `generate-game-kb` with a novel directory is sufficient for the current main model to route and execute the complete flow without user-supplied command sequencing.
- [x] Chapter semantics come from isolated host-native workers that each directly read one complete original chapter; CTX, summaries, heuristics, and model subprocesses cannot substitute for that reading.
- [x] The main model assigns run/unit/attempt staging paths, receives path-only worker results, and serializes every `accept`; arbitrary `/tmp` drafts and worker writes to shared state are absent.
- [x] Chapter-worker concurrency starts at 10, is bounded by host slots and pending chapters, persists `10 → 5 → 2 → 1` one 429 batch at a time, never consumes semantic attempts for 429, and halts rather than loops when concurrency one is still rate-limited.

## Closure Verification — 2026-07-15

- Fresh automated check: all 17 `generate-game-kb/tests/*.test.js` files exited 0.
- Fresh syntax check: all 24 JavaScript files under `generate-game-kb/scripts/` passed `node --check`.
- Audit-grade `.agents/skills/generate-kb/` has zero diff; tracked `git diff --check` passed.
- Installed verification passed for both v1 books: Fly Fox hash `sha256:7812ffb675316d4c35efccf5e460444faac672568f234f195f47f1f140beaac9`; Laughing in the Wind hash `sha256:db402f90360db8b2e37b832e0ba2aaf6b208d690d0f4941f26a973c457357173`.
- The two 40/40 quality results, category counts, run IDs, install/archive timestamps, and elapsed times are frozen in `evidence/v1-two-book-baseline.json`.
- PyYAML is absent, so optional `quick_validate.py` was not forced by installing a global dependency.
- Whole-book merge/clean limitations and fresh v2 acceptance are transferred to `07-15-game-kb-deterministic-assembly`; this closure makes no v2 success claim.
