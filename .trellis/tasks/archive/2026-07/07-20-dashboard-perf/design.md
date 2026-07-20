# Dashboard 性能优化 - 技术设计

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Vite Dev Server                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  libraryApiPlugin.ts                                │ │
│  │  GET /api/library/status → scanLibrary()            │ │
│  └─────────────────────┬───────────────────────────────┘ │
│                        │                                  │
│  ┌─────────────────────▼───────────────────────────────┐ │
│  │  libraryScanner.ts                                  │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  scanCache (module-level Map)               │   │ │
│  │  │  ┌─────────────────────────────────────┐   │   │ │
│  │  │  │  bookPath → { status, mtime, data }  │   │   │ │
│  │  │  └─────────────────────────────────────┘   │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Design

### 1. ScanCache (新增)

**位置**：`dashboard/server/scanCache.ts`

**职责**：
- 管理 per-book 的扫描缓存
- 检查文件 mtime 判断缓存是否有效
- 提供缓存命中/未命中的统计

**接口**：
```typescript
interface BookScanCache {
  status: LibraryBookStatus;
  mtimes: Map<string, number>;  // filePath → mtimeMs
  lastScan: number;             // timestamp
}

interface ScanCache {
  get(bookPath: string, bookDirectory: string): BookScanCache | null;
  set(bookPath: string, bookDirectory: string, status: LibraryBookStatus): void;
  invalidate(bookPath: string): void;
  clear(): void;
}
```

**缓存键**：`bookPath`（如 `金庸/射雕英雄传`）

**缓存验证逻辑**：
1. 遍历 `bookDirectory` 下的关键文件：
   - `data/*.yaml`（4 个实体文件）
   - `reports/quality_report.json`
   - `build/scan-manifest.json`
   - `build/source-index.json`
   - `ch_split/*.txt`（目录 mtime）
2. 计算所有文件的最大 mtime
3. 与缓存中的 mtime 比较
4. 若任何文件 mtime 变化，返回 null（缓存失效）

**性能考虑**：
- `fs.statSync` 调用次数：每个 book 约 10-15 次（关键文件数）
- 比完整扫描（读取 + 解析 YAML）快 10-20 倍
- 缓存命中时：~5ms vs 缓存未命中时：~200ms（13 本书）

### 2. scanLibrary 改造

**现状**：
```typescript
export function scanLibrary(rootDirectory: string): LibraryStatusResponse {
  const books = discoverBooks(rootDirectory).map(scanBook);
  // ...
}
```

**改造后**：
```typescript
export function scanLibrary(rootDirectory: string): LibraryStatusResponse {
  const books = discoverBooks(rootDirectory).map((book) => {
    const cached = scanCache.get(book.path, book.directory);
    if (cached) return cached.status;
    const status = scanBook(book);
    scanCache.set(book.path, book.directory, status);
    return status;
  });
  // ...
}
```

### 3. 全局库懒加载

**现状**：`useLibraryStore.ts` 中 `loadGlobalLibrary` 在 `ensureStatus` 后立即加载所有书籍。

**改造**：
- `Library.tsx` 首屏只调用 `refreshStatus()`
- `BrowseLibrary.tsx` 进入时才调用 `loadGlobalLibrary()`
- 已有的 `globalLoadProgress` 状态用于显示进度条

## Edge Cases

1. **文件删除**：mtime 检查会发现文件不存在，返回 null（缓存失效）
2. **文件新增**：新文件不在 mtime 列表中，返回 null（缓存失效）
3. **文件重命名**：旧文件消失 + 新文件出现，返回 null（缓存失效）
4. **并发请求**：模块级缓存，无并发问题（Node.js 单线程）
5. **dashboard 重启**：缓存自动失效（进程内存储）

## Testing Strategy

1. **单元测试**：
   - ScanCache 的缓存命中/未命中逻辑
   - 文件 mtime 变化后缓存失效
   - 文件删除后缓存失效

2. **集成测试**：
   - 首次扫描返回完整结果
   - 重复扫描返回缓存结果
   - 修改文件后扫描返回更新结果

3. **性能测试**：
   - 13 本书规模下，缓存命中 vs 未命中的响应时间对比
