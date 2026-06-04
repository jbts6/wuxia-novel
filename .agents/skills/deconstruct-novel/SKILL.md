---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 工作流

1. 确认 `<小说目录>/ch_formatted/ch_*.md` 存在
2. 依次读入全部章节文件
3. 按下方 Schema 提取实体，一次性写入 8 个 JSON 文件：
   - `characters.json` · `skills.json` · `techniques.json` · `factions.json`
   - `locations.json` · `items.json` · `events.json` · `dialogues.json`

---

## ID 规则

格式：全小写拼音，字间下划线。前缀：`char_` `faction_` `loc_` `skill_` `item_` `tech_`

## source_refs（必填）

每个实体必须携带：
```json
"source_refs": [{"chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段"}]
```

## 等级体系

角色/技能：返璞归真 > 登峰造极 > 出神入化 > 炉火纯青 > 登堂入室 > 略有小成 > 初窥门径 > 平平无奇
物品：绝世神兵 / 稀世珍品 / 上乘佳品 / 寻常凡品

## 关系类型

挚友 / 恋人 / 师徒 / 宿敌 / 对手 / 主仆 / 合作者 / 亲属

---

## JSON Schema

### characters.json
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

### skills.json
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

### techniques.json
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

### factions.json
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

### locations.json
```json
{
  "id": "loc_xxx",
  "name": "名字",
  "region": "地理区域",
  "one_line": "描述",
  "source_refs": [{"chapter": N, "line_start": N, "line_end": N, "text": "原文"}]
}
```

### items.json
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

### events.json
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

### dialogues.json
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

#### speaker 提取规则（重点）

**禁止使用脚本提取 speaker**，必须由 AI 阅读上下文后判定。脚本无法理解中文复杂句式，会把动作描写误认为说话人。

**常见误判（必须排除）：**
- ❌ "他笑着"、"他冷笑着"、"他怒道"、"他淡淡道" — 这些是动作/神态描写，不是说话人
- ❌ "那人"、"少年"、"老者"、"女子" — 无明确指向的代词/称谓，不能直接作为 speaker
- ❌ "只听"、"有人"、"众人" — 非角色声音

**正确提取方法：**
1. 先从上下文找到说话人的**真实姓名**（如"李寻欢"、"阿飞"）
2. 确认该名字在 `characters.json` 中存在
3. 若上下文无明确姓名，用称谓（如"老者"）但 speaker 留 null，speaker_name 填称谓
4. listener 同理，必须是已知角色或 null

**示例：**
- ✅ "李寻欢笑道：'你好。'" → speaker: char_li_xun_huan
- ✅ "他冷笑道：'你以为我怕你？'" → 需从上下文判断"他"是谁，找到真实姓名
- ❌ "他冷笑着说道" → "他冷笑着"不能作为 speaker_name

---

## 自检清单

- 所有 ID 都是小写拼音+下划线（例：`char_li_xun_huan`、`loc_yang_zhou`、`skill_li_fei_dao`）
- 角色 personality.traits ≥ 5 项，speech_style 和 temperament 非空
- 角色 relationships 字段完整（target, type, intensity, bond_level, dynamic）
- 技能 techniques ≥ 2 个招式
- 技能 progression 包含功力层级
- 物品 description ≥ 20 字
- 事件 description ≥ 20 字
- 对话 speaker 是角色 ID，speaker_name 是**真实姓名**（非"他笑着"等动作描写）
- relationships 无重复 (target+type)
- events id 格式为 evt_N_序号
