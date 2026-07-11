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

### characters.json (66 条)
[
  {
    "id": "char_zhang_wu_ji",
    "name": "张无忌",
    "role": "核心",
    "identity": "明教教主，张翠山与殷素素之子",
    "faction": "faction_ming_jiao",
    "personality": [
      "温厚仁慈",
      "优柔寡断",
      "重情重义"
    ],
    "one_line": "身怀九阳神功与乾坤大挪移的明教教主，一生在江湖与情感中辗转"
  },
  {
    "id": "char_zhao_min",
    "name": "赵敏",
    "role": "核心",
    "identity": "汝阳王之女，蒙古郡主",
    "faction": "faction_ru_yang_wang_fu",
    "personality": [
      "聪慧过人",
      "敢爱敢恨",
      "心思缜密"
    ],
    "one_line": "聪慧机敏的蒙古郡主，为爱放弃郡主身份追随张无忌"
  },
  {
    "id": "char_xie_xun",
    "name": "谢逊",
    "role": "核心",
    "identity": "明教四大护教法王之首",
    "faction": "faction_ming_jiao",
    "personality": [
      "豪迈刚烈",
      "至情至性",
      "因恨癫狂"
    ],
    "one_line": "明教金毛狮王，因成昆灭其满门而疯狂复仇，后在少林归佛"
  },
  {
    "id": "char_zhang_cui_shan",
    "name": "张翠山",
    "role": "核心",
    "identity": "武当五侠",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "文武双全",
      "重情重义",
      "正直刚烈"
    ],
    "one_line": "武当五侠，张无忌之父，因义兄谢逊之事被逼自尽"
  },
  {
    "id": "char_zhou_zhi_ruo",
    "name": "周芷若",
    "role": "核心",
    "identity": "峨嵋派掌门",
    "faction": "faction_e_mei_pai",
    "personality": [
      "外柔内刚",
      "心机深沉",
      "执念极深"
    ],
    "one_line": "峨嵋派掌门，从温婉少女变为心机深沉的掌门人"
  },
  {
    "id": "char_yin_su_su",
    "name": "殷素素",
    "role": "重要",
    "identity": "天鹰教教主之女",
    "faction": "faction_tian_ying_jiao",
    "personality": [
      "外柔内刚",
      "亦正亦邪",
      "聪慧机敏"
    ],
    "one_line": "天鹰教教主之女，为爱嫁入武当，携子回归中原途中自尽"
  },
  {
    "id": "char_yang_xiao",
    "name": "杨逍",
    "role": "重要",
    "identity": "明教光明左使",
    "faction": "faction_ming_jiao",
    "personality": [
      "风流倜傥",
      "智谋过人",
      "傲气凌人"
    ],
    "one_line": "明教光明左使，文武双全，智谋过人"
  },
  {
    "id": "char_zhang_san_feng",
    "name": "张三丰",
    "role": "重要",
    "identity": "武当派创始人",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "宽厚仁慈",
      "智慧深邃",
      "随和洒脱"
    ],
    "one_line": "武当派创始人，武功深不可测，太极拳剑之祖"
  },
  {
    "id": "char_mie_jue_shi_tai",
    "name": "灭绝师太",
    "role": "重要",
    "identity": "峨嵋派掌门",
    "faction": "faction_e_mei_pai",
    "personality": [
      "刚烈果决",
      "嫉恶如仇",
      "心狠手辣"
    ],
    "one_line": "峨嵋派掌门，手持倚天剑，性格刚烈，痛恨明教"
  },
  {
    "id": "char_wei_yi_xiao",
    "name": "韦一笑",
    "role": "重要",
    "identity": "明教四大护教法王之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "阴鸷冷酷",
      "亦正亦邪",
      "重诺守信"
    ],
    "one_line": "明教青翼蝠王，轻功独步天下，因修炼寒冰绵掌走火入魔"
  },
  {
    "id": "char_yin_tian_zheng",
    "name": "殷天正",
    "role": "重要",
    "identity": "天鹰教教主",
    "faction": "faction_tian_ying_jiao",
    "personality": [
      "霸气威严",
      "护犊情深",
      "刚烈豪迈"
    ],
    "one_line": "天鹰教教主，白眉鹰王，殷素素之父，后率天鹰教归附明教"
  },
  {
    "id": "char_fan_yao",
    "name": "范遥",
    "role": "重要",
    "identity": "明教光明右使",
    "faction": "faction_ming_jiao",
    "personality": [
      "隐忍坚毅",
      "智谋深远",
      "忠义无双"
    ],
    "one_line": "明教光明右使，为探查成昆下落自毁容貌潜伏元廷"
  },
  {
    "id": "char_cheng_kun",
    "name": "成昆",
    "role": "重要",
    "identity": "少林寺弟子，暗中为元廷效力",
    "faction": "faction_shao_lin_si",
    "personality": [
      "阴险狡诈",
      "城府极深",
      "心狠手辣"
    ],
    "one_line": "少林僧人圆真，实为幕后黑手，害谢逊满门逼其发疯"
  },
  {
    "id": "char_xiao_zhao",
    "name": "小昭",
    "role": "重要",
    "identity": "波斯明教圣女",
    "faction": "faction_bo_si_ming_jiao",
    "personality": [
      "忠心耿耿",
      "温柔体贴",
      "聪慧灵巧"
    ],
    "one_line": "波斯明教圣女，为张无忌甘愿做侍女，最终回归波斯"
  },
  {
    "id": "char_yin_li",
    "name": "殷离",
    "role": "重要",
    "identity": "殷天正孙女",
    "faction": null,
    "personality": [
      "痴情执着",
      "外刚内柔",
      "命途多舛"
    ],
    "one_line": "殷天正孙女，痴恋张无忌，练千蛛万毒手毁容"
  },
  {
    "id": "char_song_yuan_qiao",
    "name": "宋远桥",
    "role": "重要",
    "identity": "武当七侠之首",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "稳重老成",
      "武功扎实",
      "重情重义"
    ],
    "one_line": "武当七侠之首，张三丰大弟子，武功稳重扎实"
  },
  {
    "id": "char_song_qing_shu",
    "name": "宋青书",
    "role": "重要",
    "identity": "宋远桥之子，武当派弟子，后叛变投靠峨嵋派周芷若",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "聪明机智",
      "过目不忘",
      "俊美潇洒"
    ],
    "one_line": "武当七侠之首宋远桥独子，因迷恋周芷若而叛变投敌，杀害莫声谷，最终被父亲亲手击毙"
  },
  {
    "id": "char_huang_shan_nv_zi",
    "name": "黄衫女子",
    "role": "重要",
    "identity": "杨过后人",
    "faction": null,
    "personality": [
      "神秘莫测",
      "武功高强",
      "淡然从容"
    ],
    "one_line": "杨过后人，武功高强，在关键时刻出手相助张无忌"
  },
  {
    "id": "char_yu_lian_zhou",
    "name": "俞莲舟",
    "role": "次要",
    "identity": "武当七侠之二",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "刚毅果断",
      "武功精纯",
      "重情重义"
    ],
    "one_line": "武当七侠之二，武功在七侠中最强"
  },
  {
    "id": "char_yu_dai_yan",
    "name": "俞岱岩",
    "role": "次要",
    "identity": "武当七侠之三",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "刚正不阿",
      "命运多舛",
      "坚忍不拔"
    ],
    "one_line": "武当七侠之三，早年被殷素素误伤致残"
  },
  {
    "id": "char_zhang_song_xi",
    "name": "张松溪",
    "role": "次要",
    "identity": "武当七侠之四",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "足智多谋",
      "心思缜密",
      "武功扎实"
    ],
    "one_line": "武当七侠之四，足智多谋"
  },
  {
    "id": "char_yin_li_ting",
    "name": "殷梨亭",
    "role": "次要",
    "identity": "武当七侠之六",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "刚烈直率",
      "重情重义",
      "命运坎坷"
    ],
    "one_line": "武当七侠之六，与纪晓芙有婚约"
  },
  {
    "id": "char_mo_sheng_gu",
    "name": "莫声谷",
    "role": "次要",
    "identity": "武当七侠之七",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "刚烈直率",
      "嫉恶如仇",
      "武功扎实"
    ],
    "one_line": "武当七侠之七，性格刚烈"
  },
  {
    "id": "char_jue_yuan",
    "name": "觉远",
    "role": "次要",
    "identity": "少林寺藏经阁僧人",
    "faction": "faction_shao_lin_si",
    "personality": [
      "慈悲为怀",
      "憨厚朴实",
      "武功深藏不露"
    ],
    "one_line": "少林寺藏经阁僧人，默诵九阳真经，圆寂前传授张君宝"
  },
  {
    "id": "char_kong_wen",
    "name": "空闻",
    "role": "次要",
    "identity": "少林寺方丈",
    "faction": "faction_shao_lin_si",
    "personality": [
      "老成持重",
      "武功高强",
      "处事公正"
    ],
    "one_line": "少林寺方丈，主持少林寺英雄大会"
  },
  {
    "id": "char_kong_zhi",
    "name": "空智",
    "role": "次要",
    "identity": "少林寺高僧",
    "faction": "faction_shao_lin_si",
    "personality": [
      "武功深厚",
      "慈悲为怀",
      "老成持重"
    ],
    "one_line": "少林寺高僧，武功深厚"
  },
  {
    "id": "char_kong_jian",
    "name": "空见",
    "role": "次要",
    "identity": "少林寺四大神僧之首",
    "faction": "faction_shao_lin_si",
    "personality": [
      "武功深不可测",
      "慈悲为怀",
      "德高望重"
    ],
    "one_line": "少林四大神僧之首，武功深不可测，被成昆利用害死"
  },
  {
    "id": "char_kong_xing",
    "name": "空性",
    "role": "次要",
    "identity": "少林寺高僧",
    "faction": "faction_shao_lin_si",
    "personality": [
      "武功高强",
      "慈悲为怀",
      "刚正不阿"
    ],
    "one_line": "少林高僧，以龙爪手闻名"
  },
  {
    "id": "char_wu_se_chan_shi",
    "name": "无色禅师",
    "role": "次要",
    "identity": "少林寺罗汉堂首座",
    "faction": "faction_shao_lin_si",
    "personality": [
      "武功高强",
      "慈悲为怀",
      "处事公正"
    ],
    "one_line": "少林寺罗汉堂首座，郭襄上少林时出场"
  },
  {
    "id": "char_he_tai_chong",
    "name": "何太冲",
    "role": "次要",
    "identity": "昆仑派掌门",
    "faction": "faction_kun_lun_pai",
    "personality": [
      "武功扎实",
      "刚愎自用",
      "色厉内荏"
    ],
    "one_line": "昆仑派掌门，与妻子班淑娴联手施展两仪剑法"
  },
  {
    "id": "char_ban_shu_xian",
    "name": "班淑娴",
    "role": "次要",
    "identity": "昆仑派掌门夫人",
    "faction": "faction_kun_lun_pai",
    "personality": [
      "武功扎实",
      "性格刚烈",
      "夫妻同心"
    ],
    "one_line": "昆仑派掌门夫人，与何太冲联手施展两仪剑法"
  },
  {
    "id": "char_yang_bu_hui",
    "name": "杨不悔",
    "role": "次要",
    "identity": "杨逍与纪晓芙之女",
    "faction": null,
    "personality": [
      "活泼开朗",
      "心地善良",
      "敢爱敢恨"
    ],
    "one_line": "杨逍与纪晓芙之女，后嫁给殷梨亭"
  },
  {
    "id": "char_yin_ye_wang",
    "name": "殷野王",
    "role": "次要",
    "identity": "殷天正之子",
    "faction": "faction_tian_ying_jiao",
    "personality": [
      "武功扎实",
      "性格刚烈",
      "重情重义"
    ],
    "one_line": "殷天正之子，天鹰教少主"
  },
  {
    "id": "char_ding_min_jun",
    "name": "丁敏君",
    "role": "次要",
    "identity": "峨嵋派弟子",
    "faction": "faction_e_mei_pai",
    "personality": [
      "尖酸刻薄",
      "嫉妒心强",
      "武功平平"
    ],
    "one_line": "峨嵋派弟子，性格刻薄，嫉妒周芷若"
  },
  {
    "id": "char_ji_xiao_fu",
    "name": "纪晓芙",
    "role": "次要",
    "identity": "峨嵋派弟子",
    "faction": "faction_e_mei_pai",
    "personality": [
      "外柔内刚",
      "重情重义",
      "敢爱敢恨"
    ],
    "one_line": "峨嵋派弟子，与杨逍相爱生下杨不悔，被灭绝师太处死"
  },
  {
    "id": "char_jing_xuan",
    "name": "静玄",
    "role": "次要",
    "identity": "峨嵋派大弟子",
    "faction": "faction_e_mei_pai",
    "personality": [
      "武功扎实",
      "性格刚毅",
      "重情重义"
    ],
    "one_line": "峨嵋派大弟子，武功在峨嵋弟子中最强"
  },
  {
    "id": "char_chen_you_liang",
    "name": "陈友谅",
    "role": "次要",
    "identity": "丐帮弟子",
    "faction": "faction_gai_bang",
    "personality": [
      "野心勃勃",
      "阴险狡诈",
      "善于钻营"
    ],
    "one_line": "丐帮弟子，野心勃勃，后投靠元廷"
  },
  {
    "id": "char_zhou_dian",
    "name": "周颠",
    "role": "次要",
    "identity": "明教五散人之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "性格癫狂",
      "亦正亦邪",
      "重情重义"
    ],
    "one_line": "明教五散人之一，性格癫狂，武功不弱"
  },
  {
    "id": "char_shuo_bu_de",
    "name": "说不得",
    "role": "次要",
    "identity": "明教五散人之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "诙谐幽默",
      "重情重义",
      "武功扎实"
    ],
    "one_line": "明教五散人之一，以乾坤一气袋闻名"
  },
  {
    "id": "char_peng_ying_yu",
    "name": "彭莹玉",
    "role": "次要",
    "identity": "明教五散人之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "慈悲为怀",
      "武功扎实",
      "重情重义"
    ],
    "one_line": "明教五散人之一，僧人打扮，武功扎实"
  },
  {
    "id": "char_leng_qian",
    "name": "冷谦",
    "role": "次要",
    "identity": "明教五散人之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "沉默寡言",
      "武功扎实",
      "重情重义"
    ],
    "one_line": "明教五散人之一，沉默寡言"
  },
  {
    "id": "char_tie_guan_dao_ren",
    "name": "铁冠道人",
    "role": "次要",
    "identity": "明教五散人之一",
    "faction": "faction_ming_jiao",
    "personality": [
      "武功扎实",
      "重情重义",
      "不拘小节"
    ],
    "one_line": "明教五散人之一，道士打扮"
  },
  {
    "id": "char_ru_yang_wang",
    "name": "汝阳王",
    "role": "次要",
    "identity": "元朝汝阳王",
    "faction": "faction_ru_yang_wang_fu",
    "personality": [
      "老谋深算",
      "权谋过人",
      "父爱深沉"
    ],
    "one_line": "元朝汝阳王，赵敏之父，策划消灭武林门派"
  },
  {
    "id": "char_lu_zhang_ke",
    "name": "鹿杖客",
    "role": "次要",
    "identity": "玄冥二老之一",
    "faction": "faction_ru_yang_wang_fu",
    "personality": [
      "武功高强",
      "阴险狡诈",
      "贪财好色"
    ],
    "one_line": "玄冥二老之一，武功高强，为汝阳王效力"
  },
  {
    "id": "char_he_bi_weng",
    "name": "鹤笔翁",
    "role": "次要",
    "identity": "玄冥二老之一",
    "faction": "faction_ru_yang_wang_fu",
    "personality": [
      "武功高强",
      "阴险狡诈",
      "心狠手辣"
    ],
    "one_line": "玄冥二老之一，武功高强，为汝阳王效力"
  },
  {
    "id": "char_chang_yu_chun",
    "name": "常遇春",
    "role": "龙套",
    "identity": "明教弟子",
    "faction": "faction_ming_jiao",
    "personality": [
      "勇猛善战",
      "重情重义",
      "豪爽直率"
    ],
    "one_line": "明教弟子，后成为明朝开国名将"
  },
  {
    "id": "char_jian_jie",
    "name": "简捷",
    "role": "龙套",
    "identity": "江湖游侠",
    "faction": null,
    "personality": [
      "见利忘义",
      "武功平平",
      "胆小怕事"
    ],
    "one_line": "江湖游侠，曾短暂帮助张无忌"
  },
  {
    "id": "char_han_shan_tong",
    "name": "韩山童",
    "role": "龙套",
    "identity": "明教起义军首领",
    "faction": "faction_ming_jiao",
    "personality": [
      "勇猛善战",
      "重情重义",
      "豪爽直率"
    ],
    "one_line": "明教起义军首领，红巾军领袖"
  },
  {
    "id": "char_zhu_yuan_zhang",
    "name": "朱元璋",
    "role": "龙套",
    "identity": "明教弟子，后为明朝开国皇帝",
    "faction": "faction_ming_jiao",
    "personality": [
      "雄才大略",
      "城府极深",
      "心狠手辣"
    ],
    "one_line": "明教弟子，后成为明朝开国皇帝"
  },
  {
    "id": "char_xu_da",
    "name": "徐达",
    "role": "龙套",
    "identity": "明教起义军将领",
    "faction": "faction_ming_jiao",
    "personality": [
      "勇猛善战",
      "重情重义",
      "豪爽直率"
    ],
    "one_line": "明教起义军将领，后成为明朝开国名将"
  },
  {
    "id": "char_wu_lie",
    "name": "武烈",
    "role": "龙套",
    "identity": "江湖人士",
    "faction": null,
    "personality": [
      "武功平平",
      "见利忘义",
      "趋炎附势"
    ],
    "one_line": "江湖人士，与武青婴、朱九真有牵连"
  },
  {
    "id": "char_wu_qing_ying",
    "name": "武青婴",
    "role": "龙套",
    "identity": "武烈之女",
    "faction": null,
    "personality": [
      "争强好胜",
      "心胸狭窄",
      "武功平平"
    ],
    "one_line": "武烈之女，与朱九真争风吃醋"
  },
  {
    "id": "char_zhu_jiu_zhen",
    "name": "朱九真",
    "role": "龙套",
    "identity": "朱子柳后人",
    "faction": null,
    "personality": [
      "爱慕虚荣",
      "心胸狭窄",
      "武功平平"
    ],
    "one_line": "朱子柳后人，曾对张无忌有意"
  },
  {
    "id": "char_wei_bi",
    "name": "卫璧",
    "role": "龙套",
    "identity": "江湖人士",
    "faction": null,
    "personality": [
      "武功平平",
      "见利忘义",
      "趋炎附势"
    ],
    "one_line": "江湖人士，与朱九真有牵连"
  },
  {
    "id": "char_wang_bao_bao",
    "name": "王保保",
    "role": "龙套",
    "identity": "汝阳王之子",
    "faction": "faction_ru_yang_wang_fu",
    "personality": [
      "武功平平",
      "纨绔子弟",
      "争强好胜"
    ],
    "one_line": "汝阳王之子，赵敏兄长"
  },
  {
    "id": "char_lao_tou_zi",
    "name": "老头子",
    "role": "龙套",
    "identity": "江湖游侠",
    "faction": null,
    "personality": [
      "重情重义",
      "豪爽直率",
      "武功扎实"
    ],
    "one_line": "江湖游侠，曾短暂帮助张无忌"
  },
  {
    "id": "char_chang_jing_zhi",
    "name": "常敬之",
    "role": "龙套",
    "identity": "崆峒五老之一",
    "faction": "faction_kong_tong_pai",
    "personality": [
      "武功扎实",
      "刚愎自用",
      "重情重义"
    ],
    "one_line": "崆峒五老之一，以七伤拳闻名"
  },
  {
    "id": "char_tang_wen_liang",
    "name": "唐文亮",
    "role": "龙套",
    "identity": "崆峒五老之一",
    "faction": "faction_kong_tong_pai",
    "personality": [
      "武功扎实",
      "刚愎自用",
      "重情重义"
    ],
    "one_line": "崆峒五老之一，以七伤拳闻名"
  },
  {
    "id": "char_guo_xiang",
    "name": "郭襄",
    "role": "背景",
    "identity": "郭靖黄蓉之女",
    "faction": null,
    "personality": [
      "聪慧机敏",
      "重情重义",
      "豪爽直率"
    ],
    "one_line": "郭靖黄蓉之女，上少林寺寻杨过未果，后创立峨嵋派"
  },
  {
    "id": "char_yang_guo",
    "name": "杨过",
    "role": "背景",
    "identity": "神雕侠侣主角",
    "faction": null,
    "personality": [
      "狂放不羁",
      "重情重义",
      "武功盖世"
    ],
    "one_line": "神雕侠侣主角，已隐居，其后人黄衫女子出场"
  },
  {
    "id": "char_xiao_long_nv",
    "name": "小龙女",
    "role": "背景",
    "identity": "神雕侠侣主角",
    "faction": null,
    "personality": [
      "冰清玉洁",
      "武功盖世",
      "淡然出尘"
    ],
    "one_line": "神雕侠侣主角，已与杨过隐居"
  },
  {
    "id": "char_guo_jing",
    "name": "郭靖",
    "role": "背景",
    "identity": "射雕英雄传主角",
    "faction": null,
    "personality": [
      "侠之大者",
      "为国为民",
      "武功盖世"
    ],
    "one_line": "射雕英雄传主角，郭襄之父，已年老"
  },
  {
    "id": "char_huang_rong",
    "name": "黄蓉",
    "role": "背景",
    "identity": "射雕英雄传主角",
    "faction": null,
    "personality": [
      "聪慧过人",
      "武功高强",
      "重情重义"
    ],
    "one_line": "射雕英雄传主角，郭靖之妻，郭襄之母"
  },
  {
    "id": "char_dai_qi_si",
    "name": "黛绮丝",
    "role": "重要",
    "identity": "明教四大护教法王之一，紫衫龙王",
    "faction": "faction_ming_jiao",
    "personality": [
      "武功高强",
      "心机深沉",
      "爱憎分明"
    ],
    "one_line": "明教紫衫龙王，金花婆婆，与谢逊有旧怨"
  },
  {
    "id": "char_he_zu_dao",
    "name": "何足道",
    "role": "次要",
    "identity": "昆仑派高手，昆仑三圣之一",
    "faction": "faction_kun_lun_pai",
    "personality": [
      "武功高强",
      "孤高自傲",
      "重情重义"
    ],
    "one_line": "昆仑三圣，挑战少林寺，后传经书下落"
  },
  {
    "id": "char_tian_ming",
    "name": "天鸣禅师",
    "role": "次要",
    "identity": "少林寺方丈",
    "faction": "faction_shao_lin_si",
    "personality": [
      "老成持重",
      "顾全大局",
      "慈悲为怀"
    ],
    "one_line": "少林寺方丈，老成持重，在英雄大会上被成昆毒死"
  }
]

