# 陆小凤传奇 KB 进度笔记

**Active task:** `.trellis/tasks/07-12-lxf-kb-generate`  
**$NOVEL:** `古龙/陆小凤传奇`  
**$SKILL:** `.claude/skills/generate-kb`

## 已完成

### Stage 0–1 切分与 Prepare Source

- [x] `split-chapters.js` 增加 `numbering: "sequential"`（默认关闭）
- [x] 顺序模式下写全局 `ch_NNN`；manifest 含 `volume` / `original_number`
- [x] `古龙/陆小凤传奇/split-config.json`
- [x] 切分验收：66 章、无覆盖、含楔子、五卷边界正确
- [x] `prepare-source.js`：`source_alignment_valid: true`，**450 windows**
- [x] source hash: `4af9da6c25965b9b69497f8d804548ba7d514ac9a6508dfe7e5799f124bd1b5c`

### Stage 2 named-inventory（部分）

| 章节 | windows | candidates (approx) | partial |
|------|---------|---------------------|---------|
| ch001–006 | 40 | 454 | `build/partials/named-inventory.ch001-006.jsonl` |
| ch007–013 | 58 | 720 | `build/partials/named-inventory.ch007-013.jsonl` |
| ch014–023 | 66 | 1076 | `build/partials/named-inventory.ch014-023.jsonl` |
| **合计** | **164 / 450** | **~2250** | 已 merge 进 `build/candidates.jsonl` |

- event-dialogue：**0 / 450**
- gap-audit：**0 / 450**

## 待做（严格顺序）

1. **named-inventory 扫完 ch024–066**（约 286 windows，分 4 批）
   - ch024–035 决战前后
   - ch036–047 银钩赌坊
   - ch048–056 幽灵山庄前
   - ch057–066 幽灵山庄后
2. merge：`node $SKILL/scripts/merge-partials.js "$NOVEL" --pass named-inventory`
3. **event-dialogue 全 450 windows**（同样可恢复）
4. `validate-inventory.js`（named+event 无漏扫）
5. Stage 3 Reconcile → Stage 4 Gap Audit → 门禁

## 辅助脚本

- `scripts/window-batch.js` — 导出未完成 window 批次
- `scripts/merge-partials.js` — 合并 `build/partials/<pass>*.jsonl` 并更新 manifest  
  注意：CLI 为 `merge-partials.js <novel-dir> [--pass name]`，**无** `--partial` 单文件参数；partial 按 pass 名 glob。

## 分派模板（agent 恢复后）

```
Active task: .trellis/tasks/07-12-lxf-kb-generate
$NOVEL=古龙/陆小凤传奇
$SKILL=.claude/skills/generate-kb
Pass: named-inventory
Chapters: chXXX–chYYY
Prompt: $SKILL/prompts/named-inventory.md
Output: $NOVEL/build/partials/named-inventory.chXXX-YYY.jsonl
Rules: 只读当前 window；source_ref 逐字；不读 data/ 其他窗；完成后 merge-partials
```

## 阻塞

- 2026-07-12 会话中途：`Agent` / 部分 Bash 因 `grok-4.5[1m]` 安全分类器暂时不可用，无法继续并行扫窗。
- 恢复条件：分类器可用后，从 ch024 起继续 named-inventory。

## 禁止

- 改 G1–G5 阈值凑 PASS
- source hash 变更后沿用旧 candidates
- 用百科/记忆补实体


## 进度更新 (2026-07-12T03:52:17.814Z)

- named-inventory: **350 / 450**
- candidates: 3800
- 剩余: **100** 窗（ch050-ch066）
- event-dialogue / gap-audit: 0
- 下一断点: ch050_w003
- 本批导出: ch050_w003, ch050_w004, ch050_w005, ch050_w006, ch051_w001, ch051_w002, ch051_w003, ch051_w004, ch051_w005, ch052_w001, ch052_w002, ch052_w003, ch052_w004, ch052_w005, ch052_w006, ch052_w007, ch053_w001, ch053_w002, ch053_w003, ch053_w004
