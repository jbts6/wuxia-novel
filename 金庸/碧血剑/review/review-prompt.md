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
    "id": "char_yuan_cheng_zhi",
    "name": "袁承志",
    "role": "核心",
    "identity": "袁崇焕之子，华山派弟子，后成为'金蛇王'辅佐李自成",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕之子，华山派弟子，后成为'金蛇王'辅佐李自成"
  },
  {
    "id": "char_xia_qing_qing",
    "name": "夏青青",
    "role": "核心",
    "identity": "金蛇郎君之女，与袁承志相爱，性格活泼直率",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "金蛇郎君之女，与袁承志相爱，性格活泼直率"
  },
  {
    "id": "char_a_jiu",
    "name": "阿九",
    "role": "核心",
    "identity": "崇祯之女长平公主，后出家为尼，与袁承志相爱",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "崇祯之女长平公主，后出家为尼，与袁承志相爱"
  },
  {
    "id": "char_li_zi_cheng",
    "name": "李自成",
    "role": "核心",
    "identity": "闯王，农民起义领袖，攻破北京建立大顺政权",
    "faction": "faction_chuang_jun",
    "personality": [
      "雄才大略",
      "后期骄纵",
      "草莽英雄"
    ],
    "one_line": "闯王，农民起义领袖，攻破北京建立大顺政权"
  },
  {
    "id": "char_chong_zhen_huang_di",
    "name": "崇祯皇帝",
    "role": "重要",
    "identity": "明朝末代皇帝，刚愎自用，最终煤山自缢",
    "faction": "faction_ming_chao",
    "personality": [
      "刚愎自用",
      "多疑猜忌",
      "勤政却无能"
    ],
    "one_line": "明朝末代皇帝，刚愎自用，最终煤山自缢"
  },
  {
    "id": "char_gui_xin_shu",
    "name": "归辛树",
    "role": "重要",
    "identity": "袁承志二师兄，'神拳无敌'，后与袁承志对立",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志二师兄，'神拳无敌'，后与袁承志对立"
  },
  {
    "id": "char_mu_sang_dao_ren",
    "name": "木桑道人",
    "role": "重要",
    "identity": "华山派前辈，轻功暗器天下独步，袁承志的良师益友",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派前辈，轻功暗器天下独步，袁承志的良师益友"
  },
  {
    "id": "char_he_ti_shou",
    "name": "何惕守",
    "role": "重要",
    "identity": "五毒教教主，后拜袁承志为师，性格娇媚妖艳",
    "faction": "faction_wu_du_jiao",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "五毒教教主，后拜袁承志为师，性格娇媚妖艳"
  },
  {
    "id": "char_yuan_chong_huan",
    "name": "袁崇焕",
    "role": "重要",
    "identity": "袁承志之父，明朝名将，被崇祯冤杀",
    "faction": "faction_ming_chao",
    "personality": [
      "忠勇无双",
      "含冤而死",
      "军事天才"
    ],
    "one_line": "袁承志之父，明朝名将，被崇祯冤杀"
  },
  {
    "id": "char_an_da_niang",
    "name": "安大娘",
    "role": "次要",
    "identity": "袁承志的养母，关键时刻帮助袁承志",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志的养母，关键时刻帮助袁承志"
  },
  {
    "id": "char_ya_ba",
    "name": "哑巴",
    "role": "次要",
    "identity": "华山派仆人，武功高强但沉默寡言",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派仆人，武功高强但沉默寡言"
  },
  {
    "id": "char_sun_zhong_jun",
    "name": "孙仲君",
    "role": "次要",
    "identity": "归辛树弟子，性格泼辣，因滥伤无辜被削指",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "归辛树弟子，性格泼辣，因滥伤无辜被削指"
  },
  {
    "id": "char_jiao_wan_er",
    "name": "焦宛儿",
    "role": "次要",
    "identity": "焦公礼之女，对袁承志有好感",
    "faction": "faction_jiao_jia",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "焦公礼之女，对袁承志有好感"
  },
  {
    "id": "char_hong_sheng_hai",
    "name": "洪胜海",
    "role": "次要",
    "identity": "袁承志的长随，忠心耿耿",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志的长随，忠心耿耿"
  },
  {
    "id": "char_cui_qiu_shan",
    "name": "崔秋山",
    "role": "次要",
    "identity": "闯军将领，袁承志的启蒙师傅",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领，袁承志的启蒙师傅"
  },
  {
    "id": "char_li_yan",
    "name": "李岩",
    "role": "次要",
    "identity": "李自成谋士，袁承志的结义大哥",
    "faction": "faction_chuang_jun",
    "personality": [
      "才华横溢",
      "忠心耿耿",
      "文武双全"
    ],
    "one_line": "李自成谋士，袁承志的结义大哥"
  },
  {
    "id": "char_gui_er_niang",
    "name": "归二娘",
    "role": "次要",
    "identity": "归辛树之妻，武功高强，性格刚烈",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "归辛树之妻，武功高强，性格刚烈"
  },
  {
    "id": "char_liu_pei_sheng",
    "name": "刘培生",
    "role": "次要",
    "identity": "归辛树弟子，为人忠厚",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "归辛树弟子，为人忠厚"
  },
  {
    "id": "char_mei_jian_he",
    "name": "梅剑和",
    "role": "次要",
    "identity": "归辛树弟子，轻功了得，后收敛傲气",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "归辛树弟子，轻功了得，后收敛傲气"
  },
  {
    "id": "char_feng_nan_di",
    "name": "冯难敌",
    "role": "次要",
    "identity": "华山派第三代大弟子，江湖经验丰富",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派第三代大弟子，江湖经验丰富"
  },
  {
    "id": "char_cheng_qing_zhu",
    "name": "程青竹",
    "role": "次要",
    "identity": "丐帮长老，后成为阿九的师傅",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "丐帮长老，后成为阿九的师傅"
  },
  {
    "id": "char_sha_tian_guang",
    "name": "沙天广",
    "role": "次要",
    "identity": "山东响马，后加入闯军",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "山东响马，后加入闯军"
  },
  {
    "id": "char_tie_luo_han",
    "name": "铁罗汉",
    "role": "次要",
    "identity": "少林还俗弟子，性格豪爽",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "少林还俗弟子，性格豪爽"
  },
  {
    "id": "char_hu_gui_nan",
    "name": "胡桂南",
    "role": "次要",
    "identity": "江湖奇人，轻功了得",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "江湖奇人，轻功了得"
  },
  {
    "id": "char_wen_shi_wu_lao",
    "name": "温氏五老",
    "role": "次要",
    "identity": "温家堡五老，与袁承志为敌",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "温家堡五老，与袁承志为敌"
  },
  {
    "id": "char_he_hong_yao",
    "name": "何红药",
    "role": "次要",
    "identity": "五毒教长老，何惕守的师姐",
    "faction": "faction_wu_du_jiao",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "五毒教长老，何惕守的师姐"
  },
  {
    "id": "char_小_慧",
    "name": "小慧",
    "role": "次要",
    "identity": "安大娘之女，袁承志的青梅竹马",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "安大娘之女，袁承志的青梅竹马"
  },
  {
    "id": "char_zhang_chao_tang",
    "name": "张朝唐",
    "role": "龙套",
    "identity": "浡泥国华侨，回中土应试途中遭遇乱世",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "浡泥国华侨，回中土应试途中遭遇乱世"
  },
  {
    "id": "char_zhang_kang",
    "name": "张康",
    "role": "龙套",
    "identity": "张朝唐的书僮，忠心护主",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "张朝唐的书僮，忠心护主"
  },
  {
    "id": "char_yang_peng_ju",
    "name": "杨鹏举",
    "role": "龙套",
    "identity": "武会镖局镖头，救下张朝唐主仆",
    "faction": null,
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "武会镖局镖头，救下张朝唐主仆"
  },
  {
    "id": "char_sun_zhong_shou",
    "name": "孙仲寿",
    "role": "龙套",
    "identity": "袁崇焕旧部，山宗首领",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕旧部，山宗首领"
  },
  {
    "id": "char_tian_jian_xiu",
    "name": "田见秀",
    "role": "龙套",
    "identity": "闯军将领，与袁承志结交",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领，与袁承志结交"
  },
  {
    "id": "char_liu_fang_liang",
    "name": "刘芳亮",
    "role": "龙套",
    "identity": "闯军将领，与袁承志结交",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领，与袁承志结交"
  },
  {
    "id": "char_zhu_an_guo",
    "name": "朱安国",
    "role": "龙套",
    "identity": "袁崇焕旧部，武艺高强",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕旧部，武艺高强"
  },
  {
    "id": "char_ni_hao",
    "name": "倪浩",
    "role": "龙套",
    "identity": "袁崇焕旧部，与崔秋山交好",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕旧部，与崔秋山交好"
  },
  {
    "id": "char_ying_song",
    "name": "应松",
    "role": "龙套",
    "identity": "袁崇焕帐下谋士",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕帐下谋士"
  },
  {
    "id": "char_luo_da_qian",
    "name": "罗大千",
    "role": "龙套",
    "identity": "著名炮手，宁远一战立功",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "著名炮手，宁远一战立功"
  },
  {
    "id": "char_cao_hua_chun",
    "name": "曹化淳",
    "role": "龙套",
    "identity": "明朝太监，统率东厂和锦衣卫",
    "faction": "faction_ming_chao",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "明朝太监，统率东厂和锦衣卫"
  },
  {
    "id": "char_wang_相_yao",
    "name": "王相尧",
    "role": "龙套",
    "identity": "明朝太监，被沙寨主拿住",
    "faction": "faction_ming_chao",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "明朝太监，被沙寨主拿住"
  },
  {
    "id": "char_gu_da_cheng",
    "name": "谷大成",
    "role": "龙套",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领"
  },
  {
    "id": "char_heng_tian_wang",
    "name": "横天王",
    "role": "龙套",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领"
  },
  {
    "id": "char_ge_li_yan",
    "name": "革里眼",
    "role": "龙套",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "闯军将领"
  },
  {
    "id": "char_feng_bu_cui",
    "name": "冯不摧",
    "role": "龙套",
    "identity": "冯难敌之子，对阿九有好感",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "冯难敌之子，对阿九有好感"
  },
  {
    "id": "char_feng_bu_po",
    "name": "冯不破",
    "role": "龙套",
    "identity": "冯难敌之子，性格沉稳",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "冯难敌之子，性格沉稳"
  },
  {
    "id": "char_shi_jun",
    "name": "石骏",
    "role": "龙套",
    "identity": "华山派弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派弟子"
  },
  {
    "id": "char_mu_ren_qing",
    "name": "穆人清",
    "role": "重要",
    "identity": "华山派掌门，袁承志的师父，外号'神剑仙猿'",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功盖世",
      "德高望重",
      "隐士高人"
    ],
    "one_line": "华山派掌门，袁承志的师父，武功盖世，德高望重"
  },
  {
    "id": "char_xia_xue_yi",
    "name": "夏雪宜",
    "role": "重要",
    "identity": "金蛇郎君，夏青青之父，与温家有深仇",
    "faction": null,
    "personality": [
      "武功高强",
      "性格怪僻",
      "痴情"
    ],
    "one_line": "金蛇郎君，武功高强，性格怪僻，痴情"
  },
  {
    "id": "char_huang_zhen",
    "name": "黄真",
    "role": "重要",
    "identity": "华山派大弟子，袁承志大师兄，善于经商",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "精明能干",
      "幽默风趣"
    ],
    "one_line": "袁承志大师兄，精明能干，幽默风趣"
  },
  {
    "id": "char_wen_yi",
    "name": "温仪",
    "role": "次要",
    "identity": "温家女儿，夏雪宜的恋人，夏青青之母",
    "faction": "faction_wen_jia",
    "personality": [
      "温柔善良",
      "命运悲惨"
    ],
    "one_line": "温家女儿，温柔善良，命运悲惨"
  },
  {
    "id": "char_wen_qing_qing",
    "name": "温青青",
    "role": "次要",
    "identity": "温家子弟，与袁承志结交",
    "faction": "faction_wen_jia",
    "personality": [
      "俊美聪慧"
    ],
    "one_line": "温家子弟，俊美聪慧"
  },
  {
    "id": "char_wen_zheng",
    "name": "温正",
    "role": "次要",
    "identity": "温家子弟，武功高强",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强",
      "稳重狠辣"
    ],
    "one_line": "温家子弟，武功高强，稳重狠辣"
  },
  {
    "id": "char_jiao_gong_li",
    "name": "焦公礼",
    "role": "次要",
    "identity": "焦家掌门，被温家陷害",
    "faction": "faction_jiao_jia",
    "personality": [
      "正直忠厚"
    ],
    "one_line": "焦家掌门，正直忠厚"
  },
  {
    "id": "char_min_zi_hua",
    "name": "闵子华",
    "role": "龙套",
    "identity": "仙都派弟子，在南京设宴邀请群雄",
    "faction": "faction_xian_du_pai",
    "personality": [
      "武功平平"
    ],
    "one_line": "仙都派弟子，武功平平"
  },
  {
    "id": "char_lv_qi",
    "name": "吕七",
    "role": "龙套",
    "identity": "江湖人物，与袁承志交手",
    "faction": null,
    "personality": [
      "武功高强"
    ],
    "one_line": "江湖人物，武功高强"
  },
  {
    "id": "char_ma_gong_zi",
    "name": "马公子",
    "role": "龙套",
    "identity": "富家公子，温青青的追求者",
    "faction": null,
    "personality": [
      "纨绔"
    ],
    "one_line": "富家公子，纨绔子弟"
  },
  {
    "id": "char_duo_er_gun",
    "name": "多尔衮",
    "role": "龙套",
    "identity": "满清睿亲王，觊觎中原",
    "faction": "faction_man_qing",
    "personality": [
      "野心勃勃"
    ],
    "one_line": "满清睿亲王，野心勃勃"
  },
  {
    "id": "char_yu_zhen_zi",
    "name": "玉真子",
    "role": "龙套",
    "identity": "满清高手，武功高强",
    "faction": "faction_man_qing",
    "personality": [
      "武功高强"
    ],
    "one_line": "满清高手，武功高强"
  },
  {
    "id": "char_cui_xi_min",
    "name": "崔希敏",
    "role": "龙套",
    "identity": "崔秋山侄子，黄真弟子，华山派弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "年轻气盛"
    ],
    "one_line": "华山派弟子，年轻气盛"
  },
  {
    "id": "char_wang_zi_yong",
    "name": "王自用",
    "role": "龙套",
    "identity": "三十六营盟主",
    "faction": "faction_san_shi_liu_ying",
    "personality": [
      "豪杰"
    ],
    "one_line": "三十六营盟主，豪杰"
  },
  {
    "id": "char_gao_ying_xiang",
    "name": "高迎祥",
    "role": "龙套",
    "identity": "闯军首领，李自成之舅",
    "faction": "faction_chuang_jun",
    "personality": [
      "豪杰"
    ],
    "one_line": "闯军首领，豪杰"
  },
  {
    "id": "char_wen_nan_yang",
    "name": "温南扬",
    "role": "龙套",
    "identity": "温家子弟，讲述夏雪宜往事",
    "faction": "faction_wen_jia",
    "personality": [
      "口才好"
    ],
    "one_line": "温家子弟，口才好"
  },
  {
    "id": "char_wen_fang_shi",
    "name": "温方施",
    "role": "龙套",
    "identity": "温氏五老之一",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强"
    ],
    "one_line": "温氏五老之一，武功高强"
  },
  {
    "id": "char_wen_fang_wu",
    "name": "温方悟",
    "role": "龙套",
    "identity": "温氏五老之一",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强"
    ],
    "one_line": "温氏五老之一，武功高强"
  },
  {
    "id": "char_wen_fang_shan",
    "name": "温方山",
    "role": "龙套",
    "identity": "温氏五老之一",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强"
    ],
    "one_line": "温氏五老之一，武功高强"
  },
  {
    "id": "char_wen_fang_da",
    "name": "温方达",
    "role": "龙套",
    "identity": "温氏五老之一",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强"
    ],
    "one_line": "温氏五老之一，武功高强"
  },
  {
    "id": "char_wen_fang_lu",
    "name": "温方禄",
    "role": "龙套",
    "identity": "温氏五老之一",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强"
    ],
    "one_line": "温氏五老之一，武功高强"
  }
]

