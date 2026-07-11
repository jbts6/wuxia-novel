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

### characters.json (17 条)
[
  {
    "id": "char_xiao_ban_he",
    "name": "萧半和",
    "role": "核心",
    "identity": "晋阳大侠，实为净身太监，卧薪尝胆十六年图谋刺杀清帝",
    "faction": "faction_xiao_fu",
    "personality": [
      "义薄云天",
      "深谋远虑",
      "幽默豁达"
    ],
    "one_line": "晋阳大侠实为太监萧义，十六年卧薪尝胆，救袁杨二夫人后隐姓埋名"
  },
  {
    "id": "char_yuan_guan_nan",
    "name": "袁冠南",
    "role": "核心",
    "identity": "袁夫人之子，少年书生，武功高强",
    "faction": "faction_xiao_fu",
    "personality": [
      "倜傥自喜",
      "机智过人",
      "侠义心肠"
    ],
    "one_line": "游学寻母的少年书生，以笔墨为武器，与萧中慧相爱终成眷属"
  },
  {
    "id": "char_xiao_zhong_hui",
    "name": "萧中慧",
    "role": "核心",
    "identity": "杨伯冲之女，萧半和养女",
    "faction": "faction_xiao_fu",
    "personality": [
      "侠义心肠",
      "活泼开朗",
      "倔强好胜"
    ],
    "one_line": "侠义心肠的少女，使双刀，与袁冠南相爱后得知非亲兄妹"
  },
  {
    "id": "char_zhou_wei_xin",
    "name": "周威信",
    "role": "核心",
    "identity": "威信镖局总镖头，护送鸳鸯刀进京",
    "faction": "faction_wei_xin_biao_ju",
    "personality": [
      "胆小谨慎",
      "好面子",
      "圆滑世故"
    ],
    "one_line": "威信镖局总镖头，受命暗中护送鸳鸯刀进京，胆小谨慎又好面子"
  },
  {
    "id": "char_zhuo_tian_xiong",
    "name": "卓天雄",
    "role": "核心",
    "identity": "清宫侍卫，大内七大高手之首",
    "faction": "faction_qing_gong_shi_wei",
    "personality": [
      "阴险狡诈",
      "武功高强",
      "老奸巨猾"
    ],
    "one_line": "大内七大高手之首，假扮瞎子追踪鸳鸯刀，武功深不可测"
  },
  {
    "id": "char_lin_yu_long",
    "name": "林玉龙",
    "role": "重要",
    "identity": "任飞燕丈夫，使单刀",
    "faction": null,
    "personality": [
      "暴躁易怒",
      "卤莽冲动",
      "侠义心肠"
    ],
    "one_line": "脾气暴躁的丈夫，与妻子争吵不断却深爱对方，传授夫妻刀法"
  },
  {
    "id": "char_ren_fei_yan",
    "name": "任飞燕",
    "role": "重要",
    "identity": "林玉龙之妻，擅弹弓和单刀",
    "faction": null,
    "personality": [
      "泼辣能干",
      "心直口快",
      "侠义心肠"
    ],
    "one_line": "泼辣能干的妻子，弹弓百发百中，与丈夫争吵不断却深爱对方"
  },
  {
    "id": "char_xiao_yao_zi",
    "name": "逍遥子",
    "role": "重要",
    "identity": "太岳四侠之首",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "自命不凡",
      "义气深重",
      "好吹牛"
    ],
    "one_line": "太岳四侠老大，自称烟霞神龙，实则武功平平但义气深重"
  },
  {
    "id": "char_chang_chang_feng",
    "name": "常长风",
    "role": "重要",
    "identity": "太岳四侠之二，以墓碑为兵器",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "力大无穷",
      "卤莽冲动",
      "义气深重"
    ],
    "one_line": "太岳四侠老二，力大无穷以墓碑为兵器，号称双掌开碑"
  },
  {
    "id": "char_hua_jian_ying",
    "name": "花剑影",
    "role": "重要",
    "identity": "太岳四侠之三，使流星锤",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "好吹牛",
      "义气深重",
      "爱惜门牙"
    ],
    "one_line": "太岳四侠老三，使流星锤，号称流星赶月"
  },
  {
    "id": "char_gai_yi_ming",
    "name": "盖一鸣",
    "role": "重要",
    "identity": "太岳四侠之四，使峨嵋刺",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "好吹牛",
      "义气深重",
      "口若悬河"
    ],
    "one_line": "太岳四侠老四，外号最长却武功最差，义气深重"
  },
  {
    "id": "char_yuan_fu_ren",
    "name": "袁夫人",
    "role": "次要",
    "identity": "袁冠南母亲，萧半和大夫人",
    "faction": "faction_xiao_fu",
    "personality": [
      "慈祥和蔼",
      "深明大义",
      "坚韧不拔"
    ],
    "one_line": "袁冠南亲生母亲，十六年前被萧半和从天牢救出"
  },
  {
    "id": "char_yang_fu_ren",
    "name": "杨夫人",
    "role": "次要",
    "identity": "萧中慧母亲，萧半和二夫人",
    "faction": "faction_xiao_fu",
    "personality": [
      "慈爱",
      "温和",
      "深明大义"
    ],
    "one_line": "萧中慧亲生母亲，三湘大侠杨伯冲之妻"
  },
  {
    "id": "char_liu_yu_yi",
    "name": "刘于义",
    "role": "龙套",
    "identity": "川陕总督，奉旨护送鸳鸯刀",
    "faction": "faction_chuan_shan_dong_du_fu",
    "personality": [
      "狡猾多智",
      "老谋深算",
      "贪生怕死"
    ],
    "one_line": "川陕总督，奉旨护送鸳鸯刀进京，狡猾多智"
  },
  {
    "id": "char_wang_de_rong",
    "name": "汪德荣",
    "role": "龙套",
    "identity": "西安府大盐商，托保十万两银子",
    "faction": null,
    "personality": [
      "胆小怕事",
      "贪生怕死"
    ],
    "one_line": "大盐商，托保十万两银子，屁股中了周威信一箭"
  },
  {
    "id": "char_zhang_biao_shi",
    "name": "张镖师",
    "role": "龙套",
    "identity": "威信镖局镖师",
    "faction": "faction_wei_xin_biao_ju",
    "personality": [
      "好喝酒",
      "大嘴巴",
      "自以为是"
    ],
    "one_line": "威信镖局镖师，好喝酒，泄露鸳鸯刀秘密"
  },
  {
    "id": "char_yu_biao_shi",
    "name": "詹镖师",
    "role": "龙套",
    "identity": "威信镖局镖师",
    "faction": "faction_wei_xin_biao_ju",
    "personality": [
      "忠诚",
      "勇敢"
    ],
    "one_line": "威信镖局镖师，与张镖师一起护送鸳鸯刀"
  }
]

