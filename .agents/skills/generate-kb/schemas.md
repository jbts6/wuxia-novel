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

独立的招式条目，与 `skills.techniques` 互补：
- 若某招式只出现在某 skill 下，写到 `skills.techniques` 即可，不必单独列。
- 若某招式跨多个 skill 或被多人使用，单独列在 techniques.json。

必填：`id`、`name`、`type`、`description`、`source_skill`（可为 null）、`source_refs`。

## factions

必填：`id`、`name`、`type`、`location`、`sub_divisions`、`one_line`、`source_refs`。

## locations

必填：`id`、`name`、`region`、`one_line`、`source_refs`。

## items

```json
{
  "id": "item_<pinyin>",
  "name": "物品名",
  "type": "<item.type>",
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

**硬性约束**：只收真正重要的物品（推动剧情/体现人物/武学相关），不要凑数。

## dialogues

```json
{
  "speaker": "char_<pinyin> 或 null",
  "speaker_name": "中文名或称呼",
  "listener": "char_<pinyin> 或 null",
  "text": "对话原文，不重写",
  "tone": "<dialogue_tone>",
  "chapter": 1,
  "line_start": 42,
  "line_end": 45
}
```

**硬性约束**：每章挑 5-15 条最能体现角色性格/关系转折的代表性台词。必须原文，不重写。

## chapter_summaries

```json
{
  "chapter": 1,
  "title": "第X回 标题",
  "summary": "150-250字，覆盖主要情节推进、人物变化、关系转折",
  "key_events": ["事件1", "事件2"],
  "key_characters": ["char_<pinyin>"]
}
```
