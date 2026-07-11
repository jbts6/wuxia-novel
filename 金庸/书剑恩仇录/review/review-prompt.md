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
- **地点错放**：是否有地点被误列为物品？
  - **区分标准**：
    - items.json 应包含：可携带、可转移的**实体物品**
    - locations.json 应包含：固定的**地点/场所/建筑物**
  - **常见错误**：将"琅嬛福地"（地点）、"还施水阁"（地点）、"无量玉壁"（地点）、"珍珑棋局"（机关/地点）列为 item
- **功法错放**：是否有功法名称被误列为物品？
  - **区分标准**：
    - items.json 应包含：有实体形态的**秘籍/图谱/经书**
    - skills.json 应包含：口传心授的**武功/功法**
  - **常见错误**：将"一阳指"、"火焰刀"、"降龙十八掌"等功法名称列为 item（除非原文明确提到有实体秘籍）
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
3. **items.json 混入地点**：琅嬛福地、还施水阁、无量玉壁等地点应为 location 而非 item（severity: high）
4. **items.json 混入功法名称**：一阳指、火焰刀等功法名称（无实体秘籍）应为 skill 而非 item（severity: high）
5. **ID 引用缺失**：引用了其他 JSON 中不存在的 ID（severity: high）
6. **数量完整性**：对照原文检查是否有重大遗漏
   - 重要角色遗漏（如推动剧情的关键人物）
   - 核心功法遗漏（如主要武学体系）
   - 关键物品遗漏（如核心道具）
   - 如有遗漏，severity 为 high

## 输出

直接输出 JSON 数组，不要额外解释。


## 数据

