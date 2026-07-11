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

### characters.json (56 条)
[
  {
    "id": "char_ling_hu_chong",
    "name": "令狐冲",
    "role": "核心",
    "identity": "华山派大弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "豁达洒脱",
      "重情重义",
      "豪放不羁"
    ],
    "one_line": "华山派大弟子，豁达洒脱，习得独孤九剑，与任盈盈归隐"
  },
  {
    "id": "char_ren_ying_ying",
    "name": "任盈盈",
    "role": "核心",
    "identity": "日月神教圣姑",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "聪慧深情",
      "果敢坚毅",
      "外柔内刚"
    ],
    "one_line": "日月神教圣姑，聪慧深情，与令狐冲终成眷属"
  },
  {
    "id": "char_yue_bu_qun",
    "name": "岳不群",
    "role": "核心",
    "identity": "华山派掌门",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "伪善阴险",
      "城府极深",
      "心狠手辣"
    ],
    "one_line": "华山派掌门，外号君子剑，实为伪君子，自宫练辟邪剑法"
  },
  {
    "id": "char_lin_ping_zhi",
    "name": "林平之",
    "role": "重要",
    "identity": "福威镖局少镖头",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "隐忍坚毅",
      "心胸狭隘",
      "偏执疯狂"
    ],
    "one_line": "福威镖局少镖头，家破人亡后入华山派，自宫练辟邪剑法报仇"
  },
  {
    "id": "char_yue_ling_shan",
    "name": "岳灵珊",
    "role": "重要",
    "identity": "岳不群之女",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "天真善良",
      "多情善感",
      "优柔寡断"
    ],
    "one_line": "岳不群之女，令狐冲师妹，后嫁林平之，最终被林平之所杀"
  },
  {
    "id": "char_yi_lin",
    "name": "仪琳",
    "role": "重要",
    "identity": "恒山派小尼姑",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "清秀善良",
      "慈悲为怀",
      "胆小怕事"
    ],
    "one_line": "恒山派小尼姑，清秀善良，暗恋令狐冲，后任恒山掌门"
  },
  {
    "id": "char_tian_bo_guang",
    "name": "田伯光",
    "role": "重要",
    "identity": "采花大盗",
    "faction": null,
    "personality": [
      "好色风流",
      "言而有信",
      "武功高强"
    ],
    "one_line": "万里独行采花大盗，后改邪归正拜仪琳为师，法名不可不戒"
  },
  {
    "id": "char_ren_wo_xing",
    "name": "任我行",
    "role": "重要",
    "identity": "日月神教教主",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "豪迈霸道",
      "野心勃勃",
      "心狠手辣"
    ],
    "one_line": "日月神教教主，吸星大法绝学，复位后野心膨胀欲一统江湖"
  },
  {
    "id": "char_xiang_wen_tian",
    "name": "向问天",
    "role": "重要",
    "identity": "日月神教光明右使",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "豪迈义气",
      "机智多谋",
      "忠心耿耿"
    ],
    "one_line": "日月神教光明右使，豪迈义气，与令狐冲结为兄弟"
  },
  {
    "id": "char_zuo_leng_chan",
    "name": "左冷禅",
    "role": "重要",
    "identity": "嵩山派掌门",
    "faction": "faction_song_shan_pai",
    "personality": [
      "野心勃勃",
      "心狠手辣",
      "老谋深算"
    ],
    "one_line": "嵩山派掌门，五岳剑派盟主，野心勃勃欲合并五岳派"
  },
  {
    "id": "char_fang_zheng",
    "name": "方证",
    "role": "重要",
    "identity": "少林派方丈",
    "faction": "faction_shao_lin_pai",
    "personality": [
      "慈悲为怀",
      "德高望重",
      "内功精深"
    ],
    "one_line": "少林派掌门方丈，内功精深，传令狐冲易筋经化解异种真气"
  },
  {
    "id": "char_yu_cang_hai",
    "name": "余沧海",
    "role": "重要",
    "identity": "青城派掌门",
    "faction": "faction_qing_cheng_pai",
    "personality": [
      "身材矮小",
      "心狠手辣",
      "为达目的不择手段"
    ],
    "one_line": "青城派掌门，身材矮小，为夺辟邪剑谱灭福威镖局"
  },
  {
    "id": "char_dong_fang_bu_bai",
    "name": "东方不败",
    "role": "重要",
    "identity": "日月神教前教主",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "武功天下第一",
      "心狠手辣",
      "自宫练功"
    ],
    "one_line": "日月神教前教主，练葵花宝典自宫，宠信杨莲亭致败亡"
  },
  {
    "id": "char_chong_xu",
    "name": "冲虚",
    "role": "重要",
    "identity": "武当派掌门",
    "faction": "faction_wu_dang_pai",
    "personality": [
      "智谋深远",
      "武功高强",
      "与少林并称"
    ],
    "one_line": "武当派掌门道长，智谋深远，与方证共御日月教"
  },
  {
    "id": "char_feng_qing_yang",
    "name": "风清扬",
    "role": "重要",
    "identity": "华山派剑宗名宿",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "剑术通神",
      "隐居避世",
      "孤傲清高"
    ],
    "one_line": "华山派剑宗名宿，独孤九剑传人，隐居思过崖传艺令狐冲"
  },
  {
    "id": "char_ding_yi",
    "name": "定逸",
    "role": "次要",
    "identity": "恒山白云庵庵主",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "性格刚猛",
      "暴躁易怒",
      "嫉恶如仇"
    ],
    "one_line": "恒山白云庵庵主，性格刚猛暴躁，被岳不群害死"
  },
  {
    "id": "char_liu_zheng_feng",
    "name": "刘正风",
    "role": "次要",
    "identity": "衡山派第二高手",
    "faction": "faction_heng_shan_pai",
    "personality": [
      "爱好音律",
      "重情重义",
      "淡泊名利"
    ],
    "one_line": "衡山派第二高手，金盆洗手时与曲洋合奏笑傲江湖曲"
  },
  {
    "id": "char_mo_da",
    "name": "莫大",
    "role": "次要",
    "identity": "衡山派掌门",
    "faction": "faction_heng_shan_pai",
    "personality": [
      "琴艺高超",
      "剑法精妙",
      "孤傲清高"
    ],
    "one_line": "衡山派掌门，潇湘夜雨，琴中藏剑剑发琴音"
  },
  {
    "id": "char_ding_xian",
    "name": "定闲",
    "role": "次要",
    "identity": "恒山派掌门",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "温和善良",
      "慈悲为怀",
      "德高望重"
    ],
    "one_line": "恒山派掌门，温和善良，被岳不群害死于铸剑谷"
  },
  {
    "id": "char_ding_jing",
    "name": "定静",
    "role": "次要",
    "identity": "恒山派师太",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "温和善良",
      "武功高强",
      "爱护弟子"
    ],
    "one_line": "恒山派师太，定闲师妹，在福建遭伏击身亡"
  },
  {
    "id": "char_tian_men",
    "name": "天门",
    "role": "次要",
    "identity": "泰山派掌门",
    "faction": "faction_tai_shan_pai",
    "personality": [
      "性格刚烈",
      "武功高强",
      "嫉恶如仇"
    ],
    "one_line": "泰山派掌门，性格刚烈，在华山思过崖遇难"
  },
  {
    "id": "char_lin_zhen_nan",
    "name": "林震南",
    "role": "次要",
    "identity": "福威镖局总镖头",
    "faction": "faction_fu_wei_biao_ju",
    "personality": [
      "武功平平",
      "爱护儿子",
      "经营有方"
    ],
    "one_line": "福威镖局总镖头，林平之之父，被青城派擒杀"
  },
  {
    "id": "char_lu_da_you",
    "name": "陆大有",
    "role": "次要",
    "identity": "华山派六弟子",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "活泼开朗",
      "重情重义",
      "武功平平"
    ],
    "one_line": "华山派六弟子，外号六猴儿，被劳德诺杀害"
  },
  {
    "id": "char_lao_de_nuo",
    "name": "劳德诺",
    "role": "次要",
    "identity": "嵩山派奸细",
    "faction": "faction_song_shan_pai",
    "personality": [
      "阴险狡诈",
      "心狠手辣",
      "深藏不露"
    ],
    "one_line": "华山派二弟子实为嵩山派奸细，杀害陆大有窃取紫霞秘笈"
  },
  {
    "id": "char_lan_feng_huang",
    "name": "蓝凤凰",
    "role": "次要",
    "identity": "五毒教教主",
    "faction": "faction_wu_du_jiao",
    "personality": [
      "妖艳妩媚",
      "善用毒术",
      "重情重义"
    ],
    "one_line": "五毒教教主，日月教下属，妖艳妩媚善用毒"
  },
  {
    "id": "char_qu_yang",
    "name": "曲洋",
    "role": "次要",
    "identity": "日月神教长老",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "爱好音律",
      "重情重义",
      "淡泊名利"
    ],
    "one_line": "日月神教长老，嗜好音律，与刘正风合奏笑傲江湖曲"
  },
  {
    "id": "char_huang_zhong_gong",
    "name": "黄钟公",
    "role": "次要",
    "identity": "梅庄大庄主",
    "faction": null,
    "personality": [
      "琴艺高超",
      "武功高强",
      "隐居避世"
    ],
    "one_line": "梅庄大庄主，擅琴，七弦无形剑绝技"
  },
  {
    "id": "char_hei_bai_zi",
    "name": "黑白子",
    "role": "次要",
    "identity": "梅庄二庄主",
    "faction": null,
    "personality": [
      "善弈棋艺",
      "武功高强",
      "隐居避世"
    ],
    "one_line": "梅庄二庄主，善弈，玄铁棋盘功夫了得"
  },
  {
    "id": "char_tu_bi_weng",
    "name": "秃笔翁",
    "role": "次要",
    "identity": "梅庄三庄主",
    "faction": null,
    "personality": [
      "擅书法",
      "武功高强",
      "隐居避世"
    ],
    "one_line": "梅庄三庄主，擅书法判官笔，附庸风雅"
  },
  {
    "id": "char_dan_qing_sheng",
    "name": "丹青生",
    "role": "次要",
    "identity": "梅庄四庄主",
    "faction": null,
    "personality": [
      "爱酒爱画",
      "武功高强",
      "隐居避世"
    ],
    "one_line": "梅庄四庄主，爱酒爱画，泼墨披麻剑法"
  },
  {
    "id": "char_zu_qian_qiu",
    "name": "祖千秋",
    "role": "次要",
    "identity": "江湖豪杰",
    "faction": null,
    "personality": [
      "雅好古玩",
      "重情重义",
      "豪爽直率"
    ],
    "one_line": "江湖豪杰，雅好古玩，追随令狐冲左右"
  },
  {
    "id": "char_lao_tou_zi",
    "name": "老头子",
    "role": "次要",
    "identity": "江湖豪杰",
    "faction": null,
    "personality": [
      "豪爽直率",
      "重情重义",
      "追随令狐冲"
    ],
    "one_line": "江湖豪杰，祖千秋好友，追随令狐冲左右"
  },
  {
    "id": "char_bu_jie_he_shang",
    "name": "不戒和尚",
    "role": "次要",
    "identity": "仪琳之父",
    "faction": null,
    "personality": [
      "性格古怪",
      "爱护女儿",
      "武功高强"
    ],
    "one_line": "仪琳之父，性格古怪的和尚，武功不弱"
  },
  {
    "id": "char_ping_yi_zhi",
    "name": "平一指",
    "role": "龙套",
    "identity": "神医",
    "faction": null,
    "personality": [
      "医术如神",
      "性格古怪",
      "一人只杀一人只医"
    ],
    "one_line": "杀人名医，医术如神，一人只杀一人只医"
  },
  {
    "id": "char_wang_yuan_ba",
    "name": "王元霸",
    "role": "龙套",
    "identity": "洛阳金刀王家",
    "faction": "faction_luo_yang_jin_dao_wang_jia",
    "personality": [
      "金刀无敌",
      "武功高强",
      "爱护外孙"
    ],
    "one_line": "洛阳金刀无敌，林平之外祖父"
  },
  {
    "id": "char_fei_bin",
    "name": "费彬",
    "role": "龙套",
    "identity": "嵩山十三太保",
    "faction": "faction_song_shan_pai",
    "personality": [
      "武功高强",
      "心狠手辣",
      "忠于嵩山"
    ],
    "one_line": "嵩山派十三太保之一，大嵩阳手，杀刘正风全家"
  },
  {
    "id": "char_shang_guan_yun",
    "name": "上官云",
    "role": "龙套",
    "identity": "日月神教长老",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "武功高强",
      "忠于日月教",
      "执行任务"
    ],
    "one_line": "日月教长老，武功高强"
  },
  {
    "id": "char_tao_gu_liu_xian",
    "name": "桃谷六仙",
    "role": "龙套",
    "identity": "六兄弟",
    "faction": null,
    "personality": [
      "武功怪异",
      "说话缠夹不清",
      "爱胡闹"
    ],
    "one_line": "六兄弟，武功怪异，说话缠夹不清爱胡闹"
  },
  {
    "id": "char_ji_wu_shi",
    "name": "计无施",
    "role": "龙套",
    "identity": "江湖豪杰",
    "faction": null,
    "personality": [
      "武功平平",
      "重情重义",
      "追随令狐冲"
    ],
    "one_line": "江湖豪杰，人称夜猫子，追随令狐冲"
  },
  {
    "id": "char_huang_bo_liu",
    "name": "黄伯流",
    "role": "龙套",
    "identity": "天河帮帮主",
    "faction": "faction_tian_he_bang",
    "personality": [
      "武功平平",
      "忠于日月教",
      "豪爽直率"
    ],
    "one_line": "天河帮帮主，日月教下属"
  },
  {
    "id": "char_yang_lian_ting",
    "name": "杨莲亭",
    "role": "龙套",
    "identity": "日月神教总管",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "阴险狡诈",
      "把持大权",
      "仗势欺人"
    ],
    "one_line": "东方不败男宠，把持日月教大权"
  },
  {
    "id": "char_fang_sheng",
    "name": "方生",
    "role": "龙套",
    "identity": "少林派高僧",
    "faction": "faction_shao_lin_pai",
    "personality": [
      "武功高强",
      "德高望重",
      "忠于少林"
    ],
    "one_line": "少林派高僧，方证师弟"
  },
  {
    "id": "char_qin_juan",
    "name": "秦绢",
    "role": "龙套",
    "identity": "恒山派弟子",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "年幼聪慧",
      "武功平平",
      "忠于恒山"
    ],
    "one_line": "恒山派弟子，年幼聪慧"
  },
  {
    "id": "char_yu_sao",
    "name": "于嫂",
    "role": "龙套",
    "identity": "恒山派弟子",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "武功平平",
      "忠于恒山",
      "令狐冲信任"
    ],
    "one_line": "恒山派老弟子，令狐冲信任之人"
  },
  {
    "id": "char_lin_fu_ren",
    "name": "林夫人",
    "role": "龙套",
    "identity": "林震南之妻",
    "faction": "faction_fu_wei_biao_ju",
    "personality": [
      "性格刚烈",
      "爱护儿子",
      "武功平平"
    ],
    "one_line": "林震南之妻，王元霸之女，性格刚烈"
  },
  {
    "id": "char_tian_song",
    "name": "天松",
    "role": "龙套",
    "identity": "泰山派道人",
    "faction": "faction_tai_shan_pai",
    "personality": [
      "武功平平",
      "忠于泰山",
      "性格刚烈"
    ],
    "one_line": "泰山派道人，在衡阳回雁楼被田伯光砍伤"
  },
  {
    "id": "char_ding_jian",
    "name": "丁坚",
    "role": "龙套",
    "identity": "梅庄管家",
    "faction": null,
    "personality": [
      "武功平平",
      "忠于梅庄",
      "华而不实"
    ],
    "one_line": "梅庄管家，外号一字电剑"
  },
  {
    "id": "char_wen_xian_sheng",
    "name": "闻先生",
    "role": "背景",
    "identity": "点穴高手",
    "faction": null,
    "personality": [
      "武功平平",
      "点穴高手"
    ],
    "one_line": "陕南判官笔点穴高手"
  },
  {
    "id": "char_he_san_qi",
    "name": "何三七",
    "role": "背景",
    "identity": "雁荡山高手",
    "faction": null,
    "personality": [
      "武功平平",
      "自幼卖馄饨",
      "淡泊名利"
    ],
    "one_line": "浙南雁荡山高手，自幼卖馄饨为生"
  },
  {
    "id": "char_yi_he",
    "name": "仪和",
    "role": "背景",
    "identity": "恒山派弟子",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "武功平平",
      "忠于恒山",
      "爱护师妹"
    ],
    "one_line": "恒山派弟子，仪琳师姐"
  },
  {
    "id": "char_yi_qing",
    "name": "仪清",
    "role": "背景",
    "identity": "恒山派弟子",
    "faction": "faction_heng_shan_pai_ni",
    "personality": [
      "武功平平",
      "忠于恒山",
      "令狐冲信任"
    ],
    "one_line": "恒山派弟子，令狐冲信任之人"
  },
  {
    "id": "char_qu_fei_yan",
    "name": "曲非烟",
    "role": "次要",
    "identity": "曲洋孙女",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "聪明伶俐",
      "古灵精怪",
      "胆大心细"
    ],
    "one_line": "曲洋孙女，聪明伶俐，在群玉院中与仪琳田伯光相遇"
  },
  {
    "id": "char_mu_gao_feng",
    "name": "木高峰",
    "role": "次要",
    "identity": "塞北名驼",
    "faction": null,
    "personality": [
      "亦正亦邪",
      "老奸巨猾",
      "武功高强"
    ],
    "one_line": "塞北名驼，人称木驼子，行事亦正亦邪"
  },
  {
    "id": "char_feng_bu_ping",
    "name": "封不平",
    "role": "次要",
    "identity": "华山剑宗传人",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "心高气傲",
      "剑术精湛",
      "野心勃勃"
    ],
    "one_line": "华山剑宗传人，意图争夺华山掌门之位"
  },
  {
    "id": "char_tong_bai_xiong",
    "name": "童百熊",
    "role": "次要",
    "identity": "日月神教长老",
    "faction": "faction_ri_yue_shen_jiao",
    "personality": [
      "豪迈直率",
      "重情重义",
      "刚正不阿"
    ],
    "one_line": "日月神教长老，与东方不败有旧交，因不满杨莲亭被杀"
  },
  {
    "id": "char_yue_furen",
    "name": "岳夫人",
    "role": "次要",
    "identity": "华山派掌门夫人",
    "faction": "faction_hua_shan_pai",
    "personality": [
      "温柔贤淑",
      "侠义心肠",
      "深明大义"
    ],
    "one_line": "岳不群之妻，华山派女侠，令狐冲师娘，最终自尽"
  }
]

