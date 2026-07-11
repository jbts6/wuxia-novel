# Verification Report — 鹿鼎记

Generated: 2026-07-11T12:15:30.396Z

## 整体统计

| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |
|------|--------|----------|----------|------|------------|-----------|
| characters.json | 50 | 86 | 86 | 0 | 0 | 100.0% |
| factions.json | 13 | 37 | 29 | 8 | 0 | 78.4% |
| locations.json | 21 | 30 | 30 | 0 | 0 | 100.0% |
| skills.json | 20 | 46 | 21 | 24 | 1 | 45.7% |
| techniques.json | 3 | 3 | 1 | 1 | 1 | 33.3% |
| items.json | — | — | — | — | ERROR: file not found |
| **合计** | **107** | **202** | **167** | **33** | **2** | **82.7%** |

## Alternatives 校验（跨章证据）

| 文件 | alt 总数 | grounded | weak | unverified | grounded% |
|------|----------|----------|------|------------|-----------|
| characters.json | 0 | 0 | 0 | 0 | —% |
| factions.json | 113 | 70 | 43 | 0 | 61.9% |
| locations.json | 0 | 0 | 0 | 0 | —% |
| skills.json | 105 | 54 | 51 | 0 | 51.4% |
| techniques.json | 6 | 3 | 3 | 0 | 50.0% |
| **合计** | **224** | **127** | **97** | **0** | **56.7%** |

## 跨章事件清单（alternatives 跨 ≥2 章）

这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。

共 68 个跨章 source_ref（展示前 30）：

| 文件 | 实体 | anchor | 章节分布 | primary |
|------|------|--------|----------|---------|
| factions.json | 天地会 | 陈近南天地会总舵主首次登场 | ch1/ch2/ch3/ch7/ch8 | ch1 |
| factions.json | 天地会 | 陈近南天地会收韦小宝为徒 | ch2/ch7/ch8/ch9/ch13 | ch7 |
| factions.json | 神龙教 | 陶红英提及神龙教四十二章经 | ch15/ch16/ch18/ch25/ch43 | ch15 |
| factions.json | 神龙教 | 胖头陀神龙岛少林寺对决 | ch18/ch19/ch20/ch21/ch39 | ch19 |
| factions.json | 神龙教 | 洪安通神龙教教主首次登场 | ch20/ch35 | ch20 |
| factions.json | 沐王府 | 茅十八提及云南沐王府英雄 | ch2/ch9/ch10/ch12/ch13 | ch2 |
| factions.json | 沐王府 | 沐剑屏方怡沐王府登场 | ch11/ch12/ch13/ch15/ch16 | ch11 |
| factions.json | 少林寺 | 胖头陀少林寺达摩院对决 | ch18/ch19/ch20/ch21/ch29 | ch18 |
| factions.json | 少林寺 | 韦小宝少林寺澄观学武 | ch19/ch20/ch21/ch22/ch23 | ch19 |
| factions.json | 铁剑门 | 九难铁剑门白衣尼首次登场 | ch27/ch32/ch34/ch41/ch44 | ch27 |
| factions.json | 铁剑门 | 九难少林寺教韦小宝武功 | ch27/ch29/ch30/ch31/ch39 | ch27 |
| factions.json | 铁剑门 | 九难传授韦小宝神行百变 | ch29/ch34/ch36/ch41/ch44 | ch34 |
| factions.json | 王屋派 | 王屋派司徒伯雷曾柔 | ch22/ch38/ch39/ch43/ch44 | ch22 |
| factions.json | 王屋派 | 王屋派韦小宝曾柔 | ch22/ch38/ch39/ch43/ch44 | ch38 |
| factions.json | 归氏庄 | 归辛树归二娘归钟首次登场 | ch41/ch42/ch43 | ch41 |
| factions.json | 归氏庄 | 归辛树一家行刺康熙 | ch41/ch42/ch43/ch45/ch49 | ch41 |
| factions.json | 归氏庄 | 归钟死亡归辛树殒命 | ch41/ch42/ch43 | ch41 |
| factions.json | 庄家 | 庄家鬼宅双儿韦小宝相遇 | ch17/ch18/ch19/ch25/ch34 | ch17 |
| factions.json | 庄家 | 庄夫人庄家复仇鳌拜 | ch1/ch10/ch17/ch25/ch34 | ch17 |
| factions.json | 清朝朝廷 | 韦小宝设计擒拿鳌拜 | ch5/ch7/ch8/ch10/ch15 | ch5 |
| factions.json | 清朝朝廷 | 索额图明珠康熙朝权臣 | ch5/ch37/ch42/ch47/ch48 | ch5 |
| factions.json | 平西王府 | 吴三桂平西王府云南 | ch2/ch16/ch18/ch19/ch27 | ch2 |
| factions.json | 平西王府 | 韦小宝云南平西王府 | ch2/ch10/ch27/ch29/ch30 | ch27 |
| factions.json | 郑氏台湾 | 天地会台湾郑氏反清 | ch1/ch8/ch9/ch14/ch15 | ch1 |
| factions.json | 郑氏台湾 | 郑克塽台湾少主首次登场 | ch26/ch27/ch28/ch29/ch30 | ch26 |
| factions.json | 郑氏台湾 | 施琅攻台郑克塽投降 | ch44/ch45/ch46/ch47/ch49 | ch44 |
| factions.json | 清朝水师 | 施琅率水师攻台湾 | ch34/ch44/ch45/ch46/ch47 | ch44 |
| factions.json | 清朝水师 | 施琅攻台郑克塽投降 | ch44/ch45/ch46/ch47/ch49 | ch44 |
| factions.json | 清凉寺 | 海大富五台山清凉寺消息 | ch6/ch15/ch18/ch24/ch26 | ch6 |
| factions.json | 清凉寺 | 韦小宝五台山清凉寺 | ch6/ch15/ch16/ch17/ch18 | ch15 |

