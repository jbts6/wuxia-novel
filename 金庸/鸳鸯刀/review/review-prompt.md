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

### characters.json (16 条)
[
  {
    "id": "char_xiao_ban_he",
    "name": "萧半和",
    "role": "核心",
    "identity": "晋阳大侠，实为清廷太监卧底十六年",
    "faction": null,
    "personality": [
      "义薄云天",
      "深谋远虑",
      "幽默豁达"
    ],
    "one_line": "晋阳大侠实为太监萧义，十六年卧薪尝胆，为救袁杨二夫人后隐姓埋名"
  },
  {
    "id": "char_zhou_wei_xin",
    "name": "周威信",
    "role": "重要",
    "identity": "威信镖局总镖头，护送鸳鸯刀进京",
    "faction": "faction_wei_xin_biao_ju",
    "personality": [
      "谨慎多疑",
      "老谋深算",
      "贪生怕死"
    ],
    "one_line": "威信镖局总镖头，受命暗中护送鸳鸯刀进京，胆小谨慎又好面子"
  },
  {
    "id": "char_zhuo_tian_xiong",
    "name": "卓天雄",
    "role": "重要",
    "identity": "清廷大内七大高手之首，假扮瞎子追踪鸳鸯刀",
    "faction": null,
    "personality": [
      "城府极深",
      "武功卓绝",
      "老奸巨猾"
    ],
    "one_line": "清廷第一高手，精通震天三十掌与呼延十八鞭，假扮盲人追踪鸳鸯刀"
  },
  {
    "id": "char_xiao_yao_zi",
    "name": "逍遥子",
    "role": "次要",
    "identity": "太岳四侠之首，烟霞神龙",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "自命不凡",
      "虚张声势",
      "讲义气"
    ],
    "one_line": "太岳四侠排行老大，手持旱烟管点穴，武功平平却自视甚高"
  },
  {
    "id": "char_chang_chang_feng",
    "name": "常长风",
    "role": "次要",
    "identity": "太岳四侠排行老二，力大无穷",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "力大无穷",
      "鲁莽直率",
      "讲义气"
    ],
    "one_line": "太岳四侠老二，力大无穷以墓碑为兵器，性格鲁莽直率"
  },
  {
    "id": "char_hua_jian_ying",
    "name": "花剑影",
    "role": "次要",
    "identity": "太岳四侠排行老三，擅长流星锤",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "好面子",
      "好奇心重",
      "讲义气"
    ],
    "one_line": "太岳四侠老三，使一对流星锤，白净脸皮牙齿外凸"
  },
  {
    "id": "char_gai_yi_ming",
    "name": "盖一鸣",
    "role": "次要",
    "identity": "太岳四侠排行老四，外号最长",
    "faction": "faction_tai_yue_si_xia",
    "personality": [
      "话多嘴碎",
      "虚张声势",
      "讲义气"
    ],
    "one_line": "太岳四侠老四，短小精悍使一对峨嵋刺，外号极长却武功平平"
  },
  {
    "id": "char_xiao_zhong_hui",
    "name": "萧中慧",
    "role": "核心",
    "identity": "萧半和养女，三湘大侠杨伯冲之女",
    "faction": null,
    "personality": [
      "聪明伶俐",
      "侠义心肠",
      "勇敢冲动"
    ],
    "one_line": "晋阳大侠之女，与袁冠南互生情愫后发现实为同母异父兄妹"
  },
  {
    "id": "char_yuan_guan_nan",
    "name": "袁冠南",
    "role": "核心",
    "identity": "少年书生，袁夫人失散十六年的儿子",
    "faction": null,
    "personality": [
      "风流倜傥",
      "足智多谋",
      "侠义心肠"
    ],
    "one_line": "文武双全的少年书生，用毛笔墨盒作兵器，与萧中慧互生情愫"
  },
  {
    "id": "char_lin_yu_long",
    "name": "林玉龙",
    "role": "次要",
    "identity": "使单刀的江湖汉子，任飞燕之夫",
    "faction": null,
    "personality": [
      "暴躁鲁莽",
      "嗓门大",
      "重情重义"
    ],
    "one_line": "性格暴躁的江湖汉子，与妻子任飞燕终日吵闹却恩爱如初"
  },
  {
    "id": "char_ren_fei_yan",
    "name": "任飞燕",
    "role": "次要",
    "identity": "林玉龙之妻，擅长弹弓",
    "faction": null,
    "personality": [
      "泼辣直爽",
      "弹弓了得",
      "刀法狡谲"
    ],
    "one_line": "林玉龙之妻，弹弓百发百中，刀法狡谲与丈夫争吵不休"
  },
  {
    "id": "char_zhang_biao_shi",
    "name": "张镖师",
    "role": "龙套",
    "identity": "威信镖局镖师",
    "faction": "faction_wei_xin_biao_ju",
    "personality": [
      "鲁莽冲动",
      "爱吹嘘",
      "自以为是"
    ],
    "one_line": "威信镖局镖师，性格鲁莽爱吹嘘"
  },
  {
    "id": "char_yuan_fu_ren",
    "name": "袁夫人",
    "role": "次要",
    "identity": "袁冠南之母，原为钦犯",
    "faction": null,
    "personality": [
      "慈爱",
      "坚韧",
      "端庄"
    ],
    "one_line": "袁冠南失散十六年的母亲，小指生有支指为相认凭证"
  },
  {
    "id": "char_yang_fu_ren",
    "name": "杨夫人",
    "role": "次要",
    "identity": "萧中慧亲生母亲，三湘大侠杨伯冲之妻",
    "faction": null,
    "personality": [
      "慈爱",
      "温柔",
      "持重"
    ],
    "one_line": "萧中慧亲生母亲，三湘大侠杨伯冲之妻"
  },
  {
    "id": "char_liu_yu_yi",
    "name": "刘于义",
    "role": "重要",
    "identity": "川陕总督，奉皇帝密旨追查鸳鸯刀",
    "faction": null,
    "personality": [
      "狡猾多智",
      "老谋深算",
      "心狠手辣"
    ],
    "one_line": "川陕总督，得到鸳鸯刀后派周威信护送进京"
  },
  {
    "id": "char_wang_de_rong",
    "name": "汪德荣",
    "role": "龙套",
    "identity": "西安府大盐商，托保十万两镖银",
    "faction": null,
    "personality": [
      "胆小怕事",
      "贪生怕死",
      "有钱无势"
    ],
    "one_line": "西安大盐商，托保镖银后随队押运，被误伤"
  }
]

