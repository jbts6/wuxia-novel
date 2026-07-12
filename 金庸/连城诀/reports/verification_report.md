# Verification Report — 连城诀

Generated: 2026-07-11T13:22:51.157Z

## 整体统计

| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |
|------|--------|----------|----------|------|------------|-----------|
| characters.json | 15 | 24 | 22 | 1 | 1 | 91.7% |
| factions.json | 2 | 2 | 1 | 1 | 0 | 50.0% |
| locations.json | 4 | 4 | 4 | 0 | 0 | 100.0% |
| skills.json | 3 | 3 | 1 | 2 | 0 | 33.3% |
| techniques.json | 3 | 3 | 3 | 0 | 0 | 100.0% |
| items.json | 4 | 4 | 4 | 0 | 0 | 100.0% |
| dialogues.json | 4 | 4 | 4 | 0 | 0 | 100.0% |
| **合计** | **35** | **44** | **39** | **4** | **1** | **88.6%** |

## Alternatives 校验（跨章证据）

| 文件 | alt 总数 | grounded | weak | unverified | grounded% |
|------|----------|----------|------|------------|-----------|
| characters.json | 56 | 48 | 8 | 0 | 85.7% |
| factions.json | 5 | 3 | 2 | 0 | 60.0% |
| locations.json | 4 | 3 | 1 | 0 | 75.0% |
| skills.json | 10 | 8 | 2 | 0 | 80.0% |
| techniques.json | 0 | 0 | 0 | 0 | —% |
| items.json | 13 | 13 | 0 | 0 | 100.0% |
| **合计** | **88** | **75** | **13** | **0** | **85.2%** |

## 跨章事件清单（alternatives 跨 ≥2 章）

这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。

共 28 个跨章 source_ref（展示前 30）：

| 文件 | 实体 | anchor | 章节分布 | primary |
|------|------|--------|----------|---------|
| characters.json | 狄云 | 狄云与水笙相遇 | ch6/ch7/ch8/ch9/ch12 | ch12 |
| characters.json | 戚芳 | 戚芳被万圭害死 | ch8/ch9/ch10/ch11/ch12 | ch12 |
| characters.json | 丁典 | 丁典出场 | ch2/ch3/ch4/ch5/ch6 | ch2 |
| characters.json | 丁典 | 丁典被凌退思害死 | ch3/ch4/ch5/ch10/ch12 | ch12 |
| characters.json | 凌霜华 | 凌霜华出场 | ch3/ch12 | ch3 |
| characters.json | 凌霜华 | 凌霜华为丁典牺牲 | ch3/ch12 | ch12 |
| characters.json | 戚长发 | 戚长发被狄云所杀 | ch3/ch9/ch10/ch11/ch12 | ch12 |
| characters.json | 万震山 | 万震山被戚长发所杀 | ch3/ch9/ch10/ch11/ch12 | ch12 |
| characters.json | 万圭 | 万圭害死戚芳 | ch1/ch2/ch4/ch8/ch9 | ch1 |
| characters.json | 水笙 | 水笙出场 | ch5/ch6/ch7/ch8/ch9 | ch5 |
| characters.json | 水笙 | 水笙与狄云相遇 | ch6/ch7/ch8/ch9/ch12 | ch12 |
| characters.json | 凌退思 | 凌退思出场 | ch3/ch4/ch5/ch8/ch10 | ch3 |
| characters.json | 凌退思 | 凌退思被珠宝毒死 | ch4/ch5/ch8/ch10/ch12 | ch12 |
| characters.json | 梅念笙 | 梅念笙出场（回忆） | ch3/ch9/ch11/ch12 | ch3 |
| characters.json | 血刀老祖 | 血刀老祖出场 | ch6/ch7/ch8/ch9 | ch6 |
| characters.json | 宝象 | 宝象出场 | ch2/ch5/ch6/ch8/ch9 | ch2 |
| factions.json | 万震山门下 | 万震山门下出场 | ch1/ch2 | ch1 |
| factions.json | 血刀门 | 血刀门出场 | ch2/ch3/ch6/ch7/ch8 | ch2 |
| locations.json | 雪谷 | 狄云与水笙在雪谷相遇 | ch6/ch7/ch8/ch9/ch12 | ch12 |
| skills.json | 连城剑法 | 连城剑法首次出现 | ch1/ch2/ch3/ch8/ch9 | ch1 |
| skills.json | 神照功 | 丁典修炼神照功 | ch2/ch3/ch4/ch5/ch8 | ch2 |
| skills.json | 血刀经 | 血刀经首次出现 | ch7/ch8/ch9 | ch7 |
| items.json | 连城诀 | 连城诀首次出现 | ch2/ch3/ch4/ch12 | ch2 |
| items.json | 唐诗选辑 | 唐诗选辑首次出现 | ch9/ch10/ch12 | ch9 |
| items.json | 血刀 | 血刀首次出现 | ch2/ch3/ch5/ch6/ch7 | ch2 |
| items.json | 乌蚕衣 | 乌蚕衣首次出现 | ch2/ch3/ch4/ch5/ch8 | ch2 |
| dialogues.json | undefined | 戚长发质问狄云 | ch1/ch9/ch10/ch11/ch12 | ch9 |
| dialogues.json | undefined | 水笙与狄云相遇 | ch6/ch7/ch8/ch9/ch12 | ch12 |

## 低置信度实体（grounded < 80%）

这些实体需要人工复核或触发 Pass 3 补丁。

### characters.json

- **无名老丐** (`char_old_beggar`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **万圭** (`char_wan_gui`)：1/2 grounded (50%)
  - ch1:168 → weak — prefix match only `
万震山亲自敬过酒后，大弟子鲁坤、二弟子周圻、三弟子万圭、四弟子孙均、五弟子卜垣`

### factions.json

- **万震山门下** (`faction_wan_zhen_shan`)：0/1 grounded (0%)
  - ch1:182 → weak — found in wider context of cited lines `
狄云大怒，返身抽出枕头底下长剑，跃出窗去，见万门八弟子人人脸色不善，不禁暗自嘀`

### skills.json

- **神照功** (`skill_shen_zhao_gong`)：0/1 grounded (0%)
  - ch2:532 → weak — prefix match only `
突然间嗤嗤两声，两件细微的暗器分向他双眼急射，正是那并没死透之人所发。丁典向后`
- **血刀经** (`skill_xue_dao_jing`)：0/1 grounded (0%)
  - ch7:348 → weak — prefix match only `
狄云给血刀老祖扼住喉头，肺中积聚着的一股浊气数度上冲，要从口鼻中呼了出来，但喉`


## 完全无引文的实体

_(无)_

## 建议的下一步

1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。
2. 针对高频未覆盖术语，确认是否该补入 KB。
3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。
