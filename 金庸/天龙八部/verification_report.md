# Verification Report — 天龙八部

Generated: 2026-07-05T04:58:39.396Z

## 整体统计

| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |
|------|--------|----------|----------|------|------------|-----------|
| characters.json | 26 | 31 | 12 | 19 | 0 | 38.7% |
| factions.json | 9 | 9 | 9 | 0 | 0 | 100.0% |
| locations.json | 20 | 21 | 21 | 0 | 0 | 100.0% |
| skills.json | 26 | 26 | 23 | 3 | 0 | 88.5% |
| techniques.json | 13 | 13 | 12 | 1 | 0 | 92.3% |
| items.json | 15 | 15 | 6 | 8 | 1 | 40.0% |
| dialogues.json | 91 | 91 | 1 | 62 | 28 | 1.1% |
| **合计** | **200** | **206** | **84** | **93** | **29** | **40.8%** |

## Alternatives 校验（跨章证据）

| 文件 | alt 总数 | grounded | weak | unverified | grounded% |
|------|----------|----------|------|------------|-----------|
| characters.json | 31 | 12 | 19 | 0 | 38.7% |
| factions.json | 16 | 12 | 4 | 0 | 75.0% |
| locations.json | 12 | 7 | 5 | 0 | 58.3% |
| skills.json | 17 | 10 | 7 | 0 | 58.8% |
| techniques.json | 1 | 0 | 1 | 0 | 0.0% |
| items.json | 40 | 22 | 18 | 0 | 55.0% |
| **合计** | **117** | **63** | **54** | **0** | **53.8%** |

## 跨章事件清单（alternatives 跨 ≥2 章）

这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。

共 42 个跨章 source_ref（展示前 30）：

| 文件 | 实体 | anchor | 章节分布 | primary |
|------|------|--------|----------|---------|
| characters.json | 段誉 | 段誉初入无量山 | ch1/ch2/ch3/ch5/ch6 | ch1 |
| characters.json | 萧峰 | 乔峰首次登场 | ch14/ch15 | ch14 |
| characters.json | 萧峰 | 萧峰雁门关自尽 | ch23/ch27/ch42/ch43/ch50 | ch50 |
| characters.json | 虚竹 | 虚竹首次登场 | ch29/ch30 | ch29 |
| characters.json | 虚竹 | 虚竹成为灵鹫宫主 | ch35/ch36/ch37/ch38/ch39 | ch35 |
| characters.json | 王语嫣 | 王语嫣首次登场 | ch12/ch13 | ch12 |
| characters.json | 慕容复 | 慕容复首次登场 | ch12/ch13 | ch12 |
| characters.json | 慕容复 | 慕容复疯癫 | ch47/ch48 | ch48 |
| characters.json | 阿朱 | 阿朱首次登场 | ch11/ch12 | ch11 |
| characters.json | 阿紫 | 阿紫首次登场 | ch22/ch23 | ch22 |
| characters.json | 木婉清 | 木婉清首次登场 | ch3/ch4 | ch3 |
| characters.json | 钟灵 | 钟灵首次登场 | ch1/ch2 | ch1 |
| characters.json | 鸠摩智 | 鸠摩智首次登场 | ch10/ch11 | ch10 |
| characters.json | 天山童姥 | 天山童姥首次登场 | ch1/ch3/ch5/ch34/ch35 | ch1 |
| characters.json | 李秋水 | 李秋水首次登场 | ch36/ch37 | ch36 |
| characters.json | 耶律洪基 | 耶律洪基首次登场 | ch27/ch28 | ch27 |
| characters.json | 秦红棉 | 秦红棉首次登场 | ch6/ch7 | ch6 |
| characters.json | 阮星竹 | 阮星竹首次登场 | ch22/ch23 | ch22 |
| characters.json | 刀白凤 | 刀白凤首次登场 | ch7/ch8 | ch7 |
| factions.json | 少林 | 少林寺首次出现 | ch9/ch10/ch11/ch12/ch13 | ch9 |
| factions.json | 丐帮 | 乔峰丐帮帮主身份 | ch12/ch14/ch15/ch16/ch17 | ch12 |
| factions.json | 逍遥派 | 无崖子提及逍遥派 | ch2/ch35/ch36/ch37/ch39 | ch2 |
| factions.json | 大理段氏 | 大理段氏首次出现 | ch2/ch6/ch7/ch8/ch9 | ch2 |
| locations.json | 大理 | 大理国无量山 | ch1/ch2/ch3/ch5/ch6 | ch1 |
| locations.json | 姑苏 | 姑苏慕容氏首次提及 | ch9/ch10/ch11/ch12/ch13 | ch9 |
| locations.json | 雁门关 | 萧峰雁门关自尽 | ch23/ch27/ch42/ch43/ch50 | ch50 |
| skills.json | 六脉神剑 | 段誉首次使用六脉神剑 | ch2/ch10/ch11/ch12/ch14 | ch2 |
| skills.json | 凌波微步 | 段誉学会凌波微步 | ch2/ch5/ch6/ch7/ch8 | ch2 |
| skills.json | 火焰刀 | 鸠摩智使用火焰刀 | ch10/ch11/ch39/ch40/ch42 | ch10 |
| skills.json | 化功大法 | 化功大法首次提及 | ch9/ch10/ch11/ch12/ch17 | ch9 |

