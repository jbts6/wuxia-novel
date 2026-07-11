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

### characters.json (41 条)
[
  {
    "id": "char_shi_po_tian",
    "name": "石破天",
    "role": "核心",
    "identity": "身世不明的少年",
    "faction": null,
    "personality": [
      "善良纯朴",
      "不识字",
      "重情重义"
    ],
    "one_line": "不识字的少年，被误认为长乐帮帮主，最终在侠客岛石壁上领悟太玄经"
  },
  {
    "id": "char_ding_dang",
    "name": "丁珰",
    "role": "核心",
    "identity": "丁不三的孙女",
    "faction": null,
    "personality": [
      "活泼刁蛮",
      "机智聪慧",
      "重感情"
    ],
    "one_line": "丁不三的孙女，误认石破天为石中玉，性格活泼刁蛮"
  },
  {
    "id": "char_xie_yan_ke",
    "name": "谢烟客",
    "role": "核心",
    "identity": "玄铁令主人",
    "faction": null,
    "personality": [
      "孤傲自负",
      "言出必践",
      "忽正忽邪"
    ],
    "one_line": "玄铁令主人，武功极高性格孤傲，传授石破天内功"
  },
  {
    "id": "char_bei_hai_shi",
    "name": "贝海石",
    "role": "重要",
    "identity": "长乐帮军师",
    "faction": "faction_chang_le_bang",
    "personality": [
      "智谋过人",
      "医术高明",
      "善于操纵"
    ],
    "one_line": "长乐帮军师，医术高明智谋过人，拥立石破天为帮主"
  },
  {
    "id": "char_ding_bu_san",
    "name": "丁不三",
    "role": "重要",
    "identity": "丁珰的祖父",
    "faction": null,
    "personality": [
      "凶残嗜杀",
      "喜怒无常",
      "疼爱孙女"
    ],
    "one_line": "丁珰的祖父，外号一日不过三，性格凶残喜怒无常"
  },
  {
    "id": "char_ding_bu_si",
    "name": "丁不四",
    "role": "重要",
    "identity": "丁不三的弟弟",
    "faction": null,
    "personality": [
      "性格古怪",
      "痴情执着",
      "武功高强"
    ],
    "one_line": "丁不三的弟弟，性格古怪武功高强，苦恋史小翠"
  },
  {
    "id": "char_bai_zi_zai",
    "name": "白自在",
    "role": "重要",
    "identity": "雪山派掌门",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "自大狂妄",
      "武功高强",
      "脾气暴躁"
    ],
    "one_line": "雪山派掌门，自大狂妄，后在侠客岛领悟武学真谛"
  },
  {
    "id": "char_zhang_san",
    "name": "张三",
    "role": "重要",
    "identity": "侠客岛赏善罚恶使者",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "豪爽大方",
      "武功高强",
      "重义气"
    ],
    "one_line": "侠客岛赏善罚恶使者，与李四结伴出巡，与石破天结拜"
  },
  {
    "id": "char_shi_zhong_yu",
    "name": "石中玉",
    "role": "重要",
    "identity": "石清闵柔之子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "品行不端",
      "油嘴滑舌",
      "胆大妄为"
    ],
    "one_line": "石破天的孪生兄弟，品行不端，在凌霄城犯下大错"
  },
  {
    "id": "char_li_si",
    "name": "李四",
    "role": "重要",
    "identity": "侠客岛赏善罚恶使者",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "沉稳冷静",
      "武功高强",
      "重义气"
    ],
    "one_line": "侠客岛赏善罚恶使者，与张三结伴出巡"
  },
  {
    "id": "char_long_dao_zhu",
    "name": "龙岛主",
    "role": "重要",
    "identity": "侠客岛岛主",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功极高",
      "执着追求武学",
      "待客有礼"
    ],
    "one_line": "侠客岛岛主，与木岛主共掌侠客岛，主持腊八粥宴"
  },
  {
    "id": "char_shi_qing",
    "name": "石清",
    "role": "重要",
    "identity": "玄素庄庄主",
    "faction": "faction_xuan_su_zhuang",
    "personality": [
      "侠义仁厚",
      "武功高强",
      "沉稳老练"
    ],
    "one_line": "玄素庄庄主，侠义仁厚，黑白双剑名扬天下"
  },
  {
    "id": "char_min_rou",
    "name": "闵柔",
    "role": "重要",
    "identity": "石清之妻",
    "faction": "faction_xuan_su_zhuang",
    "personality": [
      "温柔贤淑",
      "母爱深切",
      "武功高强"
    ],
    "one_line": "石清之妻，人称观音娘娘，母爱深切，与丈夫双剑合璧"
  },
  {
    "id": "char_bai_wan_jian",
    "name": "白万剑",
    "role": "重要",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "武功高强",
      "性格刚烈",
      "重情重义"
    ],
    "one_line": "雪山派弟子，白自在之子，追捕石中玉"
  },
  {
    "id": "char_a_xiu",
    "name": "阿绣",
    "role": "重要",
    "identity": "白自在的孙女",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "温柔善良",
      "天真纯洁",
      "坚韧勇敢"
    ],
    "one_line": "白自在的孙女，石破天的挚爱，后成为其妻子"
  },
  {
    "id": "char_shi_xiao_cui",
    "name": "史小翠",
    "role": "重要",
    "identity": "白自在之妻",
    "faction": "faction_jin_wu_pai",
    "personality": [
      "性格倔强",
      "武功高强",
      "嫉恶如仇"
    ],
    "one_line": "白自在之妻，创建金乌派，金乌刀法专门克制雪山剑法"
  },
  {
    "id": "char_mu_dao_zhu",
    "name": "木岛主",
    "role": "次要",
    "identity": "侠客岛岛主",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功极高",
      "执着追求武学",
      "沉默寡言"
    ],
    "one_line": "侠客岛岛主，与龙岛主共掌侠客岛"
  },
  {
    "id": "char_gao_san_niang_zi",
    "name": "高三娘子",
    "role": "次要",
    "identity": "辽东女侠",
    "faction": null,
    "personality": [
      "侠义心肠",
      "豪爽大方",
      "武功不弱"
    ],
    "one_line": "辽东女侠，侠义心肠，与范一飞等人同行赴侠客岛"
  },
  {
    "id": "char_fan_yi_fei",
    "name": "范一飞",
    "role": "次要",
    "identity": "辽东武林人物",
    "faction": null,
    "personality": [
      "豪爽",
      "重义气"
    ],
    "one_line": "辽东武林人物，被侠客岛邀去喝腊八粥"
  },
  {
    "id": "char_lv_zheng_ping",
    "name": "吕正平",
    "role": "次要",
    "identity": "辽东武林人物",
    "faction": null,
    "personality": [
      "豪爽",
      "重义气"
    ],
    "one_line": "辽东武林人物，与范一飞同行赴侠客岛"
  },
  {
    "id": "char_feng_liang",
    "name": "风良",
    "role": "次要",
    "identity": "辽东武林人物",
    "faction": null,
    "personality": [
      "豪爽",
      "重义气"
    ],
    "one_line": "辽东武林人物，与范一飞等人同行赴侠客岛"
  },
  {
    "id": "char_shi_jian",
    "name": "侍剑",
    "role": "次要",
    "identity": "石破天的贴身侍女",
    "faction": "faction_chang_le_bang",
    "personality": [
      "忠心耿耿",
      "温柔体贴",
      "机灵聪慧"
    ],
    "one_line": "石破天的贴身侍女，忠心耿耿"
  },
  {
    "id": "char_wu_dao_tong",
    "name": "吴道通",
    "role": "次要",
    "identity": "玄铁令持有者",
    "faction": null,
    "personality": [
      "隐忍",
      "机智",
      "武功不弱"
    ],
    "one_line": "卖烧饼的老者，玄铁令的持有者，死于金刀寨追杀"
  },
  {
    "id": "char_an_feng_ri",
    "name": "安奉日",
    "role": "次要",
    "identity": "金刀寨寨主",
    "faction": "faction_jin_dao_zhai",
    "personality": [
      "豪爽",
      "重义气",
      "武功不弱"
    ],
    "one_line": "金刀寨寨主，劫富济贫的绿林好汉"
  },
  {
    "id": "char_zhou_mu",
    "name": "周牧",
    "role": "次要",
    "identity": "金刀寨头领",
    "faction": "faction_jin_dao_zhai",
    "personality": [
      "老练",
      "武功不弱",
      "贪心"
    ],
    "one_line": "金刀寨头领，武功高强，追杀吴道通"
  },
  {
    "id": "char_you_de_sheng",
    "name": "尤得胜",
    "role": "次要",
    "identity": "铁叉会总舵主",
    "faction": "faction_tie_cha_hui",
    "personality": [
      "武功不弱",
      "刚愎自用"
    ],
    "one_line": "铁叉会总舵主，双短叉神功独步江湖，死于张三李四之手"
  },
  {
    "id": "char_mei_wen_xin",
    "name": "梅文馨",
    "role": "次要",
    "identity": "丁不四的旧情人",
    "faction": null,
    "personality": [
      "痴情",
      "刚烈"
    ],
    "one_line": "丁不四的旧情人，梅芳姑之母"
  },
  {
    "id": "char_mei_fang_gu",
    "name": "梅芳姑",
    "role": "次要",
    "identity": "丁不四的私生女",
    "faction": null,
    "personality": [
      "孤僻",
      "武功平平"
    ],
    "one_line": "丁不四与梅文馨的私生女，掳走石中玉"
  },
  {
    "id": "char_feng_wan_li",
    "name": "封万里",
    "role": "次要",
    "identity": "雪山派大弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "武功高强",
      "刚猛",
      "忠于师门"
    ],
    "one_line": "雪山派大弟子，石中玉的师父，被白自在斩断臂膀"
  },
  {
    "id": "char_tian_xu_dao_ren",
    "name": "天虚道人",
    "role": "次要",
    "identity": "上清观掌门",
    "faction": "faction_shang_qing_guan",
    "personality": [
      "武功高强",
      "忧心武林",
      "道行高深"
    ],
    "one_line": "上清观掌门，石清闵柔的师兄"
  },
  {
    "id": "char_cheng_zi_xue",
    "name": "成自学",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "野心勃勃",
      "阴险狡诈"
    ],
    "one_line": "雪山派长老，觊觎掌门之位"
  },
  {
    "id": "char_qi_zi_mian",
    "name": "齐自勉",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "野心勃勃"
    ],
    "one_line": "雪山派长老，与成自学等人同谋"
  },
  {
    "id": "char_liang_zi_jin",
    "name": "梁自进",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "野心勃勃"
    ],
    "one_line": "雪山派长老，与成自学等人同谋"
  },
  {
    "id": "char_wen_ren_hou",
    "name": "温仁厚",
    "role": "龙套",
    "identity": "山东八仙剑掌门",
    "faction": null,
    "personality": [
      "武功不弱",
      "与白自在交好"
    ],
    "one_line": "山东八仙剑掌门，被侠客岛邀去研习武学"
  },
  {
    "id": "char_kang_kun",
    "name": "康昆",
    "role": "龙套",
    "identity": "果毅门掌门",
    "faction": "faction_guo_yi_men",
    "personality": [
      "西域胡人",
      "武功不弱"
    ],
    "one_line": "凉州果毅门掌门，西域胡人"
  },
  {
    "id": "char_mi_xiang_zhu",
    "name": "米香主",
    "role": "龙套",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功平平"
    ],
    "one_line": "长乐帮香主，被谢烟客擒住"
  },
  {
    "id": "char_yun_xiang_zhu",
    "name": "云香主",
    "role": "龙套",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功平平"
    ],
    "one_line": "长乐帮香主，使烂银短戟"
  },
  {
    "id": "char_da_bei_lao_ren",
    "name": "大悲老人",
    "role": "龙套",
    "identity": "武林前辈",
    "faction": null,
    "personality": [
      "武功不弱",
      "侠义心肠"
    ],
    "one_line": "武林前辈，被长乐帮围杀，临死前赠石破天十八泥偶"
  },
  {
    "id": "char_geng_wan_zhong",
    "name": "耿万钟",
    "role": "龙套",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "武功不弱",
      "忠于师门"
    ],
    "one_line": "雪山派弟子，追查石中玉"
  },
  {
    "id": "char_wang_wan_ren",
    "name": "王万仞",
    "role": "龙套",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "性情急躁",
      "口无遮拦"
    ],
    "one_line": "雪山派弟子，性情急躁"
  },
  {
    "id": "char_ke_wan_jun",
    "name": "柯万钧",
    "role": "龙套",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "武功平平"
    ],
    "one_line": "雪山派弟子，与耿万钟同行"
  }
]