### factions.json (13 条)
[
  {
    "id": "faction_hua_shan_pai",
    "name": "华山派",
    "type": "武林门派",
    "location": "loc_hua_shan",
    "one_line": "五岳剑派之一，令狐冲师门，分气宗剑宗两派"
  },
  {
    "id": "faction_song_shan_pai",
    "name": "嵩山派",
    "type": "武林门派",
    "location": "loc_song_shan",
    "one_line": "五岳剑派之首，左冷禅执掌，势力最强"
  },
  {
    "id": "faction_heng_shan_pai",
    "name": "恒山派",
    "type": "武林门派",
    "location": "loc_heng_shan",
    "one_line": "五岳剑派之一，全为女尼，令狐冲曾任掌门"
  },
  {
    "id": "faction_heng_shan_yue_pai",
    "name": "衡山派",
    "type": "武林门派",
    "location": "loc_heng_shan_yue",
    "one_line": "五岳剑派之一，莫大先生执掌，善音律"
  },
  {
    "id": "faction_tai_shan_pai",
    "name": "泰山派",
    "type": "武林门派",
    "location": "loc_tai_shan",
    "one_line": "五岳剑派之一，天门道人执掌，内部分裂"
  },
  {
    "id": "faction_wu_yue_jian_pai",
    "name": "五岳剑派",
    "type": "武林门派",
    "location": null,
    "one_line": "华山嵩山恒山衡山泰山五派联盟"
  },
  {
    "id": "faction_ri_yue_shen_jiao",
    "name": "日月神教",
    "type": "帮派",
    "location": "loc_hei_mu_ya",
    "one_line": "江湖最大势力，被正教称为魔教，总坛在黑木崖"
  },
  {
    "id": "faction_shao_lin_pai",
    "name": "少林派",
    "type": "武林门派",
    "location": "loc_shao_lin_si",
    "one_line": "武林泰斗，方证大师住持，正教领袖"
  },
  {
    "id": "faction_wu_dang_pai",
    "name": "武当派",
    "type": "武林门派",
    "location": "loc_wu_dang_shan",
    "one_line": "武林第二大派，冲虚道长为代表"
  },
  {
    "id": "faction_qing_cheng_pai",
    "name": "青城派",
    "type": "武林门派",
    "location": null,
    "one_line": "四川青城山门派，余沧海为掌门，灭福威镖局"
  },
  {
    "id": "faction_fu_wei_biao_ju",
    "name": "福威镖局",
    "type": "家族",
    "location": "loc_fu_zhou",
    "one_line": "林平之家族镖局，因辟邪剑谱被青城派灭门"
  },
  {
    "id": "faction_wu_xian_jiao",
    "name": "五仙教",
    "type": "帮派",
    "location": null,
    "one_line": "苗疆教派，蓝凤凰为教主，善用毒术"
  },
  {
    "id": "faction_mei_zhuang",
    "name": "梅庄",
    "type": "家族",
    "location": "loc_mei_zhuang",
    "one_line": "江南四友隐居之所，实为囚禁任我行之地"
  }
]