### characters.json (25 条)
[
  {
    "id": "char_chen_jia_luo",
    "name": "陈家洛",
    "role": "核心",
    "identity": "红花会总舵主",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "重情重义",
      "文武双全",
      "理想主义"
    ],
    "one_line": "红花会总舵主，乾隆皇帝的亲弟弟，为反清复明奋斗"
  },
  {
    "id": "char_qian_long",
    "name": "乾隆",
    "role": "核心",
    "identity": "清朝皇帝",
    "faction": "faction_qing_ting",
    "personality": [
      "好大喜功",
      "阴险狡诈",
      "贪恋美色"
    ],
    "one_line": "清朝皇帝，实为汉人，陈家洛的亲哥哥"
  },
  {
    "id": "char_huo_qing_tong",
    "name": "霍青桐",
    "role": "核心",
    "identity": "回部女侠",
    "faction": "faction_hui_bu",
    "personality": [
      "英武聪慧",
      "深明大义",
      "刚强坚韧"
    ],
    "one_line": "回部女侠，天山双鹰弟子，陈家洛的初恋"
  },
  {
    "id": "char_xiang_xiang_gong_zhu",
    "name": "香香公主",
    "role": "核心",
    "identity": "回部圣女",
    "faction": "faction_hui_bu",
    "personality": [
      "天真纯朴",
      "忠贞不渝",
      "外柔内刚"
    ],
    "one_line": "回部绝世美女，陈家洛挚爱，最终自尽殉情"
  },
  {
    "id": "char_wen_tai_lai",
    "name": "文泰来",
    "role": "重要",
    "identity": "红花会四当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "豪迈直爽",
      "宁死不屈",
      "重情重义"
    ],
    "one_line": "红花会四当家，豪迈直爽，骆冰之夫"
  },
  {
    "id": "char_luo_bing",
    "name": "骆冰",
    "role": "重要",
    "identity": "红花会十一当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "忠贞不渝",
      "外柔内刚",
      "心细如发"
    ],
    "one_line": "红花会十一当家，文泰来之妻，善使飞刀"
  },
  {
    "id": "char_yu_yu_tong",
    "name": "余鱼同",
    "role": "重要",
    "identity": "红花会十四当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "文采斐然",
      "风流倜傥",
      "重情重义"
    ],
    "one_line": "红花会十四当家，文武双全，暗恋骆冰"
  },
  {
    "id": "char_xu_tian_hong",
    "name": "徐天宏",
    "role": "重要",
    "identity": "红花会七当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "足智多谋",
      "沉着冷静",
      "机敏过人"
    ],
    "one_line": "红花会七当家，足智多谋，周绮之夫"
  },
  {
    "id": "char_zhang_zhao_zhong",
    "name": "张召重",
    "role": "重要",
    "identity": "武当派叛徒",
    "faction": "faction_qing_ting",
    "personality": [
      "阴险狡诈",
      "贪图富贵",
      "武功高强"
    ],
    "one_line": "武当派叛徒，清廷鹰犬，最终被群狼吞噬"
  },
  {
    "id": "char_lu_fei_qing",
    "name": "陆菲青",
    "role": "重要",
    "identity": "武当派大侠",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "沉稳睿智",
      "重情重义",
      "武功高强"
    ],
    "one_line": "武当派大侠，李沅芷师父，最终殉义而死"
  },
  {
    "id": "char_zhou_zhong_ying",
    "name": "周仲英",
    "role": "重要",
    "identity": "铁胆庄庄主",
    "faction": null,
    "personality": [
      "老成持重",
      "侠义为怀",
      "刚正不阿"
    ],
    "one_line": "铁胆庄庄主，西北武林首脑"
  },
  {
    "id": "char_zhou_qi",
    "name": "周绮",
    "role": "重要",
    "identity": "周仲英之女",
    "faction": null,
    "personality": [
      "鲁莽直率",
      "心直口快",
      "敢爱敢恨"
    ],
    "one_line": "周仲英之女，性格鲁莽，后嫁徐天宏"
  },
  {
    "id": "char_zhao_ban_shan",
    "name": "赵半山",
    "role": "重要",
    "identity": "红花会三当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "重情重义",
      "武功高强",
      "老成持重"
    ],
    "one_line": "红花会三当家，温州王氏太极门传人"
  },
  {
    "id": "char_wei_chun_hua",
    "name": "卫春华",
    "role": "次要",
    "identity": "红花会九当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "勇猛善战",
      "忠心耿耿",
      "直率豪爽"
    ],
    "one_line": "红花会九当家，善使双钩"
  },
  {
    "id": "char_zhang_jin",
    "name": "章进",
    "role": "次要",
    "identity": "红花会十当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "神力惊人",
      "性子直率",
      "嫉恶如仇"
    ],
    "one_line": "红花会十当家，驼背神力惊人"
  },
  {
    "id": "char_chen_zheng_de",
    "name": "陈正德",
    "role": "次要",
    "identity": "天山双鹰之一",
    "faction": "faction_tian_shan_pai",
    "personality": [
      "醋心极重",
      "武功高强",
      "老当益壮"
    ],
    "one_line": "天山双鹰之秃鹫，醋心极重的老前辈"
  },
  {
    "id": "char_guan_ming_mei",
    "name": "关明梅",
    "role": "次要",
    "identity": "天山双鹰之一",
    "faction": "faction_tian_shan_pai",
    "personality": [
      "武功高强",
      "性情刚烈",
      "爱护弟子"
    ],
    "one_line": "天山双鹰之雪雕，霍青桐的师父"
  },
  {
    "id": "char_yuan_shi_xiao",
    "name": "袁士霄",
    "role": "次要",
    "identity": "陈家洛的师父",
    "faction": null,
    "personality": [
      "武功盖世",
      "性情古怪",
      "不拘小节"
    ],
    "one_line": "天池怪侠，百花错拳创始人，陈家洛的师父"
  },
  {
    "id": "char_li_yuan_zhi",
    "name": "李沅芷",
    "role": "次要",
    "identity": "陆菲青的弟子",
    "faction": null,
    "personality": [
      "活泼调皮",
      "聪明伶俐",
      "敢爱敢恨"
    ],
    "one_line": "陆菲青弟子，将门之女，暗恋余鱼同"
  },
  {
    "id": "char_li_ke_xiu",
    "name": "李可秀",
    "role": "次要",
    "identity": "浙江水陆提督",
    "faction": "faction_qing_ting",
    "personality": [
      "精明强干",
      "官运亨通",
      "爱护女儿"
    ],
    "one_line": "浙江水陆提督，李沅芷之父"
  },
  {
    "id": "char_a_fan_ti",
    "name": "阿凡提",
    "role": "龙套",
    "identity": "回疆智者",
    "faction": "faction_hui_bu",
    "personality": [
      "幽默风趣",
      "智慧过人",
      "古道热肠"
    ],
    "one_line": "回疆智者，幽默风趣，助红花会一臂之力"
  },
  {
    "id": "char_wu_dun_dao_zhang",
    "name": "无尘道长",
    "role": "次要",
    "identity": "红花会二当家",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "武功高强",
      "沉不住气",
      "侠肝义胆"
    ],
    "one_line": "红花会二当家，断臂道人"
  },
  {
    "id": "char_fu_kang_an",
    "name": "福康安",
    "role": "龙套",
    "identity": "乾隆宠臣",
    "faction": "faction_qing_ting",
    "personality": [
      "忠于皇帝",
      "精明干练",
      "阴险狡诈"
    ],
    "one_line": "乾隆宠臣，负责围剿红花会"
  },
  {
    "id": "char_tai_hou",
    "name": "太后",
    "role": "龙套",
    "identity": "皇太后",
    "faction": "faction_qing_ting",
    "personality": [
      "威严",
      "精明",
      "维护满洲利益"
    ],
    "one_line": "乾隆的养母，清朝太后"
  },
  {
    "id": "char_bai_zhen",
    "name": "白振",
    "role": "龙套",
    "identity": "御前侍卫",
    "faction": "faction_qing_ting",
    "personality": [
      "忠于皇帝",
      "武功高强",
      "谨慎小心"
    ],
    "one_line": "御前侍卫总管，金钩铁掌"
  }
]