### factions.json (11 条)
[
  {
    "id": "faction_xue_shan_pai",
    "name": "雪山派",
    "type": "武林门派",
    "location": "loc_ling_xiao_cheng",
    "one_line": "以凌霄城为基地的武林大派，剑法精妙，威震西域"
  },
  {
    "id": "faction_chang_le_bang",
    "name": "长乐帮",
    "type": "帮派",
    "location": "loc_zhen_jiang",
    "one_line": "江南大帮会，石破天被贝海石等人误认为帮主"
  },
  {
    "id": "faction_xia_ke_dao",
    "name": "侠客岛",
    "type": "武林门派",
    "location": "loc_xia_ke_dao",
    "one_line": "神秘海外岛屿，龙木二岛主共掌，每十年邀武林高手赴岛研习武学"
  },
  {
    "id": "faction_tie_cha_hui",
    "name": "铁叉会",
    "type": "帮派",
    "location": null,
    "one_line": "江湖帮会，以铁叉为标志，被张三李四剿灭"
  },
  {
    "id": "faction_xuan_su_zhuang",
    "name": "玄素庄",
    "type": "家族",
    "location": "loc_xuan_su_zhuang",
    "one_line": "石清闵柔夫妇的庄园，江南武林世家，黑白双剑名扬天下"
  },
  {
    "id": "faction_jin_wu_pai",
    "name": "金乌派",
    "type": "武林门派",
    "location": null,
    "one_line": "史小翠所创门派，金乌刀法专克雪山剑法"
  },
  {
    "id": "faction_jin_dao_zhai",
    "name": "金刀寨",
    "type": "帮派",
    "location": null,
    "one_line": "绿林山寨，安奉日为寨主，劫富济贫追查玄铁令"
  },
  {
    "id": "faction_shang_qing_guan",
    "name": "上清观",
    "type": "武林门派",
    "location": "loc_shang_qing_guan",
    "one_line": "道家门派，天虚道人为掌门，石清闵柔少年时在此学艺"
  },
  {
    "id": "faction_fei_yu_bang",
    "name": "飞鱼帮",
    "type": "帮派",
    "location": null,
    "one_line": "水上帮派，被赏善罚恶使者剿灭，石破天在死尸船上首次听闻侠客岛"
  },
  {
    "id": "faction_guo_yi_men",
    "name": "果毅门",
    "type": "武林门派",
    "location": "loc_liang_zhou",
    "one_line": "凉州武林门派，掌门康昆为西域胡人"
  },
  {
    "id": "faction_fu_hu_men",
    "name": "伏虎门",
    "type": "武林门派",
    "location": null,
    "one_line": "山西武林门派，尤得胜为唯一传人，擅双短叉"
  }
]

