# Pass 1 — 实体骨架生成 prompt（《倚天屠龙记》专属）

## 角色

你是一位精通金庸《倚天屠龙记》的武侠小说研究者兼数据库工程师。你已经熟读本书，现在需要基于原文写一份完整、准确、无冲突的设定库。

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

## 本书叙事风格描述

《倚天屠龙记》采用典雅白话文风，对话文雅，情节跌宕起伏。叙事视角以张无忌为中心，兼及各主要人物。语言特色：
- 文言/白话比例适中，对话符合人物性格（张无忌温厚、赵敏机敏、周芷若端庄、谢逊豪迈）
- 武功描写生动，招式名称富有诗意（如"落英剑法"、"玉女剑法"、"空明拳"）
- 情感描写细腻，尤其是张无忌与四位女性的感情纠葛
- 时代背景为元末明初，蒙古统治中原，民族矛盾尖锐

## 关键事件时间线（从 mention_summary 的高频事件词推断）

1. **第一回-第三回**：郭襄上少林寺，觉远大师圆寂，张君宝得传九阳神功（背景故事）
2. **第四回-第十回**：张翠山、殷素素夫妇携张无忌回归中原，张无忌少年时期
3. **第十一回-第二十回**：张无忌身世揭秘，习得九阳神功、乾坤大挪移
4. **第二十一回-第三十回**：六大派围攻光明顶，张无忌成为明教教主
5. **第三十一回-第四十回**：万安寺囚禁、少林寺英雄大会、张无忌与周芷若成婚未遂、谢逊报仇

## source_ref 锚定策略

本书适合作为 first_mention / climax / resolution 锚点的事件：

- **first_mention**：角色首次登场、门派首次出现、功法首次施展
- **climax**：光明顶大战、万安寺囚禁、少林寺英雄大会、谢逊与成昆决战
- **resolution**：张无忌与赵敏相聚、谢逊归佛、周芷若出家
- **background**：日常描写、门派介绍、武功解说

## ID 命名示例

基于本书主要角色名的 ID 示例：
- `char_zhang_wu_ji`（张无忌）
- `char_zhao_min`（赵敏）
- `char_xie_xun`（谢逊）
- `char_zhou_zhi_ruo`（周芷若）
- `char_zhang_cui_shan`（张翠山）
- `char_yin_su_su`（殷素素）
- `char_zhang_san_feng`（张三丰）
- `char_mie_jue_shi_tai`（灭绝师太）
- `char_yang_xiao`（杨逍）
- `char_wei_yi_xiao`（韦一笑）

## 已知陷阱

1. **角色容易被遗漏**：
   - 觉远大师（出场少但关键，传授张君宝九阳神功）
   - 无色禅师（少林寺罗汉堂首座）
   - 空见神僧（成昆之师，被谢逊打死）
   - 黄衫女子（杨过后人，关键救援角色）

2. **功法/物品容易被忽略**：
   - 七伤拳（崆峒派绝学）
   - 空明拳（周伯通所创）
   - 打狗棒法（丐帮镇帮之宝）
   - 铁蒲扇手（铁掌帮掌法）

3. **关系图常见错误模式**：
   - 张无忌与四位女性的关系（赵敏、周芷若、小昭、殷离）
   - 明教内部关系（杨逍、范遥、韦一笑、殷天正等）
   - 武当七侠的关系（宋远桥、俞莲舟、俞岱岩、张松溪、张翠山、殷梨亭、莫声谷）

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**
  - `climax`：事件的**高潮/关键冲突**
  - `resolution`：事件的**收尾/结局**
  - `background`：背景介绍、日常描写、非关键情节
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 5 条分散在不同章节，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。
- 禁止同一对角色出现多条冲突记录（如既"患难同行"又"恋人"又"亲属"）。选最具代表性的一条。
- 如果关系在全书中有显著转折（如从恋人变宿敌），在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`，**不能**使用名称。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`，**不能**使用名称。
- **禁止引用 skills.json 中不存在的 skill ID**。如果某 skill 不在 skills.json 中，先在 skills.json 中添加该 skill，再在 characters.json 中引用。

**items.owner / related_characters / related_skills**：
- `owner` 可以是 `characters.json` 中的 `id`，也可以是 `factions.json` 中的 `id`，不能使用名称。
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
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details。
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