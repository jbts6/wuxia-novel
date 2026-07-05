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

### characters.json (44 条)
[
  {
    "id": "char_yuan_cheng_zhi",
    "name": "袁承志",
    "role": "核心",
    "identity": "袁崇焕之子，华山派弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义",
      "为父报仇"
    ],
    "one_line": "袁崇焕之子，华山派弟子，后成为'金蛇王'辅佐李自成"
  },
  {
    "id": "char_xia_qing_qing",
    "name": "夏青青",
    "role": "核心",
    "identity": "金蛇郎君之女",
    "faction": null,
    "personality": [
      "活泼直率",
      "武功高强",
      "重情重义"
    ],
    "one_line": "金蛇郎君之女，与袁承志相爱，性格活泼直率"
  },
  {
    "id": "char_a_jiu",
    "name": "阿九",
    "role": "核心",
    "identity": "崇祯之女",
    "faction": null,
    "personality": [
      "端庄高贵",
      "武功高强",
      "重情重义"
    ],
    "one_line": "崇祯之女长平公主，后出家为尼，与袁承志相爱"
  },
  {
    "id": "char_li_zi_cheng",
    "name": "李自成",
    "role": "核心",
    "identity": "农民起义领袖",
    "faction": "faction_chuang_jun",
    "personality": [
      "豪迈粗犷",
      "有领导力",
      "重情重义"
    ],
    "one_line": "闯王，农民起义领袖，攻破北京建立大顺政权"
  },
  {
    "id": "char_chong_zhen",
    "name": "崇祯皇帝",
    "role": "重要",
    "identity": "明朝末代皇帝",
    "faction": "faction_ming_chao",
    "personality": [
      "刚愎自用",
      "多疑猜忌",
      "有心治国"
    ],
    "one_line": "明朝末代皇帝，刚愎自用，最终煤山自缢"
  },
  {
    "id": "char_gui_xin_shu",
    "name": "归辛树",
    "role": "重要",
    "identity": "袁承志二师兄",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "木讷深沉",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志二师兄，'神拳无敌'，后与袁承志对立"
  },
  {
    "id": "char_mu_sang_dao_ren",
    "name": "木桑道人",
    "role": "重要",
    "identity": "华山派前辈",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "诙谐幽默",
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派前辈，轻功暗器天下独步，袁承志的良师益友"
  },
  {
    "id": "char_he_ti_shou",
    "name": "何惕守",
    "role": "重要",
    "identity": "五毒教教主",
    "faction": "faction_wu_du_jiao",
    "personality": [
      "娇媚妖艳",
      "武功高强",
      "重情重义"
    ],
    "one_line": "五毒教教主，后拜袁承志为师，性格娇媚妖艳"
  },
  {
    "id": "char_yuan_chong_huan",
    "name": "袁崇焕",
    "role": "重要",
    "identity": "袁承志之父",
    "faction": "faction_ming_chao",
    "personality": [
      "忠君爱国",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志之父，明朝名将，被崇祯冤杀"
  },
  {
    "id": "char_an_da_niang",
    "name": "安大娘",
    "role": "次要",
    "identity": "袁承志的养母",
    "faction": null,
    "personality": [
      "慈爱善良",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志的养母，关键时刻帮助袁承志"
  },
  {
    "id": "char_ya_ba",
    "name": "哑巴",
    "role": "次要",
    "identity": "华山派仆人",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "沉默寡言",
      "武功高强",
      "忠心耿耿"
    ],
    "one_line": "华山派仆人，武功高强但沉默寡言"
  },
  {
    "id": "char_sun_zhong_jun",
    "name": "孙仲君",
    "role": "次要",
    "identity": "归辛树弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "性格泼辣",
      "武功高强",
      "有些狠毒"
    ],
    "one_line": "归辛树弟子，性格泼辣，因滥伤无辜被削指"
  },
  {
    "id": "char_jiao_wan_er",
    "name": "焦宛儿",
    "role": "次要",
    "identity": "焦公礼之女",
    "faction": "faction_jiao_jia",
    "personality": [
      "温柔善良",
      "武功高强",
      "重情重义"
    ],
    "one_line": "焦公礼之女，对袁承志有好感"
  },
  {
    "id": "char_hong_sheng_hai",
    "name": "洪胜海",
    "role": "次要",
    "identity": "袁承志的长随",
    "faction": null,
    "personality": [
      "忠心耿耿",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁承志的长随，忠心耿耿"
  },
  {
    "id": "char_cui_qiu_shan",
    "name": "崔秋山",
    "role": "次要",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "重情重义",
      "豪迈直率"
    ],
    "one_line": "闯军将领，袁承志的启蒙师傅"
  },
  {
    "id": "char_li_yan",
    "name": "李岩",
    "role": "次要",
    "identity": "李自成谋士",
    "faction": "faction_chuang_jun",
    "personality": [
      "足智多谋",
      "武功高强",
      "重情重义"
    ],
    "one_line": "李自成谋士，袁承志的结义大哥"
  },
  {
    "id": "char_gui_er_niang",
    "name": "归二娘",
    "role": "次要",
    "identity": "归辛树之妻",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "性格刚烈",
      "重情重义"
    ],
    "one_line": "归辛树之妻，武功高强，性格刚烈"
  },
  {
    "id": "char_liu_pei_sheng",
    "name": "刘培生",
    "role": "次要",
    "identity": "归辛树弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "为人忠厚",
      "武功高强",
      "重情重义"
    ],
    "one_line": "归辛树弟子，为人忠厚"
  },
  {
    "id": "char_mei_jian_he",
    "name": "梅剑和",
    "role": "次要",
    "identity": "归辛树弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "轻功了得",
      "有些傲气",
      "重情重义"
    ],
    "one_line": "归辛树弟子，轻功了得，后收敛傲气"
  },
  {
    "id": "char_feng_nan_di",
    "name": "冯难敌",
    "role": "次要",
    "identity": "华山派第三代大弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "江湖经验丰富",
      "武功高强",
      "重情重义"
    ],
    "one_line": "华山派第三代大弟子，江湖经验丰富"
  },
  {
    "id": "char_cheng_qing_zhu",
    "name": "程青竹",
    "role": "次要",
    "identity": "丐帮长老",
    "faction": "faction_qing_zhu_bang",
    "personality": [
      "武功高强",
      "重情重义",
      "有些严肃"
    ],
    "one_line": "丐帮长老，后成为阿九的师傅"
  },
  {
    "id": "char_sha_tian_guang",
    "name": "沙天广",
    "role": "次要",
    "identity": "山东响马",
    "faction": null,
    "personality": [
      "武功高强",
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "山东响马，后加入闯军"
  },
  {
    "id": "char_tie_luo_han",
    "name": "铁罗汉",
    "role": "次要",
    "identity": "少林还俗弟子",
    "faction": null,
    "personality": [
      "性格豪爽",
      "武功高强",
      "重情重义"
    ],
    "one_line": "少林还俗弟子，性格豪爽"
  },
  {
    "id": "char_hu_gui_nan",
    "name": "胡桂南",
    "role": "次要",
    "identity": "江湖奇人",
    "faction": null,
    "personality": [
      "轻功了得",
      "武功高强",
      "重情重义"
    ],
    "one_line": "江湖奇人，轻功了得"
  },
  {
    "id": "char_wen_jia_wu_lao",
    "name": "温氏五老",
    "role": "次要",
    "identity": "温家堡五老",
    "faction": "faction_wen_jia",
    "personality": [
      "武功高强",
      "有些狠毒",
      "重情重义"
    ],
    "one_line": "温家堡五老，与袁承志为敌"
  },
  {
    "id": "char_he_hong_yao",
    "name": "何红药",
    "role": "次要",
    "identity": "五毒教长老",
    "faction": "faction_wu_du_jiao",
    "personality": [
      "武功高强",
      "有些狠毒",
      "重情重义"
    ],
    "one_line": "五毒教长老，何惕守的师姐"
  },
  {
    "id": "char_zhang_chao_tang",
    "name": "张朝唐",
    "role": "龙套",
    "identity": "浡泥国华侨",
    "faction": null,
    "personality": [
      "书生意气",
      "有些胆小",
      "重情重义"
    ],
    "one_line": "浡泥国华侨，回中土应试途中遭遇乱世"
  },
  {
    "id": "char_zhang_kang",
    "name": "张康",
    "role": "龙套",
    "identity": "张朝唐的书僮",
    "faction": null,
    "personality": [
      "忠心耿耿",
      "有些胆小",
      "重情重义"
    ],
    "one_line": "张朝唐的书僮，忠心护主"
  },
  {
    "id": "char_yang_peng_ju",
    "name": "杨鹏举",
    "role": "龙套",
    "identity": "武会镖局镖头",
    "faction": "faction_biao_ju",
    "personality": [
      "见义勇为",
      "武功高强",
      "重情重义"
    ],
    "one_line": "武会镖局镖头，救下张朝唐主仆"
  },
  {
    "id": "char_sun_zhong_shou",
    "name": "孙仲寿",
    "role": "龙套",
    "identity": "袁崇焕旧部",
    "faction": "faction_yuan_dang",
    "personality": [
      "忠君爱国",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕旧部，山宗首领"
  },
  {
    "id": "char_tian_jian_xiu",
    "name": "田见秀",
    "role": "龙套",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "闯军将领，与袁承志结交"
  },
  {
    "id": "char_liu_fang_liang",
    "name": "刘芳亮",
    "role": "龙套",
    "identity": "闯军将领",
    "faction": "faction_chuang_jun",
    "personality": [
      "武功高强",
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "闯军将领，与袁承志结交"
  },
  {
    "id": "char_zhu_an_guo",
    "name": "朱安国",
    "role": "龙套",
    "identity": "袁崇焕旧部",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "袁崇焕旧部，武艺高强"
  },
  {
    "id": "char_ni_hao",
    "name": "倪浩",
    "role": "龙套",
    "identity": "袁崇焕旧部",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "豪迈直率",
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
      "足智多谋",
      "武功高强",
      "重情重义"
    ],
    "one_line": "袁崇焕帐下谋士"
  },
  {
    "id": "char_luo_da_qian",
    "name": "罗大千",
    "role": "龙套",
    "identity": "著名炮手",
    "faction": "faction_yuan_dang",
    "personality": [
      "武功高强",
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "著名炮手，宁远一战立功"
  },
  {
    "id": "char_cao_hua_chun",
    "name": "曹化淳",
    "role": "龙套",
    "identity": "明朝太监",
    "faction": "faction_ming_chao",
    "personality": [
      "阴险狡诈",
      "重情重义",
      "有些狠毒"
    ],
    "one_line": "明朝太监，统率东厂和锦衣卫"
  },
  {
    "id": "char_wang_xiang_yao",
    "name": "王相尧",
    "role": "龙套",
    "identity": "明朝太监",
    "faction": "faction_ming_chao",
    "personality": [
      "阴险狡诈",
      "重情重义",
      "有些狠毒"
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
      "豪迈直率",
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
      "豪迈直率",
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
      "豪迈直率",
      "重情重义"
    ],
    "one_line": "闯军将领"
  },
  {
    "id": "char_feng_bu_cui",
    "name": "冯不摧",
    "role": "龙套",
    "identity": "冯难敌之子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "武功高强",
      "重情重义",
      "有些冲动"
    ],
    "one_line": "冯难敌之子，对阿九有好感"
  },
  {
    "id": "char_feng_bu_po",
    "name": "冯不破",
    "role": "龙套",
    "identity": "冯难敌之子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "性格沉稳",
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
      "重情重义",
      "有些严肃"
    ],
    "one_line": "华山派弟子"
  }
]

