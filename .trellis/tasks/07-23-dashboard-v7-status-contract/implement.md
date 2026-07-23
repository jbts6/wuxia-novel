# Dashboard v7 状态合同同步实施计划

**Goal:** 让 Dashboard 自动选择 `generate-game-kb` v7 安装验证或旧 `generate-kb` G1-G5 合同，并把详情覆盖率从 v7 完成门禁中解耦。

**Architecture:** 新建 server adapter，直接调用 `generate-game-kb` 的权威 `verifyInstalled`，将其结果投影为 Dashboard 类型；`libraryScanner` 只负责合同选择和状态合并。旧 G1-G5 分支保留，前端根据合同来源显示精确文案。

**Tech Stack:** TypeScript、Node.js、Vite、React、Vitest、Testing Library、现有 CommonJS `generate-game-kb` 验证器。

**Execution Mode:** Codex inline。不得派发 implement/check 子代理；每个任务严格执行 RED → GREEN → REFACTOR，并形成独立本地提交。

## Global Constraints

- `generate-game-kb` 的 `verifyInstalled` 是 v7 安装状态唯一真源；Dashboard 不复制哈希或 schema 规则。
- 任何 `generate-game-kb` 标记存在时不得回退旧 G1-G5；回执版本决定 v7 或 legacy 投影。
- v7 warning 非阻塞；只有 `blocking_errors` 使校验失败。
- v7 `completed` 不依赖 `contentCoverage.state`；旧流程完成条件保持原样。
- 不修改小说目录中的数据和报告，不引入第三方依赖。
- 所有新增公共 server 函数使用明确返回类型；异常必须映射为可展示失败，不能静默吞掉。
- 生产文件保持职责单一；不继续扩大已超过 400 行的 `libraryScanner.ts`，新合同逻辑放入独立模块。

---

### Task 1: 建立权威 v7 安装验证适配器

**Files:**

- Create: `dashboard/server/gameKbValidation.ts`
- Create: `dashboard/server/gameKbValidation.test.ts`
- Create: `dashboard/server/testSupport/gameKbV7Fixture.ts`
- Modify: `dashboard/src/types/library.ts`

**Interfaces:**

- Produce `ValidationContract = 'none' | 'generate-kb-gates' | 'generate-game-kb-legacy' | 'generate-game-kb-v7'`。
- Produce `inspectInstalledGameKb(bookDirectory: string): InstalledGameKbValidation | null`。
- `InstalledGameKbValidation` 包含 `status`、`semanticContractVersion`、`runId`、`blockingErrors`、`warnings`。
- Test fixture `writeInstalledV7Fixture(bookDirectory, options?)` 写入临时目录中的五个 v7 YAML、两份报告和安装回执；它使用权威 `verifyDataRoot` 计算 `final_data_hash`，不伪造固定哈希。

- [x] **Step 1: 写 v7 fixture 与适配器失败用例**

  覆盖以下行为：

  - 无 `generate-game-kb` 标记返回 `null`；
  - 完整 fixture 返回 `status='passed'` 和 `contract='generate-game-kb-v7'`；
  - 修改已安装 YAML 字节后返回 `failed`，包含 `INSTALL_DATA_FILE_HASH_MISMATCH`；
  - 缺失回执但存在 `verification-report.json` 时返回 `failed`，不能返回 `null`；
  - `id_plan_hash` 缺失产生 warning，但状态仍为 passed。

- [x] **Step 2: 运行定向测试，确认 RED**

  Run: `npm test -- server/gameKbValidation.test.ts`

  Expected: FAIL，原因是 `gameKbValidation.ts`、类型和 fixture 尚不存在，而不是测试语法错误。

- [x] **Step 3: 实现最小适配器**

  - 用 `createRequire(import.meta.url)` 加载仓库内 `.agents/skills/generate-game-kb/scripts/lib/install.js`。
  - 管线标记固定为三份报告路径；检测任一存在即进入 `generate-game-kb` 分支，再按回执版本投影 v7 或 legacy。
  - 将 `unknown` issue 格式化为稳定字符串，至少保留 `code`、`path` 和 `target`。
  - 模块加载或调用异常映射为 `V7_VERIFIER_UNAVAILABLE` 阻塞项。
  - 在 `LibraryBookStatus` 增加 `validationContract` 与 `validationWarnings`；在 `ArtifactState` 增加三份 v7 报告布尔值。

- [x] **Step 4: 运行定向测试，确认 GREEN**

  Run: `npm test -- server/gameKbValidation.test.ts`

  Expected: PASS，0 failed。

