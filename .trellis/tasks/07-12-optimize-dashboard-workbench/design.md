# Dashboard 知识库工作台技术设计

## 1. 设计目标

在不接管知识库生成流程的前提下，把 Dashboard 改造成固定桌面端的只读工作台：扫描仓库内书籍产物，推导生成、校验和可浏览状态，并让已有完整知识库继续按需浏览。

本设计分两阶段交付。第一阶段建立单一书目、状态扫描和稳定的数据加载边界；第二阶段在该边界上增加跨书搜索和大数据量浏览能力。两个阶段共享同一数据契约，因此保留在一个 Trellis 任务中，但在实施计划中设置独立验收门。

## 2. 当前约束与问题

- `dashboard/src/data/books.ts`、`dashboard/vite.config.ts` 和 `dashboard/tsconfig.app.json` 共同维护静态书目，新增书籍需要修改多处配置。
- `dashboard/src/stores/useLibraryStore.ts` 在模块加载时导入所有书籍数据，单本缺失会导致整个构建失败。
- 仓库当前有 91 本带原文的书，但只有 16 本具有八类完整 `data/*.json`；管理总览和知识浏览不能使用同一准入规则。
- 只有两本书具有新版 `scan-manifest.json`，旧版完整知识库必须兼容为“可浏览、待新版验证”。
- Dashboard 是本地工具，状态刷新只发生在页面首次加载和用户点击刷新时；不监听文件、不轮询、不执行命令。

## 3. 总体架构

```text
作者/书籍目录
  .txt / ch_split / build / data / reports
                |
                v
dashboard/server/libraryScanner.ts
  - 发现书籍
  - 解析结构化产物
  - 推导状态与建议动作
  - 校验可浏览契约
                |
                v
只读 Vite 插件 API
  GET /api/library/status
  GET /api/library/book-data?path=...
                |
                v
useLibraryStore + useBookData
  - 状态刷新
  - 单书按需加载与缓存
  - 错误隔离
                |
        +-------+-------+
        |               |
        v               v
全库状态工作台       现有单书浏览页面
```

### 3.1 边界

- 服务端扫描层只能调用 Node.js `fs`、`path` 和 JSON 解析，不允许使用 `child_process`。
- API 只提供 GET，不提供写文件、启动任务、暂停、重试或终止能力。
- 不使用 `fs.watch`、定时器或客户端轮询。
- 浏览器点击刷新只发起一次 `/api/library/status` 请求。
- 单书数据只有在用户明确进入可浏览书籍时加载；管理总览不读取全部实体内容。

## 4. 服务端扫描设计

### 4.1 书籍发现

扫描仓库根目录下作者/书籍两级目录。书籍目录存在至少一个顶层 `.txt` 时纳入管理总览。排除 Dashboard、Trellis、Git、技能和文档目录，不把 `data/` 是否存在作为发现条件。

每本书生成稳定路径 `author/book`，所有文件访问必须先从本轮发现结果中匹配该路径。拒绝绝对路径、`..`、空路径和未发现路径，防止目录穿越。

### 4.2 观察产物

- 原文：书籍目录顶层 `.txt`
- 切章：`ch_split/`
- 来源索引：`build/source-index.json`
- 扫描进度：`build/scan-manifest.json`
- 扫描候选与决策：`build/candidates.jsonl`、`build/decisions.jsonl`
- 消费数据：八类 `data/*.json`
- 质量报告：`reports/quality_report.json`

八类消费数据固定为：

```text
characters.json
factions.json
locations.json
skills.json
techniques.json
items.json
dialogues.json
chapter_summaries.json
```

### 4.3 状态推导

状态由纯函数按明确优先级计算，不能根据文件大小猜测全流程百分比。

生成阶段：

1. `未生成`：只有原文，尚无有效切章或后续产物。
2. `准备完成`：已有切章或来源索引，但没有可用扫描 manifest。
3. `扫描中`：manifest 存在，任一 required pass 未覆盖全部 `required_window_ids`。
4. `待归并`：required pass 已覆盖，但尚未形成完整决策或消费数据。
5. `待查漏`：已有归并/决策产物，但 gap-audit 或后续补漏尚未完成。
6. `数据已产出`：八类消费 JSON 均存在；是否可浏览和是否完成由独立门槛决定。

扫描进度只读取 manifest 中的真实计数：`required_window_ids.length` 和 `passes.<name>.completed_window_ids.length`。UI 展示当前 pass 计数以及 named-inventory、event-dialogue、gap-audit 三类覆盖，不合并为综合百分比。

校验状态：

- `未校验`：没有质量报告。
- `旧版未证明`：报告存在但缺少 `completion_gate_passed` 或完整 G1-G5。
- `校验失败`：`completion_gate_passed !== true`，或任一 G1-G5 的 `passed !== true`。
- `G1-G5 通过`：`completion_gate_passed: true` 且 G1-G5 全部 `passed: true`。

可浏览状态：八类 JSON 全部存在、可解析为数组，并满足 Dashboard 最低字段契约。单类损坏只影响该书，错误摘要返回给 UI。

完成状态：可浏览，并且校验状态为 `G1-G5 通过`。旧版完整知识库可以浏览，但标记为“待新版验证”，不计入已完成。

### 4.4 时间与 Schema

- `lastUpdatedAt` 取本轮观察到的相关产物最大 mtime。
- `scannedAt` 由每次状态请求生成，显示为“上次扫描时间”。
- `schemaVersion` 优先读取 scan manifest 的 `schema_version`；没有新版字段时显示“legacy”或“未知”，不伪造版本。

