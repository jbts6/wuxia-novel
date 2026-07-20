# Dashboard 性能优化

## Goal

减少 dashboard 的加载时间和资源消耗，主要针对两个瓶颈：状态扫描重复读取文件系统、全局库一次性加载所有书籍数据。

## Requirements

### 1. 状态扫描缓存

**现状**：`scanLibrary()` 每次 API 请求都重新遍历所有 `data/*.yaml` 文件并校验结构。随着书目增多（当前 13 本，未来可能 50+），响应时间线性增长。

**目标**：在文件未变化时返回缓存结果，避免重复 IO 和解析。

**方案**：
- 在 `libraryScanner.ts` 中增加基于文件 mtime 的缓存层
- 首次扫描后缓存结果，后续请求检查关键文件（`data/*.yaml`、`reports/quality_report.json`、`build/scan-manifest.json`）的 mtime
- 若所有文件 mtime 未变，返回缓存；否则重新扫描
- 缓存粒度：per-book（单本书文件变化只重新扫描该书）
- 缓存生命周期：进程内，dashboard 重启后自动失效

### 2. 全局库懒加载

**现状**：`loadGlobalLibrary()` 一次性加载所有可浏览书籍的数据到内存（并发 4），书目多时首屏卡顿。

**目标**：首屏只加载状态概览，全局库数据按需加载。

**方案**：
- `Library.tsx` 首屏只请求 `/api/library/status`
- 全局库页面（`BrowseLibrary.tsx`）进入时才触发 `loadGlobalLibrary`
- 加载过程中显示进度条（已有 `globalLoadProgress` 状态，只需确保 UI 展示）
- 考虑增加虚拟列表（如果实体数量超过 1000 条）

## Acceptance Criteria

- [ ] 首次打开 Library 页面，`/api/library/status` 响应时间 < 500ms（13 本书规模）
- [ ] 重复刷新 Library 页面，第二次起响应时间 < 100ms（缓存命中）
- [ ] 修改某本书的 `data/characters.yaml` 后刷新，该书状态正确更新，其他书仍命中缓存
- [ ] 全局库页面加载时显示进度指示，不阻塞首屏渲染
- [ ] `pnpm check` 通过

## Technical Notes

- 修改范围：`dashboard/server/libraryScanner.ts`、`dashboard/src/stores/useLibraryStore.ts`、`dashboard/src/pages/BrowseLibrary.tsx`
- 不改变 API 接口契约（返回数据结构不变）
- 缓存失效逻辑需要覆盖：文件新增、删除、修改、重命名