### factions.json (2 条)
[
  {
    "id": "faction_tai_yue_si_xia",
    "name": "太岳四侠",
    "type": "帮派",
    "location": "晋州一带",
    "one_line": "四名自封侠客的江湖散人，劫富济贫却常闹笑话"
  },
  {
    "id": "faction_wei_xin_biao_ju",
    "name": "威信镖局",
    "type": "帮派",
    "location": "陕西西安府",
    "one_line": "西安府知名镖局，总镖头周威信号称铁鞭镇八方"
  }
]

### locations.json (8 条)
[
  {
    "id": "loc_xi_an",
    "name": "西安府",
    "region": "陕西",
    "one_line": "威信镖局所在地，镖队从此出发护送鸳鸯刀进京"
  },
  {
    "id": "loc_zao_xiang_lin",
    "name": "枣香林",
    "region": "晋州",
    "one_line": "太岳四侠拦截镖队的松林，激战发生之地"
  },
  {
    "id": "loc_guan_shui_zhen",
    "name": "官水镇",
    "region": "晋州西南",
    "one_line": "汾酒产地小镇，镖队在此歇脚"
  },
  {
    "id": "loc_fen_an_ke_dian",
    "name": "汾安客店",
    "region": "官水镇",
    "one_line": "镖队投宿的客店，多方势力交汇之地"
  },
  {
    "id": "loc_mu_di",
    "name": "荒凉墓地",
    "region": "晋州",
    "one_line": "林玉龙夫妇追逐至此，萧中慧误入战场"
  },
  {
    "id": "loc_zi_zhu_an",
    "name": "紫竹庵",
    "region": "晋州西北荒山",
    "one_line": "尼姑庵，众人躲避卓天雄追杀的藏身之处"
  },
  {
    "id": "loc_xiao_fu",
    "name": "萧府",
    "region": "晋阳",
    "one_line": "萧半和的宅邸，五十寿诞与鸳鸯刀决战之地"
  },
  {
    "id": "loc_tiao_shan",
    "name": "中条山",
    "region": "晋南",
    "one_line": "萧半和率众人退守的大山"
  }
]

