# Dashboard 体验优化

## Goal

提升 dashboard 的可用性和容错能力，修复布局问题并增强详情面板的交互。

## Requirements

### 1. 响应式布局

**现状**：`Library.tsx` 硬编码 `min-w-[1180px]`，小屏设备需要横向滚动。

**目标**：在常见屏幕尺寸下正常显示，避免横向滚动。

**方案**：
- 移除 `min-w-[1180px]` 硬编码
- 表格列宽改为弹性分配（`flex` 或 `minmax`）
- 在窄屏下隐藏次要列（如「可浏览」列）或改为卡片布局
- 统计卡片（6 个）在窄屏下换行显示

### 2. 详情面板增强

**现状**：`Sheet` 侧边栏只展示状态和建议命令的复制按钮。用户需要手动复制命令到终端执行。

**目标**：增加一键执行建议命令的能力。

**方案**：
- 新增后端 API `POST /api/library/execute-action`，接收 `{ bookPath, actionType }` 参数
- 后端调用对应的脚本（`split-chapters.js`、`prepare-source.js` 等）
- 前端在建议命令旁增加「执行」按钮，点击后调用 API 并显示执行状态
- 执行完成后自动刷新该书状态
- 注意：只允许执行 `suggestedAction` 中定义的命令，不接受任意命令

### 3. 错误边界

**现状**：子页面数据加载失败会导致白屏，没有友好的错误提示。

**目标**：数据加载失败时显示友好的错误信息和重试按钮。

**方案**：
- 创建通用 `ErrorBoundary` 组件，捕获渲染错误
- 在 `useBookData` 和 `useCurrentBookExtras` hooks 中增加错误状态和重试逻辑
- 错误时显示「加载失败」提示 + 重试按钮，而不是白屏
- 记录错误信息到控制台，方便调试

## Acceptance Criteria

- [ ] 在 1280px 宽度下，Library 页面无横向滚动
- [ ] 在 768px 宽度下，Library 页面仍可正常使用（表格降级为卡片或隐藏次要列）
- [ ] 详情面板中点击「执行」按钮后，对应脚本被调用，执行状态有 loading 指示
- [ ] 执行完成后，该书状态自动刷新
- [ ] 模拟数据加载失败时，显示友好的错误提示和重试按钮
- [ ] 点击重试按钮后重新加载数据
- [ ] `pnpm check` 通过

## Technical Notes

- 修改范围：`dashboard/src/pages/Library.tsx`、`dashboard/server/libraryApiPlugin.ts`、`dashboard/src/components/`（新增 ErrorBoundary）、`dashboard/src/hooks/`
- 详情面板增强需要新增后端 API，注意安全性（只允许预定义命令）
- 错误边界需要覆盖所有主要页面，不仅仅是 Library
