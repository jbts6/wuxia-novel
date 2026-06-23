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

只记录巅峰状态；更新时取更高值。功法 `mastery_rank` 与角色 `power_rank` 都使用这条序列，`返璞归真` 最强。

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

兼容字段 `rank` 只能同步对应 canonical 值，不能承载角色重要性、英文标签、数字评分或物品稀有度。

## 枚举

| 字段 | 合法值 |
|------|--------|
| `skill.type` | 剑法 / 掌法 / 指法 / 拳法 / 刀法 / 枪法 / 棍法 / 杖法 / 棒法 / 暗器 / 阵法 / 奇门兵器 / 内功 / 轻功 / 毒功 / 音攻 / 点穴 |
| `item.type` | 兵器 / 暗器 / 防具 / 丹药 / 毒药 / 信物 / 秘籍 / 坐骑 / 食物 / 工具 / 饰品 |
| `item.rarity_tier` | 寻常凡品 / 上乘佳品 / 稀世珍品 / 绝世神兵 / 未知 |
| `faction.type` | 武林门派 / 帮派 / 家族 |
| `character.role` | 核心 / 重要 / 次要 / 龙套 / 背景 |
| `character.importance` | 核心 / 重要 / 次要 / 龙套 / 背景 |
| `character.archetype` | scholar / warrior / monk / assassin / healer |
| `relationship.type` | 挚友 / 恋人 / 师徒 / 宿敌 / 对手 / 主仆 / 合作者 / 亲属 |
| `technique.type` | attack / defense / buff / debuff / control / feint / movement / poison / internal / support / combo / counter / special |
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
- **人名+泛称**（"乔峰轻功"、"少林高僧掌法"、"木婉清剑法"）——必须有独立功法名
- **事件/场景描述**（"雁门暗器伏击"、"江南追杀阵"）——不是功法
- **非武术能力**（"腹语术"、"易容术"、"棋艺"、"音律"）——不是武功

**内功/身法规则**：内功类（一阳指、北冥神功、化功大法等）和身法类（凌波微步等）在原著中是整套功法，**没有独立招式**。不为其生成 technique。例外：若功法有公认的特定能力（如"返老还童"），可保留为一条 technique。

**techniques 提取规则**：
- **仅当原文明确给出招式名时才提取 technique**，不要凑数
- 招式名必须有独立的武学身份：「关冲剑」是招式名，「食指剑气」是描述；「见龙在田」是招式名，「刚猛掌劲」是描述
- 不要提取泛称/描述性 technique：「XX掌力」「XX拳劲」「XX指力」「XX疗伤」「XX解法」「XX发作」
- 不要提取普通兵器动作：「单刀脱手」「横砍而至」「连砍四刀」
- technique 的 `description` **必须从原文提取真实描述**，禁止使用"XXX的代表性变化：YYY"这类模板
- technique 名称不要包含所属功法名作为前缀：「火焰刀凌虚发劲」→「凌虚发劲」

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
| characters | `id`、`identity`、`faction`、`archetype` | `alias`、`personality.traits`、`relationships(target+type)`、`known_skills`、`related_skills`、`rag_refs`、`source_refs` | `name` 仅真名揭晓时更新；`role`、`one_line`、`speech_style`、`temperament` 覆盖；`power_rank` 取更高；`importance` 按文本证据覆盖 |
| skills | `id`、`name`、`type`、`faction` | `techniques(id)`、`progression(level)`、`effects`、`rag_refs`、`source_refs` | `mastery_rank` 取更高；`one_line`、`combat_style` 覆盖 |
| techniques | `id`、`name`、`type`、`source_skill` | `source_refs` | `description` 覆盖 |
| factions | `id`、`name`、`type`、`location` | `sub_divisions`、`source_refs` | `one_line` 覆盖 |
| locations | `id`、`name`、`region` | `source_refs` | `one_line` 覆盖 |
| items | `id`、`name`、`type`、`origin`、`rarity_tier` | `effects`、`related_characters`、`related_skills`、`rag_refs`、`source_refs` | `owner`、`one_line`、`description` 覆盖 |
