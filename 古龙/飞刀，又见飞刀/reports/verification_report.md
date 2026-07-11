# Verification Report — 飞刀，又见飞刀

Generated: 2026-07-11T09:20:32.617Z

## 整体统计

| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |
|------|--------|----------|----------|------|------------|-----------|
| characters.json | 20 | 37 | 36 | 1 | 0 | 97.3% |
| factions.json | 7 | 10 | 10 | 0 | 0 | 100.0% |
| locations.json | — | — | — | — | ERROR: parse error: Unexpected end of JSON input |
| skills.json | 6 | 11 | 9 | 2 | 0 | 81.8% |
| techniques.json | 1 | 1 | 1 | 0 | 0 | 100.0% |
| items.json | 9 | 10 | 8 | 1 | 1 | 80.0% |
| dialogues.json | 151 | 151 | 151 | 0 | 0 | 100.0% |
| **合计** | **194** | **220** | **215** | **4** | **1** | **97.7%** |

## Alternatives 校验（跨章证据）

| 文件 | alt 总数 | grounded | weak | unverified | grounded% |
|------|----------|----------|------|------------|-----------|
| characters.json | 46 | 44 | 2 | 0 | 95.7% |
| factions.json | 10 | 10 | 0 | 0 | 100.0% |
| skills.json | 6 | 5 | 1 | 0 | 83.3% |
| techniques.json | 0 | 0 | 0 | 0 | —% |
| items.json | 9 | 9 | 0 | 0 | 100.0% |
| **合计** | **71** | **68** | **3** | **0** | **95.8%** |

## 跨章事件清单（alternatives 跨 ≥2 章）

这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。

共 26 个跨章 source_ref（展示前 30）：

| 文件 | 实体 | anchor | 章节分布 | primary |
|------|------|--------|----------|---------|
| characters.json | 李坏 | 第五回银衣与李坏 | ch6/ch9/ch10/ch12/ch13 | ch6 |
| characters.json | 李坏 | 月神说李坏是李家后代 | ch2/ch3/ch13/ch16/ch17 | ch16 |
| characters.json | 月神 | 小楼与月神 | ch14/ch16 | ch14 |
| characters.json | 月神 | 月神与李坏正月十五对决 | ch3/ch4/ch9/ch16/ch17 | ch16 |
| characters.json | 铁银衣 | 第五回银衣铁银衣出场 | ch6/ch9/ch10/ch12/ch13 | ch6 |
| characters.json | 铁银衣 | 铁银衣请李坏喝酒高地帐篷 | ch6/ch9/ch10/ch12/ch13 | ch6 |
| characters.json | 铁银衣 | 铁银衣与公孙太夫人对话 | ch9/ch10 | ch9 |
| characters.json | 韩峻 | 韩峻与李坏相关 | ch3/ch4/ch6/ch13 | ch3 |
| characters.json | 公孙太夫人 | 第八回公孙太夫人 | ch9/ch10 | ch9 |
| characters.json | 公孙太夫人 | 公孙太夫人保证李坏不死 | ch9/ch10 | ch9 |
| characters.json | 方天豪 | 方天豪爱权势名声与可可 | ch3/ch4/ch6 | ch3 |
| characters.json | 可可 | 方天豪独生女儿可可 | ch3/ch4/ch6 | ch3 |
| characters.json | 李曼青 | 月神论李曼青怕败 | ch10/ch12/ch14/ch16 | ch16 |
| characters.json | 小星 | 小星要陪小姐看李曼青 | ch10/ch12/ch14/ch16 | ch16 |
| characters.json | 公孙无胜 | 公孙无胜与公孙太夫人 | ch9/ch10 | ch10 |
| characters.json | 小李探花 | 小李探花的后代 | ch3/ch4/ch10/ch12/ch13 | ch3 |
| characters.json | 李寻欢 | 小李飞刀与李家后代 | ch4/ch10/ch12/ch13/ch14 | ch10 |
| factions.json | 李家 | 李曼青与李家小楼灯光 | ch10/ch12/ch14/ch15/ch16 | ch16 |
| factions.json | 李家 | 月神说李坏是李家后代 | ch2/ch3/ch13/ch16/ch17 | ch16 |
| factions.json | 公孙氏 | 公孙太夫人高地帐篷 | ch9/ch10 | ch9 |
| factions.json | 公孙氏 | 公孙太夫人保证李坏日出前不死 | ch9/ch10 | ch9 |
| skills.json | 小李飞刀 | 小李探花后代飞刀尊荣 | ch4/ch10/ch12/ch13/ch14 | ch14 |
| skills.json | 飞刀 | 月神的刀与飞刀 | ch3/ch4/ch14 | ch3 |
| items.json | 飞刀 | 一剑飞雪 飞刀 李坏 | ch3/ch4/ch10/ch12/ch13 | ch12 |
| items.json | 胡琴 | 胡琴琴声压倒乐声公孙太夫人 | ch9/ch10 | ch9 |
| items.json | 银衣 | 第五回银衣铁银衣 | ch6/ch9/ch10/ch12/ch13 | ch6 |

## 低置信度实体（grounded < 80%）

这些实体需要人工复核或触发 Pass 3 补丁。

### characters.json

- **段八方** (`char_duan_ba_fang`)：2/3 grounded (67%)
  - ch1:105 → weak — found in wider context of cited lines `　　灵堂总是这样子的，总是白得这么惨。

　　卅六条大汉把棺材抬入灵堂里，摆在一`

### skills.json

- **小李飞刀** (`skill_xiao_li_fei_dao`)：2/3 grounded (67%)
  - ch12:1 → weak — prefix match only `　　第十一回　一剑飞雪

　　古老的宅邸，重门深锁，高墙头已生荒草，门上的朱漆也`
- **飞刀** (`skill_fei_dao`)：2/3 grounded (67%)
  - ch12:1 → weak — prefix match only `　　第十一回　一剑飞雪

　　古老的宅邸，重门深锁，高墙头已生荒草，门上的朱漆也`

### items.json

- **信纸** (`item_hua_dao_bai_zhi`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **飞刀** (`item_fei_dao`)：1/2 grounded (50%)
  - ch12:164 → weak — prefix match only `
　　小李飞刀，例不虚发。就连威震天下的金钱帮主上官金虹也未能破例。

　　“这`


## 完全无引文的实体

_(无)_

## Mention Index 覆盖率

- 索引中唯一术语：17
- 已在 KB 中覆盖：59
- 未覆盖：4

### 高频但未入 KB 的术语（Top 30）

| 术语 | 提及次数 |
|------|----------|
| 公孙 | 82 |
| 曼青 | 20 |
| 十三太保 | 1 |
| 横练 | 1 |

**建议**：高频术语（提及 ≥5 次）如确为真实实体，应在 Pass 3 补丁中补入。

## 建议的下一步

1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。
2. 针对高频未覆盖术语，确认是否该补入 KB。
3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。