### factions.json (12 条)
[
  {
    "id": "faction_wu_dang",
    "name": "武当派",
    "type": "武林门派",
    "location": "loc_wu_dang_shan",
    "one_line": "张三丰所创，与少林齐名，以太极拳剑闻名天下，门下七侠各有所长"
  },
  {
    "id": "faction_e_mei",
    "name": "峨眉派",
    "type": "武林门派",
    "location": "loc_e_mei_shan",
    "one_line": "郭襄所创，女子为主，掌门持倚天剑，灭绝师太、周芷若相继执掌"
  },
  {
    "id": "faction_shao_lin",
    "name": "少林派",
    "type": "武林门派",
    "location": "loc_shao_lin_si",
    "one_line": "天下武学之源，四大神僧坐镇，少林寺英雄大会为全书高潮"
  },
  {
    "id": "faction_kun_lun",
    "name": "昆仑派",
    "type": "武林门派",
    "location": "loc_kun_lun_shan",
    "one_line": "西域大派，掌门何太冲与妻班淑娴齐名，参与六派围攻光明顶"
  },
  {
    "id": "faction_kong_tong",
    "name": "崆峒派",
    "type": "武林门派",
    "location": null,
    "one_line": "以七伤拳闻名，参与六派围攻光明顶，派中高手实力不俗"
  },
  {
    "id": "faction_hua_shan",
    "name": "华山派",
    "type": "武林门派",
    "location": null,
    "one_line": "五岳之一，高矮二老参与六派围攻光明顶，鲜于通为掌门"
  },
  {
    "id": "faction_ming_jiao",
    "name": "明教",
    "type": "宗教组织",
    "location": "loc_guang_ming_ding",
    "one_line": "又称摩尼教，源于波斯，以驱除胡虏为志，教主之下设光明使者、四大法王"
  },
  {
    "id": "faction_tian_ying",
    "name": "天鹰教",
    "type": "帮派",
    "location": "loc_tian_ying_dao",
    "one_line": "殷天正所创，与明教同源，后并入明教，以天鹰旗为号"
  },
  {
    "id": "faction_gai_bang",
    "name": "丐帮",
    "type": "帮派",
    "location": null,
    "one_line": "天下第一大帮，帮众遍布天下，陈友谅混入其中兴风作浪"
  },
  {
    "id": "faction_ru_yang_wang_fu",
    "name": "汝阳王府",
    "type": "官署",
    "location": "loc_da_du",
    "one_line": "元朝汝阳王执掌兵马，赵敏父兄所在，玄冥二老等高手效力"
  },
  {
    "id": "faction_gu_mu",
    "name": "古墓派",
    "type": "武林门派",
    "location": null,
    "one_line": "小龙女所传，黄衫女为后人，开篇提及与杨过渊源"
  },
  {
    "id": "faction_bo_si_ming_jiao",
    "name": "波斯明教",
    "type": "宗教组织",
    "location": "loc_bo_si",
    "one_line": "明教总教，遣使迎回圣火令与小昭，三使武功诡异"
  }
]

