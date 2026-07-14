# generate-game-kb 数据契约

本文件是 AI 草稿与最终九类 JSON 的单一字段契约。每个阶段先读本文件，再读对应提示词。示例均可被当前脚本验证。

## 目录

- [通用规则](#通用规则)
- [章节草稿示例](#章节草稿示例)
- [合并草稿示例](#合并草稿示例)
- [清理草稿示例](#清理草稿示例)
- [最终文件](#最终文件)
- [游戏素材索引示例](#游戏素材索引示例)
- [固定质量复核示例](#固定质量复核示例)
- [manual_review.json 示例](#manual_reviewjson-示例)

## 通用规则

- AI 产生的章节、合并、清理草稿只用名称型引用：local_key、event_key、event_local_key、*_name、*_names。禁止出现最终 id、*_id、*_ids。
- source_refs 至少一条；chapter 与非空 text 必填，line_start、line_end 可省略。章节草稿只能引用当前章；合并与清理可保留跨章、不连续引用。
- 人物 level 只允许：核心、重要、次要、龙套、背景。核心和重要保留详细 biography/personality；后三档 biography 不超过 200 个字符且 traits 最多 2 项。
- 物品 inclusion_reason 只允许：秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊。
- 招式必须有原著专名且 named_in_source 为 true；普通动作不入库，也不新增动作类别。
- 最终每个事件最多一条对白；章节草稿允许同一事件保留多条对白候选。核心/重要事件必须标记 quote_status；不可引用时填写 quote_reason。章节草稿用 event_local_key；合并和清理用 event_key；对白 source_refs 只能引用 dialogue.chapter。
- 章节接受后由脚本生成稳定 candidate_key（形如 `ch001:items:item:回生丹`）和确定性 coverage；AI 不生成最终 ID。

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
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "events": [
    {
      "local_key": "event:相逢",
      "name": "山中相逢",
      "importance": "重要",
      "quote_status": "quotable",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "items": [
    {
      "local_key": "item:回生丹",
      "name": "回生丹",
      "inclusion_reason": "高级药毒",
      "source_refs": [
        {
          "chapter": 1,
          "text": "回生丹"
        }
      ]
    }
  ],
  "skills": [
    {
      "local_key": "skill:内功",
      "name": "玄门内功",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "techniques": [
    {
      "local_key": "technique:飞掌",
      "name": "飞云掌",
      "named_in_source": true,
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "factions": [
    {
      "local_key": "faction:玄门",
      "name": "玄门",
      "source_refs": [
        {
          "chapter": 1,
          "text": "玄门"
        }
      ]
    }
  ],
  "locations": [
    {
      "local_key": "location:山谷",
      "name": "无名山谷",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "dialogues": [
    {
      "local_key": "dialogue:相逢",
      "event_local_key": "event:相逢",
      "speaker_name": "甲",
      "text": "你来了。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "summary": {
    "title": "第一章 起始",
    "summary": "甲在山谷中与故人相逢。",
    "key_events": [
      "event:相逢"
    ],
    "key_characters": [
      "甲"
    ],
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  },
  "coverage": {}
}
```

章节对象固定含八类候选数组、一个 summary 和 coverage。候选至少含 local_key、name、source_refs；可按类别增加示例中的语义字段。source_hash 必须逐字复制 manifest 对应章节的 input_hash。coverage 由脚本接受时确定性重算。

## 合并草稿示例

```json
{
  "schema_version": 1,
  "stage": "merged",
  "characters": [
    {
      "local_key": "character:甲",
      "canonical_name": "甲",
      "aliases": [],
      "level": "核心",
      "identity": "侠客",
      "biography": "甲在江湖中追查旧事。",
      "personality": {
        "traits": [
          "坚毅"
        ],
        "speech_style": "简练"
      },
      "relationship_names": [],
      "skill_names": [
        "玄门内功"
      ],
      "item_names": [],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "events": [
    {
      "local_key": "event:相逢",
      "canonical_name": "山中相逢",
      "cause": "追查线索",
      "process": "山谷会面",
      "result": "交换消息",
      "participant_names": [
        "甲"
      ],
      "location_names": [
        "无名山谷"
      ],
      "importance": "重要",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        },
        {
          "chapter": 3,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "items": [
    {
      "local_key": "item:灵丹",
      "canonical_name": "回生丹",
      "inclusion_reason": "高级药毒",
      "type": "丹药",
      "description": "用于救治重伤。",
      "source_refs": [
        {
          "chapter": 2,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "skills": [
    {
      "local_key": "skill:内功",
      "canonical_name": "玄门内功",
      "type": "内功",
      "description": "调息养气。",
      "holder_names": [
        "甲"
      ],
      "technique_names": [
        "飞云掌"
      ],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "techniques": [
    {
      "local_key": "technique:飞掌",
      "canonical_name": "飞云掌",
      "named_in_source": true,
      "source_skill_name": "玄门内功",
      "description": "掌势迅疾。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "factions": [
    {
      "local_key": "faction:玄门",
      "canonical_name": "玄门",
      "type": "门派",
      "description": "隐居山中。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "locations": [
    {
      "local_key": "location:山谷",
      "canonical_name": "无名山谷",
      "region": "北地",
      "description": "群山环抱。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "dialogues": [
    {
      "local_key": "dialogue:相逢",
      "event_key": "event:相逢",
      "speaker_name": "甲",
      "chapter": 1,
      "text": "你终于来了。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "chapter_summaries": [
    {
      "chapter": 1,
      "title": "第1章",
      "summary": "第1章摘要。",
      "key_events": [
        "山中相逢"
      ],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    },
    {
      "chapter": 2,
      "title": "第2章",
      "summary": "第2章摘要。",
      "key_events": [],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 2,
          "text": "原文锚点"
        }
      ]
    },
    {
      "chapter": 3,
      "title": "第3章",
      "summary": "第3章摘要。",
      "key_events": [],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 3,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "candidate_resolutions": [],
  "ambiguities": []
}
```

合并对象固定为 stage=merged，八类实体改用 canonical_name，可带 aliases，并把章内键归并为全书唯一 local_key。candidate_resolutions 必须闭合所有逐章候选，且每项只有 merged_to、rejected、ambiguous 之一。chapter_summaries 必须覆盖 manifest 每一章且每章恰好一条。ambiguities 只记录尚不能唯一裁决的问题。

## 清理草稿示例

```json
{
  "schema_version": 1,
  "stage": "cleaned",
  "characters": [
    {
      "local_key": "character:甲",
      "canonical_name": "甲",
      "aliases": [],
      "level": "核心",
      "identity": "侠客",
      "biography": "甲在江湖中追查旧事。",
      "personality": {
        "traits": [
          "坚毅"
        ],
        "speech_style": "简练"
      },
      "relationship_names": [],
      "skill_names": [
        "玄门内功"
      ],
      "item_names": [],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "events": [
    {
      "local_key": "event:相逢",
      "canonical_name": "山中相逢",
      "cause": "追查线索",
      "process": "山谷会面",
      "result": "交换消息",
      "participant_names": [
        "甲"
      ],
      "location_names": [
        "无名山谷"
      ],
      "importance": "重要",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        },
        {
          "chapter": 3,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "items": [
    {
      "local_key": "item:灵丹",
      "canonical_name": "回生丹",
      "inclusion_reason": "高级药毒",
      "type": "丹药",
      "description": "用于救治重伤。",
      "source_refs": [
        {
          "chapter": 2,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "skills": [
    {
      "local_key": "skill:内功",
      "canonical_name": "玄门内功",
      "type": "内功",
      "description": "调息养气。",
      "holder_names": [
        "甲"
      ],
      "technique_names": [
        "飞云掌"
      ],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "techniques": [
    {
      "local_key": "technique:飞掌",
      "canonical_name": "飞云掌",
      "named_in_source": true,
      "source_skill_name": "玄门内功",
      "description": "掌势迅疾。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "factions": [
    {
      "local_key": "faction:玄门",
      "canonical_name": "玄门",
      "type": "门派",
      "description": "隐居山中。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "locations": [
    {
      "local_key": "location:山谷",
      "canonical_name": "无名山谷",
      "region": "北地",
      "description": "群山环抱。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "dialogues": [
    {
      "local_key": "dialogue:相逢",
      "event_key": "event:相逢",
      "speaker_name": "甲",
      "chapter": 1,
      "text": "你终于来了。",
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "chapter_summaries": [
    {
      "chapter": 1,
      "title": "第1章",
      "summary": "第1章摘要。",
      "key_events": [
        "山中相逢"
      ],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 1,
          "text": "原文锚点"
        }
      ]
    },
    {
      "chapter": 2,
      "title": "第2章",
      "summary": "第2章摘要。",
      "key_events": [],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 2,
          "text": "原文锚点"
        }
      ]
    },
    {
      "chapter": 3,
      "title": "第3章",
      "summary": "第3章摘要。",
      "key_events": [],
      "key_characters": [
        "甲"
      ],
      "source_refs": [
        {
          "chapter": 3,
          "text": "原文锚点"
        }
      ]
    }
  ],
  "candidate_resolutions": [],
  "ambiguities": [],
  "quantity_review": {
    "consumed": true,
    "explanations": [
      "数量只作一次提醒，未为凑数新增条目。"
    ]
  },
  "game_material_candidates": [
    {
      "material_type": "战斗系统原型",
      "source_category": "skills",
      "source_name": "玄门内功",
      "relevance": "高",
      "suggested_use": "内功原型",
      "reason": "原著明确命名。"
    },
    {
      "material_type": "经典剧情桥段",
      "source_category": "events",
      "source_name": "山中相逢",
      "relevance": "高",
      "suggested_use": "奇遇桥段",
      "reason": "事件跨章推进。"
    },
    {
      "material_type": "角色原型/彩蛋",
      "source_category": "characters",
      "source_name": "甲",
      "relevance": "中",
      "suggested_use": "侠客彩蛋",
      "reason": "人物定位鲜明。"
    },
    {
      "material_type": "标志性物品",
      "source_category": "items",
      "source_name": "回生丹",
      "relevance": "高",
      "suggested_use": "丹药原型",
      "reason": "高级丹药。"
    },
    {
      "material_type": "门派与世界观素材",
      "source_category": "factions",
      "source_name": "玄门",
      "relevance": "高",
      "suggested_use": "门派原型",
      "reason": "原著门派。"
    }
  ]
}
```

清理对象固定为 stage=cleaned，且 ambiguities 必须为空。candidate_resolutions 必须反映清理删除的候选及其有限拒绝理由。quantity_review.consumed 必须为 true；explanations 记录一次数量复核的保留、删除或不调整理由。game_material_candidates 只能引用已保留实体的 source_category 与 source_name，不能嵌入实体副本。

## 最终文件

build-final 根据清理草稿稳定生成以下九个顶层数组，并一次性投影最终 ID 与引用。AI 不得手写这些数组。

### 人物 / characters.json 示例

```json
[
  {
    "id": "char_jia",
    "name": "甲",
    "alias": [],
    "aliases": [],
    "identity": "侠客",
    "role": "核心",
    "archetype": "",
    "power_rank": "",
    "faction": null,
    "importance": "核心",
    "one_line": "甲在江湖中追查旧事。",
    "bio": "甲在江湖中追查旧事。",
    "biography": "甲在江湖中追查旧事。",
    "personality": {
      "traits": [
        "坚毅"
      ],
      "speech_style": "简练",
      "temperament": ""
    },
    "relationships": [],
    "known_skills": [
      "skill_xuan_men_nei_gong"
    ],
    "related_skills": [
      "skill_xuan_men_nei_gong"
    ],
    "skills": [
      "skill_xuan_men_nei_gong"
    ],
    "items": [],
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 事件 / events.json 示例

```json
[
  {
    "id": "event_shan_zhong_xiang_feng",
    "name": "山中相逢",
    "cause": "追查线索",
    "process": "山谷会面",
    "result": "交换消息",
    "participants": [
      "char_jia"
    ],
    "locations": [
      "loc_wu_ming_shan_gu"
    ],
    "importance": "重要",
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      },
      {
        "chapter": 3,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 物品 / items.json 示例

```json
[
  {
    "id": "item_hui_sheng_dan",
    "name": "回生丹",
    "type": "丹药",
    "tags": [],
    "importance": "高级药毒",
    "inclusion_reason": "高级药毒",
    "owner": null,
    "description": "用于救治重伤。",
    "one_line": "用于救治重伤。",
    "effects": [],
    "related_characters": [],
    "related_skills": [],
    "rarity_tier": "未知",
    "source_refs": [
      {
        "chapter": 2,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 功法 / skills.json 示例

```json
[
  {
    "id": "skill_xuan_men_nei_gong",
    "name": "玄门内功",
    "type": "内功",
    "faction": null,
    "mastery_rank": "",
    "description": "调息养气。",
    "one_line": "调息养气。",
    "holders": [
      "char_jia"
    ],
    "techniques": [
      "tech_fei_yun_zhang"
    ],
    "progression": "",
    "effects": [],
    "combat_style": "",
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 招式 / techniques.json 示例

```json
[
  {
    "id": "tech_fei_yun_zhang",
    "name": "飞云掌",
    "skill": "skill_xuan_men_nei_gong",
    "source_skill": "skill_xuan_men_nei_gong",
    "type": "",
    "description": "掌势迅疾。",
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 门派与势力 / factions.json 示例

```json
[
  {
    "id": "faction_xuan_men",
    "name": "玄门",
    "type": "门派",
    "location": null,
    "leader": null,
    "description": "隐居山中。",
    "one_line": "隐居山中。",
    "members": [],
    "sub_organizations": [],
    "sub_divisions": [],
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 地点 / locations.json 示例

```json
[
  {
    "id": "loc_wu_ming_shan_gu",
    "name": "无名山谷",
    "region": "北地",
    "description": "群山环抱。",
    "one_line": "群山环抱。",
    "factions": [],
    "characters": [],
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 对白 / dialogues.json 示例

```json
[
  {
    "id": "dialogue_xodlameec",
    "event_id": "event_shan_zhong_xiang_feng",
    "speaker": "char_jia",
    "speaker_name": "甲",
    "listener": null,
    "chapter": 1,
    "text": "你终于来了。",
    "tone": "",
    "context": "",
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  }
]
```

### 章节摘要 / chapter_summaries.json 示例

```json
[
  {
    "chapter": 1,
    "title": "第1章",
    "summary": "第1章摘要。",
    "key_events": [
      "event_shan_zhong_xiang_feng"
    ],
    "key_characters": [
      "char_jia"
    ],
    "source_refs": [
      {
        "chapter": 1,
        "text": "原文锚点"
      }
    ]
  },
  {
    "chapter": 2,
    "title": "第2章",
    "summary": "第2章摘要。",
    "key_events": [],
    "key_characters": [
      "char_jia"
    ],
    "source_refs": [
      {
        "chapter": 2,
        "text": "原文锚点"
      }
    ]
  },
  {
    "chapter": 3,
    "title": "第3章",
    "summary": "第3章摘要。",
    "key_events": [],
    "key_characters": [
      "char_jia"
    ],
    "source_refs": [
      {
        "chapter": 3,
        "text": "原文锚点"
      }
    ]
  }
]
```

## 游戏素材索引示例

```json
{
  "schema_version": 1,
  "entries": [
    {
      "material_type": "战斗系统原型",
      "source_id": "skill_xuan_men_nei_gong",
      "relevance": "高",
      "suggested_use": "内功原型",
      "reason": "原著明确命名。"
    },
    {
      "material_type": "标志性物品",
      "source_id": "item_hui_sheng_dan",
      "relevance": "高",
      "suggested_use": "丹药原型",
      "reason": "高级丹药。"
    },
    {
      "material_type": "经典剧情桥段",
      "source_id": "event_shan_zhong_xiang_feng",
      "relevance": "高",
      "suggested_use": "奇遇桥段",
      "reason": "事件跨章推进。"
    },
    {
      "material_type": "角色原型/彩蛋",
      "source_id": "char_jia",
      "relevance": "中",
      "suggested_use": "侠客彩蛋",
      "reason": "人物定位鲜明。"
    },
    {
      "material_type": "门派与世界观素材",
      "source_id": "faction_xuan_men",
      "relevance": "高",
      "suggested_use": "门派原型",
      "reason": "原著门派。"
    }
  ]
}
```

reports/game_materials.json 是九类事实数据的索引，不是第十类实体。source_id 必须解析到九类数组中的现有记录；material_type 只允许战斗系统原型、经典剧情桥段、角色原型/彩蛋、标志性物品、门派与世界观素材。

## 固定质量复核示例

```json
{
  "schema_version": 1,
  "results": [
    {
      "id": "skill_xuan_men_nei_gong",
      "passed": true,
      "checks": {
        "name": true,
        "category": true,
        "key_facts": true,
        "chapter": true
      },
      "notes": ""
    }
  ]
}
```

quality:sample 必须逐条复核脚本固定的全部样本。passed 等于四项检查全部为 true；不得增删样本或更改 ID。

## manual_review.json 示例

```json
{
  "unit": "chapter:003",
  "input_hash": "sha256:chapter-input",
  "attempts": 3,
  "stop_reason": "ATTEMPTS_EXHAUSTED",
  "errors": [
    {
      "code": "SOURCE_CHAPTER_MISMATCH",
      "path": "events[0].source_refs[0].chapter",
      "target": "2"
    }
  ],
  "suggested_action": "Inspect chapter:003; reset only with reset-unit --unit chapter:003 --confirm"
}
```

实际 manual_review.json 是上述问题对象的数组；空数组表示没有人工阻断项。manual_review 是停止自动纠错的终态，只有用户明确检查后才可确认 reset-unit。

## 定向补漏草稿

`recall:<category>` 和 `supplement:<category>` 草稿只允许包含一个目标类别数组；补漏不得生成最终 `id`。每条记录沿用对应类别的章节候选或合并字段，并保留 `source_refs`。物品类别可以在确定没有合格条目时保留持久化复核：

```json
{
  "items": [],
  "none_found": {
    "chapters": [1, 2, 3],
    "conclusion": "none_found",
    "reason": "指定章节只有普通日用品。"
  }
}
```

补漏接受后只写入 `accepted/recalls/<category>.json` 或 `accepted/supplements/<category>.json`，再由脚本生成 `materialized/candidates.json` 或 `materialized/merged-with-supplements.json`。`materialized/` 不是事实源，不能反向覆盖任何 accepted 文件。

## 缺口报告

`reports/coverage.json` 和 `reports/candidate-resolution.json` 必须是确定性 JSON，包含 `blocking_gaps` 以及受影响的 `recall_units` 或 `supplement_units`。报告不得包含可执行的 `next_action`、`command` 或自动重试字段。`progress.json` 中定向单元另行持久化 `semantic_attempts`、`semantic_hash` 和 `format_attempts`；重启后这些值不得清零。
