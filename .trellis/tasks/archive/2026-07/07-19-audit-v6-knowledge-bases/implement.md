# 旧知识库确定性迁移到 V6 实施计划

> **执行要求：** 当前任务固定为 inline execution。开始实施后先使用 `trellis-before-dev`，随后按任务顺序执行 TDD；每个代码任务都必须先看到目标测试失败，再写最小实现。不得派发实施或检查子代理。

**目标：** 新增可重复的全仓 V6 审计和旧 JSON -> V6 YAML 确定性迁移能力，在不重新提取小说的前提下迁移可复用数据，并把不可迁移或迁移失败的数据安全归档。

**架构：** 只读 auditor 负责发现和分类；source resolver、mapper、evidence rebuilder 组成纯迁移管线；候选 run 在书籍目录外构建并接受 canonical workspace verification；transaction controller 归档旧生成物、提升候选、安装并执行 installed verification。所有变更以 per-book receipt 和 repository report 留痕。

**技术栈：** Node.js CommonJS、`node:test`、`js-yaml`、现有 generate-game-kb V6 verifier/installer/archive 模块、PowerShell/Windows Unicode 路径。

## 全局约束

- semantic contract version 固定为 `6`；活动 `data` 文件集严格为五个 YAML。
- 禁止重新运行章节/领域提取，禁止模型阅读小说补数据；只能复用旧 JSON、`source_refs`、`ch_split`、源文件和旧 run/archive 工件。
- 无有效证据实体必须剔除并报告；章节摘要必须完整覆盖当前章节清单。
- 旧人物/武功 rank 默认写为 `null`；不得把旧 `power_rank/mastery_rank` 直接视为 V6 全书语义结论。
- 禁止恢复 holders/owner/members/character items 等 V6 已移除关系。
- 同名实体不自动合并；ID 冲突必须用稳定指纹区分。
- 迁移失败即归档；旧 JSON 或部分 V6 不得恢复为活动数据。
- `古龙/剑神一笑` 的活动数据必须保持字节不变。
- 中文作者、书名和 Windows 路径必须作为一等输入测试。
- 不修改或提交现有用户文件：`.claude/skills/generate-game-kb-*`、`docs/wuxia-kb-build-priority.md`、用户修改的小说文本，以及与本任务无关的未跟踪目录。

## 文件结构

### 新建

- `.agents/skills/generate-game-kb/scripts/lib/legacy-source.js`：发现、排序、验证并加载单一权威旧 final；读取现有章节清单。
- `.agents/skills/generate-game-kb/scripts/lib/legacy-map.js`：纯字段映射、描述合并、物品类型映射、旧 ID registry 生成。
- `.agents/skills/generate-game-kb/scripts/lib/legacy-evidence.js`：验证旧 `source_refs`，构建 accepted chapter drafts、candidate registry 与 domain decisions。
- `.agents/skills/generate-game-kb/scripts/lib/legacy-migration.js`：预检、staging run、canonical verify、归档/提升/安装事务与 receipt。
- `.agents/skills/generate-game-kb/scripts/lib/repository-audit.js`：两级 author/book 仓库扫描与分类报告模型。
- `.agents/skills/generate-game-kb/scripts/audit-v6.js`：仓库级只读 CLI 和报告写入入口。
- `.agents/skills/generate-game-kb/tests/legacy-map.test.js`：纯映射、rank、ID、关系和类型映射测试。
- `.agents/skills/generate-game-kb/tests/legacy-source.test.js`：来源优先级、完整性、损坏数据和 Unicode 路径测试。
- `.agents/skills/generate-game-kb/tests/legacy-evidence.test.js`：证据形态、实体拒绝、章节覆盖和引用测试。
- `.agents/skills/generate-game-kb/tests/legacy-migration.test.js`：候选、事务故障、失败归档和安装验证集成测试。
- `.agents/skills/generate-game-kb/tests/repository-audit.test.js`：仓库发现、初始分类和报告稳定性测试。