- [x] **Step 5: 运行类型检查并提交**

  Run: `npm run build`

  Commit: `feat(dashboard): 接入 v7 安装验证器`

---

### Task 2: 让扫描器按合同选择完成与缺失产物规则

**Files:**

- Modify: `dashboard/server/libraryScanner.test.ts`
- Modify: `dashboard/server/libraryScanner.ts`
- Modify: `dashboard/server/scanCache.test.ts`

**Interfaces:**

- Consume `inspectInstalledGameKb`。
- Populate `validationContract`、`validationWarnings`、v7 artifact flags。
- Populate 安装回执 `run_id` 为 `validationRunId`，供无歧义状态诊断使用。
- Preserve existing `parseQualityReport` as legacy fallback only。

- [x] **Step 1: 写扫描器失败用例**

  使用 `writeInstalledV7Fixture` 覆盖：

  - v7 index-only/partial 数据在权威验证通过时 `completed=true`；
  - v7 状态为 passed，`schemaVersion='7'`，review current；
  - v7 `missingArtifacts` 不含 `ch_split/`、旧 `build/` 或 `quality_report.json`；
  - v7 哈希损坏时 `validationStatus='failed'` 且 `completed=false`；
  - v7 目录即使残留通过的 `quality_report.json`，也不能掩盖 v7 失败；
  - 原 G1-G5 通过、失败、legacy-unproven 用例保持行为不变。

- [x] **Step 2: 运行定向测试，确认 RED**

  Run: `npm test -- server/libraryScanner.test.ts server/scanCache.test.ts`

  Expected: 新增 v7 断言 FAIL，旧测试仍能运行。

- [x] **Step 3: 实现合同选择和完成规则**

  - 在 `scanBook` 中先检查 v7 adapter，再计算 legacy quality。
  - v7 分支以 adapter status 赋值 `validationStatus`，将阻塞项投影到 `gateFailures`，warning 投影到 `validationWarnings`。
  - v7 完成条件为 `browseable && validationStatus === 'passed' && review.completionReady`。
  - legacy 完成条件保留现有 `contentCoverage.state === 'complete'` 与 G1-G5。
  - v7 缺失列表只追加三份安装报告；legacy 继续追加旧构建产物。
  - `maxObservedMtime` 纳入 `verification-report.json`。
  - v7 schema 取 `semantic_contract_version`，legacy schema 继续取 manifest。

- [x] **Step 4: 运行定向测试，确认 GREEN**

  Run: `npm test -- server/libraryScanner.test.ts server/scanCache.test.ts`

  Expected: PASS，0 failed。

- [x] **Step 5: 重构重复 fixture 字段并提交**

  只抽取真实重复，不改变旧 fixture 语义。

  Commit: `fix(dashboard): 按产物合同判定书籍状态`

---

### Task 3: 同步建议动作与 API 执行路径

**Files:**

- Modify: `dashboard/server/actionConfig.test.ts`
- Modify: `dashboard/server/actionConfig.ts`
- Modify: `dashboard/server/libraryApiPlugin.test.ts`
- Modify: `dashboard/server/libraryApiPlugin.ts`

**Interfaces:**

- Extend `ActionConfig` with explicit `scriptRoot` and `prefixArgs`。
- Produce v7 command: `node '.agents/skills/generate-game-kb/scripts/flow.js' status '<book>' --run '<install-run-id>'`。
- Legacy commands keep `.agents/skills/generate-kb/scripts` and current argument order。

- [x] **Step 1: 写动作失败用例**

  - v7 failed 选择 `game-kb-status`，命令包含 `flow.js status`；
  - v7 passed + partial 返回 null，不选择 `fill-content`；
  - legacy failed 仍选择 `assess-quality`；
  - API 执行 v7 action 时脚本根目录、`status` 与 `--run` 参数顺序正确；
  - 非白名单 action 继续返回 400。

- [x] **Step 2: 运行定向测试，确认 RED**

  Run: `npm test -- server/actionConfig.test.ts server/libraryApiPlugin.test.ts`

  Expected: v7 action 用例 FAIL。

- [x] **Step 3: 实现合同感知动作**

  - `assess-quality` 与 `fill-content` 排除 `generate-game-kb-v7`。
  - 新增 `game-kb-status`，只在 v7 非 passed 时触发。
  - `buildSuggestedAction` 与 API executor 共用 `scriptRoot`、`prefixArgs`、`extraArgs`，避免展示命令和实际执行分叉。

- [x] **Step 4: 运行定向测试，确认 GREEN 并提交**

  Run: `npm test -- server/actionConfig.test.ts server/libraryApiPlugin.test.ts`

  Expected: PASS，0 failed。

  Commit: `fix(dashboard): 更新 v7 状态诊断动作`

