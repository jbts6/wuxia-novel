# 天龙八部知识库重生与对比

## Goal

将 `金庸/天龙八部` 的**旧流水线产物完整归档**后，按 `generate-kb` 四阶段原文先行流水线**全量重生**八类知识库；并产出一份**新旧产物对比报告**。重生必须通过 G1–G5 硬门禁；对比报告审计相对旧库的召回/取舍差异，旧核心实体缺失仅标红不阻断。

## Background And Evidence

### 源文本与切分（保留）

| 项 | 现状 |
|----|------|
| 原文 | `金庸/天龙八部/天龙八部.txt`（约 3.6MB） |
| 切分 | `ch_split/ch_001.txt`…`ch_050.txt`（50 章，约 21006 行） |
| 切分配置 | `split-config.json`（旧产物，将归档；重生时**不重切**，沿用既有 `ch_split/`） |
| 预估扫描窗 | 默认 120 行 / 重叠 20 行 → 约 **224 windows**；named-inventory + event-dialogue ≈ **448** 次窗口扫描，另加 gap-audit |

用户确认：**除 `ch_split/` 与 `天龙八部.txt` 外，其余均可 archive。**

### 旧产物快照（对比基线）

| 文件 | 数量/说明 |
|------|-----------|
| `data/characters.json` | 72（importance 混用中英：核心/重要/次要/龙套 + important/secondary/minor） |
| `data/factions.json` | 12 |
| `data/locations.json` | 26 |
| `data/skills.json` | 27（多数缺 importance） |
| `data/techniques.json` | 10 |
| `data/items.json` | 15 |
| `data/dialogues.json` | 37（章覆盖约 28%；无 `selection_type`） |
| `data/chapter_summaries.json` | 50 |
| `data/outline.json` | 4（非八类核心消费接口） |
| `data/index.ts` | 八类 re-export（重生后必须恢复） |
| `build/` | legacy：`baseline.json`、`mention_index.jsonl` 等；**无** source-index / candidates / decisions / gap-audit |
| `reports/quality_report.json` | 旧：`completion_gate_passed: true`，honest 87；含 baseline 自指警告 |

旧库属 **legacy 多 Phase 流水线**。旧 `completion_gate_passed` **不能**当作新 G1–G5 通过证明。

### 新流水线与门禁（权威）

- Skill：`.claude/skills/generate-kb`
- 流程：`pipeline.md` 四阶段  
  1. Prepare Source → `build/source-index.json` + `scan-manifest.json`  
  2. Inventory From Source → 逐窗 named-inventory / event-dialogue → `candidates.jsonl`  
  3. Reconcile And Enrich → `decisions.jsonl` + `events.json` + 八类 `data/*.json`  
  4. Independent Gap Audit And Gate → `gap-audit.json` + 全部门禁脚本  
- 完成条件：`assess-quality.js` → `completion_gate_passed: true`，G1–G5 各自 PASS  
- 最终消费接口：八类 JSON + `data/index.ts`

### 任务边界（已确认）

| 决策 | 结论 |
|------|------|
| Trellis 任务 | `07-12-tlb-kb-rebuild-compare`（与陆小凤任务独立） |
| `$NOVEL` | `金庸/天龙八部` |
| 归档路径 | `金庸/_archive/天龙八部/2026-07-12-pre-rebuild/` |
| 保留原位 | `天龙八部.txt`、`ch_split/` |
| 是否重切章 | **否**（仅 `prepare-source.js`） |
| 人工金标 | `no_gold`（不制作 human-gold） |
| 重生完成标准 | **必须**新 G1–G5 全 PASS 才结案 |
| 旧核心实体缺失 | 对比报告 **attention 标红，不阻断** 门禁 / 任务完成 |
| Skill 契约 | 不改 G1–G5 语义；不为过门禁伪造 evidence / gold |
| 任务结构 | 单任务：archive → 重生 → 对比报告 |

## Requirements

### R1. 安全归档旧产物

- 在写入任何新 `data/` / `build/` **之前**完成归档。
- 路径：`金庸/_archive/天龙八部/2026-07-12-pre-rebuild/`。
- 移动/复制除 `天龙八部.txt`、`ch_split/**` 外的全部现有文件（至少含 `data/`、`build/`、`reports/`、`review/`、`prompts/`、`summary.md`、`split-config.json`）。
- 归档后工作树不得再依赖旧 baseline / mention_index 作为事实源。
- 归档后必须仍能从 archive 路径完整读取旧八类 JSON 与旧 quality report。

### R2. 原文唯一可信源重生

- 事实只来自 `天龙八部.txt` 与其 `ch_split/`。
- 禁止百科、影视、读者记忆、**旧 KB JSON** 作为事实来源。
- 旧库仅用于：对比报告；可选 `expected_from_legacy` attention 清单（**不**写入 gold、**不**自动 fail G4）。
- 严格按四阶段流水线；不得把 legacy 数量分 / 旧 PASS 当作完整性证明。

### R3. 八类产物 + 账本 + 消费接口

- 产出兼容 `schemas.md` / `constants.md` 的八类 `data/*.json`。
- `character.importance` / `role` 使用中文枚举：`核心 | 重要 | 次要 | 龙套 | 背景`。
- 维护：`source-index.json`、`scan-manifest.json`、`candidates.jsonl`、`decisions.jsonl`、`events.json`、`gap-audit.json`、按需 `semantic-exemptions.json`。
- 命名武功/招式：只分级，不因 `trivial` / `non_major` 删除。
- 角色/地点/势力/物品：可按剧情作用筛选，每个候选必须有 keep/merge/redirect/reject。
- 恢复 `data/index.ts`（与归档前同等的八类 re-export）。

### R4. 对话与语义覆盖