### factions.json (5 条)
[
  {
    "id": "faction_wei_xin_biao_ju",
    "name": "威信镖局",
    "type": "帮派",
    "location": "loc_xi_an_fu",
    "one_line": "西安府镖局，总镖头周威信受命护送鸳鸯刀进京"
  },
  {
    "id": "faction_tai_yue_si_xia",
    "name": "太岳四侠",
    "type": "帮派",
    "location": null,
    "one_line": "四个自称侠客的乌合之众，义气深重却武功平平"
  },
  {
    "id": "faction_xiao_fu",
    "name": "萧府",
    "type": "家族",
    "location": "loc_jin_yang",
    "one_line": "晋阳萧半和府邸，实为反清义士据点"
  },
  {
    "id": "faction_qing_gong_shi_wei",
    "name": "清宫侍卫",
    "type": "官署",
    "location": null,
    "one_line": "清廷皇宫侍卫，大内七大高手为其翘楚，卓天雄为其之首"
  },
  {
    "id": "faction_chuan_shan_dong_du_fu",
    "name": "川陕总督府",
    "type": "官署",
    "location": "loc_xi_an_fu",
    "one_line": "川陕总督刘于义的官署"
  }
]

### locations.json (8 条)
[
  {
    "id": "loc_xi_an_fu",
    "name": "西安府",
    "region": "陕西",
    "one_line": "威信镖局所在地，鸳鸯刀护送起点"
  },
  {
    "id": "loc_guan_shui_zhen",
    "name": "官水镇",
    "region": "晋州西南",
    "one_line": "汾酒产地，萧中慧偷听鸳鸯刀秘密之处"
  },
  {
    "id": "loc_fen_an_ke_dian",
    "name": "汾安客店",
    "region": "官水镇",
    "one_line": "官水镇客店，萧中慧偷听镖师谈话之处"
  },
  {
    "id": "loc_zao_xiang_lin",
    "name": "枣香林",
    "region": "晋州",
    "one_line": "林玉龙任飞燕夫妇追打之处"
  },
  {
    "id": "loc_zi_zhu_an",
    "name": "紫竹庵",
    "region": "荒山",
    "one_line": "荒山尼庵，袁冠南萧中慧学习夫妻刀法击退卓天雄之处"
  },
  {
    "id": "loc_jin_yang",
    "name": "晋阳",
    "region": "山西",
    "one_line": "萧半和府邸所在地，五十寿诞举办之处"
  },
  {
    "id": "loc_xiao_fu",
    "name": "萧府",
    "region": "晋阳",
    "one_line": "萧半和府邸，寿诞举办之处，官兵围剿之处"
  },
  {
    "id": "loc_zhong_tiao_shan",
    "name": "中条山",
    "region": "山西",
    "one_line": "萧半和等人退守之处，太岳四侠擒获卓天雄之处"
  }
]

