# `generate-game-kb` v7 简化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Codex inline mode must not dispatch implement/check sub-agents.

**Goal:** 将 `generate-game-kb` 收敛为固定五章窗口、Worker 直写唯一 YAML、controller 自动接收与确定性书级归并的 v7 流程，同时为 Dashboard 提供 legacy `type`/v7 `types` 双读和只读 warning 审查面。

**Architecture:** 先以纯模块构建 v7 类型合同、章节状态机、工作签发、输出接收、确定性归并、稳定 ID 和报告生成，再在单独提交中切换 `flow.js` 的公开命令面并删除 v6 envelope/domain 运输层。Dashboard 只消费安装后的五个 YAML、安装回执和 warning-only review report；完整字段决策审计留在工作区 `assembly-report.json`。

**Tech Stack:** Node.js CommonJS、`node:test`、`js-yaml`、`pinyin-pro`、TypeScript、React、Vite、Vitest、Playwright。

## Global Constraints

- 实施前读取本任务的 `prd.md`、`design.md`，并运行 `trellis-before-dev`；只有用户明确授权实施后才运行 `task.py start`。
- Codex 当前为 inline 模式，不派发 implement/check sub-agent；`implement.jsonl` 与 `check.jsonl` 保持 seed 状态。
- 所有 shell 命令使用 `rtk` 前缀；大输出、检索、统计和测试日志分析使用 context-mode。
- 每次提交前运行 `rtk git status --short`，只暂存本任务文件；不得修改、迁移或删除《陆小凤传奇》归档 v6 run、`.workbuddy/memory/`、根目录拆章文件和未跟踪书籍产物；用户已手动删除 `.kb-scratch/` 和《萧十一郎》v6 run，本任务不得重建，旧合同测试只使用临时合成 fixture。
- 新合同只服务新 v7 run；除用户显式调用 `archive-abandoned` 归档废弃现场外，旧 run 写入操作必须在修改文件前返回 `LEGACY_SEMANTIC_CONTRACT`。
- 正常公开命令最终只能是 `run`、`status`、`retry-unit`、`archive-abandoned`；成功路径只反复调用 `run`。
- `active_units.length <= 5` 是持久化状态不变量；当前窗口全部 accepted 前不得补位或签发窗口外章节。
- Worker 只读一个 immutable input，只写一个 run-scoped staging YAML；输出无 envelope、unit、cycle、attempt、hash、最终 ID 和 controller 路径。
- 每章每周期最多两个 attempt；缺失输出、启动失败、429 不消耗 attempt；attempt 2 失败进入 `manual_review`。
- 主代理只可修复 YAML 缩进、引号、代码围栏和明确空集合等机械错误，且 repair input 不含小说原文。
- 角色/武功/物品/势力只按“类别 + 精确规范名称”自动归并；别名、近似名、包含关系和拼音相似不得触发归并。
- 武功、物品、势力在 v7 章节、accepted 和终态中只写 `types: string[]`；Dashboard 继续双读旧 `type`。
- 不增加 AI description 总结、MCP、broker、通用调度层、临时清洗脚本或第二套运输协议。
- `game-kb-review.json` 只含人工 warning；`description/rank/level/types` 的全部候选和确定性选择只进入 `assembly-report.json`。
- 每个 Task 必须先红后绿，运行列出的定向测试，并形成一个可独立说明和回滚的提交。

## Activation Gate

实施 AI 在用户明确说“开始实施”后执行：

```powershell
rtk python ./.trellis/scripts/task.py start ".trellis/tasks/07-21-simplify-game-kb-worker-output"
```

Expected: task status becomes `in_progress`. 在此之前不得执行下面任何生产代码步骤。

## Final File Structure

### Create

- `.agents/skills/generate-game-kb/scripts/lib/type-taxonomy.js`：三类独立白名单和一对一别名规范化。
- `.agents/skills/generate-game-kb/scripts/lib/chapter-work.js`：immutable input、attempt 路径和 job 签发。
- `.agents/skills/generate-game-kb/scripts/lib/chapter-progress.js`：唯一 v7 状态机和固定窗口不变量。
- `.agents/skills/generate-game-kb/scripts/lib/chapter-receiver.js`：发现 staging 输出、解析、校验、归档和 accepted 事务。
- `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`：精确名称归并、泛称过滤和字段决策审计。
- `.agents/skills/generate-game-kb/scripts/lib/review-report.js`：warning-only report 构建与校验。
- `.agents/skills/generate-game-kb/tests/type-taxonomy.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-work.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- `.agents/skills/generate-game-kb/tests/book-assembly.test.js`
- `.agents/skills/generate-game-kb/tests/review-report.test.js`
- `.agents/skills/generate-game-kb/tests/v7-e2e.test.js`
- `dashboard/src/components/library/ReviewReportPanel.tsx`
- `dashboard/src/components/library/ReviewReportPanel.test.tsx`

### Replace Or Narrow

- `.agents/skills/generate-game-kb/scripts/flow.js`
- `.agents/skills/generate-game-kb/scripts/lib/run.js`
- `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- `.agents/skills/generate-game-kb/scripts/lib/ids.js`
- `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- `.agents/skills/generate-game-kb/scripts/lib/install.js`
- `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- `.agents/skills/generate-game-kb/tests/helpers.js`
- `.agents/skills/generate-game-kb/tests/accepted-serialization.test.js`
- `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`
- `.agents/skills/generate-game-kb/tests/assemble.test.js`
- `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`
- `.agents/skills/generate-game-kb/tests/book-contract.test.js`
- `.agents/skills/generate-game-kb/tests/candidate-registry.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- `.agents/skills/generate-game-kb/tests/cli.test.js`
- `.agents/skills/generate-game-kb/tests/finalize.test.js`
- `.agents/skills/generate-game-kb/tests/install.test.js`
- `.agents/skills/generate-game-kb/tests/install-v4.test.js`
- `.agents/skills/generate-game-kb/tests/progress.test.js`
- `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- `.agents/skills/generate-game-kb/tests/run-isolation.test.js`
- `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- `.agents/skills/generate-game-kb/tests/simplified-contract.test.js`
- `.agents/skills/generate-game-kb/tests/verify-v4.test.js`
- `dashboard/server/libraryScanner.ts`
- `dashboard/server/libraryApiPlugin.ts`
- `dashboard/src/types/library.ts`
- `dashboard/src/types/novel.ts`
- `dashboard/src/lib/libraryApi.ts`
- `dashboard/src/lib/normalizeNovelData.ts`
- `dashboard/src/lib/globalLibrary.ts`
- `dashboard/src/components/library/GlobalEntityDetail.tsx`
- `dashboard/src/pages/Items.tsx`
- `dashboard/src/pages/Factions.tsx`
- `dashboard/src/pages/BookOverview.tsx`
- `dashboard/src/pages/Library.tsx`
- `dashboard/server/libraryScanner.test.ts`
- `dashboard/server/libraryApiPlugin.test.ts`
- `dashboard/src/lib/normalizeNovelData.test.ts`
- `dashboard/src/lib/globalLibrary.test.ts`
- `dashboard/src/pages/Items.test.tsx`
- `dashboard/src/pages/Factions.test.tsx`
- `dashboard/src/pages/BookOverview.test.tsx`
- `dashboard/src/pages/Library.test.tsx`

### Delete After Cutover

- `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- `.agents/skills/generate-game-kb/scripts/lib/submit.js`
- `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- `.agents/skills/generate-game-kb/scripts/lib/quarantine.js`
- `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- `.agents/skills/generate-game-kb/tests/accept-retry.test.js`
- `.agents/skills/generate-game-kb/tests/domain-assembly.test.js`
- `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- `.agents/skills/generate-game-kb/tests/semantic-work.test.js`
- `.agents/skills/generate-game-kb/tests/quarantine.test.js`

---

### Task 1: 建立 v7 `types` Taxonomy 与纯 Worker 合同

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/type-taxonomy.js`
- Create: `.agents/skills/generate-game-kb/tests/type-taxonomy.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/helpers.js`

