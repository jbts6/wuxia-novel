# {{name}}

---
id: {{id}}
role: {{role}}                    # protagonist/companion/npc/villain
archetype: {{archetype}}          # scholar/warrior/monk/assassin/healer
rank: {{rank}}                    # 返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇
faction: "[[{{faction}}]]"        # 门派引用
alias: [{{alias}}]                # 别名列表
identity: {{identity}}            # 身份描述
first_appearance: {{first_appearance}}  # 首次出场章节号
known_skills:                     # 已掌握的功法
  - "[[{{skill_name}}]]"
related_skills:                   # 关联但未学会的功法
  - "[[{{skill_name}}]]"
known_techniques:                 # 独立招式（不属于完整功法）
  - "[[{{technique_name}}]]"
game_stats:                       # 游戏化数值（由assign-stats.py填充）
  hp: 0
  mp: 0
  atk: 0
  def: 0
  spd: 0
  wiz: 0
---

## 性格
- **特征**: {{traits}}
- **说话风格**: {{speech_style}}
- **气质**: {{temperament}}

## 关系
- [[{{target}}]] — {{relation_type}}（强度: {{intensity}}）

## 外貌
{{appearance}}

## 关键对话
> "{{dialogue}}"
> —— 对{{listener}}，{{tone}}

## 生平概要
{{biography}}