## 低置信度实体（grounded < 80%）

这些实体需要人工复核或触发 Pass 3 补丁。

### factions.json

- **清朝水师** (`faction_qing_chao_shui_shi`)：1/3 grounded (33%)
  - ch44:382 → weak — prefix match only `
施琅笑道：“陈军师、冯队长，你两位武功了得，施某向来佩服。常言道识时务者为俊杰`
  - ch44:382 → weak — prefix match only `
施琅笑道：“陈军师、冯队长，你两位武功了得，施某向来佩服。常言道识时务者为俊杰`
- **王屋派** (`faction_wang_wu_pai`)：1/2 grounded (50%)
  - ch38:256 → weak — prefix match only `
玄贞道人道：“韦香主在朝廷的官越做越大，只怕有些不妥。依我说，咱们跟司徒伯雷联`
- **天地会** (`faction_tian_di_hui`)：2/3 grounded (67%)
  - ch1:254 → weak — prefix match only `
查伊璜虽不明天地会的来历，但台湾国姓爷延平郡王郑成功孤军抗清，精忠英勇，天下无`
- **铁剑门** (`faction_tie_jian_men`)：2/3 grounded (67%)
  - ch27:124 → weak — prefix match only `
韦小宝道：“师父，咱们又算那一省？”九难道：“那一省都不算。我独来独往，不必加`
- **归氏庄** (`faction_gui_shi_zhuang`)：2/3 grounded (67%)
  - ch41:308 → weak — prefix match only `
这黄衫女子，便是当年天下闻名的五毒教教主何铁手。后来拜袁承志为师，改名为何惕守`
- **郑氏台湾** (`faction_zheng_shi_tai_wan`)：2/3 grounded (67%)
  - ch44:382 → weak — prefix match only `
施琅笑道：“陈军师、冯队长，你两位武功了得，施某向来佩服。常言道识时务者为俊杰`
- **清凉寺** (`faction_qing_liang_si`)：2/3 grounded (67%)
  - ch6:210 → weak — prefix match only `
海老公道：“主子离宫出走，留书说道永不回来。太皇太后跟太后你两位圣上的主意，说`

### skills.json