### factions.json (14 条)
[
  {
    "id": "faction_hua_shan_pai",
    "name": "华山派",
    "type": "武林门派",
    "location": "loc_hua_shan",
    "one_line": "袁承志所属门派，掌门穆人清，武林名门正派"
  },
  {
    "id": "faction_chuang_jun",
    "name": "闯军",
    "type": "军队",
    "location": "loc_shan_xi",
    "one_line": "李自成领导的农民起义军，攻破北京推翻明朝"
  },
  {
    "id": "faction_ming_chao",
    "name": "明朝",
    "type": "王族",
    "location": "loc_bei_jing",
    "one_line": "崇祯皇帝统治的末代王朝，内忧外患终至覆灭"
  },
  {
    "id": "faction_wu_du_jiao",
    "name": "五毒教",
    "type": "帮派",
    "location": "loc_yun_nan",
    "one_line": "云贵一带的邪教门派，擅使毒物，又名五仙教"
  },
  {
    "id": "faction_shan_zong",
    "name": "山宗",
    "type": "帮派",
    "location": "loc_bei_jing",
    "one_line": "袁崇焕旧部组成的秘密组织，誓死效忠袁氏血脉"
  },
  {
    "id": "faction_wen_jia_bao",
    "name": "温家堡",
    "type": "家族",
    "location": "loc_zhe_jiang",
    "one_line": "温氏五老所在家族，与金蛇郎君夏雪宜有深仇"
  },
  {
    "id": "faction_jiao_jia",
    "name": "焦家",
    "type": "家族",
    "location": "loc_nan_jing",
    "one_line": "焦公礼焦宛儿所在家族，南京焦家庄"
  },
  {
    "id": "faction_wu_hui_biao_ju",
    "name": "武会镖局",
    "type": "帮派",
    "location": "loc_bei_jing",
    "one_line": "杨鹏举所在的镖局，护送张朝唐来中土应试"
  },
  {
    "id": "faction_qing_zhu_bang",
    "name": "青竹帮",
    "type": "帮派",
    "location": "loc_bei_zhi_li",
    "one_line": "程青竹领导的江湖帮派，活跃于北直隶一带"
  },
  {
    "id": "faction_tai_shan_pai",
    "name": "泰山派",
    "type": "武林门派",
    "location": "loc_tai_shan",
    "one_line": "泰山武林门派，擅使泰山十八盘剑法"
  },
  {
    "id": "faction_da_li_duan_shi",
    "name": "大理段氏",
    "type": "家族",
    "location": "loc_da_li",
    "one_line": "云南大理的武林世家，家传剑法独步一方"
  },
  {
    "id": "faction_wu_dang_pai",
    "name": "武当派",
    "type": "武林门派",
    "location": "loc_wu_dang_shan",
    "one_line": "武林四大剑派之一，内家正宗武学深厚"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "寺院",
    "location": "loc_shao_lin_si",
    "one_line": "武林泰斗千年古刹，武学博大精深"
  },
  {
    "id": "faction_heng_shan_pai",
    "name": "恒山派",
    "type": "武林门派",
    "location": "loc_heng_shan",
    "one_line": "恒山武林门派，第十四代掌门菊潭道长曾名动天下"
  }
]

