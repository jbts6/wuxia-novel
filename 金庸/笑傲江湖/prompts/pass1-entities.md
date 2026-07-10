# Pass 1 — 实体骨架生成 prompt（笑傲江湖专用）

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸、古龙、梁羽生、黄易四大家的作品。你已经熟读《笑傲江湖》（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

## 小说简介

《笑傲江湖》是金庸创作的长篇武侠小说，共40回。小说以"辟邪剑谱"和"葵花宝典"两部武学秘籍为线索，讲述了华山派大弟子令狐冲从被逐出师门到最终与任盈盈归隐江湖的故事。书中涉及五岳剑派与日月神教的正邪之争、各派对辟邪剑谱的争夺、以及令狐冲习得独孤九剑的成长历程。

## 叙事风格

金庸在本书中采用**政治寓言**式的写法，借江湖门派之争影射权力斗争。语言风格为**典雅白话文**，对话既有文言韵味又通俗易懂。武功描写注重意境而非招式细节，常以音乐、书法、绘画等艺术形式来衬托武学境界。

## 关键事件时间线

1. **福州灭门**（ch1-3）：青城派余沧海灭福威镖局，林平之家破人亡
2. **衡山刘正风金盆洗手**（ch4-6）：刘正风与曲洋的友谊悲剧
3. **华山学艺**（ch7-12）：令狐冲在思过崖学独孤九剑
4. **洛阳金刀王家**（ch13-14）：令狐冲被冤枉
5. **梅庄比剑**（ch19-22）：向问天设计救任我行，令狐冲学吸星大法
6. **五岳并派**（ch33-35）：左冷禅阴谋并派，岳不群暗中得利
7. **封禅台大战**（ch27-28）：岳不群用辟邪剑法胜左冷禅
8. **华山思过崖**（ch35-36）：各派高手被困山洞，大屠杀
9. **朝阳峰**（ch38）：任我行欲一统江湖，令狐冲拒绝
10. **恒山决战**（ch39-40）：任我行暴毙，令狐冲与盈盈归隐

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
- 内功（如：紫霞神功、吸星大法）
- 剑法（如：独孤九剑、辟邪剑法、冲灵剑法）
- 掌法（如：摧心掌、翻天掌）
- 轻功
- 指法
- 音攻（如：黄钟公的七弦无形剑）

**items.json 收录武器/道具**，包括：
- 兵器（如：长剑、金刀）
- 暗器
- 秘籍（如有实体形态的剑谱、琴谱）
- 信物（如：三尸脑神丹解药）
- 日常物品

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"，放 items。

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**
  - `climax`：事件的**高潮/关键冲突**
  - `resolution`：事件的**收尾/结局**
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 大致正确；(2) `anchor` 包含至少 2 个实体关键词；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 5 条分散在不同章节，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系类型和动态。
- 禁止同一对角色出现多条冲突记录。选最具代表性的一条。
- 如果关系在全书中有显著转折（如令狐冲与岳不群从师徒到决裂），在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_hua_shan_pai`），**不能**使用名称。
- 如果人物不属于任何门派，设置为 `null`。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_du_gu_jiu_jian`），**不能**使用名称。

**items.owner / related_characters / related_skills**：
- `owner` 可以是 `characters.json` 中的 `id`，也可以是 `factions.json` 中的 `id`。
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

## ID 命名示例

| 中文名 | 拼音拆分 | ID |
|--------|---------|-----|
| 令狐冲 | ling hu chong | char_ling_hu_chong |
| 岳不群 | yue bu qun | char_yue_bu_qun |
| 任盈盈 | ren ying ying | char_ren_ying_ying |
| 任我行 | ren wo xing | char_ren_wo_xing |
| 左冷禅 | zuo leng chan | char_zuo_leng_chan |
| 华山派 | hua shan pai | faction_hua_shan_pai |
| 日月神教 | ri yue shen jiao | faction_ri_yue_shen_jiao |
| 独孤九剑 | du gu jiu jian | skill_du_gu_jiu_jian |
| 吸星大法 | xi xing da fa | skill_xi_xing_da_fa |
| 辟邪剑法 | pi xie jian fa | skill_pi_xie_jian_fa |

## 已知陷阱

1. **令狐冲 vs 风二中**：令狐冲在梅庄化名"风二中"，不要当成两个角色。
2. **任我行 vs 东方不败**：两人都是日月神教教主，但时间段不同。东方不败篡位在前，任我行被囚后复出。
3. **岳不群的伪君子形象**：前期描写为"君子剑"，后期才暴露真面目。one_line 应反映全书定位。
4. **林平之的转变**：从纨绔子弟到复仇者再到疯狂，角色弧线复杂。
5. **恒山三定**：定闲、定静、定逸是三位师太，不要混淆。
6. **桃谷六仙**：六兄弟，名字分别是桃根仙、桃干仙、桃枝仙、桃叶仙、桃花仙、桃实仙。
7. **江南四友**：黄钟公、黑白子、秃笔翁、丹青生，隐居梅庄。
8. **曲洋与刘正风**：分属日月神教和衡山派，因音乐结为知己。
9. **技能分类**：黄钟公的"七弦无形剑"是音攻类技能，不是剑法。
10. **辟邪剑法 vs 葵花宝典**：辟邪剑法源自葵花宝典，但已独立发展。两者都需自宫修炼。

## 工作流

1. 先通读 `manifest.json` 和 `mention_summary.json`，建立全书结构感。
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details。
3. **如果 `outline.json` 不存在**：在脑中/草稿里列出主要角色、门派、地点、功法的清单。
4. **按以下顺序生成**（重要！确保 ID 引用正确）：
   - **第一步**：生成 `factions.json` 和 `skills.json`
   - **第二步**：生成 `characters.json`
   - **第三步**：生成 `locations.json` 和 `techniques.json`
5. 按重要性从高到低生成实体：核心 → 重要 → 次要 → 龙套 → 背景。
6. 写完一个实体，立刻回查原文确认 source_refs 的真实性。
7. **最后检查**：
   - 关系图无冲突、ID 无重复、枚举值合法、所有字段非空
   - **ID 引用一致性**：characters.faction 必须是 factions.json 中的 ID
   - **禁止使用名称代替 ID**

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
