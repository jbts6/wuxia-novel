# 统一书籍归档目录设计

## Scope

这是一次性工作区整理，不是长期归档功能。只处理当前已经存在的作者级归档目录，不修改 `generate-kb` 六阶段状态机、`.kb/current`、publish/rollback 实现或历史 Trellis 任务记录。

规范目标：

```text
作者/书名/_archive/<归档批次>/
```

## Migration Map

| Source | Target | Action |
|---|---|---|
| `金庸/_archive/天龙八部/2026-07-12-pre-rebuild` | `金庸/天龙八部/_archive/2026-07-12-pre-rebuild` | move |
| `金庸/_archive/天龙八部/2026-07-13-pre-rebuild` | `金庸/天龙八部/_archive/2026-07-13-pre-rebuild-legacy-author-archive` | rename and move because target differs |
| `金庸/_archive/天龙八部/2026-07-13-quarantined-legacy-final` | `金庸/天龙八部/_archive/2026-07-13-quarantined-legacy-final` | move |
| `金庸/_archive/鸳鸯刀/2026-07-12-pre-human-gold` | `金庸/鸳鸯刀/_archive/2026-07-12-pre-human-gold` | move |

迁移使用同一文件系统内的目录移动，不复制、不合并、不覆盖。目标冲突只允许使用上表中的确定性后缀；如果后缀目标也已存在，停止并报告，不自动追加编号。

## Safety Boundary

迁移前记录四个源批次和一个已存在目标批次的文件数、字节数、聚合 SHA-256。移动后从新路径重新计算并逐一比对。只有全部比对通过，才删除空的 `金庸/_archive` 目录。

旧作者级归档中有 69 个已跟踪文件，必须作为纯 rename 提交到新路径，否则下次 checkout 会恢复旧布局。其中《天龙八部》`2026-07-12-pre-rebuild` 有 37 个文件，《鸳鸯刀》`2026-07-12-pre-human-gold` 有 32 个文件。两个 2026-07-13 批次原本未跟踪，迁移后仍保持未跟踪。

暂存范围只能包含这 69 个 rename 和当前 Trellis task 文档；不得暂存当前《天龙八部》的知识库 JSON、报告、build 产物、`.gitignore` 或其他用户修改。

## Rollback

如果移动后校验失败，停止后续操作；根据迁移映射将已移动批次原路移回，冲突批次按后缀反向移动。任何目标已经存在且内容不同的情况都在移动前停止，不进入半迁移状态。
