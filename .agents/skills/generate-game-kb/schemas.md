# generate-game-kb 数据契约

本文件是 AI 草稿与最终九类 JSON 的单一字段契约。每个阶段先读本文件，再读对应提示词。示例均可被当前脚本验证。

## 目录

- [通用规则](#通用规则)
- [四域联合决策](#四域联合决策)
- [章节草稿示例](#章节草稿示例)
- [类别合并决策草稿示例](#类别合并决策草稿示例)
- [类别清理决策草稿示例](#类别清理决策草稿示例)
- [游戏素材选择草稿示例](#游戏素材选择草稿示例)
- [确定性组装产物](#确定性合并产物示例)
- [最终文件](#最终文件)
- [游戏素材索引示例](#游戏素材索引示例)
- [固定质量复核示例](#固定质量复核示例)
- [manual_review.json 示例](#manual_reviewjson-示例)

## 通用规则

- AI 章节草稿使用章内 `local_key`、`event_local_key` 与名称型引用；四域草稿只使用脚本提供的 `entry_ref` 与 `target_ref`。
- 四域语义草稿禁止出现 `candidate_key`、`local_key`、`registry_key`、最终 `id`、`*_id`、`*_ids`。私有 bindings、全书 local key、候选 ledger、source refs 并集、最终 ID 与引用重写全部由脚本生成。
- source_refs 至少一条；chapter 与非空 text 必填，line_start、line_end 可省略。章节草稿只能引用当前章；合并与清理可保留跨章、不连续引用。
- 人物 level 只允许：核心、重要、次要、龙套、背景。核心和重要保留详细 biography/personality；后三档 biography 不超过 200 个字符且 traits 最多 2 项。
- 物品 inclusion_reason 只允许：秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊。
- 招式必须有原著专名且 named_in_source 为 true；普通动作不入库，也不新增动作类别。原文明示所属武功时必须关联；原文未说明所属或归属时允许独立保留，最终 `source_skill` 为 null。非空武功引用必须解析到现有武功。
- 逐章对白提取关闭，章节草稿的 dialogues 必须写 `[]`。核心/重要事件仍标记 quote_status；不可引用时填写 quote_reason。最终保留 `dialogues.json` 兼容文件，默认内容为空数组。
- 章节接受后由脚本生成稳定 candidate_key（形如 `ch001:items:item:回生丹`）和确定性 coverage；AI 不生成最终 ID。

## 完整四域草稿示例

四个数组元素分别是 `plot`、`martial`、`items`、`world` 的独立完整草稿示例；真实提交一次只能写其中一个对象。每个输入 `entry_ref` 必须恰好裁决一次。

```json
[
  {
    "schema_version": 1,
    "semantic_contract_version": 2,
    "unit": "distill:plot",
    "input_hash": "sha256:plot",
    "decisions": [
      { "entry_ref": "plot:character:001", "action": "keep", "patch": { "level": "核心" } },
      { "entry_ref": "plot:event:001", "action": "keep", "patch": { "importance": "重要", "result": "双方结伴" } }
    ],
    "notes": []
  },
  {
    "schema_version": 1,
    "semantic_contract_version": 2,
    "unit": "distill:martial",
    "input_hash": "sha256:martial",
    "decisions": [
      { "entry_ref": "martial:skill:001", "action": "keep", "patch": { "type": "内功" } },
      { "entry_ref": "martial:technique:001", "action": "keep", "patch": { "source_skill_ref": "martial:skill:001" } },
      { "entry_ref": "martial:technique:002", "action": "keep", "patch": {} }
    ],
    "notes": []
  },
  {
    "schema_version": 1,
    "semantic_contract_version": 2,
    "unit": "distill:items",
    "input_hash": "sha256:items",
    "decisions": [
      { "entry_ref": "items:001", "action": "keep", "patch": { "inclusion_reason": "高级药毒" } }
    ],
    "notes": []
  },
  {
    "schema_version": 1,
    "semantic_contract_version": 2,
    "unit": "distill:world",
    "input_hash": "sha256:world",
    "decisions": [
      { "entry_ref": "world:faction:001", "action": "keep", "patch": { "type": "门派" } },
      { "entry_ref": "world:location:001", "action": "keep", "patch": { "region": "北地" } }
    ],
    "notes": []
  }
]
```

action 只允许 `keep`、`merge`、`reject`、`pending`。有限拒绝 reason 包括：

`pending` 表示草稿尚未完成；`accept` 会以 `DOMAIN_PENDING_UNRESOLVED` 拒绝且不写 accepted artifact。语义补救必须把它改成可闭合的 keep/merge/reject。

- characters：`duplicate_identity`、`not_character`、`background_only`。
- events：`duplicate_event`、`trivial_event`、`not_event`。
- dialogues：`duplicate_dialogue`、`ordinary_dialogue`、`not_dialogue`。
- skills：`duplicate_skill`、`unnamed_action`、`not_martial`。
- techniques：`duplicate_technique`、`ordinary_action`、`unnamed_action`、`not_technique`。
- items：`duplicate_item`、`ordinary_item`、`not_item`。
- factions/locations：`duplicate_faction`、`incidental_group`、`duplicate_location`、`incidental_location`。
- 所有类别还允许 `duplicate`、`not_source_grounded`。

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
  "dialogues": [],
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

章节对象固定含八类候选数组、一个 summary 和 coverage。`dialogues` 必须为 `[]`；其他候选至少含 local_key、name、source_refs，可按类别增加示例中的语义字段。source_hash 必须逐字复制 manifest 对应章节的 input_hash。coverage 由脚本接受时确定性重算。

## 类别合并决策草稿示例

普通 shard 的 AI 草稿只裁决一个类别工作项：

```json
{
  "schema_version": 1,
  "stage": "merge_decision",
  "unit": "merge:characters:001",
  "decisions": [
    {
      "entity_ref": "e0001",
      "member_refs": [
        "c0001",
        "c0002"
      ],
      "action": "merge",
      "canonical_name": "甲",
      "aliases": [
        "甲别名"
      ],
      "fields": {
        "level": "核心",
        "biography": "甲在江湖中追查旧事。"
      }
    }
  ],
  "ambiguities": []
}
```

每个输入短引用必须在 `decisions` 与 `ambiguities` 的 `member_refs` 中恰好出现一次。action 只允许 `merge`、`reject`、`ambiguous`。`reject` 使用有限拒绝 reason；`ambiguous` 必须有 detail 并阻断组装。`merge:<category>:consolidate` 使用同一输出形状，但 member_refs 来自初步实体的 `entity_ref`。对白 merge 的 `fields` 使用脚本提供的 `event_ref`，不生成事件 local key。

## 确定性合并产物示例

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
  "dialogues": [],
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

`assemble-merge` 根据已接受类别决定与私有 bindings 生成 stage=merged 对象。八类实体使用脚本生成的全书唯一 local_key；candidate_resolutions 闭合所有逐章候选，且每项只有 merged_to、rejected、ambiguous 之一。chapter_summaries 按 manifest 从已接受章节机械投影。AI 不复制或编辑本对象。

## 类别清理决策草稿示例

```json
{
  "schema_version": 1,
  "stage": "clean_decision",
  "unit": "clean:characters:001",
  "decisions": [
    {
      "entity_ref": "e0001",
      "action": "edit",
      "patch": {
        "biography": "甲在江湖中追查旧事。"
      },
      "resolves": [
        "o0001"
      ]
    },
    {
      "entity_ref": "e0002",
      "action": "keep",
      "resolves": []
    }
  ],
  "quantity_explanation": null
}
```

每个输入 `entity_ref` 必须恰好裁决一次。action 只允许 `keep`、`edit`、`merge_into`、`drop`；所有决定都含 `resolves`。patch 只含当前类别允许的语义字段。`merge_into` 的 target_ref 必须属于同一工作项，reason 固定为 duplicate；drop 使用有限拒绝 reason。命名功法/招式与核心/重要人物禁止直接 drop。声称解决 obligation 但组装后义务仍存在会被拒绝。

## 游戏素材选择草稿示例

```json
{
  "schema_version": 1,
  "stage": "material_decision",
  "unit": "clean:materials:001",
  "materials": [
    {
      "material_type": "战斗系统原型",
      "source_ref": "m0001",
      "relevance": "高",
      "suggested_use": "内功系统原型",
      "reason": "原著明确命名。"
    }
  ]
}
```

素材 AI 只读取所有实体清理完成后生成的紧凑 catalog，并引用其中的 source_ref。脚本用私有 bindings 展开 source_category、source_name 和最终 source_id；草稿不得嵌入事实记录。

## 确定性清理产物示例

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
  "dialogues": [],
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

`assemble-clean` 根据类别决定、材料短引用决定与私有 bindings 生成 stage=cleaned 对象，且 ambiguities 必须为空。脚本机械迁移 candidate_resolutions；quantity_review 汇总各类别说明；game_material_candidates 只指向已保留实体。AI 不复制或编辑本对象。

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
    "named_in_source": true,
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
[]
```

逐章对白关闭后该兼容文件默认为空数组。

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
      "material_type": "标志性物品",
      "source_id": "item_hui_sheng_dan",
      "relevance": "高",
      "suggested_use": "丹药原型",
      "reason": "高级丹药。"
    },
    {
      "material_type": "角色原型/彩蛋",
      "source_id": "char_jia",
      "relevance": "中",
      "suggested_use": "侠客彩蛋",
      "reason": "人物定位鲜明。"
    },
    {
      "material_type": "经典剧情桥段",
      "source_id": "event_shan_zhong_xiang_feng",
      "relevance": "高",
      "suggested_use": "奇遇桥段",
      "reason": "事件跨章推进。"
    },
    {
      "material_type": "门派与世界观素材",
      "source_id": "faction_xuan_men",
      "relevance": "高",
      "suggested_use": "门派原型",
      "reason": "原著门派。"
    },
    {
      "material_type": "战斗系统原型",
      "source_id": "skill_xuan_men_nei_gong",
      "relevance": "高",
      "suggested_use": "内功原型",
      "reason": "原著明确命名。"
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