### 修改

- `.agents/skills/generate-game-kb/scripts/lib/paths.js`：支持显式 `workRoot` 和通用 `migrationReceipt` 路径。
- `.agents/skills/generate-game-kb/scripts/lib/install.js`：安装收据验证优先读取通用 migration receipt，并兼容既有 chapter import receipt。
- `.agents/skills/generate-game-kb/scripts/flow.js`：增加 `migrate-legacy` 命令和 `--from/--staging-root/--confirm` 参数路由。
- `.agents/skills/generate-game-kb/SKILL.md`、`SKILL-cn.md`、`examples.md`、`examples-cn.md`：增加真实审计、预检、迁移和手动重试示例。
- `.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/*`：dry-run、逐本 receipt 索引和最终结果。

---

### 任务 1：通用迁移 receipt 与隔离 work root 基础

**文件：**

- 修改：`.agents/skills/generate-game-kb/scripts/lib/paths.js`
- 修改：`.agents/skills/generate-game-kb/scripts/lib/install.js`
- 修改测试：`.agents/skills/generate-game-kb/tests/install-v4.test.js`
- 新增测试可并入：`.agents/skills/generate-game-kb/tests/legacy-migration.test.js`

**接口：**

- `pathsFor(novelDir, runId, options = {})`
  - `options.workRoot?: string`
  - 新增返回字段 `migrationReceipt: path.join(run, 'reports', 'migration-receipt.json')`
- `deferredPathsFor()` 同样返回 `migrationReceipt`。
- `publishedMigrationReceipt(novelDir, runId)`：内部 helper，优先通用 receipt，缺失时回退 `chapterImportReceipt`。

- [x] **步骤 1：写 workRoot 和 receipt 路径失败测试**

```js
test('pathsFor keeps the real novel identity while placing a run under an isolated work root', () => {
  const paths = pathsFor('C:/repo/金庸/书剑恩仇录', 'migration-1', {
    workRoot: 'C:/repo/.game-kb-migration-staging/金庸/书剑恩仇录'
  });
  assert.equal(paths.novel, path.resolve('C:/repo/金庸/书剑恩仇录'));
  assert.equal(paths.run, path.resolve(
    'C:/repo/.game-kb-migration-staging/金庸/书剑恩仇录/runs/migration-1'
  ));
  assert.equal(paths.migrationReceipt, path.join(paths.run, 'reports', 'migration-receipt.json'));
});
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-migration.test.js
```

预期：FAIL，现有 `pathsFor()` 忽略 `workRoot`，且没有 `migrationReceipt`。

- [x] **步骤 3：实现可选 workRoot，不改变现有调用行为**

核心实现形状：

```js
function pathsFor(novelDir, runId, options = {}) {
  const novel = path.resolve(novelDir);
  const work = options.workRoot
    ? path.resolve(options.workRoot)
    : path.join(novel, '.game-kb-work');
  // existing fields remain unchanged
  return {
    // existing fields
    migrationReceipt: path.join(run, 'reports', 'migration-receipt.json'),
    chapterImportReceipt: path.join(run, 'reports', 'chapter-import-receipt.json')
  };
}
```

- [x] **步骤 4：写安装收据通用/兼容回退测试**

覆盖三种情况：只有 `migration-receipt.json` 时通过；只有旧 `chapter-import-receipt.json` 时继续通过；receipt hash 不匹配时报现有 `INSTALL_RECEIPT_*` blocking error。

- [x] **步骤 5：运行安装测试确认新增测试失败**

运行：

```powershell
node --test .agents/skills/generate-game-kb/tests/install-v4.test.js
```

预期：新增通用 receipt 用例 FAIL；原有 chapter import 用例仍 PASS。

- [x] **步骤 6：实现通用 receipt 查找并运行测试**

```js
function publishedMigrationReceipt(novelDir, runId) {
  return publishedRunArtifact(novelDir, runId, 'migrationReceipt')
    || publishedRunArtifact(novelDir, runId, 'chapterImportReceipt');
}
```