### locations.json (16 条)
[
  {
    "id": "loc_guang_ming_ding",
    "name": "光明顶",
    "region": "西域",
    "one_line": "明教总坛所在，六大派围攻光明顶的核心战场"
  },
  {
    "id": "loc_wu_dang_shan",
    "name": "武当山",
    "region": "中原",
    "one_line": "武当派道场，张三丰与武当七侠修行之地"
  },
  {
    "id": "loc_shao_lin_si",
    "name": "少林寺",
    "region": "中原",
    "one_line": "天下武学正宗，七十二绝技威震武林"
  },
  {
    "id": "loc_e_mei_shan",
    "name": "峨眉山",
    "region": "蜀地",
    "one_line": "峨眉派道场，灭绝师太统领峨眉剑派"
  },
  {
    "id": "loc_kun_lun_shan",
    "name": "昆仑山",
    "region": "西域",
    "one_line": "昆仑派道场，张无忌在此修炼九阳神功"
  },
  {
    "id": "loc_kong_tong_shan",
    "name": "崆峒山",
    "region": "西北",
    "one_line": "崆峒派道场，崆峒五老以七伤拳闻名"
  },
  {
    "id": "loc_hua_shan",
    "name": "华山",
    "region": "中原",
    "one_line": "华山派道场，以剑法闻名"
  },
  {
    "id": "loc_bing_huo_dao",
    "name": "冰火岛",
    "region": "海外",
    "one_line": "张翠山一家与谢逊流落海外十年的孤岛"
  },
  {
    "id": "loc_hu_die_gu",
    "name": "蝴蝶谷",
    "region": "中原",
    "one_line": "蝶谷医仙胡青牛隐居之所，张无忌在此学医"
  },
  {
    "id": "loc_da_du",
    "name": "大都",
    "region": "中原",
    "one_line": "元朝都城，赵敏父女策划消灭武林门派"
  },
  {
    "id": "loc_lv_liu_shan_zhuang",
    "name": "绿柳山庄",
    "region": "中原",
    "one_line": "赵敏别院，张无忌与赵敏在此定情"
  },
  {
    "id": "loc_wan_an_si",
    "name": "万安寺",
    "region": "中原",
    "one_line": "赵敏囚禁六大派高手之所，武林浩劫之地"
  },
  {
    "id": "loc_han_shui",
    "name": "汉水",
    "region": "中原",
    "one_line": "张无忌与周芷若初遇之地"
  },
  {
    "id": "loc_ling_she_dao",
    "name": "灵蛇岛",
    "region": "海外",
    "one_line": "海外岛屿，张无忌与赵敏在此经历生死"
  },
  {
    "id": "loc_bo_si",
    "name": "波斯",
    "region": "西域",
    "one_line": "波斯明教总坛所在，小昭回归之地"
  },
  {
    "id": "loc_tian_ying_dao",
    "name": "天鹰岛",
    "region": "海外",
    "one_line": "天鹰教总坛所在，殷天正创立天鹰教之地"
  }
]