**Interfaces:**
- Produces: `normalizeTypeArray(category, values, fieldPath) -> { values, normalizations, errors }`。
- Produces: `validateWorkerChapterDraft(draft, expected) -> Issue[]`。
- Produces: `normalizeAcceptedChapterDraft(draft, expected) -> { chapter, normalizations }`。
- Test helpers: `v7WorkerDraft(overrides = {})` and `expectedChapter(overrides = {})` are added to `tests/helpers.js` and exported for later tasks.
- The final v7 entity fields are `skills[].types`, `items[].types`, `factions[].types`; no single `type`.

- [ ] **Step 1: Add failing taxonomy and worker-shape tests**

```javascript
test('normalizes only explicit one-to-one aliases', () => {
  const result = normalizeTypeArray('items', ['weapon', '暗器', 'weapon'], '$.items[0].types');
  assert.deepEqual(result.values, ['武器', '暗器']);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizations, [{
    field_path: '$.items[0].types[0]',
    original_value: 'weapon',
    normalized_value: '武器',
    normalization_rule: 'items.weapon'
  }]);
});

test('rejects ambiguous or unknown English values', () => {
  assert.deepEqual(normalizeTypeArray('items', ['book'], '$.items[0].types').errors.map(issue => issue.code), ['TYPE_VALUE_UNKNOWN']);
  assert.deepEqual(normalizeTypeArray('items', ['poison'], '$.items[0].types').errors.map(issue => issue.code), ['TYPE_VALUE_UNKNOWN']);
});

test('worker output rejects envelope and single type fields', () => {
  const draft = v7WorkerDraft();
  assert.deepEqual(validateWorkerChapterDraft({ unit: 'chapter:001', draft }, expectedChapter()).map(issue => issue.code), ['WORKER_TOP_LEVEL_FIELDS_INVALID']);
  draft.items[0].type = '武器';
  assert.ok(validateWorkerChapterDraft(draft, expectedChapter()).some(issue => issue.code === 'LEGACY_TYPE_FIELD'));
});
```

- [ ] **Step 2: Run tests and confirm red state**

Run:

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/type-taxonomy.test.js" ".agents/skills/generate-game-kb/tests/chapter-contract.test.js" ".agents/skills/generate-game-kb/tests/semantic-contract.test.js"
```

Expected: FAIL because `normalizeTypeArray`, `validateWorkerChapterDraft`, and v7 helper fixtures do not exist.

- [ ] **Step 3: Implement closed taxonomies and exact worker fields**

```javascript
const TYPE_TAXONOMIES = Object.freeze({
  skills: Object.freeze(['内功', '心法', '外功', '轻功', '身法', '剑法', '刀法', '枪法', '棍法', '棒法', '鞭法', '拳法', '掌法', '腿法', '爪法', '指法', '点穴', '擒拿', '暗器', '毒功', '医术', '易容', '音律', '阵法', '奇门', '合击', '其他']),
  items: Object.freeze(['武器', '防具', '秘籍', '丹药', '暗器', '坐骑', '异兽', '饰品', '其他']),
  factions: Object.freeze(['门派', '帮会', '组织', '家族', '世家', '朝廷', '官府', '商会', '镖局', '教派', '寺院', '部族', '王朝', '山庄', '其他'])
});

const TYPE_ALIASES = Object.freeze({
  skills: Object.freeze({ internal_skill: '内功', qinggong: '轻功', swordsmanship: '剑法', saber_skill: '刀法', hidden_weapon_skill: '暗器' }),
  items: Object.freeze({ weapon: '武器', armor: '防具', manual: '秘籍', elixir: '丹药', hidden_weapon: '暗器', mount: '坐骑', beast: '异兽', accessory: '饰品' }),
  factions: Object.freeze({ sect: '门派', imperial_court: '朝廷', merchant_guild: '商会', escort_agency: '镖局', clan: '家族' })
});
```

`normalizeTypeArray` must preserve first-seen order, emit one normalization record per changed element, and return `TYPE_VALUE_UNKNOWN` for values outside the category whitelist and alias map. The implementation must not translate free text or share alias maps across categories.

- [ ] **Step 4: Implement accepted injection without Worker identity copying**

`normalizeAcceptedChapterDraft` must inject `schema_version: 7`, chapter, title, source hash, source-ref chapter numbers, deterministic local keys, and top-level `normalizations`. It must reject Worker-authored `schema_version`, chapter, title, source hash, local keys, IDs, unit, cycle, attempt, input hash, and output paths.

- [ ] **Step 5: Run targeted regression tests**

Run the Step 2 command again.

Expected: all selected tests PASS; fixtures prove `weapon -> 武器`, while `book` and `poison` fail closed.

- [ ] **Step 6: Commit**

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/type-taxonomy.js" ".agents/skills/generate-game-kb/scripts/lib/chapter-contract.js" ".agents/skills/generate-game-kb/scripts/lib/semantic-contract.js" ".agents/skills/generate-game-kb/tests/type-taxonomy.test.js" ".agents/skills/generate-game-kb/tests/chapter-contract.test.js" ".agents/skills/generate-game-kb/tests/semantic-contract.test.js" ".agents/skills/generate-game-kb/tests/helpers.js"
rtk git commit -m "feat(game-kb): define v7 chapter and type contracts"
```

### Task 2: 建立固定窗口状态机与唯一 Chapter Job

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-progress.js`
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-work.js`
- Create: `.agents/skills/generate-game-kb/tests/chapter-work.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/progress.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`

**Interfaces:**
- Produces: `createProgress(manifest)`, `transitionProgress(progress, event)`, `assertProgressInvariant(progress, manifest)`.
- Produces: `issueNextWindow({ paths, manifest, progress }) -> { progress, jobs }`.
- Produces: `issueRetryJob({ paths, manifest, progress, unit }) -> { progress, job }`.
- Produces: `advanceChapterWork({ paths, manifest, progress }) -> { status, progress, jobs, manual_review }`.
- Produces: `activeJobMetadata(paths, progress) -> Job[]` for read-only `status` recovery.
- Test helpers: `manifestWithChapters(count)` and `temporaryRunPaths()` live in `chapter-work.test.js`; `chapterAttemptPaths` is exported by `paths.js`.

- [ ] **Step 1: Write fixed-window and cycle-path tests**