运行：

```powershell
node --test .agents/skills/generate-game-kb/tests/install-v4.test.js .agents/skills/generate-game-kb/tests/install.test.js .agents/skills/generate-game-kb/tests/legacy-migration.test.js
```

预期：全部 PASS，0 fail。

- [x] **步骤 7：提交基础合同**

```powershell
git add .agents/skills/generate-game-kb/scripts/lib/paths.js .agents/skills/generate-game-kb/scripts/lib/install.js .agents/skills/generate-game-kb/tests/install-v4.test.js .agents/skills/generate-game-kb/tests/legacy-migration.test.js
git commit -m "feat(game-kb): add generic migration receipt paths"
```

---

### 任务 2：旧 JSON 纯映射与稳定 ID

**文件：**

- 新建：`.agents/skills/generate-game-kb/scripts/lib/legacy-map.js`
- 新建：`.agents/skills/generate-game-kb/tests/legacy-map.test.js`
- 复用：`.agents/skills/generate-game-kb/scripts/lib/ids.js`
- 复用：`.agents/skills/generate-game-kb/scripts/lib/finalize.js`

**接口：**

```ts
mapLegacyBook(input: LegacyFileSet): {
  book: { characters, skills, items, factions, chapter_summaries },
  priorRegistry: Record<string, Array<RegistryRow>>,
  rejected: RejectedRecord[],
  unresolved: UnresolvedReference[]
}
mapLegacyItemType(value: unknown): string | null
mergeLegacyDescription(parts: Array<[label: string, value: unknown]>): string | null
```

- [x] **步骤 1：写完整字段映射失败测试**

fixture 同时包含 `alias/aliases`、`identity`、`importance`、`biography/bio/description`、人物 `items`、技能 `holders`、物品 `owner`、门派 `members`。断言：

```js
assert.deepEqual(character.aliases, ['阿飞', '飞剑客']);
assert.deepEqual(character.identities, ['江湖人士']);
assert.equal(character.level, '重要');
assert.equal(character.rank, null);
assert.equal('items' in character, false);
assert.equal('holders' in skill, false);
assert.equal('owner' in item, false);
assert.equal('members' in faction, false);
```

- [x] **步骤 2：运行测试确认模块不存在**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-map.test.js
```

预期：FAIL，`legacy-map.js` 不存在。

- [x] **步骤 3：实现固定映射表与文本合并**

```js
const ITEM_TYPE_RULES = Object.freeze([
  [/秘籍|经书|秘笈/, '秘籍'],
  [/丹|药|毒/, '丹药'],
  [/暗器|飞刀|毒针/, '暗器'],
  [/甲|衣|袍|盔|护具|防具/, '防具'],
  [/剑|刀|枪|棍|棒|鞭|兵器|武器/, '武器']
]);

function mapLegacyItemType(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text === '未知') return null;
  return ITEM_TYPE_RULES.find(([pattern]) => pattern.test(text))?.[1] || '其他';
}
```

描述只连接非空、非占位、去重后的旧文本；使用固定标签和固定顺序，禁止生成新句子。

人物映射必须显式调用：

```js
description: mergeLegacyDescription([
  ['简介', record.description],
  ['生平', record.biography || record.bio],
  ['性格', record.personality],
  ['概述', record.one_line]
])
```

- [x] **步骤 4：实现旧 ID registry 与冲突测试**

测试两个中文名称产生相同拼音基础 ID，以及两个同名但证据不同的实体。调用现有 `assignStableIds()` 后断言 ID 唯一、重复运行字节相同、同名未合并。合法且无冲突的 `char_*` 旧 ID 通过 `priorRegistry` 保留。

- [x] **步骤 5：验证 mapper 输出能进入现有 final builder**

```js
const mapped = mapLegacyBook(fixture);
const result = buildFinalData(mapped.book, manifest, mapped.priorRegistry);
assert.deepEqual(result.issues, []);
assert.deepEqual(Object.keys(result.data).sort(), [
  'chapter_summaries.yaml', 'characters.yaml', 'factions.yaml', 'items.yaml', 'skills.yaml'
]);
```

- [x] **步骤 6：运行 mapper 与 semantic contract 测试**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-map.test.js .agents/skills/generate-game-kb/tests/semantic-contract.test.js .agents/skills/generate-game-kb/tests/finalize.test.js
```

