# Knowledge Base Review Prompt

## 角色

你是一位武侠小说设定库的**审阅专家**，目标是**挑刺**。你需要审阅本书的 8 个 JSON 文件，找出最可疑的条目。

## 输入

1. `characters.json`：角色数组
2. `factions.json`：门派/组织数组
3. `locations.json`：地点数组
4. `skills.json`：功法/武学体系数组
5. `techniques.json`：招式数组
6. `items.json`：物品/道具数组
7. `dialogues.json`：对话数组
8. `chapter_summaries.json`：章节摘要数组

## 审阅范围

逐个审阅以下 JSON 文件，找出质量问题：

---

### 1. characters.json 审阅

检查每个角色：

- **跨书混淆**：角色是否属于本书？是否有其他作品的角色混入？
- **身份矛盾**：角色的 identity、role、faction 是否自洽？
- **关系冲突**：relationships 中是否有矛盾（如同一角色既是恋人又是敌人）？
- **别名真实**：alias 是否在原文中真正出现过？
- **personality 空洞**：traits 是否基于全书行为总结，而非套话？
- **ID 引用**：faction、known_skills、related_skills 是否引用了其他 JSON 中存在的 ID？

---

### 2. factions.json 审阅

检查每个门派/组织：

- **跨书混淆**：门派是否属于本书？
- **类型错误**：type 是否正确（门派/帮派/家族/军队等）？
- **地点关联**：location 是否在 locations.json 中存在？
- **ID 引用**：sub_divisions 中的成员是否引用了正确的 ID？

---

### 3. locations.json 审阅

检查每个地点：

- **跨书混淆**：地点是否属于本书？
- **类型错误**：region 是否正确？
- **情节意义**：one_line 是否反映地点的全书定位？

---

### 4. skills.json 审阅（重点！）

检查每个功法/武学体系：

- **武器混入**：是否将武器（铁鞭、峨嵋刺、流星锤、暗器等）误列为功法？
  - **区分标准**：
    - skills.json 应包含：内功、掌法、剑法、刀法、鞭法、轻功等**武学体系**
    - items.json 应包含：铁鞭、峨嵋刺、流星锤、弹弓、旱烟管等**武器/道具**
  - **常见错误**：将"铁鞭"（武器）列为 skill，应为 item
- **类型正确**：type 是否为合法的 skill.type 枚举值？
- **招式归属**：techniques 数组中的招式是否属于此功法？
- **修炼者存在**：practitioners 中的角色 ID 是否在 characters.json 中存在？
- **跨书混淆**：功法是否属于本书？

---

### 5. techniques.json 审阅

检查每个招式：

- **归属正确**：source_skill 是否在 skills.json 中存在？
- **跨 skill 检查**：招式是否被多个 skill 使用？
- **描述真实**：description 是否基于原文？

---

### 6. items.json 审阅（重点！）

检查每个物品/道具：

- **武器错放**：是否有功法被误列为物品？
  - **区分标准**：
    - items.json 应包含：鸳鸯刀、铁鞭、峨嵋刺、流星锤、弹弓等**武器/道具**
    - skills.json 应包含：混元气、震天三十掌、呼延十八鞭等**武学体系**
- **类型正确**：type 是否为合法的 item.type 枚举值？
- **稀有度合理**：rarity_tier 是否符合物品在本书中的地位？
- **owner 存在**：owner 是否在 characters.json 或 factions.json 中存在？
- **related_skills 存在**：related_skills 中的 ID 是否在 skills.json 中存在？

---

### 7. dialogues.json 审阅

检查每条对话：

- **跨书混淆**：对话内容是否包含其他武侠作品的元素？
- **说话风格不符**：说话风格是否符合角色性格？
- **时代背景错误**：对话是否符合本书的时代背景？
- **措辞偏差**：对话是否像是 LLM 凭记忆写的，而非原文？
- **情节逻辑错误**：对话是否与上下文情节矛盾？
- **speaker/listener 存在**：speaker 和 listener 是否在 characters.json 中存在？

---

### 8. chapter_summaries.json 审阅

检查每章摘要：

- **情节准确**：summary 是否准确反映该章情节？
- **key_events 真实**：事件是否在原文中真正发生？
- **key_characters 存在**：角色 ID 是否在 characters.json 中存在？
- **章节错位**：是否有章节内容被分配到错误的章节号？

---

## 跨 JSON 一致性检查

### ID 引用完整性

- characters.faction → factions.json 中的 ID
- characters.known_skills / related_skills → skills.json 中的 ID
- items.owner → characters.json 或 factions.json 中的 ID
- items.related_skills → skills.json 中的 ID
- dialogues.speaker / listener → characters.json 中的 ID
- chapter_summaries.key_characters → characters.json 中的 ID

### 关系对称性

- 如果 A 的 relationships 包含 B，B 的 relationships 应包含 A（除非单向关系）

### 幻觉检测

- 是否有 ID 被引用但不存在于对应 JSON 中？
- 是否有名称被误用为 ID？

---

## 输出格式

输出一个 JSON 数组，包含所有可疑条目（最多 80 条，按严重程度排序）：

```json
[
  {
    "json_file": "skills|items|characters|factions|locations|techniques|dialogues|chapter_summaries",
    "index": 0,
    "id": "skill_xxx 或 null",
    "name": "实体名称",
    "issue_type": "cross_book|category_error|type_error|id_ref|logic|style|era|wording",
    "severity": "high|medium|low",
    "reason": "具体问题描述",
    "suggestion": "建议处理方式（删除/重分类/重读原文/人工复核）"
  }
]
```

## 工作流

1. 先通读所有 JSON，建立全书设定基线
2. 逐个 JSON 审阅，按上述标准检查
3. 对可疑条目，记录问题类型和严重程度
4. 进行跨 JSON 一致性检查
5. 按严重程度排序输出（high → medium → low）

## 注意事项

- 不要过度挑刺：只标记真正有问题的条目
- 优先标记跨书混淆、类型错误、ID 引用缺失，这些是硬伤
- 对于"可能措辞偏差"，只标记非常明显的问题
- 如果不确定，宁可不标记，避免假阳性
- **重点检查 skills.json 和 items.json 的分类是否正确**

## 审核不通过条件（任一触发即不通过）

1. **跨书混淆**：其他作品的角色/功法/地点混入（severity: high）
2. **skills.json 混入武器**：铁鞭、峨嵋刺、流星锤等应为 item 而非 skill（severity: high）
3. **ID 引用缺失**：引用了其他 JSON 中不存在的 ID（severity: high）
4. **数量完整性**：对照原文检查是否有重大遗漏
   - 重要角色遗漏（如推动剧情的关键人物）
   - 核心功法遗漏（如主要武学体系）
   - 关键物品遗漏（如核心道具）
   - 如有遗漏，severity 为 high

## 输出

直接输出 JSON 数组，不要额外解释。


## 数据

