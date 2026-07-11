# Implement: generate-kb 多情剑客无情剑

## Preconditions

- [x] 原文存在：`古龙/多情剑客无情剑/多情剑客无情剑.txt`
- [x] 用户同意创建 Trellis 任务并规划
- [ ] 规划评审通过后：`python3 ./.trellis/scripts/task.py start`

`NOVEL=古龙/多情剑客无情剑`  
`SKILL=.agents/skills/generate-kb`

## Checkpoint rules

- 每 Phase 完成后立即验证并勾选；不重复已通过检查。
- 同一步最多重试 3 次。
- 脚本输出写入 `reports/` 或 build，不在对话里倾倒大文件。

---

## Phase 0 — 环境

1. 确认 skill scripts 与默认 prompts 可读。
2. 可选：对照 `古龙/飞刀，又见飞刀/split-config.json` 起草本书 `split-config.json`（回目 + 李寻欢/阿飞/小李飞刀等 seed）。

## Phase 1 — split + mention

```bash
node $SKILL/scripts/split-chapters.js "$NOVEL"
node $SKILL/scripts/compact-mention.js "$NOVEL"
```

**Gate**：`ch_split/` 章数合理；`build/manifest.json`、`build/mention_index.jsonl`、`build/mention_summary.json` 存在。

## Phase 1.2 — keywords（LLM）

- 输入：manifest + mention_summary + 原文采样（前3+中2+末2）
- 输出：`build/keywords.json`（数组，长词优先；角色/门派/地/功/物/事件）
- 可参考 `$SKILL/prompts/generate-keywords.md`

**Gate**：非空数组，含本书核心专名。

## Phase 1.5 — outline

- 生成/写入 `data/outline.json` 或 pipeline 约定路径的骨架清单（characters/factions/locations/skills）。
- 若专属 `prompts/outline.md` 尚未生成：可先用先验草稿，Phase 1.6 后再对齐。

## Phase 1.7 — 独立 baseline（Pass1 前）

```bash
node $SKILL/scripts/generate-baseline-prompt.js "$NOVEL"
# LLM 写入 build/baseline.json
```

**Gate**：含 relationships≥15、events≥20、dialogues≥10；非 data 拷贝。

## Phase 1.6 — prompt-craft

- 读 `$SKILL/prompts/prompt-craft.md` + manifest/mention/采样
- 写出 `$NOVEL/prompts/`：`outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-all.md`（及 extract-dialogues 等按需）

## Phase 1.6.5 — prompt 校验

- 校验章节号、事件分配、角色列表；修张冠李戴后再进入 Pass1。

## Phase 2 Pass1 — 五实体 JSON

- 输出：`data/characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`
- 然后：

```bash
node $SKILL/scripts/fix-relationships.js "$NOVEL"
node $SKILL/scripts/extract-keywords.js "$NOVEL"
```

## Phase 3 初轮 — locate / verify

```bash
node $SKILL/scripts/locate.js "$NOVEL"
node $SKILL/scripts/verify.js "$NOVEL"
node $SKILL/scripts/report.js "$NOVEL"
node $SKILL/scripts/cross-validate.js "$NOVEL"
node $SKILL/scripts/check-skill-items.js "$NOVEL"
```

**Gate**：locate 率尽量 ≥95%；errors 清零或进入可控修复循环（≤3）。  
若缺 `fix-chapter-refs.js`：用脚本/批处理修正 source_refs 章节后重跑 locate。

## Phase 2 Pass2 — items + chapter_summaries

- 按章读原文生成；禁纯标题模板
- `items.json` 含 `tags` 与 `rarity_tier`

## Phase 2.6 — 实体审核

- 按 `review.md`：广撒网 → 精挑选；修 rank/分类/混入兵器的 skill 等

## Phase 2.2 — chapter_summaries 交叉验证

- key_events 与原文关键词对齐；错位章修正

## Phase 2.5 — dialogues

- LLM 读原文 + 事件锚定批量提取
- `verify_dialogues.js` → `locate-dialogues.js` 删幻觉、校正行号

**Gate**：quote 原文命中 ≥95%（最终 honest 门槛）

## Phase 3 完整 + 3.5 对抗

- 重跑 locate/verify/report/cross-validate/check-skill-items
- `review-dialogues.js` + LLM reviewer → `review/review-result.json`；按不通过条件修复

## Phase 3.6 — assess-quality

```bash
node $SKILL/scripts/assess-quality.js "$NOVEL"
```

**Gate**：`completion_gate_passed === true`，`honest_overall_score ≥ 85`

## Phase 3.7 — summary

```bash
node $SKILL/scripts/generate-summary.js "$NOVEL"
```

**Gate**：`summary.md` 存在且与 reports 一致

## Final checklist

- [ ] 8 JSON 可解析
- [ ] errors=0
- [ ] completion_gate PASS
- [ ] baseline 非 invalid_self_ref
- [ ] summary.md

## Review gates

1. **Start gate**：prd + design + implement 评审 → `task.py start`
2. **Mid gate**：Pass1 + 初 locate 后是否继续 Pass2
3. **Done gate**：assess-quality + summary

## Rollback points

| 点 | 动作 |
|----|------|
| Split 坏 | 改 split-config，删 ch_split/build 相关，重 Phase1 |
| Baseline 自指 | 删 baseline，重 1.7 |
| Locate 崩 | 修 keywords/source_refs，≤3 次 |
| Dialogue 幻觉 | locate-dialogues 删除后重评估 |

## Sub-agent notes

- 实现/校验可派 `trellis-implement` / `trellis-check`；prompt 首行：`Active task: .trellis/tasks/07-11-generate-kb-duogqing-jianke`
- 大批量 LLM 生成在本会话或子代理中按 Phase 执行；主会话只协调与跑脚本门禁。