预期：全部 PASS，0 fail。

- [x] **步骤 7：提交纯映射器**

```powershell
git add .agents/skills/generate-game-kb/scripts/lib/legacy-map.js .agents/skills/generate-game-kb/tests/legacy-map.test.js
git commit -m "feat(game-kb): map legacy JSON into V6 records"
```

---

### 任务 3：权威旧来源选择与证据预检

**文件：**

- 新建：`.agents/skills/generate-game-kb/scripts/lib/legacy-source.js`
- 新建：`.agents/skills/generate-game-kb/scripts/lib/legacy-evidence.js`
- 新建：`.agents/skills/generate-game-kb/tests/legacy-source.test.js`
- 新建：`.agents/skills/generate-game-kb/tests/legacy-evidence.test.js`
- 复用：`.agents/skills/generate-game-kb/scripts/lib/grounding.js`
- 复用：`.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`

**接口：**

```ts
resolveLegacySource(novelDir, { explicitDataRoot? }): LegacySourcePlan
loadLegacyFileSet(plan): LegacyFileSet
loadExistingChapterInventory(novelDir): ChapterInventory
rebuildLegacyEvidence(mapped, chapters): {
  acceptedChapters, candidateRegistry, rejected, unresolved
}
```

- [x] **步骤 1：写来源优先级和完整性失败测试**

构造中文临时目录，分别放置：不完整活动 `data`、完整 `.game-kb-work/runs/migration-run-1/final/data`、完整 archive final。断言选择 retained run；活动数据完整时选择活动数据；`--from` 显式路径只有通过安全边界和解析检查才覆盖自动选择。

- [x] **步骤 2：运行来源测试确认失败**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-source.test.js
```

预期：FAIL，来源 resolver 不存在。

- [x] **步骤 3：实现有界发现与稳定错误码**

只扫描以下位置，不递归遍历整个仓库：

```js
const roots = [
  path.join(novel, 'data'),
  ...runFinalDataRoots(path.join(novel, '.game-kb-work', 'runs')),
  ...archiveFinalDataRoots(path.join(novel, '_archive'))
];
```

每个候选拒绝符号链接逃逸，逐文件解析 JSON，并返回 `LEGACY_SOURCE_NOT_FOUND`、`LEGACY_JSON_INVALID`、`LEGACY_SOURCE_OUTSIDE_NOVEL` 等稳定错误码。

- [x] **步骤 4：写证据验证和章节覆盖失败测试**

覆盖 `chapter+text`、`chapter+line_start+line_end+text`、`chapter+anchor+text`；断言可验证引用保留，全部失效的实体进入 `rejected`。章节摘要无 refs 但章节号完整时允许绑定章节 hash；缺失、重复或越界时返回 `LEGACY_SUMMARY_COVERAGE_INVALID`。

- [x] **步骤 5：实现证据重建**

对每条实体引用调用现有：

```js
const result = validateGroundedRecord(record, {
  chapterNumber: chapter.number,
  chapterText: chapter.text,
  label: `${category}:${record.id || record.name}`
});
```

保留 `normalizedRefs`，将实体投影到涉及的 accepted chapter；随后调用 `buildCandidateRegistry(acceptedChapters)`。不得在无证据情况下创建实体。

- [x] **步骤 6：运行来源、证据、grounding 测试**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-source.test.js .agents/skills/generate-game-kb/tests/legacy-evidence.test.js .agents/skills/generate-game-kb/tests/grounding.test.js .agents/skills/generate-game-kb/tests/candidate-registry.test.js
```

