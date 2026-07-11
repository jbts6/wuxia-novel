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

### characters.json (48 条)
[
  {
    "id": "char_shi_po_tian",
    "name": "石破天",
    "role": "核心",
    "identity": "不识字的少年",
    "faction": null,
    "personality": [
      "善良纯朴",
      "不识字",
      "武功高强"
    ],
    "one_line": "不识字的少年，被误认为长乐帮帮主，最终在石壁上领悟太玄经"
  },
  {
    "id": "char_ding_dang",
    "name": "丁珰",
    "role": "重要",
    "identity": "丁不三孙女",
    "faction": "faction_ding_jia",
    "personality": [
      "活泼刁蛮",
      "善于使毒",
      "重感情"
    ],
    "one_line": "丁不三孙女，石破天恋人，性格活泼刁蛮"
  },
  {
    "id": "char_xie_yan_ke",
    "name": "谢烟客",
    "role": "重要",
    "identity": "玄铁令主人",
    "faction": null,
    "personality": [
      "孤傲",
      "信守承诺",
      "武功高强"
    ],
    "one_line": "玄铁令主人，武功极高，性格孤傲，受三枚玄铁令约束"
  },
  {
    "id": "char_bei_hai_shi",
    "name": "贝海石",
    "role": "重要",
    "identity": "长乐帮军师",
    "faction": "faction_chang_le_bang",
    "personality": [
      "心机深沉",
      "医术高明",
      "善于权谋"
    ],
    "one_line": "长乐帮军师，外号着手成春，医术高明心机深沉"
  },
  {
    "id": "char_ding_bu_san",
    "name": "丁不三",
    "role": "重要",
    "identity": "丁家家主",
    "faction": "faction_ding_jia",
    "personality": [
      "凶残嗜杀",
      "武功高强",
      "疼爱孙女"
    ],
    "one_line": "丁珰祖父，外号一日不过三，性格凶残嗜杀"
  },
  {
    "id": "char_ding_bu_si",
    "name": "丁不四",
    "role": "重要",
    "identity": "丁不三之弟",
    "faction": "faction_ding_jia",
    "personality": [
      "性格古怪",
      "痴情",
      "武功高强"
    ],
    "one_line": "丁不三之弟，性格古怪，与史小翠有旧情"
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
      "护短"
    ],
    "one_line": "雪山派掌门，自大狂妄，后在侠客岛领悟武学真谛"
  },
  {
    "id": "char_shi_zhong_yu",
    "name": "石中玉",
    "role": "重要",
    "identity": "石破天孪生兄弟",
    "faction": null,
    "personality": [
      "品行不端",
      "油嘴滑舌",
      "好色"
    ],
    "one_line": "石破天孪生兄弟，品行不端，到处惹祸逃亡"
  },
  {
    "id": "char_shi_qing",
    "name": "石清",
    "role": "重要",
    "identity": "玄素庄庄主",
    "faction": "faction_xuan_su_zhuang",
    "personality": [
      "正派侠义",
      "武功高强",
      "爱子情深"
    ],
    "one_line": "玄素庄庄主，石破天与石中玉之父，正派侠士"
  },
  {
    "id": "char_min_rou",
    "name": "闵柔",
    "role": "重要",
    "identity": "石清之妻",
    "faction": "faction_xuan_su_zhuang",
    "personality": [
      "温柔贤淑",
      "爱子情深",
      "武功不弱"
    ],
    "one_line": "石清之妻，温柔贤淑，苦寻失散之子"
  },
  {
    "id": "char_zhang_san",
    "name": "张三",
    "role": "重要",
    "identity": "侠客岛使者",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功高强",
      "性格开朗",
      "待人和气"
    ],
    "one_line": "侠客岛赏善罚恶使者，胖使者，邀人赴岛"
  },
  {
    "id": "char_li_si",
    "name": "李四",
    "role": "重要",
    "identity": "侠客岛使者",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功高强",
      "沉默寡言",
      "行事果断"
    ],
    "one_line": "侠客岛赏善罚恶使者，瘦使者，与张三同行"
  },
  {
    "id": "char_long_dao_zhu",
    "name": "龙岛主",
    "role": "重要",
    "identity": "侠客岛岛主",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功高强",
      "深谋远虑",
      "求贤若渴"
    ],
    "one_line": "侠客岛岛主之一，邀天下高手参详太玄经"
  },
  {
    "id": "char_mu_dao_zhu",
    "name": "木岛主",
    "role": "重要",
    "identity": "侠客岛岛主",
    "faction": "faction_xia_ke_dao",
    "personality": [
      "武功高强",
      "深谋远虑",
      "求贤若渴"
    ],
    "one_line": "侠客岛岛主之一，与龙岛主共主岛务"
  },
  {
    "id": "char_shi_xiao_cui",
    "name": "史小翠",
    "role": "重要",
    "identity": "金乌派创始人",
    "faction": "faction_jin_wu_pai",
    "personality": [
      "刚烈",
      "武功高强",
      "有创见"
    ],
    "one_line": "白自在之妻，创金乌刀法克制雪山剑法"
  },
  {
    "id": "char_a_xiu",
    "name": "阿绣",
    "role": "重要",
    "identity": "白自在孙女",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "温柔善良",
      "纯真",
      "武功不高"
    ],
    "one_line": "白自在孙女，石破天真心相爱之人"
  },
  {
    "id": "char_hua_wan_zi",
    "name": "花万紫",
    "role": "次要",
    "identity": "雪山派女弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "痴情",
      "软弱",
      "被利用"
    ],
    "one_line": "雪山派女弟子，与石中玉有私情"
  },
  {
    "id": "char_feng_wan_li",
    "name": "封万里",
    "role": "次要",
    "identity": "雪山派大弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "忠厚老实",
      "武功不弱",
      "稳重"
    ],
    "one_line": "雪山派大弟子，忠厚老实"
  },
  {
    "id": "char_wang_wan_ren",
    "name": "王万仞",
    "role": "次要",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "鲁莽",
      "口无遮拦",
      "直率"
    ],
    "one_line": "雪山派弟子，性格鲁莽"
  },
  {
    "id": "char_geng_wan_zhong",
    "name": "耿万钟",
    "role": "次要",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "稳重",
      "有责任心",
      "武功不弱"
    ],
    "one_line": "雪山派弟子，奉命追捕石中玉"
  },
  {
    "id": "char_ke_wan_jun",
    "name": "柯万钧",
    "role": "次要",
    "identity": "雪山派弟子",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "稳重",
      "武功不弱"
    ],
    "one_line": "雪山派弟子，与耿万钟同行"
  },
  {
    "id": "char_cheng_zi_xue",
    "name": "成自学",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "有野心",
      "武功不弱"
    ],
    "one_line": "雪山派长老，参与门派内争"
  },
  {
    "id": "char_qi_zi_mian",
    "name": "齐自勉",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "有野心",
      "武功不弱"
    ],
    "one_line": "雪山派长老，与成自学对立"
  },
  {
    "id": "char_liao_zi_li",
    "name": "廖自砺",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "有野心",
      "武功不弱"
    ],
    "one_line": "雪山派长老，卷入掌门之争"
  },
  {
    "id": "char_liang_zi_jin",
    "name": "梁自进",
    "role": "次要",
    "identity": "雪山派长老",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "忠心",
      "武功不弱"
    ],
    "one_line": "雪山派长老，支持白自在"
  },
  {
    "id": "char_an_feng_ri",
    "name": "安奉日",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "忠心",
      "武功不弱"
    ],
    "one_line": "长乐帮香主，忠于帮主"
  },
  {
    "id": "char_zhan_fei",
    "name": "展飞",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功不弱",
      "稳重"
    ],
    "one_line": "长乐帮香主，武功不弱"
  },
  {
    "id": "char_mi_heng_ye",
    "name": "米横野",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "沉稳",
      "武功不弱"
    ],
    "one_line": "长乐帮香主，性格沉稳"
  },
  {
    "id": "char_qiu_shan_feng",
    "name": "邱山风",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功不弱"
    ],
    "one_line": "长乐帮香主"
  },
  {
    "id": "char_chen_chong_zhi",
    "name": "陈冲之",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功不弱"
    ],
    "one_line": "长乐帮香主"
  },
  {
    "id": "char_yun_xiang_zhu",
    "name": "云香主",
    "role": "次要",
    "identity": "长乐帮香主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "武功不弱"
    ],
    "one_line": "长乐帮香主"
  },
  {
    "id": "char_yuan_cheng_dao_ren",
    "name": "元澄道人",
    "role": "次要",
    "identity": "上清观道士",
    "faction": "faction_shang_qing_guan",
    "personality": [
      "武功不弱",
      "正直"
    ],
    "one_line": "上清观道士，被长乐帮所迫"
  },
  {
    "id": "char_miao_di",
    "name": "妙谛",
    "role": "次要",
    "identity": "少林高僧",
    "faction": "faction_shao_lin_pai",
    "personality": [
      "武功高强",
      "德高望重"
    ],
    "one_line": "少林高僧，受邀赴侠客岛"
  },
  {
    "id": "char_yu_cha",
    "name": "愚茶",
    "role": "次要",
    "identity": "武当高道",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "武功高强",
      "德高望重"
    ],
    "one_line": "武当高道，受邀赴侠客岛"
  },
  {
    "id": "char_tian_xu",
    "name": "天虚",
    "role": "龙套",
    "identity": "武林名宿",
    "faction": null,
    "personality": [
      "武功不弱"
    ],
    "one_line": "武林名宿，被邀赴侠客岛"
  },
  {
    "id": "char_zhou_mu",
    "name": "周牧",
    "role": "龙套",
    "identity": "马贼首领",
    "faction": null,
    "personality": [
      "凶悍"
    ],
    "one_line": "黄河岸边马贼首领"
  },
  {
    "id": "char_wen_ren_hou",
    "name": "温仁厚",
    "role": "龙套",
    "identity": "关东四大门派掌门",
    "faction": "faction_guan_dong_si_da_men_pai",
    "personality": [
      "武功不弱"
    ],
    "one_line": "关东四大门派掌门之一"
  },
  {
    "id": "char_fan_yi_fei",
    "name": "范一飞",
    "role": "龙套",
    "identity": "关东四大门派掌门",
    "faction": "faction_guan_dong_si_da_men_pai",
    "personality": [
      "武功不弱"
    ],
    "one_line": "关东四大门派掌门之一"
  },
  {
    "id": "char_lv_zheng_ping",
    "name": "吕正平",
    "role": "龙套",
    "identity": "关东四大门派掌门",
    "faction": "faction_guan_dong_si_da_men_pai",
    "personality": [
      "武功不弱"
    ],
    "one_line": "关东四大门派掌门之一"
  },
  {
    "id": "char_gao_san_niang_zi",
    "name": "高三娘子",
    "role": "龙套",
    "identity": "关东四大门派掌门",
    "faction": "faction_guan_dong_si_da_men_pai",
    "personality": [
      "豪爽",
      "武功不弱"
    ],
    "one_line": "关东四大门派掌门之一，女中豪杰"
  },
  {
    "id": "char_feng_liang",
    "name": "风良",
    "role": "龙套",
    "identity": "武林人物",
    "faction": null,
    "personality": [
      "武功不弱"
    ],
    "one_line": "武林人物，被邀赴侠客岛"
  },
  {
    "id": "char_ni_bu_da",
    "name": "倪不大",
    "role": "龙套",
    "identity": "武林人物",
    "faction": null,
    "personality": [
      "身材矮小"
    ],
    "one_line": "身材矮小的武林人物"
  },
  {
    "id": "char_ni_bu_xiao",
    "name": "倪不小",
    "role": "龙套",
    "identity": "武林人物",
    "faction": null,
    "personality": [
      "身材高大"
    ],
    "one_line": "身材高大的武林人物，倪不大之伴"
  },
  {
    "id": "char_li_da_yuan",
    "name": "李大元",
    "role": "龙套",
    "identity": "铁叉会首领",
    "faction": "faction_tie_cha_hui",
    "personality": [
      "凶悍"
    ],
    "one_line": "铁叉会首领"
  },
  {
    "id": "char_si_tu_heng",
    "name": "司徒横",
    "role": "龙套",
    "identity": "长乐帮前任帮主",
    "faction": "faction_chang_le_bang",
    "personality": [
      "被架空"
    ],
    "one_line": "长乐帮前任帮主，被贝海石架空"
  },
  {
    "id": "char_mei_wen_xin",
    "name": "梅文馨",
    "role": "龙套",
    "identity": "丁不四旧情人",
    "faction": null,
    "personality": [
      "痴情"
    ],
    "one_line": "丁不四的旧情人，梅芳姑之母"
  },
  {
    "id": "char_mei_fang_gu",
    "name": "梅芳姑",
    "role": "龙套",
    "identity": "暗恋石清的女子",
    "faction": null,
    "personality": [
      "偏激",
      "痴情"
    ],
    "one_line": "暗恋石清的女子，性情偏激"
  },
  {
    "id": "char_bai_wan_jian",
    "name": "白万剑",
    "role": "次要",
    "identity": "雪山派少主",
    "faction": "faction_xue_shan_pai",
    "personality": [
      "武功不弱",
      "有担当"
    ],
    "one_line": "白自在之子，雪山派少主"
  }
]