```javascript
test('does not refill a partially completed five-unit window', () => {
  const manifest = manifestWithChapters(25);
  const first = issueNextWindow({ paths, manifest, progress: createProgress(manifest) });
  assert.equal(first.jobs.length, 5);
  const acceptedOne = transitionProgress(first.progress, { type: 'accepted', unit: 'chapter:001', output_hash: 'sha256:one' });
  const second = issueNextWindow({ paths, manifest, progress: acceptedOne });
  assert.deepEqual(second.jobs, []);
  assert.deepEqual(second.progress.active_units, ['chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005']);
});

test('retry-unit creates a new cycle without overwriting prior files', () => {
  const first = chapterAttemptPaths(paths, 'chapter:001', 1, 1);
  const retried = chapterAttemptPaths(paths, 'chapter:001', 2, 1);
  assert.notEqual(first.input, retried.input);
  assert.notEqual(first.output, retried.output);
});
```

- [ ] **Step 2: Run tests and confirm red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/chapter-work.test.js" ".agents/skills/generate-game-kb/tests/progress.test.js" ".agents/skills/generate-game-kb/tests/run-isolation.test.js"
```

Expected: FAIL because v7 progress and chapter job APIs do not exist.

- [ ] **Step 3: Implement the single transition function**

```javascript
function transitionProgress(current, event) {
  const next = structuredClone(current);
  const unit = event.unit ? next.units[event.unit] : null;
  if (event.type === 'issue-window') applyIssuedWindow(next, event.jobs);
  else if (event.type === 'accepted') applyAccepted(next, unit, event);
  else if (event.type === 'rejected') applyRejected(next, unit, event);
  else if (event.type === 'retry-unit') applyNewCycle(next, unit, event);
  else throw new GameKbError('PROGRESS_EVENT_INVALID', 'Unknown progress transition', { type: event.type });
  assertProgressInvariant(next, event.manifest);
  return next;
}
```

The invariant checker must reject more than five active units, duplicate active units, active paths outside the selected run, attempts outside `1..2`, cycles below 1, mismatched unit/input hashes, and a window containing units after a non-accepted member from an earlier window.

- [ ] **Step 4: Implement immutable job files**

Chapter-worker input contains chapter text and taxonomy. Main-agent-repair input contains only rejected draft path, error report path, allowed repair codes, producer, and output path. Write input JSON with exclusive creation; if the same path already exists, require byte-identical content or raise `UNIT_ALREADY_ACTIVE`.

`advanceChapterWork` is the only orchestration facade: return `manual_review` when any unit is stopped; return `waiting` with no jobs while the current fixed window still has an unfinished unit; issue attempt 2 only for a rejected unit in that same window; issue the next window only when `active_units` is empty and every prior window is accepted; return `ready-to-assemble` only when every chapter is accepted. It must never refill a partially completed window.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/chapter-progress.js" ".agents/skills/generate-game-kb/scripts/lib/chapter-work.js" ".agents/skills/generate-game-kb/scripts/lib/paths.js" ".agents/skills/generate-game-kb/tests/chapter-work.test.js" ".agents/skills/generate-game-kb/tests/progress.test.js" ".agents/skills/generate-game-kb/tests/run-isolation.test.js"
rtk git commit -m "feat(game-kb): enforce fixed chapter windows"
```

### Task 3: 实现 Staging 自动接收与两次 Attempt 边界

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-receiver.js`
- Create: `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Modify: `.agents/skills/generate-game-kb/tests/artifact-immutability.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/accepted-serialization.test.js`

**Interfaces:**
- Produces: `receiveAvailableChapterOutputs({ paths, manifest, progress }) -> { progress, received }`.
- `received[]` contains `{ unit, status, output_hash, repair_allowed, errors }`.
- Accepted YAML is deterministic and includes top-level normalization records; raw staging bytes are always moved to `drafts/`.
- Test helpers: `prepareIssuedChapter({ chapterCount })` and `writeYaml(file, value)` live in `chapter-receiver.test.js` and use Task 1/2 exports.

- [ ] **Step 1: Add failing reception tests**

```javascript
test('accepts an expected staging YAML without submit', () => {
  const issued = prepareIssuedChapter({ chapterCount: 1 });
  writeYaml(issued.job.output_file, v7WorkerDraft());
  const result = receiveAvailableChapterOutputs(issued);
  assert.equal(result.received[0].status, 'accepted');
  assert.equal(fs.existsSync(issued.job.output_file), false);
  assert.equal(fs.existsSync(path.join(issued.paths.chapters, 'chapter_001.yaml')), true);
});

test('syntax-only failure creates a repair job and consumes attempt two', () => {
  const issued = prepareIssuedChapter({ chapterCount: 1 });
  fs.writeFileSync(issued.job.output_file, '```yaml\ncharacters: []\n```\n');
  const received = receiveAvailableChapterOutputs(issued);
  assert.equal(received.received[0].repair_allowed, true);
  const retry = issueRetryJob({ ...issued, progress: received.progress, unit: 'chapter:001' });
  assert.equal(retry.job.producer, 'main-agent-repair');
  assert.equal(JSON.stringify(readJson(retry.job.input_file)).includes('chapter_text'), false);
});
```

- [ ] **Step 2: Verify red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js" ".agents/skills/generate-game-kb/tests/artifact-immutability.test.js" ".agents/skills/generate-game-kb/tests/accepted-serialization.test.js"
```

Expected: FAIL because direct reception does not exist.

- [ ] **Step 3: Implement one-file reception transaction**

For each active unit with an existing expected output: re-check path confinement and realpath, read bytes once, hash raw bytes, reject multi-document YAML and trailing non-YAML text, validate and normalize, write accepted plus artifact manifest plus progress atomically, then move raw output into cycle/attempt `drafts`. A failure writes the exact cycle path such as `revisions/chapter_001/cycle_01/attempt_01.errors.json`, moves the raw draft, and transitions the unit without deleting individual entities.

- [ ] **Step 4: Implement mechanical classification and idempotency**

Only these normalized errors may set `repair_allowed: true`: `YAML_CODE_FENCE`, `YAML_INDENTATION`, `YAML_QUOTE`, `YAML_EMPTY_COLLECTION`. Any schema, evidence, entity, relation, summary, unknown type, or ambiguous type error must set producer `chapter-worker` for attempt 2. Re-observing an archived output hash must not change attempts or history.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS, including attempt-2 failure -> `manual_review`.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/chapter-receiver.js" ".agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js" ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js" ".agents/skills/generate-game-kb/tests/artifact-immutability.test.js" ".agents/skills/generate-game-kb/tests/accepted-serialization.test.js"
rtk git commit -m "feat(game-kb): receive chapter staging outputs"
```

### Task 4: 实现精确名称归并、泛称过滤与字段审计

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Create: `.agents/skills/generate-game-kb/tests/book-assembly.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/tests/candidate-registry.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/book-contract.test.js`

**Interfaces:**
- Produces: `assembleDeterministicBook({ manifest, chapters }) -> { book, deterministic_audit, review_warnings, manual_review }`.
- `deterministic_audit` contains `field_decisions` and flattened chapter type normalizations.
- `review_warnings` contains only human warnings such as `GENERIC_CANDIDATE_FILTERED`.
- Test helpers `chaptersForNames(names)` and `chaptersWithAliasOverlap()` are local complete fixtures in `book-assembly.test.js`.

- [ ] **Step 1: Add exact grouping and negative-merge tests**

