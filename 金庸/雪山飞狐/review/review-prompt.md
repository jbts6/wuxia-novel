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

### characters.json (21 条)
[
  {
    "id": "char_hu_fei",
    "name": "胡斐",
    "role": "核心",
    "identity": "胡一刀之子，武林新秀",
    "faction": null,
    "personality": [
      "重情重义",
      "机智聪明",
      "嫉恶如仇"
    ],
    "one_line": "胡一刀之子，自幼孤苦，武功高强，追寻父仇与真爱"
  },
  {
    "id": "char_miao_ren_feng",
    "name": "苗人凤",
    "role": "核心",
    "identity": "武林前辈，苗家剑法传人",
    "faction": "faction_miao_jia",
    "personality": [
      "嫉恶如仇",
      "沉稳威严",
      "重义轻生"
    ],
    "one_line": "号称打遍天下无敌手，苗家剑法传人，与胡一刀比武结下深仇"
  },
  {
    "id": "char_miao_ruo_lan",
    "name": "苗若兰",
    "role": "核心",
    "identity": "苗人凤之女，温雅少女",
    "faction": "faction_miao_jia",
    "personality": [
      "温雅有礼",
      "矜持深情",
      "知书达理"
    ],
    "one_line": "苗人凤之女，温雅有礼，与胡斐一见钟情"
  },
  {
    "id": "char_hu_yi_dao",
    "name": "胡一刀",
    "role": "核心",
    "identity": "胡斐之父，闯王卫士后人",
    "faction": "faction_hu_jia",
    "personality": [
      "豪爽大方",
      "重情重义",
      "聪明机智"
    ],
    "one_line": "胡家刀法传人，与苗人凤比武中毒身亡"
  },
  {
    "id": "char_hu_fu_ren",
    "name": "胡夫人",
    "role": "重要",
    "identity": "胡一刀之妻，杜希孟表妹",
    "faction": "faction_hu_jia",
    "personality": [
      "英风飒爽",
      "情深义重",
      "眼光独到"
    ],
    "one_line": "胡一刀之妻，英风飒爽，随夫就义"
  },
  {
    "id": "char_cao_yun_qi",
    "name": "曹云奇",
    "role": "重要",
    "identity": "天龙门北宗新任掌门人",
    "faction": "faction_tian_long_men",
    "personality": [
      "性格急躁",
      "争强好胜",
      "痴情"
    ],
    "one_line": "天龙门北宗掌门，性格急躁，对田青文痴情"
  },
  {
    "id": "char_ruan_shi_zhong",
    "name": "阮士中",
    "role": "重要",
    "identity": "天龙门北宗师叔",
    "faction": "faction_tian_long_men",
    "personality": [
      "老练沉稳",
      "武功高强",
      "处事圆滑"
    ],
    "one_line": "天龙门北宗第一高手，绰号七星手"
  },
  {
    "id": "char_yin_ji",
    "name": "殷吉",
    "role": "重要",
    "identity": "天龙门南宗掌门人",
    "faction": "faction_tian_long_men",
    "personality": [
      "城府深沉",
      "武功高强",
      "富商气派"
    ],
    "one_line": "天龙门南宗掌门，富商气派，武功不弱"
  },
  {
    "id": "char_bao_shu",
    "name": "宝树",
    "role": "重要",
    "identity": "神秘老僧，叙事者之一",
    "faction": null,
    "personality": [
      "神秘莫测",
      "话中有话",
      "立场暧昧"
    ],
    "one_line": "神秘老僧，讲述胡一刀故事的第一个版本"
  },
  {
    "id": "char_tao_bai_sui",
    "name": "陶百岁",
    "role": "重要",
    "identity": "饮马川山寨寨主",
    "faction": "faction_yin_ma_chuan",
    "personality": [
      "豪爽直率",
      "重义轻生",
      "脾气暴躁"
    ],
    "one_line": "饮马川山寨寨主，陶子安之父"
  },
  {
    "id": "char_tao_zi_an",
    "name": "陶子安",
    "role": "重要",
    "identity": "陶百岁之子，田青文未婚夫",
    "faction": "faction_yin_ma_chuan",
    "personality": [
      "年轻英俊",
      "重情重义",
      "处境尴尬"
    ],
    "one_line": "陶百岁之子，田青文的未婚夫，被众人追击"
  },
  {
    "id": "char_tian_qing_wen",
    "name": "田青文",
    "role": "重要",
    "identity": "田归农之女",
    "faction": "faction_tian_jia",
    "personality": [
      "容貌美丽",
      "性又机伶",
      "处境尴尬"
    ],
    "one_line": "田归农之女，外号锦毛貂，处境复杂"
  },
  {
    "id": "char_zhou_yun_yang",
    "name": "周云阳",
    "role": "次要",
    "identity": "天龙门北宗弟子",
    "faction": "faction_tian_long_men",
    "personality": [
      "年轻",
      "武功一般",
      "忠于师门"
    ],
    "one_line": "天龙门北宗弟子，曹云奇师弟"
  },
  {
    "id": "char_fan_bang_zhu",
    "name": "范帮主",
    "role": "重要",
    "identity": "丐帮帮主",
    "faction": "faction_gai_bang",
    "personality": [
      "重义轻生",
      "侠肝义胆",
      "处境危险"
    ],
    "one_line": "丐帮帮主，与苗人凤交好，被官府捉拿"
  },
  {
    "id": "char_liu_yuan_he",
    "name": "刘元鹤",
    "role": "重要",
    "identity": "御前侍卫",
    "faction": null,
    "personality": [
      "心机深沉",
      "武功不弱",
      "善于察言观色"
    ],
    "one_line": "御前侍卫，参与围捕苗人凤"
  },
  {
    "id": "char_xiong_yuan_xian",
    "name": "熊元献",
    "role": "次要",
    "identity": "北京平通镖局总镖头",
    "faction": "faction_ping_tong_biao_ju",
    "personality": [
      "精明",
      "武功不弱",
      "善于察言观色"
    ],
    "one_line": "北京平通镖局总镖头，精熟地堂刀"
  },
  {
    "id": "char_tian_gui_nong",
    "name": "田归农",
    "role": "重要",
    "identity": "天龙门人物，苗人凤义弟",
    "faction": "faction_tian_jia",
    "personality": [
      "阴险狡诈",
      "善于伪装",
      "心机深沉"
    ],
    "one_line": "阴险狡诈，觊觎闯王宝藏，诱走苗人凤之妻"
  },
  {
    "id": "char_ping_a_si",
    "name": "平阿四",
    "role": "重要",
    "identity": "胡斐的养父，独臂仆人",
    "faction": null,
    "personality": [
      "忠诚",
      "重情重义",
      "忍辱负重"
    ],
    "one_line": "胡斐的养父，独臂仆人，讲述胡一刀真相"
  },
  {
    "id": "char_du_xi_meng",
    "name": "杜希孟",
    "role": "重要",
    "identity": "玉笔峰庄主",
    "faction": "faction_du_jia",
    "personality": [
      "假仁假义",
      "贪婪",
      "阴险"
    ],
    "one_line": "玉笔峰庄主，觊觎胡家武学秘本，与胡家有亲戚关系"
  },
  {
    "id": "char_sai_zong_guan",
    "name": "赛总管",
    "role": "重要",
    "identity": "御前侍卫总管",
    "faction": null,
    "personality": [
      "凶奸狡诈",
      "武功高强",
      "深谋远虑"
    ],
    "one_line": "满洲第一高手，乾隆皇帝手下第一亲信卫士"
  },
  {
    "id": "char_shang_jian_ming",
    "name": "商剑鸣",
    "role": "次要",
    "identity": "山东武定县人，八卦门中好手",
    "faction": null,
    "personality": [
      "武功不弱",
      "自视甚高"
    ],
    "one_line": "八卦门中好手，被胡一刀杀死"
  }
]