### characters.json (51 条)
[
  {
    "id": "char_yang_guo",
    "name": "杨过",
    "role": "核心",
    "identity": "杨康之子，古墓派传人，后自创武功成为神雕大侠",
    "faction": null,
    "personality": [
      "叛逆不羁",
      "深情专一",
      "聪明机敏"
    ],
    "one_line": "叛逆深情的独臂大侠，与小龙女历经磨难终成眷属"
  },
  {
    "id": "char_xiao_long_nyu",
    "name": "小龙女",
    "role": "核心",
    "identity": "古墓派掌门，杨过之妻",
    "faction": "faction_gu_mu_pai",
    "personality": [
      "冷若冰霜",
      "天真纯净",
      "深情专一"
    ],
    "one_line": "冷若冰霜的古墓仙子，与杨过生死相随至死不渝"
  },
  {
    "id": "char_guo_jing",
    "name": "郭靖",
    "role": "核心",
    "identity": "襄阳守将，丐帮帮主之婿",
    "faction": "faction_gai_bang",
    "personality": [
      "正直忠厚",
      "大义凛然",
      "愚钝执着"
    ],
    "one_line": "侠之大者为国为民，镇守襄阳数十年的当世大侠"
  },
  {
    "id": "char_huang_rong",
    "name": "黄蓉",
    "role": "核心",
    "identity": "丐帮帮主之妻，黄药师之女",
    "faction": "faction_gai_bang",
    "personality": [
      "聪明机智",
      "护女心切",
      "心思缜密"
    ],
    "one_line": "聪慧绝伦的丐帮女侠，为护女儿对杨过多有防备"
  },
  {
    "id": "char_guo_fu",
    "name": "郭芙",
    "role": "重要",
    "identity": "郭靖长女",
    "faction": "faction_gai_bang",
    "personality": [
      "骄纵任性",
      "鲁莽冲动",
      "争强好胜"
    ],
    "one_line": "骄纵任性的郭家大小姐，一怒斩断杨过右臂"
  },
  {
    "id": "char_guo_xiang",
    "name": "郭襄",
    "role": "重要",
    "identity": "郭靖次女，后创峨嵋派",
    "faction": "faction_gai_bang",
    "personality": [
      "豪爽仗义",
      "天真烂漫",
      "不拘小节"
    ],
    "one_line": "豪爽仗义的郭家二小姐，一生仰慕神雕大侠"
  },
  {
    "id": "char_li_mo_chou",
    "name": "李莫愁",
    "role": "重要",
    "identity": "古墓派叛徒，江湖女魔头",
    "faction": null,
    "personality": [
      "心狠手辣",
      "因爱生恨",
      "孤傲偏执"
    ],
    "one_line": "因情生恨的赤练仙子，为爱痴狂终葬身火海"
  },
  {
    "id": "char_jin_lun_fa_wang",
    "name": "金轮法王",
    "role": "重要",
    "identity": "蒙古国师，密宗高手",
    "faction": "faction_meng_gu",
    "personality": [
      "武功高强",
      "争强好胜",
      "刚愎自用"
    ],
    "one_line": "蒙古第一高手，与中原群侠多次交锋的大反派"
  },
  {
    "id": "char_zhou_bo_tong",
    "name": "周伯通",
    "role": "重要",
    "identity": "全真教王重阳师弟，天下五绝之首",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "天真烂漫",
      "嗜武如命",
      "不拘礼法"
    ],
    "one_line": "天真烂漫的老顽童，武学修为冠绝天下却毫无架子"
  },
  {
    "id": "char_yi_deng_da_shi",
    "name": "一灯大师",
    "role": "重要",
    "identity": "原大理皇帝，后出家为僧",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "慈悲为怀",
      "大彻大悟",
      "沉稳睿智"
    ],
    "one_line": "昔日大理皇帝出家为僧，一阳指绝技威震天下"
  },
  {
    "id": "char_huang_yao_shi",
    "name": "黄药师",
    "role": "重要",
    "identity": "桃花岛主，天下五绝之一",
    "faction": "faction_tao_hua_dao",
    "personality": [
      "孤傲狂放",
      "才华横溢",
      "离经叛道"
    ],
    "one_line": "孤傲狂放的东邪，琴棋书画医卜无所不通"
  },
  {
    "id": "char_gong_sun_zhi",
    "name": "公孙止",
    "role": "重要",
    "identity": "绝情谷谷主",
    "faction": "faction_jue_qing_gu",
    "personality": [
      "阴险狡诈",
      "虚伪好色",
      "心胸狭窄"
    ],
    "one_line": "阴险狡诈的绝情谷主，贪慕小龙女美色"
  },
  {
    "id": "char_gong_sun_lu_e",
    "name": "公孙绿萼",
    "role": "重要",
    "identity": "公孙止之女",
    "faction": "faction_jue_qing_gu",
    "personality": [
      "温柔善良",
      "痴情无私",
      "逆来顺受"
    ],
    "one_line": "温柔善良的绝情谷主之女，为救杨过甘愿牺牲性命"
  },
  {
    "id": "char_ye_lv_qi",
    "name": "耶律齐",
    "role": "重要",
    "identity": "丐帮帮主，郭芙之夫",
    "faction": "faction_gai_bang",
    "personality": [
      "稳重沉着",
      "忠厚老实",
      "有勇有谋"
    ],
    "one_line": "稳重有才干的丐帮帮主，郭靖女婿"
  },
  {
    "id": "char_cheng_ying",
    "name": "程英",
    "role": "重要",
    "identity": "黄药师关门弟子",
    "faction": "faction_tao_hua_dao",
    "personality": [
      "温柔内敛",
      "含蓄深沉",
      "知书达理"
    ],
    "one_line": "温柔内敛的桃花岛弟子，一生暗恋杨过却默默守候"
  },
  {
    "id": "char_lu_wu_shuang",
    "name": "陆无双",
    "role": "重要",
    "identity": "李莫愁弟子，陆展元侄女",
    "faction": null,
    "personality": [
      "泼辣直爽",
      "倔强好胜",
      "外刚内柔"
    ],
    "one_line": "泼辣直爽的李莫愁弟子，暗恋杨过一生"
  },
  {
    "id": "char_wu_san_tong",
    "name": "武三通",
    "role": "重要",
    "identity": "一灯大师弟子，武氏兄弟之父",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "痴情偏执",
      "疯疯癫癫",
      "护短"
    ],
    "one_line": "痴恋义女何沅君的一灯弟子，疯疯癫癫的老怪客"
  },
  {
    "id": "char_wu_dun_ru",
    "name": "武敦儒",
    "role": "重要",
    "identity": "武三通长子",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "敦厚老实",
      "循规蹈矩",
      "忠厚木讷"
    ],
    "one_line": "武三通之子，郭靖弟子，性格敦厚"
  },
  {
    "id": "char_wu_xiu_wen",
    "name": "武修文",
    "role": "重要",
    "identity": "武三通次子",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "机灵活泼",
      "争强好胜",
      "心直口快"
    ],
    "one_line": "武三通之子，郭靖弟子，曾暗恋郭芙"
  },
  {
    "id": "char_wan_yan_ping",
    "name": "完颜萍",
    "role": "重要",
    "identity": "金国贵族后裔",
    "faction": null,
    "personality": [
      "温婉秀丽",
      "外柔内刚",
      "痴情执着"
    ],
    "one_line": "金国遗族女子，暗恋杨过后嫁给武修文"
  },
  {
    "id": "char_ke_zhen_e",
    "name": "柯镇恶",
    "role": "次要",
    "identity": "江南七怪之首",
    "faction": null,
    "personality": [
      "刚正不阿",
      "嫉恶如仇",
      "倔强固执"
    ],
    "one_line": "瞎眼却刚正不阿的江南七怪之首，郭靖恩师"
  },
  {
    "id": "char_qiu_qian_ren",
    "name": "裘千仞",
    "role": "次要",
    "identity": "原铁掌帮帮主，后出家法号慈恩",
    "faction": null,
    "personality": [
      "改邪归正",
      "心魔难除",
      "武功高强"
    ],
    "one_line": "昔日铁掌帮主改邪归正出家为僧，终被金轮法王击毙"
  },
  {
    "id": "char_ying_gu",
    "name": "瑛姑",
    "role": "次要",
    "identity": "周伯通旧情人，段智兴妃子",
    "faction": null,
    "personality": [
      "痴情执着",
      "怨恨难消",
      "聪明机敏"
    ],
    "one_line": "痴等周伯通数十年的苦命女子，精通奇门术数"
  },
  {
    "id": "char_huo_du",
    "name": "霍都",
    "role": "次要",
    "identity": "蒙古王子，金轮法王弟子",
    "faction": "faction_meng_gu",
    "personality": [
      "阴险狡诈",
      "野心勃勃",
      "善于伪装"
    ],
    "one_line": "蒙古王子，金轮法王弟子，阴险狡诈"
  },
  {
    "id": "char_da_er_ba",
    "name": "达尔巴",
    "role": "次要",
    "identity": "金轮法王弟子",
    "faction": "faction_meng_gu",
    "personality": [
      "憨厚忠诚",
      "武艺高强",
      "头脑简单"
    ],
    "one_line": "金轮法王大弟子，憨厚忠诚的蒙古武士"
  },
  {
    "id": "char_yin_ke_xi",
    "name": "尹克西",
    "role": "次要",
    "identity": "波斯商人，蒙古高手",
    "faction": "faction_meng_gu",
    "personality": [
      "精明算计",
      "见风使舵",
      "贪财好利"
    ],
    "one_line": "波斯商人出身的蒙古高手，精于算计"
  },
  {
    "id": "char_xiao_xiang_zi",
    "name": "潇湘子",
    "role": "次要",
    "identity": "湘西名宿，蒙古高手",
    "faction": "faction_meng_gu",
    "personality": [
      "阴沉诡异",
      "沉默寡言",
      "心狠手辣"
    ],
    "one_line": "湘西名宿，蒙古阵营高手，武功诡异"
  },
  {
    "id": "char_jue_yuan",
    "name": "觉远",
    "role": "次要",
    "identity": "少林寺僧人",
    "faction": "faction_shao_lin_si",
    "personality": [
      "憨厚老实",
      "佛法精深",
      "不谙世事"
    ],
    "one_line": "少林寺藏经阁僧人，内功深厚却不自知"
  },
  {
    "id": "char_zhang_jun_bao",
    "name": "张君宝",
    "role": "次要",
    "identity": "觉远弟子，后创武当派",
    "faction": "faction_shao_lin_si",
    "personality": [
      "天资聪颖",
      "勤奋好学",
      "沉稳内敛"
    ],
    "one_line": "少林小僧得杨过指点，后创立武当派成一代宗师"
  },
  {
    "id": "char_hong_ling_bo",
    "name": "洪凌波",
    "role": "次要",
    "identity": "李莫愁弟子",
    "faction": null,
    "personality": [
      "温顺柔弱",
      "胆小怕事",
      "善良"
    ],
    "one_line": "李莫愁大弟子，性格温顺却命途多舛"
  },
  {
    "id": "char_lu_li_ding",
    "name": "陆立鼎",
    "role": "次要",
    "identity": "陆展元之弟",
    "faction": null,
    "personality": [
      "忠厚老实",
      "胆小怕事"
    ],
    "one_line": "陆展元之弟，因兄嫂恩怨被李莫愁杀害"
  },
  {
    "id": "char_lu_er_niang",
    "name": "陆二娘",
    "role": "次要",
    "identity": "陆立鼎之妻",
    "faction": null,
    "personality": [
      "温柔贤淑",
      "胆小怕事"
    ],
    "one_line": "陆立鼎之妻，随夫被李莫愁杀害"
  },
  {
    "id": "char_shi_shu_gang",
    "name": "史叔刚",
    "role": "次要",
    "identity": "万兽山庄庄主",
    "faction": "faction_wan_shou_shan_zhuang",
    "personality": [
      "豪爽直率",
      "善于驯兽",
      "重义气"
    ],
    "one_line": "万兽山庄庄主，驯兽高手"
  },
  {
    "id": "char_shi_shao_je",
    "name": "史少捷",
    "role": "次要",
    "identity": "万兽山庄少庄主",
    "faction": "faction_wan_shou_shan_zhuang",
    "personality": [
      "年少气盛",
      "争强好胜"
    ],
    "one_line": "万兽山庄少庄主，史叔刚之弟"
  },
  {
    "id": "char_da_tou_gui",
    "name": "大头鬼",
    "role": "次要",
    "identity": "西山一窟鬼之一",
    "faction": null,
    "personality": [
      "古怪",
      "重义气",
      "豪爽"
    ],
    "one_line": "西山一窟鬼之一，头大身矮的怪人"
  },
  {
    "id": "char_guo_po_lu",
    "name": "郭破虏",
    "role": "龙套",
    "identity": "郭靖之子",
    "faction": "faction_gai_bang",
    "personality": [
      "忠厚老实",
      "勤勉刻苦"
    ],
    "one_line": "郭靖之子，少年英杰，随父母殉城"
  },
  {
    "id": "char_ye_lv_yan",
    "name": "耶律燕",
    "role": "龙套",
    "identity": "耶律齐之妹",
    "faction": "faction_gai_bang",
    "personality": [
      "温婉秀丽",
      "知书达理"
    ],
    "one_line": "耶律齐之妹，嫁给武敦儒"
  },
  {
    "id": "char_lu_you_jiao",
    "name": "鲁有脚",
    "role": "龙套",
    "identity": "丐帮长老",
    "faction": "faction_gai_bang",
    "personality": [
      "忠心耿耿",
      "老成持重",
      "正直"
    ],
    "one_line": "丐帮长老，忠心耿耿的老帮众"
  },
  {
    "id": "char_zhu_zi_liu",
    "name": "朱子柳",
    "role": "龙套",
    "identity": "一灯大师弟子",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "文武双全",
      "忠心耿耿",
      "儒雅风流"
    ],
    "one_line": "一灯大师弟子，大理国丞相，文武双全"
  },
  {
    "id": "char_dian_cang_yu_yin",
    "name": "点苍渔隐",
    "role": "龙套",
    "identity": "一灯大师弟子",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "沉默寡言",
      "忠心耿耿",
      "武艺高强"
    ],
    "one_line": "一灯大师弟子，渔夫打扮的大理高手"
  },
  {
    "id": "char_lu_zhan_yuan",
    "name": "陆展元",
    "role": "龙套",
    "identity": "陆立鼎之兄，李莫愁旧情人",
    "faction": null,
    "personality": [
      "风流倜傥",
      "薄情寡义"
    ],
    "one_line": "抛弃李莫愁娶何沅君的陆家大公子，已故"
  },
  {
    "id": "char_he_yuan_jun",
    "name": "何沅君",
    "role": "龙套",
    "identity": "武三通义女，陆展元之妻",
    "faction": null,
    "personality": [
      "温柔善良",
      "美丽动人"
    ],
    "one_line": "武三通义女，陆展元之妻，已故"
  },
  {
    "id": "char_wu_niang_zi",
    "name": "武娘子",
    "role": "龙套",
    "identity": "武三通之妻",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "贤良淑德",
      "逆来顺受"
    ],
    "one_line": "武三通之妻，武敦儒武修文之母"
  },
  {
    "id": "char_zhao_zhi_jing",
    "name": "赵志敬",
    "role": "次要",
    "identity": "全真教道士，杨过在全真教时的师父",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "阴险",
      "狡诈",
      "贪婪"
    ],
    "one_line": "阴险狡诈的全真教道士，虐待杨过后叛教投蒙"
  },
  {
    "id": "char_ou_yang_feng",
    "name": "欧阳锋",
    "role": "重要",
    "identity": "西毒，杨过义父",
    "faction": null,
    "personality": [
      "阴毒",
      "狠辣",
      "疯癫"
    ],
    "one_line": "逆练九阴真经致疯癫的西毒，杨过义父"
  },
  {
    "id": "char_zhen_zhi_bing",
    "name": "甄志丙",
    "role": "次要",
    "identity": "全真教道士，后为代掌教",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "痴情",
      "懦弱",
      "内疚"
    ],
    "one_line": "暗恋小龙女的全真教道士，为赎罪而死"
  },
  {
    "id": "char_lv_wen_huan",
    "name": "吕文焕",
    "role": "龙套",
    "identity": "襄阳守将",
    "faction": null,
    "personality": [
      "懦弱",
      "无能",
      "贪生怕死"
    ],
    "one_line": "懦弱无能的襄阳守将"
  },
  {
    "id": "char_tian_zhu_seng",
    "name": "天竺僧",
    "role": "次要",
    "identity": "一灯大师师弟，医术高明",
    "faction": null,
    "personality": [
      "慈悲",
      "智慧",
      "淡泊"
    ],
    "one_line": "医术高明的天竺僧，一灯大师师弟"
  },
  {
    "id": "char_wang_zhi_tan",
    "name": "王志坦",
    "role": "龙套",
    "identity": "全真教道士",
    "faction": "faction_quan_zhen_jiao",
    "personality": [],
    "one_line": "全真教道士，曾斥责赵志敬"
  },
  {
    "id": "char_lu_qing_du",
    "name": "鹿清笃",
    "role": "龙套",
    "identity": "全真教道士，赵志敬弟子",
    "faction": "faction_quan_zhen_jiao",
    "personality": [],
    "one_line": "赵志敬弟子，欺侮杨过的全真教道士"
  },
  {
    "id": "char_ci_en",
    "name": "慈恩",
    "role": "次要",
    "identity": "原铁掌帮帮主，后出家法号慈恩，一灯大师弟子",
    "faction": null,
    "personality": [
      "忏悔",
      "挣扎",
      "刚烈"
    ],
    "one_line": "原裘千仞改邪归正出家为僧，忏悔挣扎终得解脱"
  }
]

