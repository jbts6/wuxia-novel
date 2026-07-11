# Pass 1 — 实体骨架生成 prompt（鹿鼎记）

## 角色

你是一位资深的**武侠小说**研究者兼数据库工程师，尤其精通金庸、古龙、梁羽生、黄易四大家的作品。你已经熟读本书（这是你训练语料里的已知文本），现在需要基于原文写一份完整、准确、无冲突的设定库。

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
- 内功（如：神行百变、化骨绵掌）
- 掌法（如：化骨绵掌、少林长拳）
- 剑法（如：沐家剑法）
- 刀法
- 轻功（如：神行百变）
- 指法
- 拳法（如：美女拳法、少林长拳）

**items.json 收录武器/道具**，包括：
- 兵器（如：匕首、弹弓、铁锥）
- 暗器（如：银针、飞镖）
- 日常物品（如：百宝箱、化尸粉）
- 信物（如：四十二章经、地图）
- 秘籍实体书（如：四十二章经书册）

**区分标准**：如果一个东西是"招式/技巧"，放 skills；如果是"实体物品"放 items。

**特别注意**：四十二章经是实体经书（物品），不是武功（skill）！化尸粉是药物/道具（item），不是武功（skill）！

## 叙事风格参考

本书叙事风格特点：
- **典雅白话**：文白夹杂，叙述用典雅文言，对话用口语白话
- **幽默风趣**：全书充满喜剧色彩，韦小宝的言行常令人捧腹
- **角色语言差异极大**：韦小宝说话市井粗俗（"他妈的"、"老子不干了"、"鸟生鱼汤"），康熙说话文雅帝王气度
- **历史与虚构交织**：大量真实历史人物事件（擒鳌拜、平三藩、收台湾）与虚构情节融合
- **政治权谋**：宫廷斗争、江湖暗战、军事博弈交织
- **武侠元素相对弱化**：主角不会武功，更多靠口才和运气

## 关键事件时间线

| 章节 | 关键事件 |
|------|---------|
| ch1 | 扬州丽春院：韦小宝出生长大，母亲是妓女 |
| ch2 | 韦小宝被海大富带入皇宫，假扮小太监"小桂子" |
| ch3 | 韦小宝与康熙相识，设计擒拿鳌拜 |
| ch4 | 鳌拜被擒，韦小宝立功 |
| ch5-6 | 韦小宝在皇宫中周旋，与各方势力接触 |
| ch7-9 | 韦小宝逐渐在皇宫站稳脚跟 |
| ch10 | 天地会：陈近南收韦小宝为徒，赐名"贵会" |
| ch11 | 韦小宝身兼天地会与皇宫双重身份 |
| ch12 | 沐王府：沐剑屏、方怡登场，沐王府反清势力 |
| ch13 | 风际中等天地会成员活动 |
| ch14 | 建宁公主：韦小宝与建宁公主的纠葛 |
| ch15 | 韦小宝在各方势力间左右逢源 |
| ch16 | 神龙教：洪安通、苏荃登场，韦小宝被迫入教 |
| ch17 | 神龙岛经历 |
| ch18 | 双儿：韦小宝与庄家、双儿的缘分 |
| ch19-20 | 韦小宝出使 various 地方 |
| ch21 | 韦小宝的多线身份继续发展 |
| ch22 | 胖头陀、瘦头陀：神龙教两大高手 |
| ch23-24 | 韦小宝的江湖冒险 |
| ch25 | 九难师太：长平公主现身，韦小宝与明朝遗民的交集 |
| ch26-28 | 韦小宝在各地的冒险 |
| ch29 | 吴三桂：平西王登场，三藩之乱伏笔 |
| ch30-31 | 云南之行，韦小宝深入吴三桂地盘 |
| ch32 | 少林寺：韦小宝假扮小和尚，阿珂登场 |
| ch33 | 韦小宝与阿珂的情感纠葛 |
| ch34 | 归辛树一家：归二娘、归钟 |
| ch35-36 | 三藩之乱：吴三桂起兵反清 |
| ch37-38 | 韦小宝率军平叛 |
| ch39-40 | 战争与政治博弈 |
| ch41 | 台湾：施琅攻台，郑克塽投降 |
| ch42-45 | 韦小宝的巅峰时期与危机 |
| ch46-47 | 韦小宝遭遇危机，被各方势力追杀 |
| ch48 | 逃生与转机 |
| ch49-50 | 大结局：韦小宝携七妻归隐扬州 |

