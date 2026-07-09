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

### characters.json (50 条)
[
  {
    "id": "char_guo_jing",
    "name": "郭靖",
    "role": "核心",
    "identity": "丐帮帮主，一代大侠",
    "faction": "faction_gai_bang",
    "personality": [
      "憨厚朴实",
      "坚韧不拔",
      "重情重义"
    ],
    "one_line": "憨厚朴实，蒙古长大，后习降龙十八掌，成为一代大侠"
  },
  {
    "id": "char_huang_rong",
    "name": "黄蓉",
    "role": "核心",
    "identity": "丐帮帮主，黄药师之女",
    "faction": "faction_gai_bang",
    "personality": [
      "聪慧机敏",
      "伶牙俐齿",
      "古灵精怪"
    ],
    "one_line": "黄药师之女，聪慧机敏，丐帮帮主，郭靖挚爱"
  },
  {
    "id": "char_yang_kang",
    "name": "杨康",
    "role": "核心",
    "identity": "杨铁心之子，完颜洪烈养子",
    "faction": null,
    "personality": [
      "贪慕富贵",
      "虚荣狡诈",
      "优柔寡断"
    ],
    "one_line": "杨铁心之子，完颜洪烈养子，贪慕富贵，认贼作父"
  },
  {
    "id": "char_hong_qi_gong",
    "name": "洪七公",
    "role": "核心",
    "identity": "丐帮帮主，五绝之北丐",
    "faction": "faction_gai_bang",
    "personality": [
      "正义豪爽",
      "贪嘴好吃",
      "嫉恶如仇"
    ],
    "one_line": "北丐，丐帮帮主，降龙十八掌传人，正义豪爽"
  },
  {
    "id": "char_ou_yang_feng",
    "name": "欧阳锋",
    "role": "核心",
    "identity": "白驼山主，五绝之西毒",
    "faction": "faction_bai_tuo_shan",
    "personality": [
      "阴狠毒辣",
      "心机深沉",
      "极重然诺"
    ],
    "one_line": "西毒，白驼山主，蛤蟆功绝顶，阴狠毒辣的武学宗师"
  },
  {
    "id": "char_huang_yao_shi",
    "name": "黄药师",
    "role": "重要",
    "identity": "桃花岛主，五绝之东邪",
    "faction": "faction_tao_hua_dao",
    "personality": [
      "博学多才",
      "性情孤傲",
      "离经叛道"
    ],
    "one_line": "东邪，桃花岛主，博学多才，性情孤傲的武学奇人"
  },
  {
    "id": "char_zhou_bo_tong",
    "name": "周伯通",
    "role": "重要",
    "identity": "王重阳师弟，全真教前辈",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "天真烂漫",
      "童心未泯",
      "好武成痴"
    ],
    "one_line": "老顽童，王重阳师弟，天真烂漫，武功通神"
  },
  {
    "id": "char_qiu_chu_ji",
    "name": "丘处机",
    "role": "重要",
    "identity": "全真七子之长春子",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "嫉恶如仇",
      "性烈如火",
      "侠义心肠"
    ],
    "one_line": "全真七子之长春子，嫉恶如仇，武功高强"
  },
  {
    "id": "char_mei_chao_feng",
    "name": "梅超风",
    "role": "重要",
    "identity": "黑风双煞之铁尸",
    "faction": "faction_hei_feng_shuang_sha",
    "personality": [
      "阴狠毒辣",
      "对师门忠心",
      "性格刚烈"
    ],
    "one_line": "黑风双煞之铁尸，黄药师叛徒，九阴白骨爪阴毒"
  },
  {
    "id": "char_ke_zhen_e",
    "name": "柯镇恶",
    "role": "重要",
    "identity": "江南七怪之首",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "刚正不阿",
      "脾气乖戾",
      "嫉恶如仇"
    ],
    "one_line": "江南七怪之首，飞天蝙蝠，眼盲心明，刚正不阿"
  },
  {
    "id": "char_wan_yan_hong_lie",
    "name": "完颜洪烈",
    "role": "重要",
    "identity": "金国六王子赵王",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "阴险狡诈",
      "野心勃勃",
      "风度翩翩"
    ],
    "one_line": "金国六王子赵王，阴险狡诈，夺人妻子的野心家"
  },
  {
    "id": "char_tie_mu_zhen",
    "name": "铁木真",
    "role": "重要",
    "identity": "蒙古大汗，一代天骄",
    "faction": "faction_meng_gu_bu_zu",
    "personality": [
      "雄才大略",
      "知人善任",
      "赏罚分明"
    ],
    "one_line": "成吉思汗，蒙古大汗，雄才大略的一代天骄"
  },
  {
    "id": "char_mu_nian_ci",
    "name": "穆念慈",
    "role": "重要",
    "identity": "杨铁心义女",
    "faction": null,
    "personality": [
      "痴情坚贞",
      "外柔内刚",
      "善良温婉"
    ],
    "one_line": "杨铁心义女，比武招亲，痴恋杨康的悲情女子"
  },
  {
    "id": "char_ou_yang_ke",
    "name": "欧阳克",
    "role": "重要",
    "identity": "白驼山少主，欧阳锋之侄",
    "faction": "faction_bai_tuo_shan",
    "personality": [
      "好色轻浮",
      "风流自赏",
      "武功不凡"
    ],
    "one_line": "欧阳锋之侄，好色轻浮，白驼山少主"
  },
  {
    "id": "char_bao_xi_ru",
    "name": "包惜弱",
    "role": "重要",
    "identity": "杨铁心之妻，杨康之母",
    "faction": null,
    "personality": [
      "心软善良",
      "优柔寡断",
      "温柔贤淑"
    ],
    "one_line": "杨铁心之妻，杨康之母，心软善良的柔弱女子"
  },
  {
    "id": "char_li_ping",
    "name": "李萍",
    "role": "重要",
    "identity": "郭啸天之妻，郭靖之母",
    "faction": null,
    "personality": [
      "坚韧刚强",
      "吃苦耐劳",
      "深明大义"
    ],
    "one_line": "郭靖之母，坚韧刚强，在蒙古抚养郭靖长大"
  },
  {
    "id": "char_zhu_cong",
    "name": "朱聪",
    "role": "次要",
    "identity": "江南七怪之二",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "机智聪敏",
      "诙谐幽默",
      "博学多才"
    ],
    "one_line": "江南七怪之二，妙手书生，机智聪敏善偷技"
  },
  {
    "id": "char_han_bao_jv",
    "name": "韩宝驹",
    "role": "次要",
    "identity": "江南七怪之三",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "性急如火",
      "直爽豪迈",
      "善骑马"
    ],
    "one_line": "江南七怪之三，马王神，擅使金龙鞭"
  },
  {
    "id": "char_nan_xi_ren",
    "name": "南希仁",
    "role": "次要",
    "identity": "江南七怪之四",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "沉默寡言",
      "忠厚朴实",
      "力大无穷"
    ],
    "one_line": "江南七怪之四，南山樵子，沉默寡言"
  },
  {
    "id": "char_zhang_a_sheng",
    "name": "张阿生",
    "role": "次要",
    "identity": "江南七怪之五",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "力大身粗",
      "憨厚老实",
      "笑口常开"
    ],
    "one_line": "江南七怪之五，笑弥陀，力大身粗"
  },
  {
    "id": "char_quan_jin_fa",
    "name": "全金发",
    "role": "次要",
    "identity": "江南七怪之六",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "精于计算",
      "能言善辩",
      "机智灵活"
    ],
    "one_line": "江南七怪之六，闹市侠隐，善使秤锤"
  },
  {
    "id": "char_han_xiao_ying",
    "name": "韩小莹",
    "role": "次要",
    "identity": "江南七怪之七",
    "faction": "faction_jiang_nan_qi_guai",
    "personality": [
      "容貌秀丽",
      "性格刚烈",
      "侠义心肠"
    ],
    "one_line": "江南七怪之七，越女剑，七怪中唯一女子"
  },
  {
    "id": "char_ma_yu",
    "name": "马钰",
    "role": "次要",
    "identity": "全真七子之首，全真掌教",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "性格沉稳",
      "忠厚老实",
      "深藏不露"
    ],
    "one_line": "全真七子之丹阳子，全真掌教，性格沉稳"
  },
  {
    "id": "char_wang_chu_yi",
    "name": "王处一",
    "role": "次要",
    "identity": "全真七子之玉阳子",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "侠义心肠",
      "嫉恶如仇",
      "武功高强"
    ],
    "one_line": "全真七子之玉阳子，铁脚仙，侠义心肠"
  },
  {
    "id": "char_qiu_qian_ren",
    "name": "裘千仞",
    "role": "次要",
    "identity": "铁掌帮帮主",
    "faction": "faction_tie_zhang_bang",
    "personality": [
      "心狠手辣",
      "野心勃勃",
      "武功高强"
    ],
    "one_line": "铁掌帮帮主，铁掌水上飘，武功仅次五绝"
  },
  {
    "id": "char_peng_lian_hu",
    "name": "彭连虎",
    "role": "次要",
    "identity": "金国高手，擅暗器",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "心狠手辣",
      "老谋深算",
      "善于暗器"
    ],
    "one_line": "千手人屠，金国高手，擅长暗器"
  },
  {
    "id": "char_liang_zi_weng",
    "name": "梁子翁",
    "role": "次要",
    "identity": "长白山高手，擅用毒蛇",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "阴险狡诈",
      "贪得无厌",
      "善用毒蛇"
    ],
    "one_line": "参仙老怪，长白山高手，擅用毒蛇"
  },
  {
    "id": "char_yang_tie_xin",
    "name": "杨铁心",
    "role": "次要",
    "identity": "杨康生父，忠良之后",
    "faction": null,
    "personality": [
      "忠义刚烈",
      "重情重义",
      "嫉恶如仇"
    ],
    "one_line": "杨康之父，忠良之后，与郭啸天结义"
  },
  {
    "id": "char_guo_xiao_tian",
    "name": "郭啸天",
    "role": "次要",
    "identity": "郭靖之父，忠义之士",
    "faction": null,
    "personality": [
      "忠义豪迈",
      "嫉恶如仇",
      "重情重义"
    ],
    "one_line": "郭靖之父，忠义之士，牛家村遇难身亡"
  },
  {
    "id": "char_duan_tian_de",
    "name": "段天德",
    "role": "龙套",
    "identity": "杀害郭啸天的军官",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "卑鄙无耻",
      "贪生怕死",
      "欺软怕硬"
    ],
    "one_line": "杀害郭啸天的军官，后被杨铁心杀死"
  },
  {
    "id": "char_qu_ling_feng",
    "name": "曲灵风",
    "role": "龙套",
    "identity": "黄药师大弟子",
    "faction": "faction_tao_hua_dao",
    "personality": [
      "武功高强",
      "忠于师门",
      "隐忍深沉"
    ],
    "one_line": "黄药师大弟子，因师门祸事流落江湖"
  },
  {
    "id": "char_zhang_shi_wu",
    "name": "张十五",
    "role": "龙套",
    "identity": "牛家村说书人",
    "faction": null,
    "personality": [
      "口才便给",
      "忧国忧民",
      "见多识广"
    ],
    "one_line": "牛家村说书人，引出靖康之耻时代背景"
  },
  {
    "id": "char_jiao_mu",
    "name": "焦木大师",
    "role": "龙套",
    "identity": "法华寺住持",
    "faction": null,
    "personality": [
      "慈悲为怀",
      "忠厚老实",
      "固执己见"
    ],
    "one_line": "法华寺住持，丘处机好友，因误会身亡"
  },
  {
    "id": "char_sha_tong_tian",
    "name": "沙通天",
    "role": "龙套",
    "identity": "黄河帮高手",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "凶悍霸道",
      "脾气暴躁",
      "护短记仇"
    ],
    "one_line": "鬼门龙王，黄河帮高手，金国爪牙"
  },
  {
    "id": "char_hou_tong_hai",
    "name": "侯通海",
    "role": "龙套",
    "identity": "沙通天师弟",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "愚蠢鲁莽",
      "欺软怕硬",
      "贪生怕死"
    ],
    "one_line": "三头蛟，沙通天师弟，武功平庸"
  },
  {
    "id": "char_ling_zhi_shang_ren",
    "name": "灵智上人",
    "role": "龙套",
    "identity": "西藏密宗高手",
    "faction": "faction_jin_guo_wang_fu",
    "personality": [
      "武功诡异",
      "心机深沉",
      "贪图富贵"
    ],
    "one_line": "西藏密宗高手，金国座上宾"
  },
  {
    "id": "char_ying_gu",
    "name": "瑛姑",
    "role": "龙套",
    "identity": "周伯通旧情人",
    "faction": null,
    "personality": [
      "痴情执着",
      "记仇至深",
      "孤僻古怪"
    ],
    "one_line": "与周伯通有私情，隐居大理，容颜憔悴"
  },
  {
    "id": "char_chen_xuan_feng",
    "name": "陈玄风",
    "role": "龙套",
    "identity": "黑风双煞之铜尸",
    "faction": "faction_hei_feng_shuang_sha",
    "personality": [
      "阴狠毒辣",
      "武功高强",
      "叛师盗经"
    ],
    "one_line": "黑风双煞之铜尸，梅超风师兄，盗经叛逃"
  },
  {
    "id": "char_tan_chu_duan",
    "name": "谭处端",
    "role": "龙套",
    "identity": "全真七子之一",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "道行高深",
      "性格温和",
      "忠于教门"
    ],
    "one_line": "全真七子之一，长真子"
  },
  {
    "id": "char_liu_chu_xuan",
    "name": "刘处玄",
    "role": "龙套",
    "identity": "全真七子之一",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "道行高深",
      "性格沉静",
      "忠于教门"
    ],
    "one_line": "全真七子之一，长生真人"
  },
  {
    "id": "char_hao_da_tong",
    "name": "郝大通",
    "role": "龙套",
    "identity": "全真七子之一",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "道行高深",
      "性格随和",
      "忠于教门"
    ],
    "one_line": "全真七子之一，广宁真人"
  },
  {
    "id": "char_sun_bu_er",
    "name": "孙不二",
    "role": "龙套",
    "identity": "全真七子之一",
    "faction": "faction_quan_zhen_jiao",
    "personality": [
      "道行高深",
      "性格清冷",
      "忠于教门"
    ],
    "one_line": "全真七子之一，清静散人，马钰之妻"
  },
  {
    "id": "char_lu_you_jiao",
    "name": "鲁有脚",
    "role": "龙套",
    "identity": "丐帮长老",
    "faction": "faction_gai_bang",
    "personality": [
      "忠厚老实",
      "侠义心肠",
      "武功扎实"
    ],
    "one_line": "丐帮长老，后接任帮主，为人忠厚老实"
  },
  {
    "id": "char_gao_zong_huang_di",
    "name": "高宗皇帝",
    "role": "背景",
    "identity": "南宋开国皇帝",
    "faction": "faction_nan_song_chao_ting",
    "personality": [
      "懦弱无能",
      "偏安苟且",
      "猜忌功臣"
    ],
    "one_line": "南宋开国皇帝，偏安江南，害死岳飞"
  },
  {
    "id": "char_qin_hui",
    "name": "秦桧",
    "role": "背景",
    "identity": "南宋奸臣",
    "faction": "faction_nan_song_chao_ting",
    "personality": [
      "奸诈狡猾",
      "贪权误国",
      "谄媚逢迎"
    ],
    "one_line": "南宋奸臣，害死岳飞，遗臭万年"
  },
  {
    "id": "char_yue_fei",
    "name": "岳飞",
    "role": "背景",
    "identity": "南宋抗金名将",
    "faction": "faction_nan_song_chao_ting",
    "personality": [
      "精忠报国",
      "文武全才",
      "正气凛然"
    ],
    "one_line": "南宋抗金名将，精忠报国，被秦桧害死风波亭"
  },
  {
    "id": "char_hua_zheng",
    "name": "华筝",
    "role": "次要",
    "identity": "铁木真之女，蒙古公主",
    "faction": "faction_meng_gu_bu_zu",
    "personality": [
      "天真烂漫",
      "直率豪爽",
      "深情执着"
    ],
    "one_line": "铁木真之女，自幼倾心郭靖，后许配郭靖为妻"
  },
  {
    "id": "char_yi_deng",
    "name": "一灯大师",
    "role": "重要",
    "identity": "大理国主，出家为僧",
    "faction": "faction_da_li_duan_shi",
    "personality": [
      "慈悲为怀",
      "武功盖世",
      "看破红尘"
    ],
    "one_line": "大理段氏末代皇帝，出家为僧，武功登峰造极"
  },
  {
    "id": "char_tuo_lei",
    "name": "拖雷",
    "role": "次要",
    "identity": "铁木真之子，郭靖安答",
    "faction": "faction_meng_gu_bu_zu",
    "personality": [
      "英勇善战",
      "重情重义",
      "直率豪爽"
    ],
    "one_line": "铁木真幼子，郭靖安答，手足情深"
  },
  {
    "id": "char_qiu_qian_zhang",
    "name": "裘千丈",
    "role": "龙套",
    "identity": "裘千仞孪生兄长，江湖骗子",
    "faction": null,
    "personality": [
      "招摇撞骗",
      "胆小怕死",
      "善于伪装"
    ],
    "one_line": "裘千仞孪生兄长，冒充弟弟名号招摇撞骗"
  }
]

