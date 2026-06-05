# JSON Schema

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