### skills.json (20 条)
[
  {
    "id": "skill_jiu_yang_shen_gong",
    "name": "九阳神功",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "觉远默诵、张无忌在山谷中练成，内力浑厚无比，为诸般武功根基"
  },
  {
    "id": "skill_qian_kun_da_nuo_yi",
    "name": "乾坤大挪移",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "明教镇教神功，张无忌于光明顶密道中练至第七层"
  },
  {
    "id": "skill_tai_ji_quan",
    "name": "太极拳",
    "type": "拳法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "张三丰晚年所创，以柔克刚、以静制动，武当镇派绝学"
  },
  {
    "id": "skill_tai_ji_jian",
    "name": "太极剑",
    "type": "剑法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "张三丰所创剑法，与太极拳相辅相成，剑意绵绵不绝"
  },
  {
    "id": "skill_qi_shang_quan",
    "name": "七伤拳",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "崆峒派绝学，一拳之中蕴含七股不同劲力，伤人先伤己"
  },
  {
    "id": "skill_ti_yun_zong",
    "name": "梯云纵",
    "type": "轻功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "武当派轻功绝技，凌空换步，轻灵飘逸"
  },
  {
    "id": "skill_xiang_long_shi_ba_zhang",
    "name": "降龙十八掌",
    "type": "掌法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "丐帮镇帮绝学，刚猛无俦，书中仅提及"
  },
  {
    "id": "skill_da_gou_bang_fa",
    "name": "打狗棒法",
    "type": "棒法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "丐帮镇帮神技，非帮主不传，郭襄偷学一招半式"
  },
  {
    "id": "skill_xuan_ming_shen_zhang",
    "name": "玄冥神掌",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "玄冥二老所擅，阴寒毒辣，幼年张无忌曾受此掌之伤"
  },
  {
    "id": "skill_yi_yang_zhi",
    "name": "一阳指",
    "type": "指法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "大理段氏绝学，书中开篇提及"
  },
  {
    "id": "skill_ying_zhao_qin_na_shou",
    "name": "鹰爪擒拿手",
    "type": "爪法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "天鹰教殷天正所擅擒拿功夫，爪力凌厉"
  },
  {
    "id": "skill_jiu_yin_bai_gu_zhao",
    "name": "九阴白骨爪",
    "type": "爪法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "阴毒爪功，周芷若倚天剑中习得"
  },
  {
    "id": "skill_luo_ying_jian_fa",
    "name": "落英剑法",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "桃花岛黄药师所创剑法，郭襄家传"
  },
  {
    "id": "skill_yu_nv_jian_fa",
    "name": "玉女剑法",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "古墓派林朝英所创，讲究丰神脱俗，郭襄开篇使用"
  },
  {
    "id": "skill_qian_zhu_wan_du_shou",
    "name": "千蛛万毒手",
    "type": "毒功",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "殷离所练毒功，以毒蛛喂养，伤敌伤己"
  },
  {
    "id": "skill_sheng_huo_ling_wu_gong",
    "name": "圣火令武功",
    "type": "奇门",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "刻于圣火令上的波斯武功，招式诡异，张无忌习得"
  },
  {
    "id": "skill_long_zhao_shou",
    "name": "龙爪手",
    "type": "爪法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，空智擅使"
  },
  {
    "id": "skill_jin_gang_bu_huai_ti",
    "name": "金刚不坏体神功",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "少林绝顶内功，空见神僧以此功抵御谢逊七伤拳"
  },
  {
    "id": "skill_hun_yuan_pi_li_shou",
    "name": "混元霹雳手",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "成昆成名绝技，刚猛霸道"
  },
  {
    "id": "skill_jiu_yin_zhen_jing",
    "name": "九阴真经",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "武林至高秘籍，刻于倚天剑中，周芷若习得部分内容"
  }
]

