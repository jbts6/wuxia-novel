# 常量定义

## ID 规则

格式：全小写拼音，字间下划线。前缀：`char_` `faction_` `loc_` `skill_` `item_` `tech_`

**未命名角色 ID 生成规则：** 即使角色没有真名，也要基于当前称呼创建 ID。后续揭晓真名时更新 registry（name 改为真名，alias 加入旧称呼）。

| 当前称呼       | ID 示例              |
| -------------- | -------------------- |
| 老丐          | `char_lao_gai`         |
| 蒙面人         | `char_meng_mian_ren`   |
| 白衣女子       | `char_bai_yi_nv_zi`    |
| 黑衣老者       | `char_hei_yi_lao_zhe`  |
| 无名剑客       | `char_wu_ming_jian_ke` |

## source_refs（必填）

每个实体必须携带：
```json
"source_refs": [{"chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段"}]
```

## rank 排序表（从低到高）

Sub Agent 比较 rank 时，必须按此顺序判断取最大值：

| 排序 | 等级       |
| ---- | ---------- |
| 1    | 平平无奇   |
| 2    | 初窥门径   |
| 3    | 略有小成   |
| 4    | 登堂入室   |
| 5    | 炉火纯青   |
| 6    | 出神入化   |
| 7    | 登峰造极   |
| 8    | 返璞归真   |

**rank 更新策略：** `max`（取更大值，即取排序数字更大的值）。角色/武功的 rank 始终记录巅峰状态。

## 枚举值域（Sub Agent 必须使用以下合法值）

### skill_type（武功类型）
剑法 / 掌法 / 内功 / 轻功 / 暗器 / 指法

### item_type（物品类型）
weapon / armor / pill / poison / hidden_weapon / special

### rarity（物品稀有度）
绝世神兵 / 稀世珍品 / 上乘佳品 / 寻常凡品

### faction_type（门派类型）
武林门派 / 帮派 / 家族

### role（角色定位）
protagonist / companion / npc / villain

### archetype（角色原型）
scholar / warrior / monk / assassin / healer

### relation_type（关系类型）
挚友 / 恋人 / 师徒 / 宿敌 / 对手 / 主仆 / 合作者 / 亲属

### technique_type（招式类型）
attack / defense / buff / debuff / feint / special

### effect_type（效果类型）
伤害 / 控制 / 增益 / 减益 / 特殊

### dialogue_tone（对话语气）

**Sub Agent 必须从以下枚举中选择 tone 值，不得自创词汇。**

**情绪语气**（说话时的情感状态）：
平静 / 愤怒 / 激动 / 悲伤 / 悲痛 / 得意 / 恐惧 / 冷酷 /
温柔 / 慌张 / 担心 / 痛苦 / 惊讶 / 疑问 / 好奇 / 犹豫 / 恳求 /
嘲讽 / 调侃 / 豪迈 / 无奈 / 认真 / 焦急 / 欣慰 / 欣喜

**说话方式**（仅限修饰"怎么说"的语气副词，不取动作）：
冷笑 / 苦笑 / 轻笑 / 大笑 / 微笑 / 狂笑 / 喃喃 / 沉声 /
厉声 / 颤声 / 嘶声 / 柔声 / 淡然 / 严肃 / 低语 / 娇声

**兜底**（无法判断任何语气时使用）：
陈述

## 更新策略表（entity_registry.json）

Sub Agent 每章更新 registry 时，必须按此表处理每个字段：

### characters

| 字段                     | 策略                        | 说明                              |
| ------------------------ | --------------------------- | --------------------------------- |
| `id`, `name`                 | `keep_first_with_alias`       | 首次值最准确；真名揭晓时 name 更新，旧名加入 alias |
| `alias`                    | `append_dedup`                | 别名只增不减（真名揭晓时旧名加入） |
| `identity`, `faction`       | `keep_first`                  | 身份/门派不变                     |
| `archetype`                 | `keep_first`                  | 原型不变                          |
| `role`                      | `override`                    | 角色定位可能变化                  |
| `rank`                      | `max`                         | 巅峰状态，取更高值                |
| `one_line`                  | `override`                    | 后续描述更精准                    |
| `personality.traits`        | `append_dedup`                | 新特征追加，AI 判断语义去重       |
| `personality.speech_style`  | `override`                    | 后续描述更完整                    |
| `personality.temperament`   | `override`                    | 后续描述更完整                    |
| `relationships`             | `append_dedup_by_target_type` | 按 target+type 去重，其余取最新   |
| `known_skills`              | `append`                      | 技能只增不减                      |
| `related_skills`            | `append`                      | 技能只增不减                      |
| `rag_refs`                  | `append_dedup`                | 章节号只增不减                    |
| `source_refs`               | `append_dedup`                | 来源只增不减                      |

### skills

| 字段           | 策略                  | 说明                        |
| -------------- | --------------------- | --------------------------- |
| `id`, `name`       | `keep_first`            | 首次值最准确                |
| `type`, `faction`  | `keep_first`            | 类型和所属门派不变          |
| `rank`             | `max`                   | 巅峰状态                    |
| `one_line`         | `override`              | 后续描述更完整              |
| `rag_refs`         | `append_dedup`          | 章节号只增不减              |
| `techniques`       | `append_dedup_by_id`    | 按招式 id 去重              |
| `progression`      | `append_dedup_by_level` | 按 level 去重               |
| `effects`          | `append_dedup`          | 效果只增不减                |
| `combat_style`     | `override`              | 后续描述更完整              |
| `source_refs`      | `append_dedup`          | 来源只增不减                |

### techniques

| 字段           | 策略        | 说明                |
| -------------- | ----------- | ------------------- |
| `id`, `name`       | `keep_first`  | 招式名不变          |
| `type`             | `keep_first`  | 招式类型不变        |
| `description`      | `override`    | 后续描述更完整      |
| `source_skill`     | `keep_first`  | 所属武功不变        |
| `source_refs`      | `append_dedup`| 来源只增不减        |

### factions

| 字段             | 策略          | 说明                |
| ---------------- | ------------- | ------------------- |
| `id`, `name`         | `keep_first`    | 门派名不变          |
| `type`               | `keep_first`    | 门派类型不变        |
| `location`           | `keep_first`    | 所在地不变          |
| `sub_divisions`      | `append_dedup`  | 分支只增不减        |
| `one_line`           | `override`      | 后续描述更完整      |
| `source_refs`        | `append_dedup`  | 来源只增不减        |

### locations

| 字段           | 策略          | 说明                |
| -------------- | ------------- | ------------------- |
| `id`, `name`       | `keep_first`    | 地名不变            |
| `region`           | `keep_first`    | 地理区域不变        |
| `one_line`         | `override`      | 后续描述更完整      |
| `source_refs`      | `append_dedup`  | 来源只增不减        |

### items

| 字段                 | 策略          | 说明                        |
| -------------------- | ------------- | --------------------------- |
| `id`, `name`             | `keep_first`    | 物品名不变                  |
| `type`                   | `keep_first`    | 物品类型不变                |
| `owner`                  | `override`      | 最终归属，转手记在 description |
| `one_line`, `description`| `override`      | 后续描述更完整              |
| `effects`                | `append_dedup`  | 效果只增不减                |
| `origin`                 | `keep_first`    | 来源不变                    |
| `rarity`                 | `keep_first`    | 稀有度不变                  |
| `related_characters`     | `append`        | 关联角色只增不减            |
| `related_skills`         | `append`        | 关联技能只增不减            |
| `rag_refs`               | `append_dedup`  | 章节号只增不减              |
| `source_refs`            | `append_dedup`  | 来源只增不减                |