### factions.json (12 条)
[
  {
    "id": "faction_gai_bang",
    "name": "丐帮",
    "type": "帮派",
    "location": "loc_yue_zhou",
    "one_line": "天下第一大帮，帮主洪七公，降龙打狗名震江湖"
  },
  {
    "id": "faction_quan_zhen_jiao",
    "name": "全真教",
    "type": "武林门派",
    "location": "loc_zhong_nan_shan",
    "one_line": "王重阳创派，终南山立教，全真七子名满天下"
  },
  {
    "id": "faction_tao_hua_dao",
    "name": "桃花岛",
    "type": "武林门派",
    "location": "loc_tao_hua_dao",
    "one_line": "东邪黄药师所居东海孤岛，奇门遁甲精妙绝伦"
  },
  {
    "id": "faction_bai_tuo_shan",
    "name": "白驼山",
    "type": "武林门派",
    "location": "loc_bai_tuo_shan",
    "one_line": "西毒欧阳锋所据西域山门，蛤蟆功威震武林"
  },
  {
    "id": "faction_tie_zhang_bang",
    "name": "铁掌帮",
    "type": "帮派",
    "location": "loc_tie_zhang_shan",
    "one_line": "裘千仞统领，铁掌帮称雄湘西，水上飘轻功绝顶"
  },
  {
    "id": "faction_jiang_nan_qi_guai",
    "name": "江南七怪",
    "type": "组合",
    "location": "loc_jia_xing",
    "one_line": "嘉兴七侠组合，义薄云天，郭靖启蒙恩师"
  },
  {
    "id": "faction_hei_feng_shuang_sha",
    "name": "黑风双煞",
    "type": "组合",
    "location": null,
    "one_line": "陈玄风梅超风夫妇，盗取九阴真经叛出桃花岛"
  },
  {
    "id": "faction_jin_guo_wang_fu",
    "name": "金国王府",
    "type": "王族",
    "location": "loc_zhong_du",
    "one_line": "完颜洪烈赵王府，招揽高手，南宋大敌"
  },
  {
    "id": "faction_meng_gu_bu_zu",
    "name": "蒙古部族",
    "type": "部族",
    "location": "loc_da_mo",
    "one_line": "铁木真统一草原，郭靖成长之地，后成天下霸主"
  },
  {
    "id": "faction_da_li_duan_shi",
    "name": "大理段氏",
    "type": "王族",
    "location": "loc_da_li",
    "one_line": "西南段氏皇族，一灯大师故国，一阳指传承"
  },
  {
    "id": "faction_nan_song_chao_ting",
    "name": "南宋朝廷",
    "type": "官署",
    "location": "loc_lin_an",
    "one_line": "偏安江南的汉人朝廷，临安为都，积弱不振"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "武林门派",
    "location": "loc_shao_lin_si",
    "one_line": "武林泰斗少林寺，天下武功出少林"
  }
]