### factions.json (8 条)
[
  {
    "id": "faction_tian_long_men",
    "name": "天龙门",
    "type": "武林门派",
    "location": null,
    "one_line": "关外第一大武学门派，分南北两宗，掌剑双绝"
  },
  {
    "id": "faction_miao_jia",
    "name": "苗家",
    "type": "家族",
    "location": null,
    "one_line": "苗人凤家族，武林世家，以苗家剑法闻名"
  },
  {
    "id": "faction_hu_jia",
    "name": "胡家",
    "type": "家族",
    "location": null,
    "one_line": "胡一刀家族，闯王卫士后人，以胡家刀法传世"
  },
  {
    "id": "faction_tian_jia",
    "name": "田家",
    "type": "家族",
    "location": null,
    "one_line": "田归农家族，觊觎闯王宝藏，与苗家有姻亲关系"
  },
  {
    "id": "faction_du_jia",
    "name": "杜家",
    "type": "家族",
    "location": "loc_yu_bi_feng",
    "one_line": "玉笔峰庄主杜希孟家族，与胡家有亲戚关系"
  },
  {
    "id": "faction_gai_bang",
    "name": "丐帮",
    "type": "帮派",
    "location": null,
    "one_line": "天下第一大帮，范帮主与苗人凤交好"
  },
  {
    "id": "faction_ping_tong_biao_ju",
    "name": "平通镖局",
    "type": "帮派",
    "location": null,
    "one_line": "北京平通镖局，熊元献为总镖头"
  },
  {
    "id": "faction_yin_ma_chuan",
    "name": "饮马川山寨",
    "type": "帮派",
    "location": null,
    "one_line": "关外山寨，陶百岁为寨主，曾劫过平通镖局大镖"
  }
]

