# Dashboard 游戏素材与事件接入实施计划

> 状态：仅规划。用户复核并通过 `task.py start` 前不得实施。

## 全局约束

- 保持 `dashboard/src/types/library.ts` 中现有八类 `DATA_FILE_NAMES` 不变。
- 保持 `/api/library/book-data` 的请求与响应契约不变。
- 扩展失败不得写入 `bookErrors`，不得阻塞 `AppLayout`。
- 不修改任何小说 JSON 或 `generate-kb` / `generate-game-kb` 代码。
- 不把游戏素材加入 `/browse` 全局索引。
- 所有实现先写失败测试，再写最小代码使其通过。

## Task 1：建立可选扩展服务端契约

**文件：**

- Modify: `dashboard/src/types/library.ts`
- Modify: `dashboard/server/libraryScanner.ts`
- Modify: `dashboard/server/libraryApiPlugin.ts`
- Modify: `dashboard/server/libraryScanner.test.ts`
- Modify: `dashboard/server/libraryApiPlugin.test.ts`

**步骤：**

1. 先写测试，证明：
   - 只有八类文件时书籍仍为 `required: 8`、`browseable: true`；扩展响应为 missing。
   - 合法事件数组和游戏素材报告分别返回 available。
   - 合法空数据仍是 available，不是 missing。
   - 一个扩展文件损坏只使自身 invalid，另一个仍可返回。
   - 不安全路径、未知书籍、非 GET 和缺少 path 保持正确状态码。
2. 在 `types/library.ts` 增加 raw extras 判别联合类型，不改 `DATA_FILE_NAMES`。
3. 在 scanner 增加 `readBookExtras()`，复用书籍发现、核心可浏览检查、JSON 读取和路径安全边界。
4. 增加最小结构校验与安全错误信息。
5. 在 API plugin 注册 `/api/library/book-extras`。

**局部验证：**

```bash
cd dashboard
rtk npm test -- server/libraryScanner.test.ts server/libraryApiPlugin.test.ts
```

## Task 2：标准化、缓存和非阻塞加载

**文件：**

- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/lib/libraryApi.ts`
- Create: `dashboard/src/lib/normalizeBookExtras.ts`
- Create: `dashboard/src/lib/normalizeBookExtras.test.ts`
- Modify: `dashboard/src/stores/useLibraryStore.ts`
- Create: `dashboard/src/stores/useLibraryStore.test.ts`
- Modify: `dashboard/src/hooks/useBookData.ts`
- Create: `dashboard/src/hooks/useCurrentBookExtras.ts`

**步骤：**

1. 先写标准化测试，覆盖事件稀疏字段、跨章证据、五类素材、合法空报告和状态保留。
2. 增加 `Event`、`GameMaterialType`、`GameMaterial`、`BookExtrasData` 与客户端 unavailable 状态类型。
3. 实现 `fetchRawBookExtras()` 与 `normalizeBookExtras()`。
4. 先写 store 测试，覆盖同书请求去重、按书缓存、整体请求失败、invalid 不转成 missing。
5. 为 `useLibraryStore` 增加独立 extras cache/loading/errors 和 `loadBookExtras()`。
6. 修改 `useBookData()`：与核心请求并行启动 extras 请求，但 `isLoading/error` 仍只由核心数据决定；清理阶段阻止旧书结果污染当前视图。
7. 增加 `useCurrentBookExtras()`，统一页面状态读取，避免多个页面重复解释缓存字段。

**局部验证：**

```bash
cd dashboard
rtk npm test -- src/lib/normalizeBookExtras.test.ts src/stores/useLibraryStore.test.ts
```

## Task 3：建立游戏素材来源解析器

**文件：**

- Create: `dashboard/src/lib/gameMaterialSources.ts`
- Create: `dashboard/src/lib/gameMaterialSources.test.ts`
- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/lib/resolveId.ts`
- Modify: `dashboard/src/lib/resolveId.test.ts`

**步骤：**

1. 先写七类来源解析测试：人物、功法、招式、物品、势力、地点、事件。
2. 增加测试证明解析由真实 ID 集合决定，而不是依赖 `char_`、`tech_` 等前缀。
3. 复用既有五类实体路由，补充招式与事件的 view/detail 查询参数。
4. 为 store ID 映射补充招式显示名；事件映射从 extras 数据构建。
5. 未知 ID 返回 typed unresolved 结果，不抛异常、不生成错误 href。

**局部验证：**

```bash
cd dashboard
rtk npm test -- src/lib/gameMaterialSources.test.ts src/lib/resolveId.test.ts
```

## Task 4：扩展武功阁的招式视图

**文件：**

- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/pages/Skills.tsx`
- Create: `dashboard/src/pages/Skills.test.tsx`
- Modify: `dashboard/src/hooks/useEntityDetailParam.ts`

**步骤：**

1. 写组件测试，覆盖默认功法视图、招式 Tab、所属功法名称、招式详情和空状态。
2. 写深链接回归测试：
   - `skills?detail=<skill-id>` 仍打开功法；
   - `skills?view=techniques&detail=<technique-id>` 打开招式。
3. 将 `CardType` 扩展为支持 technique，保持既有类型行为。
4. 使用现有 Tabs、Table、Sheet、Badge 和 SourceRef 展示模式实现招式列表与详情。
5. Tab 切换同步 URL，并清理不属于目标视图的 detail 参数。

**局部验证：**

```bash
cd dashboard
rtk npm test -- src/pages/Skills.test.tsx src/stores/useNovelStore.test.ts
```

## Task 5：在章回录加入关键事件

**文件：**

- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/pages/ChapterSummaries.tsx`
- Create: `dashboard/src/pages/ChapterSummaries.test.tsx`