### locations.json (20 条)
[
  {
    "id": "loc_hua_shan",
    "name": "华山",
    "region": "中原",
    "one_line": "华山派所在地，袁承志学艺之处"
  },
  {
    "id": "loc_tai_shan",
    "name": "泰山",
    "region": "山东",
    "one_line": "泰山大会举办地，江湖聚会场所"
  },
  {
    "id": "loc_da_li",
    "name": "大理",
    "region": "云南",
    "one_line": "云南大理，段氏家族所在地"
  },
  {
    "id": "loc_bei_jing",
    "name": "北京",
    "region": "中原",
    "one_line": "明朝首都，李自成攻破之城"
  },
  {
    "id": "loc_nan_jing",
    "name": "南京",
    "region": "中原",
    "one_line": "明朝陪都，浡泥国王葬处"
  },
  {
    "id": "loc_浡_ni_guo",
    "name": "浡泥国",
    "region": "海外",
    "one_line": "今文莱，张朝唐的故乡"
  },
  {
    "id": "loc_zhang_zhou",
    "name": "漳州",
    "region": "福建",
    "one_line": "张朝唐的祖籍"
  },
  {
    "id": "loc_guang_zhou",
    "name": "广州",
    "region": "广东",
    "one_line": "张朝唐原计划赴考之地"
  },
  {
    "id": "loc_hong_tu_zhang",
    "name": "鸿图嶂",
    "region": "广东",
    "one_line": "张朝唐遇险之地"
  },
  {
    "id": "loc_mei_shan",
    "name": "煤山",
    "region": "北京",
    "one_line": "崇祯皇帝自缢之处"
  },
  {
    "id": "loc_cheng_tian_men",
    "name": "承天门",
    "region": "北京",
    "one_line": "李自成入京后箭射'天'字之处"
  },
  {
    "id": "loc_de_sheng_men",
    "name": "德胜门",
    "region": "北京",
    "one_line": "李自成入京经过之城门"
  },
  {
    "id": "loc_yu_hua_tai",
    "name": "雨花台",
    "region": "南京",
    "one_line": "袁承志与归辛树比武之处"
  },
  {
    "id": "loc_sheng_feng_zhang",
    "name": "圣峰嶂",
    "region": "中原",
    "one_line": "袁承志与田见秀等人结交之处"
  },
  {
    "id": "loc_shan_xi",
    "name": "陕西",
    "region": "中原",
    "one_line": "袁承志初遇李自成之地"
  },
  {
    "id": "loc_ning_yuan",
    "name": "宁远",
    "region": "辽宁",
    "one_line": "袁崇焕抗击清兵之地"
  },
  {
    "id": "loc_shan_dong",
    "name": "山东",
    "region": "中原",
    "one_line": "沙天广的势力范围"
  },
  {
    "id": "loc_bei_zhi_li",
    "name": "北直隶",
    "region": "中原",
    "one_line": "明朝京畿地区"
  },
  {
    "id": "loc_jin_shan",
    "name": "晋陕",
    "region": "中原",
    "one_line": "三十六营活动地区"
  },
  {
    "id": "loc_yun_nan",
    "name": "云南",
    "region": "西南",
    "one_line": "五毒教所在地"
  }
]