### locations.json (12 条)
[
  {
    "id": "loc_xia_ke_dao",
    "name": "侠客岛",
    "region": "南海",
    "one_line": "神秘海外岛屿，藏有太玄经石壁，每十年邀武林高手赴岛研习武学"
  },
  {
    "id": "loc_ling_xiao_cheng",
    "name": "凌霄城",
    "region": "西域",
    "one_line": "雪山派总舵，位于西域雪山之中，地势险峻"
  },
  {
    "id": "loc_mo_tian_ya",
    "name": "摩天崖",
    "region": "中原",
    "one_line": "谢烟客隐居之地，地势险峻高耸入云"
  },
  {
    "id": "loc_xuan_su_zhuang",
    "name": "玄素庄",
    "region": "江南",
    "one_line": "石清闵柔夫妇的庄园，江南武林世家"
  },
  {
    "id": "loc_hou_jian_ji",
    "name": "侯监集",
    "region": "中原",
    "one_line": "开封东门小镇，玄铁令争夺之地，石破天在此初遇谢烟客"
  },
  {
    "id": "loc_kai_feng",
    "name": "开封",
    "region": "中原",
    "one_line": "河南名城，古称大梁，繁华之地"
  },
  {
    "id": "loc_zhen_jiang",
    "name": "镇江",
    "region": "江南",
    "one_line": "江南重镇，长乐帮总舵所在地"
  },
  {
    "id": "loc_shang_qing_guan",
    "name": "上清观",
    "region": "中原",
    "one_line": "道家门派所在，石清闵柔少年时在此学艺"
  },
  {
    "id": "loc_bi_luo_dao",
    "name": "碧螺岛",
    "region": "东海",
    "one_line": "丁不四的居所，东海小岛"
  },
  {
    "id": "loc_zi_yan_dao",
    "name": "紫烟岛",
    "region": "东海",
    "one_line": "长江中的小岛，史婆婆阿绣流落之处，石破天在此学得金乌刀法"
  },
  {
    "id": "loc_xiong_er_shan",
    "name": "熊耳山枯草岭",
    "region": "中原",
    "one_line": "梅芳姑隐居之处"
  },
  {
    "id": "loc_liang_zhou",
    "name": "凉州",
    "region": "西域",
    "one_line": "果毅门所在地，西域胡人聚居之地"
  }
]

