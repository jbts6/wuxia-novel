# 《侠客行》Pass 1 — 实体骨架生成 prompt

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸、古龙、梁羽生、黄易四大家的作品。你已经熟读《侠客行》（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

## 本书叙事风格

《侠客行》采用金庸典型的典雅白话风格，特点包括：
- **句式**：长短句结合，多用四字成语和典故（如"虎虎有威"、"鸦雀无声"）
- **视角**：第三人称全知视角，频繁进入人物内心
- **对话**：文雅与市井并存。谢烟客说话傲慢威严，石破天天真憨厚，白自在狂妄自大，丁不四油腔滑调
- **心理描写**：细腻入微，常以"心想"、"寻思"引出人物内心独白
- **时代背景**：无明确朝代设定，但语言风格偏向宋元时期

## 关键事件时间线

基于 `mention_summary.json` 推断的全书重大事件节点：

| 章节范围 | 事件概要 | source_ref 锚点建议 |
|---------|---------|-------------------|
| 第1回 | 侯监集烧饼店血案，玄铁令出现 | first_mention: 玄铁令、谢烟客、吴道通 |
| 第2-3回 | 石清闵柔追查石中玉，谢烟客携小丐离去 | first_mention: 石清、闵柔、雪山派 |
| 第4-5回 | 长乐帮误认石破天为帮主 | first_mention: 贝海石、长乐帮、丁珰 |
| 第6-8回 | 丁不三丁不四争夺石破天 | climax: 丁氏兄弟冲突 |
| 第9-10回 | 史婆婆阿绣流落紫烟岛 | first_mention: 史婆婆、阿绣、金乌派 |
| 第11-13回 | 赏善罚恶令出现，铁叉会灭门 | first_mention: 张三、李四、侠客岛 |
| 第14-16回 | 凌霄城雪山派内乱 | climax: 白自在发疯 |
| 第17-18回 | 石破天身世之谜 | climax: 身份错位高潮 |
| 第19-20回 | 侠客岛腊八粥大会 | resolution: 太玄经参悟 |
| 第21回 | 结局，石破天身世仍未解 | resolution: 开放式结局 |

## source_ref 锚定策略

- **first_mention**：角色首次出场、门派首次提及、地点首次出现
- **climax**：关键冲突（如丁氏兄弟争夺石破天、白自在发疯、侠客岛比武）
- **resolution**：故事收尾（如太玄经参悟、梅芳姑身世揭露）
- **background**：背景介绍、日常描写

**本书适合锚定的关键场景：**
- 第1回侯监集血案：玄铁令first_mention
- 第4回长乐帮总舵：贝海石、长乐帮first_mention
- 第8回丁氏兄弟冲突：丁不三、丁不四climax
- 第10回紫烟岛：史婆婆、金乌派first_mention
- 第11回铁叉会灭门：赏善罚恶令、张三李四first_mention
- 第19回侠客岛：龙岛主、木岛主first_mention
- 第20回石壁参悟：太玄经climax/resolution

## ID 命名示例

基于本书主要角色名给出的 ID 示例：

**角色：**
- `char_shi_po_tian`：石破天
- `char_xie_yan_ke`：谢烟客
- `char_bei_hai_shi`：贝海石
- `char_bai_zi_zai`：白自在
- `char_ding_dang`：丁珰
- `char_ding_bu_san`：丁不三
- `char_ding_bu_si`：丁不四
- `char_shi_zhong_yu`：石中玉
- `char_shi_qing`：石清
- `char_min_rou`：闵柔

**门派：**
- `faction_xue_shan_pai`：雪山派
- `faction_chang_le_bang`：长乐帮
- `faction_tie_cha_hui`：铁叉会

**功法：**
- `skill_xuan_tie_shen_gong`：玄铁神功（如有）
- `skill_jin_wu_dao_fa`：金乌刀法
- `skill_xue_shan_jian_fa`：雪山剑法

## 已知陷阱

### 容易被遗漏的角色
- **吴道通**：第1回出场，持有玄铁令的关键人物，虽死于第1回但推动剧情
- **周牧**：金刀寨头领，第1回出场
- **封万里**：雪山派大弟子，"风火神龙"，被白自在斩断手臂
- **阿绣**：白自在孙女，石破天恋人，出场较晚但重要
- **梅芳姑**：石清闵柔的杀子仇人，丁不四私生女

### 容易被忽略的功法/物品
- **玄铁令**：谢烟客的信物，非功法但极重要
- **赏善罚恶令**：侠客岛发出的令牌
- **腊八粥**：侠客岛的毒/药粥

### 常见关系图错误
- 石破天与石中玉不是同一人，但全书都在混淆
- 丁珰爱的是石中玉（误认为石破天），不是真正的石破天
- 史婆婆是白自在之妻，不是丁不四的情人（丁不四追求她但未成功）

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
  - 对：`身世不明的孤儿，因缘际会被误认为长乐帮帮主，最终参悟太玄经`
  - 错：`在第4回被贝海石立为帮主`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`狗杂种`、`大粽子`、`史亿刀`（具体称呼）
  - 错：`那少年`、`小乞丐`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_xue_shan_pai`），**不能**使用名称（如"雪山派"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。
- 常见错误：`"玄素庄"`、`"凌霄城"` 等不是 faction，是 location，应设为 `null`。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_xue_shan_jian_fa`），**不能**使用名称（如"雪山剑法"）。
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
   - **禁止使用名称代替 ID**：如"雪山派"应为 `faction_xue_shan_pai`，"雪山剑法"应为 `skill_xue_shan_jian_fa`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