### skills.json (20 条)
[
  {
    "id": "skill_jin_she_jian_fa",
    "name": "金蛇剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "金蛇郎君夏雪宜所创剑法，袁承志的标志性武功"
  },
  {
    "id": "skill_shen_xing_bai_bian",
    "name": "神行百变",
    "type": "轻功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "木桑道人所传天下独步轻功，身法变幻莫测"
  },
  {
    "id": "skill_fu_hu_zhang_fa",
    "name": "伏虎掌法",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "华山派掌法绝学，穆人清传授给袁承志"
  },
  {
    "id": "skill_po_yu_quan",
    "name": "破玉拳",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "华山派拳法绝学，拳劲可裂石开碑"
  },
  {
    "id": "skill_hun_yuan_gong",
    "name": "混元功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "华山派内功心法，内外同修威力奇大"
  },
  {
    "id": "skill_hua_shan_jian_fa",
    "name": "华山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "华山派基础剑法，招式端正大气"
  },
  {
    "id": "skill_shi_duan_jin",
    "name": "十段锦",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "华山派入门内功，基础功法"
  },
  {
    "id": "skill_jin_she_zhui_fa",
    "name": "金蛇锥法",
    "type": "暗器",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "金蛇郎君暗器手法，配合金蛇锥使用"
  },
  {
    "id": "skill_ruan_hong_zhu_suo",
    "name": "软红蛛索",
    "type": "奇门",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "何惕守的独门兵器兼功法，以蛛丝般的软索为武器"
  },
  {
    "id": "skill_qing_zhu_zhang_fa",
    "name": "青竹杖法",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "程青竹的杖法绝技，以青竹杖为兵器"
  },
  {
    "id": "skill_hu_yan_shi_ba_bian",
    "name": "呼延十八鞭",
    "type": "鞭法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "鞭法绝技，招式刚猛凌厉"
  },
  {
    "id": "skill_tai_shan_shi_ba_pan",
    "name": "泰山十八盘",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "泰山派剑法绝学，取泰山十八盘山路之势"
  },
  {
    "id": "skill_wu_dang_jian_fa",
    "name": "武当剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "武当派内家剑法，以柔克刚"
  },
  {
    "id": "skill_shao_lin_chang_quan",
    "name": "少林长拳",
    "type": "拳法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "少林派基础拳法，少林武学根基"
  },
  {
    "id": "skill_heng_shan_jian_fa",
    "name": "恒山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "恒山派剑法，菊潭道长曾以此名动天下"
  },
  {
    "id": "skill_da_li_duan_shi_jian_fa",
    "name": "大理段氏剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "大理段氏家传剑法，独步一方"
  },
  {
    "id": "skill_wu_long_sao_di",
    "name": "乌龙扫地",
    "type": "拳法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "腿法绝技，低身扫踢威力不俗"
  },
  {
    "id": "skill_qin_na_shou_fa",
    "name": "擒拿手法",
    "type": "拳法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "擒拿格斗技法，近身搏击之术"
  },
  {
    "id": "skill_pan_guan_shuang_bi",
    "name": "判官双笔",
    "type": "奇门",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "判官笔双兵器功法，点穴打穴之术"
  },
  {
    "id": "skill_hong_yi_da_pao",
    "name": "红夷大炮",
    "type": "阵法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "西洋火炮用于攻城，罗大千曾以此立功"
  }
]