预期：全部 PASS，0 fail。

- [x] **步骤 7：提交来源与证据层**

```powershell
git add .agents/skills/generate-game-kb/scripts/lib/legacy-source.js .agents/skills/generate-game-kb/scripts/lib/legacy-evidence.js .agents/skills/generate-game-kb/tests/legacy-source.test.js .agents/skills/generate-game-kb/tests/legacy-evidence.test.js
git commit -m "feat(game-kb): rebuild V6 evidence from legacy finals"
```

---

### 任务 4：构建并验证隔离候选 run

**文件：**

- 新建：`.agents/skills/generate-game-kb/scripts/lib/legacy-migration.js`
- 扩展：`.agents/skills/generate-game-kb/tests/legacy-migration.test.js`
- 复用：`candidate-registry.js`、`domain-work.js`、`domain-contract.js`、`finalize.js`、`verify.js`、`io.js`

**接口：**

```ts
planLegacyMigration(novelDir, options): MigrationPlan
buildLegacyCandidate(plan, { stagingRoot, runId, faultAt? }): CandidateResult
writeMigrationReceipt(paths, receipt): string
```

- [x] **步骤 1：写真实旧 JSON fixture 到 V6 candidate 的失败集成测试**

fixture 包含两个章节、五类旧 JSON、一个无证据人物、一个 unresolved faction。断言候选拥有：

```js
assert.deepEqual(fs.readdirSync(paths.finalData).sort(), DATA_FILES);
assert.equal(verifyFinal(paths, { profile: 'v4' }).passed, true);
assert.equal(receipt.counts.rejected.characters, 1);
assert.equal(receipt.unresolved_references.length, 1);
```

- [x] **步骤 2：运行测试确认失败**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-migration.test.js
```

预期：FAIL，候选 builder 不存在。

- [x] **步骤 3：写完整 staged run 元数据与 accepted artifacts**

使用 `pathsFor(novelDir, runId, { workRoot })`，写入 `run.json`、`manifest.json`、源快照/章节副本、accepted chapter YAML、candidate registry。`run.json` 使用 `profile: 'v4'`、`semantic_contract_version: 6`，并增加 `operation: 'legacy-json-to-v6'`。

候选 builder 按以下固定组合调用前置接口：

```js
const sourcePlan = resolveLegacySource(novelDir, {
  explicitDataRoot: options.explicitDataRoot
});
const legacy = loadLegacyFileSet(sourcePlan);
const chapters = loadExistingChapterInventory(novelDir);
const mapped = mapLegacyBook(legacy);
const evidence = rebuildLegacyEvidence(mapped, chapters);
```

- [x] **步骤 4：用现有 domain contract 构造四个 accepted decisions**

对 `factions/characters/skills/items` 分别调用 `createDomainWorkPlan()` 获取 entry refs 与 input hash；每条 retained record 生成 `action: 'accept'` 和仅含该域允许字段的 patch，再调用 `normalizeDomainDecisionDraft()`，不能直接写未经合同校验的 YAML。

- [x] **步骤 5：用现有 final builder 和 verifier 生成候选**

```js
const finalResult = buildFinalData(mergedBook, manifest, mapped.priorRegistry);
if (finalResult.issues.length) throw migrationError('MIGRATION_FINAL_INVALID', finalResult.issues);
writeFinalDataAtomic(paths, finalResult);
const verification = verifyFinal(paths, { profile: 'v4' });
if (!verification.passed) throw migrationError('MIGRATION_CANDIDATE_INVALID', verification.blocking_errors);
```

- [x] **步骤 6：写 receipt 哈希与可重复性测试**

连续两次以相同 run ID 之外的等价 staging 构建候选，断言五个 YAML、ID plan 和 rejection/unresolved 清单哈希一致；时间字段不进入内容哈希。

候选验证通过后调用 `writeMigrationReceipt(paths, receipt)`；返回值是 receipt 的 SHA-256，后续直接传给 installer，不允许再次手工计算不同规范的哈希。

- [x] **步骤 7：运行候选相关测试**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-migration.test.js .agents/skills/generate-game-kb/tests/domain-contract.test.js .agents/skills/generate-game-kb/tests/domain-assembly.test.js .agents/skills/generate-game-kb/tests/verify-v4.test.js
```

