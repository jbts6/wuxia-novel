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
| `skill.type` | 剑法 / 掌法 / 内功 / 轻功 / 暗器 / 指法 / 拳法 / 棍法 / 杖法 / 棒法 / 刀法 / 枪法 / 音攻 / 毒功 / 身法 / 点穴 / 医术 |
| `item.type` | 兵器 / 暗器 / 防具 / 丹药 / 毒药 / 信物 / 秘籍 / 坐骑 / 食物 / 工具 / 饰品 |
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

## 功法（Skill）提取标准

**必须提取**：在本章中**首次被命名**的武学体系/招式套路，且满足以下任一条件：
- 有专有名称（如"降龙十八掌"、"九阴白骨爪"、"越女剑法"）
- 被明确归类为某门派/角色的武学（如"全真剑法"、"桃花岛武功"）
- 在打斗中被**反复使用**且有名称（如"摧心掌"出现 3 次以上）

**不应提取**：
- 无名称的普通打斗动作（"一拳打去"、"拔剑便刺"）
- 单次使用的武器而非武学体系（"拿起一把刀"）
- 纯粹的内力描述而非独立功法（"运起内力"）
- 已有技能的简单重复提及（用 entity_updates 更新 rag_refs/source_refs 即可）

**techniques 提取规则**：
- 每个 skill 至少提取 2 个 techniques；如果原文明确描述了更多招式，必须全部提取
- technique 的 `description` **必须从原文提取真实描述**，禁止使用"XXX的代表性变化：YYY"这类模板
- 如果原文没有为某招式提供足够描述，用一句话概括其在原文中的表现（如"洪七公示范的降龙十八掌第一招，刚猛蓄劲"）

## 功法命名规则

- 若功法名以「人名 + 功法名」开头，去掉人名前缀：`柯镇恶伏魔杖法 -> 伏魔杖法`
- 若功法名本身含门派名且门派名是标识的一部分，保留：`全真剑法`、`桃花岛武功`
- 不要去掉门派前缀：`古墓派玉女剑法` → `玉女剑法`（门派不是前缀而是功法名的一部分时保留）

| 原名 | 提炼后 |
|------|--------|
| 李莫愁拂尘杀法 | 拂尘杀法 |
| 柯镇恶伏魔杖法 | 伏魔杖法 |
| 古墓派驭蜂术 | 驭蜂术 |
| 杨过玉女神掌 | 玉女神掌 |
| 金轮国师双轮轮法 | 双轮轮法 |

## 道具（Item）提取标准

**保留** — 满足以下任一条件：
- 有名号的兵器/装备（玄铁重剑、软猬甲）
- 有剧情作用的药品/毒药（九花玉露丸、情花毒、断肠草）
- 功法秘籍（九阴真经、葵花宝典）
- 有剧情意义的信物/奇物（锦帕、蛇胆）

**删除** — 以下类型：
- 场景物（酒店、山洞、房间）
- 临时凑合（随手拿起的棍棒）
- 日常用品（酒杯、碗筷）
- 无特殊属性的普通物品

### 道具标准类型（TYPE_MAP）

提取时将 `item.type` 映射为以下 11 种标准值：

| 标准类型 | 对应原始类型 | 保留标准 |
|----------|-------------|----------|
| 兵器 | weapon / 随身利器 | 只留有专属名号或特殊属性的 |
| 暗器 | hidden_weapon / 兵器暗器 | 有名号的暗器 |
| 防具 | armor / 衣饰 / 服饰 | 软猬甲、金丝手套等 |
| 丹药 | pill / medicine / 解药 / 金创药 | 疗伤药、解药 |
| 毒药 | poison / 毒物 | 毒物、毒虫 |
| 信物 | 书信 / 令牌 / 证物 / 图卷 | 有剧情作用的持有物 |
| 秘籍 | 武学秘笈 / 经书 / 书籍 | 武功秘笈 |
| 坐骑 | mount / 灵禽 | 有名号的坐骑 |
| 食物 | 酒 / 食物 | 有剧情作用的食物 |
| 工具 | tool / 器物 / formation | 有剧情作用的器具 |
| 饰品 | accessory / 首饰 | 极少保留 |

未映射到以上类型的道具 → 不提取。

## 更新策略

| 类型 | 保留首次 | 追加去重 | 覆盖/更新 |
|------|----------|----------|-----------|
| characters | `id`、`identity`、`faction`、`archetype` | `alias`、`personality.traits`、`relationships(target+type)`、`known_skills`、`related_skills`、`rag_refs`、`source_refs` | `name` 仅真名揭晓时更新；`role`、`one_line`、`speech_style`、`temperament` 覆盖；`rank` 取更高 |
| skills | `id`、`name`、`type`、`faction` | `techniques(id)`、`progression(level)`、`effects`、`rag_refs`、`source_refs` | `rank` 取更高；`one_line`、`combat_style` 覆盖 |
| techniques | `id`、`name`、`type`、`source_skill` | `source_refs` | `description` 覆盖 |
| factions | `id`、`name`、`type`、`location` | `sub_divisions`、`source_refs` | `one_line` 覆盖 |
| locations | `id`、`name`、`region` | `source_refs` | `one_line` 覆盖 |
| items | `id`、`name`、`type`、`origin`、`rarity` | `effects`、`related_characters`、`related_skills`、`rag_refs`、`source_refs` | `owner`、`one_line`、`description` 覆盖 |