### techniques.json (0 条)
[]

### items.json (15 条)
[
  {
    "id": "item_jin_she_jian",
    "name": "金蛇剑",
    "type": "兵器",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_jin_she_jian_fa"
    ],
    "one_line": "金蛇郎君遗物，剑身金黄弯曲如蛇，袁承行走江湖的标志性兵器"
  },
  {
    "id": "item_jin_she_zhui",
    "name": "金蛇锥",
    "type": "暗器",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_jin_she_zhui_fa"
    ],
    "one_line": "金蛇郎君的暗器，形如小蛇，出手诡谲难防"
  },
  {
    "id": "item_jin_she_mi_ji",
    "name": "金蛇秘笈",
    "type": "秘籍",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_jin_she_jian_fa",
      "skill_jin_she_zhui_fa"
    ],
    "one_line": "金蛇郎君所著武学秘籍，记载金蛇剑法等绝学及破五行阵之法"
  },
  {
    "id": "item_wu_jin_bei_xin",
    "name": "乌金丝背心",
    "type": "防具",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "木桑道人赠予袁承志的防身宝衣，以乌金丝等混织而成，刀枪不入"
  },
  {
    "id": "item_jin_si_zhuo_zi",
    "name": "金丝镯子",
    "type": "饰品",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "安大娘赠予袁承志的金丝镯子，轻轻一捏便可收紧"
  },
  {
    "id": "item_yu_zan",
    "name": "玉簪",
    "type": "饰品",
    "owner": "char_a_jiu",
    "rarity_tier": "凡品",
    "related_skills": [
      "skill_jin_she_jian_fa"
    ],
    "one_line": "阿九的发簪，袁承志曾以此为兵器破五行阵"
  },
  {
    "id": "item_tie_bian",
    "name": "铁鞭",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "冯不破、冯不摧兄弟使用的兵器"
  },
  {
    "id": "item_qing_zhu_zhang",
    "name": "青竹杖",
    "type": "兵器",
    "owner": "char_a_jiu",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_qing_zhu_zhang_fa"
    ],
    "one_line": "程青竹传授阿九的兵器，以青竹制成"
  },
  {
    "id": "item_ruan_hong_zhu_suo",
    "name": "软红蛛索",
    "type": "兵器",
    "owner": "char_he_ti_shou",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "何惕守的独门兵器，数十条蛛丝般的软索"
  },
  {
    "id": "item_han_sha_she_ying",
    "name": "含沙射影",
    "type": "暗器",
    "owner": "char_he_ti_shou",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "五毒教机括暗器，按下机括即可连发毒针"
  },
  {
    "id": "item_chong_zhen_xue_zhao",
    "name": "崇祯血诏",
    "type": "信物",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "崇祯皇帝自缢前以朱笔写在白纸上的遗诏，血迹斑斑"
  },
  {
    "id": "item_pan_guan_shuang_bi",
    "name": "判官双笔",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "曹化淳手下东厂番子使用的奇门兵器"
  },
  {
    "id": "item_hong_yi_da_pao",
    "name": "红夷大炮",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "罗大千在宁远一战点燃的西洋火炮，轰死清兵无数"
  },
  {
    "id": "item_tie_suan_pan",
    "name": "铁算盘",
    "type": "兵器",
    "owner": "char_huang_zhen",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "黄真的独门兵器，铜笔铁算盘"
  },
  {
    "id": "item_zhu_bing_bing_chan",
    "name": "朱睛冰蟾",
    "type": "丹药",
    "owner": "char_mu_sang_dao_ren",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "木桑道人所有的解毒圣物，可解百毒"
  }
]