### skills.json (4 条)
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
    "type": "奇门兵器",
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
  }
]

### techniques.json (8 条)
[
  {
    "id": "tech_tao_yuan_duo_shuo",
    "name": "桃园夺槊",
    "type": "defense",
    "source_skill": "skill_hu_yan_shi_ba_bian"
  },
  {
    "id": "tech_ye_chuan_san_zhai",
    "name": "夜闯三寨",
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
    "id": "tech_heng_sao_qian_jun",
    "name": "横扫千军",
    "type": "attack",
    "source_skill": "skill_hu_yan_shi_ba_bian"
  },
  {
    "id": "tech_tou_tian_huan_ri",
    "name": "偷天换日",
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
  }
]

### items.json (9 条)
[
  {
    "id": "item_yuan_yang_dao",
    "name": "鸳鸯刀",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "绝世神兵",
    "related_skills": [],
    "one_line": "一短一长两把宝刀，刀中藏仁者无敌的大秘密"
  },
  {
    "id": "item_tie_bian",
    "name": "铁鞭",
    "type": "兵器",
    "owner": "char_zhou_wei_xin",
    "rarity_tier": "上乘佳品",
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
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "盖一鸣的兵器，一对峨嵋钢刺"
  },
  {
    "id": "item_liu_xing_chui",
    "name": "流星锤",
    "type": "兵器",
    "owner": "char_hua_jian_ying",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "花剑影的兵器，一对流星锤"
  },
  {
    "id": "item_mu_bei",
    "name": "墓碑",
    "type": "兵器",
    "owner": "char_chang_chang_feng",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "常长风的奇门兵器，顺手牵碑的大石碑"
  },
  {
    "id": "item_han_yan_guan",
    "name": "旱烟管",
    "type": "兵器",
    "owner": "char_zhuo_tian_xiong",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_zhen_tian_san_shi_zhang"
    ],
    "one_line": "卓天雄假扮逍遥子时使用的精铁烟管，可作点穴兵器"
  },
  {
    "id": "item_dan_gong",
    "name": "弹弓",
    "type": "暗器",
    "owner": "char_ren_fei_yan",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "任飞燕的武器，连珠弹百发百中"
  },
  {
    "id": "item_shuai_shou_jian",
    "name": "甩手箭",
    "type": "暗器",
    "owner": "char_zhou_wei_xin",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "周威信使用的暗器，一枝甩手箭"
  },
  {
    "id": "item_jin_chai",
    "name": "金钗",
    "type": "饰品",
    "owner": "char_xiao_zhong_hui",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "萧中慧头上金钗，明珠价值连城，后作为寿礼送回"
  }
]

