# 天龙八部 KB 重生与对比 — 技术设计

## 1. 架构与边界

```
金庸/天龙八部/                  # 工作区（重生后）
  天龙八部.txt                 # 保留
  ch_split/                    # 保留（不重切）
  build/                       # 新：source-index, scan-manifest, candidates, decisions, events, gap-audit
  data/                        # 新：八类 JSON + index.ts
  reports/                     # 新：quality + rebuild_compare

金庸/_archive/天龙八部/
  2026-07-12-pre-rebuild/      # 只读基线
    data/ build/ reports/ ...
```

| 层 | 职责 | 禁止 |
|----|------|------|
| Archive | 冻结旧产物 | 重生过程写回 archive |
| Source | 原文 + ch_split + prepare-source | 用旧 JSON 当事实 |
| Inventory / Gap | 逐 window LLM 扫描 | 带入 data/*.json 或百科 |
| Reconcile | 归并、decision、丰富 | 无 source_ref 的实体入库 |
| Gate | G1–G5 硬门禁 | 伪造 ledger / gap |
| Compare | 只读 archive vs 新 data | 对比结果回写为 KB 事实 |

## 2. 数据流

```
[旧 data/build/reports/...]
        │ archive (mv)
        ▼
[_archive/.../2026-07-12-pre-rebuild] ──只读──► compare
        │
[ch_split + 天龙八部.txt]
        │ prepare-source.js
        ▼
source-index.json + scan-manifest.json
        │ window 扫描 × (named-inventory | event-dialogue)
        ▼
candidates.jsonl
        │ reconcile
        ▼
decisions.jsonl + events.json + data/*.json
        │ gap-audit (≤2 轮) → 必要时回 reconcile
        ▼
门禁脚本 → quality_report.json (G1–G5)
        │ PASS 后
        ▼
rebuild_compare.{json,md}
```

## 3. 契约

### 3.1 新 pipeline 中间产物

见 `$SKILL/schemas.md`「中间产物契约」：

- `source-index.json` / `scan-manifest.json`
- `candidates.jsonl`（含 discovery_pass、window_id、source_ref）
- `decisions.jsonl`（keep|merge|redirect|reject）
- `events.json` / 可选 `semantic-exemptions.json`
- `gap-audit.json`（最终 round 无有效新增）

### 3.2 最终八类

路径与字段：`$SKILL/schemas.md` + `$SKILL/constants.md`。

消费端：`data/index.ts` 保持：

```ts
export { default as characters } from './characters.json';
// ... skills, items, factions, locations, dialogues, techniques, chapter_summaries
```

### 3.3 对比报告契约

`reports/rebuild_compare.json` 建议结构：

```json
{
  "generated_at": "ISO-8601",
  "archive_path": "金庸/_archive/天龙八部/2026-07-12-pre-rebuild",
  "novel": "天龙八部",
  "old_quality": { "completion_gate_passed": true, "honest_overall_score": 87 },
  "new_quality": { "completion_gate_passed": true, "gates": {} },
  "counts": {
    "characters": { "old": 72, "new": 0, "delta": 0 }
  },
  "sets": {
    "characters": { "only_old": [], "only_new": [], "both": [] }
  },
  "attention": {
    "missing_legacy_core_characters": [],
    "missing_legacy_martial": []
  },
  "dialogue": { "old": 37, "new": 0, "old_chapter_coverage": 0.28 },
  "notes": []
}
```

名称匹配：trim + 全角/半角规范化；alias 双向展开；不依赖新旧 ID 一致。

`attention` **不**进入 `evaluateHardGates`；仅报告字段。

## 4. 关键组件

| 组件 | 路径 | 说明 |
|------|------|------|
| prepare-source | `$SKILL/scripts/prepare-source.js` | 建 index + manifest |
| validate-inventory | `.../validate-inventory.js` | G1/G2 相关 |
| verify / cross-validate / audit-recall / assess-quality | 同 scripts | 门禁链 |
| prompts | `$SKILL/prompts/{named-inventory,event-dialogue,gap-audit}.md` | 扫描 prompt |
| compare（新建） | 任务内 `scripts/compare-kb.js` 或 `$SKILL/scripts/compare-rebuild.js` | 可选；也可一次性 node 脚本生成报告 |

**不修改** G1–G5 实现（`lib/quality-gates.js`）语义。

## 5. 规模与执行模型

| 指标 | 估计 |
|------|------|
| 章 | 50 |
| windows | ~224 |
| inventory 扫描 | ~448 |
| gap-audit | ~224 × 1–2 轮 |
| 会话 | 多会话；靠 `scan-manifest.completed_window_ids` resume |

扫描驱动：**由执行 agent 按 window 调用模型**，将 JSONL 行追加到 `candidates.jsonl`，并更新 manifest。无现成「一键扫完全书」CLI 时，不得用旧 mention_index 代替 inventory。

## 6. 兼容与迁移

| 项 | 策略 |
|----|------|
| 旧 ID | 不保证与新 ID 相同；对比用 name/alias |
| 旧 importance 中英混用 | 新库统一中文枚举 |
| 旧 dialogues 缺 selection_* | 新库补齐 schema 字段 |
| outline.json | 非八类必需；重生不强制；若消费端依赖再评估 |
| split-config | 归档；不重切则工作区可不恢复 |

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 50 章扫描过长 / 中断 | manifest 断点；分批写 candidates |
| source 与 ch_split 不对齐 | prepare-source 失败则停，不盲扫 |
| 旧库「核心」缺失被误判为失败 | PRD：attention only，不阻断 |
| 误用旧 JSON 补实体 | 扫描 prompt 禁止；review 抽查 source_ref |
| archive 路径写错覆盖 | 归档前 `ls` 确认目标空/可建；保留 ch_split |

## 8. 回滚

1. **归档后、重生前**：工作区无 data → 可从 archive 整目录拷回。  
2. **重生中途失败**：保留 archive；可删工作区 `build/` `data/` 从 prepare-source 重来。  
3. **误改 archive**：禁止；若发生则从 git 恢复（归档应尽早 commit 或确保可还原）。

## 9. 与陆小凤任务关系

- 独立 task：`07-12-tlb-kb-rebuild-compare` vs `07-12-lxf-kb-generate`。  
- 共享 skill 契约，不共享 novel 目录状态。  
- 不在本任务修改 skill 以适配陆小凤切分问题。