- **化骨绵掌** (`skill_hua_gu_mian_zhang`)：0/3 grounded (0%)
  - ch6:298 → weak — prefix match only `
两人眼睛一明一盲，于对方武学派别的判断，却刚刚相反，海老公料敌甚明，太后却一起`
  - ch25:238 → weak — prefix match only `
太后不由得魂飞天外。她自然深知“化骨绵掌”的厉害，身中这掌力之后，全身骨骸酥化`
  - ch25:238 → weak — prefix match only `
太后不由得魂飞天外。她自然深知“化骨绵掌”的厉害，身中这掌力之后，全身骨骸酥化`
- **神龙心经** (`skill_shen_long_xin_jing`)：0/2 grounded (0%)
  - ch35:74 → weak — prefix match only `
韦小宝肚里暗骂：“胡涂，胡涂！韦小宝你这家伙，当真该死，怎没想到瘦头陀内功深湛`
  - ch35:199 → weak — found in wider context of cited lines `洪夫人道：“何盛是有的，那又怎样？”

韦小宝心念一动：“这何盛是无根道人的弟子`
- **大力金刚掌** (`skill_da_li_jin_gang_zhang`)：0/2 grounded (0%)
  - ch22:314 → weak — found in wider context of cited lines `
绿衫女郎眼前一黑，晕倒在地。

蓝衫女郎抛下钢刀，抱住了她，只是惊叫：“师妹，`
  - ch23:222 → weak — found in wider context of cited lines `
澄观所教虽杂，但大致以“拈花擒拿手”为主。“拈花擒拿手”是少林寺的高深武学，纯`
- **拈花指** (`skill_nian_hua_zhi`)：0/2 grounded (0%)
  - ch22:314 → weak — found in wider context of cited lines `
绿衫女郎眼前一黑，晕倒在地。

蓝衫女郎抛下钢刀，抱住了她，只是惊叫：“师妹，`
  - ch23:undefined → unverified — missing fields (no text)
- **美女拳法** (`skill_mei_nv_quan_fa`)：1/3 grounded (33%)
  - ch34:162 → weak — prefix match only `
陈近南道：“两位公子比较起来，二公子确是处处及不上他哥哥，不过相貌端正，嘴头又`
  - ch26:376 → weak — prefix match only `
韦小宝双手拳头高举过顶，说道：“我师父教我的这门功夫，叫做‘隔山打牛神拳’，大`
- **轻功提纵术** (`skill_qing_gong_ti_zong_shu`)：1/3 grounded (33%)
  - ch32:266 → weak — prefix match only `
韦小宝喜叫：“师父！师父！”从屋顶跃下制住吴三桂的，正是九难。韦小宝来到三圣庵`
  - ch7:172 → weak — prefix match only `
长须人号令：“带了这孩子走！大伙儿退兵！”众人齐声答应，向外冲出。一名青衣大汉`
- **太极拳** (`skill_tai_ji_quan`)：1/2 grounded (50%)
  - ch41:243 → weak — found in wider context of cited lines `那老妇道：“这屋子有古怪。”她身上不带兵刃，俯身去一名男仆腰间拔刀，一低头，只觉`
- **太极剑** (`skill_tai_ji_jian`)：1/2 grounded (50%)
  - ch42:224 → weak — found in wider context of cited lines `
原来韦小宝在“小”字之下，画了个圆圈。在圆圈之下，画了一条既似硬柴、又似扁担的`
- **罗汉拳** (`skill_luo_han_quan`)：1/2 grounded (50%)
  - ch22:444 → weak — prefix match only `
澄观道：“原来师叔没练过《易筋经》内功，要练这门内功，须得先练般若掌。待我跟你`
- **少林长拳** (`skill_shao_lin_chang_quan`)：1/2 grounded (50%)
  - ch22:444 → weak — prefix match only `
澄观道：“原来师叔没练过《易筋经》内功，要练这门内功，须得先练般若掌。待我跟你`
- **易筋经** (`skill_yi_jin_jing`)：1/2 grounded (50%)
  - ch22:444 → weak — prefix match only `
澄观道：“原来师叔没练过《易筋经》内功，要练这门内功，须得先练般若掌。待我跟你`
- **一指禅** (`skill_yi_zhi_chan`)：1/2 grounded (50%)
  - ch22:448 → weak — prefix match only `
澄观见韦小宝什么拳法都不会，也不生气，说道：“咱们少林寺武功循序渐进，入门之后`
- **般若掌** (`skill_bo_re_zhang`)：1/2 grounded (50%)
  - ch22:444 → weak — prefix match only `
澄观道：“原来师叔没练过《易筋经》内功，要练这门内功，须得先练般若掌。待我跟你`
- **韦陀掌** (`skill_wei_tuo_zhang`)：1/2 grounded (50%)
  - ch22:444 → weak — prefix match only `
澄观道：“原来师叔没练过《易筋经》内功，要练这门内功，须得先练般若掌。待我跟你`
- **金钟罩** (`skill_jin_zhong_zhao`)：1/2 grounded (50%)
  - ch22:314 → weak — found in wider context of cited lines `
绿衫女郎眼前一黑，晕倒在地。

蓝衫女郎抛下钢刀，抱住了她，只是惊叫：“师妹，`
- **铁布衫** (`skill_tie_bu_shan`)：1/2 grounded (50%)
  - ch22:314 → weak — found in wider context of cited lines `
绿衫女郎眼前一黑，晕倒在地。

蓝衫女郎抛下钢刀，抱住了她，只是惊叫：“师妹，`
- **铁剑功** (`skill_tie_jian_gong`)：2/3 grounded (67%)
  - ch34:338 → weak — found in wider context of cited lines `
韦小宝指着图形，说道：“这是高山，这是大河。”指着一条大河转弯处聚在一起的八个`
- **点穴功夫** (`skill_dian_xue_gong_fu`)：2/3 grounded (67%)
  - ch11:20 → weak — prefix match only `
小郡主年纪幼小，功夫自然没练得到家。点穴功夫原本艰难繁复，人身大穴数百，诸穴相`

