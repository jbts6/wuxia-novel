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

### characters.json (32 条)
[
  {
    "id": "char_duan_yu",
    "name": "段誉",
    "role": "核心",
    "identity": "大理镇南王世子，后为大理国皇帝",
    "faction": "faction_duan_shi",
    "personality": [
      "痴情执着",
      "博学多才",
      "心地善良"
    ],
    "one_line": "大理段氏世子，痴情书生，习得六脉神剑与凌波微步，最终为帝"
  },
  {
    "id": "char_xiao_feng",
    "name": "萧峰",
    "role": "核心",
    "identity": "丐帮帮主，辽国南院大王",
    "faction": "faction_gai_bang",
    "personality": [
      "豪迈直爽",
      "重情重义",
      "光明磊落"
    ],
    "one_line": "原名乔峰，丐帮帮主，契丹人，悲剧英雄，最终在雁门关自尽"
  },
  {
    "id": "char_xu_zhu",
    "name": "虚竹",
    "role": "核心",
    "identity": "少林寺僧人，后为灵鹫宫主人",
    "faction": "faction_shao_lin",
    "personality": [
      "憨厚朴实",
      "心地善良",
      "迂腐守戒"
    ],
    "one_line": "少林小和尚，误入逍遥派，成为灵鹫宫主与西夏驸马"
  },
  {
    "id": "char_a_zhu",
    "name": "阿朱",
    "role": "重要",
    "identity": "慕容氏侍女，萧峰挚爱",
    "faction": "faction_gu_su_mu_rong",
    "personality": [
      "聪慧灵巧",
      "温柔善良",
      "善解人意"
    ],
    "one_line": "萧峰挚爱，易容术高超，为救萧峰而死于小镜湖畔"
  },
  {
    "id": "char_a_zi",
    "name": "阿紫",
    "role": "重要",
    "identity": "星宿派弟子，阿朱之妹",
    "faction": "faction_xing_xiu_pai",
    "personality": [
      "心狠手辣",
      "刁钻刻薄",
      "痴情执着"
    ],
    "one_line": "星宿派弟子，阿朱之妹，心狠手辣却痴情萧峰，最终随萧峰跳崖"
  },
  {
    "id": "char_wang_yu_yan",
    "name": "王语嫣",
    "role": "重要",
    "identity": "曼陀山庄小姐，段正淳与李青萝之女",
    "faction": null,
    "personality": [
      "博学多才",
      "温婉端庄",
      "痴情执着"
    ],
    "one_line": "段誉挚爱，熟知天下武功却不谙武艺，慕容复表妹"
  },
  {
    "id": "char_mu_rong_fu",
    "name": "慕容复",
    "role": "重要",
    "identity": "姑苏慕容氏传人，一心复国",
    "faction": "faction_gu_su_mu_rong",
    "personality": [
      "城府极深",
      "心狠手辣",
      "志向远大"
    ],
    "one_line": "姑苏慕容，一心复国，武功高强，最终疯癫"
  },
  {
    "id": "char_duan_zheng_chun",
    "name": "段正淳",
    "role": "重要",
    "identity": "大理国皇太弟，镇南王",
    "faction": "faction_duan_shi",
    "personality": [
      "风流多情",
      "重情重义",
      "武功高强"
    ],
    "one_line": "大理镇南王，段誉名义上的父亲，风流多情，处处留情"
  },
  {
    "id": "char_mu_wan_qing",
    "name": "木婉清",
    "role": "重要",
    "identity": "秦红棉之女，段正淳之女",
    "faction": null,
    "personality": [
      "冷艳刚烈",
      "敢爱敢恨",
      "心思单纯"
    ],
    "one_line": "段誉恋人之一，秦红棉之女，修罗刀传人，冷艳刚烈"
  },
  {
    "id": "char_jiu_mo_zhi",
    "name": "鸠摩智",
    "role": "重要",
    "identity": "吐蕃国护国法王，大轮寺住持",
    "faction": "faction_da_lun_si",
    "personality": [
      "聪明过人",
      "贪念深重",
      "好胜心强"
    ],
    "one_line": "吐蕃国师，觊觎六脉神剑，武功尽失后反得善果"
  },
  {
    "id": "char_you_tan_zhi",
    "name": "游坦之",
    "role": "重要",
    "identity": "聚贤庄少主，丐帮帮主",
    "faction": null,
    "personality": [
      "痴情卑微",
      "懦弱善良",
      "因爱生恨"
    ],
    "one_line": "聚贤庄少主，痴情阿紫，习得易筋经和冰蚕毒掌"
  },
  {
    "id": "char_zhong_ling",
    "name": "钟灵",
    "role": "重要",
    "identity": "钟万仇与甘宝宝之女",
    "faction": null,
    "personality": [
      "天真活泼",
      "可爱调皮",
      "心思单纯"
    ],
    "one_line": "段誉恋人之一，天真可爱，钟万仇与甘宝宝之女"
  },
  {
    "id": "char_ding_chun_qiu",
    "name": "丁春秋",
    "role": "反派",
    "identity": "星宿派掌门，逍遥派叛徒",
    "faction": "faction_xing_xiu_pai",
    "personality": [
      "阴险毒辣",
      "好大喜功",
      "贪生怕死"
    ],
    "one_line": "星宿老怪，星宿派掌门，擅用毒和化功大法，逍遥派叛徒"
  },
  {
    "id": "char_xuan_ci",
    "name": "玄慈",
    "role": "重要",
    "identity": "少林寺方丈，虚竹之父",
    "faction": "faction_shao_lin",
    "personality": [
      "德高望重",
      "内心愧疚",
      "勇于担责"
    ],
    "one_line": "少林寺方丈，虚竹之父，雁门关血案带头大哥"
  },
  {
    "id": "char_li_qiu_shui",
    "name": "李秋水",
    "role": "重要",
    "identity": "逍遥派弟子，西夏皇妃",
    "faction": "faction_xiao_yao_pai",
    "personality": [
      "温文尔雅",
      "心机深沉",
      "嫉妒成性"
    ],
    "one_line": "逍遥派弟子，西夏皇妃，天山童姥的师妹，与童姥争斗一生"
  },
  {
    "id": "char_ye_lv_hong_ji",
    "name": "耶律洪基",
    "role": "重要",
    "identity": "辽国皇帝",
    "faction": "faction_liao_guo",
    "personality": [
      "豪迈自负",
      "雄才大略",
      "重情重义"
    ],
    "one_line": "辽国皇帝，萧峰的结义兄弟，欲南征大宋被萧峰阻拦"
  },
  {
    "id": "char_mu_rong_bo",
    "name": "慕容博",
    "role": "重要",
    "identity": "慕容复之父，幕后黑手",
    "faction": "faction_gu_su_mu_rong",
    "personality": [
      "城府极深",
      "阴险狡诈",
      "志向远大"
    ],
    "one_line": "慕容复之父，雁门关血案的幕后策划者，假死数十年"
  },
  {
    "id": "char_xiao_yuan_shan",
    "name": "萧远山",
    "role": "重要",
    "identity": "萧峰之父，辽国武士",
    "faction": null,
    "personality": [
      "刚烈不屈",
      "深藏不露",
      "护子心切"
    ],
    "one_line": "萧峰之父，雁门关血案的受害者，隐居少林寺数十年"
  },
  {
    "id": "char_duan_yan_qing",
    "name": "段延庆",
    "role": "重要",
    "identity": "四大恶人之首，大理废太子",
    "faction": "faction_si_da_e_ren",
    "personality": [
      "阴险狠辣",
      "城府极深",
      "心怀仇恨"
    ],
    "one_line": "四大恶人之首，大理废太子，段誉的生父"
  },
  {
    "id": "char_dao_bai_feng",
    "name": "刀白凤",
    "role": "次要",
    "identity": "段誉之母，大理镇南王妃",
    "faction": "faction_duan_shi",
    "personality": [
      "刚烈果断",
      "爱子心切",
      "外柔内刚"
    ],
    "one_line": "段誉名义上的母亲，大理镇南王妃，因段正淳风流而愤而出家"
  },
  {
    "id": "char_qin_hong_mian",
    "name": "秦红棉",
    "role": "次要",
    "identity": "木婉清之母，段正淳旧情人",
    "faction": null,
    "personality": [
      "刚烈果断",
      "爱恨分明",
      "武功不俗"
    ],
    "one_line": "木婉清之母，修罗刀，段正淳旧情人"
  },
  {
    "id": "char_ruan_xing_zhu",
    "name": "阮星竹",
    "role": "次要",
    "identity": "阿朱、阿紫之母，段正淳旧情人",
    "faction": null,
    "personality": [
      "温柔贤淑",
      "痴情执着",
      "思女心切"
    ],
    "one_line": "阿朱、阿紫之母，段正淳旧情人，隐居小镜湖畔"
  },
  {
    "id": "char_wu_ya_zi",
    "name": "无崖子",
    "role": "次要",
    "identity": "逍遥派掌门",
    "faction": "faction_xiao_yao_pai",
    "personality": [
      "才华横溢",
      "风流倜傥",
      "心怀大志"
    ],
    "one_line": "逍遥派掌门，天山童姥、李秋水的师弟，传功于虚竹"
  },
  {
    "id": "char_tian_shan_tong_lao",
    "name": "天山童姥",
    "role": "重要",
    "identity": "逍遥派大师姐，灵鹫宫主",
    "faction": "faction_ling_jiu_gong",
    "personality": [
      "乖戾横蛮",
      "武功高强",
      "护短"
    ],
    "one_line": "逍遥派大师姐，灵鹫宫主，武功高强，与李秋水争斗一生"
  },
  {
    "id": "char_gan_bao_bao",
    "name": "甘宝宝",
    "role": "龙套",
    "identity": "钟灵之母，钟万仇之妻",
    "faction": null,
    "personality": [
      "温柔贤淑",
      "痴情",
      "左右为难"
    ],
    "one_line": "钟灵之母，钟万仇之妻，段正淳旧情人"
  },
  {
    "id": "char_duan_zheng_ming",
    "name": "段正明",
    "role": "次要",
    "identity": "大理国皇帝",
    "faction": "faction_duan_shi",
    "personality": [
      "深明大义",
      "武功高强",
      "仁厚宽和"
    ],
    "one_line": "大理国皇帝，段誉伯父，武功高强，深明大义"
  },
  {
    "id": "char_su_xing_he",
    "name": "苏星河",
    "role": "次要",
    "identity": "无崖子弟子，珍珑棋局布置者",
    "faction": "faction_xiao_yao_pai",
    "personality": [
      "忠心耿耿",
      "多才多艺",
      "深藏不露"
    ],
    "one_line": "无崖子弟子，珍珑棋局的布置者，虚竹的引路人"
  },
  {
    "id": "char_quan_guan_qing",
    "name": "全冠清",
    "role": "龙套",
    "identity": "丐帮长老，叛徒",
    "faction": "faction_gai_bang",
    "personality": [
      "阴险狡诈",
      "野心勃勃",
      "心狠手辣"
    ],
    "one_line": "丐帮叛徒，揭露萧峰契丹人身份的推手"
  },
  {
    "id": "char_zi_mu",
    "name": "左子穆",
    "role": "龙套",
    "identity": "无量剑东宗掌门",
    "faction": "faction_wu_liang_jian",
    "personality": [
      "好面子",
      "心胸狭窄",
      "武功平平"
    ],
    "one_line": "无量剑东宗掌门，剑湖宫比武主持人"
  },
  {
    "id": "char_xin_shuang_qing",
    "name": "辛双清",
    "role": "龙套",
    "identity": "无量剑西宗掌门",
    "faction": "faction_wu_liang_jian",
    "personality": [
      "沉稳",
      "好胜"
    ],
    "one_line": "无量剑西宗掌门，道姑"
  },
  {
    "id": "char_deng_bai_chuan",
    "name": "邓百川",
    "role": "龙套",
    "identity": "慕容氏四大家臣之首",
    "faction": "faction_gu_su_mu_rong",
    "personality": [
      "忠心耿耿",
      "武功高强",
      "沉稳老练"
    ],
    "one_line": "慕容氏四大家臣之首，忠心跟随慕容复"
  },
  {
    "id": "char_wang_fu_ren",
    "name": "王夫人",
    "role": "次要",
    "identity": "曼陀山庄主人，段正淳旧情人",
    "faction": null,
    "personality": [
      "刚烈果断",
      "爱恨分明",
      "护女心切"
    ],
    "one_line": "王语嫣之母，曼陀山庄主人，段正淳旧情人"
  }
]