### factions.json (6 条)
[
  {
    "id": "faction_hong_hua_hui",
    "name": "红花会",
    "type": "帮派",
    "location": "loc_an_xi",
    "one_line": "反清秘密帮会，以陈家洛为总舵主，十四位当家聚义"
  },
  {
    "id": "faction_wu_dang_pai",
    "name": "武当派",
    "type": "武林门派",
    "location": "loc_wu_dang_shan",
    "one_line": "名门正派，陆菲青、张召重、马真同出一门"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "武林门派",
    "location": "loc_shao_lin_si",
    "one_line": "武林泰斗，于万亭出身少林，后有僧众助战"
  },
  {
    "id": "faction_tian_shan_pai",
    "name": "天山派",
    "type": "武林门派",
    "location": "loc_tian_shan",
    "one_line": "天山双鹰所传门派，霍青桐师承所在"
  },
  {
    "id": "faction_zhen_yuan_biao_ju",
    "name": "镇远镖局",
    "type": "镖局",
    "location": "loc_bei_jing",
    "one_line": "北方大镖局，王维扬主持，护送可兰经进京"
  },
  {
    "id": "faction_qing_ting",
    "name": "清廷",
    "type": "官署",
    "location": "loc_huang_gong",
    "one_line": "满清朝廷，乾隆统治，与红花会为敌"
  }
]

### locations.json (13 条)
[
  {
    "id": "loc_bei_jing",
    "name": "北京",
    "region": "华北",
    "one_line": "清朝都城，乾隆皇宫所在地"
  },
  {
    "id": "loc_hang_zhou",
    "name": "杭州",
    "region": "江南",
    "one_line": "浙江重镇，西湖所在"
  },
  {
    "id": "loc_liu_he_ta",
    "name": "六和塔",
    "region": "杭州",
    "one_line": "杭州名塔，陈家洛与乾隆对峙之处"
  },
  {
    "id": "loc_xi_hu",
    "name": "西湖",
    "region": "杭州",
    "one_line": "杭州名胜，乾隆曾游幸"
  },
  {
    "id": "loc_hai_ning",
    "name": "海宁",
    "region": "浙江",
    "one_line": "陈家洛故乡，陈家所在"
  },
  {
    "id": "loc_huang_gong",
    "name": "皇宫",
    "region": "北京",
    "one_line": "清朝皇宫，乾隆居所"
  },
  {
    "id": "loc_yong_he_gong",
    "name": "雍和宫",
    "region": "北京",
    "one_line": "雍正旧邸，乾隆设宴围剿红花会"
  },
  {
    "id": "loc_hui_jiang",
    "name": "回疆",
    "region": "西北",
    "one_line": "天山以北游牧之地，霍青桐故乡"
  },
  {
    "id": "loc_tian_shan",
    "name": "天山",
    "region": "西北",
    "one_line": "天山双鹰修行之地"
  },
  {
    "id": "loc_tie_dan_zhuang",
    "name": "铁胆庄",
    "region": "甘肃",
    "one_line": "周仲英的庄园，文泰来曾避难于此"
  },
  {
    "id": "loc_an_xi",
    "name": "安西",
    "region": "甘肃",
    "one_line": "关外重镇，红花会群雄聚集"
  },
  {
    "id": "loc_bao_yue_lou",
    "name": "宝月楼",
    "region": "北京",
    "one_line": "乾隆为香香公主所建"
  },
  {
    "id": "loc_sha_cheng",
    "name": "沙城",
    "region": "回疆",
    "one_line": "围困狼群之地，张召重葬身之处"
  }
]

### skills.json (10 条)
[
  {
    "id": "skill_rou_yun_jian_shu",
    "name": "柔云剑术",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "武当派绝学，剑招连绵不绝如柔丝春云"
  },
  {
    "id": "skill_bai_hua_cuo_quan",
    "name": "百花错拳",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "袁士霄独创，集百家之长反其道而行，陈家洛绝技"
  },
  {
    "id": "skill_san_fen_jian_shu",
    "name": "三分剑术",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "天山派剑法，以快打慢以变扰敌，霍青桐绝学"
  },
  {
    "id": "skill_zhui_hun_duo_ming_jian",
    "name": "追魂夺命剑",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "无尘道长所使剑法，凌厉狠辣，红花会镇派武学"
  },
  {
    "id": "skill_tie_pipa_shou",
    "name": "铁琵琶手",
    "type": "掌法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "焦文期绝技，兼铁沙掌与鹰爪功之长"
  },
  {
    "id": "skill_pao_ding_jie_niu_zhang_fa",
    "name": "庖丁解牛掌法",
    "type": "掌法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "陈家洛从竹简中悟出的上古掌法，全书最强武学"
  },
  {
    "id": "skill_wu_ji_xuan_gong_quan",
    "name": "无极玄功拳",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "武当派内家拳术，陆菲青的看家本领"
  },
  {
    "id": "skill_hei_sha_zhang",
    "name": "黑沙掌",
    "type": "掌法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "青城派慧侣道人所传，常氏兄弟绝技"
  },
  {
    "id": "skill_zhu_suo",
    "name": "珠索",
    "type": "暗器",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "陈家洛独门兵器，五根珠索点穴打穴"
  },
  {
    "id": "skill_fu_rong_jin_zhen",
    "name": "芙蓉金针",
    "type": "暗器",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "陆菲青暗器，细如发丝的金针，百发百中"
  }
]