### factions.json (12 条)
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
    "location": "loc_chang_le_bang_zong_duo",
    "one_line": "江南大帮会，石破天被误认为帮主，贝海石掌实权"
  },
  {
    "id": "faction_xia_ke_dao",
    "name": "侠客岛",
    "type": "帮派",
    "location": "loc_xia_ke_dao",
    "one_line": "神秘海外岛屿势力，每十年派赏善罚恶使者邀武林高手赴岛"
  },
  {
    "id": "faction_ding_jia",
    "name": "丁家",
    "type": "家族",
    "location": null,
    "one_line": "丁不三、丁不四兄弟及其后人组成的武林家族"
  },
  {
    "id": "faction_xuan_su_zhuang",
    "name": "玄素庄",
    "type": "家族",
    "location": "loc_xuan_su_zhuang",
    "one_line": "石清闵柔夫妇的庄园，江南武林世家"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "武林门派",
    "location": null,
    "one_line": "武林第一大派，千年古刹，武学博大精深"
  },
  {
    "id": "faction_wu_dang_pai",
    "name": "武当派",
    "type": "武林门派",
    "location": null,
    "one_line": "道家名门，内家武学正宗，两仪剑法闻名天下"
  },
  {
    "id": "faction_shang_qing_guan",
    "name": "上清观",
    "type": "寺院",
    "location": "loc_shang_qing_guan",
    "one_line": "道观门派，元澄道人所属，擅长上清剑法"
  },
  {
    "id": "faction_tie_cha_hui",
    "name": "铁叉会",
    "type": "帮派",
    "location": null,
    "one_line": "江湖小帮派，以铁叉为标志，李大元为首领"
  },
  {
    "id": "faction_jin_wu_pai",
    "name": "金乌派",
    "type": "武林门派",
    "location": null,
    "one_line": "史小翠创立的门派，金乌刀法专克雪山剑法"
  },
  {
    "id": "faction_guan_dong_si_da_men_pai",
    "name": "关东四大门派",
    "type": "帮派",
    "location": null,
    "one_line": "关东武林联盟，温仁厚、范一飞、吕正平、高三娘子四大掌门并称"
  },
  {
    "id": "faction_fei_yu_bang",
    "name": "飞鱼帮",
    "type": "帮派",
    "location": null,
    "one_line": "水上帮派，与长乐帮有往来"
  }
]

