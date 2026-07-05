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

### characters.json (8 条)
[
  {
    "id": "char_hu_fei",
    "name": "胡斐",
    "role": "核心",
    "faction": "faction_hu_family",
    "personality": [
      "武功高强",
      "重情重义",
      "复仇心切"
    ],
    "one_line": "胡一刀之子，外号雪山飞狐，武功高强"
  },
  {
    "id": "char_miao_ren_feng",
    "name": "苗人凤",
    "role": "核心",
    "faction": "faction_miao_family",
    "personality": [
      "武功高强",
      "重情重义",
      "复仇心切"
    ],
    "one_line": "武林高手，外号打遍天下无敌手，与胡一刀有深仇"
  },
  {
    "id": "char_hu_yi_dao",
    "name": "胡一刀",
    "role": "重要",
    "faction": "faction_hu_family",
    "personality": [
      "武功高强",
      "重情重义",
      "已故"
    ],
    "one_line": "胡斐之父，与苗人凤有深仇，已故"
  },
  {
    "id": "char_cao_yun_qi",
    "name": "曹云奇",
    "role": "重要",
    "faction": "faction_tian_long_men",
    "personality": [
      "武功高强",
      "重情重义",
      "追杀胡斐"
    ],
    "one_line": "天龙门北宗掌门人，武功高强"
  },
  {
    "id": "char_yin_ji",
    "name": "殷吉",
    "role": "重要",
    "faction": "faction_tian_long_men",
    "personality": [
      "武功高强",
      "重情重义",
      "追杀胡斐"
    ],
    "one_line": "天龙门南宗掌门人，武功高强"
  },
  {
    "id": "char_miao_ruo_lan",
    "name": "苗若兰",
    "role": "重要",
    "faction": "faction_miao_family",
    "personality": [
      "美丽",
      "善良",
      "重情重义"
    ],
    "one_line": "苗人凤之女，与胡斐相爱"
  },
  {
    "id": "char_ruan_shi_zhong",
    "name": "阮士中",
    "role": "次要",
    "faction": "faction_tian_long_men",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "天龙门北宗高手，外号七星手"
  },
  {
    "id": "char_zhou_yun_yang",
    "name": "周云阳",
    "role": "次要",
    "faction": "faction_tian_long_men",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "天龙门北宗高手，外号回龙剑"
  }
]

### factions.json (3 条)
[
  {
    "id": "faction_tian_long_men",
    "name": "天龙门",
    "type": "武林门派",
    "location": "loc_tian_long_men",
    "one_line": "以剑法著称的武林门派，分南北两宗"
  },
  {
    "id": "faction_miao_family",
    "name": "苗家",
    "type": "家族",
    "location": "loc_miao_family",
    "one_line": "苗人凤的家族，与胡一刀有深仇"
  },
  {
    "id": "faction_hu_family",
    "name": "胡家",
    "type": "家族",
    "location": "loc_hu_family",
    "one_line": "胡一刀的家族，与苗家有深仇"
  }
]

### locations.json (4 条)
[
  {
    "id": "loc_tian_long_men",
    "name": "天龙门",
    "region": "中原",
    "one_line": "天龙门的总部所在地"
  },
  {
    "id": "loc_miao_family",
    "name": "苗家",
    "region": "关外",
    "one_line": "苗人凤的家族所在地"
  },
  {
    "id": "loc_hu_family",
    "name": "胡家",
    "region": "关外",
    "one_line": "胡一刀的家族所在地"
  },
  {
    "id": "loc_yu_bi_feng",
    "name": "玉笔峰",
    "region": "关外",
    "one_line": "胡斐与苗人凤对决的地点"
  }
]