**步骤：**

1. 写组件测试，覆盖默认章节摘要、事件 Tab、事件缺失/损坏/加载中状态和跨章徽标。
2. 写深链接测试：`chapter-summaries?view=events&detail=<event-id>` 自动选择事件并打开详情。
3. 使用人物与地点映射显示名称，无法解析的参与者不显示内部 ID。
4. 事件详情展示 cause/process/result、参与者、地点与全部 source refs。
5. 章节摘要旧视图与旧路由不改变。

**局部验证：**

```bash
cd dashboard
rtk npm test -- src/pages/ChapterSummaries.test.tsx
```

## Task 6：游戏素材页面、导航和概览摘要

**文件：**

- Create: `dashboard/src/pages/GameMaterials.tsx`
- Create: `dashboard/src/pages/GameMaterials.test.tsx`
- Modify: `dashboard/src/pages/BookOverview.tsx`
- Create or Modify: `dashboard/src/pages/BookOverview.test.tsx`
- Modify: `dashboard/src/components/layout/SideNav.tsx`
- Modify: `dashboard/src/App.tsx`

**步骤：**

1. 写页面测试，分别锁定 loading、missing、available-empty、invalid、unavailable 和部分悬空引用状态。
2. 写筛选测试：素材类型与重要度可组合，筛选结果计数准确。
3. 写来源按钮测试，验证七类 href 和 unresolved 禁用状态。
4. 增加 `/game-materials` 路由与始终可见的“创作应用 / 游戏素材”侧栏入口。
5. 实现素材页面，复用已有 PageHeader、Card、Badge、Tabs/Select、Button 组件。
6. 在概览增加摘要卡；状态语义与素材页完全一致，避免各页面自行猜测缺失含义。
7. 检查窄屏、长名称、长理由、键盘焦点和 aria 名称。

**局部验证：**

```bash
cd dashboard
rtk npm test -- src/pages/GameMaterials.test.tsx src/pages/BookOverview.test.tsx
```

## Task 7：跨层回归与真实数据 E2E

**文件：**

- Modify: `dashboard/tests/e2e/nav.spec.ts`
- Modify: `dashboard/tests/e2e/routing.spec.ts`
- Create: `dashboard/tests/e2e/game-materials.spec.ts`

**步骤：**

1. 验证旧八类书籍始终显示游戏素材入口，并呈现“尚未生成”。
2. 使用《飞狐外传》验证：
   - 44 条素材与五类分布可见；
   - 组合筛选有效；
   - 6 条事件素材可进入对应事件；
   - 4 条招式素材可进入对应招式；
   - 其余人物、功法、物品、势力和地点链接可打开对应详情。
3. 验证浏览器前进/后退保持 view/detail 状态。
4. 验证 `/browse` 请求和结果未包含游戏素材或事件索引。
5. 验证无横向溢出、键盘导航和可见焦点。

**局部验证：**

```bash
cd dashboard
rtk npm run test:e2e -- tests/e2e/nav.spec.ts tests/e2e/routing.spec.ts tests/e2e/game-materials.spec.ts
```

## Task 8：规范同步与最终质量门禁

**文件：**

- Modify: `.trellis/spec/backend/library-status-api.md`
- Modify: `.trellis/spec/frontend/global-library-browser.md`
- 按实现结果更新其他真正受到影响的 active spec，不填充无关模板规范。

**步骤：**

1. 用 `trellis-check` 检查需求、设计、数据流和实现一致性。
2. 用 `trellis-update-spec` 记录：
   - 八类核心接口与独立扩展接口的边界；
   - optional resource 状态语义；
   - `/browse` 不加载 extras；
   - 招式与事件深链接契约。
3. 运行完整验证：

```bash
cd dashboard
rtk npm test
rtk npm run lint
rtk npm run build
rtk npm run test:e2e
```

4. 检查 `rtk git diff --check` 与 `rtk git status --short`，确认没有小说数据、生成 Skill 或无关用户文件被修改。
5. 失败时按最小任务回滚，不修改数据文件规避测试。

## 风险点与回滚点

- **最高风险：** 把可选文件加入八类 `DATA_FILE_NAMES`。测试必须固定 `required === 8`。
- **加载风险：** extras 失败污染 `bookErrors`。核心与扩展错误状态必须分开测试。
- **路由风险：** 新 view 参数破坏已有 `?detail=`。Task 4/5 先锁定回归测试。
- **引用风险：** 根据 ID 前缀错误分类。来源解析必须使用真实集合成员关系。
- **状态风险：** missing、empty、invalid 被统一成空数组。判别联合在标准化前后都必须保留。
- **回滚：** 每个 Task 独立可验证；撤销 Task 6 的路由与入口即可关闭用户可见功能，而八类核心路径始终可用。

## 启动前检查

- [ ] 用户复核 `prd.md`、`design.md`、`implement.md`。
- [ ] PRD 无未解决开放问题且完成收敛检查。
- [ ] 用户明确批准开始实现。
- [ ] 运行 `task.py start`，任务状态从 planning 进入 in_progress。
- [ ] 实现前重新运行 `trellis-before-dev`，加载 frontend/backend active specs。
