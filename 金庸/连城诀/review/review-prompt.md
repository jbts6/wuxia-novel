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

### characters.json (13 条)
[
  {
    "id": "char_di_yun",
    "name": "狄云",
    "role": "核心",
    "faction": "faction_xue_dao_sect",
    "personality": [
      "忠厚老实",
      "历经磨难",
      "重情重义"
    ],
    "one_line": "戚长发之徒，性格忠厚，历经磨难"
  },
  {
    "id": "char_qi_fang",
    "name": "戚芳",
    "role": "核心",
    "faction": null,
    "personality": [
      "美丽善良",
      "重情重义",
      "命运悲惨"
    ],
    "one_line": "戚长发之女，狄云的青梅竹马"
  },
  {
    "id": "char_ding_dian",
    "name": "丁典",
    "role": "重要",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义",
      "为爱牺牲"
    ],
    "one_line": "凌霜华的恋人，为爱牺牲"
  },
  {
    "id": "char_ling_shuang_hua",
    "name": "凌霜华",
    "role": "重要",
    "faction": null,
    "personality": [
      "美丽善良",
      "重情重义",
      "为爱牺牲"
    ],
    "one_line": "凌退思之女，丁典的恋人"
  },
  {
    "id": "char_qi_chang_fa",
    "name": "戚长发",
    "role": "重要",
    "faction": "faction_wan_zhen_shan",
    "personality": [
      "贪婪",
      "背叛",
      "心狠手辣"
    ],
    "one_line": "狄云的师父，为财宝背叛师门"
  },
  {
    "id": "char_wan_zhen_shan",
    "name": "万震山",
    "role": "重要",
    "faction": "faction_wan_zhen_shan",
    "personality": [
      "贪婪",
      "背叛",
      "心狠手辣"
    ],
    "one_line": "狄云的大师伯，为财宝杀害同门"
  },
  {
    "id": "char_wan_gui",
    "name": "万圭",
    "role": "重要",
    "faction": "faction_wan_zhen_shan",
    "personality": [
      "贪婪",
      "背叛",
      "心狠手辣"
    ],
    "one_line": "万震山之子，害死戚芳"
  },
  {
    "id": "char_shui_sheng",
    "name": "水笙",
    "role": "重要",
    "faction": null,
    "personality": [
      "美丽善良",
      "重情重义",
      "最终幸福"
    ],
    "one_line": "水岱之女，最终与狄云相遇"
  },
  {
    "id": "char_ling_tui_si",
    "name": "凌退思",
    "role": "重要",
    "faction": null,
    "personality": [
      "贪婪",
      "背叛",
      "心狠手辣"
    ],
    "one_line": "荆州知府，为财宝害死丁典和凌霜华"
  },
  {
    "id": "char_yan_da_ping",
    "name": "言达平",
    "role": "次要",
    "faction": "faction_wan_zhen_shan",
    "personality": [
      "贪婪",
      "背叛"
    ],
    "one_line": "狄云的二师伯，为财宝背叛师门"
  },
  {
    "id": "char_mei_nian_sheng",
    "name": "梅念笙",
    "role": "背景",
    "faction": null,
    "personality": [
      "武功高强"
    ],
    "one_line": "连城剑法的传人"
  },
  {
    "id": "char_wu_liu_qi",
    "name": "吴六奇",
    "role": "背景",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "天地会红旗香主"
  },
  {
    "id": "char_xue_dao_lao_zu",
    "name": "血刀老祖",
    "role": "次要",
    "faction": "faction_xue_dao_sect",
    "personality": [
      "武功高强",
      "心狠手辣"
    ],
    "one_line": "血刀门掌门人"
  }
]

### factions.json (2 条)
[
  {
    "id": "faction_wan_zhen_shan",
    "name": "万震山门下",
    "type": "武林门派",
    "location": "loc_jing_zhou",
    "one_line": "万震山的门派，师兄弟三人争夺连城诀"
  },
  {
    "id": "faction_xue_dao_sect",
    "name": "血刀门",
    "type": "武林门派",
    "location": "loc_xue_gu",
    "one_line": "邪派门派，以血刀经著称"
  }
]