### techniques.json (6 条)
[
  {
    "id": "tech_yun_shou",
    "name": "云手",
    "type": "attack",
    "source_skill": "skill_tai_ji_juan"
  },
  {
    "id": "tech_lan_que_wei",
    "name": "揽雀尾",
    "type": "defense",
    "source_skill": "skill_tai_ji_juan"
  },
  {
    "id": "tech_chan_zi_jue",
    "name": "缠字诀",
    "type": "control",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_feng_zi_jue",
    "name": "封字诀",
    "type": "control",
    "source_skill": "skill_da_gou_bang_fa"
  },
  {
    "id": "tech_jian_long_zai_tian",
    "name": "见龙在田",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_kang_long_you_hui",
    "name": "亢龙有悔",
    "type": "attack",
    "source_skill": "skill_jiang_long_shi_ba_zhang"
  }
]

### items.json (13 条)
[
  {
    "id": "item_yi_tian_jian",
    "name": "倚天剑",
    "type": "兵器",
    "owner": "char_mie_jue_shi_tai",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "峨眉派镇派宝剑，与屠龙刀齐名，内藏武穆遗书与九阴真经"
  },
  {
    "id": "item_tu_long_dao",
    "name": "屠龙刀",
    "type": "兵器",
    "owner": "char_xie_xun",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "武林至尊宝刀，号令天下莫敢不从，内藏武穆遗书"
  },
  {
    "id": "item_sheng_huo_ling",
    "name": "圣火令",
    "type": "信物",
    "owner": "char_zhang_wu_ji",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "明教教主信物，令到如教主亲临，持令者号令全教"
  },
  {
    "id": "item_jiu_yang_zhen_jing",
    "name": "九阳真经",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_jiu_yang_shen_gong"
    ],
    "one_line": "与九阴真经齐名的内功至高心法，写于楞伽经夹缝中"
  },
  {
    "id": "item_qian_kun_da_nuo_yi_xin_fa",
    "name": "乾坤大挪移心法",
    "type": "秘籍",
    "owner": "char_zhang_wu_ji",
    "rarity_tier": "神品",
    "related_skills": [
      "skill_qian_kun_da_nuo_yi"
    ],
    "one_line": "明教镇教神功心法，共七层，刻于光明顶密道石壁"
  },
  {
    "id": "item_tie_luo_han",
    "name": "铁罗汉",
    "type": "信物",
    "owner": "char_zhang_san_feng",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "郭襄赠张君宝的铁铸罗汉，内藏少林拳法机括"
  },
  {
    "id": "item_zhu_hua",
    "name": "珠花",
    "type": "饰品",
    "owner": "char_zhao_min",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "赵敏赠张无忌的珠花，为二人情感信物"
  },
  {
    "id": "item_jin_hua",
    "name": "金花",
    "type": "信物",
    "owner": "char_dai_qi_si",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "金花婆婆的标志信物与暗器，武林中人见金花即知其来"
  },
  {
    "id": "item_qian_kun_yi_qi_dai",
    "name": "乾坤一气袋",
    "type": "工具",
    "owner": "char_shuo_bu_de",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "说不得的布袋法宝，可装人于其中，张无忌曾被困袋中"
  },
  {
    "id": "item_shi_xiang_ruan_jin_san",
    "name": "十香软筋散",
    "type": "毒药",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "无色无味奇毒，中者筋骨酸软无力，赵敏与周芷若均曾使用"
  },
  {
    "id": "item_hei_yu_duan_xu_gao",
    "name": "黑玉断续膏",
    "type": "丹药",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "西域灵药，可续接断骨，为治疗俞岱岩殷梨亭的关键药物"
  },
  {
    "id": "item_tian_xin_jie_du_dan",
    "name": "天心解毒丹",
    "type": "丹药",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "武当派解毒丹药，可暂缓毒性发作"
  },
  {
    "id": "item_xuan_ming_shen_zhang",
    "name": "玄冥神掌",
    "type": "奇门",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "玄冥二老的阴毒掌法，中者寒毒入体，张无忌幼年深受其害"
  }
]