### factions.json (14 条)
[
  {
    "id": "faction_hua_shan_pai",
    "name": "华山派",
    "type": "武林门派",
    "location": "loc_hua_shan",
    "one_line": "袁承志所属门派，武林四大剑派之一"
  },
  {
    "id": "faction_chuang_jun",
    "name": "闯军",
    "type": "军队",
    "location": null,
    "one_line": "李自成领导的农民起义军"
  },
  {
    "id": "faction_ming_chao",
    "name": "明朝",
    "type": "王族",
    "location": "loc_beijing",
    "one_line": "崇祯皇帝统治的王朝"
  },
  {
    "id": "faction_wu_du_jiao",
    "name": "五毒教",
    "type": "帮派",
    "location": "loc_yunnan",
    "one_line": "云南邪教，何惕守为教主"
  },
  {
    "id": "faction_yuan_dang",
    "name": "山宗",
    "type": "帮派",
    "location": null,
    "one_line": "袁崇焕旧部组成的秘密组织"
  },
  {
    "id": "faction_wen_jia",
    "name": "温家堡",
    "type": "家族",
    "location": null,
    "one_line": "温氏五老所在的家族"
  },
  {
    "id": "faction_jiao_jia",
    "name": "焦家",
    "type": "家族",
    "location": null,
    "one_line": "焦公礼所在的家族"
  },
  {
    "id": "faction_biao_ju",
    "name": "武会镖局",
    "type": "帮派",
    "location": null,
    "one_line": "杨鹏举所在的镖局"
  },
  {
    "id": "faction_qing_zhu_bang",
    "name": "青竹帮",
    "type": "帮派",
    "location": null,
    "one_line": "程青竹所在的帮派"
  },
  {
    "id": "faction_tai_shan_pai",
    "name": "泰山派",
    "type": "武林门派",
    "location": "loc_tai_shan",
    "one_line": "泰山上的武林门派"
  },
  {
    "id": "faction_duan_jia",
    "name": "大理段氏",
    "type": "家族",
    "location": "loc_dali",
    "one_line": "云南大理的世家大族"
  },
  {
    "id": "faction_wu_dang_pai",
    "name": "武当派",
    "type": "武林门派",
    "location": null,
    "one_line": "武林四大剑派之一"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "武林门派",
    "location": null,
    "one_line": "武林泰斗"
  },
  {
    "id": "faction_heng_shan_pai",
    "name": "恒山派",
    "type": "武林门派",
    "location": null,
    "one_line": "恒山上的武林门派"
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
    "id": "loc_dali",
    "name": "大理",
    "region": "云南",
    "one_line": "云南大理，段氏家族所在地"
  },
  {
    "id": "loc_beijing",
    "name": "北京",
    "region": "中原",
    "one_line": "明朝首都，李自成攻破之城"
  },
  {
    "id": "loc_nanjing",
    "name": "南京",
    "region": "中原",
    "one_line": "明朝陪都，浡泥国王葬处"
  },
  {
    "id": "loc_bo_ni_guo",
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
    "id": "loc_yunnan",
    "name": "云南",
    "region": "西南",
    "one_line": "五毒教所在地"
  }
]