## source_ref 锚定策略

### anchor 描述规范

本书 source_ref 的 anchor 必须遵循以下格式：
- 包含至少 2 个实体关键词（人名/地名/武功/事件词）
- 使用本书特有的名称，不要用泛称
- 示例：
  - 对：`韦小宝扬州丽春院初登场`
  - 错：`主角出生`
  - 对：`韦小宝设计擒拿鳌拜`
  - 错：`主角抓住坏人`
  - 对：`陈近南天地会收韦小宝为徒`
  - 错：`师父收徒弟`

### event_type 分配

- `first_mention`：角色/地点/功法的首次登场
  - 示例：ch1 `韦小宝扬州丽春院初登场`
  - 示例：ch2 `海大富带韦小宝入皇宫`
  - 示例：ch10 `陈近南天地会首次登场`
- `climax`：关键冲突/转折点
  - 示例：ch3 `韦小宝设计擒拿鳌拜`
  - 示例：ch41 `施琅攻台郑克塽投降`
- `resolution`：收尾/结局
  - 示例：ch50 `韦小宝携七妻归隐扬州`
- `background`：背景介绍、日常描写
  - 示例：ch1 `扬州丽春院韦小宝成长背景`

### 章节分布参考

根据 mention_summary，主要角色的高频章节：
- 韦小宝：全书高频，几乎所有章节
- 康熙：ch2-10、ch35-50 最高
- 吴三桂：ch29-40 最高
- 阿珂：ch32-45 最高
- 双儿：ch18-20、ch45-50 最高
- 陈近南：ch10-15、ch42-45 最高
- 鳌拜：ch2-4 最高
- 郑克塽：ch41-45 最高

## ID 命名示例

### 角色 ID

- `char_wei_xiao_bao`：韦小宝
- `char_kang_xi`：康熙
- `char_wu_san_gui`：吴三桂
- `char_a_ke`：阿珂
- `char_shuang_er`：双儿
- `char_chen_jin_nan`：陈近南
- `char_ao_bai`：鳌拜
- `char_fang_yi`：方怡
- `char_mu_jian_ping`：沐剑屏
- `char_jian_ning_gong_zhu`：建宁公主
- `char_hong_an_tong`：洪安通
- `char_su_quan`：苏荃
- `char_hai_da_fu`：海大富
- `char_pang_tou_tuo`：胖头陀
- `char_shou_tou_tuo`：瘦头陀
- `char_duo_long`：多隆
- `char_suo_e_tu`：索额图
- `char_shi_lang`：施琅
- `char_zheng_ke_shang`：郑克塽
- `char_feng_xi_fan`：冯锡范
- `char_jiu_nan`：九难
- `char_gui_xin_shu`：归辛树
- `char_gui_er_niang`：归二娘
- `char_gui_zhong`：归钟
- `char_zeng_rou`：曾柔
- `char_mao_dong_zhu`：毛东珠
- `char_tao_hong_ying`：陶红英
- `char_lu_gao_xuan`：陆高轩
- `char_feng_ji_zhong`：风际中
- `char_zhuang_jia`：庄家
- `char_ming_zhu`：明珠

### 门派 ID

- `faction_tian_di_hui`：天地会
- `faction_shen_long_jiao`：神龙教
- `faction_mu_wang_fu`：沐王府
- `faction_shao_lin_si`：少林寺
- `faction_tie_jian_men`：铁剑门
- `faction_wang_wu_pai`：王屋派
- `faction_ping_xi_wang_fu`：平西王府
- `faction_qing_chao`：清朝朝廷

### 地点 ID