### factions.json (10 条)
[
  {
    "id": "faction_quan_zhen_jiao",
    "name": "全真教",
    "type": "武林门派",
    "location": "loc_zhong_nan_shan",
    "one_line": "王重阳所创道教门派，天下武学正宗"
  },
  {
    "id": "faction_gu_mu_pai",
    "name": "古墓派",
    "type": "武林门派",
    "location": "loc_gu_mu",
    "one_line": "林朝英所创，居活死人墓，与全真教对门而居"
  },
  {
    "id": "faction_gai_bang",
    "name": "丐帮",
    "type": "帮派",
    "location": "loc_xiang_yang",
    "one_line": "天下第一大帮，帮主传降龙十八掌与打狗棒法"
  },
  {
    "id": "faction_da_li_duan_shi",
    "name": "大理段氏",
    "type": "王族",
    "location": "loc_da_li",
    "one_line": "大理皇室，以一阳指闻名天下"
  },
  {
    "id": "faction_shao_lin_si",
    "name": "少林寺",
    "type": "寺院",
    "location": "loc_shao_shi_shan",
    "one_line": "武林泰斗，千年古刹，武学渊薮"
  },
  {
    "id": "faction_jue_qing_gu",
    "name": "绝情谷",
    "type": "武林门派",
    "location": "loc_jue_qing_gu",
    "one_line": "公孙止所据幽谷，遍植情花，谷规断情绝爱"
  },
  {
    "id": "faction_tao_hua_dao",
    "name": "桃花岛",
    "type": "家族",
    "location": "loc_tao_hua_dao",
    "one_line": "东海奇岛，黄药师隐居之所，精通奇门遁甲"
  },
  {
    "id": "faction_bai_tuo_shan",
    "name": "白驼山",
    "type": "武林门派",
    "location": "loc_bai_tuo_shan",
    "one_line": "西域欧阳锋所据，以蛤蟆功闻名"
  },
  {
    "id": "faction_meng_gu",
    "name": "蒙古",
    "type": "部族",
    "location": "loc_xiang_yang",
    "one_line": "蒙古大军南侵，金轮法王等高手效力"
  },
  {
    "id": "faction_wan_shou_shan_zhuang",
    "name": "万兽山庄",
    "type": "家族",
    "location": "loc_wan_shou_shan_zhuang",
    "one_line": "史氏兄弟所据，驯养猛兽，义薄云天"
  }
]

