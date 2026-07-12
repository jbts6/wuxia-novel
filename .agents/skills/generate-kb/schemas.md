# JSON 契约

## 写入规则

- 只能用 `JSON.stringify(data, null, 2)` 写 JSON；禁止手拼 JSON 字符串。
- 写入后立刻 `JSON.parse` 验证。
- `source_refs` 采用 **event anchor + 多候选** 格式。LLM 写 `{ chapter, anchor }`（事件描述），由 `locate.js` 自动回填：
  - `chapter` / `line_start` / `line_end` / `text`：primary（最高匹配密度）的精确位置
  - `alternatives: [...]`：跨章事件的备选位置（score ≥ 60% primary 的其他章）
  - `locate_status` / `locate_score` / `locate_method` / `anchors_hit`：locate 元信息
- **跨章事件自然暴露多位置**：如"聚贤庄之战"在 ch17 铺垫 + ch18 血战 + ch19 救走 + ch20 疗伤，会作为 primary + alternatives 同时出现，由用户/下游选择最匹配的一处。
- 你只需要确保：(1) `chapter` 大致正确（事件发生的章节之一）；(2) `anchor` 包含足够的实体关键词让代码能定位（至少 2 个实体：人名 / 地名 / 武功 / 事件词）。
- `name`、`one_line`、`description`、`effects`、`origin`、`personality`、`dynamic` 等人工可读字段禁止英文占位或问号兜底，例如 `unknown`、`weapon`、`???`、`?`、`N/A`。
- 产物是人工可用的最终库，不是 raw extraction。写之前先综合全书判断。

## characters

```json
{
  "id": "char_<pinyin>",
  "name": "中文名",
  "alias": ["原文真正出现过的别名/称呼"],
  "identity": "身份定位（≤20字）",
  "faction": "所属门派/家族",
  "role": "核心 | 重要 | 次要 | 龙套 | 背景",
  "archetype": "scholar | warrior | monk | assassin | healer",
  "power_rank": "<rank>",
  "importance": "核心 | 重要 | 次要 | 龙套 | 背景",
  "one_line": "基于全书的人物定位（≤40字），不是某章事件",
  "biography": "人物生平概述，覆盖出身背景、关键经历、性格转变、最终结局。要求：每个句子都包含实质性信息，禁止用'非常''极其''无比'等程度副词凑字数。仅核心/重要/次要角色填写，龙套/背景角色留空字符串。",
  "personality": {
    "traits": ["至少 5 项性格特征"],
    "speech_style": "说话风格",
    "temperament": "气质"
  },
  "relationships": [
    {
      "target": "char_<pinyin>",
      "type": "<relationship.type>",
      "intensity": 0-100,
      "bond_level": 1-5,
      "dynamic": "关系变化概述（≤40字）"
    }
  ],
  "known_skills": ["skill_<pinyin>"],
  "related_skills": ["skill_<pinyin>"],
  "rag_refs": [1, 3, 7],
  "source_refs": [
    { "chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段" }
  ]
}
```

**硬性约束**：
- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系。
- `alias` 只收原文真正出现过的称呼。禁止泛称（"青衫年轻男子"、"白衣女子"除非这是唯一称呼）。
- `one_line` 必须反映人物全书定位（如"大理段氏世子，后为帝，一生追寻王语嫣与身世之谜"），不能是某章情节（如"在第3章被蜂麻倒"）。

## skills

```json
{
  "id": "skill_<pinyin>",
  "name": "功法名",
  "type": "<skill.type>",
  "faction": "所属门派",
  "mastery_rank": "<rank>",
  "one_line": "全书定位（≤40字）",
  "techniques": [
    {
      "id": "tech_<pinyin>",
      "name": "招式名",
      "type": "<technique.type>",
      "description": "从原文提取的真实描述（≥20字），禁止模板"
    }
  ],
  "progression": "功法修炼阶段（如有）",
  "effects": [{ "type": "<effect.type>", "description": "..." }],
  "combat_style": "战斗风格",
  "rag_refs": [1, 5, 12],
  "source_refs": [{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "..." }]
}
```

