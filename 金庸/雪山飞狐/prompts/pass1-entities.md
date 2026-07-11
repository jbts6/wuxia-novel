# Pass 1 — 实体骨架生成 prompt（雪山飞狐专属）

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸作品，对《雪山飞狐》的叙事结构、人物关系和武学体系了然于胸。你已经熟读本书（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

## 本书叙事风格

- **典雅白话**：金庸典型的典雅白话风格，文言词汇自然融入
- **多声部叙事**：同一事件由不同角色讲述，版本各异，充满悬疑
- **第三人称全知视角**：叙述者对人物心理活动有深入描写
- **时代背景**：清朝乾隆四十五年（1780年），关外辽东地区
- **语言特色**：对话文雅，动作描写简洁有力，环境描写充满诗意

## 输入

1. `manifest.json`：章节清单（章节号、标题、起止行号、字数）。
2. `mention_summary.json`：高频实体提及汇总（从 mention_index.jsonl 聚合）。
3. `outline.json`（可选）：实体清单大纲（Phase 1.5 生成），包含 characters、factions、locations、skills 的骨架清单。
4. 原文（已注入上下文）。

## 输出

5 个 JSON 文件，严格按照 `schemas.md` 和 `constants.md` 的 schema、ID 规则、枚举值：

- `characters.json`：所有有名有姓、有情节作用的角色。重要性=龙套/背景的角色可以省略 relationships，但其他字段必填。
- `factions.json`：所有门派、帮派、家族等组织。本书以家族势力为主，注意区分家族与门派。
- `locations.json`：所有有情节意义的地点。注意本书地理跨度：辽东/关外、北京、雪山/玉笔峰等。
- `skills.json`：所有被命名的**武学体系**（内功、轻功、剑法、掌法、刀法等）。**不包含武器/道具**。
- `techniques.json`：仅当招式跨多个 skill 或被多人使用时才独立列出。

### skills.json 与 items.json 的区分（重要！）

**skills.json 只收录武学体系**，包括：
- 刀法（如：胡家刀法——本书核心武学）
- 剑法（如：苗家剑法——本书核心武学）
- 掌法（如：八卦掌）
- 内功、轻功等

**items.json 收录武器/道具**，包括：
- 兵器（如：胡家宝刀、苗家宝剑）
- 信物（如：凤头珠钗）
- 秘籍（如：胡家刀法图谱）

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"，放 items。

## 关键事件时间线

| 章节 | 事件 |
|------|------|
| ch1-2 | 天龙门众人追击陶子安，聚集玉笔峰 |
| ch3 | 宝树讲述胡一刀故事，苗若兰反驳 |
| ch4 | 独臂仆人（平阿四）讲述真相 |
| ch5-6 | 宝树讲述胡一刀与苗人凤比武经过 |
| ch7-8 | 胡斐上峰，与苗若兰相遇 |
| ch9 | 胡斐与苗若兰定情 |
| ch10 | 胡斐与苗人凤决战 |

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**（如"胡斐首次出现在商家堡"、"天龙门首次被提及"）
  - `climax`：事件的**高潮/关键冲突**（如"胡一刀与苗人凤比武"、"揭秘胡斐身世"）
  - `resolution`：事件的**收尾/结局**（如"最终对决"、"恩怨了结"）
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 大致正确（事件发生的章节之一）；(2) `anchor` 包含至少 2 个实体关键词（人名 / 地名 / 武功 / 事件词）；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 5 条分散在不同章节，覆盖 first_mention / climax / resolution。

**本书特别注意**：
- 胡一刀、苗人凤等角色主要出现在回忆叙事中，source_refs 应标注回忆发生的章节（如第4章讲述胡一刀往事），而非"回忆中的时间"
- 多视角叙事意味着同一事件可能被多人提及，选择最具代表性的章节

**source_ref 锚定策略**：
- **first_mention**：角色首次登场（如曹云奇 ch1、胡斐 ch2、苗若兰 ch3）
- **climax**：关键冲突/比武/揭秘（如胡一刀死因真相、胡斐苗人凤决战）
- **resolution**：事件收尾/定情/结局
- **background**：背景介绍、门派历史

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系类型和动态。
- 禁止同一对角色出现多条冲突记录（如既"患难同行"又"恋人"又"亲属"）。选最具代表性的一条。
- 如果关系在全书中有显著转折（如从恋人变宿敌），在 `dynamic` 字段里概述，不要拆成多条。