### locations.json (18 条)
[
  {
    "id": "loc_xiang_yang",
    "name": "襄阳",
    "region": "中原",
    "one_line": "南宋抗蒙前线重镇，郭靖黄蓉守城之地"
  },
  {
    "id": "loc_jue_qing_gu",
    "name": "绝情谷",
    "region": "中原",
    "one_line": "幽深山谷遍植情花，公孙止据谷为王"
  },
  {
    "id": "loc_gu_mu",
    "name": "古墓",
    "region": "终南山",
    "one_line": "活死人墓，古墓派所在，杨过小龙女修炼之地"
  },
  {
    "id": "loc_tao_hua_dao",
    "name": "桃花岛",
    "region": "东海",
    "one_line": "东海奇岛，黄药师隐居之所"
  },
  {
    "id": "loc_hua_shan",
    "name": "华山",
    "region": "中原",
    "one_line": "五岳之西岳，武林论剑论武之地"
  },
  {
    "id": "loc_zhong_nan_shan",
    "name": "终南山",
    "region": "中原",
    "one_line": "道教名山，全真教总坛所在"
  },
  {
    "id": "loc_feng_ling_du",
    "name": "风陵渡",
    "region": "中原",
    "one_line": "黄河渡口，郭襄初闻杨过神雕侠事迹"
  },
  {
    "id": "loc_jia_xing_lu_jia_zhuang",
    "name": "嘉兴陆家庄",
    "region": "江南",
    "one_line": "陆展元何沅君故居，故事开端之地"
  },
  {
    "id": "loc_da_sheng_guan",
    "name": "大胜关",
    "region": "中原",
    "one_line": "英雄大会举办之地，群雄汇聚"
  },
  {
    "id": "loc_jue_qing_gu_di",
    "name": "绝情谷底",
    "region": "绝情谷深处",
    "one_line": "深潭之下别有洞天，小龙女十六年独居之所"
  },
  {
    "id": "loc_chong_yang_gong",
    "name": "重阳宫",
    "region": "终南山",
    "one_line": "全真教主殿，王重阳开创基业之地"
  },
  {
    "id": "loc_xiang_yang_cheng",
    "name": "襄阳城",
    "region": "中原",
    "one_line": "南宋军事重镇，郭靖黄蓉誓死守卫之城"
  },
  {
    "id": "loc_shen_diao_gu",
    "name": "神雕谷",
    "region": "山谷",
    "one_line": "独孤求败埋剑隐居之谷，神雕栖息之地"
  },
  {
    "id": "loc_wan_shou_shan_zhuang",
    "name": "万兽山庄",
    "region": "中原",
    "one_line": "史氏兄弟所据山庄，驯养百兽"
  },
  {
    "id": "loc_jia_xing_nan_hu",
    "name": "嘉兴南湖",
    "region": "江南",
    "one_line": "江南水乡，故事开篇之地"
  },
  {
    "id": "loc_bai_tuo_shan",
    "name": "白驼山",
    "region": "西域",
    "one_line": "西域欧阳锋据点，蛤蟆功发源地"
  },
  {
    "id": "loc_da_li",
    "name": "大理",
    "region": "西南",
    "one_line": "西南古国，段氏皇室故国"
  },
  {
    "id": "loc_shao_shi_shan",
    "name": "少室山",
    "region": "中原",
    "one_line": "嵩山之西峰，少林寺所在"
  }
]