**硬性约束**：
- `techniques` 仅当原文有明确招式名时才填入，不要凑数。内功/身法类（北冥神功、凌波微步）通常 `techniques: []`。
- 禁止模板化 description："降龙十八掌的代表性变化：亢龙有悔" 是错的。"洪七公传授的第一招，劲力刚猛，蓄而后发，留有余力" 是对的。

## techniques

所有原文明确定名且可定位的招式都必须作为独立条目写入 `techniques.json`。`skills.techniques` 可同时引用它们，但不能替代独立条目。冷门、低频或威力弱只影响 `importance`，不得删除。

必填：`id`、`name`、`type`、`description`、`source_skill`（可为 null）、`source_refs`。

## factions

```json
{
  "id": "faction_<pinyin>",
  "name": "门派名",
  "type": "<faction.type>",
  "location": "loc_<pinyin>",
  "leader": "char_<pinyin> 或 null",
  "sub_divisions": [],
  "one_line": "≤40字",
  "source_refs": [{ "chapter": 1, "anchor": "..." }]
}
```

必填：`id`、`name`、`type`、`location`、`leader`、`sub_divisions`、`one_line`、`source_refs`。

## locations

必填：`id`、`name`、`region`、`one_line`、`source_refs`。

## items

```json
{
  "id": "item_<pinyin>",
  "name": "物品名",
  "type": "<item.type>",
  "tags": ["<tag1>", "<tag2>"],
  "owner": "char_<pinyin> 或 null",
  "one_line": "≤40字",
  "description": "≥20字",
  "effects": [{ "type": "<effect.type>", "description": "..." }],
  "origin": "来源",
  "related_characters": ["char_<pinyin>"],
  "related_skills": ["skill_<pinyin>"],
  "rarity_tier": "<item.rarity_tier>",
  "rag_refs": [1, 5],
  "source_refs": [{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "..." }]
}
```

**硬性约束**：只收真正重要的物品（推动剧情/体现人物/武学相关），不要凑数。**必须为每个物品分配 `rarity_tier`**（凡品/良品/珍品/神品），不能全部设为"未知"。

**tags 字段**：标签数组，用于更灵活的分类。一个物品可以有多个标签。
- 大类：兵器、秘籍、丹药、剧情关键
- 小类：刀、剑、暗器、内功、外功、信物、钥匙等

**type 分类标准**：
- 兵器：刀、剑、枪、棍、棒等武器
- 暗器：袖箭、飞刀、毒针等暗器
- 防具：盔甲、护腕等防护装备
- 丹药：有名字的丹药、补药
- 毒药：毒药、迷药、解药
- 信物：帮派信物、家族信物、身份象征
- 秘籍：武功秘籍、图谱、经书
- 奇门：特殊功法体系（如斗转星移、化功大法等不属于传统兵器/秘籍的武学）
- 坐骑：马匹、骆驼等坐骑
- 食物：有特殊功效的食物
- 工具：有特殊功能的工具
- 饰品：珠宝、玉佩等装饰品
- 异兽：有名字的灵兽、毒物、宠物等活物（如闪电貂、莽牯朱蛤）

**rarity_tier 稀有度**：
- 凡品：普通兵器、常见药物、日常工具
- 良品：名门正派的兵器、有特殊功效的药物、珍贵的秘籍
- 珍品：失传秘籍、罕见神兵、珍贵丹药
- 神品：传说级神兵、失传绝学、极品丹药
- 未知：无法确定稀有度的物品

## dialogues

```json
{
  "id": "dialogue_<id>",
  "speaker": "char_<pinyin> 或 null",
  "speaker_name": "中文名或称呼",
  "listener": "char_<pinyin> 或 null",
  "text": "对话原文，不重写",
  "tone": "<dialogue_tone>",
  "chapter": 1,
  "line_start": 42,
  "line_end": 45,
  "event_id": "event_<id>（event/both 必填）",
  "selection_type": "event|persona|both",
  "selection_reason": "为何是关键事件/人物特征对话",
  "trait_tags": ["朴直", "机敏"],
  "context": "对话发生时的完整原文语境",
  "context_line_start": 40,
  "context_line_end": 47
}
```

**硬性约束**：每个主要事件至少一条关键对话或结构化豁免；每个核心/重要角色至少一条人物特征对话或结构化豁免。必须是完整原文，不重写，不用固定的“每章 N 条”代替语义覆盖。

