# 设计 — 简化 `generate-game-kb`

## 唯一真相源
`.trellis/spec/backend/quality-guidelines.md` 的「场景：快速游戏素材知识库 Profile」（已修订）与「场景：Legacy 知识库（无原地迁移）」。

## 命令面（目标）
```
prepare <novel> --run <id>            # 归档已有 data，创建/恢复 run，构建 manifest
extract-plan <novel> --run <id>      # 扁平的 chapter:NNN 单元列表（无 batch_id）
submit <novel> --run <id> --unit chapter:NNN --attempt <n> --json < envelope.json
plan-domains <novel> --run <id>      # 仅 --deep 下使用
assemble <novel> --run <id>
verify <novel> --run <id> --json
install <novel> --run <id> --json
verify <novel> --installed --json
archive-run <novel> --run <id>
run <novel> --run <id> [--deep]      # 编排整条管线
```

## 删除的模块
- `lib/worker-guard.js` — 整体删除。`ch_split` 是确定性的，且 Worker 从不落盘，因此不需要任何 guard 阶段；`submit` 仅保留普通的命令内输入校验（信封形状、schema 版本、unit/attempt/input-hash 身份）。
- `lib/chapter-batching.js`（`workerAssignments`、batch 尺寸）— 删除；`extract-plan` 产出扁平单元（无 batch_id）。
- `lib/legacy-*.js`、`scripts/audit-v6.js` — 删除。
- `lib/submission-journal.js`、`lib/draft-recovery.js` — 删除（与 batch/broker 绑定的恢复逻辑）。
- `lib/worker-pool.js` — 简化为普通的 5→3 并发计数器。
- 保留：`source`、`accept`、`assemble`、`verify`、`install`、`archive`、`semantic-contract`、
  `progress`、`paths`、`candidate-registry`、`domain-work`、`overlay`（后续精简）。

## 编排
`flow.js run` 在内部循环各阶段，仅在硬门禁或 `manual_review` 处停下。AI 仍负责派发 sub-agent（这是 AI 能力而非脚本能力），但契约面从 guard-open/guard-check/submit-draft 那套舞蹈，简化为一次 `extract-plan` 调用 + N 次 `submit` 调用。

## 哈希门禁
`assertAssembleInputs` 与 `verify` 仅保留 `source_hash` + `final_data_hash` 作为硬门禁。归档回执仍可记录其余哈希用于溯源，但漂移仅作告警。

## 技能文档
- 将 `generate-game-kb/{SKILL.md,SKILL-cn.md}`、`generate-game-kb-lite/*` 以及四个 `generate-game-kb-deep-*` 合并为单一 `generate-game-kb/SKILL.md`（中文，单源）。
- 合并后的单份 SKILL 必须包含**实体高召回**条款（已写入 `quality-guidelines.md` 的「快速游戏素材知识库 Profile」场景）：章节单元逐章穷尽扫描、具名实体（含一次性出场、别名/化名、显名招式、具名物品/势力）全部作为候选抽出并各自绑定 `source_refs`、抽取阶段不主动合并/去重、不凭记忆产出实体；以及书级 `LOW_RECALL` 门禁（≥5 章小说最终去重实体总数 ≤9 时工作区验证失败、阻断安装与归档、要求重抽）。
- 保留并更新 `examples.md` / `prompts/extract-chapters.md`，改用新命令名。
