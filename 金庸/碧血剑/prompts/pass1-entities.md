# Pass 1 — 实体骨架生成 prompt（碧血剑专属）

## 角色

你是一位精通**金庸碧血剑**的武侠小说研究者兼数据库工程师。你已经熟读本书（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

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

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"，放 items。

## 本书叙事风格描述（碧血剑专属）

《碧血剑》采用金庸典型的典雅白话风格，文笔流畅，情节跌宕起伏。叙事视角以袁承志为主线，穿插历史事件（如李自成起义、满清入关）。对话文雅，角色说话符合身份（如袁承志恭敬有礼，青青活泼直率，李自成豪迈粗犷）。时代背景为明末清初，语言风格介于文言与白话之间，既有古典韵味，又通俗易懂。

## 关键事件时间线（碧血剑专属）

从 mention_summary 的高频事件词推断的全书重大事件节点：
- **第1-3回**：袁承志出生、袁崇焕冤死、袁承志拜华山派为师
- **第4-9回**：袁承志下山历练、与青青相识、参与江湖纷争
- **第10-15回**：袁承志武功大成、与归辛树冲突、泰山大会
- **第16-18回**：袁承志辅佐李自成、攻破北京
- **第19-20回**：崇祯自缢、李自成进京、袁承志远赴海外

## source_ref 锚定策略（碧血剑专属）

本书哪些事件适合作为 first_mention / climax / resolution 的锚点：
- **first_mention**：角色首次登场（如袁承志第1回出场、青青第4回出场）
- **climax**：重大冲突（如袁承志与归辛树比武、泰山大会、攻破北京）
- **resolution**：事件收尾（如崇祯自缢、李自成进京、袁承志远赴海外）
- **background**：背景介绍（如华山派历史、明朝政治腐败）

## ID 命名示例（碧血剑专属）

基于本书主要角色名给出的 ID 示例：
- `char_yuan_cheng_zhi`（袁承志）
- `char_xia_qing_qing`（夏青青）
- `char_a_jiu`（阿九）
- `char_li_zi_cheng`（李自成）
- `char_gui_xin_shu`（归辛树）
- `skill_jin_she_jian_fa`（金蛇剑法）
- `skill_shen_xing_bai_bian`（神行百变）
- `faction_hua_shan_pai`（华山派）
- `loc_hua_shan`（华山）

## 已知陷阱（碧血剑专属）

### 本书哪些角色容易被遗漏
- **安大娘**：袁承志的养母，出场不多但关键时刻重要
- **哑巴**：华山派仆人，武功高强但沉默寡言
- **孙仲君**：归辛树弟子，性格泼辣，容易与其他女性角色混淆
- **何惕守**：五毒教教主，后期才出场，但作用关键

### 本书哪些功法/物品容易被忽略
- **伏虎掌法**：袁承志最初所学，后期较少提及
- **金蛇锥**：金蛇郎君的暗器，容易被忽略
- **玉簪**：阿九的信物，推动情节发展

### 本书的关系图有哪些常见的错误模式
- **袁承志与青青的关系**：从师徒到恋人，容易误认为兄妹
- **袁承志与阿九的关系**：从朋友到恋人，但最终分离
- **归辛树与袁承志的关系**：从师兄弟到对立，容易误认为师徒

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
  - 对：`袁崇焕之子，华山派弟子，后成为"金蛇王"辅佐李自成`
  - 错：`在第3章被华山派收为弟子`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`金蛇王`、`袁公子`（具体称呼）
  - 错：`那少年`、`袁姓青年`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_hua_shan_pai`），**不能**使用名称（如"华山派"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。
- 常见错误：`"华山派"`、`"五毒教"` 等不是 faction，是 location 或 group，应设为 `null`。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_jin_she_jian_fa`），**不能**使用名称（如"金蛇剑法"）。
- **禁止引用 skills.json 中不存在的 skill ID**。如果某 skill 不在 skills.json 中，先在 skills.json 中添加该 skill，再在 characters.json 中引用。
- 常见错误：引用 `skill_fu_hu_zhang_fa`（伏虎掌法）、`skill_shen_xing_bai_bian`（神行百变）等不存在的 skill。

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
   - **禁止使用名称代替 ID**：如"华山派"应为 `faction_hua_shan_pai`，"金蛇剑法"应为 `skill_jin_she_jian_fa`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。