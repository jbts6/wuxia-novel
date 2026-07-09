# Pass 1 — 实体骨架生成 prompt（射雕英雄传）

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸、古龙、梁羽生、黄易四大家的作品。你已经熟读本书（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

## 输入

1. `manifest.json`：章节清单（章节号、标题、起止行号、字数）。
2. `mention_summary.json`：高频实体提及汇总（从 mention_index.jsonl 聚合）。
3. `outline.json`（可选）：实体清单大纲（Phase 1.5 生成），包含 characters、factions、locations、skills 的骨架清单。
4. 原文（已注入上下文）。

## 输出

5 个 JSON 文件，严格按照 `schemas.md` 和 `constants.md` 的 schema、ID 规则、枚举值：

- `characters.json`：所有有名有姓、有情节作用的角色。重要性=龙套/背景的角色可以省略 relationships，但其他字段必填。
- `factions.json`：所有门派、帮派、家族、军队、王族、寺院等组织。
- `locations.json`：所有有情节意义的地点。
- `skills.json`：所有被命名的**武学体系**（内功、轻功、剑法、掌法、刀法、鞭法等）。**不包含武器/道具**（铁鞭、峨嵋刺、流星锤、弹弓等应放入 items.json）。
- `techniques.json`：仅当招式跨多个 skill 或被多人使用时才独立列出。

### skills.json 与 items.json 的区分（重要！）

**skills.json 只收录武学体系**，包括：
- 内功（如：混元气、北冥神功、九阳神功）
- 掌法（如：降龙十八掌、震天三十掌）
- 剑法（如：独孤九剑、太极剑法）
- 刀法（如：夫妻刀法、胡家刀法）
- 鞭法（如：呼延十八鞭）
- 轻功（如：凌波微步）
- 指法（如：一阳指、六脉神剑）

**items.json 收录武器/道具**，包括：
- 兵器（如：铁鞭、峨嵋刺、流星锤、鸳鸯刀）
- 暗器（如：弹弓、飞镖、银针）
- 日常物品（如：旱烟管、墓碑）
- 信物（如：金钗、翡翠狮子）

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"放 items。

## 叙事风格参考

本书叙事风格特点：
- **典雅白话**：文白夹杂，对话用口语白话，叙述用典雅文言
- **历史厚重**：大量引用南宋、金、蒙古真实历史事件（靖康之耻、岳飞抗金等）
- **武功描写细腻**：每场打斗都有具体的招式名称和动作描写
- **对话生动**：角色性格通过对话鲜明体现（郭靖的憨厚、黄蓉的机敏、洪七公的豪爽）
- **诗词穿插**：间或引用或自创诗词，增添文采

## 关键事件时间线

