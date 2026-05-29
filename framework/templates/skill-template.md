# {{name}}

---
id: {{id}}
type: {{type}}                    # sword_art/finger_art/palm_art/fist_art/internal/movement/hidden_weapon/beast/staff_art/blade_art
rank: {{rank}}                    # 返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇
faction: "[[{{faction}}]]"        # 所属门派
combat_style: {{combat_style}}    # 战斗风格
techniques:                       # 包含的招式
  - "[[{{technique_name}}]]"
game_stats:                       # 游戏化数值（由assign-stats.py填充）
  damage_base: 0
  mp_cost: 0
  cooldown: 0
  range: melee
---

## 描述
{{description}}

## 招式列表
| 招式 | 类型 | 描述 |
|------|------|------|
| [[{{technique}}]] | {{type}} | {{desc}} |

## 升级路径
| 等级 | 解锁条件 | 伤害倍率 |
|------|---------|---------|
| {{level}} | {{unlock}} | {{damage_mult}} |

## 克制关系
- **克制**: {{strong_against}}
- **被克**: {{weak_against}}
- **无效化**: {{nullified_by}}

## 特殊效果
- {{type}}: {{description}}（触发: {{condition}}）

## 掌握者
- [[{{character}}]]