### skills.json (5 条)
[
  {
    "id": "skill_hun_yuan_qi",
    "name": "混元气",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "须童子身方可修习的内功，婚后即散，极为珍贵"
  },
  {
    "id": "skill_zhen_tian_san_shi_zhang",
    "name": "震天三十掌",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "卓天雄成名绝技，掌力雄浑霸道"
  },
  {
    "id": "skill_hu_yan_shi_ba_bian",
    "name": "呼延十八鞭",
    "type": "奇门",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "北宋呼延赞所传鞭法，传世仅十七招，最后一招一鞭断十枪"
  },
  {
    "id": "skill_fu_qi_dao_fa",
    "name": "夫妻刀法",
    "type": "刀法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "古代恩爱夫妻所创的合璧刀法，双人配合方有威力"
  },
  {
    "id": "skill_tan_gong_shu",
    "name": "弹弓术",
    "type": "暗器",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "任飞燕成名绝技，连珠弹百发百中，更有回马弹高明手法"
  }
]

### techniques.json (8 条)
[
  {
    "id": "tech_tao_yuan_duo_shuo",
    "name": "桃园夺槊",
    "type": "attack",
    "source_skill": null
  },
  {
    "id": "tech_ye_chuang_san_zhai",
    "name": "夜闯三寨",
    "type": "defense",
    "source_skill": null
  },
  {
    "id": "tech_fen_hua_fu_liu_shi",
    "name": "分花拂柳式",
    "type": "attack",
    "source_skill": null
  },
  {
    "id": "tech_shi_zi_hui_shou",
    "name": "狮子回首",
    "type": "defense",
    "source_skill": null
  },
  {
    "id": "tech_ye_cha_tan_hai",
    "name": "夜叉探海",
    "type": "attack",
    "source_skill": null
  },
  {
    "id": "tech_tou_tian_huan_ri",
    "name": "偷天换日",
    "type": "defense",
    "source_skill": "skill_hu_yan_shi_ba_bian"
  },
  {
    "id": "tech_hui_ma_dan",
    "name": "回马弹",
    "type": "attack",
    "source_skill": null
  },
  {
    "id": "tech_lian_zhu_dan",
    "name": "连珠弹",
    "type": "attack",
    "source_skill": null
  }
]