### locations.json (21 条)
[
  {
    "id": "loc_niu_jia_cun",
    "name": "牛家村",
    "region": "江南",
    "one_line": "故事起点，郭杨两家故居，丘处机雪夜路过之地"
  },
  {
    "id": "loc_jia_xing",
    "name": "嘉兴",
    "region": "江南",
    "one_line": "江南名城，醉仙楼烟雨楼，七怪故乡"
  },
  {
    "id": "loc_da_mo",
    "name": "大漠",
    "region": "蒙古",
    "one_line": "蒙古草原，郭靖幼年成长之地，铁木真王庭所在"
  },
  {
    "id": "loc_tao_hua_dao",
    "name": "桃花岛",
    "region": "东海",
    "one_line": "东海孤岛，黄药师隐居之所，奇花异石遍布"
  },
  {
    "id": "loc_yue_zhou",
    "name": "岳州",
    "region": "中原",
    "one_line": "丐帮大会召开之地，洞庭湖畔"
  },
  {
    "id": "loc_lin_an",
    "name": "临安",
    "region": "南宋",
    "one_line": "南宋都城，岳飞风波亭所在，朝廷中枢"
  },
  {
    "id": "loc_zhong_du",
    "name": "中都",
    "region": "金国",
    "one_line": "金国都城燕京，完颜洪烈赵王府所在地"
  },
  {
    "id": "loc_tie_zhang_shan",
    "name": "铁掌山",
    "region": "中原",
    "one_line": "铁掌帮总坛，裘千仞盘踞之地"
  },
  {
    "id": "loc_da_li",
    "name": "大理",
    "region": "西南",
    "one_line": "段氏皇城，一灯大师隐居之地"
  },
  {
    "id": "loc_zhong_nan_shan",
    "name": "终南山",
    "region": "中原",
    "one_line": "全真教总坛所在，重阳宫巍峨壮观"
  },
  {
    "id": "loc_meng_gu_cao_yuan",
    "name": "蒙古草原",
    "region": "蒙古",
    "one_line": "铁木真统一各部之地，郭靖射雕成长"
  },
  {
    "id": "loc_zhang_jia_kou",
    "name": "张家口",
    "region": "北方",
    "one_line": "北方重镇，郭靖初入中原遇黄蓉之地"
  },
  {
    "id": "loc_gui_yun_zhuang",
    "name": "归云庄",
    "region": "中原",
    "one_line": "太湖水寨，陆乘风父子聚义之处"
  },
  {
    "id": "loc_zhao_wang_fu",
    "name": "赵王府",
    "region": "金国",
    "one_line": "完颜洪烈府邸，金国高手云集之处"
  },
  {
    "id": "loc_yan_yu_lou",
    "name": "烟雨楼",
    "region": "江南",
    "one_line": "嘉兴名楼，郭靖杨康十八年之约"
  },
  {
    "id": "loc_zui_xian_lou",
    "name": "醉仙楼",
    "region": "江南",
    "one_line": "嘉兴酒楼，丘处机与七怪初次交锋"
  },
  {
    "id": "loc_bai_tuo_shan",
    "name": "白驼山",
    "region": "西域",
    "one_line": "欧阳锋山门所在，西域蛇窟"
  },
  {
    "id": "loc_fa_hua_si",
    "name": "法华寺",
    "region": "江南",
    "one_line": "焦木大师住持，丘处机与七怪误会之地"
  },
  {
    "id": "loc_qu_jia_cun",
    "name": "曲家村",
    "region": "江南",
    "one_line": "曲灵风隐居之地，郭靖学艺之处"
  },
  {
    "id": "loc_yan_men_guan",
    "name": "雁门关",
    "region": "北方",
    "one_line": "宋金边界雄关，郭靖守城之地"
  },
  {
    "id": "loc_hua_shan",
    "name": "华山",
    "region": "中原",
    "one_line": "五绝论剑之地，华山之巅决定天下第一"
  }
]

