# 精细化深度提取Prompt

你是一位顶尖的武侠小说分析专家。请基于骨架索引和章节原文，执行精细化的深度数据提取。

## 核心规则（必须遵守）

1. **所有数组字段必须填充，禁止留空数组 `[]`** — 除非确实没有对应内容
2. **所有字符串字段必须有值，禁止空字符串 `""`** — 如果无法确定，根据上下文合理推断
3. **严格基于原文**，不要编造原文中没有的内容
4. **阅读本章全部原文后再提取**，不要遗漏出场人物和事件
5. 输出纯 JSON，不要包含任何注释或说明文字

## 章节原文
{{CHAPTER_TEXT}}

## 骨架索引（已确认的人物/门派/地点/武功）
{{SKELETON_INDEX}}

## 提取要求

### 人物详细卡
对骨架中**每个**在本章出现的人物，提取：

必填字段（每个都必须有值）：
- `personality.traits`: 至少3个精准的性格特质词（如 "侠义心肠"、"机智狡猾"、"刚烈冲动"、"城府深沉"）
- `personality.speech_style`: 详细描述其说话风格（如 "言辞犀利，喜用典故，谈吐斯文"）
- `personality.temperament`: 气质描述（如 "温文尔雅"、"桀骜不驯"、"阴沉冷酷"）
- `archetype`: 从 scholar/warrior/monk/assassin/healer 中精准选择，根据性格和武功综合判断
- `relationships`: 本章中体现出的人物关系。每个关系包含：
  - `target`: 对象角色id
  - `type`: 关系类型（love/sworn_brother/master_student/enemy/companion/complicated/family/rival）
  - `intensity`: 关系强度 0-100
  - `bond_level`: 羁绊等级 1-5
  - `dynamic`: 本章中关系变化的具体描述

### 技能详细卡
对骨架中**每个**在本章出现或使用的技能，提取：

- `techniques`: 本章中展示的具体招式。每个招式包含 id, name, type(attack/defense/buff/debuff/feint/beast/special), description
- `progression`: 本章体现的功力层级（level: 1-5, unlock: 境界描述）
- `effects`: 本章展示的实战效果
- `combat_style`: 战斗风格描述

### 事件卡
提取本章中发生的**所有**重要事件：
- id: "evt_章节号_序号" 格式
- name: 事件名称（简洁有力）
- participants: 参与角色id列表
- location: 发生地点id
- description: 事件详细描述（至少20字）

### 对话片段
提取本章中**所有**关键对话（至少5段），标记：
- speaker: "说话人角色id"
- listener: "听话人角色id或null（自言自语）"
- text: "对话原文"
- tone: "语气标签（书生气/豪迈/愤怒/悲伤/调侃/恳求/冷酷/嘲讽等）"
- chapter: <章节号>

## 输出格式示例（参考第一章的成功输出）

```json
{
  "chapter": 1,
  "characters_detail": [
    {
      "id": "char_duanyu",
      "personality": {
        "traits": ["宅心仁厚", "不谙世事", "执着", "好奇心强", "善良"],
        "speech_style": "谈吐文雅，喜用佛经和典故，语气谦和",
        "temperament": "温文尔雅"
      },
      "archetype": "scholar",
      "relationships": [
        {"target": "char_zhongling", "type": "companion", "intensity": 40, "bond_level": 1, "dynamic": "初识，对钟灵的古灵精怪感到新奇"}
      ],
      "known_skills": [],
      "related_skills": ["skill_yiyangzhi"]
    },
    {
      "id": "char_zhongling",
      "personality": {
        "traits": ["古灵精怪", "心思机敏", "活泼", "勇敢"],
        "speech_style": "伶牙俐齿，喜欢开玩笑，说话直接",
        "temperament": "活泼开朗"
      },
      "archetype": "assassin",
      "relationships": [
        {"target": "char_duanyu", "type": "companion", "intensity": 35, "bond_level": 1, "dynamic": "初识，对段誉的纯真感到有趣"}
      ],
      "known_skills": ["skill_yushe", "skill_qinggong_zhong"],
      "related_skills": []
    }
  ],
  "skills_detail": [
    {
      "id": "skill_yiyangzhi",
      "techniques": [
        {"id": "tech_yiyangzhi_dianxue", "name": "一阳指点穴", "type": "attack", "description": "以一指之力隔空点穴，使目标失去行动能力"}
      ],
      "progression": [{"level": 1, "unlock": "隔空点穴"}],
      "effects": [{"type": "控制", "condition": "点中穴道", "description": "目标全身无法动弹，失去战斗力"}],
      "combat_style": "点穴制敌，以指代剑"
    }
  ],
  "events": [
    {
      "id": "evt_01_wuliang_bijian",
      "name": "无量剑派东西宗比剑",
      "participants": ["char_zuozimu", "char_xinshuangqing", "char_gongguangjie", "char_chu"],
      "location": "loc_jianhugong",
      "description": "无量剑派东西宗每年一次的比剑大会，东宗左子穆获胜",
      "chapter": 1
    }
  ],
  "dialogues": [
    {
      "speaker": "char_zhongling",
      "listener": "char_duanyu",
      "text": "你真的一点也不会武功？那可真可惜了。",
      "tone": "调侃",
      "chapter": 1
    }
  ]
}
```
