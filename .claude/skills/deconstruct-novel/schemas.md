# JSON Schema

## JSON 格式安全规则

**原文引号必须原样保留。** 中文小说使用全角引号 `""`（如 `"你好"`），这些引号直接写入 JSON 字符串值即可，**不要转义、不要替换为 ASCII `"`**。

全角引号（U+201C `"`、U+201D `"`）与 JSON 语法的 ASCII 双引号（U+0022 `"`）是完全不同的 Unicode 字符，不会冲突。

```json
// ✅ 正确：全角引号原样保留
{"text": "他说："你好。""}

// ❌ 错误：转义了全角引号
{"text": "他说：\u201c你好。\u201d"}

// ❌ 错误：全角引号被替换为 ASCII 引号（破坏 JSON）
{"text": "他说："你好。""}
```

**写入每个 JSON 文件后，务必验证格式正确：**
```javascript
// 在 ctx_execute 中验证
const data = JSON.parse(fs.readFileSync('characters.json', 'utf8'));
console.log(`characters.json: ${data.length} 个实体，格式正确`);
```

---

## entity_registry.json（唯一真相源）

所有实体的完整数据存储在此文件中。每章提取时更新，最终从中拆分出输出文件。

```json
{
  "characters": [
    {
      "id": "char_xxx",
      "name": "中文名",
      "alias": ["别名"],
      "identity": "身份",
      "faction": "faction_id或null",
      "role": "protagonist/companion/npc/villain",
      "archetype": "scholar/warrior/monk/assassin/healer",
      "rank": "等级",
      "one_line": "一句话描述",
      "personality": {
        "traits": ["特征1", "特征2", "特征3", "特征4", "特征5"],
        "speech_style": "说话风格",
        "temperament": "气质描述"
      },
      "relationships": [
        {"target": "char_id", "type": "关系类型", "intensity": 0-100, "bond_level": 1-5, "dynamic": "关系变化"}
      ],
      "known_skills": ["skill_id"],
      "related_skills": ["skill_id"],
      "rag_refs": [章节号],
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ],
  "skills": [
    {
      "id": "skill_xxx",
      "name": "武功名",
      "type": "剑法/掌法/内功/轻功/暗器/指法",
      "faction": "faction_id或空字符串",
      "rank": "等级",
      "one_line": "一句话描述",
      "rag_refs": [章节号],
      "techniques": [
        {"id": "tech_xxx", "name": "招式名", "type": "attack/defense/buff/debuff/feint/special", "description": "详细描述"}
      ],
      "progression": [{"level": 1-5, "unlock": "功力层级描述"}],
      "effects": [{"type": "伤害/控制/增益/减益/特殊", "condition": "触发条件", "description": "效果描述"}],
      "combat_style": "战斗风格描述",
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ],
  "techniques": [
    {
      "id": "tech_xxx",
      "name": "招式名",
      "type": "attack/defense/buff/debuff/feint/special",
      "description": "详细描述",
      "source_skill": "skill_id",
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ],
  "factions": [
    {
      "id": "faction_xxx",
      "name": "名字",
      "type": "武林门派/帮派/家族",
      "location": "loc_id",
      "sub_divisions": ["分支"],
      "one_line": "描述",
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ],
  "locations": [
    {
      "id": "loc_xxx",
      "name": "名字",
      "region": "地理区域",
      "one_line": "描述",
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ],
  "items": [
    {
      "id": "item_xxx",
      "name": "物品名",
      "type": "weapon/armor/pill/poison/hidden_weapon/special",
      "owner": "char_id",
      "one_line": "描述",
      "description": "详细描述（至少20字）",
      "effects": [{"type": "攻击/防御/毒药/剧情/特殊", "value": "数值或空", "description": "效果描述"}],
      "origin": "来源或制作者",
      "rarity": "绝世神兵/稀世珍品/上乘佳品/寻常凡品",
      "related_characters": ["char_id"],
      "related_skills": ["skill_id"],
      "rag_refs": [章节号],
      "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
    }
  ]
}
```

---

## ch_N.json（章级 delta 文件）

每章处理完成后写入 `batch_json/ch_N.json`，仅包含**增量变更**，不重复 registry 中已有的完整数据。