### factions.json (12 条)
[
  {
    "id": "faction_shao_lin",
    "name": "少林寺",
    "type": "寺院",
    "location": "loc_shao_shi_shan",
    "one_line": "武林泰斗，千年古刹，藏有七十二绝技与易筋经等绝学"
  },
  {
    "id": "faction_gai_bang",
    "name": "丐帮",
    "type": "帮派",
    "location": "loc_zhong_yuan",
    "one_line": "天下第一大帮，萧峰曾任帮主，擅降龙十八掌与打狗棒法"
  },
  {
    "id": "faction_xing_xiu_pai",
    "name": "星宿派",
    "type": "武林门派",
    "location": "loc_xing_xiu_hai",
    "one_line": "丁春秋所创邪派，擅用毒功，弟子善于阿谀奉承"
  },
  {
    "id": "faction_xiao_yao_pai",
    "name": "逍遥派",
    "type": "武林门派",
    "location": "loc_tian_shan",
    "one_line": "隐世门派，武功精妙绝伦，无崖子为掌门，天山童姥与李秋水为同门"
  },
  {
    "id": "faction_ling_jiu_gong",
    "name": "灵鹫宫",
    "type": "武林门派",
    "location": "loc_piao_miao_feng",
    "one_line": "天山缥缈峰上，天山童姥统领，辖制三十六洞七十二岛"
  },
  {
    "id": "faction_duan_shi",
    "name": "大理段氏",
    "type": "王族",
    "location": "loc_da_li",
    "one_line": "大理皇室，武学传家，擅一阳指与六脉神剑，天龙寺为武学根基"
  },
  {
    "id": "faction_gu_su_mu_rong",
    "name": "姑苏慕容氏",
    "type": "家族",
    "location": "loc_yan_zi_wu",
    "one_line": "以彼之道还施彼身闻名武林，一心复燕国大业"
  },
  {
    "id": "faction_wu_liang_jian",
    "name": "无量剑",
    "type": "武林门派",
    "location": "loc_wu_liang_shan",
    "one_line": "大理无量山门派，分东西二宗，每五年比武斗剑争夺剑湖宫"
  },
  {
    "id": "faction_da_lun_si",
    "name": "大轮寺",
    "type": "寺院",
    "location": "loc_xi_yu",
    "one_line": "吐蕃大雪山寺庙，鸠摩智为住持，佛法武学并重"
  },
  {
    "id": "faction_si_da_e_ren",
    "name": "四大恶人",
    "type": "帮派",
    "location": "loc_da_li",
    "one_line": "段延庆为首，叶二娘、岳老三、云中鹤为辅，江湖恶名昭彰"
  },
  {
    "id": "faction_xi_xia",
    "name": "西夏国",
    "type": "王族",
    "location": "loc_xi_xia",
    "one_line": "西北强国，梦姑所在，西夏招亲为虚竹与梦姑重逢之机"
  },
  {
    "id": "faction_liao_guo",
    "name": "辽国",
    "type": "王族",
    "location": "loc_liao_guo",
    "one_line": "契丹大国，萧峰的祖国，耶律洪基为皇帝"
  }
]