预期：全部 PASS，0 fail。

- [x] **步骤 8：提交候选 builder**

```powershell
git add .agents/skills/generate-game-kb/scripts/lib/legacy-migration.js .agents/skills/generate-game-kb/tests/legacy-migration.test.js
git commit -m "feat(game-kb): build verified V6 migration candidates"
```

---

### 任务 5：失败即归档事务、仓库审计 CLI 与命令文档

**文件：**

- 扩展：`.agents/skills/generate-game-kb/scripts/lib/legacy-migration.js`
- 新建：`.agents/skills/generate-game-kb/scripts/lib/repository-audit.js`
- 新建：`.agents/skills/generate-game-kb/scripts/audit-v6.js`
- 修改：`.agents/skills/generate-game-kb/scripts/flow.js`
- 新建：`.agents/skills/generate-game-kb/tests/repository-audit.test.js`
- 扩展：`.agents/skills/generate-game-kb/tests/legacy-migration.test.js`
- 修改：`.agents/skills/generate-game-kb/tests/cli.test.js`
- 修改：`.agents/skills/generate-game-kb/SKILL.md`
- 修改：`.agents/skills/generate-game-kb/SKILL-cn.md`
- 修改：`.agents/skills/generate-game-kb/examples.md`
- 修改：`.agents/skills/generate-game-kb/examples-cn.md`

**接口：**

```ts
executeLegacyMigration(plan, { confirm, stagingRoot, runId, faultAt? }): MigrationResult
auditRepository(repoRoot): RepositoryAudit
writeAuditReports(audit, outputDir): { jsonPath, markdownPath }
```

- [x] **步骤 1：写只读默认和显式确认失败测试**

不带 `--confirm` 调用 `migrate-legacy` 时输出 plan，且递归文件哈希前后完全相同；尝试执行 mutation helper 时没有 confirm 返回 `MIGRATION_CONFIRM_REQUIRED`。

- [x] **步骤 2：写事务故障矩阵测试**

分别注入：`after-candidate-write`、`after-archive`、`after-run-promote`、`after-install`。每个 confirm 用例断言：

```js
assert.equal(fs.existsSync(path.join(novel, 'data')), false);
assert.equal(findArchiveManifest(novel).status, 'archived');
assert.equal(report.status, 'archived_after_migration_failure');
```

候选完全成功时断言 `verifyInstalled(novel).passed === true`。单独保留 `archiveExisting()` 自身移动失败回滚语义：若归档根本未成功，事务报告必须明确 `archive_failed`，不能谎报已归档。

- [x] **步骤 3：实现事务状态机**

状态只允许：

```js
const STATES = Object.freeze([
  'planned', 'candidate_verified', 'legacy_archived', 'run_promoted',
  'installed', 'verified', 'archived_after_migration_failure', 'archive_failed'
]);
```

候选构建失败时调用 `archiveExisting()`；归档后失败时删除/再次归档部分活动 V6，保留旧 archive，不恢复旧 JSON。所有 catch 分支写稳定错误码和可重试命令。

- [x] **步骤 4：写仓库审计测试与实现**

fixture 包含：合格 V6、旧 JSON、普通书籍目录、损坏 data。断言分类互斥、排序稳定、审计不修改文件。`audit-v6.js` 只接受 repo root 和 output dir；默认 stdout 只输出报告路径与计数。

CLI 入口只组合导出接口：

```js
const audit = auditRepository(repoRoot);
const written = writeAuditReports(audit, outputDir);
process.stdout.write(JSON.stringify({ ...written, counts: audit.counts }) + '\n');
```

- [x] **步骤 5：接入 flow CLI**

