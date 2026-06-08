# 常量定义

## ID 与来源

- ID：小写拼音 + 下划线，前缀固定为 `char_`、`faction_`、`loc_`、`skill_`、`item_`、`tech_`。
- 拼音必须按汉字逐字拆分音节：`萧秋水 -> char_xiao_qiu_shui`，不能写成 `xiao_qiushui`、`char_xiaoqiushui`。
- ID 只能包含 ASCII 小写字母和下划线；禁止中文、数字、大小写混用：`char_刁金保`、`char_feixiao` 都不合规。
- 生成 ID 前先写出“中文名 -> 拼音音节 -> 最终 ID”，再写入 JSON。
- 未命名角色也要建 ID：如 `老丐 -> char_lao_gai`，`白衣女子 -> char_bai_yi_nv_zi`。真名揭晓时更新 `name`，旧称呼放入 `alias`。
- 每个实体必须有 `source_refs`：`[{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段" }]`。
- `rag_refs` 只放章节号数组。

## Rank

只记录巅峰状态；更新时取更高值。

| 顺序 | rank |
|------|------|
| 1 | 平平无奇 |
| 2 | 初窥门径 |
| 3 | 略有小成 |
| 4 | 登堂入室 |
| 5 | 炉火纯青 |
| 6 | 出神入化 |
| 7 | 登峰造极 |
| 8 | 返璞归真 |

## 枚举

| 字段 | 合法值 |
|------|--------|
| `skill.type` | 剑法 / 掌法 / 内功 / 轻功 / 暗器 / 指法 |
| `item.type` | weapon / armor / pill / poison / hidden_weapon / special |
| `item.rarity` | 绝世神兵 / 稀世珍品 / 上乘佳品 / 寻常凡品 |
| `faction.type` | 武林门派 / 帮派 / 家族 |
| `character.role` | protagonist / companion / npc / villain |
| `character.archetype` | scholar / warrior / monk / assassin / healer |
| `relationship.type` | 挚友 / 恋人 / 师徒 / 宿敌 / 对手 / 主仆 / 合作者 / 亲属 |
| `technique.type` | attack / defense / buff / debuff / feint / special |
| `effect.type` | 伤害 / 控制 / 增益 / 减益 / 特殊 |

### dialogue_tone

只能使用以下值，不能自创。

- 情绪：平静 / 愤怒 / 激动 / 悲伤 / 悲痛 / 得意 / 恐惧 / 冷酷 / 温柔 / 慌张 / 担心 / 痛苦 / 惊讶 / 疑问 / 好奇 / 犹豫 / 恳求 / 嘲讽 / 调侃 / 豪迈 / 无奈 / 认真 / 焦急 / 欣慰 / 欣喜
- 方式：冷笑 / 苦笑 / 轻笑 / 大笑 / 微笑 / 狂笑 / 喃喃 / 沉声 / 厉声 / 颤声 / 嘶声 / 柔声 / 淡然 / 严肃 / 低语 / 娇声
- 兜底：陈述

## 更新策略

| 类型 | 保留首次 | 追加去重 | 覆盖/更新 |
|------|----------|----------|-----------|
| characters | `id`、`identity`、`faction`、`archetype` | `alias`、`personality.traits`、`relationships(target+type)`、`known_skills`、`related_skills`、`rag_refs`、`source_refs` | `name` 仅真名揭晓时更新；`role`、`one_line`、`speech_style`、`temperament` 覆盖；`rank` 取更高 |
| skills | `id`、`name`、`type`、`faction` | `techniques(id)`、`progression(level)`、`effects`、`rag_refs`、`source_refs` | `rank` 取更高；`one_line`、`combat_style` 覆盖 |
| techniques | `id`、`name`、`type`、`source_skill` | `source_refs` | `description` 覆盖 |
| factions | `id`、`name`、`type`、`location` | `sub_divisions`、`source_refs` | `one_line` 覆盖 |
| locations | `id`、`name`、`region` | `source_refs` | `one_line` 覆盖 |
| items | `id`、`name`、`type`、`origin`、`rarity` | `effects`、`related_characters`、`related_skills`、`rag_refs`、`source_refs` | `owner`、`one_line`、`description` 覆盖 |
