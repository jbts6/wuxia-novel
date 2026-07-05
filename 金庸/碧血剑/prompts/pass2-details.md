# Pass 2 — 细节生成 prompt（碧血剑专属）

## 角色

你是一位精通**金庸碧血剑**的武侠小说研究者兼数据库工程师。你已经熟读本书，并且已经看过 Pass 1 生成的 5 类实体（characters / factions / locations / skills / techniques）。现在生成物品、对话和章摘要三类细节数据。

## 输入

1. Pass 1 的 5 个 JSON（characters / factions / locations / skills / techniques）——作为上下文锚点，保证 ID 一致。
2. `manifest.json`：章节清单。
3. 原文（已注入上下文）。

## 输出

3 个 JSON 文件：

- `items.json`：有情节意义的物品（兵器、丹药、秘籍、信物等）。
- `dialogues.json`：每章 5-15 条代表性台词。
- `chapter_summaries.json`：每章 150-250 字摘要。

## dialogues 选材指南（碧血剑专属）

本书哪些场景的对话最值得提取：
- **经典对决**：袁承志与归辛树比武、与木桑道人下棋
- **情感转折**：袁承志与青青定情、与阿九分离
- **身世揭秘**：袁承志得知父亲冤死真相、青青身世揭秘
- **历史事件**：李自成攻破北京、崇祯自缢
- **门派冲突**：华山派内部矛盾、与五毒教的冲突

## 本书语言风格基线（碧血剑专属）

从原文采样总结的对话风格：
- **袁承志**：恭敬有礼，说话文雅，符合书生气质
- **夏青青**：活泼直率，说话俏皮，带有少女情怀
- **阿九**：出身帝王家，说话端庄，带有贵气
- **李自成**：豪迈粗犷，说话直白，带有农民起义领袖气质
- **归辛树**：木讷深沉，说话不多，但句句有力
- **木桑道人**：诙谐幽默，说话风趣，带有道家风范

## chapter_summaries 重点（碧血剑专属）

本书的情节主线和副线分别是什么，摘要应突出什么：
- **主线**：袁承志为父报仇、辅佐李自成、最终远赴海外
- **副线**：袁承志与青青、阿九的爱情纠葛
- **历史线**：明末清初的历史事件（李自成起义、满清入关）
- **武侠线**：华山派内部矛盾、江湖恩怨

## items 焦点（碧血剑专属）

本书的核心道具类型：
- **武功秘籍**：金蛇秘籍、华山剑谱
- **兵器**：金蛇剑、金蛇锥、铁鞭
- **信物**：玉簪、金丝镯子
- **历史文物**：崇祯血诏、太子玉玺

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

- **强烈建议走"读原文提取"路径**：让 agent 直接读 `<小说目录>/ch_split/ch_NNN.txt`，每章挑 5-10 条代表性台词，保留原文一字不改。
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