### items.json (11 条)
[
  {
    "id": "item_yuan_yang_dao",
    "name": "鸳鸯刀",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "一短一长两把宝刀，刀中藏仁者无敌的大秘密"
  },
  {
    "id": "item_tie_bian",
    "name": "铁鞭",
    "type": "兵器",
    "owner": "char_zhou_wei_xin",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_hu_yan_shi_ba_bian"
    ],
    "one_line": "周威信的成名兵器，十六斤重的钢鞭"
  },
  {
    "id": "item_e_mei_ci",
    "name": "峨嵋刺",
    "type": "兵器",
    "owner": "char_gai_yi_ming",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "盖一鸣的兵器，一对峨嵋钢刺"
  },
  {
    "id": "item_liu_xing_chui",
    "name": "流星锤",
    "type": "兵器",
    "owner": "char_hua_jian_ying",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "花剑影的兵器，一对流星锤"
  },
  {
    "id": "item_mu_bei",
    "name": "墓碑",
    "type": "兵器",
    "owner": "char_chang_chang_feng",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "常长风的奇门兵器，顺手牵碑的大石碑"
  },
  {
    "id": "item_han_yan_guan",
    "name": "旱烟管",
    "type": "兵器",
    "owner": "char_xiao_yao_zi",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "逍遥子使用的精铁烟管，可作点穴兵器"
  },
  {
    "id": "item_dan_gong",
    "name": "弹弓",
    "type": "暗器",
    "owner": "char_ren_fei_yan",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "任飞燕的武器，连珠弹百发百中"
  },
  {
    "id": "item_shuai_shou_jian",
    "name": "甩手箭",
    "type": "暗器",
    "owner": "char_zhou_wei_xin",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "周威信使用的暗器，一枝甩手箭"
  },
  {
    "id": "item_jin_chai",
    "name": "金钗",
    "type": "饰品",
    "owner": "char_xiao_zhong_hui",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "萧中慧头上金钗，明珠价值连城，后作为寿礼送回"
  },
  {
    "id": "item_fei_cu_shou_gao",
    "name": "腐骨穿心膏",
    "type": "毒药",
    "owner": null,
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "袁冠南虚构的假毒药，吓退卓天雄"
  },
  {
    "id": "item_yu_shi_zi",
    "name": "翡翠狮子",
    "type": "信物",
    "owner": "char_yuan_guan_nan",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "袁冠南佩戴的翡翠狮子，母子相认的信物"
  }
]

