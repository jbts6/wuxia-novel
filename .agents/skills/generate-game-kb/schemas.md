# generate-game-kb 数据契约 v2

本文件是 AI 草稿与最终四类 JSON 的字段契约。每个阶段先读本文件。

## 通用规则

- AI 章节草稿使用章内 `local_key` 与名称型引用；域草稿只使用脚本提供的 `entry_ref`。
- 域蒸馏草稿禁止输出 `candidate_key`、`local_key`、最终 ID。
- source_refs 至少一条；chapter 必填，text 为原文锚点。
- 人物 level 只允许：核心、重要、次要、龙套、背景。
- 人物和武功都必须写 `power_rank`，八级固定。
- 招式必须有原著专名且 `named_in_source: true`。
- 不提取对话、事件、地点、势力。

## 章节草稿示例

```json
{
  "schema_version": 1,
  "chapter": 1,
  "title": "第一章 起始",
  "source_hash": "sha256:chapter",
  "characters": [
    {
      "local_key": "character:甲",
      "name": "甲",
      "level": "核心",
      "power_rank": "初窥门径",
      "source_refs": [{"chapter": 1, "text": "原文锚点"}]
    }
  ],
  "skills": [
    {
      "local_key": "skill:内功",
      "name": "玄门内功",
      "type": "内功",
      "power_rank": "炉火纯青",
      "source_refs": [{"chapter": 1, "text": "原文锚点"}]
    }
  ],
  "techniques": [
    {
      "local_key": "technique:飞掌",
      "name": "飞云掌",
      "named_in_source": true,
      "source_skill": "skill:内功",
      "source_refs": [{"chapter": 1, "text": "原文锚点"}]
    }
  ],
  "items": [
    {
      "local_key": "item:回生丹",
      "name": "回生丹",
      "inclusion_reason": "高级药毒",
      "source_refs": [{"chapter": 1, "text": "原文锚点"}]
    }
  ],
  "chapter_summary": {
    "title": "第一章 起始",
    "summary": "甲在山谷中与故人相逢。",
    "key_characters": ["甲"],
    "source_refs": [{"chapter": 1, "text": "原文锚点"}]
  }
}
```

## 域蒸馏草稿示例

```json
{
  "schema_version": 1,
  "unit": "distill:characters",
  "input_hash": "sha256:input",
  "decisions": [
    {
      "entry_ref": "characters:001",
      "action": "keep",
      "patch": {
        "level": "核心",
        "power_rank": "登堂入室",
        "biography": "甲在江湖中追查旧事。"
      }
    }
  ],
  "notes": []
}
```

action 只允许 `keep`、`merge`、`reject`、`pending`。

## 最终文件

### characters.json

```json
[
  {
    "id": "char_jia",
    "name": "甲",
    "aliases": [],
    "level": "核心",
    "identity": "侠客",
    "power_rank": "登堂入室",
    "biography": "甲在江湖中追查旧事。",
    "personality": {"traits": ["坚毅"], "speech_style": "简练"},
    "faction": null,
    "skills": ["skill_xuan_men_nei_gong"],
    "items": [],
    "source_refs": [{"chapter": 1, "text": "原文锚点"}]
  }
]
```

### skills.json

```json
[
  {
    "id": "skill_xuan_men_nei_gong",
    "name": "玄门内功",
    "type": "内功",
    "power_rank": "炉火纯青",
    "description": "调息养气。",
    "holders": ["char_jia"],
    "techniques": [
      {
        "id": "tech_fei_yun_zhang",
        "name": "飞云掌",
        "named_in_source": true,
        "description": "掌势迅疾。",
        "source_refs": [{"chapter": 1, "text": "原文锚点"}]
      }
    ],
    "source_refs": [{"chapter": 1, "text": "原文锚点"}]
  }
]
```

### items.json

```json
[
  {
    "id": "item_hui_sheng_dan",
    "name": "回生丹",
    "type": "丹药",
    "inclusion_reason": "高级药毒",
    "description": "用于救治重伤。",
    "related_characters": [],
    "related_skills": [],
    "source_refs": [{"chapter": 2, "text": "原文锚点"}]
  }
]
```

### chapter_summaries.json

```json
[
  {
    "chapter": 1,
    "title": "第1章",
    "summary": "第1章摘要。",
    "key_characters": ["甲"],
    "source_refs": [{"chapter": 1, "text": "原文锚点"}]
  }
]
```

## 验证规则

- 人物/武功必须有 power_rank
- 招式必须 named_in_source: true
- 普通物品不得进入 items
- 稳定 ID、引用闭包、证据章号必须完整
