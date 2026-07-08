# Verification Report — 神雕侠侣

Generated: 2026-07-08T06:28:00.602Z

## 整体统计

| 文件 | 实体数 | 引文总数 | grounded | weak | unverified | grounded% |
|------|--------|----------|----------|------|------------|-----------|
| characters.json | 51 | 91 | 22 | 0 | 69 | 24.2% |
| factions.json | 10 | 29 | 15 | 1 | 13 | 51.7% |
| locations.json | 18 | 34 | 17 | 0 | 17 | 50.0% |
| skills.json | 20 | 40 | 21 | 4 | 15 | 52.5% |
| techniques.json | 33 | 33 | 18 | 0 | 15 | 54.5% |
| items.json | 22 | 22 | 5 | 0 | 17 | 22.7% |
| dialogues.json | 254 | 254 | 210 | 21 | 23 | 82.7% |
| **合计** | **408** | **503** | **308** | **26** | **169** | **61.2%** |

## Alternatives 校验（跨章证据）

| 文件 | alt 总数 | grounded | weak | unverified | grounded% |
|------|----------|----------|------|------------|-----------|
| characters.json | 0 | 0 | 0 | 0 | —% |
| factions.json | 4 | 2 | 2 | 0 | 50.0% |
| locations.json | 0 | 0 | 0 | 0 | —% |
| skills.json | 12 | 1 | 11 | 0 | 8.3% |
| techniques.json | 0 | 0 | 0 | 0 | —% |
| items.json | 4 | 3 | 1 | 0 | 75.0% |
| **合计** | **20** | **6** | **14** | **0** | **30.0%** |

## 跨章事件清单（alternatives 跨 ≥2 章）

这些 source_ref 的 primary + alternatives 分布在多个章节，适合在 UI 里展示为时间线或多候选选择器。

共 8 个跨章 source_ref（展示前 30）：

| 文件 | 实体 | anchor | 章节分布 | primary |
|------|------|--------|----------|---------|
| factions.json | 丐帮 | 丐帮参与襄阳大战 | ch3/ch22/ch35/ch37/ch39 | ch37 |
| skills.json | 玄铁剑法 | 杨过玄铁剑法大战金轮法王 | ch3/ch22 | ch3 |
| skills.json | 九阴真经 | 欧阳锋逆练九阴真经走火入魔 | ch5/ch6 | ch5 |
| skills.json | 一阳指 | 一灯大师以一阳指相助疗伤 | ch28/ch32 | ch28 |
| skills.json | 玉女素心剑法 | 玉女素心剑法大战金轮法王 | ch3/ch22 | ch3 |
| skills.json | 全真剑法 | 全真教道士传授杨过全真剑法 | ch6/ch10/ch13/ch23/ch38 | ch10 |
| skills.json | 打狗棒法 | 打狗棒法丐帮帮主传承 | ch11/ch12/ch13/ch14/ch18 | ch11 |
| items.json | 打狗棒 | 黄蓉传授打狗棒法 | ch12/ch13/ch14/ch23/ch38 | ch12 |

## 低置信度实体（grounded < 80%）

这些实体需要人工复核或触发 Pass 3 补丁。

### characters.json