## chapter_summaries

```json
{
  "chapter": 1,
  "title": "第X回 标题",
  "summary": "150-250字，覆盖主要情节推进、人物变化、关系转折",
  "key_events": ["事件1", "事件2"],
  "key_characters": ["char_<pinyin>"],
  "source_refs": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}],
  "field_source_refs": {
    "summary": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}],
    "key_events": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}]
  }
}
```

## 描述字段证据

最终实体保持原有 `source_refs` 字段。只要写入 personality、description、effects、mechanism、function、significance 等解释性字段，还必须增加兼容的可选 `field_source_refs` 映射：

```json
{
  "description": "根据原文归纳的描述",
  "field_source_refs": {
    "description": [
      {"chapter": 1, "line_start": 42, "line_end": 45, "text": "支持该描述的完整原文"}
    ]
  }
}
```

`field_source_refs` 是新增可选字段，旧消费者可忽略；但生成了受检描述字段却没有可命中的对应证据时，G3 失败。

## 中间产物契约

中间产物全部位于 `build/`。它们用于证明来源覆盖与候选闭环，不改变上面八个最终 JSON 的消费接口。

### source-index.json

必填：`schema_version`、`novel`、`source_hash`、`chapter_corpus_hash`、`source_alignment_valid`、`window_lines`、`overlap_lines`、`chapters`、`windows`。

每个 window：

```json
{
  "id": "ch001_w003",
  "chapter": 1,
  "line_start": 201,
  "line_end": 320,
  "text": "带稳定章节内行号的原文窗口"
}
```

### scan-manifest.json

```json
{
  "source_hash": "sha256",
  "chapter_corpus_hash": "sha256",
  "required_window_ids": ["ch001_w001"],
  "passes": {
    "named-inventory": {"completed_window_ids": []},
    "event-dialogue": {"completed_window_ids": []},
    "gap-audit": {"completed_window_ids": []}
  },
  "chapter_summary_chapters": []
}
```

### candidates.jsonl

每行一个对象：

```json
{
  "candidate_id": "cand_ch001_w003_0001",
  "category_hint": "skill",
  "name": "躺尸剑法",
  "chapter": 1,
  "source_ref": {"line_start": 120, "line_end": 123, "text": "原文完整节选"},
  "discovery_pass": "named-inventory",
  "window_id": "ch001_w003"
}
```

允许类别：`character|faction|location|skill|technique|item|event|dialogue|chapter_summary`。

### decisions.jsonl

```json
{
  "candidate_ids": ["cand_ch001_w003_0001"],
  "decision": "keep",
  "canonical_name": "躺尸剑法",
  "final_category": "skill",
  "importance": "important",
  "reason": "原文明确定名的剑法",
  "final_id": "skill_tang_shi_jian_fa"
}
```

允许 decision：`keep|merge|redirect|reject`。reject reason 仅可为 `duplicate|generic_unnamed|not_an_entity|not_source_grounded|trivial|non_major`。命名武功/招式不得用 `trivial` 或 `non_major` 删除。

### events.json 与 semantic-exemptions.json

主要事件作为中间表保存在 `build/events.json`，至少包含 `id`、`name`、`importance`、`source_refs`、参与角色，以及 `dialogue_ids` 或结构化豁免。它不新增最终知识库消费接口。

无法找到合适原话时，`build/semantic-exemptions.json` 可记录：

```json
{
  "main_events": [{"id": "event_x", "reason": "原文无直接对话"}],
  "personas": [{"id": "char_x", "reason": "该角色无直接发言"}]
}
```

### gap-audit.json

```json
{"rounds":[{"round":1,"completed_window_ids":["ch001_w001"],"new_candidate_ids":[]}]}
```

最后一轮不得仍有 keep/merge/redirect 的新候选。

## 可选人工金标

仅识别 `audit/gold.json`，且必须同时满足：

- `provenance` 为 `human_curated`。
- `source_hash` 与当前原文 SHA-256 一致。
- `must_include` / `must_exclude` 每项均有完整、可命中的原文证据位置。

LLM 自动生成的 baseline 不参与召回率或完成门禁。