### locations.json (26 条)
[
  {
    "id": "loc_da_li",
    "name": "大理",
    "region": "西南",
    "one_line": "段氏皇室所在，大理国都城，天龙寺所在地"
  },
  {
    "id": "loc_xi_xia",
    "name": "西夏",
    "region": "西北",
    "one_line": "西夏国，梦姑所在，虚竹与梦姑重逢之地"
  },
  {
    "id": "loc_gu_su",
    "name": "姑苏",
    "region": "江南",
    "one_line": "慕容氏老家，苏州地区，燕子坞参合庄所在"
  },
  {
    "id": "loc_ling_jiu_gong",
    "name": "灵鹫宫",
    "region": "天山",
    "one_line": "天山童姥的势力范围，缥缈峰上，辖制三十六洞七十二岛"
  },
  {
    "id": "loc_piao_miao_feng",
    "name": "缥缈峰",
    "region": "天山",
    "one_line": "灵鹫宫所在山峰，天山童姥与李秋水激战之地"
  },
  {
    "id": "loc_ju_xian_zhuang",
    "name": "聚贤庄",
    "region": "中原",
    "one_line": "乔峰大战群雄之地，游坦之故乡"
  },
  {
    "id": "loc_yan_men_guan",
    "name": "雁门关",
    "region": "北方",
    "one_line": "萧远山血案发生地，萧峰自尽处，宋辽边界要塞"
  },
  {
    "id": "loc_liao_guo",
    "name": "辽国",
    "region": "北方",
    "one_line": "萧峰的契丹祖国，耶律洪基为皇帝"
  },
  {
    "id": "loc_tian_shan",
    "name": "天山",
    "region": "西北",
    "one_line": "逍遥派总坛所在，灵鹫宫与缥缈峰均在此"
  },
  {
    "id": "loc_wu_liang_shan",
    "name": "无量山",
    "region": "大理",
    "one_line": "无量剑派所在地，段誉初遇钟灵处，琅嬛福地所在"
  },
  {
    "id": "loc_shao_shi_shan",
    "name": "少室山",
    "region": "中原",
    "one_line": "少林寺所在，少室山大战发生地，萧峰身世终揭处"
  },
  {
    "id": "loc_man_tuo_shan_zhuang",
    "name": "曼陀山庄",
    "region": "江南",
    "one_line": "王夫人住所，位于太湖，段誉初遇王语嫣处"
  },
  {
    "id": "loc_wu_xi",
    "name": "无锡",
    "region": "江南",
    "one_line": "萧峰与段誉结义处，杏子林丐帮大会所在地"
  },
  {
    "id": "loc_xin_yang",
    "name": "信阳",
    "region": "中原",
    "one_line": "马夫人住处，萧峰追查身世处"
  },
  {
    "id": "loc_zhen_nan_wang_fu",
    "name": "镇南王府",
    "region": "大理",
    "one_line": "段正淳府邸，段誉成长处"
  },
  {
    "id": "loc_yan_zi_wu",
    "name": "燕子坞",
    "region": "江南",
    "one_line": "慕容氏居所，参合庄所在"
  },
  {
    "id": "loc_can_he_zhuang",
    "name": "参合庄",
    "region": "江南",
    "one_line": "慕容氏祖宅，位于燕子坞"
  },
  {
    "id": "loc_ting_shui_xiang_xie",
    "name": "听香水榭",
    "region": "江南",
    "one_line": "阿朱居所，位于太湖小岛"
  },
  {
    "id": "loc_lei_gu_shan",
    "name": "擂鼓山",
    "region": "中原",
    "one_line": "苏星河设珍珑棋局处，虚竹得无崖子传功之地"
  },
  {
    "id": "loc_xiao_jing_hu",
    "name": "小镜湖",
    "region": "江南",
    "one_line": "阮星竹隐居处，阿朱殒命之地"
  },
  {
    "id": "loc_wan_jie_gu",
    "name": "万劫谷",
    "region": "大理",
    "one_line": "钟万仇居所，段誉被囚之地，四大恶人聚集处"
  },
  {
    "id": "loc_tian_long_si",
    "name": "天龙寺",
    "region": "大理",
    "one_line": "大理段氏武学根基所在，藏有六脉神剑经"
  },
  {
    "id": "loc_lang_huan_fu_di",
    "name": "琅嬛福地",
    "region": "大理",
    "one_line": "无量山中石洞，藏有天下武学典籍，段誉习得北冥神功处"
  },
  {
    "id": "loc_xing_xiu_hai",
    "name": "星宿海",
    "region": "西域",
    "one_line": "星宿派总坛所在，丁春秋盘踞之地"
  },
  {
    "id": "loc_xi_yu",
    "name": "西域",
    "region": "西域",
    "one_line": "大轮寺所在，鸠摩智故乡"
  },
  {
    "id": "loc_zhong_yuan",
    "name": "中原",
    "region": "中原",
    "one_line": "少林寺、丐帮等门派所在，武林中心"
  }
]