| 章节 | 关键事件 |
|------|---------|
| ch1 | 牛家村：郭啸天、杨铁心结义，丘处机来访，段天德血洗牛家村 |
| ch2 | 丘处机与江南七怪打赌，各寻郭杨后人 |
| ch3 | 蒙古大漠：郭靖成长，铁木真收为义子，哲别授箭术 |
| ch4 | 梅超风现身蒙古，郭靖初遇黄蓉（乞丐装） |
| ch5-6 | 蒙古：郭靖与华筝订婚，拖雷结义 |
| ch7 | 张家口：郭靖初遇黄蓉（女装），赠马赠金 |
| ch8 | 中都赵王府：完颜洪烈府中群雄会，欧阳克登场 |
| ch9-10 | 比武招亲：杨康vs穆念慈，梅超风大闹赵王府 |
| ch11 | 嘉兴烟雨楼：丘处机vs江南七怪比武之约 |
| ch12 | 洪七公登场，黄蓉以美食换降龙十八掌 |
| ch13 | 归云庄：裘千丈骗局，陆冠英婚礼 |
| ch14 | 桃花岛：黄药师考验郭靖，周伯通被困洞中 |
| ch15 | 比武招亲：欧阳克vs郭靖争黄蓉 |
| ch16 | 周伯通授双手互搏、空明拳，九阴真经重现 |
| ch17 | 桃花岛：黄药师追杀郭靖，周伯通逃离 |
| ch18 | 大海遇险：欧阳锋、洪七公海上大战 |
| ch19 | 荒岛：欧阳克被困，黄蓉智斗欧阳锋 |
| ch20 | 假九阴真经：欧阳锋骗走假经书 |
| ch21 | 岳州丐帮大会：黄蓉接任丐帮帮主 |
| ch22 | 铁掌山：裘千仞暗算洪七公 |
| ch23-24 | 大理段王府：一灯大师疗伤，瑛姑恩怨 |
| ch25 | 嘉兴烟雨楼：杨康弑师（欧阳克），完颜洪烈阴谋 |
| ch26 | 黄药师追杀周伯通，梅超风护师 |
| ch27-28 | 杨康认贼作父，穆念慈悲情 |
| ch29 | 蒙古西征：郭靖随军，黄蓉同行 |
| ch30-31 | 花剌子模：郭靖攻城，欧阳锋暗中作梗 |
| ch32 | 铁木真逼婚：华筝vs黄蓉 |
| ch33 | 柯镇恶误会郭靖，江南七怪惨死 |
| ch34 | 黄药师大怒：追杀郭靖为女报仇 |
| ch35 | 杨康之死：铁枪庙中蛇毒身亡 |
| ch36 | 蒙古南侵：郭靖辞别铁木真，守卫襄阳 |
| ch37 | 襄阳城下：郭靖与蒙古军对峙 |
| ch38 | 华山论剑前夕：群雄汇聚 |
| ch39 | 华山论剑：五绝重排，欧阳锋疯癫 |
| ch40 | 大结局：郭靖黄蓉携手，杨过出生 |

## source_ref 锚定策略

### anchor 描述规范

本书 source_ref 的 anchor 必须遵循以下格式：
- 包含至少 2 个实体关键词（人名/地名/武功/事件词）
- 使用本书特有的名称，不要用泛称
- 示例：
  - 对：`郭靖张家口初遇黄蓉，赠貂裘红马`
  - 错：`主角遇到女主角`
  - 对：`洪七公教郭靖降龙十八掌`
  - 错：`师父教徒弟武功`

### event_type 分配

- `first_mention`：角色/地点/功法的首次登场
  - 示例：ch1 `丘处机牛家村初遇郭啸天杨铁心`（丘处机首次登场）
  - 示例：ch7 `郭靖张家口遇黄蓉乞丐装`（黄蓉首次登场）
- `climax`：关键冲突/转折点
  - 示例：ch21 `岳州丐帮大会黄蓉接任帮主`（黄蓉身份转折）
  - 示例：ch35 `铁枪庙杨康中蛇毒身亡`（杨康结局）
- `resolution`：收尾/结局
  - 示例：ch40 `华山论剑五绝重排，欧阳锋疯癫`
- `background`：背景介绍、日常描写
  - 示例：ch3 `郭靖蒙古草原学箭射雕`（成长背景）

### 章节分布参考

根据 mention_summary，主要角色的高频章节：
- 郭靖：全书高频，ch5-7、ch16、ch29、ch34、ch37-38 最高
- 黄蓉：ch7起，ch12、ch21、ch23、ch28-32 最高
- 欧阳锋：ch18-22、ch35-38 最高
- 洪七公：ch12、ch20-22 最高
- 黄药师：ch18-19、ch25-26、ch34 最高
- 周伯通：ch16-17、ch19、ch22-23 最高

## ID 命名示例

### 角色 ID

- `char_guo_jing`：郭靖
- `char_huang_rong`：黄蓉
- `char_ou_yang_feng`：欧阳锋
- `char_hong_qi_gong`：洪七公
- `char_huang_yao_shi`：黄药师
- `char_zhou_bo_tong`：周伯通
- `char_ou_yang_ke`：欧阳克
- `char_qiu_chu_ji`：丘处机
- `char_mei_chao_feng`：梅超风
- `char_yang_kang`：杨康
- `char_ke_zhen_e`：柯镇恶
- `char_qiu_qian_ren`：裘千仞
- `char_zhu_cong`：朱聪
- `char_wan_yan_hong_lie`：完颜洪烈
- `char_tie_mu_zhen`：铁木真
- `char_mu_nian_ci`：穆念慈
- `char_yi_deng`：一灯大师（段智兴）
- `char_hua_zheng`：华筝