### skills.json (3 条)
[
  {
    "id": "skill_tian_long_jian",
    "name": "天龙剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [
      "char_cao_yun_qi",
      "char_yin_ji"
    ],
    "one_line": "天龙门的镇派剑法"
  },
  {
    "id": "skill_hu_jia_dao_fa",
    "name": "胡家刀法",
    "type": "刀法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_hu_yi_dao",
      "char_hu_fei"
    ],
    "one_line": "胡家的祖传刀法，威力强大"
  },
  {
    "id": "skill_miao_jia_jian_fa",
    "name": "苗家剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_miao_ren_feng"
    ],
    "one_line": "苗家的祖传剑法，与胡家刀法齐名"
  }
]

### techniques.json (0 条)
[]

### items.json (2 条)
[
  {
    "id": "item_hu_jia_dao",
    "name": "胡家刀",
    "type": "兵器",
    "owner": "char_hu_fei",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_hu_jia_dao_fa"
    ],
    "one_line": "胡家的祖传宝刀"
  },
  {
    "id": "item_miao_jia_jian",
    "name": "苗家剑",
    "type": "兵器",
    "owner": "char_miao_ren_feng",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_miao_jia_jian_fa"
    ],
    "one_line": "苗家的祖传宝剑"
  }
]

### dialogues.json (前 5 条 / 共 5 条)
[
  {
    "index": 0,
    "speaker": "char_cao_yun_qi",
    "listener": "char_hu_fei",
    "text": "喂，相好的，停步！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 1,
    "speaker": "char_hu_fei",
    "listener": "char_cao_yun_qi",
    "text": "看箭！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 28,
    "line_end": 28
  },
  {
    "index": 2,
    "speaker": "char_miao_ren_feng",
    "listener": "char_hu_fei",
    "text": "胡斐，你父亲当年害死了我全家，今日我要你血债血偿！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 2300,
    "line_end": 2300
  },
  {
    "index": 3,
    "speaker": "char_hu_fei",
    "listener": "char_miao_ren_feng",
    "text": "苗人凤，你当年害死了我父亲，今日我要为父报仇！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 2305,
    "line_end": 2305
  },
  {
    "index": 4,
    "speaker": "char_miao_ruo_lan",
    "listener": "char_hu_fei",
    "text": "胡斐，你不要伤害我爹爹！",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 2310,
    "line_end": 2310
  }
]

### chapter_summaries.json (10 条)
[
  {
    "chapter": 1,
    "title": "一",
    "key_events": [
      "曹云奇追杀胡斐",
      "众人讲述胡一刀与苗人凤的恩怨",
      "胡斐的身世揭秘"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_cao_yun_qi",
      "char_yin_ji"
    ]
  },
  {
    "chapter": 2,
    "title": "二",
    "key_events": [
      "胡一刀与苗人凤的故事",
      "胡斐的成长经历"
    ],
    "key_characters": [
      "char_hu_yi_dao",
      "char_miao_ren_feng",
      "char_hu_fei"
    ]
  },
  {
    "chapter": 3,
    "title": "三",
    "key_events": [
      "胡一刀与苗人凤的决斗",
      "胡一刀之死"
    ],
    "key_characters": [
      "char_hu_yi_dao",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 4,
    "title": "四",
    "key_events": [
      "胡一刀与苗人凤的恩怨",
      "胡斐的复仇之路"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 5,
    "title": "五",
    "key_events": [
      "胡斐的成长经历",
      "胡斐与苗若兰的相遇"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ruo_lan"
    ]
  },
  {
    "chapter": 6,
    "title": "六",
    "key_events": [
      "胡斐与苗若兰的爱情故事",
      "胡斐的复仇计划"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ruo_lan"
    ]
  },
  {
    "chapter": 7,
    "title": "七",
    "key_events": [
      "胡斐与苗人凤在玉笔峰对决",
      "故事留下悬念"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 8,
    "title": "八",
    "key_events": [
      "胡斐与苗人凤的对决",
      "故事的结局"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 9,
    "title": "九",
    "key_events": [
      "胡斐与苗人凤的最终对决",
      "故事的结局"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 10,
    "title": "十",
    "key_events": [
      "胡斐与苗人凤的对决留下悬念",
      "苗若兰等待胡斐归来"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ren_feng",
      "char_miao_ruo_lan"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