### skills.json (27 条)
[
  {
    "id": "skill_liu_mai_shen_jian",
    "name": "六脉神剑",
    "type": "剑法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "大理段氏至高绝学，以一阳指力化为无形剑气，六脉齐发"
  },
  {
    "id": "skill_yi_yang_zhi",
    "name": "一阳指",
    "type": "指法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "大理段氏点穴绝技，以指力隔空点穴，为六脉神剑之根基"
  },
  {
    "id": "skill_bei_ming_shen_gong",
    "name": "北冥神功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "逍遥派至高内功，可吸取他人内力为己用"
  },
  {
    "id": "skill_ling_bo_wei_bu",
    "name": "凌波微步",
    "type": "轻功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "逍遥派轻功绝学，按易经六十四卦方位行走，飘逸如仙"
  },
  {
    "id": "skill_huo_yan_dao",
    "name": "火焰刀",
    "type": "刀法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "鸠摩智绝技，以掌力化为刀气，灼热凌厉"
  },
  {
    "id": "skill_xiao_wu_xiang_gong",
    "name": "小无相功",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "逍遥派内功，可模仿他派武功，以内力驱动各派招式"
  },
  {
    "id": "skill_xiang_long_shi_ba_zhang",
    "name": "降龙十八掌",
    "type": "掌法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "丐帮镇帮之宝，至刚至阳的掌法，萧峰传于虚竹"
  },
  {
    "id": "skill_da_gou_bang_fa",
    "name": "打狗棒法",
    "type": "棒法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "丐帮帮主绝学，配合打狗棒使用，轻灵飘逸"
  },
  {
    "id": "skill_dou_zhuan_xing_yi",
    "name": "斗转星移",
    "type": "奇门",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "慕容氏绝技，以彼之道还施彼身，反弹对手攻击"
  },
  {
    "id": "skill_yi_jin_jing",
    "name": "易筋经",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "少林至高内功秘籍，可脱胎换骨，重塑经脉"
  },
  {
    "id": "skill_hua_gong_da_fa",
    "name": "化功大法",
    "type": "毒功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "丁春秋邪功，以毒化去他人内力，武林大忌"
  },
  {
    "id": "skill_sheng_si_fu",
    "name": "生死符",
    "type": "暗器",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "逍遥派暗器功夫，中者求生不得求死不能，天山童姥与虚竹均擅此技"
  },
  {
    "id": "skill_ban_ruo_zhang",
    "name": "般若掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，佛门刚猛掌法"
  },
  {
    "id": "skill_nian_hua_zhi",
    "name": "拈花指",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，以指力弹射伤人"
  },
  {
    "id": "skill_shen_zu_jing",
    "name": "神足经",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "天竺武学，游坦之所习，以内力驱毒护体"
  },
  {
    "id": "skill_can_he_zhi",
    "name": "参合指",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "慕容氏家传指法绝技，威力不逊一阳指"
  },
  {
    "id": "skill_wu_xiang_jie_zhi",
    "name": "无相劫指",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，无形无相的指力攻击"
  },
  {
    "id": "skill_long_zhao_shou",
    "name": "龙爪手",
    "type": "拳法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林擒拿绝技，以爪法锁拿对手关节要害"
  },
  {
    "id": "skill_jia_sha_fu_mo_gong",
    "name": "袈裟伏魔功",
    "type": "奇门",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，以袈裟为兵器施展伏魔功法"
  },
  {
    "id": "skill_fu_mo_zhang_fa",
    "name": "伏魔杖法",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林杖法，慕容博与萧远山交手时曾使用"
  },
  {
    "id": "skill_han_xiu_fu_xue",
    "name": "寒袖拂穴",
    "type": "指法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "李秋水拂穴绝技，以衣袖拂过穴道制敌"
  },
  {
    "id": "skill_bai_hong_zhang_li",
    "name": "白虹掌力",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "李秋水掌力，可绕过障碍物攻击对手"
  },
  {
    "id": "skill_qin_long_gong",
    "name": "擒龙功",
    "type": "奇门",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "以气御物的高深内功，萧峰曾隔空取物"
  },
  {
    "id": "skill_wu_luo_qing_yan_zhang",
    "name": "五罗轻烟掌",
    "type": "掌法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "秦红棉独门掌法，掌力轻柔如烟"
  },
  {
    "id": "skill_da_jin_gang_zhang",
    "name": "大金刚掌",
    "type": "掌法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林刚猛掌法，威力极大"
  },
  {
    "id": "skill_wei_tuo_chu",
    "name": "韦陀杵",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "少林七十二绝技之一，以禅杖施展的杖法"
  },
  {
    "id": "skill_tai_zu_chang_quan",
    "name": "太祖长拳",
    "type": "拳法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "宋太祖所创拳法，流传甚广，萧峰以之对敌"
  }
]

### techniques.json (10 条)
[
  {
    "id": "tech_shao_shang_jian",
    "name": "少商剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_shang_yang_jian",
    "name": "商阳剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_zhong_chong_jian",
    "name": "中冲剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_guan_chong_jian",
    "name": "关冲剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_shao_chong_jian",
    "name": "少冲剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_shao_ze_jian",
    "name": "少泽剑",
    "type": "attack",
    "source_skill": "skill_liu_mai_shen_jian"
  },
  {
    "id": "tech_kang_long_you_hui",
    "name": "亢龙有悔",
    "type": "attack",
    "source_skill": "skill_xiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_fei_long_zai_tian",
    "name": "飞龙在天",
    "type": "attack",
    "source_skill": "skill_xiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_jian_long_zai_tian",
    "name": "见龙在田",
    "type": "defense",
    "source_skill": "skill_xiang_long_shi_ba_zhang"
  },
  {
    "id": "tech_fan_lao_huan_tong",
    "name": "返老还童",
    "type": "special",
    "source_skill": null
  }
]

### items.json (12 条)
[
  {
    "id": "item_bei_ming_shen_gong_bo_juan",
    "name": "北冥神功帛卷",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_bei_ming_shen_gong",
      "skill_ling_bo_wei_bu"
    ],
    "one_line": "无量山琅嬛福地中发现的武学帛卷，载有北冥神功与凌波微步"
  },
  {
    "id": "item_da_gou_bang",
    "name": "打狗棒",
    "type": "兵器",
    "owner": "char_xiao_feng",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_da_gou_bang_fa"
    ],
    "one_line": "丐帮帮主信物，翠绿竹棒，配合打狗棒法使用"
  },
  {
    "id": "item_yi_jin_jing_fan_wen",
    "name": "易筋经梵文经书",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_yi_jin_jing"
    ],
    "one_line": "少林至高内功秘籍，以梵文书写，游坦之误打误撞修习成功"
  },
  {
    "id": "item_jin_dian_xiao_he",
    "name": "金钿小盒",
    "type": "信物",
    "owner": "char_gan_bao_bao",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "甘宝宝托段誉带给段正淳的信物，内藏钟灵生辰八字"
  },
  {
    "id": "item_shen_mu_wang_ding",
    "name": "神木王鼎",
    "type": "奇门",
    "owner": "char_a_zi",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "星宿派宝物，阿紫用来驱使毒蛇的法器"
  },
  {
    "id": "item_xiu_luo_dao",
    "name": "修罗刀",
    "type": "兵器",
    "owner": "char_qin_hong_mian",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "秦红棉的兵刃，双刀，木婉清亦曾使用"
  },
  {
    "id": "item_sheng_si_fu_bing_pian",
    "name": "生死符薄冰",
    "type": "暗器",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_sheng_si_fu"
    ],
    "one_line": "天山童姥以真气凝结的薄冰片，射入对手体内控制生死"
  },
  {
    "id": "item_bei_su_qing_feng",
    "name": "悲酥清风",
    "type": "毒药",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "西夏一品堂的无色无臭毒气，中毒者泪下如雨全身酥软"
  },
  {
    "id": "item_mang_gu_zhu_ha",
    "name": "莽牯朱蛤",
    "type": "异兽",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "无量山中的万毒之王，段誉误吞后百毒不侵"
  },
  {
    "id": "item_shan_dian_diao",
    "name": "闪电貂",
    "type": "异兽",
    "owner": "char_zhong_ling",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "钟灵豢养的灰白色小貂，行动如电，咬人中剧毒"
  },
  {
    "id": "item_shao_lin_jue_ji_shu",
    "name": "少林七十二绝技手抄本",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "慕容博手书的少林绝技要旨与破解之道，共三卷"
  },
  {
    "id": "item_wu_liang_yu_bi_bao_jian",
    "name": "无量玉壁宝石剑",
    "type": "兵器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "无量山峭壁洞孔中悬挂的镶宝石长剑"
  }
]