### skills.json (24 条)
[
  {
    "id": "skill_tai_xuan_jing",
    "name": "太玄经",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "侠客岛石壁最高武学，融合诸般武学精髓，非识字者可悟"
  },
  {
    "id": "skill_luo_han_fu_mo_shen_gong",
    "name": "罗汉伏魔神功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "少林至高内功，石破天通过十八泥偶修炼，内力大增"
  },
  {
    "id": "skill_xia_ke_xing_bi_wu_gong",
    "name": "侠客行石壁武学",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "侠客岛上李白诗篇的武学图解，太玄经为其总纲"
  },
  {
    "id": "skill_bi_zhen_qing_zhang",
    "name": "碧针清掌",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "谢烟客成名掌法，以松针练就，掌力阴柔绵长"
  },
  {
    "id": "skill_wu_xing_liu_he_zhang",
    "name": "五行六合掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "贝海石的成名绝技，着手成春之名由此而来"
  },
  {
    "id": "skill_xue_shan_jian_fa",
    "name": "雪山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "雪山派镇派剑法，精妙凌厉，以轻灵迅捷见长"
  },
  {
    "id": "skill_jin_wu_dao_fa",
    "name": "金乌刀法",
    "type": "刀法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "史小翠所创刀法，招招克制雪山剑法，共七十二路"
  },
  {
    "id": "skill_shen_dao_gui_die_san_lian_huan",
    "name": "神倒鬼跌三连环",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁不四的独门武功，连环三招诡异多变"
  },
  {
    "id": "skill_yi_wei_du_jiang",
    "name": "一苇渡江",
    "type": "轻功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "轻功绝技，可踏水而行"
  },
  {
    "id": "skill_tie_xiu_gong",
    "name": "铁袖功",
    "type": "掌法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "以衣袖施展的武功，刚柔并济"
  },
  {
    "id": "skill_shuang_duan_cha_shen_gong",
    "name": "双短叉神功",
    "type": "奇门",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "山西伏虎门绝学，铁叉会总舵主尤得胜独擅双短叉"
  },
  {
    "id": "skill_wu_xing_quan",
    "name": "五行拳",
    "type": "拳法",
    "mastery_rank": "初窥门径",
    "practitioners": [],
    "one_line": "武林常见基础拳法"
  },
  {
    "id": "skill_tan_zhi_shen_tong",
    "name": "弹指神通",
    "type": "指法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "谢烟客绝技，以指力弹物伤人，曾弹剑夺人兵刃"
  },
  {
    "id": "skill_shang_qing_jian_fa",
    "name": "上清剑法",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "上清观的道家剑法，飘逸出尘，石清闵柔少年时所学"
  },
  {
    "id": "skill_wu_wang_shen_gong",
    "name": "无妄神功",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "史小翠与阿绣修炼的内功，走火入魔风险极大"
  },
  {
    "id": "skill_kong_he_gong",
    "name": "控鹤功",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "可隔空取物的内功，以内力操控外物"
  },
  {
    "id": "skill_yan_yan_gong",
    "name": "炎炎功",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "谢烟客故意颠倒阴阳次序传授石破天的内功，意在害其性命"
  },
  {
    "id": "skill_jin_long_bian_fa",
    "name": "金龙鞭法",
    "type": "奇门",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁不四的成名鞭法，以九节软鞭施展，刚猛凌厉"
  },
  {
    "id": "skill_ding_jia_qin_na_shou",
    "name": "丁家擒拿手",
    "type": "指法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "丁家祖传一十八路擒拿手，丁珰在长江船上教授石破天"
  },
  {
    "id": "skill_pai_gua_dao",
    "name": "劈卦刀",
    "type": "刀法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "安奉日的拿手绝技，七十二路刀法变化多端"
  },
  {
    "id": "skill_kuai_ma_shen_dao",
    "name": "快马神刀",
    "type": "刀法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "长乐帮前帮主司徒横的成名绝技，弯刀快马称雄辽东"
  },
  {
    "id": "skill_mei_hua_quan",
    "name": "梅花拳",
    "type": "拳法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "梅芳姑家传武功，天下只此一家"
  },
  {
    "id": "skill_ba_xian_jian",
    "name": "八仙剑",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "山东八仙剑掌门温仁厚的家传剑法"
  },
  {
    "id": "skill_tie_cha_gong",
    "name": "铁叉功",
    "type": "奇门",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "铁叉会以铁叉为兵器的功夫"
  }
]

### techniques.json (0 条)
[]

### items.json (10 条)
[
  {
    "id": "item_xuan_tie_ling",
    "name": "玄铁令",
    "type": "信物",
    "owner": "char_xie_yan_ke",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "谢烟客的信物，有求必应，贯穿全书前半部的核心道具"
  },
  {
    "id": "item_shang_shan_fa_e_ling",
    "name": "赏善罚恶令",
    "type": "信物",
    "owner": "faction_xia_ke_dao",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "侠客岛派出的铜牌信令，接令门派须赴岛饮腊八粥"
  },
  {
    "id": "item_la_ba_zhou",
    "name": "腊八粥",
    "type": "食物",
    "owner": "faction_xia_ke_dao",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "侠客岛以珍稀药材熬制的药粥，饮者功力可增"
  },
  {
    "id": "item_jin_wu_dao",
    "name": "金乌刀",
    "type": "兵器",
    "owner": "char_shi_po_tian",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_jin_wu_dao_fa"
    ],
    "one_line": "金乌派配刀，刀法专克雪山剑法"
  },
  {
    "id": "item_xuan_bing_bi_huo_jiu",
    "name": "玄冰碧火酒",
    "type": "丹药",
    "owner": "char_ding_bu_san",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "丁不三珍藏的奇酒，半冰半火，饮后体质异变"
  },
  {
    "id": "item_xia_ke_dao_mu_bei",
    "name": "侠客岛墓碑",
    "type": "奇门",
    "owner": "faction_xia_ke_dao",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "龙岛主、木岛主的墓碑，揭示侠客岛之谜的最终真相"
  },
  {
    "id": "item_hei_bai_shuang_jian",
    "name": "黑白双剑",
    "type": "兵器",
    "owner": "char_shi_qing",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_shang_qing_jian_fa"
    ],
    "one_line": "石清闵柔夫妇的配剑，白剑如冰黑剑似墨，武林罕见神兵"
  },
  {
    "id": "item_liu_ye_dao",
    "name": "柳叶刀",
    "type": "兵器",
    "owner": "char_ding_dang",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "丁珰的随身兵刃，形似柳叶，轻巧锋利"
  },
  {
    "id": "item_zi_jin_dao",
    "name": "紫金刀",
    "type": "兵器",
    "owner": "char_lv_zheng_ping",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "快刀门掌门吕正平的配刀，刀身紫金，厚背薄刃"
  },
  {
    "id": "item_jiu_jie_ruan_bian",
    "name": "九节软鞭",
    "type": "兵器",
    "owner": "char_ding_bu_si",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_jin_long_bian_fa"
    ],
    "one_line": "丁不四的黄金九节软鞭，鞭首龙头镶嵌宝石，华丽威猛"
  }
]