### dialogues.json (前 50 条 / 共 134 条)
[
  {
    "index": 0,
    "speaker": null,
    "speaker_name": "老头儿",
    "listener": "char_zhang_chao_tang",
    "text": "什么匪帮？土匪有这么狠吗？那是官兵干的好事。",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 1,
    "speaker": null,
    "speaker_name": "老头儿",
    "listener": "char_zhang_chao_tang",
    "text": "你这位小相公看来是第一次出门，什么世情也不懂的了。长官？长官带头干呀，好的东西他先拿，好看的娘们他先要。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 43,
    "line_end": 43
  },
  {
    "index": 2,
    "speaker": "char_zhang_chao_tang",
    "speaker_name": "张朝唐",
    "listener": null,
    "text": "官兵？官兵怎么会如此无法无天、奸淫掳掠？他们长官不理吗？",
    "tone": "激动",
    "chapter": 1,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 3,
    "speaker": "char_yang_peng_ju",
    "speaker_name": "杨鹏举",
    "listener": null,
    "text": "在下武会镖局姓杨，路经贵地，并非保镖，没向各位当家投帖拜谒。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 201,
    "line_end": 201
  },
  {
    "index": 4,
    "speaker": null,
    "speaker_name": "杨鹏举",
    "listener": null,
    "text": "杨大爷今日落在你们手中，要杀就杀，不必多说。",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 171,
    "line_end": 171
  },
  {
    "index": 5,
    "speaker": null,
    "speaker_name": "孙仲寿",
    "listener": "char_zhang_chao_tang",
    "text": "张兄文笔不凡，武穆诸葛这两句话，荣宠九泉。",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 297,
    "line_end": 297
  },
  {
    "index": 6,
    "speaker": null,
    "speaker_name": "应松",
    "listener": "char_cui_qiu_shan",
    "text": "这位幼主名叫袁承志，由我们四人教他识字练武。他聪明得很，一教就会，但再跟着我们，练下去进境一定不大。",
    "tone": "恳求",
    "chapter": 2,
    "line_start": 57,
    "line_end": 57
  },
  {
    "index": 7,
    "speaker": "char_cui_qiu_shan",
    "speaker_name": "崔秋山",
    "listener": null,
    "text": "承各位瞧得起，兄弟原不该推辞，不过兄弟现下是在闯将李大哥军中，来去无定，常跟官军接仗，也不知能活到那一天。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 61,
    "line_end": 61
  },
  {
    "index": 8,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": "char_cui_qiu_shan",
    "text": "崔叔叔，你刚才抓住那两个坏人，使的是什么功夫？",
    "tone": "疑问",
    "chapter": 2,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 9,
    "speaker": "char_cui_qiu_shan",
    "speaker_name": "崔秋山",
    "listener": "char_yuan_cheng_zhi",
    "text": "我所会的已全部传了给你，你要好好记住。日后是否有成，全凭你自己练习了。临敌时局面千变万化，七分靠功夫，三分靠机灵，一味蛮打，决难取胜。",
    "tone": "陈述",
    "chapter": 2,
    "line_start": 103,
    "line_end": 103
  },
  {
    "index": 10,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": "char_cui_qiu_shan",
    "text": "崔叔叔，我跟你到李将军那里。",
    "tone": "恳求",
    "chapter": 2,
    "line_start": 105,
    "line_end": 105
  },
  {
    "index": 11,
    "speaker": "char_an_da_niang",
    "speaker_name": "安大娘",
    "listener": "char_yuan_cheng_zhi",
    "text": "承志，我一见你就很喜欢，就当你是我的亲儿子一般。",
    "tone": "欣喜",
    "chapter": 3,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 12,
    "speaker": "char_mu_ren_qing",
    "speaker_name": "穆人清",
    "listener": "char_yuan_cheng_zhi",
    "text": "你这娃儿，谁教你叫我师父的？你怎知我准肯收你为徒？",
    "tone": "调侃",
    "chapter": 3,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 13,
    "speaker": "char_mu_ren_qing",
    "speaker_name": "穆人清",
    "listener": "char_yuan_cheng_zhi",
    "text": "好吧，瞧你故世的父亲份上，就收了你吧！",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 14,
    "speaker": "char_mu_ren_qing",
    "speaker_name": "穆人清",
    "listener": "char_yuan_cheng_zhi",
    "text": "从今而后，你是我华山派的弟子了。我多年前收过两个徒弟，此后一直没再遇到聪颖肯学的孩子，这些年来没再传人。你是我的第三个弟子，也是我的关门徒弟。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 15,
    "speaker": "char_mu_ren_qing",
    "speaker_name": "穆人清",
    "listener": "char_yuan_cheng_zhi",
    "text": "我姓穆，叫做穆人清，江湖上朋友叫我做神剑仙猿。你记着点，下次别让人家问住，你师父叫什么呀？",
    "tone": "调侃",
    "chapter": 3,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 16,
    "speaker": "char_mu_ren_qing",
    "speaker_name": "穆人清",
    "listener": "char_yuan_cheng_zhi",
    "text": "剑乃利器，以之行善，其善无穷，以之行恶，其恶亦无穷。今日我要你发个重誓，一生之中，决不可妄杀一个无辜之人。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 89,
    "line_end": 89
  },
  {
    "index": 17,
    "speaker": "char_mu_sang_dao_ren",
    "speaker_name": "木桑道人",
    "listener": null,
    "text": "好好好，有其师必有其徒，师父不要脸，徒弟也没出息。",
    "tone": "调侃",
    "chapter": 3,
    "line_start": 117,
    "line_end": 117
  },
  {
    "index": 18,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "天下的财天下人发得，难道这金子是你的？",
    "tone": "冷酷",
    "chapter": 4,
    "line_start": 111,
    "line_end": 111
  },
  {
    "index": 19,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "他们要抢你财物，既没抢去，也就罢了，何苦多伤性命？",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 151,
    "line_end": 151
  },
  {
    "index": 20,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "你没见他刚才的卑鄙恶毒么？要是我落入他手里，只怕还有更惨的呢。你别以为帮了我一次，就可随便教训人，我才不理呢。",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 153,
    "line_end": 153
  },
  {
    "index": 21,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "袁大哥，适才幸得你出声示警，叫我避开暗器，谢谢你啦。",
    "tone": "欣喜",
    "chapter": 4,
    "line_start": 153,
    "line_end": 153
  },
  {
    "index": 22,
    "speaker": null,
    "speaker_name": "温青",
    "listener": null,
    "text": "不分青红皂白，便是爱做滥好人！到底你是帮我呢，还是帮这臭老头儿？",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 237,
    "line_end": 237
  },
  {
    "index": 23,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "我不要，你都拿去，我帮你并非为了金子。",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 247,
    "line_end": 247
  },
  {
    "index": 24,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "月白风清，这么好的夜晚。袁兄雅人，不怕辜负了大好时光吗？",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 25,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "我从来不吹给谁听。他们就知道动刀动剑，也不爱听这个。",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 26,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "因此上你永远不会再来了。我⋯⋯我再也见你不着了。",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 27,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "你一定瞧得出，我什么也不懂。我初入江湖，没学会说谎。你说我心里瞧不起你，觉得你讨厌，老实说，那本来不错，我起初见你动不动杀人，很不以为然。不过现下有些不同了。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 27,
    "line_end": 27
  },
  {
    "index": 28,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "我妈妈做姑娘的时候，受了人欺侮，生下我来。我五位爷爷打不过这人，后来约了许许多多好手，才把那人打跑，因此我是没爸爸的人，我是个私生⋯⋯",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 29,
    "line_end": 29
  },
  {
    "index": 29,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "这可怪不得你，也怪不得你妈妈，是那坏人不好。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 30,
    "speaker": null,
    "speaker_name": "温青",
    "listener": "char_yuan_cheng_zhi",
    "text": "我没亲哥哥，咱们结拜为兄弟，好不好？",
    "tone": "恳求",
    "chapter": 5,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 31,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": null,
    "text": "他是我丈夫，虽然我们没拜天地，可是在我心中，他是我的亲丈夫。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 32,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": null,
    "text": "棋仙派温氏兄弟听了：送上你们弟弟温方禄尸首一具，便请笑纳。此人当年污辱我亲姊之后，又将其杀害，并将我父母兄长，一家五口尽数杀死。我孤身一人逃脱在外，现归来报仇。血债十倍回报，方解我恨。",
    "tone": "愤怒",
    "chapter": 6,
    "line_start": 43,
    "line_end": 43
  },
  {
    "index": 33,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": null,
    "text": "你为什么下我的毒？",
    "tone": "恐惧",
    "chapter": 6,
    "line_start": 161,
    "line_end": 161
  },
  {
    "index": 34,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": null,
    "text": "十九年来，我没跟爹爹说过一句话，以后我也永不会跟他说话。",
    "tone": "陈述",
    "chapter": 6,
    "line_start": 169,
    "line_end": 169
  },
  {
    "index": 35,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": "char_yuan_cheng_zhi",
    "text": "他有没有遗书？有没提到我？",
    "tone": "恳求",
    "chapter": 7,
    "line_start": 261,
    "line_end": 261
  },
  {
    "index": 36,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": null,
    "text": "他没怪我，他心里仍记着我，想着我⋯⋯而今我要去了，要去见他了⋯⋯",
    "tone": "欣喜",
    "chapter": 7,
    "line_start": 267,
    "line_end": 267
  },
  {
    "index": 37,
    "speaker": null,
    "speaker_name": "温仪",
    "listener": "char_yuan_cheng_zhi",
    "text": "我⋯⋯我世上亲人，只有⋯⋯只有这个女儿，请你⋯⋯一生一世⋯⋯照看着她⋯⋯",
    "tone": "恳求",
    "chapter": 7,
    "line_start": 269,
    "line_end": 269
  },
  {
    "index": 38,
    "speaker": null,
    "speaker_name": "黄真",
    "listener": null,
    "text": "恭喜发财！掌柜的宝号是什么字号？大老板一向做什么生意？",
    "tone": "调侃",
    "chapter": 7,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 39,
    "speaker": null,
    "speaker_name": "黄真",
    "listener": null,
    "text": "这批金子倘使是兄弟自己的，虽然现今世界不太平，赚钱不大容易，不过朋友们当真要使，拿去也没关系。须知胜败乃兵家常事，赚蚀乃商家常事。",
    "tone": "调侃",
    "chapter": 7,
    "line_start": 61,
    "line_end": 61
  },
  {
    "index": 40,
    "speaker": null,
    "speaker_name": "黄真",
    "listener": "char_yuan_cheng_zhi",
    "text": "我那有这么大的才学？这是闯王手下大将李岩李公子作的歌儿。",
    "tone": "陈述",
    "chapter": 7,
    "line_start": 243,
    "line_end": 243
  },
  {
    "index": 41,
    "speaker": null,
    "speaker_name": "黄真",
    "listener": "char_yuan_cheng_zhi",
    "text": "袁师弟，你实在一点也不懂生意经。奇货可居，怎不起价？",
    "tone": "调侃",
    "chapter": 7,
    "line_start": 183,
    "line_end": 183
  },
  {
    "index": 42,
    "speaker": null,
    "speaker_name": "青青",
    "listener": "char_yuan_cheng_zhi",
    "text": "那就叫做青梅竹马了。",
    "tone": "嘲讽",
    "chapter": 8,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 43,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "我生病也是假的呀，你别当真！",
    "tone": "欣喜",
    "chapter": 8,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 44,
    "speaker": null,
    "speaker_name": "焦公礼",
    "listener": null,
    "text": "这位恩公姓夏，外号叫做金蛇郎君。",
    "tone": "陈述",
    "chapter": 8,
    "line_start": 315,
    "line_end": 315
  },
  {
    "index": 45,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "金蛇郎君不能来了，由他公子和兄弟前来，给各位做个和事老。",
    "tone": "陈述",
    "chapter": 9,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 46,
    "speaker": null,
    "speaker_name": "孙仲君",
    "listener": "char_yuan_cheng_zhi",
    "text": "什么金蛇铁蛇，快给我下去，别在这里碍手碍脚。",
    "tone": "愤怒",
    "chapter": 9,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 47,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": null,
    "text": "久闻仙都派位居四大剑派，剑法精微奥妙，今日正好见识领教。",
    "tone": "陈述",
    "chapter": 9,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 48,
    "speaker": null,
    "speaker_name": "梅剑和",
    "listener": "char_yuan_cheng_zhi",
    "text": "你叫什么名字？谁叫你到这里来多事？",
    "tone": "愤怒",
    "chapter": 9,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 49,
    "speaker": null,
    "speaker_name": "归二娘",
    "listener": "char_yuan_cheng_zhi",
    "text": "要知学无止境，天外有天，人上有人。学了点功夫，就随便欺侮人。",
    "tone": "愤怒",
    "chapter": 9,
    "line_start": 335,
    "line_end": 335
  }
]

