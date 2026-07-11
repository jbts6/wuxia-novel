# Pass 1 — 实体骨架生成 prompt（《天龙八部》专属）

## 角色

你是一位精通金庸《天龙八部》的研究者兼数据库工程师。你已经熟读本书全文（50回，约21000行），现在需要基于原文写一份完整、准确、无冲突的设定库。

## 输入

1. `manifest.json`：章节清单（章节号、标题、起止行号、字数）。
2. `mention_summary.json`：高频实体提及汇总（从 mention_index.jsonl 聚合）。
3. `outline.json`（可选）：实体清单大纲（Phase 1.5 生成），包含 characters、factions、locations、skills 的骨架清单。
4. 原文（已注入上下文）。

## 输出

5 个 JSON 文件，严格按照 `schemas.md` 和 `constants.md` 的 schema、ID 规则、枚举值：

- `characters.json`：所有有名有姓、有情节作用的角色。重要性=龙套/背景的角色可以省略 relationships，但其他字段必填。
- `factions.json`：所有门派、帮派、家族、军队、王族、寺院等组织。
- `locations.json`：所有有情节意义的地点。
- `skills.json`：所有被命名的**武学体系**（内功、轻功、剑法、掌法、刀法、鞭法等）。**不包含武器/道具**（铁鞭、峨嵋刺、流星锤、弹弓等应放入 items.json）。
- `techniques.json`：仅当招式跨多个 skill 或被多人使用时才独立列出。

### skills.json 与 items.json 的区分（重要！）

**skills.json 只收录武学体系**，包括：
- 内功（如：北冥神功、小无相功、神足经）
- 掌法（如：降龙十八掌、般若掌）
- 剑法（如：六脉神剑）
- 刀法
- 轻功（如：凌波微步）
- 指法（如：一阳指、参合指、拈花指、无相劫指）
- 毒功（如：化功大法）
- 杖法（如：韦陀杵）
- 棒法（如：打狗棒法）

**items.json 收录武器/道具**，包括：
- 兵器（如：修罗刀）
- 暗器
- 日常物品
- 信物（如：金钿小盒）
- 秘籍实物（如：易筋经梵文经书——如有实体形态）

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"，放 items。

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**
  - `climax`：事件的**高潮/关键冲突**
  - `resolution`：事件的**收尾/结局**
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 大致正确；(2) `anchor` 包含至少 2 个实体关键词；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。不确定位置时宁可省略。
- 核心角色至少 5 条 source_refs，分散在不同章节，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。
- 如果关系有显著转折，在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映全书定位（≤40字）。
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
- `personality.traits` 至少 5 项，基于全书行为总结。
- `description` ≥20字，禁止模板化。
- 禁止英文占位或问号兜底。

### ID 引用一致性

- `characters.faction` 必须使用 `factions.json` 中的 ID。
- `characters.known_skills / related_skills` 必须使用 `skills.json` 中的 ID。
- **禁止引用不存在的 ID**。
- 生成顺序：先 factions + skills → 再 characters → 最后 locations + techniques。

### ID 与枚举

- ID 严格按 `constants.md` 的 ID 规则：小写拼音 + 下划线，逐字拆分音节。
- 所有枚举值必须来自 `constants.md` 的合法值列表。

## 《天龙八部》专属上下文

### 本书叙事风格描述

金庸在《天龙八部》中采用典雅白话文，文白夹杂，对话偏文言而叙述流畅。叙事视角灵活，在段誉、萧峰、虚竹三线之间切换。语言特色：
- 大量引用佛经、《庄子》、《易经》等典籍
- 武功描写兼具想象力与画面感（如六脉神剑"剑气"、凌波微步步法方位）
- 角色对话各具个性：段誉话多且爱引经据典，萧峰豪迈直爽，虚竹憨厚朴实，阿紫刁钻刻薄
- 章节标题均为四字或七字对仗诗句（如"青衫磊落险峰行"、"教单于折箭 六军辟易 奋英雄怒"）

### 关键事件时间线

基于 mention_summary 的高频事件词和章节分布，推断全书重大事件节点：

| 阶段 | 章节范围 | 主要事件 | 核心角色 |
|------|----------|----------|----------|
| 段誉入江湖 | 1-9 | 无量山遇钟灵、坠崖见玉像、学凌波微步、万劫谷救人 | 段誉、钟灵、木婉清 |
| 段誉在大理 | 10-11 | 鸠摩智来犯、六脉神剑初现 | 段誉、鸠摩智 |
| 段誉遇阿朱王语嫣 | 12-18 | 曼陀山庄、无锡遇萧峰、聚贤庄大战 | 段誉、阿朱、萧峰 |
| 萧峰身世线 | 19-28 | 聚贤庄大战、身世揭秘、阿朱之死、辽国经历 | 萧峰、阿朱、阿紫、游坦之 |
| 虚竹线 | 29-38 | 珍珑棋局、少林寺大会、缥缈峰、天山童姥与李秋水 | 虚竹、丁春秋、天山童姥、李秋水 |
| 三线汇合 | 39-50 | 少室山大战、萧峰身世终揭、西夏招亲、辽国兵变、结局 | 三兄弟、慕容复、鸠摩智 |

### source_ref 锚定策略

**适合 first_mention 的锚点**：
- 段誉：第1回，无量山剑湖宫比武现场初登场
- 萧峰/乔峰：第9回首次提及名字，第14回正式出场
- 虚竹：第29回，少林寺中初登场
- 阿朱：第11回，曼陀山庄初登场
- 六脉神剑：第2回，琅嬛福地提及
- 降龙十八掌：第50回提及（由萧峰传虚竹）