### 门派 ID

- `faction_gai_bang`：丐帮
- `faction_quan_zhen_jiao`：全真教
- `faction_tao_hua_dao`：桃花岛
- `faction_bai_tuo_shan`：白驼山
- `faction_tie_zhang_bang`：铁掌帮
- `faction_jiang_nan_qi_guai`：江南七怪
- `faction_jin_guo`：金国
- `faction_meng_gu`：蒙古
- `faction_da_li`：大理

### 地点 ID

- `loc_niu_jia_cun`：牛家村
- `loc_jia_xing`：嘉兴
- `loc_da_mo`：大漠
- `loc_tao_hua_dao`：桃花岛
- `loc_yue_zhou`：岳州
- `loc_lin_an`：临安
- `loc_zhong_du`：中都
- `loc_tie_zhang_shan`：铁掌山
- `loc_da_li`：大理
- `loc_zhong_nan_shan`：终南山

### 功法 ID

- `skill_xiang_long_shi_ba_zhang`：降龙十八掌
- `skill_da_gou_bang_fa`：打狗棒法
- `skill_ha_ma_gong`：蛤蟆功
- `skill_tan_zhi_shen_tong`：弹指神通
- `skill_bi_hai_chao_sheng_qu`：碧海潮生曲
- `skill_jiu_yin_zhen_jing`：九阴真经
- `skill_kong_ming_quan`：空明拳
- `skill_shuang_shou_hu_bo`：双手互搏
- `skill_yi_yang_zhi`：一阳指
- `skill_xian_tian_gong`：先天功
- `skill_tie_sha_zhang`：铁砂掌
- `skill_pi_kong_zhang`：劈空掌
- `skill_luo_ying_shen_jian_zhang`：落英神剑掌
- `skill_yu_xiao_jian_fa`：玉箫剑法
- `skill_lan_hua_fu_xue_shou`：兰花拂穴手
- `skill_xiao_yao_you`：逍遥游
- `skill_fu_mo_zhang_fa`：伏魔杖法
- `skill_quan_zhen_jian_fa`：全真剑法
- `skill_jin_yan_gong`：金雁功
- `skill_tian_gang_bei_dou_zhen`：天罡北斗阵

## 已知陷阱

### 容易遗漏的角色

1. **张十五**：ch1 说书人，引出时代背景，虽是龙套但意义重大
2. **焦木和尚**：ch2 嘉兴法华寺住持，江南七怪友人
3. **段天德**：ch1 杀害郭啸天的军官，重要反派
4. **曲灵风**：ch10 黄药师大弟子，已死但通过遗物推动剧情
5. **陆乘风**：ch13 归云庄主，黄药师弟子
6. **陆冠英**：ch13 陆乘风之子，归云庄少主
7. **瑛姑**：ch23 大理段王府，与周伯通有私情
8. **傻姑**：ch10 曲灵风之女，智力障碍
9. **完颜洪烈手下**：彭连虎、梁子翁、沙通天、灵智上人等赵王府高手
10. **哲别**：ch3 蒙古箭术高手，郭靖师父

### 容易遗漏的功法

1. **逍遥游**：洪七公早期轻功
2. **伏魔杖法**：柯镇恶杖法
3. **全真剑法**：全真七子共用
4. **金雁功**：全真教轻功
5. **天罡北斗阵**：全真七子合阵
6. **劈空掌**：黄药师掌法
7. **落英神剑掌**：黄药师掌法
8. **玉箫剑法**：黄药师剑法
9. **兰花拂穴手**：黄药师点穴

### 容易搞错的关系

