# Pass 1 — 实体骨架生成 prompt（白马啸西风专属）

## 角色

你是一位精通**金庸白马啸西风**的武侠小说研究者兼数据库工程师。你已经熟读这部短篇武侠小说，现在需要基于原文写一份完整、准确、无冲突的设定库。

## 输入

1. `manifest.json`：章节清单（本书记为1章）。
2. `mention_summary.json`：高频实体提及汇总（本书记为空，需基于原文手动提取）。
3. `outline.json`（可选）：实体清单大纲（Phase 1.5 生成），包含 characters、factions、locations、skills 的骨架清单。
4. 原文（已注入上下文）。

## 输出

5 个 JSON 文件，严格按照 `schemas.md` 和 `constants.md` 的 schema、ID 规则、枚举值：

- `characters.json`：所有有名有姓、有情节作用的角色。重要性=龙套/背景的角色可以省略 relationships，但其他字段必填。
- `factions.json`：所有门派、帮派、家族、军队、王族、寺院等组织。
- `locations.json`：所有有情节意义的地点。
- `skills.json`：所有被命名的武学体系（内功、轻功、剑法、掌法等）。
- `techniques.json`：仅当招式跨多个 skill 或被多人使用时才独立列出。

## 本书叙事风格描述

白马啸西风是金庸短篇武侠小说，语言优美抒情，充满诗意。叙事节奏明快，情感细腻，以回疆大漠为背景，展现了民族冲突、爱情悲剧和人性善恶。全书以"得不到心爱的人"为主题，充满悲剧色彩。

## 关键事件时间线

1. **开篇**：白马李三一家被吕梁三杰追杀，李三重伤而死
2. **成长**：李文秀在回疆长大，与苏普相识相爱
3. **分离**：苏普的父亲反对他与汉人女子交往，李文秀被迫离开
4. **重逢**：多年后李文秀救出师父瓦耳拉齐，发现他是仇人
5. **结局**：瓦耳拉齐死在迷宫中，李文秀独自返回中原

## source_ref 锚定策略

- **first_mention**：角色首次登场、高昌迷宫地图首次出现、瓦耳拉齐亮相
- **climax**：李文秀与苏普分离、瓦耳拉齐身份揭秘、迷宫决战
- **resolution**：瓦耳拉齐死亡、李文秀返回中原
- **background**：日常描写、对话、心理活动

## ID 命名示例

- `char_li_wen_xiu` — 李文秀
- `char_su_pu` — 苏普
- `char_wa_er_la_qi` — 瓦耳拉齐
- `char_ma_jia_jun` — 马家骏
- `skill_hua_hui_wu_gong` — 华辉武功
- `item_gao_chang_mi_gong_di_tu` — 高昌迷宫地图

## 已知陷阱

- **角色遗漏**：吕梁三杰的三个成员需要分别列出
- **身份混淆**：瓦耳拉齐与华辉是同一人，马家骏与计老人是同一人
- **关系错误**：李文秀与苏普是青梅竹马，但最终分离
- **功法忽略**：华辉所授的武功、哈萨克族武功等容易被忽略

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
  - 对：`白马李三之女，在回疆长大，武功高强，心地善良`
  - 错：`在第1章被追杀`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`计爷爷`、`李英雄`（具体称呼）
  - 错：`那个汉人姑娘`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_tie_yan_bu`），**不能**使用名称（如"铁延部"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_hua_hui_wu_gong`），**不能**使用名称（如"华辉武功"）。
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
   - **禁止使用名称代替 ID**：如"铁延部"应为 `faction_tie_yan_bu`，"华辉武功"应为 `skill_hua_hui_wu_gong`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
