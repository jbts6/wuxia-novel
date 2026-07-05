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

### characters.json (4 条)
[
  {
    "id": "char_chen_jia_luo",
    "name": "陈家洛",
    "role": "核心",
    "faction": "faction_hong_hua_hui",
    "personality": [
      "武功高强",
      "重情重义",
      "为反清复明奋斗"
    ],
    "one_line": "红花会总舵主，乾隆皇帝的亲弟弟"
  },
  {
    "id": "char_qian_long",
    "name": "乾隆",
    "role": "核心",
    "faction": "faction_qing_court",
    "personality": [
      "武功高强",
      "重情重义",
      "与陈家洛为敌"
    ],
    "one_line": "清朝皇帝，陈家洛的亲哥哥"
  },
  {
    "id": "char_xiang_ting",
    "name": "香香公主",
    "role": "重要",
    "faction": null,
    "personality": [
      "美丽善良",
      "重情重义",
      "为爱牺牲"
    ],
    "one_line": "回族美女，陈家洛的恋人"
  },
  {
    "id": "char_zhang_zhao_chong",
    "name": "张召重",
    "role": "重要",
    "faction": "faction_qing_court",
    "personality": [
      "武功高强",
      "与红花会为敌"
    ],
    "one_line": "清廷高手，与红花会为敌"
  }
]

### factions.json (2 条)
[
  {
    "id": "faction_hong_hua_hui",
    "name": "红花会",
    "type": "帮派",
    "location": "loc_jiang_nan",
    "one_line": "反清复明的江湖帮会"
  },
  {
    "id": "faction_qing_court",
    "name": "清廷",
    "type": "官署",
    "location": "loc_beijing",
    "one_line": "清朝朝廷"
  }
]

### locations.json (2 条)
[
  {
    "id": "loc_jiang_nan",
    "name": "江南",
    "region": "中原",
    "one_line": "红花会的活动区域"
  },
  {
    "id": "loc_beijing",
    "name": "北京",
    "region": "京师",
    "one_line": "清朝都城"
  }
]

### skills.json (2 条)
[
  {
    "id": "skill_hong_hua_hui_wu_gong",
    "name": "红花会武功",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_chen_jia_luo",
      "char_wu_hai",
      "char_wu_jian"
    ],
    "one_line": "红花会的武功体系"
  },
  {
    "id": "skill_qing_court_wu_gong",
    "name": "清廷武功",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_zhang_zhao_chong"
    ],
    "one_line": "清廷的武功体系"
  }
]

### techniques.json (0 条)
[]

### items.json (1 条)
[
  {
    "id": "item_hong_hua_hui_xin_wu",
    "name": "红花会信物",
    "type": "信物",
    "owner": "faction_hong_hua_hui",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "红花会的信物"
  }
]

### dialogues.json (前 1 条 / 共 1 条)
[
  {
    "index": 0,
    "speaker": "char_chen_jia_luo",
    "listener": "char_qian_long",
    "text": "乾隆，你虽然是皇帝，但你也是我的亲哥哥！",
    "tone": "激动",
    "chapter": 1,
    "line_start": 100,
    "line_end": 100
  }
]

### chapter_summaries.json (5 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      "陈家洛出场",
      "红花会与清廷的斗争开始"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_qian_long"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      "陈家洛与香香公主相遇",
      "两人相爱"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_xiang_ting"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      "红花会与清廷的斗争加剧"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_zhang_zhao_chong"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      "陈家洛与乾隆的对峙"
    ],
    "key_characters": [
      "char_chen_jia_luo",
      "char_qian_long"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      "香香公主为陈家洛牺牲"
    ],
    "key_characters": [
      "char_xiang_ting",
      "char_chen_jia_luo"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