```javascript
test('merges only category plus exact normalized name', () => {
  const result = assembleDeterministicBook({ manifest, chapters: chaptersForNames(['陆小凤', '陆小凤', '小凤', '陆小鳳']) });
  assert.equal(result.book.characters.length, 3);
  assert.equal(result.book.characters.filter(entry => entry.name === '陆小凤').length, 1);
});

test('alias overlap does not merge records', () => {
  const result = assembleDeterministicBook({ manifest, chapters: chaptersWithAliasOverlap() });
  assert.equal(result.book.characters.length, 2);
});

test('filters confirmed generic names into warnings', () => {
  const result = assembleDeterministicBook({ manifest, chapters: chaptersForNames(['店小二', '老刀把子']) });
  assert.deepEqual(result.book.characters.map(entry => entry.name), ['老刀把子']);
  assert.equal(result.review_warnings[0].code, 'GENERIC_CANDIDATE_FILTERED');
});
```

- [ ] **Step 2: Verify red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/book-assembly.test.js" ".agents/skills/generate-game-kb/tests/candidate-registry.test.js" ".agents/skills/generate-game-kb/tests/book-contract.test.js"
```

Expected: FAIL because default assembly still creates one registry entity per chapter candidate.

- [ ] **Step 3: Implement deterministic field rules**

- Arrays: stable first-seen union for aliases, identities, factions, skills, and `types`.
- Description: longest Unicode character count, then earliest source ref, then Chinese text order.
- Rank: greatest vote count, then latest chapter evidence, then the lower index in `POWER_RANKS` to avoid silently inflating a final tie.
- Level: `核心 > 重要 > 次要 > 龙套 > 背景`.
- Techniques: exact normalized technique name; description uses the same longest rule.
- Same canonical name appearing twice in one chapter with distinct local keys produces `IDENTITY_COLLISION_REVIEW_REQUIRED` and blocks publication.
- Every resulting entity emits `description/rank/level/types` field-decision records when that field belongs to its category, including single-candidate and no-conflict selections.

- [ ] **Step 4: Keep generic filtering conservative**

Seed exact-name sets with the confirmed cases only: characters `表哥/管家婆/店小二`; factions `武林/江湖`. Add `老刀把子` and `老实和尚` regression tests proving exact special titles survive. Future additions require a named test; do not introduce suffix, substring, or model-based filtering.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS and byte-identical results under reversed chapter input order.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/book-assembly.js" ".agents/skills/generate-game-kb/scripts/lib/candidate-registry.js" ".agents/skills/generate-game-kb/scripts/lib/book-contract.js" ".agents/skills/generate-game-kb/tests/book-assembly.test.js" ".agents/skills/generate-game-kb/tests/candidate-registry.test.js" ".agents/skills/generate-game-kb/tests/book-contract.test.js"
rtk git commit -m "feat(game-kb): merge exact book entities"
```

### Task 5: 稳定 ID 与 v7 五文件投影

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/ids.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Modify: `.agents/skills/generate-game-kb/tests/finalize.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble.test.js`
- Create: `.agents/skills/generate-game-kb/tests/ids.test.js`

**Interfaces:**
- Produces: `assignStableIds(recordsByCategory, priorPlan) -> { recordsByCategory, idPlan }`.
- `idPlan` records base ID, collision reason, suffix input, issued ID, category, and canonical name.
- Items and factions project `types`, never `type`.
- Test helpers `refs(chapter)` and `collisionNames()` are local deterministic fixtures in `ids.test.js`.

- [ ] **Step 1: Add failing ID stability tests**

```javascript
test('uses an unhashed ID when a pinyin base is unique', () => {
  const result = assignStableIds({ characters: [{ name: '陆小凤', source_refs: refs(1) }] }, {});
  assert.equal(result.recordsByCategory.characters[0].id, 'char_lu_xiao_feng');
});

test('uses canonical-name suffixes for different names with the same base', () => {
  const first = assignStableIds({ characters: collisionNames() }, {});
  const second = assignStableIds({ characters: collisionNames().reverse() }, {});
  assert.deepEqual(first, second);
  assert.ok(first.recordsByCategory.characters.every(entry => /^char_[a-z_]+_[a-p]{8}$/.test(entry.id)));
});

test('adding source evidence does not change an issued ID', () => {
  const first = assignStableIds({ characters: [{ name: '陆小凤', source_refs: refs(1) }] }, {});
  const second = assignStableIds({ characters: [{ name: '陆小凤', source_refs: [...refs(1), ...refs(9)] }] }, first.idPlan);
  assert.equal(first.recordsByCategory.characters[0].id, second.recordsByCategory.characters[0].id);
});
```

- [ ] **Step 2: Verify red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/ids.test.js" ".agents/skills/generate-game-kb/tests/finalize.test.js" ".agents/skills/generate-game-kb/tests/assemble.test.js"
```

Expected: FAIL because current `identityAnchor` hashes evidence and collision suffixes depend on candidate identity.

- [ ] **Step 3: Implement canonical-name collision planning**

Unique base -> base ID. Different canonical Chinese names sharing a base -> suffix from `alphabeticDigest(category + '\0' + canonicalName, 8)`. Same canonical name must already be one merged entity; duplicate same-name records throw `IDENTITY_COLLISION_REVIEW_REQUIRED`. Preserve a prior v7 issued ID, including an existing unsuffixed ID, and suffix only a newly introduced colliding name.

- [ ] **Step 4: Project exact v7 fields and references**

Update final schemas so `items` and `factions` contain `types: string[]`. Recompute references after ID planning and ensure chapter summaries remain one per chapter. `id_plan.json` must not include candidate-key sets or expanding source-ref lists as suffix input.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/ids.js" ".agents/skills/generate-game-kb/scripts/lib/finalize.js" ".agents/skills/generate-game-kb/tests/ids.test.js" ".agents/skills/generate-game-kb/tests/finalize.test.js" ".agents/skills/generate-game-kb/tests/assemble.test.js"
rtk git commit -m "feat(game-kb): issue stable book entity ids"
```

### Task 6: Assembly Audit、Warning Report 与原子安装

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/review-report.js`
- Create: `.agents/skills/generate-game-kb/tests/review-report.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/assemble.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/install.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- Modify: `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/verify-v4.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/install.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/install-v4.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/archive.test.js`

**Interfaces:**
- Produces: `buildReviewReport({ sourceHash, finalDataHash, warnings })` and `validateReviewReport(report)`.
- Adds `paths.reviewReport = final/reports/game-kb-review.json`.
- `assembly-report.json` gains `deterministic_audit`, `deterministic_audit_hash`, and `review_report_hash`.
- Installation receipt gains `review_report_hash`.
- Test helper `installFixtureWithReviewReport()` creates all files under an OS temporary directory and exposes the exact fault-injection and digest methods used below.

- [ ] **Step 1: Write warning-only and rollback tests**

```javascript
test('rejects info and auto-resolved entries in review report', () => {
  const report = buildReviewReport({ sourceHash, finalDataHash, warnings: [] });
  report.summary.info_count = 1;
  assert.ok(validateReviewReport(report).some(issue => issue.code === 'REVIEW_REPORT_INVALID'));
});

test('restores old data and review report when report promotion fails', () => {
  const fixture = installFixtureWithReviewReport();
  assert.throws(() => fixture.promote({ faultAt: 'after-review-write' }), error => error.code === 'INSTALL_FAULT_INJECTED');
  assert.equal(fs.readFileSync(fixture.installedReview, 'utf8'), fixture.previousReviewText);
  assert.equal(fixture.installedDataDigest(), fixture.previousDataDigest);
});
```