### skills.json (19 条)
[
  {
    "id": "skill_jin_she_jian_fa",
    "name": "金蛇剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "袁承志所学剑法，源自金蛇郎君"
  },
  {
    "id": "skill_shen_xing_bai_bian",
    "name": "神行百变",
    "type": "轻功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "木桑道人轻功，天下独步"
  },
  {
    "id": "skill_fu_hu_zhang_fa",
    "name": "伏虎掌法",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "袁承志最初所学掌法"
  },
  {
    "id": "skill_po_yu_quan",
    "name": "破玉拳",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "华山派拳法，归辛树擅长"
  },
  {
    "id": "skill_hun_yuan_gong",
    "name": "混元功",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "华山派内功心法"
  },
  {
    "id": "skill_hua_shan_jian_fa",
    "name": "华山剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "华山派基础剑法"
  },
  {
    "id": "skill_shi_duan_jin",
    "name": "十段锦",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "袁承志初学内功"
  },
  {
    "id": "skill_jin_she_zhui",
    "name": "金蛇锥",
    "type": "暗器",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "金蛇郎君的暗器手法"
  },
  {
    "id": "skill_ruan_hong_zhu_suo",
    "name": "软红蛛索",
    "type": "奇门兵器",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "何惕守的独门兵器"
  },
  {
    "id": "skill_qing_zhu_zhang_fa",
    "name": "青竹杖法",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "程青竹所传杖法"
  },
  {
    "id": "skill_hu_yan_shi_ba_bian",
    "name": "呼延十八鞭",
    "type": "鞭法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "铁鞭鞭法"
  },
  {
    "id": "skill_tai_shan_shi_ba_pan",
    "name": "泰山十八盘",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "泰山派剑法"
  },
  {
    "id": "skill_wu_dang_jian_fa",
    "name": "武当剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "武当派剑法"
  },
  {
    "id": "skill_shao_lin_chang_quan",
    "name": "少林长拳",
    "type": "拳法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "少林派基础拳法"
  },
  {
    "id": "skill_heng_shan_jian_fa",
    "name": "恒山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "恒山派剑法"
  },
  {
    "id": "skill_duan_jia_jian_fa",
    "name": "大理段氏剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "大理段氏家传剑法"
  },
  {
    "id": "skill_wu_long_sao_di",
    "name": "乌龙扫地",
    "type": "腿法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "杨鹏举所使腿法"
  },
  {
    "id": "skill_qin_na_shou_fa",
    "name": "擒拿手法",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "崔秋山所使擒拿功夫"
  },
  {
    "id": "skill_pan_guan_shuang_bi",
    "name": "判官双笔",
    "type": "奇门兵器",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "白脸太监所使兵器"
  }
]