### locations.json (10 条)
[
  {
    "id": "loc_yu_bi_feng",
    "name": "玉笔峰",
    "region": "辽东",
    "one_line": "长白山中陡削雪峰，杜希孟庄园所在，全书主要场景"
  },
  {
    "id": "loc_chang_bai_shan",
    "name": "长白山",
    "region": "辽东",
    "one_line": "关外名山，雪山飞狐故事发生地"
  },
  {
    "id": "loc_beijing",
    "name": "北京",
    "region": "中原",
    "one_line": "清朝都城，御前侍卫所在地"
  },
  {
    "id": "loc_guan_wai",
    "name": "关外",
    "region": "辽东",
    "one_line": "山海关以外地区，天龙门势力范围"
  },
  {
    "id": "loc_liao_dong",
    "name": "辽东",
    "region": "辽东",
    "one_line": "东北地区，胡家、天龙门所在地"
  },
  {
    "id": "loc_ling_nan",
    "name": "岭南",
    "region": "南方",
    "one_line": "苗人凤曾去岭南办事"
  },
  {
    "id": "loc_ning_gu_ta",
    "name": "宁古塔",
    "region": "辽东",
    "one_line": "关外重镇，杜希孟曾去请苗人凤"
  },
  {
    "id": "loc_wu_lan_shan",
    "name": "乌兰山",
    "region": "辽东",
    "one_line": "玉笔峰所在山脉"
  },
  {
    "id": "loc_cang_zhou",
    "name": "沧州",
    "region": "中原",
    "one_line": "胡一刀来到中原，苗人凤在此拦住他比武"
  },
  {
    "id": "loc_shan_dong",
    "name": "山东",
    "region": "中原",
    "one_line": "商剑鸣所在地"
  }
]

