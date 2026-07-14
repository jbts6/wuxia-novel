# generate-game-kb 数据契约

## 章节草稿

每个章节草稿必须是一个 JSON 对象，包含：

```json
{
  "schema_version": 1,
  "chapter": 1,
  "title": "第一章 起始",
  "source_hash": "sha256:章节输入哈希",
  "characters": [],
  "events": [],
  "items": [],
  "skills": [],
  "techniques": [],
  "factions": [],
  "locations": [],
  "dialogues": [],
  "summary": {
    "title": "第一章 起始",
    "summary": "本章摘要",
    "key_events": [],
    "key_characters": [],
    "source_refs": [{ "chapter": 1, "text": "短原文锚点" }]
  }
}
```

命名候选使用 `local_key` 和原著 `name`。章节、合并和清理草稿禁止出现最终 `id`、`*_id` 或 `*_ids`。跨类关联使用 `*_name`、`*_names` 或本地键。

`source_refs` 的 `chapter` 和非空 `text` 必填；`line_start`、`line_end` 可省略。章节草稿只能引用当前章。最终跨章事件可保留多个不连续章节引用。

招式候选必须同时有正式原名和 `named_in_source: true`。普通攻击、移动、姿态和“全力一挥”一类动作不能作为招式，也不新增动作类别。

对白使用 `event_local_key` 关联本章事件；同一事件最多一条对白。

人物等级只允许 `核心`、`重要`、`次要`、`龙套`、`背景`。只有前两级需要详细信息，其余等级保持兼容字段但内容简略。

重要物品准入理由只允许 `秘籍`、`剧情关键`、`高级药毒`、`神兵利器`、`其他稀有特殊`。

## 最终文件

最终目录固定包含九个顶层数组文件：`characters.json`、`events.json`、`items.json`、`skills.json`、`techniques.json`、`factions.json`、`locations.json`、`dialogues.json`、`chapter_summaries.json`。AI 不生成最终 ID；`build-final` 统一投影并重写引用。