### skills.json (24 条)
[
  {
    "id": "skill_xiang_long_shi_ba_zhang",
    "name": "降龙十八掌",
    "type": "掌法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "丐帮镇帮绝学，刚猛无俦，洪七公传郭靖"
  },
  {
    "id": "skill_da_gou_bang_fa",
    "name": "打狗棒法",
    "type": "棒法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "丐帮帮主秘传，灵动精妙，洪七公传黄蓉"
  },
  {
    "id": "skill_ha_ma_gong",
    "name": "蛤蟆功",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "欧阳锋独门绝技，蓄力反击，天下至刚"
  },
  {
    "id": "skill_tan_zhi_shen_tong",
    "name": "弹指神通",
    "type": "指法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师绝技，以指弹石，远程克敌"
  },
  {
    "id": "skill_bi_hai_chao_sheng_qu",
    "name": "碧海潮生曲",
    "type": "音攻",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师以箫声克敌，音律中暗藏内力"
  },
  {
    "id": "skill_jiu_yin_zhen_jing",
    "name": "九阴真经",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "黄裳所著武学总纲，天下武功莫不出其右"
  },
  {
    "id": "skill_kong_ming_quan",
    "name": "空明拳",
    "type": "拳法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "周伯通所创，以虚击实，七十二路变化"
  },
  {
    "id": "skill_shuang_shou_hu_bo",
    "name": "双手互搏",
    "type": "奇门",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "周伯通独创，左右手分使不同武功"
  },
  {
    "id": "skill_yi_yang_zhi",
    "name": "一阳指",
    "type": "指法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "大理段氏绝学，以气御指，克制蛤蟆功"
  },
  {
    "id": "skill_xian_tian_gong",
    "name": "先天功",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "王重阳绝学，纯阳内力，天下至正"
  },
  {
    "id": "skill_tie_sha_zhang",
    "name": "铁砂掌",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "裘千仞绝技，掌力雄浑，铁掌水上飘"
  },
  {
    "id": "skill_pi_kong_zhang",
    "name": "劈空掌",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师掌法，隔空发掌，凌厉霸道"
  },
  {
    "id": "skill_luo_ying_shen_jian_zhang",
    "name": "落英神剑掌",
    "type": "掌法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师掌法，如落英缤纷，变化莫测"
  },
  {
    "id": "skill_yu_xiao_jian_fa",
    "name": "玉箫剑法",
    "type": "剑法",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师剑法，以箫代剑，飘逸灵动"
  },
  {
    "id": "skill_lan_hua_fu_xue_shou",
    "name": "兰花拂穴手",
    "type": "点穴",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "黄药师指法，兰花般优雅点穴制敌"
  },
  {
    "id": "skill_xiao_yao_you",
    "name": "逍遥游",
    "type": "轻功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "洪七公轻功，身法飘逸，来去无踪"
  },
  {
    "id": "skill_fu_mo_zhang_fa",
    "name": "伏魔杖法",
    "type": "杖法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "柯镇恶杖法，刚猛霸道，伏魔降妖"
  },
  {
    "id": "skill_quan_zhen_jian_fa",
    "name": "全真剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "全真教剑法，中正平和，全真七子所擅"
  },
  {
    "id": "skill_jin_yan_gong",
    "name": "金雁功",
    "type": "轻功",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "全真教轻功，纵跃如雁，轻灵迅捷"
  },
  {
    "id": "skill_tian_gang_bei_dou_zhen",
    "name": "天罡北斗阵",
    "type": "阵法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "全真七子合力阵法，七人如一人"
  },
  {
    "id": "skill_jiu_yin_bai_gu_zhua",
    "name": "九阴白骨爪",
    "type": "指法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "梅超风所练阴毒爪法，以头骨练功"
  },
  {
    "id": "skill_cui_xin_zhang",
    "name": "摧心掌",
    "type": "掌法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "黑风双煞阴毒掌法，伤人脏腑"
  },
  {
    "id": "skill_yue_nv_jian_fa",
    "name": "越女剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "韩小莹所使剑法，轻灵飘逸"
  },
  {
    "id": "skill_fen_jin_cuo_gu_shou",
    "name": "分筋错骨手",
    "type": "点穴",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "黄药师擒拿手法，错人筋骨关节"
  }
]

### techniques.json (0 条)
[]