### dialogues.json (前 50 条 / 共 230 条)
[
  {
    "index": 0,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_an_feng_ri",
    "text": "吴道通身上的物事，周世兄既已取到，我想借来一观。请取出来罢！”周牧道：“那东西是有的，却不在我身边。你既要看，咱们回到那边去便了。",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 191,
    "line_end": 191
  },
  {
    "index": 1,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "听说这三枚玄铁令，有两枚已归还谢先生之手，武林中也因此发生了两件惊天动地的大事。这玄铁令便是最后一枚了，不知对不对？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 365,
    "line_end": 365
  },
  {
    "index": 2,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_an_feng_ri",
    "text": "金刀寨也上了当。咱们再到吴道通尸身上去搜搜，说不定金刀寨的朋友们漏了眼。”闵柔明知无望，却不违拗丈夫之意，哽咽道：“是。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 259,
    "line_end": 259
  },
  {
    "index": 3,
    "speaker": "char_min_rou",
    "speaker_name": "闵柔",
    "listener": "char_shi_qing",
    "text": "师哥，看来此仇已注定难报。这几日来也真累了你啦。咱们到汴梁城中散散心，看几出戏文，听几场鼓儿书。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 267,
    "line_end": 267
  },
  {
    "index": 4,
    "speaker": "char_zhou_mu",
    "speaker_name": "周牧",
    "listener": null,
    "text": "‘一飞冲天’是在下师叔。”暗道：“你年纪比我小着一大截，却称我庄师叔为庄兄，那不是明明以长辈自居吗？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 157,
    "line_end": 157
  },
  {
    "index": 5,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "不错。此事武林中人，有谁不知？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 365,
    "line_end": 365
  },
  {
    "index": 6,
    "speaker": "char_zhou_mu",
    "speaker_name": "周牧",
    "listener": null,
    "text": "倘若是在下自己的事，冲着两位的金面，只要力所能及，两位吩咐下来，自然无有不遵。但若是敝寨的事，在下职位低微，可做不得主了。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 161,
    "line_end": 161
  },
  {
    "index": 7,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_geng_wan_zhong",
    "text": "该烧，该烧！我夫妇惭愧无地，便走遍天涯海角，也要擒到这孽子，亲自送上凌霄城来，在白姑娘灵前凌迟处死⋯⋯”闵柔听到这里，突然“嘤",
    "tone": "愤怒",
    "chapter": 2,
    "line_start": 79,
    "line_end": 79
  },
  {
    "index": 8,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_geng_wan_zhong",
    "text": "此人无礼之极，竟敢对白老爷子如此不敬，到底是仗着什么靠山？咱们可放他不过。",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 109,
    "line_end": 109
  },
  {
    "index": 9,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_geng_wan_zhong",
    "text": "丁不二原是老大，他说：‘我不是老二，因此叫丁不二！’”王万仞哈哈大笑，说道：“我知道啦，丁不三是老二，他不是老三，就叫丁不三。丁不四也是这样。",
    "tone": "欣喜",
    "chapter": 2,
    "line_start": 123,
    "line_end": 123
  },
  {
    "index": 10,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_geng_wan_zhong",
    "text": "听说此人有三兄弟，他有个哥哥叫丁不二，有个弟弟叫丁不四。”王万仞骂道：“他奶奶的，不二不三，不三不四，居然取这样的狗屁名字。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 121,
    "line_end": 121
  },
  {
    "index": 11,
    "speaker": "char_shi_qing",
    "speaker_name": "石清",
    "listener": "char_geng_wan_zhong",
    "text": "耿兄，小孽障在凌霄城闯下这场大祸，是那一日的事？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 133,
    "line_end": 133
  },
  {
    "index": 12,
    "speaker": "char_geng_wan_zhong",
    "speaker_name": "耿万钟",
    "listener": "char_shi_qing",
    "text": "我们凌霄城外的深谷，石庄主是知道的，别说是人，就是一块石子掉了下去，也跌成了石粉。这样娇娇嫩嫩的一个小姑娘跳了下去，还不成了一团肉浆？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 67,
    "line_end": 67
  },
  {
    "index": 13,
    "speaker": "char_ke_wan_jun",
    "speaker_name": "柯万钧",
    "listener": null,
    "text": "你⋯⋯你⋯⋯你交代了这几句话，就此拍手走了不成？”石清道：“柯师兄更有什么说话？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 139,
    "line_end": 139
  },
  {
    "index": 14,
    "speaker": "char_hua_wan_zi",
    "speaker_name": "花万紫",
    "listener": null,
    "text": "剑自然是真的。咱们留不下人，可不知有没能耐留得下这两口宝剑？”耿万钟心头一凛，问道：“花师妹以为怎样？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 173,
    "line_end": 173
  },
  {
    "index": 15,
    "speaker": "char_wang_wan_ren",
    "speaker_name": "王万仞",
    "listener": null,
    "text": "小心谨慎，总错不了。打从今儿起，咱们六个男人每晚轮班看守这对鬼剑便是。”顿了一顿，问道：“耿师哥，这姓石的这会儿正在汴梁，咱们去不去？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 177,
    "line_end": 177
  },
  {
    "index": 16,
    "speaker": "char_geng_wan_zhong",
    "speaker_name": "耿万钟",
    "listener": "char_shi_qing",
    "text": "这里是非之地，多留不便，咱们借一步说话。”当下拔起地下的长剑，道：“石庄主请，石夫人请。",
    "tone": "恳求",
    "chapter": 2,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 17,
    "speaker": "char_geng_wan_zhong",
    "speaker_name": "耿万钟",
    "listener": "char_shi_qing",
    "text": "石庄主，咱们到那边说话如何？”石清道：“甚好。",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 27,
    "line_end": 27
  },
  {
    "index": 18,
    "speaker": "char_geng_wan_zhong",
    "speaker_name": "耿万钟",
    "listener": "char_shi_qing",
    "text": "‘得罪’二字，却忒也轻了。他⋯⋯他⋯⋯他委实胆大妄为，竟将我们师侄女绑住了手足，将她剥得一丝不挂，想要强奸。",
    "tone": "恐惧",
    "chapter": 2,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 19,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "你若求我给你医，我立时使你双脚不肿不痛。”小丐道：“你如肯给我治好，我自然多谢你啦。”谢烟客眉头一皱，道：“你当真从来不肯开口向人乞求？",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 225,
    "line_end": 225
  },
  {
    "index": 20,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "怎么啦？”盼他出口说：“咱们歇一会儿罢。”岂料他却道：“没什么，脚底有点儿痛，咱们走罢。",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 233,
    "line_end": 233
  },
  {
    "index": 21,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "我就是不知道。狗杂种太难听，要不要我给你取个姓名？",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 121,
    "line_end": 121
  },
  {
    "index": 22,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "几时你要下山去，只须求我一声，我便立即送你下去。”心想：“我不给你东西吃，你自己没能耐下去，终究要开口求我。",
    "tone": "恳求",
    "chapter": 3,
    "line_start": 249,
    "line_end": 249
  },
  {
    "index": 23,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "你若求我教你这门本事，我就可以教你。学会之后，可好玩得很呢，你要下山上山，自己行走便了，也不用我带。",
    "tone": "恳求",
    "chapter": 3,
    "line_start": 295,
    "line_end": 295
  },
  {
    "index": 24,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "我叫你去跟狗官说的话，你都记得么？",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 25,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": "char_shi_po_tian",
    "text": "这女子婆婆妈妈，可坏了我的事。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 26,
    "speaker": "char_bei_hai_shi",
    "speaker_name": "贝海石",
    "listener": "char_xie_yan_ke",
    "text": "下去有何难哉？午时下去，申时又再上来了。”谢烟客脸色一沉，说道：“贝大夫，你这般阴魂不散的缠上了谢某，到底打的是什么主意？",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 27,
    "speaker": "char_bei_hai_shi",
    "speaker_name": "贝海石",
    "listener": "char_xie_yan_ke",
    "text": "什么主意？众位兄弟，咱们打的是什么主意？”随他上山的其余七人一直没开口，这时齐声说道：“咱们求见帮主，要恭迎帮主回归总舵。",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 55,
    "line_end": 55
  },
  {
    "index": 28,
    "speaker": "char_xie_yan_ke",
    "speaker_name": "谢烟客",
    "listener": null,
    "text": "素闻贝大夫独来独往，几时也加盟长乐帮了？",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 19,
    "line_end": 19
  },
  {
    "index": 29,
    "speaker": "char_bei_hai_shi",
    "speaker_name": "贝海石",
    "listener": "char_xie_yan_ke",
    "text": "此中隐情，我们在见到帮主之前，谁也不敢妄作推测。”向一名魁梧的中年汉子道：“云香主，你和众贤弟四下里瞧瞧，一见到帮主大驾，立即告知愚兄。谢先生的贵府却不可乱闯。",
    "tone": "恐惧",
    "chapter": 4,
    "line_start": 59,
    "line_end": 59
  },
  {
    "index": 30,
    "speaker": "char_bei_hai_shi",
    "speaker_name": "贝海石",
    "listener": "char_xie_yan_ke",
    "text": "既然如此，咱们就做两个担架，将帮主和米香主两位护送回归总舵。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 125,
    "line_end": 125
  },
  {
    "index": 31,
    "speaker": "char_mi_heng_ye",
    "speaker_name": "米横野",
    "listener": null,
    "text": "那又有什么分别？要是帮主有甚不测，大伙儿都大祸临头，也不分什么罪轻罪重了。",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 157,
    "line_end": 157
  },
  {
    "index": 32,
    "speaker": "char_bei_hai_shi",
    "speaker_name": "贝海石",
    "listener": "char_xie_yan_ke",
    "text": "米兄弟安卧休息，千万不可自行运气。",
    "tone": "冷酷",
    "chapter": 4,
    "line_start": 81,
    "line_end": 81
  },
  {
    "index": 33,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "那我跟他们说些什么话好？”侍剑道：“我是个小丫头，又懂得什么？少爷，你如拿不定主意，不妨便问贝先生。他是帮里的军师，最是聪明不过。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 71,
    "line_end": 71
  },
  {
    "index": 34,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "贝先生又不在这里。侍剑姊姊，你想那个陈香主有什么话跟我说？他问我什么，我一定回答不出。你⋯⋯你还是叫他回去罢。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 71,
    "line_end": 71
  },
  {
    "index": 35,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "嗯，捉了个女的，逃了个男的。不知这两人来干什么？是来偷东西吗？”陈冲之道：“狮威堂倒没少了什么物事。”石破天皱眉道：“那两人凶恶得紧，怎地动不动便杀了三个人。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 93,
    "line_end": 93
  },
  {
    "index": 36,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "花姑娘是使剑的，陈香主，请你还了她，好不好？”陈冲之道：“是，是，剑在外面，姑娘出去，便即奉上。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 129,
    "line_end": 129
  },
  {
    "index": 37,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "花姑娘，你腿上的伤不碍事罢？如断了骨头，我倒会给你接骨，就像给阿黄接好断腿一样。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 137,
    "line_end": 137
  },
  {
    "index": 38,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "不，不！我心里有好多不明白的事儿，都要问你。侍剑姊姊，你为什么要做丫鬟？",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 175,
    "line_end": 175
  },
  {
    "index": 39,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "我举目无亲的，叫我到那里去？窦总管知道你不要我服侍，把我再送到堂子里去给人欺侮，我还是死了的好。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 175,
    "line_end": 175
  },
  {
    "index": 40,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "堂子里不好吗？我叫他不让你去就是了。”侍剑道：“你病还没好，我也不能就这么走了。再说，只要你不欺侮我，少爷，我是情愿服侍你的。",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 177,
    "line_end": 177
  },
  {
    "index": 41,
    "speaker": "char_ding_dang",
    "speaker_name": "丁珰",
    "listener": "char_shi_po_tian",
    "text": "他老人家的名讳上‘不’下‘三’，外号叫做那个⋯⋯那个⋯⋯‘一日不过三’！",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 321,
    "line_end": 321
  },
  {
    "index": 42,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "想来你自己有银子。陈香主说你腿上受了伤，本来我们可以请贝先生给你瞧瞧，你既然这么讨厌长乐帮，那么你到街上找个医生治治罢，流多了血，恐怕不好。",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 123,
    "line_end": 123
  },
  {
    "index": 43,
    "speaker": "char_ding_dang",
    "speaker_name": "丁珰",
    "listener": "char_shi_po_tian",
    "text": "阿珰给爷爷设法重行配制就是了。”那老人道：“说来倒稀松平常。倘若说配制便能配制，爷爷也不放在心上了。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 305,
    "line_end": 305
  },
  {
    "index": 44,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_bei_hai_shi",
    "text": "嗯，你姓丁，爷爷也姓丁。大家都姓丁，丁丁丁的，倒也好听。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 319,
    "line_end": 319
  },
  {
    "index": 45,
    "speaker": "char_ding_bu_san",
    "speaker_name": "丁不三",
    "listener": "char_bei_hai_shi",
    "text": "贝大夫也听他的话？不会罢？”丁珰道：“会的，会的。我亲眼瞧见的，那还会有假？爷爷武功虽然高强，但要长乐帮的一帮之主跟着你学武，这个⋯⋯这个⋯⋯",
    "tone": "疑问",
    "chapter": 6,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 46,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_ding_dang",
    "text": "你还不认？好罢，容貌相似，天下本来也有的。今年年头，我跟你初相识时，你粗粗鲁鲁的抓住我手，我那时又不识你，反手便打，是不是了？",
    "tone": "疑问",
    "chapter": 6,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 47,
    "speaker": "char_shi_po_tian",
    "speaker_name": "石破天",
    "listener": "char_ding_dang",
    "text": "叮叮当当，咱们话说在头里，咱们拜天地，是闹着玩呢，还是当真的？",
    "tone": "疑问",
    "chapter": 6,
    "line_start": 87,
    "line_end": 87
  },
  {
    "index": 48,
    "speaker": "char_ding_bu_san",
    "speaker_name": "丁不三",
    "listener": "char_bei_hai_shi",
    "text": "贝大夫，你也是武林中的前辈高人了，不用跟丁老三这般客气。你说什么石帮主，便是我的新孙女婿狗杂种了，是不是？他说你们认错了人，不用见了。",
    "tone": "疑问",
    "chapter": 6,
    "line_start": 119,
    "line_end": 119
  },
  {
    "index": 49,
    "speaker": "char_ding_bu_san",
    "speaker_name": "丁不三",
    "listener": "char_bei_hai_shi",
    "text": "贝大夫，你有话要跟我孙女婿说，我在旁听听成不成？”贝海石沉吟道：“这个⋯⋯",
    "tone": "疑问",
    "chapter": 6,
    "line_start": 131,
    "line_end": 131
  }
]

