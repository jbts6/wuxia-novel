# Dashboard 游戏素材与事件接入技术设计

## 1. 设计目标

在保持 Dashboard 现有八类浏览契约不变的前提下，接入可选的 `data/events.json` 与 `reports/game_materials.json`，并为游戏素材提供稳定入口、筛选、原始实体追溯和明确的降级状态。

核心原则：

1. 原八类仍是唯一硬门槛，可选扩展永远不能让旧书失去浏览能力。
2. 游戏素材只引用九类事实数据，不复制实体内容，也不成为第十类事实数据。
3. 缺失、合法空数据、文件损坏、网络不可用和单条悬空引用必须可区分。
4. 核心数据先显示，扩展数据异步加载，慢报告不能拖延人物、武功等页面。
5. Dashboard 保持只读，不承担生成、修正或回写职责。

## 2. 方案选择

### 2.1 已选方案：独立的单书扩展接口

保留现有接口：

- `GET /api/library/status`
- `GET /api/library/book-data?path=<author/book>`

新增：

- `GET /api/library/book-extras?path=<author/book>`

新接口只读取：

- `<book>/data/events.json`
- `<book>/reports/game_materials.json`

选择独立接口的原因：

- `/book-data` 继续只返回八类核心数组，现有调用方和 `RawNovelData` 语义不变。
- `/browse` 的跨书索引继续复用核心接口，不会为每本书额外下载事件和游戏素材。
- 扩展接口失败时，核心书籍仍可打开；错误边界天然隔离。
- 将来增加其他只读游戏设计报告时，可以继续扩展同一补充契约。

### 2.2 未选方案

- **把扩展字段直接塞入 `/book-data`：** 改动较少，但会扩大所有跨书加载请求，并把可选文件错误耦合进核心接口。
- **让浏览器直接读取仓库路径：** 绕过现有路径安全与发现规则，部署形态也不稳定。
- **把游戏素材复制进九类实体：** 破坏单一事实来源，并把派生索引错误地变成事实字段。

## 3. 数据流

```text
八类 data/*.json ──> /book-data ──> normalizeNovelData ──> core cache ──> 既有页面

events.json ─────────────┐
                         ├─> /book-extras ─> normalizeBookExtras ─> extras cache
game_materials.json ─────┘                                      ├─> 游戏素材页/概览
                                                               ├─> 章回录·关键事件
                                                               └─> 原始实体解析
```

`useBookData()` 在书籍切换时同时启动核心与扩展请求：

- 核心请求决定 `AppLayout` 是否可以展示书籍。
- 扩展请求不参与核心 loading/error；各扩展页面显示自己的加载或降级状态。
- 缓存按 `bookPath` 隔离，旧请求不得覆盖新书的当前视图。

## 4. 服务端契约

### 4.1 响应类型

```ts
type OptionalResourceStatus = 'available' | 'missing' | 'invalid';

type OptionalResourceResult<T> =
  | { status: 'available'; data: T }
  | { status: 'missing'; data: null }
  | { status: 'invalid'; data: null; error: string };

interface RawBookExtrasResponse {
  events: OptionalResourceResult<unknown[]>;
  gameMaterials: OptionalResourceResult<unknown>;
}
```

状态语义：

- `available`：文件存在、JSON 可解析且满足最小外层契约；合法空数组或空 `entries` 仍属于 available。
- `missing`：文件不存在。
- `invalid`：文件存在但无法解析，或最小结构不合法；必须提供可显示但不泄露绝对路径的错误信息。

### 4.2 最小服务端校验

- `events.json` 必须是数组；每条记录至少具有非空字符串 `id` 与 `name`。
- `game_materials.json` 必须是对象，`schema_version` 存在，`entries` 是数组。
- 每条素材至少包含非空字符串 `material_type`、`source_id`、`relevance`、`suggested_use`、`reason`；`material_type` 必须属于既定五类。
- 服务端不因单条 `source_id` 悬空而拒绝整个报告；引用解析由包含全部已加载实体的前端完成，并以卡片级错误降级。

### 4.3 HTTP 行为

