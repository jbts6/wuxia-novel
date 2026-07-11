# Phase 1.6 — 《神雕侠侣》实体骨架生成 prompt（Pass 1）

## 角色

你是一位精通**金庸《神雕侠侣》**的武侠小说研究者兼数据库工程师。你已经熟读本书全文，现在需要基于原文写一份完整、准确、无冲突的设定库。

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
- `skills.json`：所有被命名的**武学体系**（内功、轻功、剑法、掌法、刀法、鞭法等）。**不包含武器/道具**（玄铁重剑、君子剑、淑女剑等应放入 items.json）。
- `techniques.json`：仅当招式跨多个 skill 或被多人使用时才独立列出。

### skills.json 与 items.json 的区分（重要！）

**skills.json 只收录武学体系**，包括：
- 内功（如：九阴真经、玉女心经）
- 掌法（如：降龙十八掌、黯然销魂掌）
- 剑法（如：玄铁剑法、玉女素心剑法）
- 刀法（如：阴阳倒乱刃法）
- 鞭法（如：银鞭法）
- 轻功（如：天罗地网势）
- 指法（如：一阳指、弹指神通）

**items.json 收录武器/道具**，包括：
- 兵器（如：玄铁重剑、君子剑、淑女剑、打狗棒）
- 暗器（如：玉蜂金针、冰魄银针）
- 丹药/毒药（如：绝情丹、断肠草、情花毒）
- 信物（如：金针、面具、红花绿叶锦帕）
- 日常物品（如：墓碑、石棺）

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"，放 items。

## 本书叙事风格描述

**金庸典雅白话**：文白相间，叙事细腻，心理描写深入。对话文雅含蓄，符合南宋语言特色。常引用诗词（如开篇引欧阳修〈蝶恋花〉、「问世间，情是何物」），以景衬情。叙述视角以第三人称全知为主，兼取杨过等角色的限知视角。

**关键特征**：
- 以「情」为核心主题，贯穿全书——杨过与小龙女的师徒禁恋、李莫愁因情生恨、武三通痴恋何沅君、公孙止的虚伪情欲
- 心理描写细腻，尤其杨过与小龙女的情感变化，常借内心独白推动情节
- 诗词引用频繁，借古咏今（欧阳修词、元好问词等）
- 战斗场面注重招式描写，虚实结合，以武写人
- 开篇以嘉兴南湖采莲少女引入，以景入情，层次分明
- 时代背景为南宋理宗年间，蒙古南侵，家国情怀与儿女情长交织

## 关键事件时间线（40 回）

**前期（ch1-10）：杨过身世与学艺**
- ch1（风月无情）：嘉兴南湖，武三通挖坟盗尸，李莫愁复仇陆家庄，柯镇恶出场，程英与陆无双幼年
- ch2（故人之子）：李莫愁追杀陆家庄后人，武三通与李莫愁交手，郭芙携双雕出场
- ch3-4（投师终南）：杨过出场（嘉兴孤儿），郭靖收养，送入全真教
- ch5-8：杨过逃离全真教，入古墓派，拜小龙女为师
- ch9-10：古墓派学艺，杨过与小龙女初建感情

**中期（ch11-25）：江湖历练与情感考验**
- ch11-15：杨过与小龙女出古墓行走江湖，师徒恋情遭世俗反对
- ch16-18：英雄大会（大胜关），杨过初显身手，郭芙斩断杨过右臂
- ch17-20：绝情谷事件开始，杨过中情花毒，小龙女受重伤
- ch19-21：杨过断臂后遇神雕，习得玄铁剑法
- ch20（侠之大者）：杨过与公孙止在绝情谷对决，裘千尺指点破招
- ch22-25：绝情谷事件继续，公孙止阴谋，小龙女伤重

**后期（ch26-35）：分离与重逢**
- ch26-29：杨过习得玄铁剑法，成为「神雕大侠」，行侠仗义
- ch30：小龙女跳绝情谷底，杨过苦等十六年
- ch31-32：十六年间杨过行侠仗义，成为江湖传奇
- ch33-35：杨过请周伯通与瑛姑团聚，万兽山庄聚会，郭襄初遇杨过，三枚金针

**终章（ch36-40）：襄阳大战与华山论剑**
- ch36-38（大战襄阳）：襄阳英雄大宴，蒙古大军逼近，郭靖黄蓉守城
- ch39：杨过飞石击毙蒙哥汗，解襄阳之围
- ch40（华山之巅）：蒙古退军后群雄上华山，第三次华山论剑，新五绝：东邪（黄药师）、西狂（杨过）、南僧（一灯）、北侠（郭靖）、中顽童（周伯通），觉远携少年张君宝出场，潇湘子尹克西被擒

## source_ref 锚定策略

**first_mention（首次登场）**：
- 角色第一次出场的章节
- 例：杨过 ch3，小龙女 ch5，李莫愁 ch1，郭襄 ch33，觉远 ch40

**climax（高潮事件）**：
- 角色的决定性时刻
- 例：杨过断臂 ch18，小龙女跳谷 ch30，杨过飞石击毙蒙哥汗 ch39，杨过与公孙止绝情谷对决 ch20

**resolution（结局）**：
- 角色的最终归宿
- 例：杨过与小龙女重逢 ch30，华山论剑获封西狂 ch40，李莫愁葬身火海

**background（背景信息）**：
- 角色的身世、过往
- 例：杨康往事（追溯性提及），林朝英与王重阳（古墓派历史），独孤求败（玄铁重剑来历）