### locations.json (18 条)
[
  {
    "id": "loc_hua_shan",
    "name": "华山",
    "region": "中原",
    "one_line": "华山派所在地，五岳之西岳，思过崖在其上"
  },
  {
    "id": "loc_si_guo_ya",
    "name": "思过崖",
    "region": "中原",
    "one_line": "华山绝壁，令狐冲面壁学剑之地，藏有五岳剑法"
  },
  {
    "id": "loc_song_shan",
    "name": "嵩山",
    "region": "中原",
    "one_line": "嵩山派所在地，五岳之中岳，左冷禅大本营"
  },
  {
    "id": "loc_heng_shan",
    "name": "恒山",
    "region": "中原",
    "one_line": "恒山派所在地，五岳之北岳，悬空寺在其上"
  },
  {
    "id": "loc_tai_shan",
    "name": "泰山",
    "region": "中原",
    "one_line": "泰山派所在地，五岳之东岳"
  },
  {
    "id": "loc_heng_shan_yue",
    "name": "衡山",
    "region": "中原",
    "one_line": "衡山派所在地，五岳之南岳"
  },
  {
    "id": "loc_hei_mu_ya",
    "name": "黑木崖",
    "region": "中原",
    "one_line": "日月神教总坛，东方不败与任我行先后驻守"
  },
  {
    "id": "loc_luo_yang",
    "name": "洛阳",
    "region": "中原",
    "one_line": "金刀王元霸所在地，令狐冲曾寄居于此"
  },
  {
    "id": "loc_fu_zhou",
    "name": "福州",
    "region": "江南",
    "one_line": "福威镖局所在地，辟邪剑谱藏于此"
  },
  {
    "id": "loc_mei_zhuang",
    "name": "梅庄",
    "region": "江南",
    "one_line": "杭州西湖畔，江南四友隐居处，任我行被囚之地"
  },
  {
    "id": "loc_shao_lin_si",
    "name": "少林寺",
    "region": "中原",
    "one_line": "少林派所在地，武林泰斗之所在"
  },
  {
    "id": "loc_wu_dang_shan",
    "name": "武当山",
    "region": "中原",
    "one_line": "武当派所在地，冲虚道长驻锡"
  },
  {
    "id": "loc_heng_yang_cheng",
    "name": "衡阳城",
    "region": "中原",
    "one_line": "衡山脚下城池，刘正风金盆洗手之地"
  },
  {
    "id": "loc_xuan_kong_si",
    "name": "悬空寺",
    "region": "中原",
    "one_line": "恒山之上的古寺，险峻奇绝"
  },
  {
    "id": "loc_qun_yu_yuan",
    "name": "群玉院",
    "region": "中原",
    "one_line": "妓院，令狐冲与田伯光初次交手之处"
  },
  {
    "id": "loc_zhu_jian_gu",
    "name": "铸剑谷",
    "region": "中原",
    "one_line": "恒山附近山谷，定静师太遇难之处"
  },
  {
    "id": "loc_chao_yang_feng",
    "name": "朝阳峰",
    "region": "中原",
    "one_line": "华山东峰，岳不群与令狐冲对峙之地"
  },
  {
    "id": "loc_lv_zhu_xiang",
    "name": "绿竹巷",
    "region": "中原",
    "one_line": "洛阳城中竹巷，任盈盈绿竹翁隐居处，令狐冲初遇任盈盈"
  }
]

