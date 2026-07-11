# Implement: generate-kb 飞刀，又见飞刀

## Paths

- novelDir: `古龙/飞刀，又见飞刀`
- skill: `.agents/skills/generate-kb`
- scripts: `node .agents/skills/generate-kb/scripts/<name>.js <novelDir>`

## Checklist

### Gate: start only after PRD/design/implement review

- [ ] `task.py start`（status → in_progress）

### Phase 0 — 前置

- [ ] 确认 `古龙/飞刀，又见飞刀/飞刀，又见飞刀.txt` 存在
- [ ] 创建 `data/` `build/` `prompts/` `reports/` `review/` 如需

### Phase 1 — split + mention

- [ ] `node .../split-chapters.js "古龙/飞刀，又见飞刀"`
- [ ] `node .../compact-mention.js "古龙/飞刀，又见飞刀"`
- [ ] 验证：`ch_split/`、`build/manifest.json`、`build/mention_index.jsonl`、`build/mention_summary.json`

### Phase 1.2 — keywords

- [ ] LLM 生成 `build/keywords.json`（角色/门派/地名/功法/物品/事件；按长度降序）
- [ ] 可选：对照 mention_summary 补高频词

### Phase 1.5–1.6.5 — outline + prompts

- [ ] 生成/完善 `outline.json`（及 outline.md 若流程需要）
- [ ] 生成专属：`outline.md`、`pass1-entities.md`、`pass2-details.md`、`review-all.md`
- [ ] 校验 prompt：章节号、事件分配、角色列表无张冠李戴

### Phase 2 Pass 1 — 实体骨架

- [ ] 生成 `data/characters.json` `factions.json` `locations.json` `skills.json` `techniques.json`
- [ ] `node .../extract-keywords.js "古龙/飞刀，又见飞刀"` 刷新 keywords

### Phase 3（实体轮）— locate/verify

- [ ] 章节 source_refs 修正（fix-chapter-refs 若存在，否则手工/脚本修）
- [ ] `locate.js` → `verify.js` → `report.js` → `cross-validate.js` → `check-skill-items.js`
- [ ] locate 率 ≥ 95%；errors 处理（最多 3 轮 prompt/数据修复）

### Phase 2 Pass 2 — 细节

- [ ] 生成 `items.json`（含 tags、rarity_tier）、`chapter_summaries.json`
- [ ] Phase 2.6 实体审核（review.md）
- [ ] Phase 2.2 chapter_summaries 交叉验证
- [ ] Phase 2.5 dialogues：读 ch_split + extract-dialogues 方案分批提取
- [ ] `verify_dialogues.js` + `locate-dialogues.js`

### Phase 3 全量 + 3.5–3.7

- [ ] 全量 locate/verify/cross-validate/check-skill-items
- [ ] 对抗校验 → `review/review-result.json`
- [ ] baseline + `assess-quality.js`（综合 ≥ 95% 且单项达标）
- [ ] `generate-summary.js` → `summary.md`
- [ ] 最终：8 JSON 可解析、errors = 0

### Quality gate

- [ ] trellis-check / 对照 prd 验收清单勾选

## Validation commands

```bash
node .agents/skills/generate-kb/scripts/locate.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/verify.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/report.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/cross-validate.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/check-skill-items.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/assess-quality.js "古龙/飞刀，又见飞刀"
node .agents/skills/generate-kb/scripts/generate-summary.js "古龙/飞刀，又见飞刀"
```

## Review gates

1. 规划产物评审后 `task.py start`
2. Pass1 + 首轮 locate 通过后再全力 Pass2
3. 质量评估通过后再归档/收工

## Rollback points

- 仅 Phase 1 失败：删 `ch_split/` `build/` 重跑
- Pass1 质量差：保留 split，重写 data 五实体 JSON
- 终检失败：按报告修实体/dialogues/baseline，不重拆章除非 split 错误

## Sub-agent notes

- Active task path: `.trellis/tasks/07-11-feidao-youjian-feidao-kb`
- Dispatch prompts 首行：`Active task: .trellis/tasks/07-11-feidao-youjian-feidao-kb`