### chapter_summaries.json (20 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      "袁崇焕: 袁崇焕被崇祯冤杀",
      "旧部: 旧部冒死救出袁承志",
      "袁承志: 被送往华山学艺",
      "袁承志: 立下报仇雪恨之志"
    ],
    "key_characters": [
      "袁承志",
      "袁崇焕",
      "崇祯皇帝",
      "穆人清"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      "袁承志: 拜穆人清为师",
      "袁承志: 修习华山剑法",
      "袁承志: 结识黄真等师兄",
      "袁承志: 武功渐有小成"
    ],
    "key_characters": [
      "袁承志",
      "穆人清",
      "黄真"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      "袁承志: 发现金蛇郎君遗骸",
      "袁承志: 获得金蛇剑和金蛇秘籍",
      "袁承志: 习得金蛇剑法",
      "夏雪宜: 金蛇郎君往事浮现"
    ],
    "key_characters": [
      "袁承志",
      "夏雪宜（金蛇郎君）"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      "袁承志: 下山历练",
      "袁承志: 结识温青青",
      "袁承志: 初遇五毒教中人",
      "袁承志与温青青: 二人结伴同行"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "何铁手"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      "袁承志: 到达温家堡",
      "袁承志: 得知夏雪宜与温家恩怨",
      "夏雪宜与温仪: 爱情悲剧",
      "袁承志: 与温家高手交锋"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "温家五老",
      "温仪",
      "夏雪宜"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回",
    "key_events": [
      "袁承志: 与温家五老激战",
      "袁承志: 救出温仪",
      "温仪: 道出夏雪宜已死真相",
      "温青青: 得知自己身世"
    ],
    "key_characters": [
      "袁承志",
      "温家五老",
      "温仪",
      "温青青"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回",
    "key_events": [
      "袁承志: 离开温家堡",
      "袁承志: 结识归辛树夫妇",
      "木桑道长: 传授轻功神行百变",
      "袁承志: 武功与声名渐长"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "归辛树",
      "归二娘",
      "木桑道长"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回",
    "key_events": [
      "袁承志: 进入北京城",
      "袁承志: 目睹明末乱局",
      "袁承志: 结识长平公主",
      "长平公主: 对承志暗生情愫"
    ],
    "key_characters": [
      "袁承志",
      "长平公主",
      "崇祯皇帝"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回",
    "key_events": [
      "袁承志: 与满清高手交锋",
      "袁承志: 联手对抗满清势力",
      "袁承志: 卷入三方势力角逐",
      "袁承志: 思考天下大势"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "归辛树",
      "多尔衮"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回",
    "key_events": [
      "袁承志: 前往浡泥国",
      "袁承志: 遭遇当地势力迫害",
      "袁承志: 化解危机",
      "袁承志: 了解海外华人处境"
    ],
    "key_characters": [
      "袁承志",
      "温青青"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回",
    "key_events": [
      "袁承志: 发现前朝宝藏秘密",
      "袁承志: 与各方势力周旋",
      "袁承志: 应对土著敌意",
      "袁承志: 建立当地势力"
    ],
    "key_characters": [
      "袁承志",
      "温青青"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回",
    "key_events": [
      "袁承志: 返回中原",
      "袁承志: 号召江湖群雄",
      "袁承志: 接触李自成将领",
      "袁承志: 在忠义与现实间抉择"
    ],
    "key_characters": [
      "袁承志",
      "李自成",
      "温青青"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回",
    "key_events": [
      "袁承志: 参与太原守城之战",
      "袁承志: 率领武林群雄守城",
      "太原城: 被攻破",
      "袁承志: 杀出重围"
    ],
    "key_characters": [
      "袁承志",
      "李自成",
      "温青青"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回",
    "key_events": [
      "袁承志: 辗转来到北京",
      "李自成: 大军兵临城下",
      "袁承志: 目睹明朝灭亡",
      "袁承志: 感慨因果报应"
    ],
    "key_characters": [
      "袁承志",
      "崇祯皇帝",
      "李自成"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回",
    "key_events": [
      "李自成: 攻入北京",
      "崇祯皇帝: 在煤山自缢身亡",
      "袁承志: 潜入皇宫救公主",
      "袁承志: 安置长平公主"
    ],
    "key_characters": [
      "袁承志",
      "崇祯皇帝",
      "长平公主",
      "李自成"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回",
    "key_events": [
      "农民军: 纪律败坏烧杀抢掠",
      "袁承志: 对李自成深感失望",
      "袁承志: 与农民军将领冲突",
      "袁承志: 决定离开北京"
    ],
    "key_characters": [
      "袁承志",
      "李自成",
      "温青青"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回",
    "key_events": [
      "袁承志: 带领众人离开中原",
      "袁承志: 回华山拜别恩师",
      "穆人清: 嘱托承志行侠仗义",
      "袁承志: 准备出海船只"
    ],
    "key_characters": [
      "袁承志",
      "穆人清",
      "温青青",
      "归辛树"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回",
    "key_events": [
      "袁承志: 遭遇海上风暴",
      "袁承志: 击退海盗袭击",
      "袁承志: 回忆中原经历",
      "袁承志: 决心海外开创新天地"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "归辛树"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回",
    "key_events": [
      "袁承志: 到达浡泥国",
      "袁承志: 安顿众人",
      "袁承志: 开垦建立村落",
      "袁承志: 传授武艺文化给华人子弟"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "归辛树"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回",
    "key_events": [
      "袁承志: 建立海外基业",
      "袁承志: 成为华人领袖",
      "袁承志与温青青: 成亲",
      "袁承志: 遥望中原感慨万千"
    ],
    "key_characters": [
      "袁承志",
      "温青青",
      "归辛树",
      "归二娘"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
