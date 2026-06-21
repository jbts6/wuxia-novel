# JSON 契约

## 写入规则

- 只能用 `JSON.stringify(data, null, 2)` 写 JSON；禁止手拼 JSON 字符串。
- 写入后立刻 `JSON.parse` 验证。
- `source_refs`、`line_start`、`line_end` 必须来自原文章节文件行号。

## 进度文件：`batch_json/ch_NNN_progress.jsonl`

每处理完一个段落追加一行 JSON：

```json
{
  "segment": 1,
  "line_start": 1,
  "line_end": 45,
  "dialogues": [],
  "new_entities": { "characters": [], "skills": [], "techniques": [], "factions": [], "locations": [], "items": [] },
  "entity_updates": []
}
```

恢复逻辑：文件行数 = 已完成段落数；从下一段继续。

## 章级文件：`batch_json/ch_NNN.json`

由 `merge-segments.js` 生成：

```json
{
  "chapter": 1,
  "chapter_summary": "约200字摘要",
  "dialogues": [],
  "new_entities": { "characters": [], "skills": [], "techniques": [], "factions": [], "locations": [], "items": [] },
  "entity_updates": []
}
```

## Dialogue

| 字段 | 要求 |
|------|------|
| `speaker` | `char_id` 或 `null` |
| `speaker_name` | 中文名或称呼 |
| `listener` | `char_id` 或 `null` |
| `text` | 对话原文，不要改写 |
| `tone` | 必须来自 `constants.md` 的 `dialogue_tone` |
| `chapter` | 章节号 |
| `line_start` / `line_end` | 对话所在行号 |

## Entity Registry

`entity_registry.json` 是唯一实体真相源，包含 6 个数组：`characters`、`skills`、`techniques`、`factions`、`locations`、`items`。

### characters

必填：`id`、`name`、`alias`、`identity`、`faction`、`role`、`archetype`、`rank`、`one_line`、`personality`、`relationships`、`known_skills`、`related_skills`、`rag_refs`、`source_refs`。

`personality`：`traits` 至少 5 项，另有 `speech_style`、`temperament`。

`relationships[]`：`{ "target": "char_id", "type": "关系类型", "intensity": 0-100, "bond_level": 1-5, "dynamic": "变化" }`。

### skills

必填：`id`、`name`、`type`、`faction`、`rank`、`one_line`、`techniques`、`progression`、`effects`、`combat_style`、`rag_refs`、`source_refs`。

`techniques` 至少 2 项；如果原文明确描述了更多招式，必须全部提取，不要截断到 2 项。每项含 `id`、`name`、`type`、`description`。

**禁止模板化 description**：technique 的 `description` 必须从原文提取真实内容。错误示例："降龙十八掌的代表性变化：亢龙有悔"。正确示例："洪七公传授的第一招，劲力刚猛，蓄而后发，留有余力"。

### techniques

必填：`id`、`name`、`type`、`description`、`source_skill`、`source_refs`。

### factions

必填：`id`、`name`、`type`、`location`、`sub_divisions`、`one_line`、`source_refs`。

### locations

必填：`id`、`name`、`region`、`one_line`、`source_refs`。

### items

必填：`id`、`name`、`type`、`owner`、`one_line`、`description`、`effects`、`origin`、`rarity`、`related_characters`、`related_skills`、`rag_refs`、`source_refs`。

`description` 至少 20 字。

## Entity Updates

用于本章对已有实体的变化：

```json
{
  "id": "char_xxx",
  "updates": { "rank": "出神入化", "source_refs": [] },
  "relationship_updates": [
    { "action": "add", "target": "char_yyy", "type": "挚友", "intensity": 60, "bond_level": 3, "dynamic": "初识" }
  ]
}
```

- 字段更新放 `updates`。
- 关系更新放 `relationship_updates`，`action` 只能是 `add` 或 `update`。
- `rank` 只在新值更高时更新；临时削弱写入描述，不降 rank。

## 最终输出

从 `entity_registry.json` 拆分 6 个实体文件，再从所有 `ch_NNN.json` 合并：

`characters.json`、`skills.json`、`techniques.json`、`factions.json`、`locations.json`、`items.json`、`dialogues.json`、`chapter_summaries.json`。