### skills.json (19 条)
[
  {
    "id": "skill_du_gu_jiu_jian",
    "name": "独孤九剑",
    "type": "剑法",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "风清扬传令狐冲的绝世剑法，无招胜有招，可破天下武功"
  },
  {
    "id": "skill_pi_xie_jian_fa",
    "name": "辟邪剑法",
    "type": "剑法",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "林家祖传剑法，需自宫修炼，速度奇快无比"
  },
  {
    "id": "skill_kui_hua_bao_dian",
    "name": "葵花宝典",
    "type": "内功",
    "mastery_rank": "登峰造极",
    "practitioners": [],
    "one_line": "前朝太监所创武学，需自宫修炼，东方不败所练"
  },
  {
    "id": "skill_xi_xing_da_fa",
    "name": "吸星大法",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "任我行绝学，可吸取他人内力为己用"
  },
  {
    "id": "skill_zi_xia_shen_gong",
    "name": "紫霞神功",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "华山派镇派内功，岳不群所修的高深内功"
  },
  {
    "id": "skill_chong_ling_jian_fa",
    "name": "冲灵剑法",
    "type": "剑法",
    "mastery_rank": "略有小成",
    "practitioners": [],
    "one_line": "令狐冲与岳灵珊共创的剑法，二人情感之寄托"
  },
  {
    "id": "skill_hua_shan_jian_fa",
    "name": "华山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "华山派基础剑法，气宗所传"
  },
  {
    "id": "skill_song_shan_jian_fa",
    "name": "嵩山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "嵩山派剑法，气势雄浑"
  },
  {
    "id": "skill_heng_shan_jian_fa",
    "name": "恒山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "恒山派剑法，以柔克刚"
  },
  {
    "id": "skill_heng_shan_yue_jian_fa",
    "name": "衡山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "衡山派剑法，莫大先生所创百变千幻衡山云雾十三式"
  },
  {
    "id": "skill_tai_shan_jian_fa",
    "name": "泰山剑法",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "泰山派剑法，刚猛有力"
  },
  {
    "id": "skill_fan_tian_zhang",
    "name": "翻天掌",
    "type": "掌法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "福威镖局林家祖传掌法"
  },
  {
    "id": "skill_da_song_yang_shou",
    "name": "大嵩阳手",
    "type": "掌法",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "嵩山派费彬的成名掌法"
  },
  {
    "id": "skill_han_bing_zhen_qi",
    "name": "寒冰真气",
    "type": "内功",
    "mastery_rank": "出神入化",
    "practitioners": [],
    "one_line": "左冷禅独门内功，以寒冰之气伤人"
  },
  {
    "id": "skill_kuang_feng_kuai_jian",
    "name": "狂风快剑",
    "type": "剑法",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "封不平所创剑法，剑势如狂风骤雨"
  },
  {
    "id": "skill_yi_jin_jing",
    "name": "易筋经",
    "type": "内功",
    "mastery_rank": "返璞归真",
    "practitioners": [],
    "one_line": "少林派至高内功心法，可化解吸星大法后患"
  },
  {
    "id": "skill_hun_yuan_gong",
    "name": "混元功",
    "type": "内功",
    "mastery_rank": "登堂入室",
    "practitioners": [],
    "one_line": "华山派内功，令狐冲早期所习"
  },
  {
    "id": "skill_qing_xin_pu_shan_zhou",
    "name": "清心普善咒",
    "type": "音攻",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "琴曲，任盈盈以琴音为令狐冲疗伤"
  },
  {
    "id": "skill_qi_xing_jue",
    "name": "七弦无形剑",
    "type": "音攻",
    "mastery_rank": "炉火纯青",
    "practitioners": [],
    "one_line": "黄钟公以琴音伤人的武功，梅庄四友之首的绝技"
  }
]

### techniques.json (2 条)
[
  {
    "id": "tech_yi_zhong_zhen_qi",
    "name": "异种真气",
    "type": "internal",
    "source_skill": null
  },
  {
    "id": "tech_gong_jian_xi_shou",
    "name": "自宫修炼",
    "type": "special",
    "source_skill": null
  }
]

### items.json (14 条)
[
  {
    "id": "item_pi_xie_jian_pu",
    "name": "辟邪剑谱",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "神品",
    "related_skills": [
      "skill_pi_xie_jian_fa"
    ],
    "one_line": "林家祖传剑谱，需自宫修炼，引发全书血案"
  },
  {
    "id": "item_kui_hua_bao_dian",
    "name": "葵花宝典",
    "type": "秘籍",
    "owner": "faction_ri_yue_shen_jiao",
    "rarity_tier": "神品",
    "related_skills": [
      "skill_kui_hua_bao_dian"
    ],
    "one_line": "日月神教至高武学秘籍，东方不败所练"
  },
  {
    "id": "item_guang_ling_san_qin_pu",
    "name": "广陵散琴谱",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "曲洋从古墓所得琴谱，用于梅庄交易"
  },
  {
    "id": "item_san_shi_shen_dan",
    "name": "三尸脑神丹",
    "type": "毒药",
    "owner": "faction_ri_yue_shen_jiao",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "日月神教控制属下的毒药，须定期服用解药"
  },
  {
    "id": "item_san_shi_shen_dan_jie_yao",
    "name": "三尸脑神丹解药",
    "type": "丹药",
    "owner": "char_ren_ying_ying",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "盈盈用以胁迫岳不群的解药"
  },
  {
    "id": "item_xiao_yao_wang",
    "name": "绣花针",
    "type": "暗器",
    "owner": "char_dong_fang_bu_bai",
    "rarity_tier": "珍品",
    "related_skills": [
      "skill_kui_hua_bao_dian"
    ],
    "one_line": "东方不败的独门暗器，绣花时亦可杀人"
  },
  {
    "id": "item_jin_si_yu_wang",
    "name": "金丝渔网",
    "type": "工具",
    "owner": "char_yue_bu_qun",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "岳不群用来擒拿令狐冲和盈盈的渔网"
  },
  {
    "id": "item_yu_xiao",
    "name": "玉箫",
    "type": "乐器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "黄钟公赠予令狐冲的玉箫"
  },
  {
    "id": "item_yao_qin",
    "name": "瑶琴",
    "type": "乐器",
    "owner": null,
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "黄钟公的乐器，音律高手所用"
  },
  {
    "id": "item_xiao_ao_jiang_hu_qu_pu",
    "name": "笑傲江湖曲谱",
    "type": "秘籍",
    "owner": null,
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "刘正风与曲洋合创的琴箫曲谱"
  },
  {
    "id": "item_tian_xiang_du_xu_jiao",
    "name": "天香断续胶",
    "type": "丹药",
    "owner": "faction_heng_shan_pai_ni",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "恒山派治伤圣药，外敷止血生肌"
  },
  {
    "id": "item_bai_yun_xiong_dan_wan",
    "name": "白云熊胆丸",
    "type": "丹药",
    "owner": "faction_heng_shan_pai_ni",
    "rarity_tier": "良品",
    "related_skills": [],
    "one_line": "恒山派内服伤药，功效显著"
  },
  {
    "id": "item_hei_mu_ling",
    "name": "黑木令",
    "type": "信物",
    "owner": "char_ren_wo_xing",
    "rarity_tier": "珍品",
    "related_skills": [],
    "one_line": "日月神教教主令牌，持令者号令教众"
  },
  {
    "id": "item_hu_qin",
    "name": "胡琴",
    "type": "乐器",
    "owner": "char_mo_da",
    "rarity_tier": "良品",
    "related_skills": [
      "skill_heng_shan_jian_fa_liu"
    ],
    "one_line": "莫大先生随身胡琴，藏剑其中"
  }
]

