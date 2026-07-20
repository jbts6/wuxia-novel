# Dashboard 体验优化 - 执行计划

## Checklist

### Phase 1: ErrorBoundary 组件
- [ ] 创建 `dashboard/src/components/ErrorBoundary.tsx`
  - [ ] 实现 `getDerivedStateFromError` 方法
  - [ ] 实现 `componentDidCatch` 方法（记录到控制台）
  - [ ] 实现默认 fallback UI（错误提示 + 重试按钮）
  - [ ] 支持自定义 fallback
- [ ] 编写 `ErrorBoundary.test.tsx`
  - [ ] 测试错误捕获和 fallback 渲染
  - [ ] 测试重试按钮重置错误状态

### Phase 2: 错误边界集成
- [ ] 修改 `Library.tsx`
  - [ ] 用 ErrorBoundary 包裹主要内容区域
- [ ] 修改 `BrowseLibrary.tsx`
  - [ ] 用 ErrorBoundary 包裹主要内容区域
- [ ] 修改其他实体页面（Characters、Skills、Items、Factions）
  - [ ] 用 ErrorBoundary 包裹

### Phase 3: 响应式布局
- [ ] 修改 `Library.tsx` 的表格
  - [ ] 移除 `min-w-[1180px]` 硬编码
  - [ ] 使用 Tailwind 响应式类名控制列显示/隐藏
  - [ ] 定义断点：`lg` (>=1024px) 完整表格，`md` (>=768px) 精简表格，`<md` 卡片布局
- [ ] 创建 `LibraryCard.tsx` 组件（窄屏卡片布局）
  - [ ] 显示书籍名称、作者、状态、内容覆盖
  - [ ] 点击卡片打开详情面板
- [ ] 修改统计卡片（6 个）
  - [ ] 窄屏下换行显示（`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`）

### Phase 4: 详情面板增强 - 后端
- [ ] 创建 `dashboard/server/actionConfig.ts`
  - [ ] 定义动作类型到脚本的映射
  - [ ] 定义每个动作的 label、description
- [ ] 修改 `libraryApiPlugin.ts`
  - [ ] 新增 `POST /api/library/execute-action` 路由
  - [ ] 验证请求参数（bookPath、actionType）
  - [ ] 使用 `child_process.execFile` 执行脚本
  - [ ] 设置 30 秒超时
  - [ ] 返回执行结果（stdout、stderr、exitCode）
- [ ] 编写 `libraryApiPlugin.test.ts`
  - [ ] 测试成功执行
  - [ ] 测试超时
  - [ ] 测试无效 actionType

### Phase 5: 详情面板增强 - 前端
- [ ] 创建 `dashboard/src/components/ExecuteButton.tsx`
  - [ ] 实现 loading 状态
  - [ ] 实现 error 状态和错误显示
  - [ ] 调用 `POST /api/library/execute-action`
  - [ ] 执行成功后调用 `onSuccess` 回调
- [ ] 修改 `Library.tsx` 的 Sheet 组件
  - [ ] 在建议命令旁添加 ExecuteButton
  - [ ] 执行成功后刷新该书状态
- [ ] 编写 `ExecuteButton.test.tsx`
  - [ ] 测试 loading 状态
  - [ ] 测试成功执行
  - [ ] 测试失败处理

### Phase 6: 验证
- [ ] 运行 `cd dashboard && pnpm check` 确保类型检查通过
- [ ] 运行 `cd dashboard && pnpm test` 确保所有测试通过
- [ ] 手动测试：
  - [ ] 在 1280px 宽度下检查表格显示
  - [ ] 在 768px 宽度下检查精简表格
  - [ ] 在 480px 宽度下检查卡片布局
  - [ ] 点击「执行」按钮，检查命令执行和状态刷新
  - [ ] 模拟数据加载失败，检查错误边界显示

## Validation Commands

```bash
# 类型检查
cd dashboard && pnpm check

# 运行测试
cd dashboard && pnpm test

# 手动测试响应式
# 在浏览器中调整窗口宽度，检查布局变化
```

## Rollback Points

- Phase 1 完成后：ErrorBoundary 组件独立，可随时删除回滚
- Phase 2 完成后：错误边界集成，可移除包裹组件
- Phase 3 完成后：响应式布局，可恢复 `min-w-[1180px]`
- Phase 4 完成后：后端 API，可删除路由
- Phase 5 完成后：前端组件，可删除 ExecuteButton
