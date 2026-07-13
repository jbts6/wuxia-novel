# 常量定义

## ID 规则

- `prepare`、`inventory`、`reconcile`、`enrich` 与 `semantic-audit` 只使用稳定 provisional key；正式 ID 仅在 `publish` 生成。
- 前缀固定：`char_`、`faction_`、`loc_`、`skill_`、`tech_`、`item_`、`event_`、`dialogue_`。
- 拼音必须按汉字逐字拆分音节：`萧秋水 -> char_xiao_qiu_shui`，不能写成 `xiao_qiushui`。
- 正式 ID 必须匹配 `<prefix>[a-z]+(?:_[a-z]+)*`：只能包含 ASCII 小写字母，并用单个下划线分隔拼音音节；禁止中文、数字、大写、连字符、连续下划线和首尾多余下划线。
- `publish` 先生成并校验唯一 ID plan：「provisional key -> 中文名 -> 拼音音节 -> 正式 ID」，再由控制器统一投影正式记录和全部引用。
- `final_category` 必须与 `final_id` 前缀一致；所有引用字段必须复用同一个正式 ID，不能局部改写。
- 校验器只拒绝非法 ID，不自动转拼音或修复引用。多音字必须在 publish token plan 中结合名称和原文确定，不得提前批量安装拼音依赖或修改草稿 ID。
- 章节摘要没有字符串 ID，以正整数 `chapter` 作为唯一主键，不进入候选 decision 账本。
- 未命名角色也要建 ID：如 `老丐 -> char_lao_gai`。真名揭晓时更新 `name`，旧称呼放入 `alias`。
- 每个实体必须有 `source_refs`：`[{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段" }]`。
- `rag_refs` 只放章节号数组。

## Rank

只记录巅峰状态。功法 `mastery_rank` 与角色 `power_rank` 都使用这条序列，`返璞归真` 最强。

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
| `skill.type` | 剑法 / 掌法 / 指法 / 拳法 / 刀法 / 枪法 / 棍法 / 杖法 / 棒法 / 暗器 / 阵法 / 奇门 / 内功 / 轻功 / 毒功 / 音攻 / 点穴 |
| `item.type` | 兵器 / 暗器 / 防具 / 丹药 / 毒药 / 信物 / 秘籍 / 奇门 / 坐骑 / 食物 / 工具 / 饰品 / 异兽 |
| `item.tags` | 兵器 / 刀 / 剑 / 枪 / 棍 / 棒 / 暗器 / 奇门兵器 / 秘籍 / 内功 / 外功 / 轻功 / 毒功 / 丹药 / 解药 / 毒药 / 增益 / 信物 / 钥匙 / 线索 / 剧情关键 |
| `item.rarity_tier` | 凡品 / 良品 / 珍品 / 神品 / 未知 |
| `faction.type` | 武林门派 / 帮派 / 家族 / 军队 / 王族 / 寺院 / 部族 / 官署 |
| `character.role` / `character.importance` | 核心 / 重要 / 次要 / 龙套 / 背景 |
| `character.archetype` | scholar / warrior / monk / assassin / healer |
| `relationship.type` | 挚友 / 恋人 / 师徒 / 宿敌 / 对手 / 主仆 / 合作者 / 亲属 |
| `technique.type` | attack / defense / buff / debuff / control / feint / movement / poison / internal / support / combo / counter / special |
| `effect.type` | 伤害 / 控制 / 增益 / 减益 / 特殊 |

### dialogue_tone

只能使用以下 12 种值，不能自创：

- 陈述（含平静、淡然、低语、严肃、沉声、无奈、苦笑）
- 疑问（含好奇）
- 愤怒（含厉声）
- 激动（含惊讶）
- 悲伤（含悲痛、痛苦、颤声、嘶声）
- 恳求
- 嘲讽（含冷笑）
- 调侃
- 冷酷
- 恐惧
- 欣喜（含微笑、轻笑、大笑、狂笑、欣慰、得意）
- 焦急（含慌张、担心）

## 功法命名规则

- 若功法名以「人名 + 功法名」开头，去掉人名前缀：`柯镇恶伏魔杖法 -> 伏魔杖法`。
- 功法名不能包含「人名 + 泛称」：`乔峰轻功`、`少林高僧掌法` 不是合法功法名。

## techniques 提取规则

- 仅当原文明确给出招式名时才提取，不要凑数。
- 招式名必须有独立武学身份：「关冲剑」是招式名，「食指剑气」是描述；「见龙在田」是招式名，「刚猛掌劲」是描述。
- 不要提取泛称/描述性 technique：「XX掌力」「XX拳劲」「XX指力」。
- 不要提取普通兵器动作：「单刀脱手」「横砍而至」。
- 内功/身法类（一阳指、北冥神功、凌波微步）通常不生成 technique。例外：若功法有公认的特定能力（如"返老还童"），可保留为一条 technique。
