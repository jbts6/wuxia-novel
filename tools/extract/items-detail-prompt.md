# 物品深度提取 Prompt

你是一个武侠小说数据提取器。请只根据本章原文，为指定物品补全深度信息。

## 输出要求

- 只输出合法 JSON，不要输出 Markdown、解释或代码块。
- 必须覆盖“本章物品索引”中的每一个 `id`。
- 不要修改物品 `id`。
- 信息不足时使用空字符串或空数组，不要编造原文无法支持的事实。
- `description` 至少 20 个中文字符，描述外观、材质、来历、使用方式或剧情意义。

## JSON Schema

```json
{
  "items_detail": [
    {
      "id": "item_xxx",
      "description": "物品详细描述",
      "effects": [
        {
          "type": "attack|defense|healing|poison|plot|utility|other",
          "value": "",
          "description": "效果说明"
        }
      ],
      "origin": "来源、制作者或首次出现背景",
      "related_characters": ["char_xxx"],
      "related_skills": ["skill_xxx"]
    }
  ]
}
```

## 本章物品索引

{{ITEM_INDEX}}

## 本章原文

{{CHAPTER_TEXT}}
