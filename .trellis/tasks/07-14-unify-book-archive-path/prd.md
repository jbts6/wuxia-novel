# 统一书籍归档目录

## Goal

将当前遗留的知识库归档目录一次性整理到书籍目录内：

```text
作者/书名/_archive/<归档批次>/
```

这样每本书的现有历史归档都能在同一书籍目录下定位，避免作者级 `_archive` 目录造成归属混淆。generate-kb 流程稳定后不再创建新的这类归档，因此本任务不建设长期归档能力。

## Confirmed Facts

- 当前历史归档至少存在于 `金庸/_archive/天龙八部/<归档批次>/`。
- 工作区已经出现 `金庸/天龙八部/_archive/`，但它尚未纳入版本控制。
- 用户要求统一采用 `作者/书名/_archive/<归档批次>/`，本任务面向所有书籍，不只处理《天龙八部》。
- 本任务不得把当前工作区已有的《天龙八部》未提交知识库修改混入提交。
- 当前只发现一个作者级归档根目录 `金庸/_archive/`，其中包含《天龙八部》和《鸳鸯刀》的历史归档；古龙、梁羽生和黄易目录下未发现作者级 `_archive`。
- `金庸/_archive/天龙八部/2026-07-13-pre-rebuild/` 与 `金庸/天龙八部/_archive/2026-07-13-pre-rebuild/` 同名但内容不同：前者 26 个文件，后者 11 个文件，不能直接覆盖或按目录合并。
- 仓库中没有统一的知识库归档路径计算器；作者级路径主要固化在历史 Trellis 任务文档和一次性脚本中。
- 用户已确认：旧作者级归档实际迁移到书籍内；同名且内容不同的批次保留双方，来源归档使用明确的 `-legacy-author-archive` 后缀。
- 用户已明确 generate-kb 稳定后不再产生这类归档；不需要新增通用归档模块、CLI、manifest、兼容查找或长期归档约定。
- Git 索引确认旧作者级归档中有 69 个已跟踪文件：`天龙八部/2026-07-12-pre-rebuild` 37 个、`鸳鸯刀/2026-07-12-pre-human-gold` 32 个；其余 2026-07-13 批次原本未跟踪。

## Requirements

- 将仓库内现有作者级归档实际迁移到对应书籍内 `_archive` 根目录。
- 归档批次目录保留现有批次命名，不改变归档内容语义。
- 同名但内容不同的归档必须 fail closed，禁止静默覆盖或目录合并。
- 迁移前后按批次计算内容 hash；只有目标 hash 与源 hash 一致才允许清理旧作者级路径。
- 迁移完成且作者级 `_archive` 为空后删除该空目录。
- 不修改 generate-kb 实现、技能文档或历史 Trellis 归档文档。
- 已跟踪的 69 个归档文件必须作为纯路径 rename 提交；原本未跟踪的归档继续保持未跟踪，不把其他 `金庸/**` 用户修改纳入提交。

## Acceptance Criteria

- [x] 新归档路径对任意作者和书名均为 `作者/书名/_archive/<归档批次>/`。
- [x] 当前 `金庸/_archive/` 下《天龙八部》和《鸳鸯刀》的批次全部迁入各自书籍目录，作者级 `_archive` 不再存在。
- [x] 同名冲突双方均被保留，且迁移前后每个批次的聚合 hash 不变。
- [x] 本任务不新增归档代码、CLI、manifest 或运行时依赖。
- [x] 当前《天龙八部》未提交修改保持未被任务提交触碰。
- [x] Git 提交只包含 69 个已跟踪归档文件的 rename 与本任务文档；原本未跟踪的 2026-07-13 归档不被新增到索引。

## Decision

本任务只执行现有目录的一次性迁移和 hash 验证，不新增任何归档实现、CLI、manifest、兼容逻辑、说明文档或运行时依赖。原本已跟踪的归档以纯 rename 形式提交；原本未跟踪的归档继续作为工作区数据保留。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