### techniques.json (0 条)
[]

### items.json (10 条)
[
  {
    "id": "item_jin_she_jian",
    "name": "金蛇剑",
    "type": "兵器",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_jin_she_jian_fa"
    ],
    "one_line": "金蛇郎君的佩剑，袁承志所得"
  },
  {
    "id": "item_jin_she_zhui",
    "name": "金蛇锥",
    "type": "暗器",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_jin_she_zhui"
    ],
    "one_line": "金蛇郎君的暗器，袁承志所得"
  },
  {
    "id": "item_tie_bian",
    "name": "铁鞭",
    "type": "兵器",
    "owner": "char_gui_xin_shu",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_hu_yan_shi_ba_bian"
    ],
    "one_line": "归辛树的兵器，刚猛有力"
  },
  {
    "id": "item_yu_zan",
    "name": "玉簪",
    "type": "信物",
    "owner": "char_a_jiu",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "阿九的信物，推动情节发展"
  },
  {
    "id": "item_jin_si_zhuo_zi",
    "name": "金丝镯子",
    "type": "饰品",
    "owner": "char_an_da_niang",
    "rarity_tier": "上乘佳品",
    "related_skills": [],
    "one_line": "安大娘送给袁承志的信物"
  },
  {
    "id": "item_jin_she_mi_ji",
    "name": "金蛇秘籍",
    "type": "秘籍",
    "owner": "char_yuan_cheng_zhi",
    "rarity_tier": "绝世神兵",
    "related_skills": [
      "skill_jin_she_jian_fa"
    ],
    "one_line": "金蛇郎君的武功秘籍，袁承志所得"
  },
  {
    "id": "item_hua_shan_jian_pu",
    "name": "华山剑谱",
    "type": "秘籍",
    "owner": "faction_hua_shan_pai",
    "rarity_tier": "稀世珍品",
    "related_skills": [
      "skill_hua_shan_jian_fa"
    ],
    "one_line": "华山派武功秘籍"
  },
  {
    "id": "item_chong_zhen_xue_zhao",
    "name": "崇祯血诏",
    "type": "信物",
    "owner": "char_chong_zhen",
    "rarity_tier": "稀世珍品",
    "related_skills": [],
    "one_line": "崇祯皇帝的遗诏"
  },
  {
    "id": "item_tai_zi_yu_xi",
    "name": "太子玉玺",
    "type": "信物",
    "owner": "char_a_jiu",
    "rarity_tier": "绝世神兵",
    "related_skills": [],
    "one_line": "太子的玉玺"
  },
  {
    "id": "item_qing_zhu_zhang",
    "name": "青竹杖",
    "type": "兵器",
    "owner": "char_a_jiu",
    "rarity_tier": "上乘佳品",
    "related_skills": [
      "skill_qing_zhu_zhang_fa"
    ],
    "one_line": "阿九的兵器，程青竹所传"
  }
]