### locations.json (19 条)
[
  {
    "id": "loc_xia_ke_dao",
    "name": "侠客岛",
    "region": "南海",
    "one_line": "神秘海外岛屿，藏有太玄经石壁，每十年邀武林高手赴岛"
  },
  {
    "id": "loc_ling_xiao_cheng",
    "name": "凌霄城",
    "region": "西域",
    "one_line": "雪山派总舵，位于西域雪山之中，地势险峻"
  },
  {
    "id": "loc_xuan_su_zhuang",
    "name": "玄素庄",
    "region": "江南",
    "one_line": "石清闵柔夫妇的庄园，江南武林世家"
  },
  {
    "id": "loc_mo_tian_ya",
    "name": "摩天崖",
    "region": "中原",
    "one_line": "谢烟客隐居之地，地势险峻，高耸入云"
  },
  {
    "id": "loc_hou_ling",
    "name": "猴岭",
    "region": "中原",
    "one_line": "石破天幼年生长之地，荒僻山村"
  },
  {
    "id": "loc_hu_lao_guan",
    "name": "虎牢关",
    "region": "中原",
    "one_line": "中原要塞，交通要道，兵家必争之地"
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
    "one_line": "江南重镇，长江要津，繁华之地"
  },
  {
    "id": "loc_nan_jing",
    "name": "南京",
    "region": "江南",
    "one_line": "六朝古都，繁华之地，江南重镇"
  },
  {
    "id": "loc_hou_jian_ji",
    "name": "侯监集",
    "region": "中原",
    "one_line": "石破天初遇谢烟客之处，小镇集市"
  },
  {
    "id": "loc_shang_qing_guan",
    "name": "上清观",
    "region": "中原",
    "one_line": "道观所在，元澄道人修行之地"
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
    "one_line": "丁不三的居所，东海小岛"
  },
  {
    "id": "loc_xiong_er_shan",
    "name": "熊耳山",
    "region": "中原",
    "one_line": "武林人物聚集之地，山势险峻"
  },
  {
    "id": "loc_tian_ning_si",
    "name": "天宁寺",
    "region": "中原",
    "one_line": "少林下院，石破天曾至此"
  },
  {
    "id": "loc_bai_jing_dao",
    "name": "白鲸岛",
    "region": "东海",
    "one_line": "白鲸岛主的据点，东海岛屿"
  },
  {
    "id": "loc_chang_le_bang_zong_duo",
    "name": "长乐帮总舵",
    "region": "江南",
    "one_line": "长乐帮的总部所在，江南大帮会之地"
  },
  {
    "id": "loc_huang_he",
    "name": "黄河",
    "region": "中原",
    "one_line": "中原大河，多处情节发生地"
  },
  {
    "id": "loc_chang_jiang",
    "name": "长江",
    "region": "江南",
    "one_line": "江南大河，水路交通要道"
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
    "id": "skill_xue_shan_jian_fa",
    "name": "雪山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "雪山派镇派剑法，精妙凌厉，招式繁复"
  },
  {
    "id": "skill_jin_wu_dao_fa",
    "name": "金乌刀法",
    "type": "刀法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "史小翠所创刀法，招招克制雪山剑法"
  },
  {
    "id": "skill_bi_zhen_qing_zhang",
    "name": "碧针清掌",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "谢烟客成名掌法，以松针练就，掌力绵长"
  },
  {
    "id": "skill_luo_han_fu_mo_shen_gong",
    "name": "罗汉伏魔神功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "少林至高内功，修炼极难，需坐枯禅"
  },
  {
    "id": "skill_ding_jia_quan",
    "name": "丁家拳",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁不三、丁不四兄弟的家传拳法，刚猛霸道"
  },
  {
    "id": "skill_ding_jia_qin_na_shou",
    "name": "丁家擒拿手",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁家的擒拿绝技，锁拿敌人关节要害"
  },
  {
    "id": "skill_ban_ruo_zhang",
    "name": "般若掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，掌力浑厚"
  },
  {
    "id": "skill_jiang_mo_zhang",
    "name": "降魔掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，专克邪魔外道"
  },
  {
    "id": "skill_nian_hua_zhi",
    "name": "拈花指",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，指力阴柔"
  },
  {
    "id": "skill_liang_yi_jian_fa",
    "name": "两仪剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "武当派的阴阳合璧剑法，需双人同使"
  },
  {
    "id": "skill_shang_qing_jian_fa",
    "name": "上清剑法",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "上清观的道家剑法，飘逸出尘"
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
    "id": "skill_shen_xing_bai_bian",
    "name": "神行百变",
    "type": "轻功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁家的轻功绝技，身法变幻莫测"
  },
  {
    "id": "skill_bi_hu_you_qiang_gong",
    "name": "壁虎游墙功",
    "type": "轻功",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "可附于墙面行走的轻功，攀爬利器"
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
    "id": "skill_fen_jin_cuo_gu_shou",
    "name": "分筋错骨手",
    "type": "指法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "伤人筋骨的擒拿手法，分筋错骨"
  },
  {
    "id": "skill_zhui_hun_duo_ming_jian",
    "name": "追魂夺命剑",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "凌厉狠辣的剑法，招招夺命"
  },
  {
    "id": "skill_liu_he_dao_fa",
    "name": "六合刀法",
    "type": "刀法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "江湖常见的刀法，朴实无华"
  },
  {
    "id": "skill_an_qi_shou_fa",
    "name": "暗器手法",
    "type": "暗器",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "各派暗器发射技艺，暗中伤人"
  },
  {
    "id": "skill_xia_ke_xing_bi_wu_gong",
    "name": "侠客行石壁武功",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "二十四间石室中的武学图谱，包含天下各派武功"
  },
  {
    "id": "skill_xuan_tie_ling_wu_gong",
    "name": "玄铁令武功",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "谢烟客以玄铁令为凭传授的武功"
  },
  {
    "id": "skill_bai_mang_bian_fa",
    "name": "白蟒鞭法",
    "type": "奇门",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "以长鞭为兵器的鞭法，鞭影如蟒"
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

### items.json (9 条)
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
    "id": "item_tai_xuan_jing_shi_bi",
    "name": "太玄经石壁",
    "type": "秘籍",
    "owner": "faction_xia_ke_dao",
    "rarity_tier": "神品",
    "related_skills": [
      "skill_tai_xuan_jing"
    ],
    "one_line": "侠客岛石壁上的武学图谱，藏有太玄经至高武学"
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
    "id": "item_ni_ren_shiba_ge",
    "name": "十八泥人",
    "type": "秘籍",
    "owner": "char_shi_po_tian",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_luo_han_fu_mo_shen_gong"
    ],
    "one_line": "大悲老人遗留的泥人，身上绘有罗汉伏魔神功图谱"
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
    "id": "item_bai_zi_zai_pei_jian",
    "name": "白自在佩剑",
    "type": "兵器",
    "owner": "char_bai_zi_zai",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_xue_shan_jian_fa"
    ],
    "one_line": "雪山派掌门白自在的佩剑，威震西域的成名兵刃"
  },
  {
    "id": "item_xia_ke_dao_mu_bei",
    "name": "侠客岛墓碑",
    "type": "奇门",
    "owner": "faction_xia_ke_dao",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "龙岛主、木岛主的墓碑，揭示侠客岛之谜的最终真相"
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