### techniques.json

- **乾坤大挪移** (`tech_qian_kun_da_nuo_yi`)：0/1 grounded (0%)
  - ch25:undefined → unverified — missing fields (no text)
- **化骨绵掌掌式** (`tech_hua_gu_mian_zhang_shi`)：0/1 grounded (0%)
  - ch25:214 → weak — prefix match only `
韦小宝暗暗咋舌，心想这位师太无事不知，以后向她撒谎，可要加倍留神。太后道：“我`


## 完全无引文的实体

### characters.json
- `char_zheng_jing` (郑经)
- `char_zhuang_fu_ren` (庄夫人)
- `char_xiao_gui_zi` (小桂子)
- `char_wu_ying_xiong` (吴应熊)
- `char_mu_jian_sheng` (沐剑声)
- `char_liu_yan` (柳燕)
- `char_xu_tian_chuan` (徐天川)
- `char_李力世` (李力世)
- `char_qian_lao_ben` (钱老本)
- `char_玄贞道人` (玄贞道人)
- `char_feng_ji_zhong_qi_zi` (风际中妻子)
- `char_suo_e_tu_shi_cong` (索额图侍从)
- `char_lao_bao` (老鸨)
- `char_钱老板` (钱老板)
- `char_zhang_dan_yue` (张淡月)
- `char_xu_xue_ting` (许雪亭)
- `char_wu_gen_dao_ren` (无根道人)
- `char_yin_jin` (殷锦)
- `char_ma_chao_xing` (马超兴)
- `char_li_shi_kai` (李式开)
- `char_shu_hua_long` (舒化龙)
### locations.json
- `loc_昆明` (昆明)
- `loc_扬州丽春院` (扬州丽春院)
- `loc_wang_wu_shan` (王屋山)
- `loc_归氏山庄` (归氏山庄)
- `loc_庄家鬼宅` (庄家鬼宅)
- `loc_tong_chi_dao` (通吃岛)
- `loc_ya_ke_sa` (雅克萨)
- `loc_nan_jing` (南京)
- `loc_杭州` (杭州)
- `loc_山海关` (山海关)
- `loc_sheng_jing` (盛京)

## Mention Index 覆盖率

- 索引中唯一术语：52
- 已在 KB 中覆盖：105
- 未覆盖：4

### 高频但未入 KB 的术语（Top 30）

| 术语 | 提及次数 |
|------|----------|
| 胖头陀 | 258 |
| 四十二章经 | 109 |
| 鹿鼎山 | 24 |
| 化尸粉 | 18 |

**建议**：高频术语（提及 ≥5 次）如确为真实实体，应在 Pass 3 补丁中补入。

## 建议的下一步

1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。
2. 针对高频未覆盖术语，确认是否该补入 KB。
3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。
