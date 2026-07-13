# 陆小凤传奇知识库生成

## Goal

对 `古龙/陆小凤传奇` 按 `generate-kb` 四阶段流水线，从合订本原文生成一套八类知识库 JSON，并通过 G1–G5 硬门禁（`completion_gate_passed: true`）。

## Background And Evidence

### 源文本

- 路径：`古龙/陆小凤传奇/陆小凤传奇.txt`（约 2.1MB / 43169 行 / 75 万字）。
- 当前无 `data/`、`build/`、`ch_split/`、`reports/`，属全量新建。
- 多卷合订，卷标形如 `小说：古龙《金鹏王朝》`，已定位 5 卷：
  1. 金鹏王朝（约 L450）
  2. 绣花大盗（约 L9422）
  3. 决战前后（约 L15844）
  4. 银钩赌坊（约 L23564）
  5. 幽灵山庄（约 L32106）
- 另有 `楔　子`（L1）与约 65 个「第N回」标题；**各卷回目编号重置**（「第一回」出现 5 次，副标题不同）。
- 本文件**未**包含《凤舞九天》《剑神一笑》等后续卷。

### 流水线与门禁

- 权威流程：`.claude/skills/generate-kb/pipeline.md`。
- 最终消费接口：`data/{characters,factions,locations,skills,techniques,items,dialogues,chapter_summaries}.json`。
- 完成条件：`assess-quality.js` 报告 `completion_gate_passed: true`，且 G1–G5 各自 PASS。
- 无人工金标时 `gold_status: no_gold` 可接受，不得用 LLM baseline 伪装完整性。

### 已知切分缺陷（本小说触发）

- `split-chapters.js` 以标题中的「第N回」写 `ch_00N.txt`；多卷重置会互相覆盖。
- 默认 chapter pattern 不匹配 `楔　子`；首段在第一个「第N回」之前的正文有丢失风险。
- 下游 `lib/source.js` 以 `ch_(\d+).txt` 数字为 chapter id；全局顺序号即可兼容，无需改 window 契约。

## Confirmed Decisions

| 决策 | 结论 |
|------|------|
| 范围 | 整本五卷一套 KB（非分卷多目录） |
| 章节编号 | 全局顺序号 `ch_001`…；manifest 保留卷名与原回目标题 |
| 任务结构 | 单任务：切章修复 + 全文生成一体完成 |
| 金标 | 默认 `no_gold`（不制作 human-gold） |
| Skill 契约 | 不修改 G1–G5 语义；仅允许为保证本小说可跑通而做的最小切分工具兼容改动 |

## Requirements

### R1. 原文唯一可信源

- 事实只来自 `陆小凤传奇.txt` 与其 `ch_split/`。
- 禁止百科、影视、读者记忆或其他改编补设定。
- 无法在原文定位的事实不得进入正式数据。

### R2. 多卷合订可切分且可恢复

- 切分后章节文件全局唯一、不覆盖；覆盖全书正文（含楔子与各卷）。
- manifest 至少记录：全局 chapter 号、原标题、所属卷（若可解析）。
- 切分或原文变更后必须重跑 `prepare-source.js`，不得沿用旧 source hash 下的 candidates/decisions。

### R3. 四阶段原文先行流水线

1. **Prepare Source**：split + `prepare-source.js` → `source-index.json` / `scan-manifest.json`
2. **Inventory From Source**：逐 window 的 named-inventory 与 event-dialogue → `candidates.jsonl`
3. **Reconcile And Enrich**：decisions + events + 八类最终 JSON
4. **Independent Gap Audit And Gate**：最多两轮 gap-audit，再跑全部门禁脚本

### R4. 八类产物与账本闭环

- 输出兼容八类 `data/*.json`（`schemas.md`）。
- 维护 `build/candidates.jsonl`、`build/decisions.jsonl`、`build/events.json`、`build/gap-audit.json`、`build/semantic-exemptions.json`（按需）。
- 命名武功/招式只分级、不因 importance 删除；角色/地点/势力/物品按剧情作用筛选，但每个候选必须有 keep/merge/redirect/reject。

### R5. 对话与语义覆盖

- 主要事件与 core/important 角色须有事件对话或人物特征对话。
- 缺证据时写可审计 exemption，不得静默跳过。

### R6. 质量门禁

- 依次运行：`validate-inventory`、`verify`、`cross-validate`、`audit-recall`、`assess-quality`、`generate-summary`。
- 仅当 G1–G5 全 PASS 才可声明完成。

## Out Of Scope

- 不生成本文件未收录的后续卷（如《凤舞九天》《剑神一笑》）。
- 不构建游戏数值或技能平衡。
- 不收录每个路人、普通环境物件。
- 不为通过门禁修改其他小说旧数据或伪造 gold。
- 不把 legacy baseline / 数量分当作完整性证明。
- 不重构整条 generate-kb 契约（G1–G5、schema 字段语义保持不变）。

## Acceptance Criteria

- [ ] AC1：`ch_split/` 全局唯一编号、无多卷覆盖；含楔子；`prepare-source` 产出有效 `source-index.json` 与 `scan-manifest.json`，`source_alignment_valid` 为 true。
- [ ] AC2：named-inventory、event-dialogue、最终 gap-audit 三类 pass 窗口 100% 覆盖（G1）。
- [ ] AC3：所有候选有合法 decision，保留项可追到 final ID（G2）。
- [ ] AC4：正式实体/摘要/对话证据可定位；grand weak/unverified = 0；对话全文命中（G3）。
- [ ] AC5：最终 gap round 无有效新增 keep/merge/redirect；命名武学闭环；`gold_status` 为 `no_gold` 或 `passed`（G4）。
- [ ] AC6：主事件与 core/important 角色对话覆盖或有合法 exemption；cross-validate 无阻塞错误（G5）。
- [ ] AC7：`reports/quality_report.json` 中 `completion_gate_passed: true`，G1–G5 各自 PASS。
- [ ] AC8：最终八类 JSON 位于 `古龙/陆小凤传奇/data/`，可被既有消费端读取。
- [ ] AC9：若修改 `split-chapters.js` / 切分配置，须保证既有单卷小说（如 `金庸/连城诀`）切分行为不回归，或有配置开关默认保持旧行为。

## Technical Notes

- `$NOVEL` 路径：`古龙/陆小凤传奇`
- Skill 根：`.claude/skills/generate-kb`
- 默认窗口：120 行，重叠 20 行；扫描进度依赖 `scan-manifest.json` 可恢复
- 相关文档：`pipeline.md`、`schemas.md`、`review.md`、`constants.md`