### skills.json (20 条)
[
  {
    "id": "skill_an_ran_xiao_hun_zhang",
    "name": "黯然销魂掌",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "杨过自创掌法，思念小龙女黯然神伤时威力最大"
  },
  {
    "id": "skill_xuan_tie_jian_fa",
    "name": "玄铁剑法",
    "type": "剑法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "独孤求败所创，重剑无锋大巧不工，以拙胜巧"
  },
  {
    "id": "skill_yu_nv_xin_jing",
    "name": "玉女心经",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "古墓派至高内功，需男女双修，阴阳互济"
  },
  {
    "id": "skill_jiu_yin_zhen_jing",
    "name": "九阴真经",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "天下武学总纲，载录天下武功精要"
  },
  {
    "id": "skill_jiang_long_shi_ba_zhang",
    "name": "降龙十八掌",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "丐帮镇帮绝学，掌力刚猛天下第一"
  },
  {
    "id": "skill_yi_yang_zhi",
    "name": "一阳指",
    "type": "指法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "大理段氏绝学，内力聚于指尖，可攻可疗伤"
  },
  {
    "id": "skill_ha_ma_gong",
    "name": "蛤蟆功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "欧阳锋独门绝学，蓄力如蛤蟆，一击必杀"
  },
  {
    "id": "skill_tan_zhi_shen_tong",
    "name": "弹指神通",
    "type": "指法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "黄药师绝学，以指弹物伤人于无形"
  },
  {
    "id": "skill_zuo_you_hu_bo_shu",
    "name": "左右互搏术",
    "type": "奇门兵器",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "周伯通自创奇术，双手各使不同武功，一心二用"
  },
  {
    "id": "skill_yu_nv_su_xin_jian_fa",
    "name": "玉女素心剑法",
    "type": "剑法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "古墓派剑法，需男女双人合使，阴阳互补威力无穷"
  },
  {
    "id": "skill_quan_zhen_jian_fa",
    "name": "全真剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "全真教基础剑法，剑招端正大气，中正平和"
  },
  {
    "id": "skill_tie_zhang_gong",
    "name": "铁掌功",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "裘千仞绝学，掌力刚猛仅次于降龙十八掌"
  },
  {
    "id": "skill_long_xiang_ban_re_gong",
    "name": "龙象般若功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "密宗至高无上内功，共十三层，每层增一龙一象之力"
  },
  {
    "id": "skill_tian_luo_di_wang_shi",
    "name": "天罗地网势",
    "type": "轻功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "古墓派轻功身法，方寸间腾挪闪避如天罗地网"
  },
  {
    "id": "skill_yin_bian_fa",
    "name": "银鞭法",
    "type": "奇门兵器",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "李莫愁武功，以银鞭为兵器，招式狠辣"
  },
  {
    "id": "skill_wu_du_shen_zhang",
    "name": "五毒神掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "李莫愁毒功掌法，掌中蕴含五种剧毒"
  },
  {
    "id": "skill_bing_po_yin_zhen",
    "name": "冰魄银针",
    "type": "暗器",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "李莫愁暗器，银针蕴含剧毒，见血封喉"
  },
  {
    "id": "skill_da_gou_bang_fa",
    "name": "打狗棒法",
    "type": "棒法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "丐帮帮主绝学，招式精妙变化多端"
  },
  {
    "id": "skill_fu_mo_zhang_fa",
    "name": "伏魔杖法",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "柯镇恶杖法武功，杖法刚猛有力"
  },
  {
    "id": "skill_xian_tian_gong",
    "name": "先天功",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "王重阳绝学内功，纯阳无极，先天之气"
  }
]

### techniques.json (33 条)
[
  {
    "id": "tech_xin_jing_rou_tiao",
    "name": "心惊肉跳",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_qi_ren_you_tian",
    "name": "杞人忧天",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_wu_zhong_sheng_you",
    "name": "无中生有",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_tuo_ni_dai_shui",
    "name": "拖泥带水",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_pai_huai_kong_gu",
    "name": "徘徊空谷",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_li_bu_cong_xin",
    "name": "力不从心",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_xing_shi_zou_rou",
    "name": "行尸走肉",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_dao_xing_ni_shi",
    "name": "倒行逆施",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_fei_qin_wang_shi",
    "name": "废寝忘食",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_gu_xing_zhi_ying",
    "name": "孤形只影",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_yin_hen_tun_sheng",
    "name": "饮恨吞声",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_liu_shen_bu_an",
    "name": "六神不安",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_qiong_tu_mo_lu",
    "name": "穷途末路",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_mian_wu_ren_se",
    "name": "面无人色",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_xiang_ru_fei_fei",
    "name": "想入非非",
    "type": "attack",
    "source_skill": "skill_an_ran_xiao_hun_zhang"
  },
  {
    "id": "tech_kang_long_you_hui",
    "name": "亢龙有悔",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_fei_long_zai_tian",
    "name": "飞龙在天",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_jian_long_zai_tian",
    "name": "见龙在田",
    "type": "defense",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_hong_jian_yu_lu",
    "name": "鸿渐于陆",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_qian_long_wu_yong",
    "name": "潜龙勿用",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_li_she_da_chuan",
    "name": "利涉大川",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_tu_ru_qi_lai",
    "name": "突如其来",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_zhen_jing_bai_li",
    "name": "震惊百里",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_bang_da_shuang_quan",
    "name": "棒打双犬",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_bang_da_gou_tou",
    "name": "棒打狗头",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_fan_jie_gou_tun",
    "name": "反截狗臀",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_jie_gou_wei",
    "name": "截狗尾",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_ya_jian_gou_bei",
    "name": "压肩狗背",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_bo_gou_chao_tian",
    "name": "拨狗朝天",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_tian_xia_wu_gou",
    "name": "天下无狗",
    "type": "attack",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_yi_yang_zhi_li",
    "name": "一阳指力",
    "type": "attack",
    "source_skill": "skill_yi_yang_zhi"
  },
  {
    "id": "tech_yu_nv_jian_fa",
    "name": "玉女剑法",
    "type": "attack",
    "source_skill": "skill_yu_nv_su_xin_jian_fa"
  },
  {
    "id": "tech_su_xin_jian_fa",
    "name": "素心剑法",
    "type": "attack",
    "source_skill": "skill_yu_nv_su_xin_jian_fa"
  }
]

### items.json (22 条)
[
  {
    "id": "item_xuan_tie_chong_jian",
    "name": "玄铁重剑",
    "type": "兵器",
    "owner": "char_yang_guo",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_xuan_tie_jian_fa"
    ],
    "one_line": "独孤求败遗物，杨过习得玄铁剑法的关键兵器"
  },
  {
    "id": "item_jun_zi_jian",
    "name": "君子剑",
    "type": "兵器",
    "owner": "char_yang_guo",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "绝情谷中与淑女剑成对的宝剑"
  },
  {
    "id": "item_shu_nyu_jian",
    "name": "淑女剑",
    "type": "兵器",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "绝情谷中与君子剑成对的宝剑"
  },
  {
    "id": "item_da_gou_bang",
    "name": "打狗棒",
    "type": "兵器",
    "owner": "char_huang_rong",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_da_gou_bang_fa"
    ],
    "one_line": "丐帮帮主信物，配合打狗棒法威力无穷"
  },
  {
    "id": "item_tie_jiang",
    "name": "铁桨",
    "type": "兵器",
    "owner": "char_ke_zhen_e",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "柯镇恶的独门兵器铁桨"
  },
  {
    "id": "item_fu_chen",
    "name": "拂尘",
    "type": "兵器",
    "owner": "char_li_mo_chou",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "李莫愁的随身兵器拂尘"
  },
  {
    "id": "item_yu_feng_jin_zhen",
    "name": "玉蜂金针",
    "type": "暗器",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_bing_po_yin_zhen"
    ],
    "one_line": "古墓派暗器，细如牛毛剧毒无比"
  },
  {
    "id": "item_bing_po_yin_zhen",
    "name": "冰魄银针",
    "type": "暗器",
    "owner": "char_li_mo_chou",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_bing_po_yin_zhen"
    ],
    "one_line": "李莫愁独门暗器，中者无药可救"
  },
  {
    "id": "item_jiu_yin_zhen_jing",
    "name": "九阴真经",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_jiu_yin_zhen_jing"
    ],
    "one_line": "天下武学总纲，载有绝世武功"
  },
  {
    "id": "item_yu_nv_xin_jing_mi_ji",
    "name": "玉女心经秘籍",
    "type": "秘籍",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_yu_nv_xin_jing"
    ],
    "one_line": "古墓派内功秘籍，需男女合练"
  },
  {
    "id": "item_jue_qing_dan",
    "name": "绝情丹",
    "type": "丹药",
    "owner": null,
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "解情花毒的圣药"
  },
  {
    "id": "item_duan_chang_cao",
    "name": "断肠草",
    "type": "丹药",
    "owner": null,
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "以毒攻毒解情花毒的草药"
  },
  {
    "id": "item_qing_hua_du",
    "name": "情花毒",
    "type": "毒药",
    "owner": null,
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "绝情谷特产剧毒，动情则毒发"
  },
  {
    "id": "item_ban_mei_ling_dan",
    "name": "半枚灵丹",
    "type": "丹药",
    "owner": null,
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "疗伤圣药，仅存半枚"
  },
  {
    "id": "item_jin_zhen",
    "name": "金针",
    "type": "信物",
    "owner": "char_guo_xiang",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "杨过赠郭襄三枚金针，可许三个愿望"
  },
  {
    "id": "item_mian_ju",
    "name": "面具",
    "type": "信物",
    "owner": "char_yang_guo",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "杨过所戴面具，遮掩容貌"
  },
  {
    "id": "item_shen_diao",
    "name": "神雕",
    "type": "坐骑",
    "owner": "char_yang_guo",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_xuan_tie_jian_fa"
    ],
    "one_line": "杨过的伴侣神雕，通人性"
  },
  {
    "id": "item_yu_feng",
    "name": "玉蜂",
    "type": "工具",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "古墓派养的玉蜂，可产蜜和攻击"
  },
  {
    "id": "item_yu_nyu_jian",
    "name": "玉女剑",
    "type": "兵器",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_yu_nv_su_xin_jian_fa"
    ],
    "one_line": "古墓派传承宝剑，轻灵飘逸"
  },
  {
    "id": "item_xuan_tie_zhi_huan",
    "name": "玄铁指环",
    "type": "饰品",
    "owner": "char_yang_guo",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "杨过佩戴的玄铁指环"
  },
  {
    "id": "item_yu_feng_jiang",
    "name": "玉蜂浆",
    "type": "食物",
    "owner": "char_xiao_long_nyu",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "玉蜂所产蜂蜜，可疗伤补气"
  },
  {
    "id": "item_qing_hua",
    "name": "情花",
    "type": "毒药",
    "owner": null,
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "绝情谷特产花卉，美丽却剧毒"
  }
]