- `loc_bei_jing`：北京
- `loc_yang_zhou`：扬州
- `loc_yun_nan`：云南
- `loc_tai_wan`：台湾
- `loc_wu_tai_shan`：五台山
- `loc_qing_liang_si`：清凉寺
- `loc_shen_long_dao`：神龙岛
- `loc_huang_gong`：皇宫
- `loc_li_chun_yuan`：丽春院
- `loc_lu_ding_shan`：鹿鼎山
- `loc_du_cheng`：都城（北京）

### 功法 ID

- `skill_hua_gu_mian_zhang`：化骨绵掌
- `skill_shen_xing_bai_bian`：神行百变
- `skill_mei_nv_quan_fa`：美女拳法
- `skill_shao_lin_chang_quan`：少林长拳

## 已知陷阱

### 容易遗漏的角色

1. **海大富**：ch2 带韦小宝入宫的太监，武功高强，是韦小宝早期的关键人物
2. **多隆**：ch3 起，韦小宝在皇宫中的好友，御前侍卫
3. **索额图**：ch3 起，康熙朝权臣
4. **明珠**：ch3 起，康熙朝另一位权臣
5. **风际中**：天地会成员，暗中叛变
6. **陆高轩**：神龙教军师
7. **陶红英**：宫中女侍卫，与韦小宝关系特殊
8. **归辛树/归二娘/归钟**：归家三人，归辛树武功高强但儿子归钟体弱
9. **曾柔**：王屋派女侠，韦小宝妻子之一
10. **毛东珠**：假冒太后的女人，原为神龙教教徒

### 容易遗漏的功法

1. **神行百变**：轻功，韦小宝的主要逃命技能
2. **化骨绵掌**：掌法，胖头陀的绝技
3. **美女拳法**：拳法，九难教阿珂的武功
4. **少林长拳**：拳法，韦小宝在少林寺学的入门功夫

### 容易搞错的关系