### techniques.json (0 条)
[]

### items.json (10 条)
[
  {
    "id": "item_ning_bi_jian",
    "name": "凝碧剑",
    "type": "兵器",
    "owner": "char_zhang_zhao_zhong",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "张召重的宝剑，削铁如泥"
  },
  {
    "id": "item_bai_long_jian",
    "name": "白龙剑",
    "type": "兵器",
    "owner": "char_lu_fei_qing",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_rou_yun_jian_shu"
    ],
    "one_line": "陆菲青的佩剑，武当派名剑"
  },
  {
    "id": "item_jin_di",
    "name": "金笛",
    "type": "兵器",
    "owner": "char_yu_yu_tong",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "余鱼同的金笛，可当兵器和乐器"
  },
  {
    "id": "item_yuan_yang_dao",
    "name": "鸳鸯刀",
    "type": "兵器",
    "owner": "char_luo_bing",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "骆冰的双刀，配合飞刀使用"
  },
  {
    "id": "item_wu_xing_lun",
    "name": "五行轮",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "阎世魁的奇形兵器，外门利器"
  },
  {
    "id": "item_fu_rong_jin_zhen",
    "name": "芙蓉金针",
    "type": "暗器",
    "owner": "char_lu_fei_qing",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_fu_rong_jin_zhen"
    ],
    "one_line": "武当派暗器，陆菲青传授李沅芷"
  },
  {
    "id": "item_pi_pa_ding",
    "name": "琵琶钉",
    "type": "暗器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "焦文期的暗器，藏于铁牌中"
  },
  {
    "id": "item_ke_lan_jing",
    "name": "可兰经",
    "type": "秘籍",
    "owner": "faction_hui_bu",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "回部圣物，被镖局抢走"
  },
  {
    "id": "item_wen_yu",
    "name": "温玉",
    "type": "信物",
    "owner": "char_xiang_xiang_gong_zhu",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "乾隆赠陈家洛，后转赠香香公主"
  },
  {
    "id": "item_tie_dan",
    "name": "铁胆",
    "type": "暗器",
    "owner": "char_zhou_zhong_ying",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "周仲英的暗器，误杀亲子"
  }
]

