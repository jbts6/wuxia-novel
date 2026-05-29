# 骨架提取Prompt

你是一个武侠小说分析专家。请从以下文本中提取：

1. **人物**：名字 + 身份 + 一句话描述 + 一句话性格
2. **门派**：名字 + 类型 + 地点
3. **地点**：名字 + 地理位置 + 一句话描述
4. **武功**：名字 + 类型（剑法/掌法/内功/轻功/暗器）+ 简要描述
5. **物品**：名字 + 类型（武器/防具/丹药/毒药/暗器/特殊物品）+ 持有者 + 简要描述

规则：
- 只提取本章实际出现的人物/门派/地点/武功
- 门派如有宗门分支（如无量剑东宗/西宗），作为一个门派，宗门作为sub_divisions
- 武功需有具体描写，不能只是"武功很高"
- 段誉的武功分两层：known_skills（已掌握）和 related_skills（家族/门派关联但尚未学会）
- id格式：人物char_拼音, 门派faction_拼音, 地点loc_拼音, 技能skill_拼音

输出纯JSON格式，不要其他文字：
{
  "chapter": <章节号>,
  "characters": [
    {
      "id": "char_xxx",
      "name": "名字",
      "alias": ["别名"],
      "identity": "身份",
      "faction": "所属门派id或null",
      "role": "protagonist/companion/npc/villain",
      "one_line": "一句话描述",
      "personality": "一句话性格",
      "known_skills": ["已掌握的技能id"],
      "related_skills": ["关联但未学会的技能id"]
    }
  ],
  "factions": [
    {
      "id": "faction_xxx",
      "name": "名字",
      "type": "武林门派/帮派/家族",
      "location": "地点id",
      "sub_divisions": ["分支"],
      "one_line": "一句话描述"
    }
  ],
  "locations": [
    {
      "id": "loc_xxx",
      "name": "名字",
      "region": "地理区域",
      "one_line": "一句话描述"
    }
  ],
  "skills": [
    {
      "id": "skill_xxx",
      "name": "名字",
      "type": "剑法/掌法/内功/轻功/暗器/指法",
      "faction": "所属门派id或空字符串",
      "one_line": "一句话描述"
    }
  ],
  "items": [
    {
      "id": "item_xxx",
      "name": "名字",
      "type": "weapon/armor/pill/poison/hidden_weapon/special",
      "owner": "持有者角色id或null",
      "one_line": "一句话描述"
    }
  ]
}