### dialogues.json (前 50 条 / 共 254 条)
[
  {
    "index": 0,
    "speaker": null,
    "speaker_name": "怪客（武三通）",
    "listener": "char_cheng_ying",
    "text": "何沅君呢？何沅君到那里去了？",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 1,
    "speaker": "char_cheng_ying",
    "speaker_name": "程英",
    "listener": null,
    "text": "我⋯⋯我⋯⋯我不知道。",
    "tone": "恐惧",
    "chapter": 1,
    "line_start": 35,
    "line_end": 35
  },
  {
    "index": 2,
    "speaker": null,
    "speaker_name": "怪客（武三通）",
    "listener": "char_cheng_ying",
    "text": "哭啊，哭啊！你干么不哭？哼，你在十年前就这样。我不准你嫁给他，你说不舍得离开我，可是非跟他走不可。你说感激我对你的恩情，离开我心里很难过，呸！都是骗人的鬼话。你要是真伤心，又怎么不哭？",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 35,
    "line_end": 35
  },
  {
    "index": 3,
    "speaker": "char_cheng_ying",
    "speaker_name": "程英",
    "listener": null,
    "text": "老伯伯，我爹爹早死了。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 4,
    "speaker": "char_lu_wu_shuang",
    "speaker_name": "陆无双",
    "listener": null,
    "text": "我自然认得，他是我大伯。",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 55,
    "line_end": 55
  },
  {
    "index": 5,
    "speaker": "char_lu_wu_shuang",
    "speaker_name": "陆无双",
    "listener": null,
    "text": "死了有三年啦。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 6,
    "speaker": null,
    "speaker_name": "怪客（武三通）",
    "listener": null,
    "text": "死得好，死得好，只可惜我不能亲手取他狗命。",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 65,
    "line_end": 65
  },
  {
    "index": 7,
    "speaker": "char_cheng_ying",
    "speaker_name": "程英",
    "listener": null,
    "text": "老伯伯，别打了，你打痛了自己的手。",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 77,
    "line_end": 77
  },
  {
    "index": 8,
    "speaker": "char_li_mo_chou",
    "speaker_name": "李莫愁",
    "listener": "char_lu_li_ding",
    "text": "但取陆家一门七口性命，余人快快出去。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 121,
    "line_end": 121
  },
  {
    "index": 9,
    "speaker": "char_hong_ling_bo",
    "speaker_name": "洪凌波",
    "listener": "char_lu_li_ding",
    "text": "你知道就好啦！快把你妻子、女儿、婢仆尽都杀了，然后自尽，免得我多费一番手脚。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 125,
    "line_end": 125
  },
  {
    "index": 10,
    "speaker": null,
    "speaker_name": "武娘子",
    "listener": null,
    "text": "你师父如有本事，就该早寻陆展元算帐，现下明知他死了，却来找旁人晦气，羞也不羞？",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 131,
    "line_end": 131
  },
  {
    "index": 11,
    "speaker": "char_li_mo_chou",
    "speaker_name": "李莫愁",
    "listener": "char_lu_li_ding",
    "text": "陆二爷，你哥哥倘若尚在，只要他出口求我，再休了何沅君那小贱人，我未始不可饶了你家一门良贱。如今，唉，你们运气不好，只怪你哥哥太短命，可怪不得我。",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 215,
    "line_end": 215
  },
  {
    "index": 12,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": null,
    "text": "啧啧，大美人儿好美貌，小美人儿也挺秀气，两位姑娘是来找我的吗？姓杨的可没这般美人儿朋友啊。",
    "tone": "调侃",
    "chapter": 2,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 13,
    "speaker": "char_guo_fu",
    "speaker_name": "郭芙",
    "listener": null,
    "text": "小叫化，谁来找你了？",
    "tone": "愤怒",
    "chapter": 2,
    "line_start": 55,
    "line_end": 55
  },
  {
    "index": 14,
    "speaker": "char_huang_rong",
    "speaker_name": "黄蓉",
    "listener": null,
    "text": "你姓杨名过，你妈妈姓穆，是不是？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 157,
    "line_end": 157
  },
  {
    "index": 15,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": "char_guo_jing",
    "text": "我妈妈死啦，死了很久啦！",
    "tone": "悲伤",
    "chapter": 2,
    "line_start": 161,
    "line_end": 161
  },
  {
    "index": 16,
    "speaker": "char_huang_rong",
    "speaker_name": "黄蓉",
    "listener": null,
    "text": "你叫做赵钱孙李、周吴陈王！",
    "tone": "调侃",
    "chapter": 2,
    "line_start": 209,
    "line_end": 209
  },
  {
    "index": 17,
    "speaker": "char_guo_jing",
    "speaker_name": "郭靖",
    "listener": "char_huang_rong",
    "text": "芙儿怎能许配给这小子。",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 6,
    "line_end": 6
  },
  {
    "index": 18,
    "speaker": "char_huang_rong",
    "speaker_name": "黄蓉",
    "listener": "char_guo_jing",
    "text": "我就怕他聪明过份了。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 19,
    "speaker": "char_huang_rong",
    "speaker_name": "黄蓉",
    "listener": "char_guo_jing",
    "text": "我却偏喜欢你这傻哥哥呢。",
    "tone": "欣喜",
    "chapter": 3,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 20,
    "speaker": "char_guo_jing",
    "speaker_name": "郭靖",
    "listener": null,
    "text": "过儿，过去的事，大家也不提了。你对师祖爷爷无礼，不能再在我门下，以后你只叫我郭伯伯便是。你郭伯伯不善教诲，只怕反耽误了你。过几天我送你去终南山重阳宫，求全真教长春子丘真人收你入门。全真派武功是武学正宗，你好好在重阳宫中用功，修心养性，盼你日后做个正人君子。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 129,
    "line_end": 129
  },
  {
    "index": 21,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": "char_guo_jing",
    "text": "我爹爹是你跟郭伯母害死的，是不是？",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 153,
    "line_end": 153
  },
  {
    "index": 22,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": "char_guo_jing",
    "text": "臭道士，贼头狗脑的山羊胡子牛鼻子，既不教我半点武功，又这般打我，怎么还配做我师父？",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 69,
    "line_end": 69
  },
  {
    "index": 23,
    "speaker": "char_qiu_qian_ren",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "胡说！那有这等事？",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 245,
    "line_end": 245
  },
  {
    "index": 24,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "没什么。你已喝了玉蜂浆，半天就好。你闯进林子来干什么？",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 13,
    "line_end": 13
  },
  {
    "index": 25,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "他的伤不碍事，婆婆，你送他出去罢！",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 27,
    "line_end": 27
  },
  {
    "index": 26,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "我不回去，我死也不回去。",
    "tone": "愤怒",
    "chapter": 5,
    "line_start": 28,
    "line_end": 28
  },
  {
    "index": 27,
    "speaker": null,
    "speaker_name": "孙婆婆",
    "listener": "char_xiao_long_nyu",
    "text": "我求你照料他一生一世，别让他吃旁人半点亏，你答不答允？",
    "tone": "恳求",
    "chapter": 5,
    "line_start": 157,
    "line_end": 157
  },
  {
    "index": 28,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "好，我答允你就是。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 157,
    "line_end": 157
  },
  {
    "index": 29,
    "speaker": null,
    "speaker_name": "孙婆婆",
    "listener": null,
    "text": "你⋯⋯你再低下头来。",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 159,
    "line_end": 159
  },
  {
    "index": 30,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "怎么？你不自刎相谢，竟要我动手么？",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 163,
    "line_end": 163
  },
  {
    "index": 31,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "我死之前，自然先杀了你。",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 207,
    "line_end": 207
  },
  {
    "index": 32,
    "speaker": null,
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，明儿你把这本事教给我好不好？",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 227,
    "line_end": 227
  },
  {
    "index": 33,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": null,
    "text": "这本事算得什么？你好好的学，我有好多厉害本事教你呢。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 227,
    "line_end": 227
  },
  {
    "index": 34,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "过儿，今日且别还手。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 35,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "过儿，你的功夫有进益了，不过你打那胖道士，却很不对。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 15,
    "line_end": 15
  },
  {
    "index": 36,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，我如得能和你联手痛打牛鼻子，挑了全真教，那可真快活死我了！",
    "tone": "欣喜",
    "chapter": 6,
    "line_start": 77,
    "line_end": 77
  },
  {
    "index": 37,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "坏人随他自管自坏去，不跟咱们相干。咱两个在这古墓之中，自在逍遥，坏人也害咱们不到。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 77,
    "line_end": 77
  },
  {
    "index": 38,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，我愿意在这古墓中陪伴你一生一世，你答允了孙婆婆的，永永远远不赶我走！",
    "tone": "恳求",
    "chapter": 6,
    "line_start": 79,
    "line_end": 79
  },
  {
    "index": 39,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，我将来大了，你也别赶我走。我不乖，你打我好了，你杀我好了，我死也不离开你！",
    "tone": "激动",
    "chapter": 6,
    "line_start": 81,
    "line_end": 81
  },
  {
    "index": 40,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "你只要乖乖的，听我话就是了。不许你用自杀来威胁我。我如要赶你走，你死不死关我什么事，威胁也没用的。",
    "tone": "冷酷",
    "chapter": 6,
    "line_start": 83,
    "line_end": 83
  },
  {
    "index": 41,
    "speaker": "char_zhao_zhi_jing",
    "speaker_name": "赵志敬",
    "listener": "char_yang_guo",
    "text": "杨过，原来是你这小畜生！",
    "tone": "愤怒",
    "chapter": 6,
    "line_start": 209,
    "line_end": 209
  },
  {
    "index": 42,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "过儿，我这伤势好不了啦，现下杀了你，咱们一块儿见孙婆婆去罢！",
    "tone": "悲伤",
    "chapter": 6,
    "line_start": 247,
    "line_end": 247
  },
  {
    "index": 43,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "我舍不得离开你！你杀我也不打紧。你如真的死了，我就自杀，否则你到了阴间，没人陪你，你会害怕的。",
    "tone": "激动",
    "chapter": 6,
    "line_start": 255,
    "line_end": 255
  },
  {
    "index": 44,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，你再也赶我不出去啦。我跟你死在一起！",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 45,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "好罢，咱俩便死在一起。",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 46,
    "speaker": "char_yang_guo",
    "speaker_name": "杨过",
    "listener": "char_xiao_long_nyu",
    "text": "姑姑，我这一生一世，就只喜欢你一个人。",
    "tone": "激动",
    "chapter": 7,
    "line_start": 45,
    "line_end": 45
  },
  {
    "index": 47,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "那很好，我对你也一样。",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 45,
    "line_end": 45
  },
  {
    "index": 48,
    "speaker": "char_li_mo_chou",
    "speaker_name": "李莫愁",
    "listener": "char_xiao_long_nyu",
    "text": "男人家变了心，你便用一千匹马也拉他不回来！就算你把钢刀架在他头颈里，逼得他回到你身边，他虚情假意，跟你花言巧语的再骗你一阵，你又有什么味道？",
    "tone": "悲伤",
    "chapter": 7,
    "line_start": 65,
    "line_end": 65
  },
  {
    "index": 49,
    "speaker": "char_xiao_long_nyu",
    "speaker_name": "小龙女",
    "listener": "char_yang_guo",
    "text": "我以前从来不怕死，反正一生一世是在这墓中，早些死、晚些死又有什么分别？可是，可是这几天啊，我老是想到，你对我这么好，我要跟你在一起好好过些快活日子，我还要到外面去瞧瞧。过儿，我又害怕，又欢喜。",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 117,
    "line_end": 117
  }
]