- [ ] **Step 2: Verify red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/review-report.test.js" ".agents/skills/generate-game-kb/tests/assemble-flow.test.js" ".agents/skills/generate-game-kb/tests/verify-v4.test.js" ".agents/skills/generate-game-kb/tests/install.test.js" ".agents/skills/generate-game-kb/tests/install-v4.test.js" ".agents/skills/generate-game-kb/tests/archive.test.js"
```

Expected: FAIL because review report generation and joint rollback do not exist.

- [ ] **Step 3: Build both reports in one deterministic assembly**

`assembleRun` must first produce final data/hash, then build warning-only review report, hash it, and finally write the assembly report containing the deterministic audit and both hashes. Review entries require `code`, fixed `severity: warning`, category, name, chapter numbers, source refs, member refs, reason, and resolution. Do not copy field decisions into review entries.

- [ ] **Step 4: Extend verification, install, and archive gates**

Workspace verification re-runs deterministic assembly and compares `deterministic_audit_hash`, review schema, source/final hashes, and review hash. Installation snapshots `verification-report.json` and `game-kb-review.json`, writes both in the data swap transaction, and restores both on failure. Installed verification uses installed data, review report, and receipt only. Archive receipt binds assembly, verification, install, review, source, and final hashes.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/review-report.js" ".agents/skills/generate-game-kb/scripts/lib/paths.js" ".agents/skills/generate-game-kb/scripts/lib/assemble.js" ".agents/skills/generate-game-kb/scripts/lib/verify.js" ".agents/skills/generate-game-kb/scripts/lib/install.js" ".agents/skills/generate-game-kb/scripts/lib/archive.js" ".agents/skills/generate-game-kb/tests/review-report.test.js" ".agents/skills/generate-game-kb/tests/assemble-flow.test.js" ".agents/skills/generate-game-kb/tests/verify-v4.test.js" ".agents/skills/generate-game-kb/tests/install.test.js" ".agents/skills/generate-game-kb/tests/install-v4.test.js" ".agents/skills/generate-game-kb/tests/archive.test.js"
rtk git commit -m "feat(game-kb): publish audit and review reports"
```

### Task 7: 切换 v7 Run/CLI 并硬拒绝旧 Run 写入

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.claude/agents/game-kb-chapter-worker.md`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/simplified-contract.test.js`

**Interfaces:**
- `runPipeline(novelDir, runId) -> { semantic_contract_version, run_id, status, jobs, active_units, progress, manual_review }`.
- `publicRunResult(run, next)` is the only serializer for `jobs/waiting/manual_review/complete` and always emits the stable fields above.
- `status` is read-only and returns contract version, persisted progress, recoverable active job metadata, manual review, or terminal summary without creating directories or rewriting metadata.
- `retry-unit` requires `--confirm`, only accepts a v7 `manual_review` unit, increments cycle, and resets attempt to 1 without overwriting earlier files.
- `archive-abandoned` may archive a selected v6 or v7 run without parsing, migrating, or rewriting its contents; every other v6 write path fails with `LEGACY_SEMANTIC_CONTRACT` before mutation.
- Test helpers `makeLegacyRunFixture()`, `makeV7RunFixture(overrides)`, and `snapshotTree()` are local to `run-archive.test.js`; no real book run is used.

- [ ] **Step 1: Replace CLI contract tests**

```javascript
test('public command surface is exactly v7', () => {
  assert.deepEqual(publicCommands(), ['archive-abandoned', 'retry-unit', 'run', 'status']);
  for (const removed of ['prepare', 'extract-plan', 'submit', 'plan-domains', 'accept', 'assemble', 'verify', 'install', 'archive-run', 'archive-existing', 'reset-unit']) {
    assert.equal(runFlow(removed, novel).code, 'COMMAND_UNKNOWN');
  }
});

test('twenty-five chapters expose only the first five jobs', () => {
  const first = runFlow('run', makeNovel(25));
  assert.equal(first.status, 'jobs');
  assert.deepEqual(first.jobs.map(job => job.unit), ['chapter:001', 'chapter:002', 'chapter:003', 'chapter:004', 'chapter:005']);
  const second = runFlow('run', first.novel_dir, first.run_id);
  assert.equal(second.status, 'waiting');
  assert.deepEqual(second.jobs, []);
});

test('legacy status is read-only and run fails before mutation', () => {
  const legacy = makeLegacyRunFixture();
  const before = snapshotTree(legacy.runDir);
  const status = runFlow('status', legacy.novelDir, legacy.runId);
  assert.equal(status.semantic_contract_version, 6);
  assert.deepEqual(snapshotTree(legacy.runDir), before);
  assert.equal(runFlow('run', legacy.novelDir, legacy.runId).code, 'LEGACY_SEMANTIC_CONTRACT');
  assert.deepEqual(snapshotTree(legacy.runDir), before);
});

test('retry-unit requires confirmation and manual review', () => {
  const active = makeV7RunFixture({ unitStatus: 'active' });
  assert.equal(runFlow('retry-unit', active.novelDir, active.runId, { unit: 'chapter:001' }).code, 'CONFIRM_REQUIRED');
  assert.equal(runFlow('retry-unit', active.novelDir, active.runId, { unit: 'chapter:001', confirm: true }).code, 'RETRY_UNIT_NOT_REVIEWABLE');
});

test('archive-abandoned preserves legacy bytes without conversion', () => {
  const legacy = makeLegacyRunFixture();
  const before = snapshotTree(legacy.runDir);
  const result = runFlow('archive-abandoned', legacy.novelDir, legacy.runId);
  assert.equal(result.status, 'archived-abandoned');
  assert.deepEqual(snapshotTree(result.archiveDir), before);
});
```

- [ ] **Step 2: Verify red state**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/cli.test.js" ".agents/skills/generate-game-kb/tests/run-archive.test.js" ".agents/skills/generate-game-kb/tests/simplified-contract.test.js"
```

Expected: FAIL because the old command switch and semantic contract version 6 remain active.

- [ ] **Step 3: Implement progressive v7 orchestration**

```javascript
function runPipeline(novelDir, runId) {
  const run = createOrResumeRun(novelDir, { runId });
  const paths = pathsFor(novelDir, run.run_id);
  const manifest = ensureManifest(novelDir, paths);
  let progress = loadChapterProgress(paths, manifest);
  ({ progress } = receiveAvailableChapterOutputs({ paths, manifest, progress }));
  const next = advanceChapterWork({ paths, manifest, progress });
  saveChapterProgress(paths, next.progress);
  if (next.status !== 'ready-to-assemble') return publicRunResult(run, next);
  assembleRun({ paths });
  verifyWorkspace(novelDir, run.run_id);
  installVerifiedData(novelDir, { runId: run.run_id });
  verifyInstalledOrThrow(novelDir);
  archiveRun(novelDir, run.run_id);
  return publicRunResult(run, {
    status: 'complete',
    progress: next.progress,
    jobs: [],
    manual_review: null
  });
}
```

Set `SEMANTIC_CONTRACT_VERSION = 7` and `SEMANTIC_PROFILE = 'chapter-direct-v1'`. Remove `--deep` parsing. A v6 run may be inspected by `status` or moved intact by `archive-abandoned`; `run` and `retry-unit` must throw `LEGACY_SEMANTIC_CONTRACT` before touching files.

- [ ] **Step 4: Rewrite Worker instructions**

The prompt and Claude agent must say: read the single `input_file`, write YAML to the exact `output_file`, do not return an envelope, do not call controller commands, do not alter controller fields, and do not write anywhere else. Include separate chapter-worker and main-agent-repair input descriptions.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command plus:

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/chapter-work.test.js" ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js" ".agents/skills/generate-game-kb/tests/assemble-flow.test.js"
```

