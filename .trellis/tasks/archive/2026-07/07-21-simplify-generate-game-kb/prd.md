# PRD — 简化 `generate-game-kb` 技能

## 目标
在不削弱「溯源证据」保障的前提下，降低 `generate-game-kb` 技能的复杂度与门禁。该技能目前约有 50 个 lib 模块、60 个测试文件、一套零写入 Worker + guard + broker 生命周期、batch 调度、六处互锁哈希门禁，以及一个 legacy 迁移子系统。

## 已批准方向（用户 2026-07-21 决策）
依据 `trellis-before-dev`，项目的 Active `quality-guidelines.md` **明文强制**了那些待删除的机制。选定路径：**先修订规范，再重构代码**，使契约与实现始终保持同步。

## 范围
1. 将 `v4` / `lite` / `deep-*` 的拆分合并为单一 `generate-game-kb` 技能，用 `--deep`（或 `--domain`）开关替代独立技能。
2. 用扁平的 `extract-plan` + `submit` 模型取代 `status` / `guard-open` / `guard-check` / `submit-draft` / `lite-*`，每章一个 `chapter:NNN` 单元，无 batch 身份。
3. 最多 **5 个** sub-agent 并发（每章一个）；null/传输失败不消耗 attempt 直接跳过；一次显式 429 把并发池降到 3。
4. 仅保留两道硬门禁：`source_hash`（摄入）与 `final_data_hash`（产物）。`id_plan_hash` / `verification_report_hash` / `manifest_hash` / `archive_receipt_hash` 降级为告警，不再阻断。
5. 删除 legacy 迁移子系统（`migrate-legacy`、`audit-v6`、`legacy-*.js`）；旧书通过全新「溯源式重提取」带入新流程。
6. 简化有界重试：第二次提交失败进入 `manual_review`；仅用户确认的 `retry --confirm` 才开启新周期。
7. 新增顶层 `run` 命令，自动编排整条管线。
8. 强制**实体高召回**：章节单元逐章穷尽扫描，凡原文有明确命名且可绑定 `source_refs` 的具名实体（含一次性出场、别名/化名、显名招式、具名物品/势力）均须抽出为候选，抽取阶段不主动合并/去重；并设书级 `LOW_RECALL` 门禁——≥5 章小说最终去重实体总数 ≤9 时工作区验证失败、阻断安装与归档、要求重抽，杜绝中篇小说仅个位数实体的情况。

## 非目标
- 不得削弱溯源证据、命名技法规则、普通物品剔除、仅 faction 的 `allowed_faction_refs`，以及五文件 / `data_file_hashes` 安装契约。
- 不触碰无关的审计级 `.agents/skills/generate-kb`（六阶段）技能。

## 验收标准
- 真实语料（`古龙/剑神一笑`，20 章）跑通
  `prepare -> extract-plan -> submit* -> assemble -> verify -> install -> verify --installed -> archive-run`，
  产出恰好五个已安装 YAML 文件。
- `quality-guidelines.md` 的「快速游戏素材知识库 Profile」场景与新命令面匹配，且不再引用 guard / batch / broker / lite-* / migrate-legacy。
- 测试断言新契约（扁平单元、五宽并发、两哈希门禁、无 legacy 路径）。