## 低置信度实体（grounded < 80%）

这些实体需要人工复核或触发 Pass 3 补丁。

### characters.json

- **段誉** (`char_duan_yu`)：0/1 grounded (0%)
  - ch1:24 → weak — prefix match only `
马五德脸上微微一红，忙道：“这位段兄弟不是我的弟子。你老哥哥这几手三脚猫的把式`
- **虚竹** (`char_xu_zhu`)：0/2 grounded (0%)
  - ch29:229 → weak — found in wider context of cited lines `只听得头顶呼的一声风响，一个庞大的身躯从背后跃过他头顶，砰的一声，重重撞在对面山`
  - ch35:86 → weak — prefix match only `
背后那声音道：“这山峰是条绝路，他们在山峰下把守住了，你如何逃得出去？”虚竹一`
- **王语嫣** (`char_wang_yu_yan`)：0/1 grounded (0%)
  - ch12:211 → weak — found in wider context of cited lines `段誉陪笑道：“小生姓段名誉，大理国人氏，非书呆子也。神仙姊姊和这位小茗姊姊的言语`
- **慕容复** (`char_mu_rong_fu`)：0/2 grounded (0%)
  - ch12:211 → weak — found in wider context of cited lines `段誉陪笑道：“小生姓段名誉，大理国人氏，非书呆子也。神仙姊姊和这位小茗姊姊的言语`
  - ch48:273 → weak — found in wider context of cited lines `
邓百川、公冶干、风波恶三人你瞧瞧我，我瞧瞧你，心念相通，一齐点了点头。

邓百`
- **阿紫** (`char_a_zi`)：0/1 grounded (0%)
  - ch22:268 → weak — found in wider context of cited lines `
萧峰和阿朱向她瞧去，只见她穿了一身淡绿色的贴身水靠，更显得纤腰一束，一双乌溜溜`
- **游坦之** (`char_you_tan_zhi`)：0/1 grounded (0%)
  - ch19:220 → weak — found in wider context of cited lines `
人丛中那细声细气的声音忽然又道：“你羞也不羞？你自己转眼便要给人乱刀斩成肉酱，`
- **木婉清** (`char_mu_wan_qing`)：0/1 grounded (0%)
  - ch3:194 → weak — found in wider context of cited lines `
吃到第三碗饭时，忽听得店门外有人说道：“娘子，这里倒有家小饭店，且看有什么吃的`
- **钟灵** (`char_zhong_ling`)：0/1 grounded (0%)
  - ch1:206 → weak — found in wider context of cited lines `
段誉搔头道：“那你就给他些解药罢。”那少女道：“唉，你这人婆婆妈妈的，人家打你`
- **鸠摩智** (`char_jiu_mo_zhi`)：0/1 grounded (0%)
  - ch10:202 → weak — found in wider context of cited lines `
牟尼堂中除段誉之外，个个是毕生研习指法的大行家，但见他出指轻柔无比，左手每一次`
- **丁春秋** (`char_ding_chun_qiu`)：0/1 grounded (0%)
  - ch10:202 → weak — found in wider context of cited lines `
牟尼堂中除段誉之外，个个是毕生研习指法的大行家，但见他出指轻柔无比，左手每一次`
- **李秋水** (`char_li_qiu_shui`)：0/1 grounded (0%)
  - ch36:180 → weak — found in wider context of cited lines `
童姥听他久不作声，问道：“你在想什么？”虚竹说了。童姥笑道：“你道那些麻袋中装`
- **耶律洪基** (`char_ye_lv_hong_ji`)：0/1 grounded (0%)
  - ch27:201 → weak — found in wider context of cited lines `萧峰猿臂伸出，夺过刀子，说道：“大哥，是英雄好汉，便当死于战场，如何能自尽而死？`
- **秦红棉** (`char_qin_hong_mian`)：0/1 grounded (0%)
  - ch6:184 → weak — found in wider context of cited lines `
镇南王和玉虚散人之间本来甚是尴尬，给段誉这么插科打诨，玉虚散人开颜一笑，僵局便`
- **阮星竹** (`char_ruan_xing_zhu`)：0/1 grounded (0%)
  - ch22:268 → weak — found in wider context of cited lines `
萧峰和阿朱向她瞧去，只见她穿了一身淡绿色的贴身水靠，更显得纤腰一束，一双乌溜溜`
- **刀白凤** (`char_dao_bai_feng`)：0/1 grounded (0%)
  - ch7:185 → weak — found in wider context of cited lines `钟万仇奔到妻子身旁，又疼惜，又高兴，绕着她转来转去，不住说道：“宝宝，多谢你，你`