### dialogues.json (前 15 条 / 共 15 条)
[
  {
    "index": 0,
    "speaker": "char_gai_yi_ming",
    "speaker_name": "盖一鸣",
    "listener": null,
    "text": "咱大哥是烟霞神龙逍遥子，二哥是双掌开碑常长风，三哥是流星赶月花剑影，区区在下是八步赶蟾、赛专诸、踏雪无痕、独脚水上飞、双刺盖七省盖一鸣！",
    "tone": "激动",
    "chapter": 1,
    "line_start": 32,
    "line_end": 32
  },
  {
    "index": 1,
    "speaker": "char_xiao_yao_zi",
    "speaker_name": "逍遥子",
    "listener": "char_gai_yi_ming",
    "text": "没事，没事！咱们好汉敌不过人多，算不了什么。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 60,
    "line_end": 60
  },
  {
    "index": 2,
    "speaker": "char_gai_yi_ming",
    "speaker_name": "盖一鸣",
    "listener": "char_xiao_yao_zi",
    "text": "大哥料事如神，言之有理。",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 30,
    "line_end": 30
  },
  {
    "index": 3,
    "speaker": "char_xiao_zhong_hui",
    "speaker_name": "萧中慧",
    "listener": "char_gai_yi_ming",
    "text": "你们要留下我马儿，还不是欺侮我吗？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 102,
    "line_end": 102
  },
  {
    "index": 4,
    "speaker": "char_xiao_zhong_hui",
    "speaker_name": "萧中慧",
    "listener": "char_xiao_yao_zi",
    "text": "呔！好大胆的毛贼，四个儿一齐上吧！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 106,
    "line_end": 106
  },
  {
    "index": 5,
    "speaker": "char_gai_yi_ming",
    "speaker_name": "盖一鸣",
    "listener": "char_xiao_zhong_hui",
    "text": "我太岳四侠义结金兰，不求同年同月同日生，但愿同年同月同日死。姑娘杀我大哥，我兄弟三人不愿独生，便请姑娘一齐杀了。有谁皱一皱眉头，不算好汉！",
    "tone": "激动",
    "chapter": 1,
    "line_start": 120,
    "line_end": 120
  },
  {
    "index": 6,
    "speaker": "char_yuan_guan_nan",
    "speaker_name": "袁冠南",
    "listener": null,
    "text": "小可姓袁名冠南，区区小事，何足挂齿？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 172,
    "line_end": 172
  },
  {
    "index": 7,
    "speaker": "char_zhuo_tian_xiong",
    "speaker_name": "卓天雄",
    "listener": null,
    "text": "我瞎子的贱名，叫做卓天雄。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 172,
    "line_end": 172
  },
  {
    "index": 8,
    "speaker": "char_ren_fei_yan",
    "speaker_name": "任飞燕",
    "listener": "char_xiao_zhong_hui",
    "text": "哈哈，大姑娘，等你嫁了男人，就明白啦。夫妻不打架，那还叫什么夫妻？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 9,
    "speaker": "char_lin_yu_long",
    "speaker_name": "林玉龙",
    "listener": "char_ren_fei_yan",
    "text": "他妈的，这算什么夫妻？定然路道不正！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 10,
    "speaker": "char_zhuo_tian_xiong",
    "speaker_name": "卓天雄",
    "listener": "char_zhou_wei_xin",
    "text": "呼延十八鞭最后一招，你没学会吧？",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 250,
    "line_end": 250
  },
  {
    "index": 11,
    "speaker": "char_zhuo_tian_xiong",
    "speaker_name": "卓天雄",
    "listener": "char_yuan_guan_nan",
    "text": "五毒圣姑是你何人？",
    "tone": "恐惧",
    "chapter": 1,
    "line_start": 284,
    "line_end": 284
  },
  {
    "index": 12,
    "speaker": "char_yuan_guan_nan",
    "speaker_name": "袁冠南",
    "listener": "char_zhuo_tian_xiong",
    "text": "五毒圣姑是我姑母，你问她怎的？",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 286,
    "line_end": 286
  },
  {
    "index": 13,
    "speaker": "char_xiao_ban_he",
    "speaker_name": "萧半和",
    "listener": null,
    "text": "承江湖上朋友们瞧得起，我萧义在武林中还算是一号人物。可是有谁知道，我萧义是个太监。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 444,
    "line_end": 444
  },
  {
    "index": 14,
    "speaker": "char_xiao_ban_he",
    "speaker_name": "萧半和",
    "listener": null,
    "text": "我细细思量，要练到父亲和这七位伯叔一样的功夫，便竭一生之力也未必能够，便算练成了，也未必能报得了血海深仇，于是我甘心净身，去做一个低三下四、为人人瞧不起的太监。",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 448,
    "line_end": 448
  }
]

### chapter_summaries.json (1 条)
[
  {
    "chapter": 1,
    "title": "鸳鸯刀",
    "key_events": [
      "太岳四侠拦截镖队",
      "萧中慧偷听鸳鸯刀秘密",
      "袁冠南假毒药吓退卓天雄",
      "萧中慧盗走鸯刀",
      "夫妻刀法首次合璧击退卓天雄",
      "袁冠南与母亲相认",
      "萧半和揭露太监身份",
      "萧中慧得知是兄妹后出走",
      "太岳四侠生擒卓天雄",
      "仁者无敌大秘密揭晓"
    ],
    "key_characters": [
      "char_zhou_wei_xin",
      "char_zhuo_tian_xiong",
      "char_xiao_yao_zi",
      "char_chang_chang_feng",
      "char_hua_jian_ying",
      "char_gai_yi_ming",
      "char_xiao_zhong_hui",
      "char_yuan_guan_nan",
      "char_lin_yu_long",
      "char_ren_fei_yan",
      "char_xiao_ban_he"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
