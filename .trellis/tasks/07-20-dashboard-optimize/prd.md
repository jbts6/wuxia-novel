# Dashboard 优化

## Goal

提升 dashboard 的性能、用户体验和数据层健壮性，分三个独立子任务交付。

## Scope

三个独立可验证的优化方向，各自作为子任务：

1. **性能优化** — 状态扫描缓存 + 全局库懒加载
2. **体验优化** — 响应式布局 + 详情面板增强 + 错误边界
3. **数据层优化** — suggestedAction 配置化 + contentCoverage 判定改进

## Parent Acceptance Criteria

- [ ] 三个子任务全部完成并验证
- [ ] 子任务之间无代码冲突
- [ ] Dashboard 整体功能回归通过（pnpm check）

## Constraints

- 每个子任务独立可验证，可独立提交
- 不改变现有 API 接口契约
- 不引入新依赖（除非有充分理由）