| 条件 | 结果 |
|---|---|
| 非 GET | `405` |
| 缺少 `path` | `400` |
| 未发现、不安全或核心八类不可浏览的书籍 | `422` |
| 两个可选文件都缺失 | `200`，两个资源均为 `missing` |
| 一个文件损坏 | `200`，该资源为 `invalid`，另一个独立返回 |
| 合法扩展 | `200`，对应资源为 `available` |

`scanLibrary()`、八类完整度、七类实体计数和 `browseable` 不读取也不统计扩展文件。

## 5. 前端领域模型与标准化

### 5.1 事件

```ts
interface Event {
  id: string;
  name: string;
  importance?: string;
  cause?: string;
  process: string;
  result?: string;
  participants: string[];
  locations: string[];
  source_refs: SourceRef[];
}
```

`participants`、`locations` 保留实体 ID，展示时通过已有名称映射解析；`source_refs` 保留跨章引用。

### 5.2 游戏素材

```ts
type GameMaterialType =
  | '战斗系统原型'
  | '经典剧情桥段'
  | '角色原型/彩蛋'
  | '标志性物品'
  | '门派与世界观素材';

interface GameMaterial {
  material_type: GameMaterialType;
  source_id: string;
  relevance: string;
  suggested_use: string;
  reason: string;
}
```

前端不把 `relevance` 硬编码成固定枚举，筛选项由实际非空值派生，以兼容后续质量等级文案调整。

### 5.3 标准化职责

新增 `normalizeBookExtras()`，与核心 `normalizeNovelData()` 分离：

- 防御性处理稀疏字段，并为数组、描述文本和证据提供安全默认值。
- 保留服务端的 available/missing/invalid 状态。
- 客户端请求整体失败时，由 store 额外表示 `unavailable`，不伪装成 missing。
- 不静默删除悬空素材；保留条目并交给来源解析器标记。

## 6. 缓存与加载状态

`useLibraryStore` 新增按书隔离的扩展状态：

```ts
extrasCache: Record<string, BookExtrasData>;
extrasLoading: Record<string, boolean>;
extrasErrors: Record<string, string | null>;
loadBookExtras(bookPath: string): Promise<BookExtrasData>;
```

扩展请求具备与核心请求一致的去重和缓存语义，但不加入 `bookLoading` 与 `bookErrors`。`useBookData()` 启动扩展加载但只用核心状态计算 `isLoading` 和 `error`。

页面通过一个只读选择器或 `useCurrentBookExtras()` 统一取得：

- 当前书籍扩展数据；
- 是否正在加载；
- 网络/API 整体错误；
- 每个资源的 available/missing/invalid 状态。

## 7. 来源解析与深链接

新增单一来源解析器，根据 `source_id` 是否真实存在于各实体集合中判断类型，禁止仅依赖 ID 前缀。

| 来源 | 路由 |
|---|---|
| 人物 | `characters?detail=<id>` |
| 功法 | `skills?detail=<id>` |
| 招式 | `skills?view=techniques&detail=<id>` |
| 物品 | `items?detail=<id>` |
| 势力 | `factions?detail=<id>` |
| 地点 | `locations?detail=<id>` |
| 事件 | `chapter-summaries?view=events&detail=<id>` |

现有五类实体路由沿用既有详情参数和 `LIBRARY_KIND_ROUTES` 约定。解析结果包含显示名称、来源类型和 href；未命中时返回显式 unresolved 结果，卡片禁用跳转并显示“来源不可解析”。

## 8. 信息架构与页面行为

### 8.1 侧栏

- 原有知识库入口顺序不变。
- 在底部通过分隔线和“创作应用”小标题加入“游戏素材”。
- 所有可浏览书籍始终显示该入口。

### 8.2 书籍概览

增加“游戏素材”摘要卡：

- loading：显示轻量加载状态，不阻塞其他统计卡。
- missing：显示“本书尚未生成游戏素材”。
- invalid/unavailable：显示读取错误与可重试提示，不显示 0。
- available：显示总数、五类数量和“查看全部”。合法空报告显示 0 条。