### dialogues.json (前 43 条 / 共 43 条)
[
  {
    "index": 0,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": null,
    "text": "在下单名一誉字，从来没学过什么武艺。我看到别人摔交，不论他真摔还是假摔，忍不住总是要笑的。",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 29,
    "line_end": 29
  },
  {
    "index": 1,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_gong_guang_jie",
    "text": "你师父是你的师父，你师父可不是我的师父。你师父差得动你，你师父可差不动我。你师父叫你跟人家比剑，你已经跟人家比过了。你师父叫我跟你比剑，我一来不会，二来怕输，三来怕痛，四来怕死，因此是不比的。我说不比，就是不比。",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 37,
    "line_end": 37
  },
  {
    "index": 2,
    "speaker": "char_mu_wan_qing",
    "speaker_name": "木婉清",
    "listener": "char_duan_yu",
    "text": "喂，段誉，我的名字，不用钟灵这小鬼跟你说，我自己说好了，我叫木婉清。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 337,
    "line_end": 337
  },
  {
    "index": 3,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_mu_wan_qing",
    "text": "啊，水木清华，婉兮清扬。姓得好，名字也好。",
    "tone": "欣喜",
    "chapter": 3,
    "line_start": 337,
    "line_end": 337
  },
  {
    "index": 4,
    "speaker": "char_bao_qian_ling",
    "speaker_name": "鲍千灵",
    "listener": "char_duan_yu",
    "text": "誉儿，你遇过星宿海的丁春秋吗？",
    "tone": "疑问",
    "chapter": 10,
    "line_start": 33,
    "line_end": 33
  },
  {
    "index": 5,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": "char_duan_yu",
    "text": "好兄弟，来来来，咱哥儿俩上岸去斗酒，喝他二十大碗。",
    "tone": "欣喜",
    "chapter": 18,
    "line_start": 59,
    "line_end": 59
  },
  {
    "index": 6,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_xiao_feng",
    "text": "你身材魁梧，一站出去就引得人人注目，最好改装成一个形貌寻常、身上没丝毫特异之处的江湖豪士。这种人在道上一天能撞见几百个，那就谁也不会来向你多瞧一眼。",
    "tone": "陈述",
    "chapter": 21,
    "line_start": 11,
    "line_end": 11
  },
  {
    "index": 7,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_a_zhu",
    "text": "我若死在段正淳手下，谁陪你在雁门关外牧牛放羊呢？",
    "tone": "调侃",
    "chapter": 22,
    "line_start": 7,
    "line_end": 7
  },
  {
    "index": 8,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_a_zhu",
    "text": "错了，你大哥第一爱阿朱，第二才爱喝酒，第三爱打架！",
    "tone": "欣喜",
    "chapter": 22,
    "line_start": 15,
    "line_end": 15
  },
  {
    "index": 9,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_xiao_feng",
    "text": "大哥，报仇大事，不争一朝一夕。咱们谋定而后动，就算敌众我寡，不能力胜，难道不能智取么？",
    "tone": "恳求",
    "chapter": 22,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 10,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": null,
    "text": "父母之仇，不共戴天。报此大仇，已不用管江湖上的什么规矩道义，多恶毒的手段也使得上。",
    "tone": "愤怒",
    "chapter": 22,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 11,
    "speaker": "char_bao_bu_tong",
    "speaker_name": "包不同",
    "listener": "char_xiang_wang_hai",
    "text": "唉，这几天心境挺坏，提不起做买卖兴致，今天听到他杀父、杀母、杀师的恶行，更加气愤！",
    "tone": "愤怒",
    "chapter": 19,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 12,
    "speaker": "char_bao_bu_tong",
    "speaker_name": "包不同",
    "listener": null,
    "text": "此人丧心病狂，行止乖张。本来嘛，他曾为敝帮立过不少大功，便在最近，咱们误中奸人暗算，也是他出手相救的。可是大丈夫立身处世，总当以大节为重，一些小恩小惠，也只好置之脑后了。",
    "tone": "陈述",
    "chapter": 19,
    "line_start": 95,
    "line_end": 95
  },
  {
    "index": 13,
    "speaker": "char_quan_guan_qing",
    "speaker_name": "全冠清",
    "listener": "char_xiao_feng",
    "text": "鲍千灵的项上人头，乔兄何时要取，随时来拿便是。鲍某专做没本钱生意，全副家当蚀在乔兄手上，也没什么。阁下连父亲、母亲、师父都杀，对鲍某这般泛泛之交，下手何必容情？",
    "tone": "愤怒",
    "chapter": 19,
    "line_start": 43,
    "line_end": 43
  },
  {
    "index": 14,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": "char_a_zhu",
    "text": "阿朱，明日我去给你找一个天下最好的大夫治伤，你放心安睡罢！",
    "tone": "欣喜",
    "chapter": 19,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 15,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": null,
    "text": "我便是乔峰，你们倘若不说，后患无穷！",
    "tone": "愤怒",
    "chapter": 21,
    "line_start": 59,
    "line_end": 59
  },
  {
    "index": 16,
    "speaker": "char_tan_gong",
    "speaker_name": "谭公",
    "listener": "char_xiao_feng",
    "text": "乔帮主，今日之事，行善在你，行恶也在你。我师兄妹俩问心无愧，天日可表。你想要知道的事，恕我不能奉告。真正对不住！",
    "tone": "冷酷",
    "chapter": 21,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 17,
    "speaker": "char_tan_gong",
    "speaker_name": "谭公",
    "listener": "char_tan_po",
    "text": "小娟，说不得，千万说不得。",
    "tone": "焦急",
    "chapter": 21,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 18,
    "speaker": "char_tan_gong",
    "speaker_name": "谭公",
    "listener": "char_tan_po",
    "text": "小娟，我这一生从来没求过你什么，这是我唯一向你恳求的事，你说什么也得答允。",
    "tone": "恳求",
    "chapter": 21,
    "line_start": 61,
    "line_end": 61
  },
  {
    "index": 19,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_wu_zhang_lao",
    "text": "吴长老，在下确是契丹人。多承各位重义，在下感激不尽，帮主之位，却万万不能当。",
    "tone": "陈述",
    "chapter": 50,
    "line_start": 97,
    "line_end": 97
  },
  {
    "index": 20,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": null,
    "text": "弟子不但喝酒，还喝得烂醉如泥。",
    "tone": "陈述",
    "chapter": 39,
    "line_start": 79,
    "line_end": 79
  },
  {
    "index": 21,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_duan_yu",
    "text": "三弟，你这六脉神剑尚未纯熟，六门剑法齐使，转换之时中间留有空隙，对方便能乘机趋避。你不妨只使一门剑法试试。",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 15,
    "line_end": 15
  },
  {
    "index": 22,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "丐帮向以仁侠为先，你身为一帮之主，岂可和星宿派的妖人同流合污？没的辱没了丐帮数百年来的侠义美名！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 17,
    "line_end": 17
  },
  {
    "index": 23,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "人家饶你性命，你反下毒手，算什么英雄好汉？",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 69,
    "line_end": 69
  },
  {
    "index": 24,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "萧某大好男儿，竟和你这种人齐名！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 75,
    "line_end": 75
  },
  {
    "index": 25,
    "speaker": "char_mu_rong_bo",
    "speaker_name": "慕容博",
    "listener": "char_mu_rong_fu",
    "text": "你有儿子没有？",
    "tone": "疑问",
    "chapter": 42,
    "line_start": 85,
    "line_end": 85
  },
  {
    "index": 26,
    "speaker": "char_mu_rong_fu",
    "speaker_name": "慕容复",
    "listener": "char_hui_yi_seng",
    "text": "我尚未婚配，何来子息？",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 87,
    "line_end": 87
  },
  {
    "index": 27,
    "speaker": "char_mu_rong_bo",
    "speaker_name": "慕容博",
    "listener": "char_mu_rong_fu",
    "text": "你高祖有儿子，你曾祖、祖父、父亲都有儿子，便是你没有儿子！嘿嘿，大燕国当年慕容皝、慕容恪、慕容垂、慕容德、慕容龙城何等英雄，却不料都变成了断种绝代的无后之人！",
    "tone": "嘲讽",
    "chapter": 42,
    "line_start": 87,
    "line_end": 87
  },
  {
    "index": 28,
    "speaker": "char_mu_rong_bo",
    "speaker_name": "慕容博",
    "listener": "char_mu_rong_fu",
    "text": "古来成大功业者，那一个不历尽千辛万苦？汉高祖有白登之困，汉光武有冀北之厄，倘若都似你这么引剑一割，只不过是个心窄气狭的自了汉而已，还说得上什么中兴开国？你连勾践、韩信也不如，当真无知无识！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 91,
    "line_end": 91
  },
  {
    "index": 29,
    "speaker": "char_mu_rong_bo",
    "speaker_name": "慕容博",
    "listener": "char_xiao_feng",
    "text": "乔大侠武功卓绝，果然名不虚传，老衲想领教几招！",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 103,
    "line_end": 103
  },
  {
    "index": 30,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": "char_yu_po_po",
    "text": "少林派是我师门，你言语不得无礼，快向少林寺方丈谢罪。",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 31,
    "speaker": "char_mu_rong_fu",
    "speaker_name": "慕容复",
    "listener": "char_hui_yi_seng",
    "text": "慕容复知错了！",
    "tone": "悲伤",
    "chapter": 42,
    "line_start": 93,
    "line_end": 93
  },
  {
    "index": 32,
    "speaker": "char_yun_zhong_he",
    "speaker_name": "云中鹤",
    "listener": null,
    "text": "姓云的最喜欢美貌姑娘，见到这王姑娘跳崖寻死，我自然舍不得，我是要抓她回去，做几天老婆。",
    "tone": "嘲讽",
    "chapter": 45,
    "line_start": 61,
    "line_end": 61
  },
  {
    "index": 33,
    "speaker": "char_a_zi",
    "speaker_name": "阿紫",
    "listener": "char_ye_lv_hong_ji",
    "text": "皇上的话，永不会错，你只须遵照皇上的话做，定有你好处。",
    "tone": "陈述",
    "chapter": 50,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 34,
    "speaker": "char_a_zi",
    "speaker_name": "阿紫",
    "listener": "char_xiao_feng",
    "text": "姊夫，你居然还惦记着我。",
    "tone": "欣喜",
    "chapter": 50,
    "line_start": 49,
    "line_end": 49
  },
  {
    "index": 35,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_xiao_feng",
    "text": "大哥，不好了！",
    "tone": "焦急",
    "chapter": 42,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 36,
    "speaker": "char_wang_yu_yan",
    "speaker_name": "王语嫣",
    "listener": "char_duan_yu",
    "text": "段公子，手下留情！",
    "tone": "恳求",
    "chapter": 42,
    "line_start": 59,
    "line_end": 59
  },
  {
    "index": 37,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_mu_rong_fu",
    "text": "咱们又没仇怨，何必再斗？不打了，不打了！",
    "tone": "焦急",
    "chapter": 42,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 38,
    "speaker": "char_jiu_mo_zhi",
    "speaker_name": "鸠摩智",
    "listener": "char_duan_yu",
    "text": "段公子会错意了。小僧当年与慕容先生有约，要借贵门《六脉神剑经》去给他一观。此约未践，一直耿耿于怀。",
    "tone": "陈述",
    "chapter": 11,
    "line_start": 21,
    "line_end": 21
  },
  {
    "index": 39,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_he_lian_tie_shu",
    "text": "快报与你家将军知道，说道丐帮乔峰、江南慕容复，前来拜会西夏赫连大将军。",
    "tone": "陈述",
    "chapter": 18,
    "line_start": 75,
    "line_end": 75
  },
  {
    "index": 40,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_nan_hai_e_shen",
    "text": "南海鳄神岳老三，你本来最拿手的本领，是喀喇一声，扭断了旁人脖子，近年来功夫大有进步，现下最得意的武功，是鳄尾鞭和鳄嘴剪。我要对付你，自然是用鳄尾鞭与鳄嘴剪了。",
    "tone": "调侃",
    "chapter": 18,
    "line_start": 95,
    "line_end": 95
  },
  {
    "index": 41,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_wang_yu_yan",
    "text": "姑⋯⋯姑娘，你叫什么名字？",
    "tone": "疑问",
    "chapter": 12,
    "line_start": 263,
    "line_end": 263
  },
  {
    "index": 42,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": null,
    "text": "小僧虚竹，在少林寺出家。",
    "tone": "陈述",
    "chapter": 29,
    "line_start": 283,
    "line_end": 283
  }
]