### skills.json (7 条)
[
  {
    "id": "skill_hu_jia_dao_fa",
    "name": "胡家刀法",
    "type": "刀法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "胡家祖传刀法，刚猛凌厉，每一招都含有后着"
  },
  {
    "id": "skill_miao_jia_jian_fa",
    "name": "苗家剑法",
    "type": "剑法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "苗家祖传剑法，精妙绝伦，反覆数千招无半点破绽"
  },
  {
    "id": "skill_ba_gua_dao",
    "name": "八卦刀",
    "type": "刀法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "八卦门武功，商剑鸣所使，被胡一刀用苗家剑法打败"
  },
  {
    "id": "skill_ba_gua_zhang",
    "name": "八卦掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "八卦门掌法，商剑鸣的另一绝技"
  },
  {
    "id": "skill_tian_long_jian_fa",
    "name": "天龙剑法",
    "type": "剑法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "天龙门剑法，掌剑双绝"
  },
  {
    "id": "skill_qi_xing_shou",
    "name": "七星手",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "阮士中的成名绝技，天龙北宗第一高手"
  },
  {
    "id": "skill_di_tang_dao",
    "name": "地堂刀",
    "type": "刀法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "熊元献精熟的地面功夫"
  }
]

### techniques.json (4 条)
[
  {
    "id": "tech_ba_fang_cang_dao",
    "name": "八方藏刀式",
    "type": "attack",
    "source_skill": "skill_hu_jia_dao_fa"
  },
  {
    "id": "tech_sha_ou_lue_bo",
    "name": "沙鸥掠波",
    "type": "attack",
    "source_skill": "skill_miao_jia_jian_fa"
  },
  {
    "id": "tech_ti_liao_jian_bai_he_shu_chi",
    "name": "提撩剑白鹤舒翅",
    "type": "attack",
    "source_skill": "skill_miao_jia_jian_fa"
  },
  {
    "id": "tech_bi_men_tie_shan_dao",
    "name": "闭门铁扇刀",
    "type": "attack",
    "source_skill": "skill_hu_jia_dao_fa"
  }
]

### items.json (6 条)
[
  {
    "id": "item_hu_jia_dao",
    "name": "胡家刀",
    "type": "兵器",
    "owner": "char_hu_fei",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_hu_jia_dao_fa"
    ],
    "one_line": "胡家祖传单刀，生满铁锈，刀口喂有剧毒"
  },
  {
    "id": "item_feng_tou_zhu_chai",
    "name": "凤头珠钗",
    "type": "信物",
    "owner": "char_miao_ren_feng",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "苗人凤妻子遗物，内藏藏宝图"
  },
  {
    "id": "item_huang_jin_xiao_bi",
    "name": "黄金小笔",
    "type": "暗器",
    "owner": "char_hu_fei",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "胡斐送给田青文的黄金铸成小笔"
  },
  {
    "id": "item_chuang_wang_jun_dao",
    "name": "闯王军刀",
    "type": "剧情关键",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "李闯王军刀，藏有宝藏秘密"
  },
  {
    "id": "item_hua_tong_huo_jian",
    "name": "花筒火箭",
    "type": "工具",
    "owner": "char_bao_shu",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "江湖上传递信息的讯号火箭"
  },
  {
    "id": "item_zhu_lan",
    "name": "竹篮",
    "type": "工具",
    "owner": "char_du_xi_meng",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "玉笔峰上下接客用的大竹篮"
  }
]

