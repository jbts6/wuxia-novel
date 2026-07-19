# Lite 命名迁移后的 V5 残留审计

审计时间：2026-07-19。范围包括 Git 已跟踪文件、非忽略的工作树新增文件和实际目录名；本审计文件及英文审计文件中的引用不计为产品残留。

## 最终结论

- 生产 runtime/CLI 中作为轻量产品名称的 V5 残留为 **0**。不存在公开 `v5-*` 命令、当前 `PROFILE_V5` symbol、`resolvePublishedV5Paths` 或可新写入的 `profile: v5`。
- `generate-game-kb-lite` 与四个 `generate-game-kb-deep-*` Skill 中的产品性 V5 残留为 **0**。
- 历史计划、旧实施报告、Trellis 任务/会话标题中的产品性 V5 残留为 **0**。
- 实际旧目录为 **0**；归档任务目录及入站引用已统一为 `07-18-game-kb-lite-skill-contracts`。
- 排除两份审计引用、两个用户文件、package-lock/hash 和 `Lv5` 等词法误报后，扩展复扫（检查 V5 子串、`version[ -]5` 和 `semantic_contract_version: 5`）命中 15 个文件、69 行；全部属于旧输入兼容、负向门禁或真实的 semantic-contract version 5 / 旧 run 证据。

## 自动门禁

`.agents/skills/generate-game-kb/tests/lite-residue-contract.test.js` 当前为 **4/4 通过**：

1. 已跟踪产品/测试/归档路径只使用 Lite 命名。
2. 生产 runtime 不暴露公开 `v5-*` 命令或当前 V5 runtime symbol。
3. Lite 是唯一当前轻量 Skill 目录。
4. 历史产品叙述、父任务链接和 Trellis 会话标题使用 Lite 命名。

该门禁故意保留负向字符串，例如已移除的 `v5-prepare` 和 `generate-game-kb-v5`，用于防止它们重新出现。

## 已完成的产品命名迁移

- Skill：`generate-game-kb-v5` → `generate-game-kb-lite`。
- CLI：`v5-prepare/status/accept/basic-curate/publish` → 对应 `lite-*` 命令。
- 当前 profile：`v5` → `lite`；`LEGACY_PROFILE_V5 = 'v5'` 仅作为只读兼容输入保留。
- 测试/辅助文件：`v5-*` → `lite-*`。
- 归档任务：`07-18-game-kb-v5-skill-contracts` → `07-18-game-kb-lite-skill-contracts`，并同步父任务、JSONL 和任务文档引用。
- Superpowers 计划、Skill split 设计、旧实施报告和 Trellis Session 20 标题均改用 Lite；Lite 合同同步为 semantic contract version 6。

## 必须保留的 V5

以下命中不是产品名称，不能改成 Lite：

- 4 个 runtime 文件、14 行：`LEGACY_PROFILE_V5` 的只读识别、迁移和拒写边界。
- 5 个测试文件、32 行：旧 profile/旧命令负向断言、真实 V5→V6 章节导入和兼容测试；其中若干行是用于捕获旧名称的正则字面量。
- backend spec、归档 V4 收据计划、当前任务设计/计划/PRD、工作区日志共 6 个文件、23 行：semantic-contract version 5、旧章节形状、受控导入和不可变旧 run 的事实。

其中最关键的 4 文件、7 行实测证据为：

- `.trellis/spec/backend/quality-guidelines.md:259,275`
- 当前任务 `design.md:97`
- 当前任务 `implement.md:7,217,218`
- `.trellis/workspace/jbts6/journal-1.md:58`

把这些内容改成 Lite 会篡改旧 run 的版本、导入输入形状或哈希不变性证据。

## 排除项

- 两份 `lite-residue-audit*.md` 会引用已移除的旧名称，用于记录门禁和迁移边界。
- `dashboard/package-lock.json` 的命中是 integrity/hash 子串。
- `docs/superpowers/specs/2026-05-28-wuxia-data-pipeline-design.md:87` 的 `Lv5` 表示等级 5。
- `.workbuddy/memory/2026-07-19.md` 与 `docs/wuxia-kb-build-priority.md` 是用户内容，未修改。
- `.superpowers/sdd/task-8-brief.md`、`task-8-report.md` 和两份 `review-*.diff` 是被 `.superpowers/sdd/.gitignore` 排除的临时派工/审查快照，允许保留历史旧名称，未修改。
- 真实旧 run `古龙/剑神一笑/.game-kb-work/runs/run-jian-shen-yi-xiao-v4-real-20260718/` 中的 13 个 version-5 合同字段是不可变证据，未修改。

## 完成标准

本次迁移满足以下条件：

1. 当前轻量产品、Skill、CLI、profile、测试和任务路径统一使用 Lite。
2. `lite-residue-contract.test.js` 4/4 通过。
3. 每个剩余 V5 命中均可归入旧版本证据、`LEGACY_PROFILE_V5` 兼容、负向断言、审计引用或明确误报。
4. 用户文件保持不变。