```json
{
  "chapter": 5,
  "chapter_summary": "本章讲述了...（约200字的剧情摘要，概括本章主要情节、关键冲突和角色变化）",
  "dialogues": [
    {
      "speaker": "char_id",
      "speaker_name": "说话人名字",
      "listener": "char_id或null",
      "text": "对话原文",
      "tone": "语气（从 constants.md 的 dialogue_tone 枚举中选择；只取情绪/语气，不取动作描写；无法判断用"陈述"）",
      "chapter": 5
    }
  ],
  "new_entities": {
    "characters": [
      {
        "id": "char_ah_fei",
        "name": "阿飞",
        "alias": [],
        "identity": "剑客",
        "faction": null,
        "role": "companion",
        "archetype": "warrior",
        "rank": "出神入化",
        "one_line": "快剑无双的少年剑客",
        "personality": {
          "traits": ["孤傲", "直率", "忠诚", "沉默", "决绝"],
          "speech_style": "言简意赅",
          "temperament": "冷峻"
        },
        "relationships": [],
        "known_skills": ["skill_kuai_jian"],
        "related_skills": [],
        "rag_refs": [5],
        "source_refs": [{"chapter": 5, "line_start": 10, "line_end": 15, "text": "原文片段"}]
      }
    ],
    "skills": [],
    "techniques": [],
    "factions": [],
    "locations": [],
    "items": []
  },
  "entity_updates": [
    {
      "id": "char_li_xun_huan",
      "updates": {
        "rank": "出神入化",
        "rag_refs": [5],
        "source_refs": [{"chapter": 5, "line_start": 20, "line_end": 25, "text": "原文片段"}]
      }
    },
    {
      "id": "char_li_xun_huan",
      "relationship_updates": [
        {
          "action": "add",
          "target": "char_ah_fei",
          "type": "挚友",
          "intensity": 60,
          "bond_level": 3,
          "dynamic": "初识，互有好感"
        }
      ]
    },
    {
      "id": "char_gao_tong",
      "relationship_updates": [
        {
          "action": "update",
          "target": "char_yan_shi_san",
          "type": "宿敌",
          "intensity": 90,
          "bond_level": 5,
          "dynamic": "决斗后敌意加深"
        }
      ]
    }
  ]
}
```

### delta 文件说明

- **chapter_summary**：本章剧情摘要（约200字）
- **dialogues**：本章全部对话
- **new_entities**：本章新发现的实体（registry 中不存在的）
- **entity_updates**：已有实体在本章的变化

**entity_updates 包含两种更新：**

1. **字段更新**（`updates` 对象）：rank 提升、新来源等
   ```json
   {"id": "char_xxx", "updates": {"rank": "出神入化", "source_refs": [...]}}
   ```

2. **关系更新**（`relationship_updates` 数组）：
   - `action: "add"` — 新增关系（registry 中不存在该 target+type 的关系）
   - `action: "update"` — 更新已有关系的 intensity/bond_level/dynamic
   ```json
   {
     "id": "char_xxx",
     "relationship_updates": [
       {"action": "add", "target": "char_yyy", "type": "挚友", "intensity": 60, "bond_level": 3, "dynamic": "初识"},
       {"action": "update", "target": "char_zzz", "type": "宿敌", "intensity": 90, "bond_level": 5, "dynamic": "决斗后敌意加深"}
     ]
   }
   ```

**rank 更新时：** 对比 registry 中的当前值，只在新值更高时才更新（巅峰状态原则）。临时削弱不更新 rank，记在 one_line 或 description 中。

---

## 最终输出文件

从 entity_registry.json 拆分得到 6 个文件，格式与 registry 中对应数组完全一致：

| 文件                | 内容                           |
| ------------------- | ------------------------------ |
| `characters.json`     | registry.characters            |
| `skills.json`         | registry.skills                |
| `techniques.json`     | registry.techniques            |
| `factions.json`       | registry.factions              |
| `locations.json`      | registry.locations             |
| `items.json`          | registry.items                 |
| `dialogues.json`      | 代码合并所有 ch_N.json 的 dialogues  |
| `chapter_summaries.json` | 代码合并所有 ch_N.json 的 chapter_summary |