Expected: PASS.

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/flow.js" ".agents/skills/generate-game-kb/scripts/lib/run.js" ".agents/skills/generate-game-kb/scripts/lib/semantic-contract.js" ".agents/skills/generate-game-kb/prompts/extract-chapters.md" ".claude/agents/game-kb-chapter-worker.md" ".agents/skills/generate-game-kb/tests/cli.test.js" ".agents/skills/generate-game-kb/tests/run-archive.test.js" ".agents/skills/generate-game-kb/tests/simplified-contract.test.js"
rtk git commit -m "feat(game-kb): cut over to v7 direct chapter flow"
```

### Task 8: 删除旧运输层并重写 Skill 合同

**Files:**
- Delete: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/progress.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/submit.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- Delete: `.agents/skills/generate-game-kb/scripts/lib/quarantine.js`
- Delete: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Delete: `.agents/skills/generate-game-kb/tests/accept-retry.test.js`
- Delete: `.agents/skills/generate-game-kb/tests/domain-assembly.test.js`
- Delete: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- Delete: `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- Delete: `.agents/skills/generate-game-kb/tests/semantic-work.test.js`
- Delete: `.agents/skills/generate-game-kb/tests/quarantine.test.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/tests/simplified-contract.test.js`

**Interfaces:**
- No production export may contain `submitWorkerEnvelope`, domain decision APIs, worker pool APIs, or entity quarantine/sanitize APIs.
- `readProductionText()` is a local test helper that concatenates only production `.js` and prompt/Skill files under `.agents/skills/generate-game-kb`, excluding `tests/` and historical Trellis documents.

- [ ] **Step 1: Add a static forbidden-contract test**

```javascript
test('runtime has no legacy transport or domain contract', () => {
  const production = readProductionText();
  for (const forbidden of ['submitWorkerEnvelope', 'plan-domains', 'distill:', 'worker-pool.json', 'WORKER_WRITE_PATHS = []', 'JSON envelope']) {
    assert.equal(production.includes(forbidden), false, forbidden);
  }
});
```

- [ ] **Step 2: Verify the test fails before deletion**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/simplified-contract.test.js"
```

Expected: FAIL and name at least one legacy file or token.

- [ ] **Step 3: Delete unreferenced modules and obsolete tests**

Before deleting each file, run a repository reference search. Remove old domain/submit/worker-pool/quarantine tests rather than rewriting them to test removed behavior. Migrate still-valid accepted immutability assertions into `chapter-receiver.test.js` and still-valid assembly assertions into `book-assembly.test.js`.

- [ ] **Step 4: Rewrite Skill and schema docs around the four commands**

`SKILL.md` must show the actual loop: call `run`, dispatch only returned jobs, wait for outputs, call `run` again. It must explicitly state that `waiting` returns no new jobs, `status` recovers active job paths, mechanical repair consumes attempt 2, and only user-confirmed `retry-unit` opens a new cycle. `schemas.md` must document Worker YAML, accepted YAML, three `types` arrays, assembly audit, review warnings, and five-file final contract.

- [ ] **Step 5: Run all controller tests and commit**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/*.test.js"
```

Expected: PASS with no test loading a deleted module.

```powershell
rtk git add -A -- ".agents/skills/generate-game-kb" ".claude/agents/game-kb-chapter-worker.md"
rtk git commit -m "refactor(game-kb): remove legacy transport layers"
```

### Task 9: Dashboard 双读 Legacy `type` 与 v7 `types`

**Files:**
- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.test.ts`
- Modify: `dashboard/src/lib/globalLibrary.ts`
- Modify: `dashboard/src/lib/globalLibrary.test.ts`
- Modify: `dashboard/src/components/library/GlobalEntityDetail.tsx`
- Modify: `dashboard/src/pages/Items.tsx`
- Modify: `dashboard/src/pages/Factions.tsx`
- Modify: `dashboard/src/pages/BookOverview.tsx`
- Modify: `dashboard/src/pages/Items.test.tsx`
- Modify: `dashboard/src/pages/Factions.test.tsx`
- Modify: `dashboard/src/pages/BookOverview.test.tsx`

**Interfaces:**
- `Skill`, `Item`, and `Faction` expose `types: string[]` in memory.
- Raw disk data may contain exactly one of `type` or `types`; both is `LEGACY_TYPE_AND_TYPES_CONFLICT`.

- [ ] **Step 1: Add failing normalizer tests**

```typescript
it('normalizes legacy type and v7 types to one read model', () => {
  const legacy = normalizeNovelData(validRawData({ items: [{ id: 'item_a', name: '甲', aliases: [], type: '武器', description: null }] }));
  const v7 = normalizeNovelData(validRawData({ items: [{ id: 'item_a', name: '甲', aliases: [], types: ['武器', '暗器'], description: null }] }));
  expect(legacy.items[0].types).toEqual(['武器']);
  expect(v7.items[0].types).toEqual(['武器', '暗器']);
});

it('rejects type and types together', () => {
  expect(() => normalizeNovelData(validRawData({ factions: [{ id: 'faction_a', name: '甲门', aliases: [], type: '门派', types: ['门派'], description: null }] }))).toThrowError(/LEGACY_TYPE_AND_TYPES_CONFLICT/);
});
```

- [ ] **Step 2: Verify red state**

```powershell
cd dashboard
rtk npm test -- src/lib/normalizeNovelData.test.ts src/lib/globalLibrary.test.ts
```

Expected: FAIL because Item and Faction still expose nullable `type`.

- [ ] **Step 3: Implement one normalization helper**

```typescript
function normalizedTypes(record: Record<string, unknown>, path: string): string[] {
  const hasType = Object.hasOwn(record, 'type');
  const hasTypes = Object.hasOwn(record, 'types');
  if (hasType && hasTypes) throw new DataContractError('LEGACY_TYPE_AND_TYPES_CONFLICT', path);
  if (hasTypes) return stringArrayAt(record.types, `${path}.types`);
  if (!hasType || record.type === null) return [];
  return [stringAt(record.type, `${path}.type`)];
}
```

Update tables, filters, overview, global search, and detail panels to iterate all values and render existing taxonomy labels. Empty arrays display “未分类” only where the current UI already has an empty-state slot.

- [ ] **Step 4: Run Dashboard tests/build and commit**

```powershell
rtk npm test -- src/lib/normalizeNovelData.test.ts src/lib/globalLibrary.test.ts src/pages/BookOverview.test.tsx
rtk npm run build
```

Expected: PASS.

```powershell
cd ..
rtk git add -- dashboard/src/types/novel.ts dashboard/src/lib/normalizeNovelData.ts dashboard/src/lib/normalizeNovelData.test.ts dashboard/src/lib/globalLibrary.ts dashboard/src/lib/globalLibrary.test.ts dashboard/src/components/library/GlobalEntityDetail.tsx dashboard/src/pages/Items.tsx dashboard/src/pages/Items.test.tsx dashboard/src/pages/Factions.tsx dashboard/src/pages/Factions.test.tsx dashboard/src/pages/BookOverview.tsx dashboard/src/pages/BookOverview.test.tsx
rtk git commit -m "feat(dashboard): normalize legacy and v7 entity types"
```

### Task 10: Dashboard Review Status 与只读 API

**Files:**
- Modify: `dashboard/src/types/library.ts`
- Modify: `dashboard/server/libraryScanner.ts`
- Modify: `dashboard/server/libraryScanner.test.ts`
- Modify: `dashboard/server/libraryApiPlugin.ts`
- Modify: `dashboard/server/libraryApiPlugin.test.ts`
- Modify: `dashboard/src/lib/libraryApi.ts`

**Interfaces:**
- Adds `ReviewStatus = 'missing' | 'current' | 'stale' | 'invalid'`.
- Adds `ReviewSummary = { status: ReviewStatus; warningCount: number; reportPath: string | null }` and `LibraryBookStatus.review: ReviewSummary`.
- Adds `readReviewReport(rootDirectory, bookPath)` and `fetchReviewReport(bookPath)`.

- [ ] **Step 1: Add scanner and API tests**

```typescript
it('treats a missing report as normal for legacy books', () => {
  const book = scanLibrary(createLegacyBook()).books[0];
  expect(book.review).toEqual({ status: 'missing', warningCount: 0, reportPath: null });
  expect(book.browseable).toBe(true);
});

