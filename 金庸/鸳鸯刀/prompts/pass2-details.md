# Pass 2 — 细节生成 prompt（鸳鸯刀专属）

## 角色

你是一位精通**金庸鸳鸯刀**的武侠小说研究者兼数据库工程师。你已经熟读这部短篇武侠小说，并且已经看过 Pass 1 生成的 5 类实体（characters / factions / locations / skills / techniques）。现在生成物品、对话和章摘要三类细节数据。

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

鸳鸯刀的经典对话场景：
1. **太岳四侠劫镖**：盖一鸣的啰嗦外号、周威信的"江湖上有言道"
2. **书生骗银**：袁冠南智取太岳四侠银两
3. **身世揭秘**：袁冠南与袁夫人母子相认、萧中慧得知真相
4. **萧义身世**：萧半和揭示太监身份与反清大志
5. **夫妻刀法**：林玉龙夫妇教授袁萧二人刀法

## 本书语言风格基线

- 语言诙谐幽默，充满喜剧色彩
- 大量使用"江湖上有言道"的俗语，增添民间色彩
- 角色对话生动有趣，性格鲜明
- 太岳四侠的对话尤其搞笑，盖一鸣的外号特别长

## chapter_summaries 重点

本书记为1章，摘要应覆盖：
- **情节主线**：鸳鸯刀的争夺与最终归宿
- **人物关系**：周威信护镖、太岳四侠劫镖、萧半和寿宴、身世揭秘
- **核心冲突**：清廷追捕鸳鸯刀、萧义反清义士身份
- **结局**：众人逃往中条山、鸳鸯刀秘密未解

## items 焦点

本书核心道具类型：
- **鸳鸯刀**：一短一长，藏有武林大秘密，得之者无敌于天下
- **兵器**：铁鞭、峨嵋刺、墓碑、流星锤、旱烟管、弹弓
- **信物**：金钗、翡翠狮子、玉斑指

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

- **强烈建议走"读原文提取"路径**：让 agent 直接读 `<小说目录>/ch_split/ch_01.txt`，每章挑 5-10 条代表性台词，保留原文一字不改。
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