**适合 climax 的锚点**：
- 聚贤庄大战：第19-20回
- 萧峰身世揭秘：第21回（雁门关往事）
- 阿朱之死：第23回（小镜湖畔）
- 珍珑棋局：第29回（擂鼓山）
- 少室山大战：第41-42回（三兄弟结义、萧远山揭秘）
- 萧峰拒征宋：第49-50回

**适合 resolution 的锚点**：
- 段誉为帝：第48-50回
- 虚竹为灵鹫宫主+西夏驸马：第44-46回
- 萧峰自尽：第50回
- 慕容复疯癫：第50回

### ID 命名示例

**角色**：
- `char_duan_yu` — 段誉
- `char_xiao_feng` — 萧峰（含乔峰时期）
- `char_xu_zhu` — 虚竹
- `char_a_zhu` — 阿朱
- `char_a_zi` — 阿紫
- `char_wang_yu_yan` — 王语嫣
- `char_mu_rong_fu` — 慕容复
- `char_duan_zheng_chun` — 段正淳
- `char_mu_wan_qing` — 木婉清
- `char_jiu_mo_zhi` — 鸠摩智
- `char_ding_chun_qiu` — 丁春秋
- `char_xiao_yuan_shan` — 萧远山
- `char_mu_rong_bo` — 慕容博
- `char_xuan_ci` — 玄慈
- `char_you_tan_zhi` — 游坦之
- `char_tian_shan_tong_lao` — 天山童姥
- `char_li_qiu_shui` — 李秋水
- `char_wu_ya_zi` — 无崖子
- `char_duan_yan_qing` — 段延庆
- `char_ye_lv_hong_ji` — 耶律洪基

**功法**：
- `skill_liu_mai_shen_jian` — 六脉神剑
- `skill_yi_yang_zhi` — 一阳指
- `skill_ling_bo_wei_bu` — 凌波微步
- `skill_bei_ming_shen_gong` — 北冥神功
- `skill_sheng_si_fu` — 生死符
- `skill_huo_yan_dao` — 火焰刀
- `skill_xiao_wu_xiang_gong` — 小无相功
- `skill_xiang_long_shi_ba_zhang` — 降龙十八掌
- `skill_da_gou_bang_fa` — 打狗棒法
- `skill_dou_zhuan_xing_yi` — 斗转星移
- `skill_yi_jin_jing` — 易筋经
- `skill_nian_hua_zhi` — 拈花指
- `skill_shen_zu_jing` — 神足经
- `skill_hua_gong_da_fa` — 化功大法
- `skill_ban_ruo_zhang` — 般若掌
- `skill_can_he_zhi` — 参合指
- `skill_wu_xiang_jie_zhi` — 无相劫指

**门派**：
- `faction_da_li_duan_shi` — 大理段氏
- `faction_gai_bang` — 丐帮
- `faction_shao_lin` — 少林寺
- `faction_xing_xu_pai` — 星宿派
- `faction_xiao_yao_pai` — 逍遥派
- `faction_ling_jiu_gong` — 灵鹫宫
- `faction_gu_su_mu_rong` — 姑苏慕容氏
- `faction_wu_liang_jian` — 无量剑

### 已知陷阱

**容易被遗漏的角色**：
- **段延庆**：出场不多但极关键——他是段誉的生父，四大恶人之首。提及数不多但身份揭秘是全书重大转折。
- **苏星河**：无崖子弟子，珍珑棋局的布置者，虚竹的引路人。
- **智光大师**：雁门关事件的知情人，帮助萧峰揭开身世。
- **全冠清**：丐帮叛徒，揭露萧峰契丹人身份的推手。
- **完颜阿骨打**：女真族首领，萧峰在辽国时期的盟友。仅有8次提及但为真实历史人物。

**容易被忽略的功法**：
- **神足经**（22次提及）：游坦之修炼的核心功法，常被遗漏
- **参合指**（2次提及）：慕容氏家传指法，仅在少室山大战中出现
- **伏魔杖法**（2次提及）：慕容博与萧远山交手时使用

**关系图常见错误**：
- 萧峰与乔峰应为同一角色，不要分开建立
- 段誉与木婉清、钟灵、阿朱、阿紫、王语嫣均为同父异母兄妹（段正淳子女），但段誉本人实为段延庆之子
- 阿朱与阿紫是亲姐妹（同为段正淳与阮星竹之女）
- 虚竹的父母是玄慈与叶二娘——这一关系直到少室山大战才揭露
- 慕容博与慕容复是父子关系

## 工作流

1. 先通读 `manifest.json` 和 `mention_summary.json`，建立全书结构感。
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details。
3. **如果 `outline.json` 不存在**：在脑中/草稿里列出主要角色、门派、地点、功法的清单。
4. **按以下顺序生成**（重要！确保 ID 引用正确）：
   - **第一步**：生成 `factions.json` 和 `skills.json`——这是基础数据
   - **第二步**：生成 `characters.json`——引用 factions 和 skills 的 ID
   - **第三步**：生成 `locations.json` 和 `techniques.json`
5. 按重要性从高到低生成实体：核心 → 重要 → 次要 → 龙套 → 背景。
6. 写完一个实体，立刻回查原文确认 source_refs 的真实性。
7. **最后检查**：
   - 关系图无冲突、ID 无重复、枚举值合法、所有字段非空
   - **ID 引用一致性**：characters.faction 必须是 factions.json 中的 ID
   - **禁止使用名称代替 ID**

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
