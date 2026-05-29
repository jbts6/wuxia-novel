# 深度提取Prompt

你是一个武侠小说分析专家。请基于以下骨架索引，从原文中提取详细数据。

## 骨架索引（已确认的人物/门派/地点/武功）
{{SKELETON_INDEX}}

## 提取要求

### 人物详细卡
对骨架中每个人物，提取：
- personality: {traits: [], speech_style: "...", temperament: "..."}
- relationships: [{target: "char_xxx", type: "love/sworn_brother/master_student/enemy/complicated", intensity: 0-100, bond_level: 1-5, dynamic: "关系变化描述"}]
- known_skills / related_skills: 确认或修正骨架中的列表
- archetype: scholar/warrior/monk/assassin/healer（根据性格和武功推断）

### 技能详细卡
对骨架中每个技能，提取：
- techniques: [{id: "tech_xxx", name: "招式名", type: "attack/defense/buff/debuff/feint/beast/special", description: "招式描述"}]
- progression: [{level: 1-5, unlock: "解锁描述"}]（如有明确升级线）
- effects: [{type: "效果类型", condition: "触发条件", description: "描述"}]
- combat_style: "战斗风格描述"

### 关系卡
提取本章中体现的人物关系变化：
- 新建立的关系
- 关系强度变化
- 关系类型变化

### 对话片段
提取2-5段关键对话，标记：
- speaker: "说话人角色id"
- listener: "听话人角色id或null"
- text: "对话内容"
- tone: "语气标签（书生气/豪迈/愤怒/悲伤/调侃等）"

输出纯JSON格式：
{
  "chapter": <章节号>,
  "characters_detail": [
    {
      "id": "char_xxx",
      "personality": {"traits": [], "speech_style": "...", "temperament": "..."},
      "archetype": "scholar/warrior/monk/assassin/healer",
      "relationships": [],
      "known_skills": [],
      "related_skills": []
    }
  ],
  "skills_detail": [
    {
      "id": "skill_xxx",
      "techniques": [],
      "progression": [],
      "effects": [],
      "combat_style": "..."
    }
  ],
  "events": [
    {
      "id": "evt_xxx",
      "name": "事件名",
      "participants": ["char_xxx"],
      "location": "loc_xxx",
      "description": "事件描述",
      "chapter": <章节号>
    }
  ],
  "dialogues": [
    {
      "speaker": "char_xxx",
      "listener": "char_xxx或null",
      "text": "对话内容",
      "tone": "语气标签",
      "chapter": <章节号>
    }
  ]
}