### locations.json (3 条)
[
  {
    "id": "loc_jing_zhou",
    "name": "荆州",
    "region": "中原",
    "one_line": "故事主要发生地"
  },
  {
    "id": "loc_tian_ning_si",
    "name": "天宁寺",
    "region": "荆州",
    "one_line": "藏有宝藏的寺庙"
  },
  {
    "id": "loc_xue_gu",
    "name": "雪谷",
    "region": "川边",
    "one_line": "狄云与水笙相遇的地方"
  }
]

### skills.json (3 条)
[
  {
    "id": "skill_lian_cheng_jian_fa",
    "name": "连城剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_wan_zhen_shan",
      "char_yan_da_ping",
      "char_qi_chang_fa"
    ],
    "one_line": "连城诀的核心剑法，威力强大"
  },
  {
    "id": "skill_tang_shi_jian_fa",
    "name": "唐诗剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_mei_nian_sheng",
      "char_wu_liu_qi"
    ],
    "one_line": "连城剑法的别名，以唐诗为招式名"
  },
  {
    "id": "skill_xue_dao_jing",
    "name": "血刀经",
    "type": "刀法",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_xue_dao_lao_zu",
      "char_di_yun"
    ],
    "one_line": "血刀门的镇派绝学"
  }
]

### techniques.json (0 条)
[]

### items.json (3 条)
[
  {
    "id": "item_lian_cheng_jue",
    "name": "连城诀",
    "type": "秘籍",
    "owner": "faction_wan_zhen_shan",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_lian_cheng_jian_fa"
    ],
    "one_line": "连城诀的核心秘籍，藏有宝藏秘密"
  },
  {
    "id": "item_tang_shi_xuan_ji",
    "name": "唐诗选辑",
    "type": "秘籍",
    "owner": "char_mei_nian_sheng",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_tang_shi_jian_fa"
    ],
    "one_line": "藏有连城诀密码的书籍"
  },
  {
    "id": "item_xue_dao",
    "name": "血刀",
    "type": "兵器",
    "owner": "char_xue_dao_lao_zu",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_xue_dao_jing"
    ],
    "one_line": "血刀门的镇派宝刀"
  }
]

### dialogues.json (前 4 条 / 共 4 条)
[
  {
    "index": 0,
    "speaker": "char_di_yun",
    "listener": "char_qi_chang_fa",
    "text": "师父，你不要杀我！",
    "tone": "恐惧",
    "chapter": 1,
    "line_start": 4431,
    "line_end": 4431
  },
  {
    "index": 1,
    "speaker": "char_qi_chang_fa",
    "listener": "char_di_yun",
    "text": "这是一座黄金大佛，佛像肚中都是珠宝，你为什么不要？",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 4439,
    "line_end": 4439
  },
  {
    "index": 2,
    "speaker": "char_di_yun",
    "listener": "char_qi_chang_fa",
    "text": "师父，我不要分你的黄金大佛，你独个儿发财去罢。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 4437,
    "line_end": 4437
  },
  {
    "index": 3,
    "speaker": "char_shui_sheng",
    "listener": "char_di_yun",
    "text": "我等了你这么久！我知道你终于会回来的。你如不来，我要在这里等你十年，你十年不来，我到江湖上找你一百年！",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 4491,
    "line_end": 4491
  }
]

### chapter_summaries.json (1 条)
[
  {
    "chapter": 1,
    "title": "连城诀",
    "key_events": [
      "狄云被冤枉入狱",
      "狄云学成血刀经",
      "戚长发、万震山争夺宝藏",
      "戚芳被万圭害死",
      "狄云与水笙相遇"
    ],
    "key_characters": [
      "char_di_yun",
      "char_qi_fang",
      "char_ding_dian",
      "char_ling_shuang_hua",
      "char_qi_chang_fa",
      "char_wan_zhen_shan",
      "char_shui_sheng"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
