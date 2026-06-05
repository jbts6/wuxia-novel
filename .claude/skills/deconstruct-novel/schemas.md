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
```bash
node -e "JSON.parse(require('fs').readFileSync('characters.json','utf8'))"
```

---

## characters.json
```json
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
```

## skills.json
```json
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
```

## techniques.json
```json
{
  "id": "tech_xxx",
  "name": "招式名",
  "type": "attack/defense/buff/debuff/feint/special",
  "description": "详细描述",
  "source_skill": "skill_id",
  "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
}
```

## factions.json
```json
{
  "id": "faction_xxx",
  "name": "名字",
  "type": "武林门派/帮派/家族",
  "location": "loc_id",
  "sub_divisions": ["分支"],
  "one_line": "描述",
  "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
}
```

## locations.json
```json
{
  "id": "loc_xxx",
  "name": "名字",
  "region": "地理区域",
  "one_line": "描述",
  "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
}
```

## items.json
```json
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
```

## events.json
```json
{
  "id": "evt_N_序号",
  "name": "事件名",
  "participants": ["char_id"],
  "location": "loc_id",
  "description": "事件描述（至少20字）",
  "chapter": N,
  "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
}
```

## dialogues.json
```json
{
  "speaker": "char_id",
  "speaker_name": "说话人名字",
  "listener": "char_id或null",
  "text": "对话原文",
  "tone": "语气标签",
  "chapter": N
}
```

> speaker 提取规则见 `dialogue-rules.md`

---

## 批次输出格式

每批处理完成后写入 `batch_json/batch_N.json`（N 从 1 开始），格式如下：

```json
{
  "batch_id": 1,
  "chapters": [1, 2, 3, 4, 5],
  "chapter_count": 5,
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
  "skills": [ /* 同最终 schemas.md 中 skills.json 格式 */ ],
  "techniques": [ /* 同最终 schemas.md 中 techniques.json 格式 */ ],
  "factions": [ /* 同最终 schemas.md 中 factions.json 格式 */ ],
  "locations": [ /* 同最终 schemas.md 中 locations.json 格式 */ ],
  "items": [ /* 同最终 schemas.md 中 items.json 格式 */ ],
  "events": [ /* 同最终 schemas.md 中 events.json 格式 */ ],
  "dialogues": [ /* 同最终 schemas.md 中 dialogues.json 格式 */ ]
}
```

**注意：** 批次输出格式与最终 JSON 格式一致，只是包裹在 `batch_id`/`chapters` 元数据中。合并时提取内部数组即可。

**写入 batch_N.json 后，必须验证 JSON 格式正确（全角引号未被转义）：**
```bash
node -e "JSON.parse(require('fs').readFileSync('batch_json/batch_1.json','utf8'))"
```

---

## 合并规则表

Sub Agent 合并时，按以下规则处理跨批次的同一实体：

### 通用规则

- **唯一键**：各实体以 `id` 为唯一标识
- **同 id 合并**：不同 batch 中出现的同 id 实体视为同一实体的不同侧面
- **语义去重**：AI 需理解语义，不能仅做字符串比较（如"冷峻"和"孤傲"是不同特征）

### characters 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 首次出现最准确，后续不变 |
| `alias` | `append_dedup` | 别名只增不减 |
| `identity`, `faction`, `archetype` | `keep_first` | 身份/门派/原型首次出现最准确 |
| `role` | `override` | 角色定位可能随剧情变化 |
| `rank` | `override` | 等级会提升，取最新批次的值 |
| `one_line` | `override` | 后续描述更精准 |
| `personality.traits` | `append_dedup` | 新特征追加，AI 判断语义去重 |
| `personality.speech_style` | `override` | 后续描述更完整 |
| `personality.temperament` | `override` | 后续描述更完整 |
| `relationships` | `append_dedup_by_target_type` | 按 target+type 去重，intensity/bond_level/dynamic 取最新 |
| `known_skills` | `append` | 技能只增不减 |
| `related_skills` | `append` | 技能只增不减 |
| `rag_refs` | `append_dedup` | 章节号只增不减 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### skills 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 首次出现最准确 |
| `type`, `faction` | `keep_first` | 类型和所属门派不变 |
| `rank` | `override` | 等级会变化 |
| `one_line`, `combat_style` | `override` | 后续描述更完整 |
| `rag_refs` | `append_dedup` | 章节号只增不减 |
| `techniques` | `append_dedup_by_id` | 按招式 id 去重，description 取最新 |
| `progression` | `append_dedup_by_level` | 按 level 去重 |
| `effects` | `append_dedup` | 效果只增不减 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### techniques 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 招式名不变 |
| `type` | `keep_first` | 招式类型不变 |
| `description` | `override` | 后续描述更完整 |
| `source_skill` | `keep_first` | 所属武功不变 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### factions 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 门派名不变 |
| `type` | `keep_first` | 门派类型不变 |
| `location` | `keep_first` | 所在地不变 |
| `sub_divisions` | `append_dedup` | 分支只增不减 |
| `one_line` | `override` | 后续描述更完整 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### locations 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 地名不变 |
| `region` | `keep_first` | 地理区域不变 |
| `one_line` | `override` | 后续描述更完整 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### items 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 物品名不变 |
| `type` | `keep_first` | 物品类型不变 |
| `owner` | `override` | 物品可能易主 |
| `one_line`, `description` | `override` | 后续描述更完整 |
| `effects` | `append_dedup` | 效果只增不减 |
| `origin` | `keep_first` | 来源不变 |
| `rarity` | `keep_first` | 稀有度不变 |
| `related_characters` | `append` | 关联角色只增不减 |
| `related_skills` | `append` | 关联技能只增不减 |
| `rag_refs` | `append_dedup` | 章节号只增不减 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### events 合并规则

| 字段 | 合并策略 | 说明 |
|------|---------|------|
| `id`, `name` | `keep_first` | 事件名不变 |
| `participants` | `append` | 参与者只增不减 |
| `location` | `keep_first` | 地点不变 |
| `description` | `override` | 后续描述更完整 |
| `chapter` | `keep_first` | 发生章节不变 |
| `source_refs` | `append_dedup` | 来源只增不减 |

### dialogues 合并规则

对话是纯追加，无需合并逻辑：
- 不同批次的对话按 chapter 排序
- 同一 chapter 内按原文顺序
- 无需去重（同一段对话不会出现在两个批次中，因为对话是按章节拆分的）
