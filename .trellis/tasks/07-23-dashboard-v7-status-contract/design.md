# Dashboard v7 状态合同同步设计

## 背景

Dashboard 的书籍状态模型最初面向 `generate-kb`：它读取 `reports/quality_report.json`，要求 `completion_gate_passed=true` 且 G1-G5 全部通过，并把旧流程的 `ch_split/`、`build/source-index.json`、`build/scan-manifest.json` 视为完成证据。

现行 `generate-game-kb` 采用语义合同 v7。安装目录只承诺五个 YAML 与三份报告：`game-kb-review.json`、`verification-report.json`、`generate_game_kb_install.json`。硬门禁由安装验证器校验 schema、引用闭环、最终数据哈希、复核报告哈希和安装回执绑定；G1-G5 与 `quality_report.json` 不属于该流程。

## 已确认的行为

- `generate-game-kb` v7 不生成也不消费 G1-G5。
- `generate-kb` 仍保留 G1-G5，因此 Dashboard 不能全局删除旧合同支持。
- v7 允许来源证据不足的实体保留最小字段。详情覆盖率小于 100% 不代表安装失败。
- `game-kb-review.json` 和安装验证器 warning 均为非阻塞信息；只有 `blocking_errors` 决定失败。

## 方案比较

### 方案 A：全局用 v7 替换 G1-G5

实现最少，但会让既有 `generate-kb` 书籍失去校验证据，破坏兼容性，拒绝。

### 方案 B：按产物自动选择合同（采用）

存在任一 v7 安装标记时，以 `generate-game-kb` 权威安装验证器为准；否则沿用旧 G1-G5 解析。该方案既修复新流程误判，又保留旧数据，且不会让失败的 v7 产物被旧报告“兜底通过”。

### 方案 C：立即抽取跨包通用验证框架

长期边界最整齐，但当前只有两个明确合同，抽象成本和迁移面过大。先用一个小型 server adapter 隔离权威验证器，未来出现第三个合同时再抽象。

## 架构边界

### 1. v7 安装验证适配器

在 `dashboard/server/` 新建专用模块，职责仅为：

- 判断书籍是否出现 v7 安装产物标记；
- 通过 Node `createRequire` 加载 `.agents/skills/generate-game-kb/scripts/lib/install.js` 的 `verifyInstalled`；
- 把 CommonJS 返回值映射为 Dashboard 稳定类型：合同种类、通过状态、阻塞项、warning、版本和 run id；
- 捕获模块加载或验证异常并返回可展示失败，不吞掉错误。

适配器不重新实现哈希、schema 或引用校验。这样 `generate-game-kb` 代码仍是唯一判断依据。

### 2. 扫描器的合同选择

`libraryScanner` 先检查 v7 标记：

1. 存在 `generate_game_kb_install.json`、`verification-report.json` 或 `game-kb-review.json` 中任一项时，进入 v7 分支。
2. v7 分支只信任安装验证器；即使目录还残留旧 `quality_report.json`，也不得回退到 G1-G5。
3. 没有 v7 标记时，维持现有 `parseQualityReport` 行为。

扫描结果新增合同来源和验证 warning，保留现有 `validationStatus` 以减少 API 破坏：

- `validationContract`: `none | generate-kb-gates | generate-game-kb-v7`
- `validationWarnings`: `string[]`

`gateFailures` 在 v7 分支承载格式化后的 `blocking_errors`，字段名暂不更换，以保持前端兼容；后续若出现第三个合同再统一重命名。

### 3. 完成与缺失产物判定

完成条件按合同分支：

- v7：五文件可浏览、权威安装验证通过、复核报告可读取且与回执一致。
- 旧流程：维持现有“可浏览、详情覆盖 complete、G1-G5 通过、复核可用”的行为。

v7 缺失产物只报告五个数据文件和三份安装报告，不再要求旧 `build/`、`ch_split/` 或 `quality_report.json`。`generationStage` 可继续使用 `data-produced`，流程是否完成由独立 `completed` 字段表达，避免扩大枚举迁移范围。

### 4. 详情覆盖率语义

现有 `hasEntityContent` 仍可用于统计“除 id/name 外是否有可展示详情”，但该统计不再参与 v7 完成判定。前端把：

- `complete` 表述为“详情齐全”；
- `partial` 表述为“部分实体仅有索引”；
- 计数表述为“详情覆盖 X/Y”。

它是内容丰富度指标，不是校验结果，也不触发补救动作。

### 5. 状态文案与建议动作

校验标签必须同时考虑 `validationStatus` 与 `validationContract`：

- v7 passed：`v7 安装验证通过`
- 旧流程 passed：`G1-G5 通过`
- failed：`校验失败`
- none：`未校验`

v7 失败时建议动作改为调用 `generate-game-kb/scripts/flow.js status <novel>`；旧流程继续使用 `assess-quality.js`。v7 已通过但含 warning 时不产生补救动作，只展示提示。

## 数据流

`scanLibrary` 读取书籍目录后，先完成 YAML 可浏览检查，再选择验证合同。v7 适配器读取并复验安装目录，旧分支解析质量报告。扫描器合并内容覆盖、复核摘要和验证结果，API 返回新增的合同来源与 warning；前端据此渲染精确标签和详情。

## 错误处理

- v7 标记存在但回执缺失、JSON 损坏、哈希不一致或验证器异常：明确判为 failed，不能回退旧合同。
- v7 `blocking_errors=[]` 且存在 warning：保持 passed。
- 权威验证模块无法加载：返回 `V7_VERIFIER_UNAVAILABLE`，并将模块错误摘要放入阻塞项。
- 旧流程行为保持原样，避免本次修复顺带改变历史书籍状态。

## 测试设计

按 TDD 分三层推进：

1. server adapter 单元测试覆盖 v7 通过、哈希损坏、warning 和缺失回执。
2. scanner 测试证明 v7 partial 仍完成、不报告旧产物缺失、不会被残留 G1-G5 报告覆盖；旧 fixture 继续通过原测试。
3. presentation/action 测试覆盖合同感知标签、详情覆盖文案和 v7 `flow.js status` 建议动作。

最终运行 Dashboard 定向测试、完整测试、lint、TypeScript 构建与生产构建，并用仓库中七本 v7 作品做只读扫描验收。

## 回滚

本变更只修改 Dashboard 读取与展示逻辑，不写小说数据。回滚代码即可恢复旧行为，不涉及数据迁移。