- **阿朱** (`char_a_zhu`)：1/2 grounded (50%)
  - ch11:186 → weak — found in wider context of cited lines `
他说到这里，段誉忽然闻到一阵淡淡的香气，心中一动：“奇怪，奇怪。”

先前那老`
- **萧峰** (`char_xiao_feng`)：2/3 grounded (67%)
  - ch14:191 → weak — found in wider context of cited lines `风波恶斜身闪过，扑到东首那红脸老者身前，白光耀眼，他手中已多了一柄单刀，横砍而至`

### skills.json

- **火焰刀** (`skill_huo_yan_dao`)：0/1 grounded (0%)
  - ch10:246 → weak — prefix match only `
鸠摩智双手一击，门外走进一名高大汉子。鸠摩智说了几句番话，那汉子点头答应，到门`
- **太祖长拳** (`skill_tai_zu_chang_quan`)：0/1 grounded (0%)
  - ch19:220 → weak — found in wider context of cited lines `
人丛中那细声细气的声音忽然又道：“你羞也不羞？你自己转眼便要给人乱刀斩成肉酱，`
- **擒龙功** (`skill_qin_long_gong`)：0/1 grounded (0%)
  - ch41:52 → weak — prefix match only `
两面紫旗一展开，星宿派门人登时大乱，立时便有人大声呼叫：“星宿派掌门乃丁老仙，`

### techniques.json

- **太祖长拳招式** (`tech_tai_zu_chang_quan_zhao_shi`)：0/1 grounded (0%)
  - ch19:220 → weak — found in wider context of cited lines `
人丛中那细声细气的声音忽然又道：“你羞也不羞？你自己转眼便要给人乱刀斩成肉酱，`

### items.json

- **六脉神剑图谱** (`item_liu_mai_shen_jian_pu`)：0/1 grounded (0%)
  - ch10:48 → weak — prefix match only `
本因方丈双手合什，说道：“阿弥陀佛，本因有一事疑难不决，打扰三位师兄弟的功课。`
- **北冥神功秘籍** (`item_bei_ming_shen_gong_mi_ji`)：0/1 grounded (0%)
  - ch5:204 → weak — prefix match only `
只小半个时辰，便已依照图中所示，将“手太阴肺经”的经脉穴道存想无误，不过身上内`
- **凌波微步图谱** (`item_ling_wei_bu_pu`)：0/1 grounded (0%)
  - ch5:214 → weak — prefix match only `
卷轴中此外诸种经脉修习之法甚多，皆是取人内力的法门，段誉虽自语宽解，总觉习之有`
- **易筋经** (`item_yi_jin_jing`)：0/1 grounded (0%)
  - ch22:22 → weak — prefix match only `
阿朱虽不知萧峰心中所想的详情，也料到他总是为报仇之事发愁，便道：“大哥，报仇大`
- **金柄小刀** (`item_jin_bang_xiao_dao`)：0/1 grounded (0%)
  - ch10:74 → weak — prefix match only `
保定帝素知大轮明王鸠摩智是吐蕃国的护国法王，但只听说他具大智慧，精通佛法，每隔`
- **易容面具** (`item_yi_rong_mian_ju`)：0/1 grounded (0%)
  - ch12:314 → weak — prefix match only `
王语嫣应道：“是。”走到门边时，停了一停，回头道：“妈，你饶了阿朱、阿碧，叫她`
- **慕容家玉** (`item_mu_rong_jia_yu`)：0/1 grounded (0%)
  - ch42:100 → unverified — no match in chapter `灰衣僧以慕容家传信物现身`
- **西夏公主酒** (`item_xi_xia_gong_zhu_jiu`)：0/1 grounded (0%)
  - ch29:364 → weak — prefix match only `
这时公冶干已扶着风波恶坐在地下，只见他全身发颤，牙关相击，格格直响，便似身入冰`
- **金鹿酒** (`item_jin_lu_jiu`)：0/1 grounded (0%)
  - ch18:28 → weak — prefix match only `
阿碧道：“丐帮众人既都给囚在天宁寺里，乔帮主赶向无锡城中，可扑了个空。”

段`


## 完全无引文的实体

_(无)_

## Mention Index 覆盖率

- 索引中唯一术语：85
- 已在 KB 中覆盖：128
- 未覆盖：10

### 高频但未入 KB 的术语（Top 30）

| 术语 | 提及次数 |
|------|----------|
| 星宿 | 420 |
| 王夫人 | 266 |
| 段氏 | 144 |
| 辽国 | 134 |
| 青城 | 100 |
| 天山 | 62 |
| 韦陀杵 | 19 |
| 无相劫指 | 9 |
| 完颜阿骨打 | 8 |
| 嵩山 | 4 |

**建议**：高频术语（提及 ≥5 次）如确为真实实体，应在 Pass 3 补丁中补入。

## 建议的下一步

1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。
2. 针对高频未覆盖术语，确认是否该补入 KB。
3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。