1. **杨康的养父/生父**：完颜洪烈是养父，杨铁心是生父
2. **欧阳克的真实身份**：名义上是欧阳锋之侄，实际是私生子
3. **黄蓉的母亲**：冯氏（冯蘅），已故，默写九阴真经
4. **周伯通与段智兴**：周伯通与瑛姑私通，段智兴因此出家为一灯大师
5. **梅超风的师父**：黄药师（桃花岛），但她是叛徒
6. **陈玄风与梅超风**：夫妻，黑风双煞，偷走九阴真经叛出桃花岛
7. **裘千仞与裘千丈**：孪生兄弟，裘千仞武功高强，裘千丈是骗子

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**（如"主角初遇某角色"、"某门派首次出现"）
  - `climax`：事件的**高潮/关键冲突**（如"大战某高手"、"揭秘身世之谜"、"比武招亲"）
  - `resolution`：事件的**收尾/结局**（如"最终决战"、"定情/分离"、"角色收场"）
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 大致正确（事件发生的章节之一）；(2) `anchor` 包含至少 2 个实体关键词（人名 / 地名 / 武功 / 事件词）；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 5 条分散在不同章节，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系类型和动态。
- 禁止同一对角色出现多条冲突记录（如既"患难同行"又"恋人"又"亲属"）。选最具代表性的一条。
- 如果关系在全书中有显著转折（如从恋人变宿敌），在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
  - 对：`憨厚少年，蒙古长大，后习得降龙十八掌，成为一代大侠`
  - 错：`在第3章被铁木真收为义子`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`靖哥哥`、`蓉儿`、`老叫化`（具体称呼）
  - 错：`青衫年轻男子`、`X姓青年`、`那少年`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_gai_bang`），**不能**使用名称（如"丐帮"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_xiang_long_shi_ba_zhang`），**不能**使用名称（如"降龙十八掌"）。
- **禁止引用 skills.json 中不存在的 skill ID**。如果某 skill 不在 skills.json 中，先在 skills.json 中添加该 skill，再在 characters.json 中引用。

**items.owner / related_characters / related_skills**：
- `owner` 可以是 `characters.json` 中的 `id`（人物拥有），也可以是 `factions.json` 中的 `id`（门派拥有）。不能使用名称。
- `related_characters` 必须使用 `characters.json` 中的 `id`。
- `related_skills` 必须使用 `skills.json` 中的 `id`。

**dialogues.speaker / listener**：
- 必须使用 `characters.json` 中的 `id`，不能使用名称。

**生成顺序建议**：
1. 先生成 `factions.json` 和 `skills.json`（它们是基础数据）
2. 再生成 `characters.json`（引用 factions 和 skills 的 ID）
3. 最后生成 `locations.json` 和 `techniques.json`

### ID 与枚举

- ID 严格按 `constants.md` 的 ID 规则：小写拼音 + 下划线，逐字拆分音节。
- 所有枚举值（rank、type、role、tone 等）必须来自 `constants.md` 的合法值列表。

## 工作流

1. 先通读 `manifest.json` 和 `mention_summary.json`，建立全书结构感。
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details（relationships、personality、source_refs 等）。LLM 不再需要同时决定"列谁"和"细节是什么"，注意力更聚焦。
3. **如果 `outline.json` 不存在**：在脑中/草稿里列出主要角色、门派、地点、功法的清单。
4. **按以下顺序生成**（重要！确保 ID 引用正确）：
   - **第一步**：生成 `factions.json`（门派）和 `skills.json`（功法）—— 这是基础数据
   - **第二步**：生成 `characters.json`（角色）—— 引用 factions 和 skills 的 ID
   - **第三步**：生成 `locations.json`（地点）和 `techniques.json`（招式）
5. 按重要性从高到低生成实体：核心 → 重要 → 次要 → 龙套 → 背景。
6. 写完一个实体，立刻回查原文确认 source_refs 的真实性。
7. **最后检查**：
   - 关系图无冲突、ID 无重复、枚举值合法、所有字段非空
   - **ID 引用一致性**：characters.faction 必须是 factions.json 中的 ID，characters.known_skills 必须是 skills.json 中的 ID
   - **禁止使用名称代替 ID**：如"丐帮"应为 `faction_gai_bang`，"降龙十八掌"应为 `skill_xiang_long_shi_ba_zhang`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
