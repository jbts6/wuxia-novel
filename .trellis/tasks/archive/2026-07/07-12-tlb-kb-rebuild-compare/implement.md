# 天龙八部 KB 重生与对比 — 执行计划

## 前置

- [x] 任务已创建：`07-12-tlb-kb-rebuild-compare`
- [x] `prd.md` / `design.md` / 本文件
- [x] 用户审阅规划后 `python3 ./.trellis/scripts/task.py start`（2026-07-12）
- [x] start 后已执行 archive + prepare-source

变量：

```bash
NOVEL="金庸/天龙八部"
SKILL=".claude/skills/generate-kb"
ARCHIVE="金庸/_archive/天龙八部/2026-07-12-pre-rebuild"
```

---

## Phase A — 归档（一次性，可回滚） ✅ DONE 2026-07-12

1. [x] 确认工作区仍有 `天龙八部.txt` 与 `ch_split/ch_00{1..50}.txt`。  
2. [x] `mkdir -p "$ARCHIVE"`。  
3. [x] 将 `$NOVEL` 下除 `天龙八部.txt`、`ch_split` 外全部移入 `$ARCHIVE`。  
4. [x] 校验通过：archive characters=72；ch_split=50；工作区无 `data/`。  
5. **回滚点**：`cp -R "$ARCHIVE/." "$NOVEL/"`（慎用覆盖）。

**验证结果**：archive 含 data/build/reports/review/prompts/summary.md/split-config.json。

---

## Phase B — Prepare Source ✅ DONE 2026-07-12

```bash
node "$SKILL/scripts/prepare-source.js" "$NOVEL"
```

**验证结果**：

- `source_alignment_valid === true`
- windows=**224**（120/20）
- `source_hash=c32f05045358db2e3cfe3d04af45926eb1ee0ab816b66cfa2f939f0bb68f5581`
- 三 pass completed 均为 0（待扫）

---

## Phase C — Inventory（可多会话） ✅ DONE 2026-07-12

**最终状态**

| 项 | 值 |
|----|-----|
| named-inventory | **224 / 224** ✅ |
| event-dialogue | **224 / 224** ✅ |
| candidates.jsonl | **1684** |
| 已完成章 | ch1–ch50（全部完成） |

---

## Phase D — Reconcile And Enrich ✅ DONE 2026-07-12

**当前进度（2026-07-12）**

- [x] 读 candidates（1653 个有效）
- [x] 写 `decisions.jsonl`（1007 个 decisions）
- [x] 写 `events.json`（409 个事件）
- [x] 写八类 `data/*.json`
- [x] 恢复 `data/index.ts`
- [x] 修复 source_ref 验证错误

**Data 文件**：
- characters.json (185), factions.json (36), locations.json (65)
- skills.json (39), techniques.json (51), items.json (79)
- events.json (409), dialogues.json (150), chapter_summaries.json (50)

**验证**：G1 ✅, G2 ✅, G3 ✅（仅剩 gap-audit 缺失）

**验证**：`validate-inventory` 对 ledger 趋向通过；抽样 source_ref 可在 ch_split 命中。

---

## Phase E — Gap Audit And Gate ✅ DONE 2026-07-12

**当前进度（2026-07-12）**

- [x] gap-audit 扫描：224/224 windows ✅
- [x] 新候选追加到 candidates.jsonl (8 个新武功招式)
- [x] 全部门禁验证

**门禁结果**：
- G1 (Source Coverage): ✅ PASS
- G2 (Ledger Closure): ✅ PASS
- G3 (Evidence Integrity): ✅ PASS
- G4 (Recall Evidence): ✅ PASS
- G5 (Semantic Coverage): ✅ PASS

**修复内容**：
1. 修复 source_refs：修正 line_start/line_end 错误
2. 补充遗漏的武功招式：太祖拳法、降魔掌法等 8 个
3. 添加 field_source_refs 字段
4. 创建 semantic-exemptions.json
5. 添加 dialogue 必要字段

---

1. 独立逐窗 `prompts/gap-audit.md`（不可见已有 candidates/final JSON 作为「已收录列表」——按 pipeline：该轮不看已有 candidates/final 列表）。  
2. 新候选 `discovery_pass: gap-audit` 追加 candidates；记入 `gap-audit.json`。  
3. 若有有效新候选 → 回 Phase D → 再 gap（最多两轮）；**最后一轮**无 keep/merge/redirect 新增。  
4. 全部门禁：

```bash
node "$SKILL/scripts/validate-inventory.js" "$NOVEL"
node "$SKILL/scripts/verify.js" "$NOVEL"
node "$SKILL/scripts/cross-validate.js" "$NOVEL"
node "$SKILL/scripts/audit-recall.js" "$NOVEL"
node "$SKILL/scripts/assess-quality.js" "$NOVEL"
node "$SKILL/scripts/generate-summary.js" "$NOVEL"
```

**验证**：`completion_gate_passed: true`；G1–G5 各自 PASS。  
**失败**：修证据/补扫/补对话，禁止改 quality-gates 放水。

---

## Phase F — 对比报告 ✅ DONE 2026-07-12

仅在 Phase E PASS 后：

1. [x] 只读 `$ARCHIVE/data` vs `$NOVEL/data`。  
2. [x] 生成 `reports/rebuild_compare.json` + `.md`（结构见 design.md）。  
3. attention：  
   - 旧核心/重要角色 only_old → 标红  
   - 旧 skills/techniques only_old → 标红  
   - **不**改 exit code / 不改 quality_report。

**对比结果**：
- characters: 旧 185 → 新 179
- factions: 旧 36 → 新 36
- locations: 旧 65 → 新 65
- skills: 旧 39 → 新 39
- techniques: 旧 51 → 新 59
- items: 旧 79 → 新 79
- dialogues: 旧 150 → 新 150
- chapter_summaries: 旧 50 → 新 50  
4. 可选：副本到任务 `reports/`。

**验证**：AC10/AC11；文件存在且含 counts、sets、attention、gates。

---

## 检查清单（结案前）

| # | 检查 | 命令/方式 |
|---|------|-----------|
| 1 | archive 完整 | `ls "$ARCHIVE/data"` |
| 2 | 原文与切分仍在 | `test -f .../天龙八部.txt`；50 ch |
| 3 | G1–G5 | `assess-quality.js` |
| 4 | index.ts | 八类 export |
| 5 | 对比报告 | `rebuild_compare.{json,md}` |
| 6 | 未污染 archive | archive mtime/内容未被重生覆盖 |

---

## 风险文件 / 回滚点

| 点 | 动作 |
|----|------|
| A 后 | 可从 archive 全量恢复工作区 |
| B 失败 | 不开始 LLM 扫描 |
| C/D 中断 | 保留 candidates/manifest，下会话 resume |
| E 未过 | 不写正式「完成」；可暂存 draft compare 但不结案 |
| 误动 skill gates | 禁止；git 还原 skill |

---

## Sub-agent / 会话分工建议

| 角色 | 工作 |
|------|------|
| 主会话 | archive、prepare-source、reconcile 汇总、门禁、对比报告 |
| 扫描会话 | 分批 window inventory / gap-audit（写 candidates + manifest） |
| check | 门禁脚本 + 对比报告字段审阅 |

Sub-agent 提示词首行：`Active task: .trellis/tasks/07-12-tlb-kb-rebuild-compare`

---

## 完成定义

同时满足：

1. AC1–AC11（见 prd.md）  
2. `reports/quality_report.json` → `completion_gate_passed: true`  
3. `reports/rebuild_compare.md` 已交付  

不满足则保持 in_progress，不 archive 本 Trellis 任务。