### dialogues.json (前 50 条 / 共 90 条)
[
  {
    "index": 0,
    "speaker": "char_li_yuan_zhi",
    "speaker_name": "李沅芷",
    "listener": "char_lu_fei_qing",
    "text": "老师，你教我这好玩的法儿？",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 1,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": "char_li_yuan_zhi",
    "text": "沅芷，你我师生三年，总算相处不错。我本以为缘份已尽，那知还要碰头。我这件事性命攸关，你能守口如瓶，一句不漏吗？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 2,
    "speaker": null,
    "speaker_name": "焦文期",
    "listener": "char_lu_fei_qing",
    "text": "陆老英雄，十八年前，在下拜领过你老一掌之赐，这只怨在下学艺不精，总算骨头硬，命不该绝，这几年来多学到了三招两式的毛拳，又想请你老别见笑，再行指点指点，这是为私。你老名满天下，朝廷里要请你去了结几件公案。我兄弟三人专诚拜访，便是来促请大驾，这是为公。",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 3,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": null,
    "text": "焦三爷说找在下既是为私，亦复为公。当年咱们年轻好胜，此刻说来不值一笑。你焦三爷要算当年的过节，我这里给你赔过了礼。至于说到公事，姓陆的还不致于这么不要脸，去给满清鞑子做鹰犬。你们要拿我这几根老骨头去升官发财，嘿嘿，请来拿吧！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 4,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": "char_li_yuan_zhi",
    "text": "女孩子家别风言风语的，人家长得难看，本领可不小！我跟他们没会过面，但听人说，他俩是双生兄弟，从小形影不离。哥儿俩也不娶亲，到处行侠仗义，闯下了很大的万儿来。尊敬他们的称之为西川双侠，怕他们的就叫他俩黑无常、白无常。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 139,
    "line_end": 139
  },
  {
    "index": 5,
    "speaker": "char_li_yuan_zhi",
    "speaker_name": "李沅芷",
    "listener": "char_huo_qing_tong",
    "text": "我是回部霍青桐。喂，我问你，咱们河水不犯井水，干么你硬给镖局子撑腰，坏我们的事？",
    "tone": "调侃",
    "chapter": 2,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 6,
    "speaker": "char_huo_qing_tong",
    "speaker_name": "霍青桐",
    "listener": "char_li_yuan_zhi",
    "text": "你剑法早胜过了我徒儿。再说，比剑比不过算得什么，圣经抢不回来才教丢脸呢。一个人的胜负荣辱打什么紧？全族给人家欺侮，那才须得拚命。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 39,
    "line_end": 39
  },
  {
    "index": 7,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": null,
    "text": "两个都是小孩脾气。算了，算了。这是我徒弟李沅芷，你去告诉你师父师公，我‘绵里针’⋯⋯",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 8,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": "char_wen_tai_lai",
    "text": "我这师弟自甘下流，真是我师门之耻，但他武功精纯，而且千里迢迢从北京西来，必定还有后援。现下文老弟身受重伤，我看眼前只有避他一避，然后我们再约好手，跟他一决雌雄。老夫如不能为师门清除败类，这几根老骨头也就不打算再留下来了。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 163,
    "line_end": 163
  },
  {
    "index": 9,
    "speaker": "char_wen_tai_lai",
    "speaker_name": "文泰来",
    "listener": "char_luo_bing",
    "text": "文某岂是贪生怕死之徒？躲在这般的地方，便是逃得性命，也落得天下英雄耻笑。",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 10,
    "speaker": "char_zhou_zhong_ying",
    "speaker_name": "周仲英",
    "listener": "char_wen_tai_lai",
    "text": "英雄好汉是这样做的么？",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 91,
    "line_end": 91
  },
  {
    "index": 11,
    "speaker": "char_zhou_qi",
    "speaker_name": "周绮",
    "listener": "char_chen_jia_luo",
    "text": "我弟弟还只十岁，他不懂事，把你们文爷的藏身地方说了出来。爹爹回到家来，大怒之下，失手把弟弟打死了，把我妈妈也气走了，这总对得起你们了吧？你们还不够，把我们父女都杀了吧！",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 12,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": "char_zhou_qi",
    "text": "周老英雄对红花会的好处，咱们至死不忘。各位兄弟，现下救火要紧。大家快动手。",
    "tone": "激动",
    "chapter": 4,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 13,
    "speaker": "char_zhou_zhong_ying",
    "speaker_name": "周仲英",
    "listener": "char_chen_jia_luo",
    "text": "当然不去啦，文四爷在咱们庄上失陷，救人之事，咱们岂能袖手旁观？",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 14,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": "char_chen_jia_luo",
    "text": "陈当家的不必太谦。红花会是主，咱们是宾，这决不能喧宾夺主。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 39,
    "line_end": 39
  },
  {
    "index": 15,
    "speaker": "char_zhou_zhong_ying",
    "speaker_name": "周仲英",
    "listener": "char_xu_tian_hong",
    "text": "红花会名闻大江南北，总舵主却竟像是位富贵公子，我初见之时，很是纳罕，只觉透着极不相称。后来跟他说了话、交了手，才知他不但武功了得，而且见识不凡，确是位了不起的人物，这真叫做人不可以貌相。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 71,
    "line_end": 71
  },
  {
    "index": 16,
    "speaker": "char_zhou_zhong_ying",
    "speaker_name": "周仲英",
    "listener": "char_xu_tian_hong",
    "text": "这几年来，武林中出了不少人物，也真是长江后浪推前浪，十年人事几翻新。就像你老弟这般智勇双全，江湖上就十分难得。总要别辜负了这副身手，好好做一番事业出来。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 73,
    "line_end": 73
  },
  {
    "index": 17,
    "speaker": "char_zhou_zhong_ying",
    "speaker_name": "周仲英",
    "listener": "char_luo_bing",
    "text": "于老当家抱负真是不小。闯宫见帝，天下有几人能具这般胆识？",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 89,
    "line_end": 89
  },
  {
    "index": 18,
    "speaker": "char_xu_tian_hong",
    "speaker_name": "徐天宏",
    "listener": "char_zhou_zhong_ying",
    "text": "皇帝老儿越是怕四哥恨四哥，四哥眼前越无性命之忧。官府和鹰爪既知他是钦犯，决不敢随便对他怎样。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 19,
    "speaker": "char_zhou_qi",
    "speaker_name": "周绮",
    "listener": "char_xu_tian_hong",
    "text": "你是诸葛亮，怎会料不到？",
    "tone": "调侃",
    "chapter": 4,
    "line_start": 107,
    "line_end": 107
  },
  {
    "index": 20,
    "speaker": "char_luo_bing",
    "speaker_name": "骆冰",
    "listener": "char_zhou_qi",
    "text": "于老当家说，他去见皇帝老儿的事干系极大，进宫的人决不能多，否则反而有变。四哥听他这么说，自是遵奉号令。当夜他二人越墙进宫，我在宫墙外把风，这一次心里可真是怕了。直过了一个多时辰，他们才翻墙出来。第二天一早，我们三人就离京回江南。我悄悄问四哥，皇帝老儿有没见到，到底是怎么回事？四哥说皇帝是见到了，不过这件事关连到推倒清廷、光复汉家天下的大业。他说自然不是信不过我，但多一个人知道，不免多一分泄漏的危险，因此不跟我说。我也就不再多问。",
    "tone": "悲伤",
    "chapter": 4,
    "line_start": 89,
    "line_end": 89
  },
  {
    "index": 21,
    "speaker": "char_luo_bing",
    "speaker_name": "骆冰",
    "listener": "char_zhou_zhong_ying",
    "text": "老当家临终之时，召集内三堂外三堂正副香主，遗命要少舵主接任总舵主。他说这并不是他有私心，只因此事是汉家光复的关键所在，要紧之至。其中原由，此时不能明言，众人日后自知。老当家的话，向来人人信服，何况就算他没这句遗言，众兄弟感念他的恩德，也必一致推拥少舵主接充大任。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 93,
    "line_end": 93
  },
  {
    "index": 22,
    "speaker": "char_zhou_qi",
    "speaker_name": "周绮",
    "listener": "char_luo_bing",
    "text": "好了，好了！绮妹妹将来嫁个心直口快的豪爽英雄。这可称心如意了吧？",
    "tone": "欣喜",
    "chapter": 4,
    "line_start": 115,
    "line_end": 115
  },
  {
    "index": 23,
    "speaker": "char_yu_yu_tong",
    "speaker_name": "余鱼同",
    "listener": "char_wen_tai_lai",
    "text": "四哥，请你先走！我随后就来。",
    "tone": "焦急",
    "chapter": 5,
    "line_start": 95,
    "line_end": 95
  },
  {
    "index": 24,
    "speaker": "char_zhang_zhao_zhong",
    "speaker_name": "张召重",
    "listener": "char_yu_yu_tong",
    "text": "你不要命吗？这打法是谁教你的？",
    "tone": "愤怒",
    "chapter": 5,
    "line_start": 97,
    "line_end": 97
  },
  {
    "index": 25,
    "speaker": "char_yu_yu_tong",
    "speaker_name": "余鱼同",
    "listener": "char_zhang_zhao_zhong",
    "text": "我恩师是千里独行侠，姓马讳真。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 26,
    "speaker": "char_zhang_zhao_zhong",
    "speaker_name": "张召重",
    "listener": "char_yu_yu_tong",
    "text": "好好一个年轻人，竟然自甘下流。文泰来是你什么人？干么这般舍命救他！",
    "tone": "嘲讽",
    "chapter": 5,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 27,
    "speaker": "char_zhang_zhao_zhong",
    "speaker_name": "张召重",
    "listener": "char_yu_yu_tong",
    "text": "这就是了，我是你师叔张召重。",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 28,
    "speaker": "char_wen_tai_lai",
    "speaker_name": "文泰来",
    "listener": "char_zhang_zhao_zhong",
    "text": "你们这批给朝廷做走狗的奴才，文大爷落在你们手中，自有人给我报仇。瞧你们这些狼心狗肺的东西，有什么下场。",
    "tone": "愤怒",
    "chapter": 5,
    "line_start": 83,
    "line_end": 83
  },
  {
    "index": 29,
    "speaker": "char_wu_dun_dao_zhang",
    "speaker_name": "无尘",
    "listener": null,
    "text": "我们红花会众当家说话向来一是一，二是二，几时骗过人来？你不信他话，就是瞧我不起。嘿嘿，你瞧我不起，胆子不小哇！",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 29,
    "line_end": 29
  },
  {
    "index": 30,
    "speaker": "char_lu_fei_qing",
    "speaker_name": "陆菲青",
    "listener": null,
    "text": "焦文期既受陈府之托，寻访陈公子，便须忠于所事，怎地使了人家盘缠，却来寻我老头子的晦气？咱们武林中人，就算不能舍身报国，跟满虏鞑子拚个死活，也当行侠仗义，为民除害。",
    "tone": "激动",
    "chapter": 5,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 31,
    "speaker": "char_zhou_qi",
    "speaker_name": "周绮",
    "listener": "char_xu_tian_hong",
    "text": "胡说！那有好端端的人叫小玫瑰的？",
    "tone": "调侃",
    "chapter": 6,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 32,
    "speaker": "char_zhou_qi",
    "speaker_name": "周绮",
    "listener": "char_xu_tian_hong",
    "text": "你不会给刀砍伤？哼，说这样的满话！",
    "tone": "嘲讽",
    "chapter": 6,
    "line_start": 97,
    "line_end": 97
  },
  {
    "index": 33,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "你听着，这上联是：‘俟河之清，人寿几何！却问河清易？官清易？’",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 293,
    "line_end": 293
  },
  {
    "index": 34,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "咱们第一步要查知文四哥的所在。请马大哥继续派遣得力兄弟，往各衙门打探，今晚再请道长、五哥、六哥到巡抚衙门去瞧瞧。最要紧是别打草惊蛇，无论如何不能伸手动武。",
    "tone": "陈述",
    "chapter": 7,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 35,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "正是。这《锦绣乾坤》一曲是小弟近作。阁下既是知音，还望指教。",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 36,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "兄弟一路上山，遇见游客甚多，见到兄弟之时，人人面露诧异之色，适才兄台也是如此，难道小弟脸上有什么古怪么？倒要请教了。",
    "tone": "疑问",
    "chapter": 7,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 37,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "白老前辈说那里话来？咱们是武林同道，缓急之际，出一把力何足道哉！",
    "tone": "陈述",
    "chapter": 8,
    "line_start": 219,
    "line_end": 219
  },
  {
    "index": 38,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "啊，是火手判官要伸量老夫斤两来着！我老胡涂啦，没想到这一层。",
    "tone": "愤怒",
    "chapter": 9,
    "line_start": 177,
    "line_end": 177
  },
  {
    "index": 39,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "攻进提督府去，今日无论如何得把四哥找着。",
    "tone": "焦急",
    "chapter": 10,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 40,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": "char_li_ke_xiu",
    "text": "怕死的也不来了，今天对不住，我们要带了文四爷一起走。",
    "tone": "冷酷",
    "chapter": 10,
    "line_start": 39,
    "line_end": 39
  },
  {
    "index": 41,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": null,
    "text": "四嫂、三哥，你们保护四哥，大家跟我冲。",
    "tone": "焦急",
    "chapter": 10,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 42,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": "char_qian_long",
    "text": "哥哥，你到今日还不认我么？",
    "tone": "恳求",
    "chapter": 11,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 43,
    "speaker": "char_qian_long",
    "speaker_name": "乾隆",
    "listener": "char_chen_jia_luo",
    "text": "你把我劫持到这里，待要怎样？",
    "tone": "愤怒",
    "chapter": 11,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 44,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": "char_qian_long",
    "text": "你是汉人，汉人的锦绣江山沦入胡虏之手，你却去做了胡虏的头脑，率领他们来欺压咱们黄帝子孙。这岂不是不忠不孝，大逆不道吗？",
    "tone": "激动",
    "chapter": 11,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 45,
    "speaker": "char_chen_jia_luo",
    "speaker_name": "陈家洛",
    "listener": "char_qian_long",
    "text": "咱们是亲兄弟亲骨肉。哥哥，你不必再瞒，我什么都知道啦。",
    "tone": "恳求",
    "chapter": 11,
    "line_start": 15,
    "line_end": 15
  },
  {
    "index": 46,
    "speaker": "char_qian_long",
    "speaker_name": "乾隆",
    "listener": "char_chen_jia_luo",
    "text": "哥哥，我没说你不忠不孝，大逆不道，你反说起我来。",
    "tone": "愤怒",
    "chapter": 11,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 47,
    "speaker": "char_qian_long",
    "speaker_name": "乾隆",
    "listener": "char_chen_jia_luo",
    "text": "等你回来，你先来御林军办事，我把你升作御林军总管，统率护军、骁骑、前锋三营，过些时候，再兼京师九门提督。天下各省兵权也慢慢交在咱们亲信的汉人手里。等到我命你做兵部尚书，把八旗精兵分散得七零八落之后，咱们就可举事了。",
    "tone": "陈述",
    "chapter": 11,
    "line_start": 259,
    "line_end": 259
  },
  {
    "index": 48,
    "speaker": "char_xu_tian_hong",
    "speaker_name": "徐天宏",
    "listener": "char_zhou_qi",
    "text": "四哥一定说：‘那有你美丽啊，我不信！’是不是？",
    "tone": "调侃",
    "chapter": 12,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 49,
    "speaker": "char_yu_yu_tong",
    "speaker_name": "余鱼同",
    "listener": null,
    "text": "金笛秀才在此，你们敢追来么？",
    "tone": "愤怒",
    "chapter": 13,
    "line_start": 13,
    "line_end": 13
  }
]