- **黄蓉** (`char_huang_rong`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **郭芙** (`char_guo_fu`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch10:undefined → unverified — missing fields (no text)
- **郭襄** (`char_guo_xiang`)：0/2 grounded (0%)
  - ch16:undefined → unverified — missing fields (no text)
  - ch22:undefined → unverified — missing fields (no text)
- **李莫愁** (`char_li_mo_chou`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch32:undefined → unverified — missing fields (no text)
- **公孙绿萼** (`char_gong_sun_lu_e`)：0/2 grounded (0%)
  - ch17:undefined → unverified — missing fields (no text)
  - ch24:undefined → unverified — missing fields (no text)
- **程英** (`char_cheng_ying`)：0/2 grounded (0%)
  - ch8:undefined → unverified — missing fields (no text)
  - ch32:undefined → unverified — missing fields (no text)
- **陆无双** (`char_lu_wu_shuang`)：0/2 grounded (0%)
  - ch2:undefined → unverified — missing fields (no text)
  - ch8:undefined → unverified — missing fields (no text)
- **武三通** (`char_wu_san_tong`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **武敦儒** (`char_wu_dun_ru`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **武修文** (`char_wu_xiu_wen`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **柯镇恶** (`char_ke_zhen_e`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **达尔巴** (`char_da_er_ba`)：0/2 grounded (0%)
  - ch9:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **尹克西** (`char_yin_ke_xi`)：0/2 grounded (0%)
  - ch9:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **潇湘子** (`char_xiao_xiang_zi`)：0/2 grounded (0%)
  - ch9:undefined → unverified — missing fields (no text)
  - ch12:undefined → unverified — missing fields (no text)
- **洪凌波** (`char_hong_ling_bo`)：0/2 grounded (0%)
  - ch2:undefined → unverified — missing fields (no text)
  - ch8:undefined → unverified — missing fields (no text)
- **陆立鼎** (`char_lu_li_ding`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **陆二娘** (`char_lu_er_niang`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **史叔刚** (`char_shi_shu_gang`)：0/2 grounded (0%)
  - ch16:undefined → unverified — missing fields (no text)
  - ch22:undefined → unverified — missing fields (no text)
- **史少捷** (`char_shi_shao_je`)：0/2 grounded (0%)
  - ch16:undefined → unverified — missing fields (no text)
  - ch22:undefined → unverified — missing fields (no text)
- **大头鬼** (`char_da_tou_gui`)：0/2 grounded (0%)
  - ch16:undefined → unverified — missing fields (no text)
  - ch22:undefined → unverified — missing fields (no text)
- **郭破虏** (`char_guo_po_lu`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch22:undefined → unverified — missing fields (no text)
- **耶律燕** (`char_ye_lv_yan`)：0/2 grounded (0%)
  - ch12:undefined → unverified — missing fields (no text)
  - ch16:undefined → unverified — missing fields (no text)
- **陆展元** (`char_lu_zhan_yuan`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **何沅君** (`char_he_yuan_jun`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **武娘子** (`char_wu_niang_zi`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **赵志敬** (`char_zhao_zhi_jing`)：0/1 grounded (0%)
  - ch4:undefined → unverified — missing fields (no text)
- **欧阳锋** (`char_ou_yang_feng`)：0/1 grounded (0%)
  - ch2:undefined → unverified — missing fields (no text)
- **甄志丙** (`char_zhen_zhi_bing`)：0/1 grounded (0%)
  - ch24:undefined → unverified — missing fields (no text)
- **吕文焕** (`char_lv_wen_huan`)：0/1 grounded (0%)
  - ch21:undefined → unverified — missing fields (no text)
- **天竺僧** (`char_tian_zhu_seng`)：0/1 grounded (0%)
  - ch24:undefined → unverified — missing fields (no text)
- **王志坦** (`char_wang_zhi_tan`)：0/1 grounded (0%)
  - ch25:undefined → unverified — missing fields (no text)
- **鹿清笃** (`char_lu_qing_du`)：0/1 grounded (0%)
  - ch4:undefined → unverified — missing fields (no text)
- **慈恩** (`char_ci_en`)：0/1 grounded (0%)
  - ch30:undefined → unverified — missing fields (no text)
- **小龙女** (`char_xiao_long_nyu`)：1/3 grounded (33%)
  - ch5:undefined → unverified — missing fields (no text)
  - ch14:undefined → unverified — missing fields (no text)
- **郭靖** (`char_guo_jing`)：1/2 grounded (50%)
  - ch1:undefined → unverified — missing fields (no text)
- **金轮法王** (`char_jin_lun_fa_wang`)：1/2 grounded (50%)
  - ch9:undefined → unverified — missing fields (no text)
- **周伯通** (`char_zhou_bo_tong`)：1/2 grounded (50%)
  - ch11:undefined → unverified — missing fields (no text)
- **一灯大师** (`char_yi_deng_da_shi`)：1/2 grounded (50%)
  - ch13:undefined → unverified — missing fields (no text)
- **黄药师** (`char_huang_yao_shi`)：1/2 grounded (50%)
  - ch14:undefined → unverified — missing fields (no text)
- **公孙止** (`char_gong_sun_zhi`)：1/2 grounded (50%)
  - ch17:undefined → unverified — missing fields (no text)
- **完颜萍** (`char_wan_yan_ping`)：1/2 grounded (50%)
  - ch12:undefined → unverified — missing fields (no text)
- **裘千仞** (`char_qiu_qian_ren`)：1/2 grounded (50%)
  - ch13:undefined → unverified — missing fields (no text)
- **霍都** (`char_huo_du`)：1/2 grounded (50%)
  - ch9:undefined → unverified — missing fields (no text)
- **觉远** (`char_jue_yuan`)：1/2 grounded (50%)
  - ch26:undefined → unverified — missing fields (no text)
- **张君宝** (`char_zhang_jun_bao`)：1/2 grounded (50%)
  - ch26:undefined → unverified — missing fields (no text)
- **鲁有脚** (`char_lu_you_jiao`)：1/2 grounded (50%)
  - ch12:undefined → unverified — missing fields (no text)
- **朱子柳** (`char_zhu_zi_liu`)：1/2 grounded (50%)
  - ch12:undefined → unverified — missing fields (no text)
- **点苍渔隐** (`char_dian_cang_yu_yin`)：1/2 grounded (50%)
  - ch12:undefined → unverified — missing fields (no text)

### factions.json

- **少林寺** (`faction_shao_lin_si`)：0/2 grounded (0%)
  - ch36:undefined → unverified — missing fields (no text)
  - ch38:undefined → unverified — missing fields (no text)
- **大理段氏** (`faction_da_li_duan_shi`)：1/3 grounded (33%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch30:undefined → unverified — missing fields (no text)
- **绝情谷** (`faction_jue_qing_gu`)：1/3 grounded (33%)
  - ch17:undefined → unverified — missing fields (no text)
  - ch18:undefined → unverified — missing fields (no text)
- **白驼山** (`faction_bai_tuo_shan`)：1/3 grounded (33%)
  - ch6:undefined → unverified — missing fields (no text)
  - ch11:undefined → unverified — missing fields (no text)
- **万兽山庄** (`faction_wan_shou_shan_zhuang`)：1/3 grounded (33%)
  - ch22:undefined → unverified — missing fields (no text)
  - ch23:undefined → unverified — missing fields (no text)
- **古墓派** (`faction_gu_mu_pai`)：2/3 grounded (67%)
  - ch4:undefined → unverified — missing fields (no text)
- **丐帮** (`faction_gai_bang`)：2/3 grounded (67%)
  - ch37:34 → weak — prefix match only `
郭芙再瞧台上那何师我时，见他步武轻捷，出手狠辣，果然依稀便是当年英雄大会上那个`
- **桃花岛** (`faction_tao_hua_dao`)：2/3 grounded (67%)
  - ch16:undefined → unverified — missing fields (no text)
- **蒙古** (`faction_meng_gu`)：2/3 grounded (67%)
  - ch21:undefined → unverified — missing fields (no text)

### locations.json

- **绝情谷** (`loc_jue_qing_gu`)：0/2 grounded (0%)
  - ch17:undefined → unverified — missing fields (no text)
  - ch18:undefined → unverified — missing fields (no text)
- **古墓** (`loc_gu_mu`)：0/2 grounded (0%)
  - ch4:undefined → unverified — missing fields (no text)
  - ch7:undefined → unverified — missing fields (no text)
- **风陵渡** (`loc_feng_ling_du`)：0/1 grounded (0%)
  - ch33:undefined → unverified — missing fields (no text)
- **嘉兴陆家庄** (`loc_jia_xing_lu_jia_zhuang`)：0/2 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
  - ch2:undefined → unverified — missing fields (no text)
- **绝情谷底** (`loc_jue_qing_gu_di`)：0/2 grounded (0%)
  - ch30:undefined → unverified — missing fields (no text)
  - ch38:undefined → unverified — missing fields (no text)
- **襄阳城** (`loc_xiang_yang_cheng`)：0/2 grounded (0%)
  - ch21:undefined → unverified — missing fields (no text)
  - ch39:undefined → unverified — missing fields (no text)
- **万兽山庄** (`loc_wan_shou_shan_zhuang`)：0/2 grounded (0%)
  - ch22:undefined → unverified — missing fields (no text)
  - ch23:undefined → unverified — missing fields (no text)
- **嘉兴南湖** (`loc_jia_xing_nan_hu`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **襄阳** (`loc_xiang_yang`)：1/2 grounded (50%)
  - ch21:undefined → unverified — missing fields (no text)
- **重阳宫** (`loc_chong_yang_gong`)：1/2 grounded (50%)
  - ch25:undefined → unverified — missing fields (no text)
- **神雕谷** (`loc_shen_diao_gu`)：1/2 grounded (50%)
  - ch10:undefined → unverified — missing fields (no text)

### skills.json

- **左右互搏术** (`skill_zuo_you_hu_bo_shu`)：0/2 grounded (0%)
  - ch8:undefined → unverified — missing fields (no text)
  - ch14:undefined → unverified — missing fields (no text)
- **玉女素心剑法** (`skill_yu_nv_su_xin_jian_fa`)：0/2 grounded (0%)
  - ch14:undefined → unverified — missing fields (no text)
  - ch3:298 → weak — prefix match only `
郭靖想起当日君山大战，与黄蓉力战丐帮，对手武功虽均不强，但一经联手，却难抵敌，`
- **铁掌功** (`skill_tie_zhang_gong`)：0/1 grounded (0%)
  - ch30:undefined → unverified — missing fields (no text)
- **五毒神掌** (`skill_wu_du_shen_zhang`)：0/1 grounded (0%)
  - ch2:undefined → unverified — missing fields (no text)
- **黯然销魂掌** (`skill_an_ran_xiao_hun_zhang`)：1/3 grounded (33%)
  - ch17:undefined → unverified — missing fields (no text)
  - ch25:undefined → unverified — missing fields (no text)
- **玄铁剑法** (`skill_xuan_tie_jian_fa`)：1/3 grounded (33%)
  - ch10:undefined → unverified — missing fields (no text)
  - ch3:298 → weak — prefix match only `
郭靖想起当日君山大战，与黄蓉力战丐帮，对手武功虽均不强，但一经联手，却难抵敌，`
- **龙象般若功** (`skill_long_xiang_ban_re_gong`)：1/3 grounded (33%)
  - ch21:undefined → unverified — missing fields (no text)
  - ch39:undefined → unverified — missing fields (no text)
- **玉女心经** (`skill_yu_nv_xin_jing`)：1/2 grounded (50%)
  - ch7:undefined → unverified — missing fields (no text)
- **九阴真经** (`skill_jiu_yin_zhen_jing`)：1/2 grounded (50%)
  - ch5:157 → weak — found in wider context of cited lines `小龙女缓缓转过头来，向群道脸上逐一望去。除郝大通内功深湛、心神宁定之外，其余众道`
- **蛤蟆功** (`skill_ha_ma_gong`)：1/2 grounded (50%)
  - ch11:undefined → unverified — missing fields (no text)
- **弹指神通** (`skill_tan_zhi_shen_tong`)：1/2 grounded (50%)
  - ch16:undefined → unverified — missing fields (no text)
- **全真剑法** (`skill_quan_zhen_jian_fa`)：1/2 grounded (50%)
  - ch10:258 → weak — prefix match only `
原来杨过见武氏兄弟赶到，与郭芙三人合攻李莫愁，三人神情亲密，所施展剑法又极精妙`
- **冰魄银针** (`skill_bing_po_yin_zhen`)：1/2 grounded (50%)
  - ch14:undefined → unverified — missing fields (no text)
- **先天功** (`skill_xian_tian_gong`)：1/2 grounded (50%)
  - ch1:undefined → unverified — missing fields (no text)

### techniques.json

- **心惊肉跳** (`tech_xin_jing_rou_tiao`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **杞人忧天** (`tech_qi_ren_you_tian`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **无中生有** (`tech_wu_zhong_sheng_you`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **拖泥带水** (`tech_tuo_ni_dai_shui`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **徘徊空谷** (`tech_pai_huai_kong_gu`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **力不从心** (`tech_li_bu_cong_xin`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **行尸走肉** (`tech_xing_shi_zou_rou`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **倒行逆施** (`tech_dao_xing_ni_shi`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **废寝忘食** (`tech_fei_qin_wang_shi`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **孤形只影** (`tech_gu_xing_zhi_ying`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **饮恨吞声** (`tech_yin_hen_tun_sheng`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **六神不安** (`tech_liu_shen_bu_an`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **穷途末路** (`tech_qiong_tu_mo_lu`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **面无人色** (`tech_mian_wu_ren_se`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **想入非非** (`tech_xiang_ru_fei_fei`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)

### items.json

- **玄铁重剑** (`item_xuan_tie_chong_jian`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **君子剑** (`item_jun_zi_jian`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **淑女剑** (`item_shu_nyu_jian`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **铁桨** (`item_tie_jiang`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **拂尘** (`item_fu_chen`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **玉蜂金针** (`item_yu_feng_jin_zhen`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **冰魄银针** (`item_bing_po_yin_zhen`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **绝情丹** (`item_jue_qing_dan`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **断肠草** (`item_duan_chang_cao`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **情花毒** (`item_qing_hua_du`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **金针** (`item_jin_zhen`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **面具** (`item_mian_ju`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **神雕** (`item_shen_diao`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **玉女剑** (`item_yu_nyu_jian`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **玄铁指环** (`item_xuan_tie_zhi_huan`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **玉蜂浆** (`item_yu_feng_jiang`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)
- **情花** (`item_qing_hua`)：0/1 grounded (0%)
  - ch1:undefined → unverified — missing fields (no text)


## 完全无引文的实体

_(无)_

## 建议的下一步

1. 针对低置信度实体和无引文实体运行 Pass 3 补丁（`prompts/pass3-patch.md`）。
2. 针对高频未覆盖术语，确认是否该补入 KB。
3. 补丁合并后重跑 `verify.js` + `report.js`，直到 grounded ≥ 85%。