### items.json (18 条)
[
  {
    "id": "item_da_gou_bang",
    "name": "打狗棒",
    "type": "兵器",
    "owner": "char_huang_rong",
    "rarity_tier": "神品",
    "related_skills": [
      "skill_da_gou_bang_fa"
    ],
    "one_line": "丐帮帮主世代相传的碧绿竹杖，棒法精妙"
  },
  {
    "id": "item_she_zhang",
    "name": "蛇杖",
    "type": "兵器",
    "owner": "char_ou_yang_feng",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "欧阳锋的弯形铁杖，杖头铸有人头怪蛇"
  },
  {
    "id": "item_jiu_yin_zhen_jing_shang",
    "name": "九阴真经（上卷）",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_jiu_yin_zhen_jing"
    ],
    "one_line": "道家至高武学典籍上卷，载内功心法总旨"
  },
  {
    "id": "item_jiu_yin_zhen_jing_xia",
    "name": "九阴真经（下卷）",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_jiu_yin_zhen_jing"
    ],
    "one_line": "九阴真经下卷，载诸般武功招式及破解之法"
  },
  {
    "id": "item_wu_mu_yi_shu",
    "name": "武穆遗书",
    "type": "秘籍",
    "owner": "char_guo_jing",
    "rarity_tier": "神品",
    "related_skills": [],
    "one_line": "岳飞所遗兵法韬略，铁掌帮中藏于铁掌峰"
  },
  {
    "id": "item_xiao_hong_ma",
    "name": "小红马",
    "type": "坐骑",
    "owner": "char_guo_jing",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "郭靖的汗血宝马，日行千里，神骏非凡"
  },
  {
    "id": "item_shuang_diao",
    "name": "双雕",
    "type": "异兽",
    "owner": "char_hua_zheng",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "华筝所养的两只大雕，曾救郭靖性命"
  },
  {
    "id": "item_ruan_wei_jia",
    "name": "软猬甲",
    "type": "防具",
    "owner": "char_huang_rong",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "桃花岛镇岛之宝，刀枪不入的刺猬软甲"
  },
  {
    "id": "item_bi_shou",
    "name": "匕首",
    "type": "兵器",
    "owner": "char_guo_jing",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "郭靖随身携带的短匕，幼年救命之物"
  },
  {
    "id": "item_tong_xi_di_long_wan",
    "name": "通犀地龙丸",
    "type": "丹药",
    "owner": "char_ou_yang_feng",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "欧阳锋的避毒圣药，服之百毒不侵"
  },
  {
    "id": "item_she_xue",
    "name": "朱红蟒蛇药血",
    "type": "丹药",
    "owner": "char_guo_jing",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "梁子翁养的药蟒之血，郭靖误饮后百毒不侵"
  },
  {
    "id": "item_fei_cui_xiao_xie",
    "name": "翡翠小鞋",
    "type": "饰品",
    "owner": "char_ying_gu",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "瑛姑珍藏的翡翠小鞋，承载与周伯通旧情"
  },
  {
    "id": "item_suan_chou",
    "name": "算筹",
    "type": "奇门",
    "owner": "char_ying_gu",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "瑛姑精通术数的算筹，暗藏奇门变化"
  },
  {
    "id": "item_fu_she",
    "name": "蝮蛇",
    "type": "异兽",
    "owner": "char_ou_yang_feng",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "欧阳锋蛇杖中驯养的剧毒怪蛇"
  },
  {
    "id": "item_zhe_shan",
    "name": "折扇",
    "type": "兵器",
    "owner": "char_ou_yang_ke",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "欧阳克随身折扇，潇洒风流的标志"
  },
  {
    "id": "item_jin_long_bian",
    "name": "金龙鞭",
    "type": "兵器",
    "owner": "char_han_bao_jv",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "韩宝驹的金龙鞭，马上功夫的利器"
  },
  {
    "id": "item_tie_jiang",
    "name": "铁桨",
    "type": "兵器",
    "owner": "char_mei_chao_feng",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "梅超风的铁桨，配合九阴白骨爪使用"
  },
  {
    "id": "item_xiu_hua_xie",
    "name": "绣花鞋",
    "type": "信物",
    "owner": "char_huang_rong",
    "rarity_tier": "凡品",
    "related_skills": [],
    "one_line": "黄蓉的绣花鞋，郭靖追寻她的线索"
  }
]