### dialogues.json (前 10 条 / 共 10 条)
[
  {
    "index": 0,
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
    "index": 1,
    "speaker": "char_mu_sang_dao_ren",
    "speaker_name": "木桑道人",
    "listener": "char_yuan_cheng_zhi",
    "text": "你这娃儿，谁教你叫我师父的？你怎知我准肯收你为徒？",
    "tone": "调侃",
    "chapter": 3,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 2,
    "speaker": "char_yuan_cheng_zhi",
    "speaker_name": "袁承志",
    "listener": "char_li_zi_cheng",
    "text": "大王万岁、万岁、万万岁！",
    "tone": "激动",
    "chapter": 19,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 3,
    "speaker": "char_chong_zhen",
    "speaker_name": "崇祯皇帝",
    "listener": null,
    "text": "朕登极十七年，致敌入内地四次，逆贼直逼京师，虽朕薄德匪躬，上干天咎，然皆诸臣之误朕也。",
    "tone": "悲伤",
    "chapter": 19,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 4,
    "speaker": "char_li_zi_cheng",
    "speaker_name": "李自成",
    "listener": "char_a_jiu",
    "text": "我本是好好的百姓，给贪官污吏这一顿打，才忍无可忍，起来造反。",
    "tone": "愤怒",
    "chapter": 19,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 5,
    "speaker": "char_gui_xin_shu",
    "speaker_name": "归辛树",
    "listener": "char_yuan_cheng_zhi",
    "text": "你是不是我们师弟，谁也不知，先过了招再说。",
    "tone": "冷酷",
    "chapter": 10,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 6,
    "speaker": "char_xia_qing_qing",
    "speaker_name": "青青",
    "listener": "char_yuan_cheng_zhi",
    "text": "贪睡猫，到这时候才起身，道长可等得急坏了，快下棋，快下棋。",
    "tone": "调侃",
    "chapter": 10,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 7,
    "speaker": "char_he_ti_shou",
    "speaker_name": "何惕守",
    "listener": "char_a_jiu",
    "text": "师父，她醒了一会，老是问你，这时又睡着了。她正在梦里跟你相会呢！",
    "tone": "欣喜",
    "chapter": 19,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 8,
    "speaker": "char_sun_zhong_jun",
    "speaker_name": "孙仲君",
    "listener": "char_gui_xin_shu",
    "text": "师父，这人是金蛇郎君的儿子。这轻薄少年，正是罪魁祸首。",
    "tone": "愤怒",
    "chapter": 10,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 9,
    "speaker": "char_a_jiu",
    "speaker_name": "阿九",
    "listener": "char_li_zi_cheng",
    "text": "那么我求你几件事。",
    "tone": "恳求",
    "chapter": 19,
    "line_start": 44,
    "line_end": 44
  }
]

