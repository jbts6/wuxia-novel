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

### characters.json (10 条)
[
  {
    "id": "char_li_wen_xiu",
    "name": "李文秀",
    "role": "核心",
    "faction": null,
    "personality": [
      "温柔善良",
      "内心坚强",
      "重情重义"
    ],
    "one_line": "白马李三之女，在回疆长大，武功高强，心地善良"
  },
  {
    "id": "char_su_pu",
    "name": "苏普",
    "role": "核心",
    "faction": "faction_tie_yan_bu",
    "personality": [
      "直率",
      "勇敢",
      "重情重义"
    ],
    "one_line": "哈萨克少年，李文秀的青梅竹马，后爱上阿曼"
  },
  {
    "id": "char_wa_er_la_qi",
    "name": "瓦耳拉齐",
    "role": "核心",
    "faction": null,
    "personality": [
      "阴沉",
      "内心复杂",
      "因爱生恨"
    ],
    "one_line": "李文秀的师父，哈萨克人，因被族人驱逐而投靠中原，后背叛师门"
  },
  {
    "id": "char_ma_jia_jun",
    "name": "马家骏",
    "role": "重要",
    "faction": null,
    "personality": [
      "沧桑",
      "隐藏身份",
      "重情重义"
    ],
    "one_line": "瓦耳拉齐的徒弟，假扮老人照顾李文秀十二年"
  },
  {
    "id": "char_bai_ma_li_san",
    "name": "白马李三",
    "role": "重要",
    "faction": null,
    "personality": [
      "刚毅",
      "为家人牺牲",
      "勇敢"
    ],
    "one_line": "李文秀之父，为保护家人而牺牲"
  },
  {
    "id": "char_a_man",
    "name": "阿曼",
    "role": "重要",
    "faction": "faction_tie_yan_bu",
    "personality": [
      "美丽",
      "聪明",
      "勇敢"
    ],
    "one_line": "哈萨克美女，苏普的恋人"
  },
  {
    "id": "char_su_lu_ke",
    "name": "苏鲁克",
    "role": "次要",
    "faction": "faction_tie_yan_bu",
    "personality": [
      "刚毅",
      "民族意识强",
      "反对汉人"
    ],
    "one_line": "哈萨克族铁延部族长，苏普之父"
  },
  {
    "id": "char_che_er_ku",
    "name": "车尔库",
    "role": "次要",
    "faction": "faction_tie_yan_bu",
    "personality": [
      "勇敢",
      "民族意识强",
      "最终理解"
    ],
    "one_line": "哈萨克族人，阿曼之父，曾与瓦耳拉齐争夺雅丽仙"
  },
  {
    "id": "char_huo_yuan_long",
    "name": "霍元龙",
    "role": "次要",
    "faction": "faction_lv_liang_san_jie",
    "personality": [
      "凶狠",
      "贪婪",
      "残忍"
    ],
    "one_line": "吕梁三杰之一，追杀白马李三的强盗"
  },
  {
    "id": "char_chen_da_hai",
    "name": "陈达海",
    "role": "次要",
    "faction": "faction_lv_liang_san_jie",
    "personality": [
      "凶狠",
      "贪婪",
      "残忍"
    ],
    "one_line": "吕梁三杰之一，追杀白马李三的强盗"
  }
]

### factions.json (2 条)
[
  {
    "id": "faction_lv_liang_san_jie",
    "name": "吕梁三杰",
    "type": "帮派",
    "location": "loc_lv_liang",
    "one_line": "追杀白马李三的强盗团伙"
  },
  {
    "id": "faction_tie_yan_bu",
    "name": "铁延部",
    "type": "部族",
    "location": "loc_hui_jiang",
    "one_line": "哈萨克族的一个部落"
  }
]

### locations.json (5 条)
[
  {
    "id": "loc_hui_jiang",
    "name": "回疆",
    "region": "西域",
    "one_line": "故事主要发生地，李文秀在这里长大"
  },
  {
    "id": "loc_tie_yan_bu",
    "name": "铁延部",
    "region": "回疆",
    "one_line": "哈萨克族的一个部落，李文秀在这里长大"
  },
  {
    "id": "loc_gao_chang_mi_gong",
    "name": "高昌迷宫",
    "region": "回疆",
    "one_line": "传说中藏有无数珍宝的迷宫"
  },
  {
    "id": "loc_lv_liang",
    "name": "吕梁",
    "region": "中原",
    "one_line": "吕梁三杰的活动区域"
  },
  {
    "id": "loc_jiang_nan",
    "name": "江南",
    "region": "中原",
    "one_line": "李文秀的故乡，最终返回的地方"
  }
]

### skills.json (5 条)
[
  {
    "id": "skill_hua_hui_wu_gong",
    "name": "华辉武功",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [
      "char_wa_er_la_qi",
      "char_li_wen_xiu",
      "char_ma_jia_jun"
    ],
    "one_line": "瓦耳拉齐（华辉）传授给李文秀的武功"
  },
  {
    "id": "skill_ha_sa_ke_wu_gong",
    "name": "哈萨克武功",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [
      "char_su_lu_ke",
      "char_su_pu",
      "char_che_er_ku"
    ],
    "one_line": "哈萨克族的传统武功"
  },
  {
    "id": "skill_du_zhen",
    "name": "毒针",
    "type": "暗器",
    "mastery_rank": "炉火纯青",
    "practitioners": [
      "char_wa_er_la_qi",
      "char_ma_jia_jun"
    ],
    "one_line": "瓦耳拉齐使用的暗器，剧毒无比"
  },
  {
    "id": "skill_sheng_dong_ji_xi",
    "name": "声东击西",
    "type": "feint",
    "mastery_rank": "炉火纯青",
    "practitioners": [
      "char_wa_er_la_qi"
    ],
    "one_line": "瓦耳拉齐使用的虚招"
  },
  {
    "id": "skill_wu_lei_hong_ding",
    "name": "五雷轰顶",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [
      "char_wa_er_la_qi"
    ],
    "one_line": "瓦耳拉齐使用的刚猛拳法"
  }
]