### dialogues.json (前 17 条 / 共 17 条)
[
  {
    "index": 0,
    "speaker": "char_zhou_wei_xin",
    "speaker_name": "周威信",
    "listener": null,
    "text": "江湖上有言道：'小心天下去得，莽撞寸步难行。'",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 26,
    "line_end": 26
  },
  {
    "index": 1,
    "speaker": "char_gai_yi_ming",
    "speaker_name": "盖一鸣",
    "listener": "char_zhou_wei_xin",
    "text": "我大哥给你改了个匪号，叫作'铁鞭拜八方'！我大哥料事如神，言之有理。",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 30,
    "line_end": 30
  },
  {
    "index": 2,
    "speaker": "char_gai_yi_ming",
    "speaker_name": "盖一鸣",
    "listener": "char_zhou_wei_xin",
    "text": "咱大哥是烟霞神龙逍遥子，二哥是双掌开碑常长风，三哥是流星赶月花剑影，区区在下是八步赶蟾、赛专诸、踏雪无痕、独脚水上飞、双刺盖七省盖一鸣！",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 32,
    "line_end": 32
  },
  {
    "index": 3,
    "speaker": "char_xiao_yao_zi",
    "speaker_name": "逍遥子",
    "listener": null,
    "text": "我们不欺侮你，只欺侮你的坐骑。一头畜牲，算得什么？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 102,
    "line_end": 102
  },
  {
    "index": 4,
    "speaker": "char_xiao_zhong_hui",
    "speaker_name": "萧中慧",
    "listener": "char_gai_yi_ming",
    "text": "你都瞧了我七八眼啦，还说一眼也不多瞧呢？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 100,
    "line_end": 100
  },
  {
    "index": 5,
    "speaker": "char_xiao_zhong_hui",
    "speaker_name": "萧中慧",
    "listener": "char_gai_yi_ming",
    "text": "咱们既然互不相识，若有得罪，爹爹便不能怪我。呔！好大胆的毛贼，四个儿一齐上吧！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 106,
    "line_end": 106
  },
  {
    "index": 6,
    "speaker": "char_xiao_yao_zi",
    "speaker_name": "逍遥子",
    "listener": "char_xiao_zhong_hui",
    "text": "这是'中渎穴'，点之腿膝麻痹，四肢软瘫，还不给我束手待缚？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 112,
    "line_end": 112
  },
  {
    "index": 7,
    "speaker": "char_xiao_zhong_hui",
    "speaker_name": "萧中慧",
    "listener": "char_xiao_yao_zi",
    "text": "痨病鬼，你点的是什么穴？中渎穴不在这里，偏左了两寸。",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 112,
    "line_end": 112
  },
  {
    "index": 8,
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
    "index": 9,
    "speaker": "char_zhang_biao_shi",
    "speaker_name": "张镖师",
    "listener": "char_zhou_wei_xin",
    "text": "每天晚上你睡着了，便尽说梦话，翻来覆去总是说：'鸳鸯刀，鸳鸯刀！这一次送去北京，可不能出半点岔子，得了鸳鸯刀，无敌于天下⋯⋯'",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 138,
    "line_end": 138
  },
  {
    "index": 10,
    "speaker": "char_ren_fei_yan",
    "speaker_name": "任飞燕",
    "listener": "char_xiao_zhong_hui",
    "text": "等你嫁了男人，就明白啦。夫妻不打架，那还叫什么夫妻？有道是床头打架床尾和，你见过不吵嘴不打架的夫妻没有？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 11,
    "speaker": "char_lin_yu_long",
    "speaker_name": "林玉龙",
    "listener": "char_xiao_zhong_hui",
    "text": "他妈的，不动刀子不拌嘴，算是什么夫妻？",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 12,
    "speaker": "char_yuan_guan_nan",
    "speaker_name": "袁冠南",
    "listener": "char_xiao_zhong_hui",
    "text": "小可见姑娘如此豪阔，意欲告贷几两盘缠之资！",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 176,
    "line_end": 176
  },
  {
    "index": 13,
    "speaker": "char_zhuo_tian_xiong",
    "speaker_name": "卓天雄",
    "listener": "char_yuan_guan_nan",
    "text": "姓袁的，这对刀便在这里，有本事不妨来拿去。你装腔作势，瞒得过别人，可乘早别在卓天雄眼前现世。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 264,
    "line_end": 266
  },
  {
    "index": 14,
    "speaker": "char_yuan_guan_nan",
    "speaker_name": "袁冠南",
    "listener": "char_zhuo_tian_xiong",
    "text": "好啊！小爷有好生之德，不愿用这'腐骨穿心膏'。你既无礼，说不得，只好叫你尝尝滋味。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 284,
    "line_end": 284
  },
  {
    "index": 15,
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
    "index": 16,
    "speaker": "char_yuan_fu_ren",
    "speaker_name": "袁夫人",
    "listener": null,
    "text": "满清皇帝听说这双刀之中，有一个能无敌于天下的大秘密，这果然不错，可是他便知道了这秘密，又能依着行么？各位请看！",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 466,
    "line_end": 466
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