- 主要事件与「核心/重要」角色须有事件对话或人物特征对话，或有可审计 exemption。
- 对话必须含完整原话、`selection_type` / `selection_reason`、可定位上下文（及新 schema 要求的相关字段）。

### R5. 质量门禁（新契约，硬完成条件）

依次运行并全部通过：

```bash
node .claude/skills/generate-kb/scripts/validate-inventory.js 金庸/天龙八部
node .claude/skills/generate-kb/scripts/verify.js 金庸/天龙八部
node .claude/skills/generate-kb/scripts/cross-validate.js 金庸/天龙八部
node .claude/skills/generate-kb/scripts/audit-recall.js 金庸/天龙八部
node .claude/skills/generate-kb/scripts/assess-quality.js 金庸/天龙八部
node .claude/skills/generate-kb/scripts/generate-summary.js 金庸/天龙八部
```

仅当 `reports/quality_report.json` 中 `completion_gate_passed: true` 且 G1–G5 各自 PASS 才可声明**重生完成**与本任务结案。

中途可写中间版对比笔记，但**不得**以「尽力重生 + 报告」替代门禁通过。

### R6. 新旧对比报告

门禁通过后生成正式对比报告（正式 `data/` 齐备后）：

| 交付物 | 路径 |
|--------|------|
| 机器可读 | `金庸/天龙八部/reports/rebuild_compare.json` |
| 人读摘要 | `金庸/天龙八部/reports/rebuild_compare.md` |
| 任务副本（可选） | `.trellis/tasks/07-12-tlb-kb-rebuild-compare/reports/rebuild_compare.md` |

报告至少包含：

1. **归档元数据**：archive 路径、旧 quality 摘要、归档时间。  
2. **数量对比**：八类 count 旧 vs 新（含 Δ）。  
3. **集合差分**（主键：`name` 规范化 + alias 展开）：only_old / only_new / both。  
4. **attention 标红清单**（不阻断）：  
   - 旧库 `importance ∈ {核心, 重要, core, important}` 的角色，若新库名称/alias 均无匹配 → `attention_missing_legacy_core`  
   - 旧库全部 skills / techniques 名称，若新库无匹配 → `attention_missing_legacy_martial`（提示复查，因新契约要求命名武学高召回）  
   - 不因此自动 fail G1–G5。  
5. **对话**：条数、章覆盖、字段完备性（`selection_type` 等）。  
6. **门禁对照**：旧 legacy gate 摘要 vs 新 G1–G5（明确旧 PASS ≠ 新 PASS）。  
7. **解读**：不强制「新数量 ≥ 旧」；合法 reject 须能在 decisions 中解释。

对比**只读** archive + 新 data，不修改 archive。对比脚本可放在 skill `scripts/` 或任务目录。

## Out Of Scope

- 不重切 `ch_split/`（除非 `source_alignment_valid` 失败再单独立项）。  
- 不制作 human-gold。  
- 不修改 G1–G5 语义或其它小说数据。  
- 不把旧 baseline / mention_index 迁入新 build 冒充 ledger。  
- 不生成游戏数值、技能平衡。  
- 不在本任务内完成陆小凤等其它小说。  
- 不要求新库机械复现每一条 only_old 实体（筛选允许合法 reject；须可审计）。  
- 不因 only_old 核心实体缺失而阻断任务完成。

## Acceptance Criteria

- [ ] **AC1 归档**：`金庸/_archive/天龙八部/2026-07-12-pre-rebuild/` 含旧 `data/`（八类 + index.ts）、`build/`、`reports/` 等；工作树仍有 `天龙八部.txt` 与 50 个 `ch_split` 文件。  
- [ ] **AC2 Source**：`prepare-source.js` 成功；`source_alignment_valid === true`，hash 与原文/ch_split 一致。  
- [ ] **AC3 窗口覆盖（G1）**：named-inventory、event-dialogue、最终 gap-audit 三类 pass 100% 覆盖；每章恰好一条结构完整的 chapter summary。  
- [ ] **AC4 账本（G2）**：所有 candidate 有合法 decision；keep 可追到 final id。  
- [ ] **AC5 证据（G3）**：实体/摘要/对话可定位；grand weak/unverified = 0；对话全文命中。  
- [ ] **AC6 召回（G4）**：最终 gap round 无有效 keep/merge/redirect 新增；命名武学闭环；`gold_status` 为 `no_gold` 或 `passed`。  
- [ ] **AC7 语义（G5）**：主事件与「核心/重要」角色对话覆盖或合法 exemption；cross-validate 无阻塞错误。  
- [ ] **AC8 完成门禁**：`reports/quality_report.json` 中 `completion_gate_passed: true`，G1–G5 各自 PASS。  
- [ ] **AC9 消费接口**：八类 JSON + `data/index.ts` 可被既有方式 import。  
- [ ] **AC10 对比报告**：`reports/rebuild_compare.{json,md}` 存在，含数量表、only_old/only_new、门禁对照、attention 标红清单与解读；基线路径指向 archive。  
- [ ] **AC11 不阻断约定**：attention 清单可非空；只要 G1–G5 PASS 即允许结案（attention 仅供人工复查）。

## Technical Notes

- `$NOVEL`：`金庸/天龙八部`  
- `$SKILL`：`.claude/skills/generate-kb`  
- 默认窗口：120 / 重叠 20；进度靠 `scan-manifest.json` 断点续跑  
- 规模：约 224 windows × 多 pass，预计**多会话**；实现计划须支持 resume  
- 权威文档：`pipeline.md`、`schemas.md`、`review.md`、`constants.md`  
- 同类任务：`.trellis/tasks/07-12-lxf-kb-generate/`（新建向；本任务额外含 archive + compare）