### 4.5 建议动作与命令

阶段到建议动作的映射集中在服务端纯函数中，返回 `label`、`reason` 和 `command`。命令包含目标书籍路径，仅作为文本返回。前端只提供复制按钮，禁止执行、提交或自动修改命令。

## 5. API 契约

### 5.1 `GET /api/library/status`

每次请求重新扫描一次并返回：

```ts
interface LibraryStatusResponse {
  scannedAt: string;
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    browseable: number;
    completed: number;
  };
  books: LibraryBookStatus[];
  warnings: ScanWarning[];
}
```

`LibraryBookStatus` 包含作者、书名、路径、生成阶段、三类扫描计数、数据完整度、校验状态、可浏览状态、完成状态、Schema 版本、更新时间、缺失产物、错误摘要和建议动作。

### 5.2 `GET /api/library/book-data?path=author/book`

- 只允许读取本轮可发现且可浏览的书籍。
- 逐类读取八个 JSON，经过标准化后返回单书数据。
- 任何文件解析失败返回书籍级错误，不影响状态接口和其他书籍。
- 客户端按书路径缓存成功结果；手动刷新状态不强制重新下载已加载实体数据。

Vite 插件同时实现 `configureServer` 和 `configurePreviewServer`，确保开发与本地预览行为一致。`vite build` 只验证前端产物，不把知识库 JSON 打包进 bundle。

## 6. 前端数据与路由

### 6.1 Store

`useLibraryStore` 不再导入 `src/data/books.ts`，改为维护：

- `statusResponse`、`loading`、`error`
- `selectedBookPath`
- `refreshStatus()`
- 单书数据缓存与加载状态

`useBookData` 根据路由路径调用按需加载接口，再把标准化数据送入 `useNovelStore`。加载中、不可浏览、未找到和解析失败分别显示明确状态。

### 6.2 路由

- `/`：第一阶段的全库生成状态总览。
- `/:authorName/:bookName/*`：保留现有单书浏览路由。
- 全库搜索作为一级导航目标，在第二阶段启用；第一阶段不创建无法使用的假搜索页面。

### 6.3 工作台布局

固定桌面端布局，不增加响应式断点：

- 顶部：产品名称、知识管理/知识浏览导航、刷新图标按钮、上次扫描时间。
- 状态统计：总书目、未生成、生成中、可浏览、已完成；点击统计项过滤表格。
- 表格：作者/书名、当前阶段、知识条目、数据完整度、校验状态、可浏览状态、更新时间。知识条目只显示角色、武功和物品的真实记录数。
- 详情面板：行点击打开右侧面板；展示人物、势力、地点、武功、招式、物品、对话七类真实条目数，并保留三类窗口覆盖作为生成证据；同时展示阶段证据、缺失产物、校验问题、建议动作和复制命令。可浏览书籍额外提供“进入知识库”。

表格使用 `@tanstack/react-table` 的现有依赖。详情面板使用现有 UI 基础组件组合，不引入新的大型组件库。图标使用 Lucide，并为刷新、复制和关闭按钮提供 tooltip 与可访问标签。

## 7. Schema 兼容与崩溃修复

新增标准化层，为八类数据提供数组默认值，并把旧字段映射到当前字段。实体可选对象不得在页面中被直接假定存在。

第一阶段至少修复：

- `Character.personality` 及其 `traits`、`speech_style` 改为可选输入，标准化后提供安全默认值。
- 其他详情页读取嵌套字段时采用标准化结果或空态，不以类型断言掩盖缺失字段。
- 单书加载失败时清空旧书数据，避免路由切换后显示前一本书内容。

## 8. 第二阶段边界

第二阶段基于同一状态目录和按需加载 API 增加：

- 跨作者、书籍和实体类型的统一搜索。
- 带来源元数据的标准化全库记录。
- 有界并发加载，单书或单类文件失败不阻断全库结果。
- 对 5000 条以上列表进行分页或虚拟化。
- 全库详情面板、跳转原书、返回时恢复查询与滚动状态。

第一阶段完成后先进行人工验收；第二阶段开始前不得改写第一阶段状态契约，除非同步更新设计和测试。

## 9. 测试策略

- 单元测试：书籍发现、路径校验、阶段优先级、manifest 计数、旧/新质量报告、可浏览门槛、命令映射、标准化默认值。
- API 测试：状态扫描、单书读取、损坏 JSON、目录穿越、单书隔离。
- 组件测试：状态统计过滤、手动刷新、表格排序、详情面板、复制命令、不可浏览书籍禁用入口。
- 回归测试：人物缺失 `personality` 不白屏，缺失书籍不再导致 TypeScript 构建失败。
- E2E：固定桌面视口验证首页、刷新、过滤、详情面板、进入可浏览书籍和返回总览。
- 质量命令：`npm run lint`、`npm test`、`npm run build`、`npm run test:e2e`。

## 10. 风险与回滚

- 风险：扫描规则与流水线文件变化脱节。缓解：规则集中、fixture 覆盖、未知字段降级而非误判完成。
- 风险：读取大 JSON 影响首页。缓解：首页只读元数据和报告；实体 JSON 仅做必要的可解析/最低契约检查，单书内容按需加载并缓存。
- 风险：本地 API 路径访问越界。缓解：只接受扫描目录产生的稳定 book path，解析后再次校验位于仓库根目录内。
- 回滚：保留现有单书页面和 `useNovelStore` 数据形状；若新状态首页不可用，可临时恢复旧 `/` 页面，同时不回滚知识库产物。
