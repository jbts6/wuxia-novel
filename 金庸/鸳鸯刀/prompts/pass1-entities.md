# Pass 1 — 实体骨架生成 prompt（《鸳鸯刀》专属）

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸作品。你已经熟读《鸳鸯刀》全文，现在需要基于原文写一份完整、准确、无冲突的设定库。

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

## 本书叙事风格描述

《鸳鸯刀》是金庸短篇武侠小说，语言风格具有以下特征：
- **诙谐幽默**：全书充满喜剧色彩，太岳四侠的滑稽行为贯穿始终
- **俗语贯穿**：周威信频繁引用"江湖上有言道"的俗语，增添民间色彩
- **典雅白话**：金庸标志性的半文半白叙述，对话生动自然
- **节奏明快**：全书仅一章，情节紧凑，无冗余描写
- **反讽手法**：太岳四侠自称"四侠"却武功平平，形成喜剧反差

## 关键事件时间线

全书仅 1 章（ch_001），但情节可分为以下几个段落：

1. **太岳四侠劫镖**（开篇）：松林中太岳四侠拦路，周威信智退
2. **林任夫妇追逐**：林玉龙与任飞燕夫妻打架，经过松林
3. **袁冠南遇太岳四侠**：书生袁冠南用智谋骗取四侠银两
4. **萧中慧出场**：少女骑马路过，太岳四侠企图劫马
5. **周威信被劫**：林任夫妇、萧中慧先后争夺鸳鸯刀，卓天雄现身夺刀
6. **袁冠南斗卓天雄**：袁冠南以毛笔墨盒为武器，假称五毒圣姑之侄吓退卓天雄
7. **紫竹庵避难**：众人在尼庵中躲避，林任夫妇教授袁萧二人夫妻刀法
8. **萧半和寿宴**：萧府寿宴上袁冠南与袁夫人母子相认，误以为萧中慧是亲妹
9. **官兵围剿**：清廷侍卫围攻萧府，萧义身份暴露
10. **中条山结局**：众人退守中条山，萧义揭示太监身世，太岳四侠擒获卓天雄，鸳鸯刀秘密揭晓"仁者无敌"

## source_ref 锚定策略

本书仅 1 章，所有 source_ref 的 `chapter` 均为 1。锚定策略如下：

- **first_mention**：角色/物品/功法首次在文中出现的位置
  - 例：周威信在开篇被描述为"陕西西安府威信镖局的总镖头"
  - 例：鸳鸯刀在川陕总督刘于义的话中首次提及
- **climax**：关键冲突/转折点
  - 例：卓天雄现身夺刀
  - 例：袁萧二人首次使出夫妻刀法
  - 例：寿宴上母子相认
- **resolution**：收尾/结局
  - 例：萧义揭示太监身世
  - 例：太岳四侠擒获卓天雄
  - 例：鸳鸯刀秘密"仁者无敌"揭晓
- **background**：背景介绍、日常对话
  - 例：太岳四侠的日常滑稽行为
  - 例：周威信心中的江湖俗语

## ID 命名示例

- `char_zhou_wei_xin` — 周威信
- `char_xiao_ban_he` — 萧半和
- `char_yuan_guan_nan` — 袁冠南
- `char_xiao_zhong_hui` — 萧中慧
- `char_zhuo_tian_xiong` — 卓天雄
- `char_xiao_yao_zi` — 逍遥子
- `char_gai_yi_ming` — 盖一鸣
- `char_lin_yu_long` — 林玉龙
- `char_ren_fei_yan` — 任飞燕
- `faction_wei_xin_biao_ju` — 威信镖局
- `faction_tai_yue_si_xia` — 太岳四侠
- `skill_hun_yuan_qi` — 混元气
- `skill_zhen_tian_san_shi_zhang` — 震天三十掌
- `skill_hu_yan_shi_ba_bian` — 呼延十八鞭
- `skill_fu_qi_dao_fa` — 夫妻刀法

## skills.json 与 items.json 分类指南（重要！）

### skills.json 只收录武学体系：
- 混元气（内功）— 萧半和的童子功，须童子身修炼
- 震天三十掌（掌法）— 卓天雄的成名掌法
- 呼延十八鞭（鞭法）— 卓天雄、周威信的鞭法，传世仅十七招
- 夫妻刀法（刀法）— 古代恩爱夫妻所创，需双人配合
- 弹弓术（暗器）— 任飞燕的弹弓技法

### items.json 收录武器/道具：
- 鸳鸯刀（兵器）— 一短一长，藏有"仁者无敌"秘密
- 铁鞭（兵器）— 周威信的兵器，十六斤重
- 峨嵋刺（兵器）— 盖一鸣的兵器
- 流星锤（兵器）— 花剑影的兵器
- 墓碑（临时兵器）— 常长风的"兵器"，顺手牵碑
- 旱烟管（物品/暗器）— 逍遥子的物品
- 弹弓（兵器）— 任飞燕的兵器
- 翡翠狮子（信物）— 袁冠南的寻母信物
- 玉斑指（信物）— 袁夫人给袁冠南的见面礼
- 沉香扇（物品）— 萧半和给袁冠南的见面礼

## 已知陷阱

- **角色遗漏**：太岳四侠的四个成员（逍遥子、常长风、花剑影、盖一鸣）容易被当作一个整体，需要分别列出
- **身份混淆**：萧半和与萧义是同一人（乔装改扮十六年），不要拆成两个角色；萧中慧与杨中慧是同一人，不要拆成两个角色
- **关系错误**：袁冠南与萧中慧最终确认非亲兄妹（萧义是太监，二人分属袁、杨两家），不要标为"兄妹"关系
- **功法忽略**：混元气（须童子身修炼，解释了萧半和为何能保有此功）、震天三十掌、呼延十八鞭（仅传十七招，最后一招"一鞭断十枪"需深厚内力）容易被忽略
- **物品混淆**：铁鞭、峨嵋刺、流星锤、墓碑、旱烟管、弹弓都是物品（items），不是功法（skills）
- **袁夫人 vs 杨夫人**：两位不同的夫人，分别是袁冠南和杨中慧的母亲，萧半和的"一妻一妾"实为掩护身份
- **鸳鸯刀真假**：萧中慧手中的短刃鸯刀是假的（否则不会折断），真正的鸯刀被卓天雄调包

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**
  - `climax`：事件的**高潮/关键冲突**
  - `resolution`：事件的**收尾/结局**
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 为 1（全书仅一章）；(2) `anchor` 包含至少 2 个实体关键词（人名 / 地名 / 武功 / 事件词）；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 3 条，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系类型和动态。
- 禁止同一对角色出现多条冲突记录。选最具代表性的一条。
- 如果关系在全书中有显著转折，在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
  - 对：`净身入宫刺杀皇帝的太监，化名萧半和，义救袁杨二夫人`
  - 错：`在寿宴上揭露身份`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`铁鞭镇八方`、`铁鞭拜八方`（具体称呼）
  - 错：`那个镖头`、`姓周的`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_wei_xin_biao_ju`），**不能**使用名称（如"威信镖局"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_hun_yuan_qi`），**不能**使用名称（如"混元气"）。
- **禁止引用 skills.json 中不存在的 skill ID**。

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
   - **禁止使用名称代替 ID**

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