---

### Task 4: 同步前端校验和详情覆盖文案

**Files:**

- Create: `dashboard/src/lib/libraryStatusPresentation.test.ts`
- Modify: `dashboard/src/lib/libraryStatusPresentation.ts`
- Modify: `dashboard/src/pages/Library.test.tsx`
- Modify: `dashboard/src/pages/Library.tsx`
- Modify: `dashboard/src/components/library/LibraryCard.tsx`
- Modify: 其他构造 `LibraryBookStatus` 的测试 fixture，仅补充新增必填字段

**Interfaces:**

- Produce `validationStatusText(book: LibraryBookStatus): string`。
- Produce `contentCoverageText(coverage: ContentCoverage): string`。
- Labels: v7 passed=`v7 安装验证通过`，legacy passed=`G1-G5 通过`。

- [x] **Step 1: 写 presentation 和页面失败用例**

  - v7 passed 与 legacy passed 使用不同标签；
  - partial 文案包含“详情覆盖”，不出现“内容待补全”或“内容完整”；
  - v7 validation warning 在详情面板可见，但 badge 仍为通过；
  - 完成筛选能包含 v7 partial 书籍；
  - 详情覆盖筛选仍可按 partial/index-only 过滤，但名称改为“详情未覆盖”。

- [x] **Step 2: 运行定向测试，确认 RED**

  Run: `npm test -- src/lib/libraryStatusPresentation.test.ts src/pages/Library.test.tsx`

  Expected: 新文案和 warning 断言 FAIL。

- [x] **Step 3: 集中 presentation 逻辑并更新 UI**

  - `Library.tsx` 与 `LibraryCard.tsx` 复用 presentation helper，不再各自硬编码状态文案。
  - 表头改为“详情覆盖”，摘要和筛选改为“详情未覆盖”。
  - detail panel 使用“实体详情”“详情覆盖 X/Y”。
  - validation warning 与 review warning 分开展示，避免混淆硬门禁和内容复核。

- [x] **Step 4: 运行定向测试，确认 GREEN**

  Run: `npm test -- src/lib/libraryStatusPresentation.test.ts src/pages/Library.test.tsx`

  Expected: PASS，0 failed。

- [x] **Step 5: 运行前端相关测试并提交**

  Run: `npm test -- src`

  Commit: `fix(dashboard): 更新 v7 校验与详情覆盖展示`

---

### Task 5: 同步规范并完成全量验收

**Files:**

- Modify: `.trellis/spec/backend/library-status-api.md`
- Modify: `.trellis/spec/frontend/global-library-browser.md`
- Modify: `.trellis/tasks/07-23-dashboard-v7-status-contract/implement.md`（勾选实际完成项）

- [x] **Step 1: 更新跨层合同规范**

  记录双合同选择优先级、v7 权威验证器、`validationContract`、warning 语义、v7 完成规则和详情覆盖率的非门禁性质；保留旧 G1-G5 兼容说明。

- [x] **Step 2: 运行完整 Dashboard 验证**

  Run: `npm test`

  Expected: 全部测试 PASS，0 failed。

  Run: `npm run lint`

  Expected: exit 0，无 ESLint error。

  Run: `npm run build`

  Expected: TypeScript 与 Vite production build exit 0。

- [x] **Step 3: 对仓库七本 v7 作品做只读扫描验收**

  通过 Vite SSR 加载 `scanLibrary`，筛选大沙漠、画眉鸟、桃花传奇、新月传奇、午夜兰花、蝙蝠传奇、剑神一笑，断言：

  - `validationContract='generate-game-kb-v7'`；
  - `validationStatus='passed'`；
  - `completed=true`；
  - `review.status='current'`；
  - 无旧 `build/` 或 `quality_report.json` 缺失提示。

- [x] **Step 4: 检查变更范围和敏感信息**

  Run: `git diff --check`

  检查所有改动只涉及本任务列出的 Dashboard、Trellis 规范和任务文件；不得纳入 `.workbuddy/` 或其他未跟踪任务。

- [x] **Step 5: 提交规范与验收证据**

  Commit: `docs(dashboard): 同步 v7 状态合同规范`

## Rollback Points

- Task 1 仅增加 adapter/types，可独立回退。
- Task 2 是状态语义切换的核心提交；回退它即可恢复旧扫描器行为。
- Task 3、Task 4 分别只影响动作与展示，可独立回退。
- 无数据迁移、无小说产物写入，任何回滚都不需要恢复数据。