### 8.3 游戏素材页

- 固定路由：`/:authorName/:bookName/game-materials`。
- 页面头部显示素材总数。
- 类型筛选支持“全部 + 五类”；重要度筛选由现有值动态生成。
- 卡片信息层级以已解析的原始来源名称为主标题（例如“八卦掌”），让每张卡片可以直接辨识；素材类型和重要度降为徽标，正文继续展示推荐用途与入选理由。
- 来源链接的可见文本统一为“打开来源”，避免重复标题；无障碍名称仍包含来源名称（例如“打开来源：八卦掌”）。
- 未解析来源的卡片标题显示“来源不可解析”，按钮保持禁用且不暴露原始 `source_id`。
- 无筛选结果与报告本身为空使用不同空状态。
- 部分来源悬空时显示页面级摘要和卡片级错误，其余卡片正常使用。

### 8.4 章回录

- 增加 URL 同步的“章节摘要 / 关键事件”Tabs。
- 默认仍为章节摘要，旧路由行为不变。
- 事件列表显示名称、重要性、过程摘要、参与人物、地点和章节徽标。
- `view=events&detail=<event-id>` 自动切换事件视图并打开事件详情 Sheet。

### 8.5 武功阁

- 增加 URL 同步的“功法 / 招式”Tabs。
- 无 `view` 参数时默认功法，既有 `skills?detail=<skill-id>` 保持有效。
- 招式列表展示名称、所属功法和类型；详情展示描述及证据。
- `view=techniques&detail=<technique-id>` 自动切换并打开招式详情。

## 9. 状态与错误矩阵

| 场景 | 游戏素材页 | 概览卡 | 核心页面 |
|---|---|---|---|
| 扩展加载中 | 加载状态 | 加载状态 | 正常显示 |
| 报告缺失 | 尚未生成 | 尚未生成 | 正常显示 |
| 报告合法为空 | 0 条 | 0 条 | 正常显示 |
| 报告损坏 | 明确错误 | 明确错误 | 正常显示 |
| 扩展 API 不可用 | 暂时不可用 | 暂时不可用 | 正常显示 |
| 单条来源悬空 | 单卡禁用跳转 | 总数仍按报告统计 | 正常显示 |
| 事件文件缺失但报告引用事件 | 对应素材悬空 | 素材总数照常 | 章回摘要正常 |

## 10. 兼容性、性能与安全

- 不修改九类 JSON 或游戏素材报告格式，无数据迁移。
- 不修改八类 `DATA_FILE_NAMES`、完整度分母或 `readBookData()` 返回值。
- `/browse` 不请求扩展接口，跨书实体索引和并发策略不变。
- 扩展读取复用书籍发现与路径校验，禁止任意路径读取。
- 所有接口继续 `Cache-Control: no-store`；前端仅做会话内按书缓存。
- 页面列表使用稳定 key；当前 44 条规模无需虚拟化，仍避免在 render 中重复构建全量索引。

## 11. 验证策略

1. 服务端单元测试覆盖 missing/available/invalid、错误隔离、路径安全和八类门槛不变。
2. 标准化与 store 测试覆盖稀疏数据、合法空数据、网络失败、请求去重和按书缓存。
3. 来源解析测试覆盖七类目标、未知 ID 和不依赖前缀。
4. 组件测试覆盖三种空/错状态、组合筛选、键盘 Tabs 和深链接。
5. 回归测试验证既有功法链接、章回摘要默认视图和 `/browse` 均不变。
6. 桌面 E2E 使用《飞狐外传》验证 44 条素材、20 个事件、4 条招式素材和七类来源跳转。

## 12. 发布与回滚

这是纯只读 Dashboard 变更，不写入小说数据：

- 发布不需要迁移或重新生成知识库；已有《飞狐外传》数据可直接作为首个可见样本。
- 回滚只需撤销新增接口、路由、页面和 store 字段；八类核心接口与数据从未改变。
- 若扩展功能出现问题，可临时移除“游戏素材”路由和扩展请求，不影响旧 Dashboard 浏览能力。