### dialogues.json (前 20 条 / 共 20 条)
[
  {
    "index": 0,
    "speaker": "char_cao_yun_qi",
    "speaker_name": "曹云奇",
    "listener": "char_tian_qing_wen",
    "text": "是你心上人。",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 1,
    "speaker": "char_tian_qing_wen",
    "speaker_name": "田青文",
    "listener": "char_cao_yun_qi",
    "text": "他是我没过门的丈夫，自然是我心上人。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 45,
    "line_end": 45
  },
  {
    "index": 2,
    "speaker": "char_cao_yun_qi",
    "speaker_name": "曹云奇",
    "listener": "char_tian_qing_wen",
    "text": "我愿跟你浪迹天涯，在荒岛深山之中隐居厮守，你怎又不肯？",
    "tone": "激动",
    "chapter": 1,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 3,
    "speaker": "char_tian_qing_wen",
    "speaker_name": "田青文",
    "listener": "char_cao_yun_qi",
    "text": "师哥，我知你对我一片痴心，我又不是傻子，怎能不念着你的心意。可是你执掌我天龙北宗门户，如做出这等事来，天龙门声名扫地，在江湖上颜面何存？",
    "tone": "恳求",
    "chapter": 1,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 4,
    "speaker": "char_cao_yun_qi",
    "speaker_name": "曹云奇",
    "listener": "char_tian_qing_wen",
    "text": "我就为你粉身碎骨，也所甘愿。天塌下来我也不理，管他什么掌门不掌门。",
    "tone": "激动",
    "chapter": 1,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 5,
    "speaker": "char_tian_qing_wen",
    "speaker_name": "田青文",
    "listener": "char_cao_yun_qi",
    "text": "师哥，我就是不爱你这霹雳火爆、不顾一切的脾气呢。",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 6,
    "speaker": "char_ping_a_si",
    "speaker_name": "独臂仆人",
    "listener": null,
    "text": "两位所说不同，只因为有一个是故意说谎。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 7,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_ping_a_si",
    "text": "若是我说得不对，你不妨明言。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 57,
    "line_end": 57
  },
  {
    "index": 8,
    "speaker": "char_ping_a_si",
    "speaker_name": "独臂仆人",
    "listener": "char_miao_ruo_lan",
    "text": "适才大师与姑娘所说之事，小人当时也曾亲见，各位要是不嫌聒噪，小人也来说说。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 59,
    "line_end": 59
  },
  {
    "index": 9,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_ping_a_si",
    "text": "你瞧清楚了，这上面写着我爹爹的名字。你将这木联抱在手里，尽管放胆而言。如有人伤了你一根毛发，就是有意跟我爹爹过不去。",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 67,
    "line_end": 67
  },
  {
    "index": 10,
    "speaker": "char_hu_fei",
    "speaker_name": "胡斐",
    "listener": "char_miao_ruo_lan",
    "text": "苗姑娘，在下绝无轻薄冒渎之意，但要解开姑娘穴道，难以不碰姑娘贵体，此事该当如何？",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 11,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_hu_fei",
    "text": "我知道。我不怪你。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 12,
    "speaker": "char_hu_fei",
    "speaker_name": "胡斐",
    "listener": "char_miao_ruo_lan",
    "text": "适才冒犯，实为无意之过，此心光明磊落，天日可鉴，务请姑娘恕罪。",
    "tone": "恳求",
    "chapter": 10,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 13,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_hu_fei",
    "text": "我爹爹因有伤心之事，是以感触特深，请您不要见怪。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 12,
    "line_end": 12
  },
  {
    "index": 14,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_hu_fei",
    "text": "我一定学你妈妈，不学我妈。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 51,
    "line_end": 51
  },
  {
    "index": 15,
    "speaker": "char_hu_fei",
    "speaker_name": "胡斐",
    "listener": "char_miao_ruo_lan",
    "text": "胡斐终生不敢有负。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 16,
    "speaker": "char_miao_ruo_lan",
    "speaker_name": "苗若兰",
    "listener": "char_hu_fei",
    "text": "我很欢喜。",
    "tone": "欣喜",
    "chapter": 10,
    "line_start": 45,
    "line_end": 45
  },
  {
    "index": 17,
    "speaker": "char_tao_bai_sui",
    "speaker_name": "陶百岁",
    "listener": null,
    "text": "我在少年之时，就和归农一起做没本钱的买卖⋯⋯",
    "tone": "陈述",
    "chapter": 7,
    "line_start": 1,
    "line_end": 1
  },
  {
    "index": 18,
    "speaker": "char_cao_yun_qi",
    "speaker_name": "曹云奇",
    "listener": "char_tao_bai_sui",
    "text": "放屁！我师父是武林豪杰，你莫胡说八道，污了我师父的名头。",
    "tone": "愤怒",
    "chapter": 7,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 19,
    "speaker": "char_tao_bai_sui",
    "speaker_name": "陶百岁",
    "listener": "char_cao_yun_qi",
    "text": "武林豪杰便不行走黑道吗？你瞧不起黑道上的英雄，可是黑道上的英雄还瞧不起你这等狗熊呢！",
    "tone": "愤怒",
    "chapter": 7,
    "line_start": 5,
    "line_end": 5
  }
]