### chapter_summaries.json (20 条)
[
  {
    "chapter": 1,
    "title": "第一回 古道腾驹惊白发 危峦击剑识青翎",
    "key_events": [
      "陆菲青身份暴露",
      "焦文期寻仇",
      "收李沅芷为徒",
      "千里接龙头"
    ],
    "key_characters": [
      "char_lu_fei_qing",
      "char_li_yuan_zhi",
      "char_li_ke_xiu",
      "char_huo_qing_tong"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回 金风野店书生笛 铁胆荒庄侠士心",
    "key_events": [
      "李沅芷与霍青桐交手",
      "余鱼同现身",
      "红花会群雄聚集"
    ],
    "key_characters": [
      "char_li_yuan_zhi",
      "char_huo_qing_tong",
      "char_yu_yu_tong",
      "char_lu_fei_qing"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回 避祸英雄悲失路 寻仇好汉误交兵",
    "key_events": [
      "铁胆庄之变",
      "文泰来被捕",
      "周英杰之死",
      "周仲英失手杀子"
    ],
    "key_characters": [
      "char_wen_tai_lai",
      "char_luo_bing",
      "char_zhou_zhong_ying",
      "char_zhang_zhao_zhong"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回 置酒弄旗招郎婿 筵前传刃拒强梁",
    "key_events": [
      "陈家洛登场",
      "红花会群雄聚集",
      "商议救文泰来"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_zhou_zhong_ying",
      "char_xu_tian_hong"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回 乌鞘岭头拚死斗 雪莲峰下结良缘",
    "key_events": [
      "乌鞘岭激战",
      "张召重逞威"
    ],
    "key_characters": [
      "char_zhang_zhao_zhong",
      "char_chen_jia_luo",
      "char_wen_tai_lai"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回 荒山恶阵困群豪 古庙神机逢异人",
    "key_events": [
      "徐天宏与周绮相识",
      "群雄追踪文泰来"
    ],
    "key_characters": [
      "char_xu_tian_hong",
      "char_zhou_qi",
      "char_chen_jia_luo"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回 碧血染荒郊黄昏 金笛鸣古寺夜半",
    "key_events": [
      "陈家洛与乾隆初遇",
      "西湖游览"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_qian_long",
      "char_huo_qing_tong"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回 千军岳峙围千顷 万马潮汹动万乘",
    "key_events": [
      "杭州部署",
      "福康安出现",
      "挖掘地道"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_xu_tian_hong",
      "char_fu_kang_an"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回 虎穴轻身入重险 龙潭孤注掷乾坤",
    "key_events": [
      "攻打提督府",
      "地道攻入"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_wen_tai_lai",
      "char_luo_bing"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回 烟腾火炽走豪侠 粉腻脂香羁至尊",
    "key_events": [
      "火攻围困",
      "陆菲青挟持李可秀",
      "蒙面人殉义",
      "文泰来获救"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_lu_fei_qing",
      "char_wen_tai_lai",
      "char_li_ke_xiu"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回 高塔入云盟九鼎 快招如电显双鹰",
    "key_events": [
      "六和塔对峙",
      "陈家洛与乾隆相认",
      "天山双鹰出现"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_qian_long",
      "char_chen_zheng_de",
      "char_guan_ming_mei"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回 盈盈烛泪因谁泣 点点花愁为我嗔",
    "key_events": [
      "余鱼同感情纠葛",
      "群雄与清廷周旋"
    ],
    "key_characters": [
      "char_yu_yu_tong",
      "char_luo_bing",
      "char_wen_tai_lai"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回 吐气扬眉雷掌疾 惊才绝艳雪莲馨",
    "key_events": [
      "清廷征回疆",
      "霍青桐抵抗",
      "香香公主出场"
    ],
    "key_characters": [
      "char_huo_qing_tong",
      "char_xiang_xiang_gong_zhu",
      "char_zhao_hui"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回 蜜意柔情锦带舞 长矛大戟辎重行",
    "key_events": [
      "陈家洛到回疆",
      "与香香公主相爱",
      "回疆战事"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_huo_qing_tong",
      "char_xiang_xiang_gong_zhu"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回 奇谋破敌将军苦 儿女情深侠客痴",
    "key_events": [
      "天山学艺",
      "百花错拳",
      "霍青桐感情"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_yuan_shi_xiao",
      "char_huo_qing_tong"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回 我见犹怜况老奴 女儿娇嗔怪夫婿",
    "key_events": [
      "武功大进",
      "天山双鹰纠葛",
      "感情加深"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_chen_zheng_de",
      "char_guan_ming_mei"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回 万骑连营笳鼓动 千旗蔽野画角鸣",
    "key_events": [
      "发现庖丁解牛功",
      "回疆战事"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_xiang_xiang_gong_zhu"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回 驻马荒山逢异士 投鞭古渡识豪雄",
    "key_events": [
      "阿凡提出现",
      "准备返回中原"
    ],
    "key_characters": [
      "char_a_fan_ti",
      "char_chen_jia_luo"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回 心伤殿隅星初落 魂断城头日已昏",
    "key_events": [
      "陈家洛击败张召重",
      "张召重伏法",
      "陆菲青殉义",
      "发现身世证据"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_zhang_zhao_zhong",
      "char_lu_fei_qing"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回 忍见红颜堕火窟 空余碧血葬香魂",
    "key_events": [
      "乾隆背盟",
      "香香公主自尽",
      "太后夺权",
      "雍和宫之变"
    ],
    "key_characters": [
      "char_qian_long",
      "char_xiang_xiang_gong_zhu",
      "char_chen_jia_luo"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