```js
if (command === 'migrate-legacy') {
  const plan = planLegacyMigration(novelDir, {
    explicitDataRoot: flagValue(args, '--from')
  });
  const confirmed = args.includes('--confirm');
  return confirmed
    ? executeLegacyMigration(plan, {
        confirm: true,
        runId: flagValue(args, '--run'),
        stagingRoot: flagValue(args, '--staging-root')
      })
    : plan;
}
```

要求 `--run`；mutation 模式同时要求 `--staging-root` 和 `--confirm`。禁止隐式选择仓库外 staging。

- [x] **步骤 6：更新中英文命令示例**

写入《书剑恩仇录》的 audit、dry-run、confirm 和同命令手动重试示例；写明 unit 不适用于本命令、失败后旧数据只在 `_archive`，以及中文路径无需改名。

- [x] **步骤 7：运行 CLI、事务、归档和技能合同测试**

```powershell
node --test .agents/skills/generate-game-kb/tests/legacy-migration.test.js .agents/skills/generate-game-kb/tests/repository-audit.test.js .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/tests/archive.test.js .agents/skills/generate-game-kb/tests/skill-contract.test.js .agents/skills/generate-game-kb/tests/cn-skill-contract.test.js
```

预期：全部 PASS，0 fail。

- [x] **步骤 8：提交迁移事务和命令**

```powershell
git add .agents/skills/generate-game-kb/scripts/lib/legacy-migration.js .agents/skills/generate-game-kb/scripts/lib/repository-audit.js .agents/skills/generate-game-kb/scripts/audit-v6.js .agents/skills/generate-game-kb/scripts/flow.js .agents/skills/generate-game-kb/tests/legacy-migration.test.js .agents/skills/generate-game-kb/tests/repository-audit.test.js .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/SKILL.md .agents/skills/generate-game-kb/SKILL-cn.md .agents/skills/generate-game-kb/examples.md .agents/skills/generate-game-kb/examples-cn.md
git commit -m "feat(game-kb): migrate and audit legacy V6 data"
```

---

### 任务 6：全测试与真实仓库 dry-run 审计

**文件：**

- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/initial-audit.json`
- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/initial-audit.md`
- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/migration-plan.json`

- [x] **步骤 1：运行 generate-game-kb 全测试集**

```powershell
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

预期：0 fail；任何既有失败必须先分类为本任务回归或独立基线问题，不能跳过。

- [x] **步骤 2：记录《剑神一笑》保护哈希**

对其五个 YAML、安装收据和已发布 run 工件生成保护哈希清单，写入 initial audit。该清单用于实际迁移后的字节不变断言。

- [x] **步骤 3：执行真实仓库只读审计**

```powershell
node .agents/skills/generate-game-kb/scripts/audit-v6.js "C:\git\wuxia-novel" --output ".trellis\tasks\07-19-audit-v6-knowledge-bases\reports"
```

预期初始分类：18 个活动 data，`古龙/剑神一笑` 合格，其余 17 个进入迁移预检或不可迁移；命令不得产生书籍目录改动。

- [x] **步骤 4：逐本执行不带 confirm 的 migration plan**

使用审计器选择的明确 `--from` 路径和稳定 run ID。收集预计输入/输出/剔除数、unresolved references 和 blocking errors；不创建活动 data 或 archive。

- [x] **步骤 5：人工/程序化检查计划不变量**

断言：没有提取命令、没有模型字段、所有旧来源路径处于对应书籍目录、所有无证据记录出现在拒绝列表、章节摘要覆盖完整、所有计划使用 semantic contract 6。

- [x] **步骤 6：提交 dry-run 报告**

```powershell
git add .trellis/tasks/07-19-audit-v6-knowledge-bases/reports
git commit -m "docs(game-kb): record legacy V6 migration audit"
```

---

### 任务 7：逐本迁移、失败归档与最终 V6 清单

**文件：**