1. **韦小宝与康熙**：亦君亦友，韦小宝是康熙的"小桂子"，两人关系复杂
2. **韦小宝与陈近南**：师徒关系，陈近南是天地会总舵主
3. **韦小宝的七位妻子**：双儿、阿珂、方怡、沐剑屏、建宁公主、曾柔、苏荃（顺序不分先后）
4. **洪安通与苏荃**：原为夫妻，苏荃后归韦小宝
5. **九难与长平公主**：同一人，明朝公主化名出家
6. **毛东珠与太后**：毛东珠假冒太后，原为神龙教教徒
7. **胖头陀与瘦头陀**：都是神龙教高手，名字与体型相反（胖头陀反而瘦，瘦头陀反而胖）
8. **郑克塽与郑经**：郑经是父亲（延平郡王），郑克塽是儿子（少主）
9. **施琅与郑家**：施琅原为郑家将领，后降清，是攻台的清朝水师提督

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`。
- `anchor` 是对事件的一句话描述（含角色名 + 地名 + 事件关键词），不必是原文原句。后续由 `locate.js` 自动回填精确位置。
- `event_type` 必须是以下四种之一：
  - `first_mention`：角色/地点/功法/物品的**首次登场**（如"主角初遇某角色"、"某门派首次出现"）
  - `climax`：事件的**高潮/关键冲突**（如"大战某高手"、"揭秘身世之谜"、"擒拿鳌拜"）
  - `resolution`：事件的**收尾/结局**（如"最终决战"、"定情/分离"、"归隐扬州"）
  - `background`：背景介绍、日常描写、非关键情节
- 每个 source_ref 必须满足：(1) `chapter` 大致正确（事件发生的章节之一）；(2) `anchor` 包含至少 2 个实体关键词（人名 / 地名 / 武功 / 事件词）；(3) `event_type` 与事件性质匹配。
- **禁止捏造引文**。如果你不确定某事实的确切位置，宁可省略该实体，也不要编造 anchor。
- 每个实体至少 1 条 source_ref；核心角色至少 5 条分散在不同章节，覆盖 first_mention / climax / resolution。

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系类型和动态。
- 禁止同一对角色出现多条冲突记录（如既"患难同行"又"恋人"又"亲属"）。选最具代表性的一条。
- 如果关系在全书中有显著转折（如从恋人变宿敌），在 `dynamic` 字段里概述，不要拆成多条。

### 字段质量

- `one_line` 必须反映人物/实体的全书定位（≤40字），不是某章事件。
  - 对：`市井少年，全凭口才机智纵横皇宫与江湖，七妻环绕的传奇人物`
  - 错：`在第2回被海大富带入皇宫`
- `alias` 只收原文真正出现过的别名/称呼，禁止泛称。
  - 对：`小桂子`、`桂公公`、`韦爵爷`（具体称呼）
  - 错：`那少年`、`X姓青年`（泛称）
- `personality.traits` 至少 5 项，必须基于全书行为总结，不要套话。
- `description`（items/factions/locations）必须 ≥20字，禁止模板化。
- 禁止英文占位或问号兜底：`unknown`、`weapon`、`???`、`?`、`N/A` 都不允许。

### ID 引用一致性（必须严格遵守）

**characters.faction**：
- 必须使用 `factions.json` 中的 `id`（如 `faction_tian_di_hui`），**不能**使用名称（如"天地会"）。
- 如果人物不属于任何门派，设置为 `null`，**不能**使用"无"、"无门派"等字符串。

**characters.known_skills / related_skills**：
- 必须使用 `skills.json` 中的 `id`（如 `skill_shen_xing_bai_bian`），**不能**使用名称（如"神行百变"）。
- **禁止引用 skills.json 中不存在的 skill ID**。如果某 skill 不在 skills.json 中，先在 skills.json 中添加该 skill，再在 characters.json 中引用。

**items.owner / related_characters / related_skills**：
- `owner` 可以是 `characters.json` 中的 `id`（人物拥有），也可以是 `factions.json` 中的 `id`（门派拥有）。不能使用名称。
- `related_characters` 必须使用 `characters.json` 中的 `id`。
- `related_skills` 必须使用 `skills.json` 中的 `id`。

**dialogues.speaker / listener**：
- 必须使用 `characters.json` 中的 `id`，不能使用名称。

**生成顺序建议**：
1. 先生成 `factions.json` 和 `skills.json`（它们是基础数据）
2. 再生成 `characters.json`（引用 factions 和 skills 的 ID）
3. 最后生成 `locations.json` 和 `techniques.json`

### ID 与枚举

- ID 严格按 `constants.md` 的 ID 规则：小写拼音 + 下划线，逐字拆分音节。
- 所有枚举值（rank、type、role、tone 等）必须来自 `constants.md` 的合法值列表。

## 工作流

1. 先通读 `manifest.json` 和 `mention_summary.json`，建立全书结构感。
2. **如果 `outline.json` 存在**：以 outline 为骨架，对每个实体填充 details（relationships、personality、source_refs 等）。LLM 不再需要同时决定"列谁"和"细节是什么"，注意力更聚焦。
3. **如果 `outline.json` 不存在**：在脑中/草稿里列出主要角色、门派、地点、功法的清单。
4. **按以下顺序生成**（重要！确保 ID 引用正确）：
   - **第一步**：生成 `factions.json`（门派）和 `skills.json`（功法）—— 这是基础数据
   - **第二步**：生成 `characters.json`（角色）—— 引用 factions 和 skills 的 ID
   - **第三步**：生成 `locations.json`（地点）和 `techniques.json`（招式）
5. 按重要性从高到低生成实体：核心 → 重要 → 次要 → 龙套 → 背景。
6. 写完一个实体，立刻回查原文确认 source_refs 的真实性。
7. **最后检查**：
   - 关系图无冲突、ID 无重复、枚举值合法、所有字段非空
   - **ID 引用一致性**：characters.faction 必须是 factions.json 中的 ID，characters.known_skills 必须是 skills.json 中的 ID
   - **禁止使用名称代替 ID**：如"天地会"应为 `faction_tian_di_hui`，"神行百变"应为 `skill_shen_xing_bai_bian`

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。