**本书核心关系**：
- 胡一刀与苗人凤：亦敌亦友，最终因误会而死斗
- 胡斐与苗若兰：父辈恩怨下的年轻一代
- 胡斐与苗人凤：杀父之仇与真相揭露
- 田归农与苗人凤：夺妻之恨
- 天龙门内部：曹云奇、田青文、陶子安等人的复杂关系

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
  - 对：`辽东大侠，与苗人凤比武身亡，其子胡斐承其遗志`
  - 错：`在第4章与苗人凤大战三天三夜`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`胡一刀`、`苗人凤`、`金面佛`
  - 错：`那个用刀的`、`辽东大侠`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_tian_long_men`），**不能**使用名称（如"天龙门"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。
- 本书多数角色为江湖散人，faction 为 null 的情况较多，这是正常的。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_hu_jia_dao_fa`），**不能**使用名称（如"胡家刀法"）。
- **禁止引用 skills.json 中不存在的 skill ID**。如果某 skill 不在 skills.json 中，先在 skills.json 中添加该 skill，再在 characters.json 中引用。

**items.owner / related_characters / related_skills**：
- `owner` 可以是 `characters.json` 中的 `id`（人物拥有），也可以是 `factions.json` 中的 `id`（门派拥有）。不能使用名称。
- `related_characters` 必须使用 `characters.json` 中的 `id`。
- `related_skills` 必须使用 `skills.json` 中的 `id`。

**dialogues.speaker / listener**：
- 必须使用 `characters.json` 中的 `id`，不能使用名称。

**ID 命名示例**：
- 胡斐 → `char_hu_fei`
- 苗人凤 → `char_miao_ren_feng`
- 天龙门 → `faction_tian_long_men`
- 胡家刀法 → `skill_hu_jia_dao_fa`

**生成顺序建议**：
1. 先生成 `factions.json` 和 `skills.json`（它们是基础数据）
2. 再生成 `characters.json`（引用 factions 和 skills 的 ID）
3. 最后生成 `locations.json` 和 `techniques.json`

### ID 与枚举

- ID 严格按 `constants.md` 的 ID 规则：小写拼音 + 下划线，逐字拆分音节。
- 所有枚举值（rank、type、role、tone 等）必须来自 `constants.md` 的合法值列表。

## 已知陷阱

- **角色遗漏**：平阿四（独臂仆人）是重要叙事者，容易被忽略
- **功法错分**：八卦刀、天龙剑法应归为 skills，而非 items
- **关系复杂**：胡一刀-苗人凤-田归农三角关系需准确处理
- **物品与技能混淆**：凤头珠钗是物品，胡家刀法是技能

## 工作流

1. 先通读 `manifest.json` 和 `mention_summary.json`，建立全书结构感（10章，约13万字）。
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details（relationships、personality、source_refs 等）。LLM 不再需要同时决定"列谁"和"细节是什么"，注意力更聚焦。
3. **如果 `outline.json` 不存在**：在脑中/草稿里列出主要角色、门派、地点、功法的清单。
4. **按以下顺序生成**（重要！确保 ID 引用正确）：
   - **第一步**：生成 `factions.json` 和 `skills.json`——这是基础数据
   - **第二步**：生成 `characters.json`——引用 factions 和 skills 的 ID
   - **第三步**：生成 `locations.json` 和 `techniques.json`
5. 按重要性从高到低生成实体：核心 → 重要 → 次要 → 龙套 → 背景。
6. 写完一个实体，立刻回查原文确认 source_refs 的真实性。
7. **最后检查**：
   - 关系图无冲突、ID 无重复、枚举值合法、所有字段非空
   - **ID 引用一致性**：characters.faction 必须是 factions.json 中的 ID，characters.known_skills 必须是 skills.json 中的 ID
   - **禁止使用名称代替 ID**

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