it('serves only the fixed review report path', async () => {
  const result = await handleLibraryApiRequest(root, 'GET', '/api/library/review-report?path=古龙/测试');
  expect(result?.status).toBe(200);
  expect(result?.body).toMatchObject({ report_version: 1, entries: [] });
});
```

- [ ] **Step 2: Verify red state**

```powershell
cd dashboard
rtk npm test -- server/libraryScanner.test.ts server/libraryApiPlugin.test.ts
```

Expected: FAIL because review status and endpoint do not exist.

- [ ] **Step 3: Implement strict read-only report parsing**

Read only `reports/game-kb-review.json`. Compare report source/final hashes with `generate_game_kb_install.json` when present. Missing legacy report -> empty valid response. Missing/invalid report for semantic contract 7 -> `completed=false` but keep `browseable` when the five YAML files parse. Stale/invalid states add concise scan warnings. Non-GET -> 405, missing path -> 400, unsafe or unknown path -> 422.

- [ ] **Step 4: Run tests and commit**

```powershell
rtk npm test -- server/libraryScanner.test.ts server/libraryApiPlugin.test.ts
rtk npm run build
```

Expected: PASS and `/api/library/book-data` still returns exactly five keys.

```powershell
cd ..
rtk git add -- dashboard/src/types/library.ts dashboard/server/libraryScanner.ts dashboard/server/libraryScanner.test.ts dashboard/server/libraryApiPlugin.ts dashboard/server/libraryApiPlugin.test.ts dashboard/src/lib/libraryApi.ts
rtk git commit -m "feat(dashboard): expose game kb review status"
```

### Task 11: Dashboard Warning 详情 UI

**Files:**
- Create: `dashboard/src/components/library/ReviewReportPanel.tsx`
- Create: `dashboard/src/components/library/ReviewReportPanel.test.tsx`
- Modify: `dashboard/src/components/library/LibraryCard.tsx`
- Modify: `dashboard/src/pages/Library.tsx`
- Modify: `dashboard/src/pages/Library.test.tsx`

**Interfaces:**
- `ReviewReportPanelProps = { bookPath: string; status: ReviewSummary }`.
- Report details load only when the selected book sheet is open and warning count is nonzero.

- [ ] **Step 1: Add UI state tests**

```tsx
it('shows warning count and loads details on demand', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    report_version: 1,
    source_hash: 'sha256:source',
    final_data_hash: 'sha256:data',
    summary: { warning_count: 2, by_code: { GENERIC_CANDIDATE_FILTERED: 2 }, by_category: { characters: 2 } },
    entries: [{ code: 'GENERIC_CANDIDATE_FILTERED', severity: 'warning', category: 'characters', name: '店小二', chapter_numbers: [1], source_refs: [], member_refs: [], reason: '泛称', resolution: 'filtered' }]
  }), { status: 200 }))));
  render(<ReviewReportPanel bookPath="古龙/测试" status={{ status: 'current', warningCount: 2, reportPath: 'reports/game-kb-review.json' }} />);
  expect(screen.getByText('2 条审查警告')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '查看审查警告' }));
  expect(await screen.findByText('GENERIC_CANDIDATE_FILTERED')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red state**

```powershell
cd dashboard
rtk npm test -- src/components/library/ReviewReportPanel.test.tsx src/pages/Library.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement loading, empty, stale, invalid, and grouped detail states**

Use lucide `AlertTriangle`, `RefreshCw`, and `ChevronDown` icons. Group entries by category, then code, and show chapter numbers, reason, resolution, and source refs. Keep the report panel inside the existing status Sheet; do not create nested cards or write actions. Long source text must wrap and never resize the Sheet width.

- [ ] **Step 4: Run tests/build and commit**

```powershell
rtk npm test -- src/components/library/ReviewReportPanel.test.tsx src/pages/Library.test.tsx
rtk npm run build
```

Expected: PASS.

```powershell
cd ..
rtk git add -- dashboard/src/components/library/ReviewReportPanel.tsx dashboard/src/components/library/ReviewReportPanel.test.tsx dashboard/src/components/library/LibraryCard.tsx dashboard/src/pages/Library.tsx dashboard/src/pages/Library.test.tsx
rtk git commit -m "feat(dashboard): display game kb review warnings"
```

### Task 12: 自动化端到端、25 章窗口与洁净度回归

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/v7-e2e.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/helpers.js`
- Modify: `.agents/skills/generate-game-kb/tests/simplified-contract.test.js`

**Interfaces:**
- Test helper creates temporary 6-chapter and 25-chapter novels outside the repository.
- Test workers write directly to returned output paths; no submit helper exists.

- [ ] **Step 1: Add the full-flow failing test**

```javascript
test('six chapters cross the first window and install five YAML plus review report', () => {
  const novel = makeTemporaryNovel(6);
  let result = runFlow('run', novel);
  assert.equal(result.jobs.length, 5);
  writeAllWorkerOutputs(result.jobs);
  result = runFlow('run', novel, result.run_id);
  assert.deepEqual(result.jobs.map(job => job.unit), ['chapter:006']);
  writeAllWorkerOutputs(result.jobs);
  result = runFlow('run', novel, result.run_id);
  assert.equal(result.status, 'complete');
  assert.deepEqual(fs.readdirSync(path.join(novel, 'data')).sort(), ['chapter_summaries.yaml', 'characters.yaml', 'factions.yaml', 'items.yaml', 'skills.yaml']);
  assert.equal(fs.existsSync(path.join(novel, 'reports', 'game-kb-review.json')), true);
});
```

- [ ] **Step 2: Add 25-chapter and cleanliness assertions**

Repeated `run` before output must never expose chapter 6. After one to four outputs, still no chapter 6. Assert `.kb-scratch` remains absent, the repository-root artifact snapshot is unchanged, and no `envelope`, `clean`, `submit`, or chapter fragment script is created.

- [ ] **Step 3: Run controller and Dashboard full gates**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/*.test.js"
cd dashboard
rtk npm test
rtk npm run lint
rtk npm run build
```

Expected: all commands exit 0. Analyze any long output through context-mode and fix failures before committing.

- [ ] **Step 4: Commit**

```powershell
cd ..
rtk git add -- ".agents/skills/generate-game-kb/tests/v7-e2e.test.js" ".agents/skills/generate-game-kb/tests/helpers.js" ".agents/skills/generate-game-kb/tests/simplified-contract.test.js"
rtk git commit -m "test(game-kb): cover v7 end to end flow"
```

### Task 13: 更新 Trellis 规范并完成双宿主真实模型门禁

**Files:**
- Modify: `.trellis/spec/backend/quality-guidelines.md`
- Modify: `.trellis/spec/backend/library-status-api.md`
- Modify: `.trellis/spec/frontend/global-library-browser.md`
- Do not edit journal files manually; let Trellis finish/session tooling update the active developer journal.

**Interfaces:**
- Specs become the durable v7 contract; no v6 envelope/deep/domain wording remains as current guidance.

- [ ] **Step 1: Update executable specifications**

Backend quality spec must record fixed windows, direct staging, attempts/cycles, mechanical repair boundary, exact-name merge, stable IDs, assembly audit and warning review gates. Library API spec must record five-key `/book-data`, legacy `type`/v7 `types`, review summary, fixed review endpoint, and stale/invalid behavior. Frontend spec must record multi-type presentation and read-only warning detail states.

- [ ] **Step 2: Verify documentation consistency**

```powershell
rtk grep "(submitWorkerEnvelope|plan-domains|distill:|--deep|info_count)" ".agents/skills/generate-game-kb/SKILL.md" ".agents/skills/generate-game-kb/schemas.md" ".agents/skills/generate-game-kb/prompts" ".agents/skills/generate-game-kb/scripts" ".claude/agents/game-kb-chapter-worker.md" ".trellis/spec/backend" ".trellis/spec/frontend"
```

Expected: no current-contract matches. Tests are intentionally outside this scan because static regression tests name removed tokens as negative assertions. `rtk grep`/`rg` exit code `1` is the expected no-match result; exit code `0` means forbidden current-contract text remains, and exit code greater than `1` is a command failure. Historical task documents are also outside this command and remain unchanged.

- [ ] **Step 3: Re-run full automated gates**

Run the Task 12 Step 3 commands. Expected: all exit 0.

- [ ] **Step 4: Commit spec updates**

```powershell
rtk git add -- ".trellis/spec/backend/quality-guidelines.md" ".trellis/spec/backend/library-status-api.md" ".trellis/spec/frontend/global-library-browser.md"
rtk git commit -m "docs(trellis): record game kb v7 contracts"
```

- [ ] **Step 5: Run the same six-chapter corpus in Claude Code and WorkBuddy**

For each host, use a fresh temporary copy of the committed six-chapter acceptance corpus and a distinct run ID. The host may dispatch at most the five jobs returned by `run`; it must wait for that window to finish before `run` can return chapter 6. Record from final output and installed files:

- first response contains exactly chapters 1-5;
- repeated `run` before outputs is `waiting` with `jobs: []`;
- second window contains chapter 6 only;
- final status is `complete`;
- five YAML and `reports/game-kb-review.json` are installed;
- no `.kb-scratch`, raw envelope, cleanup script, submit script, root chapter fragment, or controller-private manual edit is created;
- Dashboard reports the book browseable and displays warning details when warnings exist.

This is an external manual gate, not a reason to weaken automated tests. A host failure must preserve its temporary v7 run with `archive-abandoned`; never use either existing v6 book as the acceptance target.

## Final Verification Gate

Before `trellis-finish-work`, run fresh commands and retain the exit codes:

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/*.test.js"
cd dashboard
rtk npm test
rtk npm run lint
rtk npm run build
cd ..
rtk git diff --check
rtk git status --short
```

Required outcome:

- controller tests: 0 failures;
- Dashboard Vitest: 0 failures;
- lint: 0 errors;
- build: exit 0;
- `git diff --check`: exit 0;
- `git status` contains only intentionally uncommitted user artifacts, never task implementation files;
- both real-model gates completed or the task remains explicitly in progress with the external gate named as outstanding.

### Task 14: 修复 Repair 路径并让 Worker Job 合同跨宿主自包含

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/chapter-worker-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-work.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-work.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/simplified-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/examples.md`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.claude/agents/game-kb-chapter-worker.md`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- `WORKER_CONTRACT_VERSION = 1`
- `createWorkerContract(): object` returns a fresh structured contract for every input.
- Both `chapterWorkerInput` and `repairInput` serialize the contract as
  `worker_contract`; repair inputs still omit chapter source fields.

- [x] **Step 1: Reproduce the rejected-draft path defect**

Extend the syntax-only receiver test to assert
`input.rejected_draft === draftPath(paths)` and that the file exists. Run:

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js"
```

Expected before the fix: FAIL because the input points into `revisions/`.

- [x] **Step 2: Fix the path and retain the repair isolation boundary**

Change repair input generation to read the raw rejected YAML from `paths.drafts`, while
keeping the error report in `paths.revisions`. Re-run the receiver test; expected 9/9 pass.

- [x] **Step 3: Write failing self-contained input tests**

Assert that both producer inputs contain `worker_contract` with the complete YAML skeleton,
required/forbidden fields, exact-name and exact-quote substring checks, non-empty summary
check, recursive `source_refs` checks, own-evidence coverage, taxonomy and relationship
closure rules, and a producer-specific preflight.
Assert repair inputs still omit `chapter_text/source_file/source_hash/taxonomies`.

- [x] **Step 4: Implement the shared structured contract**

Create `chapter-worker-contract.js` as the single runtime source and inject a fresh contract
into both input shapes. Do not add a second validator or relax Controller validation.

- [x] **Step 5: Make dispatch documentation input-only**

Update Skill, prompt, schema, examples and Claude agent so every host is told to obey the
embedded `worker_contract` and execute its recursive preflight before reporting completion.
No host may be required to discover external contract files.

- [x] **Step 6: Verify targeted and full controller gates**

```powershell
rtk node --test ".agents/skills/generate-game-kb/tests/chapter-work.test.js" ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js" ".agents/skills/generate-game-kb/tests/simplified-contract.test.js"
rtk node --test ".agents/skills/generate-game-kb/tests/*.test.js"
rtk git diff --check
```

Expected: all tests pass, diff check exits 0, and no `.kb-scratch` appears.

- [x] **Step 7: Commit independently**

```powershell
rtk git add -- ".agents/skills/generate-game-kb/scripts/lib/chapter-worker-contract.js" ".agents/skills/generate-game-kb/scripts/lib/chapter-work.js" ".agents/skills/generate-game-kb/tests/chapter-work.test.js" ".agents/skills/generate-game-kb/tests/chapter-receiver.test.js" ".agents/skills/generate-game-kb/tests/simplified-contract.test.js" ".agents/skills/generate-game-kb/prompts/extract-chapters.md" ".agents/skills/generate-game-kb/schemas.md" ".agents/skills/generate-game-kb/examples.md" ".agents/skills/generate-game-kb/SKILL.md" ".claude/agents/game-kb-chapter-worker.md" ".trellis/spec/backend/quality-guidelines.md"
rtk git commit -m "fix(game-kb): make worker contracts self contained"
```
