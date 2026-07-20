# Dashboard 性能优化 - 执行计划

## Checklist

### Phase 1: ScanCache 实现
- [ ] 创建 `dashboard/server/scanCache.ts`
  - [ ] 定义 `BookScanCache` 和 `ScanCache` 接口
  - [ ] 实现 `get()` 方法：检查 mtime，返回缓存或 null
  - [ ] 实现 `set()` 方法：存储状态和 mtime
  - [ ] 实现 `invalidate()` 和 `clear()` 方法
- [ ] 编写 `scanCache.test.ts` 单元测试
  - [ ] 测试缓存命中
  - [ ] 测试文件修改后缓存失效
  - [ ] 测试文件删除后缓存失效

### Phase 2: scanLibrary 改造
- [ ] 修改 `libraryScanner.ts`
  - [ ] 导入 ScanCache
  - [ ] 修改 `scanBook` 函数，接受缓存参数
  - [ ] 修改 `scanLibrary` 函数，使用缓存
- [ ] 更新 `libraryScanner.test.ts`
  - [ ] 测试缓存命中场景
  - [ ] 测试缓存失效场景

### Phase 3: 全局库懒加载
- [ ] 修改 `BrowseLibrary.tsx`
  - [ ] 进入页面时触发 `loadGlobalLibrary()`
  - [ ] 显示加载进度条（使用 `globalLoadProgress`）
  - [ ] 加载完成后显示内容
- [ ] 确保 `Library.tsx` 首屏不触发全局库加载

### Phase 4: 验证
- [ ] 运行 `pnpm check` 确保类型检查通过
- [ ] 运行 `pnpm test` 确保所有测试通过
- [ ] 手动测试：
  - [ ] 首次打开 Library 页面，检查响应时间
  - [ ] 重复刷新，检查缓存命中
  - [ ] 修改某本书的 YAML 文件，刷新后检查状态更新
  - [ ] 进入全局库页面，检查进度条显示

## Validation Commands

```bash
# 类型检查
cd dashboard && pnpm check

# 运行测试
cd dashboard && pnpm test

# 性能测试（手动）
time curl http://localhost:5173/api/library/status
```

## Rollback Points

- Phase 1 完成后：ScanCache 模块独立，可随时删除回滚
- Phase 2 完成后：scanLibrary 改造，可恢复原始实现
- Phase 3 完成后：懒加载改造，可恢复原始加载逻辑