### dialogues.json (前 50 条 / 共 57 条)
[
  {
    "index": 0,
    "speaker": "char_lin_zhen_nan",
    "speaker_name": "林震南",
    "listener": "char_lin_ping_zhi",
    "text": "平儿，好教你得知，咱们镖局子今儿得到了一个喜讯。",
    "tone": "欣喜",
    "chapter": 1,
    "line_start": 103,
    "line_end": 103
  },
  {
    "index": 1,
    "speaker": "char_lin_ping_zhi",
    "speaker_name": "林平之",
    "listener": null,
    "text": "什么东西！两个不带眼的狗崽子，却到我们福州府来撒野！",
    "tone": "愤怒",
    "chapter": 1,
    "line_start": 45,
    "line_end": 45
  },
  {
    "index": 2,
    "speaker": "char_lin_ping_zhi",
    "speaker_name": "林平之",
    "listener": null,
    "text": "史⋯⋯史镖头，那⋯⋯那怎么办？我本来⋯⋯本来没想杀他。",
    "tone": "恐惧",
    "chapter": 1,
    "line_start": 83,
    "line_end": 83
  },
  {
    "index": 3,
    "speaker": "char_lin_zhen_nan",
    "speaker_name": "林震南",
    "listener": "char_lin_ping_zhi",
    "text": "江湖上如遇到了劲敌，应变竟也这等迟钝，你这条肩膀还在么？",
    "tone": "陈述",
    "chapter": 1,
    "line_start": 97,
    "line_end": 97
  },
  {
    "index": 4,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": null,
    "text": "德诺，你入我门之前，已在江湖上闯荡多年，可曾听得武林之中，对福威镖局总镖头林震南的武功，如何评论？",
    "tone": "疑问",
    "chapter": 3,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 5,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": null,
    "text": "是了！福威镖局这些年来兴旺发达，倒是江湖上朋友给面子的居多。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 6,
    "speaker": "char_ding_yi",
    "speaker_name": "定逸",
    "listener": null,
    "text": "令狐冲这小子一张臭嘴，不知是那个缺德之人调教出来的。",
    "tone": "愤怒",
    "chapter": 4,
    "line_start": 21,
    "line_end": 21
  },
  {
    "index": 7,
    "speaker": "char_liu_zheng_feng",
    "speaker_name": "刘正风",
    "listener": "char_ding_yi",
    "text": "令狐师侄若不是看重恒山派，华山派自岳先生而下，若不都是心中敬重佩服三位师太，他又怎肯如此尽心竭力的相救贵派弟子？",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 8,
    "speaker": "char_tian_bo_guang",
    "speaker_name": "田伯光",
    "listener": null,
    "text": "我田伯光独往独来，横行天下，那里能顾忌得这么多？",
    "tone": "陈述",
    "chapter": 4,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 9,
    "speaker": "char_yi_lin",
    "speaker_name": "仪琳",
    "listener": null,
    "text": "这位令狐师兄于我有救命大恩，终于为我而死，我⋯⋯我不配做他朋友。",
    "tone": "悲伤",
    "chapter": 5,
    "line_start": 3,
    "line_end": 3
  },
  {
    "index": 10,
    "speaker": "char_qu_fei_yan",
    "speaker_name": "曲非烟",
    "listener": "char_yi_lin",
    "text": "姊姊，你生得这般美貌，剃了光头便大大减色，倘若留起一头乌油油的长发，那才叫好看呢。",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 19,
    "line_end": 19
  },
  {
    "index": 11,
    "speaker": "char_qu_fei_yan",
    "speaker_name": "曲非烟",
    "listener": "char_tian_bo_guang",
    "text": "田伯光，你师父在这里，快快过来磕头！",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 12,
    "speaker": "char_tian_bo_guang",
    "speaker_name": "田伯光",
    "listener": null,
    "text": "什么师父？小娘皮胡说八道，我撕烂你臭嘴。",
    "tone": "愤怒",
    "chapter": 5,
    "line_start": 53,
    "line_end": 53
  },
  {
    "index": 13,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": "char_yu_cang_hai",
    "text": "这叫做明知故问。在妓院之中，还干什么来着？",
    "tone": "调侃",
    "chapter": 5,
    "line_start": 183,
    "line_end": 183
  },
  {
    "index": 14,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": "char_mu_gao_feng",
    "text": "木兄，怎地跟孩子们一般见识？我说你倒是返老还童了。",
    "tone": "陈述",
    "chapter": 5,
    "line_start": 311,
    "line_end": 311
  },
  {
    "index": 15,
    "speaker": "char_fei_bin",
    "speaker_name": "费彬",
    "listener": "char_liu_zheng_feng",
    "text": "刘正风和魔教妖人结交，意欲不利我五岳剑派。",
    "tone": "冷酷",
    "chapter": 7,
    "line_start": 145,
    "line_end": 145
  },
  {
    "index": 16,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": "char_ling_hu_chong",
    "text": "冲儿，你就是口齿轻薄，说话没点正经，怎能作众师弟、师妹的表率？",
    "tone": "陈述",
    "chapter": 7,
    "line_start": 283,
    "line_end": 283
  },
  {
    "index": 17,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "余矮子的剑法，可比师父差得远了，斗到后来，他只好三十六着。青城派屁股向后、逃之夭夭的功夫，原比别派为高。",
    "tone": "调侃",
    "chapter": 7,
    "line_start": 283,
    "line_end": 283
  },
  {
    "index": 18,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": "char_ling_hu_chong",
    "text": "你是本门大弟子，我和你师娘对你期望甚殷，盼你他日能为我们分任艰巨，抵挡祸患，光大华山一派。但你牵缠于儿女私情，不求上进，荒废武功，可令我们失望得很了。",
    "tone": "陈述",
    "chapter": 9,
    "line_start": 19,
    "line_end": 19
  },
  {
    "index": 19,
    "speaker": "char_feng_qing_yang",
    "speaker_name": "风清扬",
    "listener": "char_ling_hu_chong",
    "text": "令狐冲你这小子，实在也太不成器！我来教你。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 9,
    "line_end": 9
  },
  {
    "index": 20,
    "speaker": "char_feng_qing_yang",
    "speaker_name": "风清扬",
    "listener": "char_ling_hu_chong",
    "text": "剑术之道，讲究如行云流水，任意所之。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 13,
    "line_end": 13
  },
  {
    "index": 21,
    "speaker": "char_feng_qing_yang",
    "speaker_name": "风清扬",
    "listener": "char_ling_hu_chong",
    "text": "活学活使，只是第一步。要做到出手无招，那才真是踏入了高手的境界。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 65,
    "line_end": 65
  },
  {
    "index": 22,
    "speaker": "char_feng_qing_yang",
    "speaker_name": "风清扬",
    "listener": "char_ling_hu_chong",
    "text": "根本无招，如何可破？",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 67,
    "line_end": 67
  },
  {
    "index": 23,
    "speaker": "char_feng_qing_yang",
    "speaker_name": "风清扬",
    "listener": "char_ling_hu_chong",
    "text": "五岳剑派中各有无数蠢才，以为将师父传下来的剑招学得精熟，自然而然便成高手，哼哼，熟读唐诗三百首，不会作诗也会吟！",
    "tone": "嘲讽",
    "chapter": 10,
    "line_start": 63,
    "line_end": 63
  },
  {
    "index": 24,
    "speaker": "char_feng_bu_ping",
    "speaker_name": "封不平",
    "listener": "char_yue_bu_qun",
    "text": "是你师父，那是不错，是不是华山派掌门，却要走着瞧了。",
    "tone": "嘲讽",
    "chapter": 11,
    "line_start": 47,
    "line_end": 47
  },
  {
    "index": 25,
    "speaker": "char_xiang_wen_tian",
    "speaker_name": "向问天",
    "listener": null,
    "text": "不错，这是吸星大法，那一位有兴致的便上来试试。",
    "tone": "欣喜",
    "chapter": 18,
    "line_start": 381,
    "line_end": 381
  },
  {
    "index": 26,
    "speaker": "char_ren_wo_xing",
    "speaker_name": "任我行",
    "listener": null,
    "text": "千秋万载，一统江湖！",
    "tone": "激动",
    "chapter": 30,
    "line_start": 257,
    "line_end": 257
  },
  {
    "index": 27,
    "speaker": "char_hei_bai_zi",
    "speaker_name": "黑白子",
    "listener": null,
    "text": "任⋯⋯任老爷子⋯⋯你⋯⋯你的吸星大法⋯⋯",
    "tone": "恐惧",
    "chapter": 21,
    "line_start": 255,
    "line_end": 255
  },
  {
    "index": 28,
    "speaker": "char_fang_zheng",
    "speaker_name": "方证大师",
    "listener": null,
    "text": "左盟主文才武略，确是武林中的杰出人物，五岳剑派之中，原本没第二人比得上。不过他抱负太大，急欲压倒武当、少林两派，未免有些不择手段。",
    "tone": "陈述",
    "chapter": 30,
    "line_start": 25,
    "line_end": 25
  },
  {
    "index": 29,
    "speaker": "char_tong_bai_xiong",
    "speaker_name": "童百熊",
    "listener": "char_dong_fang_bu_bai",
    "text": "东方兄弟，这几年来，我要见你一面也难。你隐居起来，苦练《葵花宝典》，可知不知道教中故旧星散，大祸便在眉睫吗？",
    "tone": "焦急",
    "chapter": 31,
    "line_start": 79,
    "line_end": 79
  },
  {
    "index": 30,
    "speaker": "char_ren_ying_ying",
    "speaker_name": "任盈盈",
    "listener": "char_ling_hu_chong",
    "text": "冲哥，你是在找我吗？",
    "tone": "欣喜",
    "chapter": 33,
    "line_start": 85,
    "line_end": 85
  },
  {
    "index": 31,
    "speaker": "char_zuo_leng_chan",
    "speaker_name": "左冷禅",
    "listener": null,
    "text": "岳姑娘精通泰山、衡山、恒山三派剑法，确是难能可贵，若能以嵩山剑法胜得我手中长剑，我嵩山全派自当奉岳先生为掌门。",
    "tone": "冷酷",
    "chapter": 34,
    "line_start": 5,
    "line_end": 5
  },
  {
    "index": 32,
    "speaker": "char_yue_bu_qun",
    "speaker_name": "岳不群",
    "listener": null,
    "text": "在下的武功剑法，比之少林派方证大师、武当派冲虚道长，以及丐帮解帮主诸位前辈英雄，那可望尘莫及。",
    "tone": "嘲讽",
    "chapter": 34,
    "line_start": 81,
    "line_end": 81
  },
  {
    "index": 33,
    "speaker": "char_lin_ping_zhi",
    "speaker_name": "林平之",
    "listener": "char_yue_ling_shan",
    "text": "你爹爹做这种事，就不难听？他做得，我便说不得？",
    "tone": "愤怒",
    "chapter": 35,
    "line_start": 481,
    "line_end": 481
  },
  {
    "index": 34,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "小师妹或许喜欢人家叫她林夫人。",
    "tone": "悲伤",
    "chapter": 36,
    "line_start": 197,
    "line_end": 197
  },
  {
    "index": 35,
    "speaker": "char_ren_ying_ying",
    "speaker_name": "任盈盈",
    "listener": "char_ling_hu_chong",
    "text": "林平之如此无情无义，岳姑娘泉下有灵，明白了他的歹毒心肠，不会愿作林夫人了。",
    "tone": "陈述",
    "chapter": 36,
    "line_start": 197,
    "line_end": 197
  },
  {
    "index": 36,
    "speaker": "char_ren_ying_ying",
    "speaker_name": "任盈盈",
    "listener": "char_ling_hu_chong",
    "text": "咱们便在这里住些时候，一面养伤，一面伴坟。",
    "tone": "陈述",
    "chapter": 36,
    "line_start": 199,
    "line_end": 199
  },
  {
    "index": 37,
    "speaker": "char_ren_wo_xing",
    "speaker_name": "任我行",
    "listener": "char_ling_hu_chong",
    "text": "令狐掌门，且请一旁就座。",
    "tone": "陈述",
    "chapter": 39,
    "line_start": 183,
    "line_end": 183
  },
  {
    "index": 38,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "大丈夫行事，爱怎样便怎样，行云流水，任意所之，什么武林规矩，门派教条，全都是放他妈的狗臭屁！",
    "tone": "激动",
    "chapter": 10,
    "line_start": 173,
    "line_end": 173
  },
  {
    "index": 39,
    "speaker": "char_fang_zheng",
    "speaker_name": "方证大师",
    "listener": "char_ling_hu_chong",
    "text": "令狐掌门此言差矣。魔教要毁我少林、武当与五岳剑派，百余年前便已存此心，其时老衲都未出世，跟令狐掌门又有何干？",
    "tone": "陈述",
    "chapter": 40,
    "line_start": 23,
    "line_end": 23
  },
  {
    "index": 40,
    "speaker": "char_fang_zheng",
    "speaker_name": "方证大师",
    "listener": null,
    "text": "一统江湖，既无可能，亦非众人之福。",
    "tone": "陈述",
    "chapter": 40,
    "line_start": 27,
    "line_end": 27
  },
  {
    "index": 41,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "今日得聆大师指点，真如瞎子开了眼一般，就算以后没日子修练，也一样的欢喜。",
    "tone": "欣喜",
    "chapter": 40,
    "line_start": 69,
    "line_end": 69
  },
  {
    "index": 42,
    "speaker": "char_fang_zheng",
    "speaker_name": "方证大师",
    "listener": null,
    "text": "任教主既说一个月之内，要将恒山之上杀得鸡犬不留。他言出如山，决无更改。现下少林、武当、昆仑、峨嵋、崆峒各派好手，都已聚集在恒山脚下了。",
    "tone": "陈述",
    "chapter": 40,
    "line_start": 31,
    "line_end": 31
  },
  {
    "index": 43,
    "speaker": "char_chong_xu",
    "speaker_name": "冲虚道长",
    "listener": "char_ling_hu_chong",
    "text": "令狐兄弟，我带他们二人来，另有一番用意。盼望他们二人能给咱们办一件大事。",
    "tone": "陈述",
    "chapter": 40,
    "line_start": 87,
    "line_end": 87
  },
  {
    "index": 44,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "任教主见到这张宝椅，非上去坐一下不可。椅中机簧发作，便可送了他性命，是不是？",
    "tone": "欣喜",
    "chapter": 40,
    "line_start": 97,
    "line_end": 97
  },
  {
    "index": 45,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "五岳剑派，同气连枝，华山派也好，恒山派也好，都是你这淫贼的对头⋯⋯",
    "tone": "愤怒",
    "chapter": 3,
    "line_start": 371,
    "line_end": 371
  },
  {
    "index": 46,
    "speaker": "char_tian_bo_guang",
    "speaker_name": "田伯光",
    "listener": "char_ling_hu_chong",
    "text": "令狐兄，你得风老前辈指点诀窍之后，果然剑法大进，不过适才给你点倒，乃一时疏忽，田某心中不服，咱们再来比过。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 89,
    "line_end": 89
  },
  {
    "index": 47,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "难道我十多年来所练内功，竟一点也没剩下？",
    "tone": "悲伤",
    "chapter": 12,
    "line_start": 315,
    "line_end": 315
  },
  {
    "index": 48,
    "speaker": "char_fang_sheng",
    "speaker_name": "方生大师",
    "listener": "char_ling_hu_chong",
    "text": "你⋯⋯你⋯⋯",
    "tone": "激动",
    "chapter": 1,
    "line_start": 407,
    "line_end": 407
  },
  {
    "index": 49,
    "speaker": "char_ling_hu_chong",
    "speaker_name": "令狐冲",
    "listener": null,
    "text": "风太师叔待弟子恩德如山。",
    "tone": "激动",
    "chapter": 40,
    "line_start": 57,
    "line_end": 57
  }
]