### chapter_summaries.json (20 条)
[
  {
    "chapter": 1,
    "title": "第一回 危邦行蜀道 乱世坏长城",
    "key_events": [
      "张朝唐回中土应试",
      "杨鹏举出手相救",
      "袁崇焕旧部出场"
    ],
    "key_characters": [
      "char_zhang_chao_tang",
      "char_yang_peng_ju"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回 恩仇同患难 死生见交情",
    "key_events": [
      "山宗聚会",
      "闯军将领出场",
      "崔秋山展现武功"
    ],
    "key_characters": [
      "char_sun_zhong_shou",
      "char_tian_jian_xiu",
      "char_cui_qiu_shan"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回 经年亲剑铗 长日对楸枰",
    "key_events": [
      "袁承志出场",
      "被送上华山学艺",
      "木桑道人收徒"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi",
      "char_an_da_niang",
      "char_mu_sang_dao_ren"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回 矫矫金蛇剑 翩翩宝袈裟",
    "key_events": [
      "袁承志下山历练",
      "遇到青青",
      "得到金蛇剑和秘籍"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi",
      "char_xia_qing_qing"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回 山投诚遭挫折 险恶道遇高人",
    "key_events": [
      "遇到温氏五老",
      "双方冲突",
      "袁承志获胜"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi",
      "char_wen_jia_wu_lao"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回 拳挥铁骑踏破关山 义薄云天",
    "key_events": [
      "参与江湖纷争",
      "大理段氏交集",
      "武功大成"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回 青青自述身世 崔秋山指点武功",
    "key_events": [
      "青青自述身世",
      "崔秋山指点武功",
      "袁承志武功精进"
    ],
    "key_characters": [
      "char_xia_qing_qing",
      "char_cui_qiu_shan",
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回 华山论剑 武林四大剑派",
    "key_events": [
      "华山论剑",
      "四大剑派齐聚",
      "袁承志展现剑法"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回 金蛇郎君现身 袁承志大战",
    "key_events": [
      "金蛇郎君现身",
      "袁承志大战",
      "使用金蛇剑法"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回 不传传百变 无敌敌千招",
    "key_events": [
      "木桑道人传授神行百变",
      "袁承志与归辛树比武",
      "展现高强武功"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi",
      "char_mu_sang_dao_ren",
      "char_gui_xin_shu"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回 山东响马 沙天广出场",
    "key_events": [
      "沙天广出场",
      "袁承志与沙天广结交",
      "两人成为朋友"
    ],
    "key_characters": [
      "char_sha_tian_guang",
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回 泰山大会 江湖聚会",
    "key_events": [
      "泰山大会召开",
      "江湖人物齐聚",
      "袁承志参与交涉"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回 华山派内部矛盾",
    "key_events": [
      "华山派内部矛盾",
      "归辛树与袁承志关系紧张",
      "双方冲突"
    ],
    "key_characters": [
      "char_gui_xin_shu",
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回 袁承志武功大成",
    "key_events": [
      "袁承志武功大成",
      "成为华山派杰出弟子",
      "行走江湖"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回 五毒教出场",
    "key_events": [
      "五毒教出场",
      "何惕守与何红药现身",
      "袁承志与五毒教冲突"
    ],
    "key_characters": [
      "char_he_ti_shou",
      "char_he_hong_yao",
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回 恒山剑派",
    "key_events": [
      "恒山剑派出场",
      "提及恒山剑法",
      "袁承志与恒山派交集"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回 李自成起义",
    "key_events": [
      "李自成起义",
      "闯军势力大增",
      "袁承志考虑辅佐"
    ],
    "key_characters": [
      "char_li_zi_cheng",
      "char_yuan_cheng_zhi"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回 袁承志辅佐李自成",
    "key_events": [
      "袁承志辅佐李自成",
      "参与军事行动",
      "为闯军立功"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi",
      "char_li_zi_cheng"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回 嗟乎兴圣主 亦复苦生民",
    "key_events": [
      "李自成攻破北京",
      "崇祯自缢",
      "袁承志成为金蛇王"
    ],
    "key_characters": [
      "char_li_zi_cheng",
      "char_chong_zhen",
      "char_yuan_cheng_zhi",
      "char_a_jiu"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回 空负安邦志 遂吟去国行",
    "key_events": [
      "袁承志远赴海外",
      "离开中原",
      "故事结束"
    ],
    "key_characters": [
      "char_yuan_cheng_zhi"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
