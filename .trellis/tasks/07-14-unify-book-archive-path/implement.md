# 统一书籍归档目录实施清单

## Preconditions

- [x] 确认工作区中《天龙八部》现有未提交修改保持不变；不执行 `git clean`、`git reset` 或任何覆盖性恢复。
- [x] 确认以下源目录和唯一冲突目标存在：
  - `金庸/_archive/天龙八部/2026-07-12-pre-rebuild`
  - `金庸/_archive/天龙八部/2026-07-13-pre-rebuild`
  - `金庸/_archive/天龙八部/2026-07-13-quarantined-legacy-final`
  - `金庸/_archive/鸳鸯刀/2026-07-12-pre-human-gold`
  - `金庸/天龙八部/_archive/2026-07-13-pre-rebuild`

## Migration

- [x] 记录上述 5 个目录的文件数、总字节数和聚合 SHA-256；任一目录缺失、包含符号链接或读取失败时停止。
- [x] 创建 `金庸/天龙八部/_archive`（已存在则保持不变）和 `金庸/鸳鸯刀/_archive`。
- [x] 执行以下四个目录移动，逐项确认源存在、目标不存在后再执行：

```bash
mv "金庸/_archive/天龙八部/2026-07-12-pre-rebuild" \
  "金庸/天龙八部/_archive/2026-07-12-pre-rebuild"
mv "金庸/_archive/天龙八部/2026-07-13-pre-rebuild" \
  "金庸/天龙八部/_archive/2026-07-13-pre-rebuild-legacy-author-archive"
mv "金庸/_archive/天龙八部/2026-07-13-quarantined-legacy-final" \
  "金庸/天龙八部/_archive/2026-07-13-quarantined-legacy-final"
mv "金庸/_archive/鸳鸯刀/2026-07-12-pre-human-gold" \
  "金庸/鸳鸯刀/_archive/2026-07-12-pre-human-gold"
```

- [x] 移动后重新计算 5 个批次 hash；每个新路径必须与移动前对应源 hash 完全一致。
- [x] 仅当 `金庸/_archive` 为空时执行 `rmdir "金庸/_archive"`；非空时停止并报告剩余内容。

## Verification

- [x] 确认所有归档都位于 `作者/书名/_archive/<批次>/`，且作者级 `金庸/_archive` 不存在。
- [x] 确认冲突双方均保留：原书内 `2026-07-13-pre-rebuild` 与迁入的 `2026-07-13-pre-rebuild-legacy-author-archive` 都存在且 hash 不变。
- [x] 对比 Git `HEAD`，确认 69 个已跟踪旧归档文件在新路径逐字节一致，可作为纯 rename 提交。
- [x] 运行 `rtk git diff --check` 和 `rtk git status --short`；暂存范围只允许 69 个 rename 和本任务文档，原本未跟踪的 2026-07-13 归档及其他 `金庸/**` 用户数据不得加入索引。
- [ ] 完成后按 Trellis Phase 3.4/3.5 归档 task 和记录 journal。