### chapter_summaries.json (40 条)
[
  {
    "chapter": 1,
    "title": "第一回 灭门",
    "key_events": [
      "林平之误杀余人彦",
      "福威镖局遭袭",
      "林家满门被灭",
      "林平之出逃"
    ],
    "key_characters": [
      "char_lin_ping_zhi",
      "char_lin_zhen_nan",
      "char_yu_cang_hai"
    ]
  },
  {
    "chapter": 2,
    "title": "第二回 聆秘",
    "key_events": [
      "劳德诺讲述辟邪剑谱来历",
      "林远图往事揭露",
      "林平之决心投华山",
      "岳不群暗中觊觎剑谱"
    ],
    "key_characters": [
      "char_lin_ping_zhi",
      "char_lao_de_nuo",
      "char_yue_bu_qun"
    ]
  },
  {
    "chapter": 3,
    "title": "第三回 救难",
    "key_events": [
      "仪琳讲述令狐冲救命经过",
      "令狐冲重伤",
      "定逸师太现身",
      "各路英雄齐聚衡山"
    ],
    "key_characters": [
      "char_yi_lin",
      "char_ling_hu_chong",
      "char_tian_bo_guang",
      "char_ding_yi",
      "char_yue_bu_qun"
    ]
  },
  {
    "chapter": 4,
    "title": "第四回 坐斗",
    "key_events": [
      "令狐冲与田伯光斗智",
      "泰山派弟子被杀",
      "令狐冲逃入妓院",
      "田伯光约定坐斗"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_tian_bo_guang",
      "char_yi_lin",
      "char_yu_cang_hai",
      "char_ding_yi"
    ]
  },
  {
    "chapter": 5,
    "title": "第五回 治伤",
    "key_events": [
      "仪琳为令狐冲治伤",
      "曲非烟设计引开众人",
      "余沧海与田伯光交手",
      "令狐冲趁乱逃脱"
    ],
    "key_characters": [
      "char_yi_lin",
      "char_ling_hu_chong",
      "char_qu_fei_yan",
      "char_tian_bo_guang",
      "char_yu_cang_hai"
    ]
  },
  {
    "chapter": 6,
    "title": "第六回 洗手",
    "key_events": [
      "刘正风金盆洗手",
      "嵩山派阻挠屠杀刘家",
      "刘正风拒不受命",
      "正邪之辩展开"
    ],
    "key_characters": [
      "char_liu_zheng_feng",
      "char_fei_bin",
      "char_ding_yi",
      "char_qu_yang"
    ]
  },
  {
    "chapter": 7,
    "title": "第七回 授谱",
    "key_events": [
      "莫大先生杀费彬",
      "刘正风曲洋合奏笑傲江湖",
      "令狐冲思过崖面壁",
      "岳灵珊每日送饭"
    ],
    "key_characters": [
      "char_mo_da",
      "char_liu_zheng_feng",
      "char_qu_yang",
      "char_ling_hu_chong",
      "char_yue_ling_shan"
    ]
  },
  {
    "chapter": 8,
    "title": "第八回 面壁",
    "key_events": [
      "发现后洞石壁剑法",
      "魔教十长老骸骨",
      "令狐冲研习石壁剑法",
      "岳灵珊与林平之亲近"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_yue_ling_shan",
      "char_lin_ping_zhi"
    ]
  },
  {
    "chapter": 9,
    "title": "第九回 邀客",
    "key_events": [
      "岳不群考较令狐冲",
      "令狐冲内力全失",
      "田伯光上山邀客",
      "令狐冲与田伯光交手"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_yue_bu_qun",
      "char_tian_bo_guang"
    ]
  },
  {
    "chapter": 10,
    "title": "第十回 传剑",
    "key_events": [
      "风清扬现身传剑",
      "令狐冲领悟无招胜有招",
      "令狐冲击败田伯光",
      "风清扬嘱令保密"
    ],
    "key_characters": [
      "char_feng_qing_yang",
      "char_ling_hu_chong",
      "char_tian_bo_guang"
    ]
  },
  {
    "chapter": 11,
    "title": "第十一回 聚气",
    "key_events": [
      "封不平挑战华山派",
      "岳不群展示紫霞神功",
      "桃谷六仙现身",
      "成不忧被撕杀"
    ],
    "key_characters": [
      "char_feng_bu_ping",
      "char_yue_bu_qun",
      "char_ling_hu_chong"
    ]
  },
  {
    "chapter": 12,
    "title": "第十二回 围攻",
    "key_events": [
      "令狐冲击退封不平",
      "蒙面人围攻华山派",
      "令狐冲刺瞎敌人",
      "众人疑令狐冲私吞剑谱"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_yue_bu_qun",
      "char_feng_bu_ping"
    ]
  },
  {
    "chapter": 13,
    "title": "第十三回 学琴",
    "key_events": [
      "五霸冈群豪聚会",
      "令狐冲绿竹巷学琴",
      "任盈盈初登场",
      "令狐冲不知盈盈身份"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 14,
    "title": "第十四回 论杯",
    "key_events": [
      "令狐冲与盈盈论琴",
      "二人日渐投缘",
      "盈盈暗中相助",
      "群豪不敢为难令狐冲"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 15,
    "title": "第十五回 灌药",
    "key_events": [
      "令狐冲知盈盈身份",
      "平一指诊病束手",
      "令狐冲内伤日重",
      "群豪为令狐冲治病"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 16,
    "title": "第十六回 注血",
    "key_events": [
      "方生大师追杀盈盈",
      "令狐冲击退方生",
      "盈盈以内力为令狐冲续命",
      "二人感情渐深"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying",
      "char_fang_sheng"
    ]
  },
  {
    "chapter": 17,
    "title": "第十七回 倾心",
    "key_events": [
      "令狐冲与盈盈感情日深",
      "盈盈倾诉身世",
      "令狐冲内伤发作",
      "二人五霸冈分别"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 18,
    "title": "第十八回 联手",
    "key_events": [
      "向问天现身",
      "令狐冲与向问天联手",
      "二人前往梅庄",
      "梅庄救任我行计划"
    ],
    "key_characters": [
      "char_xiang_wen_tian",
      "char_ling_hu_chong"
    ]
  },
  {
    "chapter": 19,
    "title": "第十九回 打赌",
    "key_events": [
      "到达梅庄",
      "以宝物引诱四友",
      "黄钟公论琴",
      "比剑赌约设下"
    ],
    "key_characters": [
      "char_xiang_wen_tian",
      "char_ling_hu_chong",
      "char_huang_zhong_gong"
    ]
  },
  {
    "chapter": 20,
    "title": "第二十回 入狱",
    "key_events": [
      "令狐冲与黄钟公比剑",
      "令狐冲入地牢",
      "发现任我行已离去",
      "令狐冲被困地牢"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_wo_xing",
      "char_huang_zhong_gong"
    ]
  },
  {
    "chapter": 21,
    "title": "第二十一回 囚居",
    "key_events": [
      "令狐冲被困地牢",
      "黑白子送饭",
      "令狐冲修习吸星大法",
      "吸取黑白子内力"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_hei_bai_zi"
    ]
  },
  {
    "chapter": 22,
    "title": "第二十二回 脱困",
    "key_events": [
      "令狐冲逃出地牢",
      "梅庄四友发现真相",
      "任我行现身",
      "令狐冲与任我行会合"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_wo_xing",
      "char_xiang_wen_tian"
    ]
  },
  {
    "chapter": 23,
    "title": "第二十三回 伏击",
    "key_events": [
      "令狐冲救恒山派弟子",
      "内力大增",
      "击退敌人",
      "恒山弟子感恩"
    ],
    "key_characters": [
      "char_ling_hu_chong"
    ]
  },
  {
    "chapter": 24,
    "title": "第二十四回 蒙冤",
    "key_events": [
      "令狐冲被疑偷学剑谱",
      "岳灵珊疏远",
      "令狐冲百口莫辩",
      "决心查明真相"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_yue_ling_shan",
      "char_yue_bu_qun",
      "char_lin_ping_zhi"
    ]
  },
  {
    "chapter": 25,
    "title": "第二十五回 闻讯",
    "key_events": [
      "莫大先生传讯",
      "定闲定逸遇害",
      "恒山派群龙无首",
      "方证传易筋经"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_mo_da",
      "char_fang_zheng"
    ]
  },
  {
    "chapter": 26,
    "title": "第二十六回 围寺",
    "key_events": [
      "群豪围攻少林寺",
      "令狐冲率众前往",
      "盈盈已被救出",
      "令狐冲与盈盈重逢"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying",
      "char_fang_zheng"
    ]
  },
  {
    "chapter": 27,
    "title": "第二十七回 三战",
    "key_events": [
      "任我行三战群雄",
      "力战方证大师",
      "令狐冲参战",
      "任我行突围离去"
    ],
    "key_characters": [
      "char_ren_wo_xing",
      "char_fang_zheng",
      "char_zuo_leng_chan",
      "char_ling_hu_chong",
      "char_xiang_wen_tian"
    ]
  },
  {
    "chapter": 28,
    "title": "第二十八回 积雪",
    "key_events": [
      "令狐冲独行思念盈盈",
      "偶遇岳灵珊林平之",
      "心中酸楚",
      "华山派矛盾日深"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_yue_ling_shan",
      "char_lin_ping_zhi",
      "char_yue_bu_qun"
    ]
  },
  {
    "chapter": 29,
    "title": "第二十九回 掌门",
    "key_events": [
      "令狐冲接任恒山掌门",
      "江湖哗然",
      "方证冲虚前来",
      "商议对抗并派"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_fang_zheng",
      "char_chong_xu"
    ]
  },
  {
    "chapter": 30,
    "title": "第三十回 密议",
    "key_events": [
      "方证冲虚密议",
      "分析左冷禅野心",
      "商定阻止并派",
      "令狐冲赴嵩山之会"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_fang_zheng",
      "char_chong_xu",
      "char_zuo_leng_chan"
    ]
  },
  {
    "chapter": 31,
    "title": "第三十一回 绣花",
    "key_events": [
      "攻上黑木崖",
      "大战东方不败",
      "东方不败以一敌四",
      "东方不败被杀"
    ],
    "key_characters": [
      "char_ren_wo_xing",
      "char_ling_hu_chong",
      "char_dong_fang_bu_bai",
      "char_xiang_wen_tian",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 32,
    "title": "第三十二回 并派",
    "key_events": [
      "嵩山封禅台大会",
      "左冷禅力主并派",
      "天门道人反对",
      "令狐冲率恒山派到场"
    ],
    "key_characters": [
      "char_zuo_leng_chan",
      "char_ling_hu_chong",
      "char_tian_men"
    ]
  },
  {
    "chapter": 33,
    "title": "第三十三回 比剑",
    "key_events": [
      "岳灵珊挑战群雄",
      "令狐冲故意落败",
      "桃谷六仙搅局",
      "比剑夺帅"
    ],
    "key_characters": [
      "char_yue_ling_shan",
      "char_ling_hu_chong",
      "char_ren_ying_ying",
      "char_zuo_leng_chan"
    ]
  },
  {
    "chapter": 34,
    "title": "第三十四回 夺帅",
    "key_events": [
      "岳不群与左冷禅比剑",
      "岳不群以辟邪剑法胜出",
      "夺得五岳派掌门",
      "左冷禅大败"
    ],
    "key_characters": [
      "char_yue_bu_qun",
      "char_zuo_leng_chan",
      "char_ling_hu_chong"
    ]
  },
  {
    "chapter": 35,
    "title": "第三十五回 复仇",
    "key_events": [
      "林平之追杀余沧海",
      "林平之辟邪剑法展示",
      "揭露岳不群真相",
      "岳灵珊痛苦"
    ],
    "key_characters": [
      "char_lin_ping_zhi",
      "char_yu_cang_hai",
      "char_yue_ling_shan",
      "char_yue_bu_qun"
    ]
  },
  {
    "chapter": 36,
    "title": "第三十六回 伤逝",
    "key_events": [
      "林平之杀死岳灵珊",
      "令狐冲悲痛欲绝",
      "盈盈安慰令狐冲",
      "翠谷守坟"
    ],
    "key_characters": [
      "char_lin_ping_zhi",
      "char_yue_ling_shan",
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 37,
    "title": "第三十七回 迫娶",
    "key_events": [
      "任我行迫令狐冲加盟",
      "令狐冲拒绝",
      "任我行大怒",
      "威胁攻恒山"
    ],
    "key_characters": [
      "char_ren_wo_xing",
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 38,
    "title": "第三十八回 聚歼",
    "key_events": [
      "岳不群假传黑木令",
      "围攻恒山派",
      "令狐冲击退敌人",
      "揭露岳不群服毒"
    ],
    "key_characters": [
      "char_yue_bu_qun",
      "char_ling_hu_chong",
      "char_ren_ying_ying"
    ]
  },
  {
    "chapter": 39,
    "title": "第三十九回 拒盟",
    "key_events": [
      "任我行攻上朝阳峰",
      "令狐冲拒绝加盟",
      "风清扬暗中相助",
      "任我行暴毙"
    ],
    "key_characters": [
      "char_ren_wo_xing",
      "char_ling_hu_chong",
      "char_ren_ying_ying",
      "char_xiang_wen_tian"
    ]
  },
  {
    "chapter": 40,
    "title": "第四十回 曲谐",
    "key_events": [
      "各派高手齐聚恒山",
      "任我行暴毙危机化解",
      "令狐冲盈盈终成眷属",
      "琴箫合奏笑傲江湖"
    ],
    "key_characters": [
      "char_ling_hu_chong",
      "char_ren_ying_ying",
      "char_fang_zheng",
      "char_chong_xu"
    ]
  }
]

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