### dialogues.json (前 50 条 / 共 192 条)
[
  {
    "index": 0,
    "speaker": "char_zhang_shi_wu",
    "speaker_name": "张十五",
    "listener": null,
    "text": "这首七言诗，说的是兵火过后，原来的家家户户，都变成了断墙残瓦的破败之地。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 6,
    "line_end": 12
  },
  {
    "index": 1,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": "char_zhang_shi_wu",
    "text": "张先生，你可是从北方来吗？",
    "tone": "疑问",
    "chapter": 1,
    "line_start": 32,
    "line_end": 32
  },
  {
    "index": 2,
    "speaker": "char_zhang_shi_wu",
    "speaker_name": "张十五",
    "listener": "char_guo_xiao_tian",
    "text": "我中国百姓，比女真人多上一百倍也还不止。只要朝廷肯用忠臣良将，咱们一百个打他一个，金兵如何能够抵挡？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 44,
    "line_end": 44
  },
  {
    "index": 3,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": null,
    "text": "正是！",
    "tone": "激动",
    "chapter": 1,
    "line_start": 46,
    "line_end": 46
  },
  {
    "index": 4,
    "speaker": "char_zhang_shi_wu",
    "speaker_name": "张十五",
    "listener": "char_guo_xiao_tian",
    "text": "岳爷爷有两句诗道：'壮志饥餐胡虏肉，笑谈渴饮匈奴血。'这两句诗当真说出了中国全国百姓的心里话。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 52,
    "line_end": 52
  },
  {
    "index": 5,
    "speaker": "char_qu_ling_feng",
    "speaker_name": "曲三",
    "listener": "char_yang_tie_xin",
    "text": "骂得好，骂得对，有什么不对？不过我曾听得人说，想要杀岳爷爷议和的，罪魁祸首却不是秦桧。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 56,
    "line_end": 56
  },
  {
    "index": 6,
    "speaker": "char_qu_ling_feng",
    "speaker_name": "曲三",
    "listener": null,
    "text": "秦桧做的是宰相，议和也好，不议和也好，他都做他的宰相。可是岳爷爷一心一意要灭了金国，迎接徽钦二帝回来。这两个皇帝一回来，高宗皇帝他又做什么呀？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 56,
    "line_end": 56
  },
  {
    "index": 7,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": null,
    "text": "不要脸，不要脸！这鸟皇帝算是那一门子的皇帝！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 66,
    "line_end": 66
  },
  {
    "index": 8,
    "speaker": "char_qu_ling_feng",
    "speaker_name": "曲三",
    "listener": "char_guo_xiao_tian",
    "text": "郭兄，就算你有双戟在手，你们两位合力，斗得过我吗？",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 100,
    "line_end": 100
  },
  {
    "index": 9,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": "char_qu_ling_feng",
    "text": "斗不过！我兄弟俩有眼无珠，跟你老兄在牛家村同住了一年有余，全没瞧出你老兄是位身怀绝技的高手。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 100,
    "line_end": 100
  },
  {
    "index": 10,
    "speaker": "char_qu_ling_feng",
    "speaker_name": "曲三",
    "listener": null,
    "text": "资质寻常的，当然是这样，可是天下尽有聪明绝顶之人，文才武功，琴棋书画，算数韬略，以至医卜星相，奇门五行，无一不会，无一不精！只不过你们见不着罢了。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 124,
    "line_end": 124
  },
  {
    "index": 11,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": "char_yang_tie_xin",
    "text": "叫我留步，是何居心？爽爽快快说出来罢！",
    "tone": "冷酷",
    "chapter": 1,
    "line_start": 148,
    "line_end": 148
  },
  {
    "index": 12,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "好好好，喝酒就喝酒！",
    "tone": "激动",
    "chapter": 1,
    "line_start": 152,
    "line_end": 152
  },
  {
    "index": 13,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "无耻鼠辈，道爷今日大开杀戒了！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 170,
    "line_end": 170
  },
  {
    "index": 14,
    "speaker": "char_yang_tie_xin",
    "speaker_name": "杨铁心",
    "listener": "char_qiu_chu_ji",
    "text": "来来来，教你知道杨家枪法的厉害。",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 172,
    "line_end": 172
  },
  {
    "index": 15,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": "char_yang_tie_xin",
    "text": "凭你这公门鼠辈，也配使杨家枪！",
    "tone": "嘲讽",
    "chapter": 1,
    "line_start": 174,
    "line_end": 174
  },
  {
    "index": 16,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "贫道姓丘名处机⋯⋯",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 17,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": null,
    "text": "遮莫不是长春子么？",
    "tone": "激动",
    "chapter": 1,
    "line_start": 196,
    "line_end": 196
  },
  {
    "index": 18,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "出家人本来不可滥杀，可是一见了害民奸贼、敌国仇寇，贫道便不能手下留情。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 230,
    "line_end": 230
  },
  {
    "index": 19,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "这对短剑是我无意之中得来的，虽然锋锐，但剑刃短了，贫道不合使，将来孩子们倒可用来杀敌防身。",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 246,
    "line_end": 246
  },
  {
    "index": 20,
    "speaker": "char_yang_tie_xin",
    "speaker_name": "杨铁心",
    "listener": "char_guo_xiao_tian",
    "text": "要是咱们的孩子都是男儿，那么让他们结为兄弟，倘若都是女儿，就结为姊妹⋯⋯",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 250,
    "line_end": 250
  },
  {
    "index": 21,
    "speaker": "char_guo_xiao_tian",
    "speaker_name": "郭啸天",
    "listener": "char_yang_tie_xin",
    "text": "若是一男一女，那就结为夫妻。",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 250,
    "line_end": 250
  },
  {
    "index": 22,
    "speaker": "char_han_xiao_ying",
    "speaker_name": "韩小莹",
    "listener": "char_qiu_chu_ji",
    "text": "丘道长能干英明，天下皆知，我们七兄弟也不是初走江湖之人，这次大家竟胡里胡涂的栽在这无名之辈手里，流传出去，定教江湖上好汉耻笑。这事如何善后，还得请道长示下。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 888,
    "line_end": 888
  },
  {
    "index": 23,
    "speaker": "char_ke_zhen_e",
    "speaker_name": "柯镇恶",
    "listener": "char_qiu_chu_ji",
    "text": "丘道长仗剑横行天下，怎把别人瞧在眼里？这事又何必再问我们兄弟？",
    "tone": "嘲讽",
    "chapter": 3,
    "line_start": 892,
    "line_end": 892
  },
  {
    "index": 24,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": "char_ke_zhen_e",
    "text": "贫道无状，行事胡涂，得罪了各位，确是贫道的不是，这里向各位谢过，尚请原宥！",
    "tone": "恳求",
    "chapter": 3,
    "line_start": 894,
    "line_end": 894
  },
  {
    "index": 25,
    "speaker": "char_ke_zhen_e",
    "speaker_name": "柯镇恶",
    "listener": "char_qiu_chu_ji",
    "text": "江湖上的事，我兄弟再也没面目理会啦。我们在这里打鱼的打鱼，砍柴的砍柴，只要道长放我们一马，不再前来寻事，我们总可安安稳稳的过这下半辈子。",
    "tone": "嘲讽",
    "chapter": 3,
    "line_start": 896,
    "line_end": 896
  },
  {
    "index": 26,
    "speaker": "char_ke_zhen_e",
    "speaker_name": "柯镇恶",
    "listener": "char_qiu_chu_ji",
    "text": "你把我们兄弟个个打得重伤，单凭这么一句话，就算了事么？",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 900,
    "line_end": 900
  },
  {
    "index": 27,
    "speaker": "char_ke_zhen_e",
    "speaker_name": "柯镇恶",
    "listener": "char_qiu_chu_ji",
    "text": "这口气我们咽不下去，还求道长再予赐教。",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 902,
    "line_end": 902
  },
  {
    "index": 28,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "各位既要与贫道再决胜负，也无不可，但办法却要由贫道规定。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 910,
    "line_end": 910
  },
  {
    "index": 29,
    "speaker": "char_han_bao_jv",
    "speaker_name": "韩宝驹",
    "listener": null,
    "text": "怎样？",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 934,
    "line_end": 934
  },
  {
    "index": 30,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "过得一十八年，孩子们都十八岁了，咱们再在嘉兴府醉仙楼头相会，大邀江湖上的英雄好汉，欢宴一场。酒醉饭饱之余，让两个孩子比试武艺，瞧是贫道的徒弟高明呢，还是七侠的徒弟了得？",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 934,
    "line_end": 934
  },
  {
    "index": 31,
    "speaker": "char_ke_zhen_e",
    "speaker_name": "柯镇恶",
    "listener": null,
    "text": "好，咱们赌了。",
    "tone": "激动",
    "chapter": 3,
    "line_start": 938,
    "line_end": 938
  },
  {
    "index": 32,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "古来大英雄真侠士，跟人结交是为朋友卖命，所谓'不爱其躯，赴士之厄困'，只要是义所当为，就是把性命交给了他，又算得什么？",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 948,
    "line_end": 948
  },
  {
    "index": 33,
    "speaker": "char_zhu_cong",
    "speaker_name": "朱聪",
    "listener": "char_qiu_chu_ji",
    "text": "道长指点得不错，兄弟知罪了。我们七怪担当这件事就是。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 948,
    "line_end": 948
  },
  {
    "index": 34,
    "speaker": "char_qiu_chu_ji",
    "speaker_name": "丘处机",
    "listener": null,
    "text": "今日是三月廿四，十八年后的今日正午，大伙儿在醉仙楼相会，让普天下英雄见见，谁是真正的好汉子！",
    "tone": "激动",
    "chapter": 3,
    "line_start": 950,
    "line_end": 950
  },
  {
    "index": 35,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "敌兵还没有疲！",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 1028,
    "line_end": 1028
  },
  {
    "index": 36,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "好箭法！",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 1034,
    "line_end": 1034
  },
  {
    "index": 37,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "好兄弟，真有你的！",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 1038,
    "line_end": 1038
  },
  {
    "index": 38,
    "speaker": null,
    "speaker_name": "忽都虎",
    "listener": "char_tie_mu_zhen",
    "text": "可以举纛吹号了么？",
    "tone": "焦急",
    "chapter": 5,
    "line_start": 1040,
    "line_end": 1040
  },
  {
    "index": 39,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "敌军还没疲，再支持一会。",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 1040,
    "line_end": 1040
  },
  {
    "index": 40,
    "speaker": null,
    "speaker_name": "哲别",
    "listener": null,
    "text": "水，水⋯⋯给我水？",
    "tone": "焦急",
    "chapter": 5,
    "line_start": 1062,
    "line_end": 1062
  },
  {
    "index": 41,
    "speaker": null,
    "speaker_name": "哲别",
    "listener": "char_guo_jing",
    "text": "好兄弟，多谢你！",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 1068,
    "line_end": 1068
  },
  {
    "index": 42,
    "speaker": "char_guo_jing",
    "speaker_name": "郭靖",
    "listener": null,
    "text": "妈妈说的，应当接待客人，不可要客人东西。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 1068,
    "line_end": 1068
  },
  {
    "index": 43,
    "speaker": null,
    "speaker_name": "哲别",
    "listener": null,
    "text": "要是我在战场之上，给胜过我的好汉杀了，那是死得心甘情愿。现今却是大鹰落在地下，为蚂蚁咬死！",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 1112,
    "line_end": 1112
  },
  {
    "index": 44,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "你还不投降吗？",
    "tone": "冷酷",
    "chapter": 5,
    "line_start": 1168,
    "line_end": 1168
  },
  {
    "index": 45,
    "speaker": null,
    "speaker_name": "哲别",
    "listener": null,
    "text": "大汗饶我一命，以后赴汤蹈火，我也愿意。横断黑水，粉碎岩石，扶保大汗。征讨外敌，挖取人心！叫我到那里，我就到那里。为大汗冲锋陷阵，奔驰万里，日夜不停！",
    "tone": "激动",
    "chapter": 5,
    "line_start": 1170,
    "line_end": 1170
  },
  {
    "index": 46,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": null,
    "text": "好好，以后你跟着我罢！",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 1168,
    "line_end": 1168
  },
  {
    "index": 47,
    "speaker": "char_tie_mu_zhen",
    "speaker_name": "铁木真",
    "listener": "char_guo_jing",
    "text": "好孩儿！",
    "tone": "欣喜",
    "chapter": 5,
    "line_start": 1174,
    "line_end": 1174
  },
  {
    "index": 48,
    "speaker": "char_tuo_lei",
    "speaker_name": "拖雷",
    "listener": "char_guo_jing",
    "text": "哈，你躲在这里。你不敢去帮拖雷打架，没用的东西！",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 1708,
    "line_end": 1708
  },
  {
    "index": 49,
    "speaker": "char_han_xiao_ying",
    "speaker_name": "韩小莹",
    "listener": "char_guo_jing",
    "text": "你若赶去，连你也一起吃了，你难道不怕豹子？",
    "tone": "疑问",
    "chapter": 5,
    "line_start": 1714,
    "line_end": 1714
  }
]