### chapter_summaries.json (50 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      "无量剑东西二宗比武",
      "段誉初入无量山",
      "钟灵出场",
      "龚光杰羞辱段誉",
      "钟灵以毒蛇戏弄无量剑"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_zhong_ling"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      "段誉为救钟灵前往万劫谷",
      "段誉遇木婉清",
      "木婉清以毒箭射伤段誉",
      "段誉发现琅嬛福地",
      "段誉发现北冥神功与凌波微步秘籍"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing",
      "char_qin_hong_mian",
      "char_zhong_wan_chou"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      "段誉习得凌波微步",
      "段誉逃离万劫谷",
      "木婉清自报家门",
      "段誉与木婉清同行",
      "遭遇南海鳄神"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      "四大恶人追击段誉",
      "段誉逃入大理",
      "段正淳派人接应",
      "木婉清受伤",
      "段誉与木婉清感情加深"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing",
      "char_duan_zheng_chun",
      "char_dao_bai_feng"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      "四大恶人齐聚大理",
      "木婉清身世揭晓",
      "段誉与木婉清竟是兄妹",
      "段誉木婉清悲痛欲绝",
      "刀白凤暗中相助"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing",
      "char_duan_zheng_chun",
      "char_qin_hong_mian",
      "char_dao_bai_feng"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回",
    "key_events": [
      "段誉被囚万劫谷",
      "木婉清前来营救",
      "段正淳与秦红棉旧情复燃",
      "刀白凤醋意大发",
      "段誉逃出万劫谷"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing",
      "char_duan_zheng_chun",
      "char_qin_hong_mian",
      "char_zhong_ling"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回",
    "key_events": [
      "段誉返回大理",
      "鸠摩智来天龙寺挑战",
      "鸠摩智欲夺六脉神剑图谱",
      "段誉被鸠摩智挟持",
      "保定帝商议对策"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_jiu_mo_zhi",
      "char_duan_zheng_chun"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回",
    "key_events": [
      "段誉被鸠摩智挟持北上",
      "阿朱阿碧出现",
      "段誉被带往燕子坞",
      "段誉初见王语嫣"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_jiu_mo_zhi",
      "char_a_zhu",
      "char_wang_yu_yan"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回",
    "key_events": [
      "段誉对王语嫣一见钟情",
      "鸠摩智逼段誉默写剑经",
      "阿朱阿碧暗中相助",
      "包不同刁难段誉"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_wang_yu_yan",
      "char_jiu_mo_zhi",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回",
    "key_events": [
      "段誉被带往天龙寺",
      "段誉体内真气失控",
      "被误认为习得化功大法",
      "高僧以六脉神剑驱毒",
      "段誉初窥六脉神剑"
    ],
    "key_characters": [
      "char_duan_yu"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回",
    "key_events": [
      "鸠摩智闯天龙寺",
      "枯荣大师焚毁图谱",
      "段誉暗记图谱",
      "段誉被鸠摩智挟持离开",
      "段誉暗中修炼六脉神剑"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_jiu_mo_zhi",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回",
    "key_events": [
      "段誉穴道渐解",
      "段誉以北冥神功吸取鸠摩智内力",
      "段誉逃脱鸠摩智",
      "段誉初遇慕容复",
      "严妈妈事件"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_jiu_mo_zhi",
      "char_a_zhu",
      "char_wang_yu_yan",
      "char_mu_rong_fu"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回",
    "key_events": [
      "段誉与王语嫣同行",
      "包不同嘲讽段誉",
      "段誉展现六脉神剑",
      "王语嫣对段誉改观",
      "得知慕容复去少林"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_wang_yu_yan"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回",
    "key_events": [
      "乔峰正式登场",
      "乔峰任丐帮帮主",
      "乔峰与段誉斗酒",
      "二人结为异姓兄弟"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_duan_yu"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回",
    "key_events": [
      "丐帮大会",
      "全冠清阴谋揭露",
      "乔峰身世被揭",
      "乔峰被指为凶手",
      "乔峰离开丐帮"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回",
    "key_events": [
      "乔峰追查身世",
      "寻找带头大哥",
      "乔峰与阿朱同行",
      "丐帮旧部追杀",
      "阿朱对乔峰生情"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回",
    "key_events": [
      "乔峰找到智光禅师",
      "雁门关之战真相",
      "萧远山未死",
      "萧远山在少林隐居",
      "段誉与王语嫣遇险"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回",
    "key_events": [
      "聚贤庄英雄宴",
      "乔峰单枪匹马赴宴",
      "乔峰与众人对饮绝交酒",
      "乔峰大战群雄",
      "游坦之目睹父亲被杀"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_you_tan_zhi"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回",
    "key_events": [
      "聚贤庄血战",
      "乔峰打死游驹",
      "游坦之悲愤",
      "乔峰身受重伤",
      "查明带头大哥是段正淳"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_you_tan_zhi",
      "char_duan_zheng_chun"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回",
    "key_events": [
      "乔峰伤愈",
      "乔峰寻找段正淳",
      "阿朱劝阻乔峰",
      "发现段正淳非真凶",
      "小镜湖畔查探真相"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_duan_zheng_chun"
    ]
  },
  {
    "chapter": 21,
    "title": "第二十一回",
    "key_events": [
      "乔峰查明真相",
      "乔峰与阿朱感情升温",
      "阿朱愿随乔峰塞外牧羊",
      "乔峰易容改装",
      "逼问谭公谭婆"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 22,
    "title": "第二十二回",
    "key_events": [
      "乔峰追查马夫人康敏",
      "阿朱骗康敏说出带头大哥",
      "乔峰与阿朱感情深厚",
      "阿朱偷出易筋经",
      "乔峰承诺带阿朱去塞外"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu"
    ]
  },
  {
    "chapter": 23,
    "title": "第二十三回",
    "key_events": [
      "乔峰与阿朱赶往小镜湖",
      "阿朱发现段正淳是生父",
      "阿朱悲痛万分",
      "段正淳与阮星竹旧情复燃"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_duan_zheng_chun",
      "char_ruan_xing_zhu"
    ]
  },
  {
    "chapter": 24,
    "title": "第二十四回",
    "key_events": [
      "乔峰与段正淳对峙",
      "段正淳承认雁门关之战",
      "乔峰欲杀段正淳",
      "阿朱表明身世",
      "乔峰震惊"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_duan_zheng_chun"
    ]
  },
  {
    "chapter": 25,
    "title": "第二十五回",
    "key_events": [
      "阿朱易容为段正淳",
      "乔峰打死阿朱",
      "阿朱临死告真相",
      "乔峰悲痛欲绝",
      "阿紫出现"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zhu",
      "char_a_zi",
      "char_duan_zheng_chun"
    ]
  },
  {
    "chapter": 26,
    "title": "第二十六回",
    "key_events": [
      "乔峰万念俱灰",
      "乔峰独饮悼念阿朱",
      "阿紫纠缠乔峰",
      "阿紫用毒酒戏弄酒保",
      "乔峰制服摩云子"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zi"
    ]
  },
  {
    "chapter": 27,
    "title": "第二十七回",
    "key_events": [
      "乔峰带阿紫前往塞外",
      "遭遇星宿派门人",
      "乔峰以降龙十八掌击退",
      "阿紫对乔峰痴情",
      "游坦之被阿紫所救"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zi",
      "char_you_tan_zhi"
    ]
  },
  {
    "chapter": 28,
    "title": "第二十八回",
    "key_events": [
      "游坦之对阿紫痴心",
      "阿紫利用游坦之",
      "游坦之练习易筋经",
      "游坦之练成易筋经",
      "阿紫若即若离"
    ],
    "key_characters": [
      "char_you_tan_zhi",
      "char_a_zi"
    ]
  },
  {
    "chapter": 29,
    "title": "第二十九回",
    "key_events": [
      "虚竹正式登场",
      "虚竹在少林出家",
      "少林英雄大会",
      "丁春秋率星宿派挑衅",
      "虚竹被卷入纷争"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_ding_chun_qiu",
      "char_xuan_ci"
    ]
  },
  {
    "chapter": 30,
    "title": "第三十回",
    "key_events": [
      "丁春秋以化功大法伤人",
      "虚竹挺身而出",
      "虚竹被天山童姥劫持",
      "虚竹前往缥缈峰",
      "虚竹发现逍遥派秘密"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_ding_chun_qiu",
      "char_tian_shan_tong_lao"
    ]
  },
  {
    "chapter": 31,
    "title": "第三十一回",
    "key_events": [
      "虚竹被天山童姥逼迫练功",
      "天山童姥传授武功",
      "虚竹学会生死符解法",
      "李秋水出现",
      "虚竹被卷入恩怨"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_tian_shan_tong_lao",
      "char_li_qiu_shui"
    ]
  },
  {
    "chapter": 32,
    "title": "第三十二回",
    "key_events": [
      "天山童姥与李秋水大战",
      "虚竹被误伤",
      "天山童姥传功虚竹",
      "虚竹成为灵鹫宫主人",
      "虚竹继承逍遥派掌门"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_tian_shan_tong_lao",
      "char_li_qiu_shui"
    ]
  },
  {
    "chapter": 33,
    "title": "第三十三回",
    "key_events": [
      "虚竹回少林领罪",
      "虚竹被逐出师门",
      "虚竹与鸠摩智对峙",
      "鸠摩智以小无相功催动绝技",
      "慕容复观战"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_jiu_mo_zhi",
      "char_mu_rong_fu"
    ]
  },
  {
    "chapter": 34,
    "title": "第三十四回",
    "key_events": [
      "虚竹大战鸠摩智",
      "虚竹以逍遥派武功击退",
      "段誉赶来助战",
      "段誉以六脉神剑对付鸠摩智",
      "王语嫣对段誉改观"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_jiu_mo_zhi",
      "char_duan_yu",
      "char_wang_yu_yan",
      "char_mu_rong_fu"
    ]
  },
  {
    "chapter": 35,
    "title": "第三十五回",
    "key_events": [
      "虚竹回到灵鹫宫",
      "收服三十六洞七十二岛",
      "以生死符解药换取臣服",
      "虚竹展现仁厚",
      "开始管理灵鹫宫"
    ],
    "key_characters": [
      "char_xu_zhu"
    ]
  },
  {
    "chapter": 36,
    "title": "第三十六回",
    "key_events": [
      "虚竹在冰窖遇见梦姑",
      "二人以酒为媒",
      "情愫暗生",
      "虚竹不知梦姑身份",
      "虚竹思念梦姑"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_xi_xia_gong_zhu"
    ]
  },
  {
    "chapter": 37,
    "title": "第三十七回",
    "key_events": [
      "虚竹带领灵鹫宫部众",
      "前往少林寺",
      "为众人拔除生死符",
      "展现逍遥派武功",
      "向少林方丈谢罪"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_xuan_ci"
    ]
  },
  {
    "chapter": 38,
    "title": "第三十八回",
    "key_events": [
      "段誉与木婉清重逢",
      "段誉得知身世真相",
      "段誉并非段正淳亲生",
      "木婉清安慰段誉",
      "段誉与王语嫣感情进展"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_mu_wan_qing",
      "char_duan_zheng_chun",
      "char_dao_bai_feng"
    ]
  },
  {
    "chapter": 39,
    "title": "第三十九回",
    "key_events": [
      "虚竹向慧轮忏悔",
      "坦承犯戒",
      "慧轮严厉责备",
      "虚竹研习武功",
      "为群豪拔除生死符"
    ],
    "key_characters": [
      "char_xu_zhu"
    ]
  },
  {
    "chapter": 40,
    "title": "第四十回",
    "key_events": [
      "少林寺大战爆发",
      "鸠摩智率大轮寺挑衅",
      "虚竹与鸠摩智对峙",
      "丁春秋率星宿派加入",
      "慕容复趁乱偷袭"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_jiu_mo_zhi",
      "char_ding_chun_qiu",
      "char_mu_rong_fu",
      "char_duan_yu"
    ]
  },
  {
    "chapter": 41,
    "title": "第四十一回",
    "key_events": [
      "萧峰赶来助战",
      "萧峰以降龙十八掌击退敌人",
      "游坦之与萧峰对峙",
      "阿紫观战",
      "萧峰揭露慕容博阴谋"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_you_tan_zhi",
      "char_a_zi",
      "char_mu_rong_bo"
    ]
  },
  {
    "chapter": 42,
    "title": "第四十二回",
    "key_events": [
      "灰衣僧（慕容博）现身",
      "萧远山现身",
      "萧远山与慕容博对峙",
      "虚竹击败鸠摩智",
      "段誉击败慕容复",
      "慕容复疯癫"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_xiao_feng",
      "char_duan_yu",
      "char_mu_rong_fu",
      "char_mu_rong_bo",
      "char_xiao_yuan_shan"
    ]
  },
  {
    "chapter": 43,
    "title": "第四十三回",
    "key_events": [
      "虚竹查明身世",
      "虚竹是玄慈之子",
      "玄慈与叶二娘往事",
      "玄慈圆寂",
      "萧峰与萧远山父子相认"
    ],
    "key_characters": [
      "char_xu_zhu",
      "char_xuan_ci",
      "char_xiao_feng",
      "char_xiao_yuan_shan"
    ]
  },
  {
    "chapter": 44,
    "title": "第四十四回",
    "key_events": [
      "段誉向王语嫣表白",
      "王语嫣接受段誉",
      "段誉得知身世",
      "段誉决定仍做段氏之人",
      "钟灵对段誉有情"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_wang_yu_yan",
      "char_zhong_ling",
      "char_mu_wan_qing"
    ]
  },
  {
    "chapter": 45,
    "title": "第四十五回",
    "key_events": [
      "段誉与王语嫣枯井底相遇",
      "王语嫣跳崖未死",
      "段誉救起王语嫣",
      "段誉以六脉神剑击退敌人",
      "王语嫣对段誉动心"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_wang_yu_yan"
    ]
  },
  {
    "chapter": 46,
    "title": "第四十六回",
    "key_events": [
      "段誉向三位女子表明心意",
      "段誉只爱王语嫣",
      "木婉清与钟灵黯然",
      "段誉与王语嫣感情深厚",
      "四人前往大理"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_wang_yu_yan",
      "char_mu_wan_qing",
      "char_zhong_ling"
    ]
  },
  {
    "chapter": 47,
    "title": "第四十七回",
    "key_events": [
      "段誉一行人遇险",
      "阿碧传来消息",
      "灵鹫宫部众相助",
      "段誉填画化解危机",
      "钟灵对段誉有眷恋"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_zhong_ling"
    ]
  },
  {
    "chapter": 48,
    "title": "第四十八回",
    "key_events": [
      "段誉回到大理",
      "与段正淳团聚",
      "段正淳感慨",
      "段誉被拥立为帝",
      "段誉与王语嫣成婚"
    ],
    "key_characters": [
      "char_duan_yu",
      "char_duan_zheng_chun",
      "char_wang_yu_yan"
    ]
  },
  {
    "chapter": 49,
    "title": "第四十九回",
    "key_events": [
      "萧峰被辽帝囚禁",
      "阿紫等人商议营救",
      "游坦之对阿紫痴情",
      "制定营救计划",
      "阿紫潜入辽营"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zi",
      "char_duan_yu",
      "char_xu_zhu",
      "char_you_tan_zhi"
    ]
  },
  {
    "chapter": 50,
    "title": "第五十回",
    "key_events": [
      "萧峰被救出",
      "萧峰自尽于雁门关",
      "阿紫殉情",
      "萧峰拒绝重掌丐帮",
      "天下群豪为萧峰送行"
    ],
    "key_characters": [
      "char_xiao_feng",
      "char_a_zi",
      "char_duan_yu",
      "char_xu_zhu"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
