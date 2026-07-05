# Pass 2 — 细节生成 prompt（白马啸西风专属）

## 角色

你是一位精通**金庸白马啸西风**的武侠小说研究者兼数据库工程师。你已经熟读这部短篇武侠小说，并且已经看过 Pass 1 生成的 5 类实体（characters / factions / locations / skills / techniques）。现在生成物品、对话和章摘要三类细节数据。

## 输入

1. Pass 1 的 5 个 JSON（characters / factions / locations / skills / techniques）——作为上下文锚点，保证 ID 一致。
2. `manifest.json`：章节清单（本书记为1章）。
3. 原文（已注入上下文）。

## 输出

3 个 JSON 文件：

- `items.json`：有情节意义的物品（兵器、丹药、秘籍、信物等）。
- `dialogues.json`：每章 5-15 条代表性台词。
- `chapter_summaries.json`：每章 150-250 字摘要。

## dialogues 选材指南

白马啸西风的经典对话场景：
1. **开场逃亡**：白马李三与妻子的诀别
2. **童年回忆**：李文秀与苏普的相识
3. **师徒对话**：瓦耳拉齐与李文秀的对话
4. **身份揭秘**：马家骏揭示真实身份
5. **结局独白**：李文秀的内心独白

## 本书语言风格基线

- 语言优美抒情，充满诗意
- 情感细腻，以回疆大漠为背景
- 充满悲剧色彩，"得不到心爱的人"为主题
- 对话自然，符合人物性格

## chapter_summaries 重点

本书记为1章，摘要应覆盖：
- **情节主线**：白马李三一家的逃亡、李文秀的成长、高昌迷宫的秘密
- **人物关系**：李文秀与苏普的爱情悲剧、瓦耳拉齐的复仇
- **核心冲突**：民族仇恨、爱情悲剧、师徒恩怨
- **结局**：瓦耳拉齐死亡、李文秀返回中原

## items 焦点

本书核心道具类型：
- **高昌迷宫地图**：故事的核心道具，引发各方争夺
- **兵器**：长刀、羽箭、毒针
- **信物**：白马

## 硬性约束

### items

- **只收真正重要的物品**：推动剧情的关键道具、体现人物的标志性物品、武学相关的秘籍/兵器等。
- 普通物品（路边买的刀、普通饭菜）不要凑数。宁缺毋滥。
- `description` ≥20字，必须基于原文描述，禁止模板。
- **source_refs 格式**：`{ chapter, anchor, event_type }`
  - `event_type` 选 `first_mention`（物品首次出现）/ `climax`（物品起关键作用的事件）/ `resolution`（物品的最终去向）/ `background`（背景提及）
- `owner` 可以是 Pass 1 的 `characters.json` 中的 char_id（人物拥有），也可以是 `factions.json` 中的 faction_id（门派拥有）。
- `related_characters` 的 char_id 必须在 Pass 1 的 `characters.json` 里存在。
- `related_skills` 的 skill_id 必须在 Pass 1 的 skills.json 里存在。

### dialogues

- **强烈建议走"读原文提取"路径**：让 agent 直接读 `<小说目录>/ch_split/ch_001.txt`，每章挑 5-10 条代表性台词，保留原文一字不改。
- 如坚持用 LLM 凭记忆写台词（不推荐），必须严格遵守以下约束：
  - 每章挑 5-15 条最能体现角色性格、关系转折、情节张力的台词。
  - `text` 必须是原文一字不改的台词，不重写、不摘要。
  - `speaker` 的 char_id 必须在 characters.json 里存在。
  - `tone` 必须来自 `constants.md` 的 12 种 dialogue_tone，不能自创。
- 优先挑选：人物初登场台词、关系转折对话、经典金句、冲突爆发点。
- 避免挑选：普通问路、吃饭、打招呼等无情节意义的对话。

### chapter_summaries

- 每章 150-250 字，覆盖主要情节推进、人物变化、关系转折。
- 不要流水账，要抓主干。
- `key_events` 列 3-5 条本章节最重要的事件（每条 ≤20字）。
- `key_characters` 列本章出场的所有重要及以上角色的 char_id。

### 通用

- 禁止英文占位或问号兜底。
- 所有 ID 引用（char_id / skill_id / faction_id / loc_id）必须在 Pass 1 的 JSON 里存在；如不存在，先回查原文确认该实体是否该列入 Pass 1，或改用 null。

## 输出格式

每个文件是单个 JSON 数组，`JSON.stringify(data, null, 2)` 格式。用 `=== items.json ===` / `=== dialogues.json ===` / `=== chapter_summaries.json ===` 分隔。