### dialogues.json (前 50 条 / 共 59 条)
[
  {
    "index": 0,
    "speaker": "char_guo_xiang",
    "speaker_name": "郭襄",
    "listener": null,
    "text": "大和尚，请留步，小女子有句话请教。",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 29,
    "line_end": 29
  },
  {
    "index": 1,
    "speaker": "char_guo_xiang",
    "speaker_name": "郭襄",
    "listener": "char_jue_yuan",
    "text": "觉远大师，你不认得我了么？我是郭襄啊。",
    "tone": "激动",
    "chapter": 1,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 2,
    "speaker": null,
    "speaker_name": "瘦长僧人",
    "listener": "char_jue_yuan",
    "text": "觉远，不守戒法，擅自开口说话，何况又和庙外生人对答，更何况又跟年轻女子说话。这便见戒律堂首座去。",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 3,
    "speaker": "char_guo_xiang",
    "speaker_name": "郭襄",
    "listener": null,
    "text": "天下还有不许人说话的规矩么？我识得这位大师，我自跟他说话，干你们何事？",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 4,
    "speaker": "char_wu_se_chan_shi",
    "speaker_name": "无色",
    "listener": "char_guo_xiang",
    "text": "小姑娘接我十招，瞧老和尚眼力如何，能不能说出你的门派？",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 115,
    "line_end": 115
  },
  {
    "index": 5,
    "speaker": "char_guo_xiang",
    "speaker_name": "郭襄",
    "listener": "char_wu_se_chan_shi",
    "text": "十招中瞧不出，那便如何？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 117,
    "line_end": 117
  },
  {
    "index": 6,
    "speaker": "char_guo_xiang",
    "speaker_name": "郭襄",
    "listener": null,
    "text": "何不迳弃中原，反取西域？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 267,
    "line_end": 267
  },
  {
    "index": 7,
    "speaker": "char_he_zu_dao",
    "speaker_name": "何足道",
    "listener": null,
    "text": "抚长剑，一扬眉，清水白石何离离？世间苦无知音，纵活千载，亦复何益？",
    "tone": "悲伤",
    "chapter": 1,
    "line_start": 257,
    "line_end": 257
  },
  {
    "index": 8,
    "speaker": "char_he_zu_dao",
    "speaker_name": "何足道",
    "listener": null,
    "text": "昆仑山何足道造访少林寺，有一言奉告。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 9,
    "speaker": "char_tian_ming",
    "speaker_name": "天鸣",
    "listener": "char_he_zu_dao",
    "text": "何居士不用客气，请进奉茶。这位女居士嘛⋯⋯",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 10,
    "speaker": "char_he_zu_dao",
    "speaker_name": "何足道",
    "listener": "char_tian_ming",
    "text": "老方丈，晚生到宝刹来，本是受人之托，来传一句言语。这句话一说过，原想拍手便去，但宝刹重男轻女，莫名其妙的清规戒律未免太多，晚生却颇有点看不过眼。须知佛法无边，众生如一，妄分男女，心有滞碍。",
    "tone": "嘲讽",
    "chapter": 2,
    "line_start": 19,
    "line_end": 19
  },
  {
    "index": 11,
    "speaker": "char_jue_yuan",
    "speaker_name": "觉远",
    "listener": null,
    "text": "老僧只知念经打坐，晒书扫地，武功一道可一窍不通。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 12,
    "speaker": "char_he_zu_dao",
    "speaker_name": "何足道",
    "listener": null,
    "text": "大和尚，你好深厚的内功，在下可不及你！",
    "tone": "激动",
    "chapter": 2,
    "line_start": 57,
    "line_end": 57
  },
  {
    "index": 13,
    "speaker": "char_yu_dai_yan",
    "speaker_name": "俞岱岩",
    "listener": null,
    "text": "宝刀纵好，又不是我的，我怎能横加抢夺？",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 87,
    "line_end": 87
  },
  {
    "index": 14,
    "speaker": "char_yu_dai_yan",
    "speaker_name": "俞岱岩",
    "listener": null,
    "text": "武学之士，全凭本身功夫克敌制胜，仗义行道，显名声于天下后世。宝刀宝剑乃身外之物，得不足喜，失不足悲，老丈何必为此烦恼？",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 15,
    "speaker": null,
    "speaker_name": "都大锦",
    "listener": null,
    "text": "我这龙门镖局开设二十年来，官镖、盐镖、金银珠宝，再大的生意也接过，可从来没出过半点岔子。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 241,
    "line_end": 241
  },
  {
    "index": 16,
    "speaker": "char_yu_dai_yan",
    "speaker_name": "俞岱岩",
    "listener": "char_zhang_cui_shan",
    "text": "三哥，我便粉身碎骨，也要为你报仇。",
    "tone": "悲伤",
    "chapter": 4,
    "line_start": 27,
    "line_end": 27
  },
  {
    "index": 17,
    "speaker": "char_zhang_san_feng",
    "speaker_name": "张三丰",
    "listener": "char_zhang_cui_shan",
    "text": "翠山，这路书法如何？",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 18,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": null,
    "text": "水灾的难民，都总镖头瞧见了么？",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 35,
    "line_end": 35
  },
  {
    "index": 19,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": null,
    "text": "姓都的，今日我手下容情，打到你这般地步，也就够了。你把囊中的二千两黄金，尽数取将出来救济灾民。我在暗中窥探，只要你留下一两八钱，我拆了你的龙门镖局，将你满门杀得鸡犬不留。",
    "tone": "冷酷",
    "chapter": 4,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 20,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": null,
    "text": "四位大师是谁？",
    "tone": "疑问",
    "chapter": 4,
    "line_start": 85,
    "line_end": 85
  },
  {
    "index": 21,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_cui_shan",
    "text": "昨晚乌云蔽天，未见月色，今宵云散天青，可好得多了。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 22,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_cui_shan",
    "text": "我姓殷⋯⋯他日有缘，再向张相公请教⋯⋯",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 23,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_cui_shan",
    "text": "都是我杀的！",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 37,
    "line_end": 37
  },
  {
    "index": 24,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_yin_su_su",
    "text": "你安排下叫他们冤枉我？",
    "tone": "愤怒",
    "chapter": 5,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 25,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_cui_shan",
    "text": "我也不是想陷害你，只少林、武当号称当世武学两大宗派，我想让你们两派斗上一斗，且看到底是谁强谁弱？",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 167,
    "line_end": 167
  },
  {
    "index": 26,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_yin_su_su",
    "text": "殷姑娘，你信得过我么？在下内力虽浅，但自信尚能助姑娘逼出臂上毒气。",
    "tone": "恳求",
    "chapter": 5,
    "line_start": 71,
    "line_end": 71
  },
  {
    "index": 27,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_cui_shan",
    "text": "张五哥，我说话没轻重，又打了你，请你⋯⋯你别见怪。",
    "tone": "恳求",
    "chapter": 5,
    "line_start": 125,
    "line_end": 125
  },
  {
    "index": 28,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_yin_su_su",
    "text": "天上地下，人间海底，我俩都要在一起。",
    "tone": "激动",
    "chapter": 6,
    "line_start": 175,
    "line_end": 175
  },
  {
    "index": 29,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": "char_zhang_cui_shan",
    "text": "你二人文武双全，相貌俊雅，我若杀了，有如打碎一对珍异的玉器，未免可惜，可是形格势禁，却又不得不杀。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 30,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": null,
    "text": "在那一年上，我生平最崇仰、最敬爱的一个人欺辱了我，害得我家破人亡，父母妻儿，一夕之间尽数死去。因此我断指立誓，姓谢的有生之日，决不再相信任何一人。",
    "tone": "悲伤",
    "chapter": 6,
    "line_start": 99,
    "line_end": 99
  },
  {
    "index": 31,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_xie_xun",
    "text": "你别胡说八道！",
    "tone": "愤怒",
    "chapter": 6,
    "line_start": 93,
    "line_end": 93
  },
  {
    "index": 32,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": null,
    "text": "这样的好字，我写不出，是我输了。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 33,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_xie_xun",
    "text": "原来你说过的话不算数。说道比试输了，便要听人吩咐，怎地又反悔了？",
    "tone": "嘲讽",
    "chapter": 6,
    "line_start": 57,
    "line_end": 57
  },
  {
    "index": 34,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": "char_zhang_cui_shan",
    "text": "空见这人固执得很，他竟然只挨我打，始终不肯还手，我打了他一十三拳，终于将他打死了。",
    "tone": "悲伤",
    "chapter": 7,
    "line_start": 239,
    "line_end": 239
  },
  {
    "index": 35,
    "speaker": "char_zhang_wu_ji",
    "speaker_name": "无忌",
    "listener": "char_xie_xun",
    "text": "义父也决不会害我！",
    "tone": "激动",
    "chapter": 7,
    "line_start": 255,
    "line_end": 255
  },
  {
    "index": 36,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": null,
    "text": "转北风啦，转北风啦！",
    "tone": "欣喜",
    "chapter": 8,
    "line_start": 139,
    "line_end": 139
  },
  {
    "index": 37,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_xie_xun",
    "text": "大哥，木筏离此六尺，咱们一齐跳上去罢！",
    "tone": "焦急",
    "chapter": 8,
    "line_start": 143,
    "line_end": 143
  },
  {
    "index": 38,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": "char_zhang_cui_shan",
    "text": "五弟，咱们兄弟从此永别，愿你好自珍重。",
    "tone": "悲伤",
    "chapter": 8,
    "line_start": 145,
    "line_end": 145
  },
  {
    "index": 39,
    "speaker": "char_zhang_wu_ji",
    "speaker_name": "无忌",
    "listener": "char_xie_xun",
    "text": "义父，你不去，我也不去！你自尽，我也自尽。大丈夫说得出做得到，你横刀抹脖子，我也横刀抹脖子！",
    "tone": "激动",
    "chapter": 8,
    "line_start": 171,
    "line_end": 171
  },
  {
    "index": 40,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": null,
    "text": "无恶不作、杀人如毛的恶贼谢逊，在九年前早已死了。",
    "tone": "陈述",
    "chapter": 8,
    "line_start": 273,
    "line_end": 273
  },
  {
    "index": 41,
    "speaker": "char_zhang_wu_ji",
    "speaker_name": "无忌",
    "listener": null,
    "text": "义父不是恶贼，义父他没死，他没有死。",
    "tone": "悲伤",
    "chapter": 8,
    "line_start": 285,
    "line_end": 285
  },
  {
    "index": 42,
    "speaker": "char_xie_xun",
    "speaker_name": "谢逊",
    "listener": null,
    "text": "五弟，五妹，无忌！一路顺风，盼你们平平安安，早归中土！",
    "tone": "激动",
    "chapter": 8,
    "line_start": 173,
    "line_end": 173
  },
  {
    "index": 43,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_wu_ji",
    "text": "张五哥，我俩若能不死，我要永远跟着你在一起。",
    "tone": "欣喜",
    "chapter": 6,
    "line_start": 175,
    "line_end": 175
  },
  {
    "index": 44,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_yin_su_su",
    "text": "以后你改过迁善，多积功德，常言道：知过能改，善莫大焉。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 193,
    "line_end": 193
  },
  {
    "index": 45,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_xie_xun",
    "text": "我先叫你大哥，咱们是拜把子的兄妹。他若再叫你前辈，我也成了他的前辈啦！",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 217,
    "line_end": 217
  },
  {
    "index": 46,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": "char_xie_xun",
    "text": "大哥既决意如此，小弟便此拜别。",
    "tone": "悲伤",
    "chapter": 8,
    "line_start": 171,
    "line_end": 171
  },
  {
    "index": 47,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": "char_zhang_wu_ji",
    "text": "你长大了之后，要提防女人骗你，越是好看的女人，越会骗人。",
    "tone": "悲伤",
    "chapter": 10,
    "line_start": 357,
    "line_end": 357
  },
  {
    "index": 48,
    "speaker": "char_yin_su_su",
    "speaker_name": "殷素素",
    "listener": null,
    "text": "龙门镖局那七十几条性命明明不是张五侠杀的，你们冤枉于他，那便是颠倒是非，混淆黑白！",
    "tone": "愤怒",
    "chapter": 10,
    "line_start": 279,
    "line_end": 279
  },
  {
    "index": 49,
    "speaker": "char_zhang_cui_shan",
    "speaker_name": "张翠山",
    "listener": null,
    "text": "我妻子杀了不少少林弟子，那时她可还不识得我，但我夫妇一体，所有罪孽，当由张翠山一人承当！我和金毛狮王义结金兰，你们觊觎屠龙宝刀，想逼我对不起义兄，武当弟子岂是这等卑鄙无义之徒！",
    "tone": "愤怒",
    "chapter": 10,
    "line_start": 325,
    "line_end": 325
  }
]