### chapter_summaries.json (40 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      "李莫愁血手印示警",
      "武三通挖坟盗尸",
      "程英陆无双幼年出场",
      "柯镇恶赶到陆家庄"
    ],
    "key_characters": [
      "char_li_mo_chou",
      "char_wu_san_tong",
      "char_dian_cang_yu_yin",
      "char_cheng_ying",
      "char_lu_wu_shuang",
      "char_ke_zhen_e"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      "李莫愁血洗陆家庄",
      "程英被黄药师救走",
      "陆无双被李莫愁掳走",
      "武三通发疯对战李莫愁"
    ],
    "key_characters": [
      "char_li_mo_chou",
      "char_wu_san_tong",
      "char_dian_cang_yu_yin",
      "char_cheng_ying",
      "char_lu_wu_shuang",
      "char_ke_zhen_e",
      "char_huang_yao_shi"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      "杨过幼年出场",
      "郭靖认出杨康之子",
      "郭靖决定收养杨过",
      "杨过随郭靖离开嘉兴"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_guo_fu"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      "杨过初到桃花岛",
      "黄蓉戒备杨过",
      "杨过与郭芙等人冲突",
      "武氏兄弟争宠郭芙"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_guo_fu",
      "char_wu_dun_ru",
      "char_wu_xiu_wen"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      "杨过与武氏兄弟冲突",
      "杨过遇欧阳锋",
      "欧阳锋传蛤蟆功",
      "郭靖决定送杨过去全真教"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_wu_dun_ru",
      "char_wu_xiu_wen"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回",
    "key_events": [
      "郭靖带杨过上终南山",
      "郭靖与全真教冲突",
      "杨过拜赵志敬为师",
      "杨过留在全真教"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回",
    "key_events": [
      "杨过在全真教受欺凌",
      "杨过与赵志敬冲突",
      "杨过逃入活死人墓",
      "孙婆婆发现杨过"
    ],
    "key_characters": [
      "char_yang_guo"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回",
    "key_events": [
      "杨过初见小龙女",
      "孙婆婆恳求收留杨过",
      "孙婆婆被全真教害死",
      "杨过拜小龙女为师"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回",
    "key_events": [
      "杨过修习古墓派武功",
      "杨过与小龙女朝夕相处",
      "玉女心经基础修炼",
      "师徒感情渐深"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回",
    "key_events": [
      "杨过武功大进",
      "杨过对小龙女生情",
      "欧阳锋寻来古墓",
      "小龙女决定出古墓"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回",
    "key_events": [
      "杨过小龙女出古墓",
      "师徒恋情渐显",
      "遇霍都达尔巴",
      "古墓派武功震惊江湖"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_huo_du",
      "char_da_er_ba"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回",
    "key_events": [
      "大胜关英雄大会",
      "金轮法王率众挑衅",
      "霍都挑战中原武林",
      "杨过出手应战"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_jing",
      "char_huang_rong",
      "char_jin_lun_fa_wang",
      "char_huo_du"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回",
    "key_events": [
      "杨过大败霍都",
      "小龙女对战金轮法王",
      "双剑合璧显威",
      "郭靖认出杨过"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_jing",
      "char_jin_lun_fa_wang",
      "char_huo_du"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回",
    "key_events": [
      "师徒恋情引发争议",
      "郭靖震怒要杨过断情",
      "杨过宁死不从",
      "黄蓉劝说小龙女离去"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_jing",
      "char_huang_rong"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回",
    "key_events": [
      "小龙女不辞而别",
      "杨过四处寻找",
      "遇完颜萍耶律齐",
      "武氏兄弟争郭芙"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_wan_yan_ping",
      "char_ye_lv_qi",
      "char_wu_dun_ru",
      "char_wu_xiu_wen",
      "char_guo_fu"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回",
    "key_events": [
      "杨过与郭芙同行",
      "遇陆无双",
      "陆无双暗恋杨过",
      "程英暗中关注"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_fu",
      "char_lu_wu_shuang",
      "char_cheng_ying"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回",
    "key_events": [
      "杨过追寻至绝情谷",
      "公孙止囚禁小龙女",
      "杨过闯入绝情谷",
      "杨过中情花毒"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_gong_sun_zhi"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回",
    "key_events": [
      "情花毒每逢动情发作",
      "公孙止提出交换条件",
      "杨过发现裘千尺",
      "裘千尺告知断肠草解法"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_gong_sun_zhi",
      "char_qiu_qian_ren"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回",
    "key_events": [
      "杨过与裘千尺联手",
      "公孙止暗施毒计",
      "小龙女被迷药控制",
      "李莫愁来到绝情谷"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_gong_sun_zhi",
      "char_qiu_qian_ren",
      "char_li_mo_chou"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回",
    "key_events": [
      "公孙止原形毕露",
      "裘千尺与公孙止生死搏斗",
      "公孙绿萼为杨过牺牲",
      "黄药师赶到制服公孙止"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_gong_sun_zhi",
      "char_qiu_qian_ren",
      "char_gong_sun_lu_e",
      "char_huang_yao_shi"
    ]
  },
  {
    "chapter": 21,
    "title": "第二十一回",
    "key_events": [
      "杨过情花毒未解",
      "公孙绿萼为杨过采药被杀",
      "断肠草解毒之法",
      "小龙女不忍杨过冒险"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_gong_sun_lu_e",
      "char_gong_sun_zhi"
    ]
  },
  {
    "chapter": 22,
    "title": "第二十二回",
    "key_events": [
      "杨过失去右臂",
      "得神雕相助",
      "发现独孤求败剑冢",
      "苦练玄铁重剑"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 23,
    "title": "第二十三回",
    "key_events": [
      "杨过武功大成",
      "玄铁剑法威力惊人",
      "杨过行走江湖行侠",
      "神雕大侠名号初起"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 24,
    "title": "第二十四回",
    "key_events": [
      "神雕大侠名扬天下",
      "杨过多战李莫愁",
      "杨过寻找解毒之法",
      "杨过小龙女约定不离"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_li_mo_chou"
    ]
  },
  {
    "chapter": 25,
    "title": "第二十五回",
    "key_events": [
      "蒙古大军南侵",
      "杨过决定赶赴襄阳",
      "遭遇金轮法王伏击",
      "小龙女为救杨过重伤"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_jin_lun_fa_wang",
      "char_guo_jing"
    ]
  },
  {
    "chapter": 26,
    "title": "第二十六回",
    "key_events": [
      "小龙女伤重",
      "小龙女跳下绝情谷底",
      "发现留书十六年后相会",
      "杨过含泪离去"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 27,
    "title": "第二十七回",
    "key_events": [
      "杨过心如死灰",
      "十六年间行侠仗义",
      "神雕大侠传说流传",
      "每年回绝情谷等待"
    ],
    "key_characters": [
      "char_yang_guo"
    ]
  },
  {
    "chapter": 28,
    "title": "第二十八回",
    "key_events": [
      "风陵渡口郭襄出场",
      "郭襄听闻杨过传说",
      "郭襄心生向往",
      "郭襄独自闯荡江湖"
    ],
    "key_characters": [
      "char_guo_xiang",
      "char_yang_guo"
    ]
  },
  {
    "chapter": 29,
    "title": "第二十九回",
    "key_events": [
      "郭襄偶遇杨过",
      "杨过以面具遮面",
      "杨过赠三枚金针",
      "许郭襄三个愿望"
    ],
    "key_characters": [
      "char_guo_xiang",
      "char_yang_guo"
    ]
  },
  {
    "chapter": 30,
    "title": "第三十回",
    "key_events": [
      "杨过带郭襄游历",
      "杨过讲述与小龙女故事",
      "郭襄要看杨过真面目",
      "一见杨过误终身"
    ],
    "key_characters": [
      "char_guo_xiang",
      "char_yang_guo"
    ]
  },
  {
    "chapter": 31,
    "title": "第三十一回",
    "key_events": [
      "杨过安排周伯通瑛姑重逢",
      "周伯通心存愧疚",
      "瑛姑老泪纵横",
      "杨过触景生情"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_zhou_bo_tong",
      "char_ying_gu"
    ]
  },
  {
    "chapter": 32,
    "title": "第三十二回",
    "key_events": [
      "万兽山庄聚会",
      "杨过以真面目现身",
      "杨过展现惊人武功",
      "十六年之期将至"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_xiang",
      "char_guo_fu",
      "char_wu_dun_ru",
      "char_wu_xiu_wen"
    ]
  },
  {
    "chapter": 33,
    "title": "第三十三回",
    "key_events": [
      "襄阳英雄大宴",
      "蒙古大军压境",
      "杨过与郭靖冰释前嫌",
      "耶律齐成为丐帮帮主"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_guo_fu",
      "char_guo_xiang",
      "char_ye_lv_qi"
    ]
  },
  {
    "chapter": 34,
    "title": "第三十四回",
    "key_events": [
      "蒙古大军围攻襄阳",
      "杨过大败金轮法王",
      "蒙哥汗亲临督战",
      "襄阳军民浴血奋战"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_jin_lun_fa_wang",
      "char_guo_fu",
      "char_guo_xiang"
    ]
  },
  {
    "chapter": 35,
    "title": "第三十五回",
    "key_events": [
      "襄阳之战白热化",
      "杨过飞石击毙蒙哥汗",
      "蒙古军大乱",
      "襄阳之围得解"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_guo_jing",
      "char_huang_rong",
      "char_guo_xiang"
    ]
  },
  {
    "chapter": 36,
    "title": "第三十六回",
    "key_events": [
      "杨过前往绝情谷",
      "十六年之期已到",
      "等待小龙女不至",
      "杨过跳下深潭"
    ],
    "key_characters": [
      "char_yang_guo"
    ]
  },
  {
    "chapter": 37,
    "title": "第三十七回",
    "key_events": [
      "杨过发现潭底洞穴",
      "循玉蜂找到小龙女",
      "小龙女伤愈",
      "十六年后重逢"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu"
    ]
  },
  {
    "chapter": 38,
    "title": "第三十八回",
    "key_events": [
      "杨过小龙女离开绝情谷",
      "蒙古退兵襄阳暂安",
      "拜访旧友",
      "郭襄祝福二人"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_xiang",
      "char_guo_jing",
      "char_huang_rong"
    ]
  },
  {
    "chapter": 39,
    "title": "第三十九回",
    "key_events": [
      "第三次华山论剑",
      "新五绝诞生",
      "杨过获封西狂",
      "群雄论武切磋"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_jing",
      "char_huang_rong",
      "char_huang_yao_shi",
      "char_yi_deng_da_shi",
      "char_zhou_bo_tong"
    ]
  },
  {
    "chapter": 40,
    "title": "第四十回",
    "key_events": [
      "杨过小龙女归隐",
      "玄铁重剑赠郭靖",
      "觉远张君宝出场",
      "郭襄终身未嫁创峨嵋派"
    ],
    "key_characters": [
      "char_yang_guo",
      "char_xiao_long_nyu",
      "char_guo_jing",
      "char_guo_xiang",
      "char_jue_yuan",
      "char_zhang_jun_bao"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