### chapter_summaries.json (10 条)
[
  {
    "chapter": 1,
    "title": "一",
    "key_events": [
      "曹云奇追击陶子安",
      "田青文手持黄金小笔",
      "各方势力汇聚",
      "刘元鹤等江湖人士登场"
    ],
    "key_characters": [
      "char_cao_yun_qi",
      "char_ruan_shi_zhong",
      "char_yin_ji",
      "char_tao_zi_an",
      "char_tian_qing_wen",
      "char_liu_yuan_he"
    ]
  },
  {
    "chapter": 2,
    "title": "二",
    "key_events": [
      "众人上玉笔峰",
      "于管家展示武功",
      "苗若兰首次登场",
      "金面佛三字震慑群豪"
    ],
    "key_characters": [
      "char_bao_shu",
      "char_du_xi_meng",
      "char_miao_ruo_lan",
      "char_cao_yun_qi"
    ]
  },
  {
    "chapter": 3,
    "title": "三",
    "key_events": [
      "宝树讲述胡一刀故事",
      "苗若兰反驳宝树",
      "揭示胡家与苗范田三家恩怨",
      "胡一刀英雄气概"
    ],
    "key_characters": [
      "char_bao_shu",
      "char_miao_ruo_lan",
      "char_hu_yi_dao"
    ]
  },
  {
    "chapter": 4,
    "title": "四",
    "key_events": [
      "胡一刀用苗家剑法打败商剑鸣",
      "胡夫人发现苗人凤破绽",
      "两人交换刀剑再战",
      "胡一刀中毒身亡"
    ],
    "key_characters": [
      "char_hu_yi_dao",
      "char_hu_fu_ren",
      "char_miao_ren_feng",
      "char_shang_jian_ming"
    ]
  },
  {
    "chapter": 5,
    "title": "五",
    "key_events": [
      "苗若兰讲述胡一刀真相",
      "平阿四登场",
      "揭示胡一刀被毒杀",
      "苗人凤祭奠胡一刀"
    ],
    "key_characters": [
      "char_miao_ruo_lan",
      "char_ping_a_si",
      "char_hu_yi_dao",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 6,
    "title": "六",
    "key_events": [
      "平阿四炸断绳索",
      "白鸽带来救援",
      "众人脱困",
      "苗若兰担心父亲安危"
    ],
    "key_characters": [
      "char_ping_a_si",
      "char_miao_ruo_lan",
      "char_hu_fei"
    ]
  },
  {
    "chapter": 7,
    "title": "七",
    "key_events": [
      "陶百岁讲述田归农往事",
      "揭示田归农下毒真相",
      "田归农真面目暴露",
      "众人震惊"
    ],
    "key_characters": [
      "char_tao_bai_sui",
      "char_tian_gui_nong",
      "char_hu_yi_dao",
      "char_miao_ren_feng"
    ]
  },
  {
    "chapter": 8,
    "title": "八",
    "key_events": [
      "刘元鹤发现藏宝图",
      "众人争夺宝刀",
      "刘元鹤拔苗若兰珠钗",
      "赛总管设伏阴谋"
    ],
    "key_characters": [
      "char_liu_yuan_he",
      "char_miao_ruo_lan",
      "char_tian_gui_nong"
    ]
  },
  {
    "chapter": 9,
    "title": "九",
    "key_events": [
      "胡斐登峰",
      "胡斐苗若兰定情",
      "胡斐讲述身世",
      "苗若兰讲述母亲往事"
    ],
    "key_characters": [
      "char_hu_fei",
      "char_miao_ruo_lan",
      "char_du_xi_meng"
    ]
  },
  {
    "chapter": 10,
    "title": "十",
    "key_events": [
      "胡斐与苗人凤决战",
      "胡斐救苗若兰",
      "两人定情",
      "全书结局"
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