### chapter_summaries.json (40 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 1,
        "anchor": "觉远大师圆寂前默诵九阳真经"
      },
      {
        "event_type": "背景",
        "chapter": 1,
        "anchor": "无色禅师赠铁罗汉给郭襄"
      },
      {
        "event_type": "背景",
        "chapter": 1,
        "anchor": "张君宝被逐出少林"
      }
    ],
    "key_characters": [
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 2,
        "anchor": "张三丰创立武当派"
      },
      {
        "event_type": "背景",
        "chapter": 2,
        "anchor": "武当七侠名震江湖"
      }
    ],
    "key_characters": [
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 3,
        "anchor": "俞岱岩遭遇海沙派与白袍客"
      },
      {
        "event_type": "冲突",
        "chapter": 3,
        "anchor": "白袍客以大力金刚指伤俞岱岩"
      },
      {
        "event_type": "背景",
        "chapter": 3,
        "anchor": "俞岱岩从此残废"
      }
    ],
    "key_characters": [
      "char_yu_dai_yan"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 4,
        "anchor": "三人漂流至冰火岛"
      },
      {
        "event_type": "背景",
        "chapter": 4,
        "anchor": "张翠山殷素素成婚"
      },
      {
        "event_type": "背景",
        "chapter": 4,
        "anchor": "张无忌出生"
      },
      {
        "event_type": "背景",
        "chapter": 4,
        "anchor": "谢逊讲述成昆恩怨"
      }
    ],
    "key_characters": [
      "char_zhang_cui_shan",
      "char_yin_su_su",
      "char_xie_xun",
      "char_zhang_wu_ji"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 5,
        "anchor": "张翠山与殷素素在钱塘江相遇"
      },
      {
        "event_type": "冲突",
        "chapter": 5,
        "anchor": "殷素素承认杀害龙门镖局"
      },
      {
        "event_type": "背景",
        "chapter": 5,
        "anchor": "殷素素安排少林僧冤枉张翠山"
      }
    ],
    "key_characters": [
      "char_zhang_cui_shan",
      "char_yin_su_su"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 6,
        "anchor": "谢逊讲述成昆灭门往事"
      },
      {
        "event_type": "背景",
        "chapter": 6,
        "anchor": "空见神僧受十三记七伤拳"
      }
    ],
    "key_characters": [
      "char_xie_xun",
      "char_zhang_cui_shan"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 7,
        "anchor": "谢逊讲述成昆灭门经过"
      },
      {
        "event_type": "背景",
        "chapter": 7,
        "anchor": "谢逊苦练七伤拳报仇"
      },
      {
        "event_type": "背景",
        "chapter": 7,
        "anchor": "谢逊打死空见神僧"
      }
    ],
    "key_characters": [
      "char_xie_xun",
      "char_cheng_kun"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 8,
        "anchor": "谢逊放张翠山一家回归中原"
      },
      {
        "event_type": "背景",
        "chapter": 8,
        "anchor": "张无忌身中玄冥神掌"
      },
      {
        "event_type": "背景",
        "chapter": 8,
        "anchor": "张三丰带张无忌求医"
      }
    ],
    "key_characters": [
      "char_xie_xun",
      "char_zhang_wu_ji",
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 9,
        "anchor": "各派追问谢逊下落"
      },
      {
        "event_type": "背景",
        "chapter": 9,
        "anchor": "灭绝师太首次出场"
      },
      {
        "event_type": "背景",
        "chapter": 9,
        "anchor": "俞岱岩往事"
      }
    ],
    "key_characters": [
      "char_yu_lian_zhou",
      "char_zhang_cui_shan",
      "char_mie_jue_shi_tai"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回",
    "key_events": [
      {
        "event_type": "死亡",
        "chapter": 10,
        "anchor": "张翠山自刎而死"
      },
      {
        "event_type": "死亡",
        "chapter": 10,
        "anchor": "殷素素自尽殉夫"
      },
      {
        "event_type": "背景",
        "chapter": 10,
        "anchor": "张三丰收留张无忌"
      }
    ],
    "key_characters": [
      "char_zhang_cui_shan",
      "char_yin_su_su",
      "char_zhang_wu_ji",
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 11,
        "anchor": "张无忌寒毒发作"
      },
      {
        "event_type": "背景",
        "chapter": 11,
        "anchor": "张无忌与周芷若汉水相遇"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhou_zhi_ruo",
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 12,
        "anchor": "张无忌在蝴蝶谷学医"
      },
      {
        "event_type": "背景",
        "chapter": 12,
        "anchor": "纪晓芙出场"
      },
      {
        "event_type": "背景",
        "chapter": 12,
        "anchor": "张无忌认出殷离"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_ji_xiao_fu",
      "char_yin_li"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回",
    "key_events": [
      {
        "event_type": "死亡",
        "chapter": 13,
        "anchor": "纪晓芙被灭绝师太击毙"
      },
      {
        "event_type": "背景",
        "chapter": 13,
        "anchor": "灭绝师太传位给周芷若"
      }
    ],
    "key_characters": [
      "char_mie_jue_shi_tai",
      "char_ji_xiao_fu",
      "char_zhou_zhi_ruo"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 14,
        "anchor": "张无忌带杨不悔寻父"
      },
      {
        "event_type": "冲突",
        "chapter": 14,
        "anchor": "张无忌被朱九真所骗"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_yang_bu_hui"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 15,
        "anchor": "朱长龄父女骗局"
      },
      {
        "event_type": "背景",
        "chapter": 15,
        "anchor": "张无忌跌落悬崖"
      },
      {
        "event_type": "背景",
        "chapter": 15,
        "anchor": "张无忌与殷离重逢"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_yin_li"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 16,
        "anchor": "张无忌从白猿腹中取出九阳真经"
      },
      {
        "event_type": "背景",
        "chapter": 16,
        "anchor": "张无忌修炼九阳神功"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_yin_li"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 17,
        "anchor": "张无忌九阳神功初成"
      },
      {
        "event_type": "背景",
        "chapter": 17,
        "anchor": "张无忌与周芷若重逢"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_yin_li",
      "char_zhou_zhi_ruo"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 18,
        "anchor": "殷梨亭与魔教道人战斗"
      },
      {
        "event_type": "背景",
        "chapter": 18,
        "anchor": "蛛儿打听张无忌下落"
      },
      {
        "event_type": "冲突",
        "chapter": 18,
        "anchor": "灭绝师太斩杀锐金旗"
      }
    ],
    "key_characters": [
      "char_yin_li_ting",
      "char_yin_li",
      "char_mie_jue_shi_tai"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 19,
        "anchor": "张无忌九阳神功大成"
      },
      {
        "event_type": "背景",
        "chapter": 19,
        "anchor": "成昆在密道中现身"
      },
      {
        "event_type": "冲突",
        "chapter": 19,
        "anchor": "成昆讲述阴谋"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_cheng_kun"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 20,
        "anchor": "张无忌与小昭发现阳顶天遗书"
      },
      {
        "event_type": "背景",
        "chapter": 20,
        "anchor": "张无忌练成乾坤大挪移"
      },
      {
        "event_type": "背景",
        "chapter": 20,
        "anchor": "小昭对张无忌产生深情"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_xiao_zhao"
    ]
  },
  {
    "chapter": 21,
    "title": "第二十一回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 21,
        "anchor": "张无忌说服崆峒五老"
      },
      {
        "event_type": "冲突",
        "chapter": 21,
        "anchor": "张无忌对抗正反两仪刀剑"
      },
      {
        "event_type": "背景",
        "chapter": 21,
        "anchor": "揭露成昆冒名杀人"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhou_zhi_ruo"
    ]
  },
  {
    "chapter": 22,
    "title": "第二十二回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 22,
        "anchor": "六大派围攻失败"
      },
      {
        "event_type": "背景",
        "chapter": 22,
        "anchor": "明教总坛被焚"
      },
      {
        "event_type": "背景",
        "chapter": 22,
        "anchor": "张无忌被推举为教主"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_yang_xiao"
    ]
  },
  {
    "chapter": 23,
    "title": "第二十三回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 23,
        "anchor": "赵敏在绿柳山庄设毒计"
      },
      {
        "event_type": "冲突",
        "chapter": 23,
        "anchor": "张无忌与赵敏地牢对话"
      },
      {
        "event_type": "冲突",
        "chapter": 23,
        "anchor": "明教群豪中毒被挟"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min"
    ]
  },
  {
    "chapter": 24,
    "title": "第二十四回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 24,
        "anchor": "成昆指使攻打武当山"
      },
      {
        "event_type": "背景",
        "chapter": 24,
        "anchor": "张三丰传授张无忌太极拳"
      },
      {
        "event_type": "冲突",
        "chapter": 24,
        "anchor": "张无忌以太极拳对敌"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 25,
    "title": "第二十五回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 25,
        "anchor": "张无忌治愈俞岱岩殷梨亭"
      },
      {
        "event_type": "背景",
        "chapter": 25,
        "anchor": "赵敏向张三丰赔罪"
      },
      {
        "event_type": "背景",
        "chapter": 25,
        "anchor": "得知六大派被囚万安寺"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min",
      "char_zhang_san_feng"
    ]
  },
  {
    "chapter": 26,
    "title": "第二十六回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 26,
        "anchor": "张无忌设计营救六大派"
      },
      {
        "event_type": "背景",
        "chapter": 26,
        "anchor": "范遥潜入万安寺"
      },
      {
        "event_type": "背景",
        "chapter": 26,
        "anchor": "赵敏观看各派比剑"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min"
    ]
  },
  {
    "chapter": 27,
    "title": "第二十七回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 27,
        "anchor": "范遥在万安寺塔中周旋"
      },
      {
        "event_type": "冲突",
        "chapter": 27,
        "anchor": "各派高手在塔中比武"
      }
    ],
    "key_characters": [
      "char_zhao_min"
    ]
  },
  {
    "chapter": 28,
    "title": "第二十八回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 28,
        "anchor": "张无忌出海寻找谢逊"
      },
      {
        "event_type": "冲突",
        "chapter": 28,
        "anchor": "金花婆婆出现"
      },
      {
        "event_type": "背景",
        "chapter": 28,
        "anchor": "张无忌与谢逊重逢"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_xie_xun",
      "char_zhao_min"
    ]
  },
  {
    "chapter": 29,
    "title": "第二十九回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 29,
        "anchor": "波斯三使持圣火令到来"
      },
      {
        "event_type": "冲突",
        "chapter": 29,
        "anchor": "张无忌与波斯三使激战"
      },
      {
        "event_type": "背景",
        "chapter": 29,
        "anchor": "四女同舟"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_xie_xun",
      "char_zhao_min"
    ]
  },
  {
    "chapter": 30,
    "title": "第三十回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 30,
        "anchor": "紫衫龙王身份揭露"
      },
      {
        "event_type": "背景",
        "chapter": 30,
        "anchor": "张无忌习得圣火令武功"
      },
      {
        "event_type": "背景",
        "chapter": 30,
        "anchor": "谢逊讲述与成昆决战"
      }
    ],
    "key_characters": [
      "char_xie_xun",
      "char_zhang_wu_ji"
    ]
  },
  {
    "chapter": 31,
    "title": "第三十一回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 31,
        "anchor": "陈友谅在丐帮挑拨"
      },
      {
        "event_type": "背景",
        "chapter": 31,
        "anchor": "史火龙被成昆暗害"
      },
      {
        "event_type": "背景",
        "chapter": 31,
        "anchor": "张无忌调查成昆阴谋"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji"
    ]
  },
  {
    "chapter": 32,
    "title": "第三十二回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 32,
        "anchor": "张无忌以圣火令武功震慑敌手"
      },
      {
        "event_type": "背景",
        "chapter": 32,
        "anchor": "众人商议营救谢逊"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min"
    ]
  },
  {
    "chapter": 33,
    "title": "第三十三回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 33,
        "anchor": "张无忌揭露陈友谅阴谋"
      },
      {
        "event_type": "冲突",
        "chapter": 33,
        "anchor": "黄衫女子出场清理门户"
      },
      {
        "event_type": "背景",
        "chapter": 33,
        "anchor": "得知谢逊被囚少林寺"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji"
    ]
  },
  {
    "chapter": 34,
    "title": "第三十四回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 34,
        "anchor": "张无忌前往少林寺"
      },
      {
        "event_type": "冲突",
        "chapter": 34,
        "anchor": "张无忌首次攻打金刚伏魔圈失利"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_xie_xun"
    ]
  },
  {
    "chapter": 35,
    "title": "第三十五回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 35,
        "anchor": "赵敏揭露成昆全部阴谋"
      },
      {
        "event_type": "背景",
        "chapter": 35,
        "anchor": "赵敏与张无忌假扮夫妻"
      }
    ],
    "key_characters": [
      "char_zhao_min",
      "char_zhang_wu_ji"
    ]
  },
  {
    "chapter": 36,
    "title": "第三十六回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 36,
        "anchor": "少林寺英雄大会召开"
      },
      {
        "event_type": "冲突",
        "chapter": 36,
        "anchor": "金刚伏魔圈守卫谢逊"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min",
      "char_zhou_zhi_ruo"
    ]
  },
  {
    "chapter": 37,
    "title": "第三十七回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 37,
        "anchor": "英雄大会比武"
      },
      {
        "event_type": "死亡",
        "chapter": 37,
        "anchor": "殷天正力竭而亡"
      },
      {
        "event_type": "冲突",
        "chapter": 37,
        "anchor": "张无忌与周芷若联手攻打金刚伏魔圈"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min",
      "char_zhou_zhi_ruo",
      "char_yin_tian_zheng"
    ]
  },
  {
    "chapter": 38,
    "title": "第三十八回",
    "key_events": [
      {
        "event_type": "冲突",
        "chapter": 38,
        "anchor": "成昆现身与空智破脸"
      },
      {
        "event_type": "背景",
        "chapter": 38,
        "anchor": "赵敏救出空闻"
      },
      {
        "event_type": "背景",
        "chapter": 38,
        "anchor": "张无忌与赵敏月下定情"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min",
      "char_zhou_zhi_ruo",
      "char_cheng_kun"
    ]
  },
  {
    "chapter": 39,
    "title": "第三十九回",
    "key_events": [
      {
        "event_type": "高潮",
        "chapter": 39,
        "anchor": "谢逊与成昆最终对决"
      },
      {
        "event_type": "结局",
        "chapter": 39,
        "anchor": "谢逊自废武功皈依佛门"
      },
      {
        "event_type": "结局",
        "chapter": 39,
        "anchor": "成昆被废去双目和武功"
      }
    ],
    "key_characters": [
      "char_xie_xun",
      "char_cheng_kun"
    ]
  },
  {
    "chapter": 40,
    "title": "第四十回",
    "key_events": [
      {
        "event_type": "背景",
        "chapter": 40,
        "anchor": "张三丰传授张无忌太极拳剑"
      },
      {
        "event_type": "背景",
        "chapter": 40,
        "anchor": "朱元璋野心渐露"
      },
      {
        "event_type": "背景",
        "chapter": 40,
        "anchor": "张无忌辞去教主之位"
      },
      {
        "event_type": "背景",
        "chapter": 40,
        "anchor": "张无忌与赵敏归隐"
      }
    ],
    "key_characters": [
      "char_zhang_wu_ji",
      "char_zhao_min",
      "char_zhang_san_feng"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