### chapter_summaries.json (40 条)
[
  {
    "chapter": 1,
    "title": "第一回",
    "key_events": [
      "张十五牛家村说书",
      "丘处机雪夜歼金兵",
      "取名郭靖杨康",
      "包惜弱救完颜洪烈",
      "指腹为婚换短剑"
    ],
    "key_characters": [
      "char_guo_xiao_tian",
      "char_yang_tie_xin",
      "char_qiu_chu_ji",
      "char_bao_xi_ru",
      "char_li_ping"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回",
    "key_events": [
      "牛家村遭官兵围攻",
      "郭啸天战死沙场",
      "李萍被段天德掳走",
      "丘处机与七怪打赌",
      "七怪北上大漠寻人"
    ],
    "key_characters": [
      "char_guo_xiao_tian",
      "char_yang_tie_xin",
      "char_qiu_chu_ji",
      "char_ke_zhen_e",
      "char_wan_yan_hong_lie",
      "char_duan_tian_de"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回",
    "key_events": [
      "李萍雪地中产子",
      "郭靖蒙古草原长大",
      "七怪大漠寻到母子",
      "七怪定居大漠教武",
      "铁木真收留七怪"
    ],
    "key_characters": [
      "char_li_ping",
      "char_guo_jing",
      "char_ke_zhen_e",
      "char_tie_mu_zhen",
      "char_duan_tian_de"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回",
    "key_events": [
      "黑风双煞现身大漠",
      "郭靖刺死陈玄风",
      "梅超风负伤逃走",
      "张阿生壮烈战死",
      "郭靖苦练武功十年"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_chen_xuan_feng",
      "char_mei_chao_feng",
      "char_ke_zhen_e",
      "char_zhang_a_sheng"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回",
    "key_events": [
      "郭靖救华筝斗豹子",
      "一箭双雕获赐金刀",
      "尹志平夜试武功",
      "得知杨康武功消息",
      "马钰暗至大漠相助"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_hua_zheng",
      "char_tie_mu_zhen",
      "char_tuo_lei",
      "char_ma_yu"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回",
    "key_events": [
      "马钰悬崖暗授内功",
      "梅超风大漠再现",
      "马钰出面调解恩怨",
      "郭靖内功根基初成",
      "铁木真称成吉思汗"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_ma_yu",
      "char_mei_chao_feng",
      "char_ke_zhen_e",
      "char_tie_mu_zhen"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回",
    "key_events": [
      "郭靖南下赴比武约",
      "张家口初遇黄蓉",
      "赠貂裘红马黄金",
      "二人结伴同行游历",
      "感情悄然萌芽"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回",
    "key_events": [
      "中都比武招亲摆擂",
      "杨康轻薄穆念慈",
      "郭靖杨康交手过招",
      "丘处机揭露身世真相",
      "杨康认贼作父拒认"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yang_kang",
      "char_mu_nian_ci",
      "char_qiu_chu_ji"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回",
    "key_events": [
      "杨铁心与包惜弱重逢",
      "完颜康拒认亲生父母",
      "夫妇拼死逃出王府",
      "全真二子赶到救援",
      "王府高手率兵追杀"
    ],
    "key_characters": [
      "char_yang_tie_xin",
      "char_bao_xi_ru",
      "char_yang_kang",
      "char_wan_yan_hong_lie",
      "char_qiu_chu_ji",
      "char_ma_yu"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回",
    "key_events": [
      "杨铁心夫妇殉情自尽",
      "临终托付穆念慈为妻",
      "交还短剑信物",
      "郭靖陷入三情困境",
      "完颜康悲痛怀恨"
    ],
    "key_characters": [
      "char_yang_tie_xin",
      "char_bao_xi_ru",
      "char_yang_kang",
      "char_guo_jing",
      "char_mu_nian_ci",
      "char_qiu_chu_ji"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回",
    "key_events": [
      "赵王府高手激战",
      "梅超风抓住郭靖",
      "朱聪妙手智取解药",
      "马钰中毒终获救治",
      "郭靖冒险入府盗药"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_mei_chao_feng",
      "char_zhu_cong",
      "char_peng_lian_hu",
      "char_ma_yu"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回",
    "key_events": [
      "偶遇九指神丐洪七公",
      "黄蓉以厨艺打动高人",
      "传授降龙十五掌",
      "郭靖武功大进",
      "师徒情谊初结"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回",
    "key_events": [
      "归云庄遇陆乘风",
      "郭靖降龙掌战梅超风",
      "黄蓉亮身分护众人",
      "同门恩怨得以化解",
      "降龙掌初显神威"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_mei_chao_feng"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回",
    "key_events": [
      "黄药师考验郭靖资质",
      "欧阳克率众前来争婚",
      "三道试题招亲比试",
      "郭靖欧阳克各展所长",
      "黄蓉暗中左右为难"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_huang_yao_shi",
      "char_ou_yang_ke"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回",
    "key_events": [
      "郭靖背诵真经胜出",
      "黎生神龙摆尾退敌",
      "洪七公正式收徒",
      "传授完整十八掌",
      "黄药师勉强认亲"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_huang_yao_shi",
      "char_hong_qi_gong",
      "char_ou_yang_ke"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回",
    "key_events": [
      "出海遇老顽童周伯通",
      "结为忘年之交兄弟",
      "学双手互搏之术",
      "九阴真经来历揭露",
      "武功境界突飞猛进"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_zhou_bo_tong",
      "char_huang_yao_shi"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回",
    "key_events": [
      "讲故事教背九阴真经",
      "传授空明拳七十二路",
      "日夜拆招苦练不辍",
      "摔七八百跤终学会",
      "武功臻一流境界"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_zhou_bo_tong",
      "char_huang_rong"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回",
    "key_events": [
      "三道试题正式比试",
      "比武打成平手",
      "音律较技黄药师占优",
      "郭靖倒背九阴真经",
      "黄药师无奈许婚"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_huang_yao_shi",
      "char_ou_yang_ke",
      "char_zhou_bo_tong"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回",
    "key_events": [
      "周伯通宁死跳海",
      "欧阳锋逼写真经",
      "洪七公及时赶到",
      "海上惊天大战",
      "郭靖折断欧阳克臂"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong",
      "char_ou_yang_feng",
      "char_ou_yang_ke",
      "char_zhou_bo_tong"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回",
    "key_events": [
      "洪七公大战欧阳锋",
      "郭靖写九阴假经骗敌",
      "欧阳锋烧船杀人灭口",
      "师徒逃离火海",
      "黄蓉驾舟及时接应"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong",
      "char_ou_yang_feng",
      "char_ou_yang_ke"
    ]
  },
  {
    "chapter": 21,
    "title": "第二十一回",
    "key_events": [
      "漂流至东海荒岛",
      "洪七公再战欧阳锋",
      "郭靖降龙掌助战",
      "黄蓉巧施计谋困敌",
      "白雕飞来传求救信"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong",
      "char_ou_yang_feng"
    ]
  },
  {
    "chapter": 22,
    "title": "第二十二回",
    "key_events": [
      "黄蓉骑鲨遨游嬉戏",
      "洪七公内功疗伤恢复",
      "郭靖岛上苦练武功",
      "欧阳锋为假经所困",
      "双雕盘旋带来希望"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong",
      "char_ou_yang_feng"
    ]
  },
  {
    "chapter": 23,
    "title": "第二十三回",
    "key_events": [
      "回到南宋临安陆地",
      "夜闯皇宫偷食珍馐",
      "洪七公御厨梁上趣事",
      "宫中遇侍卫追杀",
      "丐帮弟子迎接帮主"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong"
    ]
  },
  {
    "chapter": 24,
    "title": "第二十四回",
    "key_events": [
      "黄蓉重伤急需疗伤",
      "密室七日七夜疗伤",
      "杨康欧阳锋追踪至",
      "密室外六怪激战",
      "靖蓉心意相通"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yang_kang",
      "char_ou_yang_feng"
    ]
  },
  {
    "chapter": 25,
    "title": "第二十五回",
    "key_events": [
      "杨康设下连环毒计",
      "牛家村众人遇险",
      "完颜洪烈大军围攻",
      "郭靖带黄蓉突围",
      "辗转暂避归云庄"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yang_kang",
      "char_wan_yan_hong_lie",
      "char_ou_yang_feng"
    ]
  },
  {
    "chapter": 26,
    "title": "第二十六回",
    "key_events": [
      "丐帮君山大会选帮主",
      "杨康假冒帮主之命",
      "黄蓉识破阴谋对质",
      "帮中元老支持黄蓉",
      "杨康阴谋败露逃走"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yang_kang",
      "char_lu_you_jiao"
    ]
  },
  {
    "chapter": 27,
    "title": "第二十七回",
    "key_events": [
      "黄蓉继任丐帮帮主",
      "洪七公传授打狗棒法",
      "铁掌山遇裘千丈",
      "铁掌帮丐帮对峙",
      "棒法掌法联手显威"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_qiu_qian_zhang",
      "char_qiu_qian_ren"
    ]
  },
  {
    "chapter": 28,
    "title": "第二十八回",
    "key_events": [
      "裘千仞率众围攻铁掌峰",
      "黄蓉打狗棒法缠斗",
      "郭靖降龙掌全力苦战",
      "裘千仞铁掌威猛难挡",
      "借地利方才脱身"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_qiu_qian_ren"
    ]
  },
  {
    "chapter": 29,
    "title": "第二十九回",
    "key_events": [
      "逃入黑沼泽深处",
      "遇隐居多年的瑛姑",
      "斗智奇门遁甲术数",
      "黄蓉以才学折服瑛姑",
      "瑛姑往事恩怨揭露"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_ying_gu"
    ]
  },
  {
    "chapter": 30,
    "title": "第三十回",
    "key_events": [
      "前往大理寻一灯大师",
      "一阳指神功疗伤",
      "耗损大量真元功力",
      "一灯讲述往事恩怨",
      "段皇爷出家缘由"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yi_deng",
      "char_ying_gu",
      "char_zhou_bo_tong"
    ]
  },
  {
    "chapter": 31,
    "title": "第三十一回",
    "key_events": [
      "周伯通瑛姑私通往事",
      "裘千仞杀害婴儿真相",
      "段皇爷出家为僧因由",
      "传授九阴真经总旨",
      "多人恩怨纠葛全貌"
    ],
    "key_characters": [
      "char_yi_deng",
      "char_ying_gu",
      "char_zhou_bo_tong",
      "char_qiu_qian_ren",
      "char_guo_jing"
    ]
  },
  {
    "chapter": 32,
    "title": "第三十二回",
    "key_events": [
      "辞别一灯大师东归",
      "黄蓉梦中表白心迹",
      "二人感情更加深厚",
      "制服歹人梢公",
      "讨论天下武学大势"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yi_deng"
    ]
  },
  {
    "chapter": 33,
    "title": "第三十三回",
    "key_events": [
      "回到中原故土",
      "蒙古即将南侵大宋",
      "华筝白雕传书告密",
      "忠义两难艰难抉择",
      "黄蓉坚定支持郭靖"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hua_zheng",
      "char_tie_mu_zhen"
    ]
  },
  {
    "chapter": 34,
    "title": "第三十四回",
    "key_events": [
      "桃花岛突发命案",
      "黄药师怒疑郭靖",
      "赶回桃花岛调查",
      "发现多具弟子尸体",
      "黄蓉抽丝剥茧查案"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_huang_yao_shi"
    ]
  },
  {
    "chapter": 35,
    "title": "第三十五回",
    "key_events": [
      "查明桃花岛命案真相",
      "杨康铁枪庙中毒身亡",
      "穆念慈怀有遗腹子",
      "杨康临终略有悔悟",
      "欧阳锋蛇毒害人"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_yang_kang",
      "char_mu_nian_ci",
      "char_ou_yang_feng"
    ]
  },
  {
    "chapter": 36,
    "title": "第三十六回",
    "key_events": [
      "成吉思汗誓师西征",
      "郭靖随军担任先锋",
      "运用武穆遗书兵法",
      "蒙古大军连下数城",
      "黄蓉后方出谋划策"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_tie_mu_zhen"
    ]
  },
  {
    "chapter": 37,
    "title": "第三十七回",
    "key_events": [
      "攻破撒马尔罕都城",
      "欧阳锋趁乱出现",
      "成吉思汗封赏遭拒",
      "华筝传书告知真相",
      "拖雷洒泪而别安答"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_ou_yang_feng",
      "char_tie_mu_zhen",
      "char_hua_zheng",
      "char_tuo_lei"
    ]
  },
  {
    "chapter": 38,
    "title": "第三十八回",
    "key_events": [
      "成吉思汗大怒欲斩郭靖",
      "李萍拔刀自刎就义",
      "郭靖携母遗体南归",
      "华筝愧疚远赴西域",
      "与蒙古恩断义绝"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_li_ping",
      "char_tie_mu_zhen",
      "char_hua_zheng"
    ]
  },
  {
    "chapter": 39,
    "title": "第三十九回",
    "key_events": [
      "协助忠义军抗蒙守城",
      "郭靖部署城防兵法",
      "黄蓉骑小红马侦察",
      "蒙古十余万大军压境",
      "誓与城池共存亡"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong"
    ]
  },
  {
    "chapter": 40,
    "title": "第四十回",
    "key_events": [
      "华山二次论剑争锋",
      "洪七公击溃欧阳锋",
      "欧阳锋疯癫问我是谁",
      "郭靖三百招不败",
      "黄药师允婚杨过出世"
    ],
    "key_characters": [
      "char_guo_jing",
      "char_huang_rong",
      "char_hong_qi_gong",
      "char_ou_yang_feng",
      "char_huang_yao_shi",
      "char_mu_nian_ci"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