## ID 命名示例

**角色 ID**：
- `char_yang_guo`（杨过）
- `char_xiao_long_nv`（小龙女）
- `char_guo_jing`（郭靖）
- `char_huang_rong`（黄蓉）
- `char_li_mo_chou`（李莫愁）
- `char_guo_fu`（郭芙）
- `char_guo_xiang`（郭襄）
- `char_jin_lun_fa_wang`（金轮法王）
- `char_zhou_bo_tong`（周伯通）
- `char_yi_deng`（一灯大师）
- `char_huang_yao_shi`（黄药师）
- `char_gong_sun_zhi`（公孙止）
- `char_qiu_qian_chi`（裘千尺）
- `char_cheng_ying`（程英）
- `char_lu_wu_shuang`（陆无双）
- `char_ye_lv_qi`（耶律齐）
- `char_wan_yan_ping`（完颜萍）
- `char_ke_zhen_e`（柯镇恶）
- `char_wu_san_tong`（武三通）
- `char_jue_yuan`（觉远）
- `char_zhang_jun_bao`（张君宝）

**门派 ID**：
- `fac_quan_zhen`（全真教）
- `fac_gu_mu`（古墓派）
- `fac_gai_bang`（丐帮）
- `fac_da_li_duan_shi`（大理段氏）
- `fac_shao_lin`（少林寺）
- `fac_jue_qing_gu`（绝情谷）
- `fac_tao_hua_dao`（桃花岛）

**地点 ID**：
- `loc_xiang_yang`（襄阳）
- `loc_jue_qing_gu`（绝情谷）
- `loc_gu_mu`（古墓/活死人墓）
- `loc_tao_hua_dao`（桃花岛）
- `loc_hua_shan`（华山）
- `loc_zhong_nan_shan`（终南山）
- `loc_feng_ling_du`（风陵渡）
- `loc_jia_xing`（嘉兴）
- `loc_da_sheng_guan`（大胜关）

**武功 ID**：
- `skill_an_ran_xiao_hun_zhang`（黯然销魂掌）
- `skill_xuan_tie_jian_fa`（玄铁剑法）
- `skill_yu_nv_xin_jing`（玉女心经）
- `skill_yu_nv_su_xin_jian_fa`（玉女素心剑法）
- `skill_jiu_yin_zhen_jing`（九阴真经）
- `skill_xiang_long_shi_ba_zhang`（降龙十八掌）
- `skill_yi_yang_zhi`（一阳指）
- `skill_ha_ma_gong`（蛤蟆功）
- `skill_tan_zhi_shen_tong`（弹指神通）
- `skill_zuo_you_hu_bo`（左右互搏术）
- `skill_da_gou_bang_fa`（打狗棒法）
- `skill_tian_luo_di_wang_shi`（天罗地网势）
- `skill_yin_yang_dao_rean_re_fa`（阴阳倒乱刃法）

## 已知陷阱

### 本书容易被遗漏的角色
- **郭襄**：出场较晚（ch33），但对杨过的感情是重要支线，后创峨嵋派
- **耶律齐**：出场较晚，但成为丐帮帮主，郭芙之夫
- **完颜萍**：暗恋杨过，容易被忽略
- **武三通**：前期出场（ch1-2），因痴恋何沅君而疯癫，但后期戏份减少
- **张君宝**：仅在 ch40 出场，但是《倚天屠龙记》张三丰的少年时代
- **觉远**：仅在 ch40 出场，少林寺藏经阁僧人，身负绝世武功
- **裘千尺**：公孙止元配，被困绝情谷底多年，后期出场但对情节有关键作用

### 本书容易被忽略的功法
- **玉女心经**：古墓派内功，杨过与小龙女合练
- **玉女素心剑法**：古墓派剑法，双剑合璧
- **天罗地网势**：古墓派轻功
- **美女拳法**：古墓派拳法
- **蛤蟆功**：欧阳锋所传，杨过所学
- **打狗棒法**：丐帮绝学
- **阴阳倒乱刃法**：公孙止的独门刀剑技法

### 本书关系图常见的错误模式
- **杨过与小龙女**：师徒 → 恋人 → 夫妻，关系有明确转折，dynamic 中应概述
- **杨过与郭芙**：青梅竹马 → 仇人（断臂之仇）→ 和解，不要只写其中一段
- **杨过与郭襄**：一见钟情（郭襄单方面），但杨过只爱小龙女，是单向关系
- **李莫愁与陆展元**：单恋 → 仇恨，不要误写为恋人关系（陆展元爱的是何沅君）
- **公孙止与裘千尺**：夫妻反目，不要误写为单纯仇人（有复杂的恩怨纠葛）
- **周伯通与瑛姑**：旧情人，周伯通逃避，瑛姑苦等

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
- 如果关系在全书中有显著转折（如从师徒变恋人），在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
  - 对：`杨过之妻，古墓派传人，冰清玉洁，十六年后与杨过重逢`
  - 错：`在第32回跳下绝情谷底`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`过儿`、`龙儿`、`杨大哥`、`神雕大侠`、`赤练仙子`（具体称呼）
  - 错：`那少年`、`白衣女子`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `fac_gu_mu`），**不能**使用名称（如"古墓派"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_an_ran_xiao_hun_zhang`），**不能**使用名称（如"黯然销魂掌"）。
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
   - **禁止使用名称代替 ID**：如"古墓派"应为 `fac_gu_mu`，"黯然销魂掌"应为 `skill_an_ran_xiao_hun_zhang`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