- 修改：migration plan 中每本可迁移书籍目录下的 `data/*.yaml`
- 生成：各书 `.game-kb-work`/`_archive` 中的 run、receipt 与 manifest（仅提交未被仓库 ignore 且属于本任务的工件）
- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/final-audit.json`
- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/final-audit.md`
- 生成：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/migration-results.json`

- [x] **步骤 1：逐本执行已审核计划**

每本使用显式 novel path、`--from`、`--run`、`--staging-root` 和 `--confirm`。一次只处理一本；命令退出后立即读取该书 receipt，再继续下一本。不要把 17 本拼成一个不可恢复的 shell 命令。

- [x] **步骤 2：每本立即执行 installed verify**

首本《书剑恩仇录》的即时验证命令为：

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\金庸\书剑恩仇录" --installed --json
```

其余书籍必须使用该书 migration plan 中已经写明的绝对 `novel_dir`，不能由代理猜测路径。

迁移成功必须 `passed: true`；失败书必须没有活动 `data`，且 migration result 指向有效 archive manifest。

- [x] **步骤 3：生成最终仓库审计**

再次运行 `audit-v6.js`。断言所有剩余活动 `data` 通过 V6 installed verification，不存在旧 JSON 活动文件集。

- [x] **步骤 4：验证《剑神一笑》字节不变**

重新计算保护哈希并与 initial audit 比较；任何差异都是 blocking failure，必须先定位，不能提交。

- [x] **步骤 5：验证小说与用户文件未变**

比较任务开始时的 git status 和 source hash；本任务不得新增小说文本 diff，不得 stage `.claude/skills/*`、`docs/wuxia-kb-build-priority.md` 或其他用户目录。

- [x] **步骤 6：提交实际迁移阶段**

只 stage 迁移产生的目标 data、受控 receipts/manifests 和 task reports，先运行 `git diff --cached --check` 与 staged path allowlist，再提交：

```powershell
git commit -m "data(game-kb): migrate reusable knowledge bases to V6"
```

---

### 任务 8：最终质量门、规格沉淀与任务收尾

**文件：**

- 可能修改：`.trellis/spec/backend/*` 中最相关的 generate-game-kb 合同文档（仅当本任务形成新的长期约束）
- 更新：`.trellis/tasks/07-19-audit-v6-knowledge-bases/reports/final-audit.md`
- 更新：开发者 journal

- [x] **步骤 1：运行全部新旧测试**

```powershell
node --test .agents/skills/generate-game-kb/tests/*.test.js
```

预期：0 fail。

- [x] **步骤 2：运行 canonical final state check**

重新运行仓库审计器；它内部逐本调用 `verifyInstalled()`，最终报告只保留书名、passed 和 blocking error count。预期全部 passed，blocking error count 为 0。

- [x] **步骤 3：核对 PRD acceptance criteria**

逐条把 initial audit、migration receipt、archive manifest、final audit 和测试证据映射回 `prd.md`；任何未满足项保持任务 in_progress。

- [x] **步骤 4：执行 Trellis 质量与规格流程**

加载 `trellis-check` 完成 inline quality check；若发现应长期保留的迁移合同，再加载 `trellis-update-spec`。不得在未验证时直接宣称完成。

- [x] **步骤 5：提交最终报告与规格**

```powershell
git add .trellis/tasks/07-19-audit-v6-knowledge-bases/reports .trellis/spec .trellis/workspace
git commit -m "docs(game-kb): finish V6 knowledge base audit"
```

提交前从 staged set 移除任何与本任务无关的 spec/journal 文件。

- [x] **步骤 6：按 Trellis finish-work 归档任务**

只有代码、数据、报告、测试和 acceptance criteria 全部通过后，加载 `trellis-finish-work`，归档本任务并报告最终合格、迁移成功、失败归档书目。

## 实施前审批门

- [x] 用户已审阅 `prd.md`、`design.md` 和本 `implement.md`。
- [x] 用户明确批准执行 `task.py start`。
- [x] 任务状态从 `planning` 变为 `in_progress` 后，才能开始任务 1。