### chapter_summaries.json (21 条)
[
  {
    "chapter": 1,
    "title": "烧饼馅子",
    "key_events": [
      "吴道通被杀，玄铁令藏入烧饼",
      "小丐咬出玄铁令",
      "谢烟客现身夺令",
      "石清闵柔夫妇出场",
      "谢烟客带小丐离去"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_xie_yan_ke",
      "char_shi_qing",
      "char_min_rou",
      "char_hua_wan_zi",
      "char_geng_wan_zhong",
      "char_zhou_mu"
    ]
  },
  {
    "chapter": 2,
    "title": "荒唐无耻",
    "key_events": [
      "石中玉在凌霄城闯下大祸",
      "阿绣被石中玉逼迫跳崖",
      "石清夫妇得知真相震怒",
      "丁不三丁不四兄弟出场",
      "石清答应上凌霄城赔罪"
    ],
    "key_characters": [
      "char_shi_qing",
      "char_min_rou",
      "char_geng_wan_zhong",
      "char_ding_bu_san",
      "char_ding_bu_si",
      "char_bai_wan_jian"
    ]
  },
  {
    "chapter": 3,
    "title": "不求人",
    "key_events": [
      "谢烟客引诱小丐求他",
      "小丐始终不肯开口求人",
      "大悲老人赠泥人",
      "谢烟客教小丐练内功",
      "长乐帮上崖寻找帮主"
    ],
    "key_characters": [
      "char_xie_yan_ke",
      "char_shi_po_tian",
      "char_bei_hai_shi"
    ]
  },
  {
    "chapter": 4,
    "title": "抢了他老婆",
    "key_events": [
      "长乐帮上摩天崖找帮主",
      "谢烟客与贝海石交手",
      "发现石破天在崖上",
      "贝海石认定石破天是帮主",
      "石破天修炼走火入魔"
    ],
    "key_characters": [
      "char_bei_hai_shi",
      "char_xie_yan_ke",
      "char_shi_po_tian",
      "char_mi_heng_ye"
    ]
  },
  {
    "chapter": 5,
    "title": "叮叮当当",
    "key_events": [
      "石破天被误认为石帮主",
      "侍剑服侍石破天起居",
      "丁珰出现称他为天哥",
      "石破天不知如何当帮主",
      "石破天身份困惑加深"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_ding_dang",
      "char_bei_hai_shi",
      "char_chen_chong_zhi"
    ]
  },
  {
    "chapter": 6,
    "title": "腿上的剑疤",
    "key_events": [
      "石破天饮玄冰碧火酒",
      "丁不三考验石破天",
      "石破天与丁珰拜堂成亲",
      "雪山派白万剑率众问罪",
      "石破天会见白万剑"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_ding_dang",
      "char_ding_bu_san",
      "char_bei_hai_shi",
      "char_bai_wan_jian",
      "char_hua_wan_zi"
    ]
  },
  {
    "chapter": 7,
    "title": "雪山剑法",
    "key_events": [
      "白万剑与石破天对质",
      "雪山派与长乐帮冲突",
      "石破天展现武功根基",
      "贝海石从中斡旋",
      "石破天身份困惑加深"
    ],
    "key_characters": [
      "char_bai_wan_jian",
      "char_shi_po_tian",
      "char_bei_hai_shi",
      "char_hua_wan_zi"
    ]
  },
  {
    "chapter": 8,
    "title": "白痴",
    "key_events": [
      "石破天在江湖游荡",
      "石破天被人视为白痴",
      "史婆婆和阿绣出场",
      "史婆婆逃离凌霄城",
      "石破天与史婆婆阿绣相遇"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_shi_xiao_cui",
      "char_a_xiu"
    ]
  },
  {
    "chapter": 9,
    "title": "大粽子",
    "key_events": [
      "丁不四抓走石破天",
      "丁不四与史小翠冲突",
      "石破天逃脱",
      "史小翠决定传授金乌刀法",
      "石破天开始学刀法"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_ding_bu_si",
      "char_shi_xiao_cui",
      "char_a_xiu"
    ]
  },
  {
    "chapter": 10,
    "title": "太阳出来了",
    "key_events": [
      "史小翠传授金乌刀法",
      "石破天学刀法极快",
      "阿绣对石破天渐生好感",
      "石破天内功根基被发现",
      "史小翠为石破天取名"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_shi_xiao_cui",
      "char_a_xiu"
    ]
  },
  {
    "chapter": 11,
    "title": "毒酒和义兄",
    "key_events": [
      "石破天与丁不四重逢",
      "展飞误认石破天为石中玉",
      "石破天以金乌刀法击退展飞",
      "石破天与丁不四结义",
      "铁叉会讨论赏善罚恶令"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_ding_bu_si",
      "char_zhan_fei"
    ]
  },
  {
    "chapter": 12,
    "title": "两块铜牌",
    "key_events": [
      "张三李四现身江湖",
      "赏善罚恶令发出",
      "拒绝者遭灭门",
      "石破天遇到张三李四",
      "江湖人心惶惶"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_zhang_san",
      "char_li_si"
    ]
  },
  {
    "chapter": 13,
    "title": "变得忠厚老实了",
    "key_events": [
      "石破天回到长乐帮",
      "众人发现他性格大变",
      "贝海石确认他是帮主",
      "石破天待人真诚",
      "身份困惑加深"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_bei_hai_shi"
    ]
  },
  {
    "chapter": 14,
    "title": "关东四大门派",
    "key_events": [
      "关东四大门派出场",
      "各方势力汇聚中原",
      "石破天与高手周旋",
      "展飞再次出现",
      "石破天武功令人惊讶"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_fan_yi_fei",
      "char_lv_zheng_ping",
      "char_gao_san_niang_zi",
      "char_feng_liang",
      "char_zhan_fei"
    ]
  },
  {
    "chapter": 15,
    "title": "真假帮主",
    "key_events": [
      "真假帮主之争",
      "贝海石维护石破天",
      "石中玉旧部态度不一",
      "石破天地位稳固",
      "赏善罚恶令阴影笼罩"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_bei_hai_shi",
      "char_shi_zhong_yu"
    ]
  },
  {
    "chapter": 16,
    "title": "凌霄城",
    "key_events": [
      "石破天来到凌霄城",
      "白自在认定他是石中玉",
      "石破天以金乌刀法对敌",
      "雪山派弟子震惊",
      "雪山派内部矛盾显现"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_bai_zi_zai",
      "char_bai_wan_jian",
      "char_feng_wan_li"
    ]
  },
  {
    "chapter": 17,
    "title": "自大成狂",
    "key_events": [
      "白自在自大成狂",
      "白自在与石破天比试",
      "石破天内功深厚",
      "史小翠回到凌霄城",
      "白自在与史小翠争吵"
    ],
    "key_characters": [
      "char_bai_zi_zai",
      "char_shi_po_tian",
      "char_shi_xiao_cui",
      "char_a_xiu",
      "char_bai_wan_jian"
    ]
  },
  {
    "chapter": 18,
    "title": "有所求",
    "key_events": [
      "梅芳姑出场",
      "石破天身世揭晓",
      "石破天是梅芳姑之子",
      "石清夫妇得知真相",
      "全书最大谜团解开"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_mei_fang_gu",
      "char_shi_qing",
      "char_min_rou",
      "char_mei_wen_xin"
    ]
  },
  {
    "chapter": 19,
    "title": "腊八粥",
    "key_events": [
      "群雄齐聚侠客岛",
      "石壁诗句注解难解",
      "龙岛主木岛主招待群雄",
      "石破天不识字反而无碍",
      "群雄争论不休"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_long_dao_zhu",
      "char_mu_dao_zhu",
      "char_zhang_san",
      "char_li_si",
      "char_miao_di",
      "char_yu_cha",
      "char_bai_zi_zai"
    ]
  },
  {
    "chapter": 20,
    "title": "侠客行",
    "key_events": [
      "石破天参悟太玄经",
      "不识字反而悟透石壁",
      "武功臻至化境",
      "龙木二岛主大喜",
      "侠客岛之谜揭开"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_long_dao_zhu",
      "char_mu_dao_zhu"
    ]
  },
  {
    "chapter": 21,
    "title": "我是谁",
    "key_events": [
      "石破天武功臻至化境",
      "石破天回到中原",
      "身份困惑最终化解",
      "龙木二岛主墓碑",
      "石破天与阿绣归宿"
    ],
    "key_characters": [
      "char_shi_po_tian",
      "char_mei_fang_gu",
      "char_a_xiu",
      "char_shi_qing",
      "char_min_rou"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