### techniques.json (0 条)
[]

### items.json (4 条)
[
  {
    "id": "item_gao_chang_mi_gong_di_tu",
    "name": "高昌迷宫地图",
    "type": "秘籍",
    "owner": "char_li_wen_xiu",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "传说中藏有无数珍宝的迷宫地图"
  },
  {
    "id": "item_bai_ma",
    "name": "白马",
    "type": "坐骑",
    "owner": "char_li_wen_xiu",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "李文秀的坐骑，忠诚护主"
  },
  {
    "id": "item_yu_jian",
    "name": "羽箭",
    "type": "暗器",
    "owner": "char_huo_yuan_long",
    "rarity_tier": "寻常凡品",
    "related_skills": [],
    "one_line": "射伤白马李三的羽箭"
  },
  {
    "id": "item_du_zhen",
    "name": "毒针",
    "type": "暗器",
    "owner": "char_wa_er_la_qi",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_du_zhen"
    ],
    "one_line": "瓦耳拉齐使用的暗器，剧毒无比"
  }
]

### dialogues.json (前 12 条 / 共 12 条)
[
  {
    "index": 0,
    "speaker": "char_bai_ma_li_san",
    "listener": "char_li_wen_xiu",
    "text": "快走！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 22,
    "line_end": 22
  },
  {
    "index": 1,
    "speaker": "char_li_wen_xiu",
    "listener": "char_wa_er_la_qi",
    "text": "师父，你得不到心爱的人，就将她杀死。我得不到心爱的人，却不忍心让他给人杀了。",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 1176,
    "line_end": 1176
  },
  {
    "index": 2,
    "speaker": "char_ma_jia_jun",
    "listener": "char_li_wen_xiu",
    "text": "江南的杨柳，已抽出嫩芽了，阿秀，你独自回去吧，以后⋯⋯以后可得小心，计爷爷，计爷爷不能再照顾你了⋯⋯",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 1138,
    "line_end": 1138
  },
  {
    "index": 3,
    "speaker": "char_ma_jia_jun",
    "listener": "char_li_wen_xiu",
    "text": "我⋯⋯我不是你计爷爷，我⋯⋯我⋯⋯",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 1116,
    "line_end": 1116
  },
  {
    "index": 4,
    "speaker": "char_wa_er_la_qi",
    "listener": "char_li_wen_xiu",
    "text": "阿秀，你⋯⋯你也要去了吗？",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 1174,
    "line_end": 1174
  },
  {
    "index": 5,
    "speaker": "char_li_wen_xiu",
    "listener": "char_wa_er_la_qi",
    "text": "师父，我在这里陪着你。",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 1160,
    "line_end": 1160
  },
  {
    "index": 6,
    "speaker": "char_su_pu",
    "listener": "char_li_wen_xiu",
    "text": "李英雄，李英雄，快出来。",
    "tone": "焦急",
    "chapter": 1,
    "line_start": 1158,
    "line_end": 1158
  },
  {
    "index": 7,
    "speaker": "char_a_man",
    "listener": "char_su_pu",
    "text": "你怎么老是叫她李英雄，不叫李姑娘？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 1164,
    "line_end": 1164
  },
  {
    "index": 8,
    "speaker": "char_su_pu",
    "listener": "char_a_man",
    "text": "李姑娘，她是女子吗？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 1164,
    "line_end": 1164
  },
  {
    "index": 9,
    "speaker": "char_a_man",
    "listener": "char_su_pu",
    "text": "那时候我见到了她瞧着你的眼色，就知道她是姑娘。天下那会有一个男子，用这样的眼光痴痴的瞧着你！",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 1166,
    "line_end": 1166
  },
  {
    "index": 10,
    "speaker": "char_wa_er_la_qi",
    "listener": "char_li_wen_xiu",
    "text": "我要你永远在这里陪我，永远不离开我⋯⋯",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 1198,
    "line_end": 1198
  },
  {
    "index": 11,
    "speaker": "char_wa_er_la_qi",
    "listener": "char_li_wen_xiu",
    "text": "阿秀，师父快死了，师父死了之后，就没人照顾你了。世界上的人都坏得很，大家只想害你，没人会真心的待你。你真心待人家好，也没有用的⋯⋯你一转头，人家就忘了你啦。",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 1194,
    "line_end": 1194
  }
]

### chapter_summaries.json (1 条)
[
  {
    "chapter": 1,
    "title": "白马啸西风",
    "key_events": [
      "白马李三一家被吕梁三杰追杀，李三重伤而死",
      "李文秀在回疆长大，与苏普相识相爱",
      "苏普的父亲反对他与汉人女子交往，李文秀被迫离开",
      "李文秀救出师父瓦耳拉齐，发现他是仇人",
      "瓦耳拉齐死在迷宫中，李文秀独自返回中原"
    ],
    "key_characters": [
      "char_li_wen_xiu",
      "char_su_pu",
      "char_wa_er_la_qi",
      "char_ma_jia_jun",
      "char_bai_ma_li_san",
      "char_a_man",
      "char_su_lu_ke",
      "char_che_er_ku",
      "char_huo_yuan_long",
      "char_chen_da_hai"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
