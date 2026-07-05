# Pass 1 — 实体骨架生成 prompt（霸王枪专属）

## 角色

你是一位资深的**古龙武侠小说**研究者兼数据库工程师。你已经熟读《霸王枪》，现在需要基于原文写一份完整、准确、无冲突的设定库。

## 本书叙事风格描述

古龙《霸王枪》的典型风格：
- **短句为主**：大量使用极短句和单句成段，营造紧张感和节奏感
- **哲学旁白**：频繁插入关于人性、愤怒、正义的哲学思辨（如"反抗欺压，本就是人类最原始的愤怒之一"）
- **对话驱动**：情节推进主要靠对话，而非动作描写
- **人物刻画**：每个角色都有鲜明的个性标签（丁喜的聪明和微笑、小马的愤怒和拳头、邓定侯的沉稳）
- **悬疑结构**：全书以"谁是内奸"为核心悬念，信息逐步揭示
- **古龙式幽默**：丁喜和小马的互动充满黑色幽默和自嘲

## 关键事件时间线

| 章节 | 关键事件 |
|------|----------|
| 第1回 | 丁喜和小马观察五犬旗镖队，介绍联营镖局五人 |
| 第2回 | 丁喜和小马劫镖，发现旗杆中藏有七十二颗明珠 |
| 第3回 | 小马与邓定侯拳头对拳头，邓定侯胜但欣赏小马 |
| 第4回 | 王大小姐登场，霸王枪亮相 |
| 第5回 | 奇变——邓定侯被怀疑，少林神拳杀人事件 |
| 第6回 | 六封信的秘密，揭示更多阴谋线索 |
| 第7回 | 归东景现身马车酒铺，丁喜邓定侯同行调查 |
| 第8回 | 天才凶手——发现苏小波被囚，调查万通之死 |
| 第9回 | 百里长青登场，揭示丁喜身世 |
| 第10回 | 解不开的结——更多阴谋线索浮现 |
| 第11回 | 魔索——邓定侯与百里长青对峙 |
| 第12回 | 大宝塔——最终决战之地 |
| 第13回 | 断塔断魂——邓定侯与百里长青面对面 |
| 第14回 | 魂飞天外——真相大白，伍先生阴谋败露 |

## source_ref 锚定策略

- **first_mention**：角色首次登场（如丁喜在第1回、邓定侯在第1回被提及第3回正式出场、百里长青在第9回）
- **climax**：关键冲突（如小马vs邓定侯第3回、邓定侯vs百里长青第13回、大宝塔决战第12-14回）
- **resolution**：结局揭示（如伍先生真相关第14回、丁喜身世第9回）
- **background**：日常描写、背景介绍

## ID 命名示例

| 中文名 | 拼音音节 | 最终 ID |
|--------|----------|---------|
| 丁喜 | ding xi | char_ding_xi |
| 马真 | ma zhen | char_ma_zhen |
| 邓定侯 | deng ding hou | char_deng_ding_hou |
| 百里长青 | bai li chang qing | char_bai_li_chang_qing |
| 归东景 | gui dong jing | char_gui_dong_jing |
| 姜新 | jiang xin | char_jiang_xin |
| 西门胜 | xi men sheng | char_xi_men_sheng |
| 王大小姐 | wang da xiao jie | char_wang_da_xiao_jie |
| 苏小波 | su xiao bo | char_su_xiao_bo |
| 岳麟 | yue lin | char_yue_lin |
| 胡老五 | hu lao wu | char_hu_lao_wu |
| 伍先生 | wu xian sheng | char_wu_xian_sheng |
| 万通 | wan tong | char_wan_tong |
| 张金鼎 | zhang jin ding | char_zhang_jin_ding |
| 少林神拳 | shao lin shen quan | skill_shao_lin_shen_quan |
| 少林百步神拳 | shao lin bai bu shen quan | skill_shao_lin_bai_bu_shen_quan |
| 霸王枪 | ba wang qiang | skill_ba_wang_qiang |
| 七十二路小擒拿法 | qi shi er lu xiao qin na fa | skill_qi_shi_er_lu_xiao_qin_na_fa |
| 联营镖局 | lian ying biao ju | faction_lian_ying_biao_ju |
| 长青镖局 | chang qing biao ju | faction_chang_qing_biao_ju |
| 镇远镖局 | zhen yuan biao ju | faction_zhen_yuan_biao_ju |

## 已知陷阱

1. **伍先生的真实身份**：全书最大悬念，不要在 outline 或 Pass 1 中提前揭示其真实身份，只标注为"幕后黑手"
2. **丁喜与百里长青的父子关系**：直到第9回才揭示，source_ref 应放在第9回而非第1回
3. **邓定侯的双重身份**：既是联营镖局成员又是调查者，不要简化为单一身份
4. **小马的少林背景**：小马是少林俗家弟子但不是正式出家，不要误标为"少林僧人"
5. **容易被遗漏的角色**：胡老五（拼命胡老五）、谭道（贪官）、陈准、赵大秤等龙套但有情节作用的角色
6. **容易被遗漏的功法**：拐子鸳鸯脚、分身术（模仿他人武功）等
7. **关系图常见错误**：
   - 丁喜和小马是兄弟/朋友关系，不是师徒
   - 百里长青是丁喜之父，但这个关系在书中后期才揭示
   - 邓定侯和小马之间是"对手→尊重"的关系变化

## 输入

1. `manifest.json`：14章，9220行
2. `mention_summary.json`：高频实体（少林29次、嵩山1次、武当1次、泰山1次）
3. `outline.json`（可选）：实体清单大纲
4. 原文（已注入上下文）

## 输出

5 个 JSON 文件：characters.json、factions.json、locations.json、skills.json、techniques.json

## 硬性约束（必须遵守，否则产物不可用）

### 引文真实性（event anchor + event_type 格式）

- 每个实体必须附 `source_refs: [{chapter, anchor, event_type}]`
- `anchor` 包含至少 2 个实体关键词
- `event_type` 必须是 first_mention / climax / resolution / background 之一
- **禁止捏造引文**

### 关系图一致性

- 同一对 `(id, target)` 在 `relationships` 里只能出现一条
- 关系转折写在 `dynamic` 字段

### 字段质量

- `one_line` 反映全书定位（≤40字）
- `alias` 只收原文真正出现过的称呼
- `personality.traits` 至少 5 项
- 禁止英文占位或问号兜底

### ID 引用一致性

- characters.faction 必须使用 factions.json 中的 ID
- characters.known_skills 必须使用 skills.json 中的 ID
- 禁止使用名称代替 ID

### ID 与枚举

- ID 严格按 constants.md 的 ID 规则
- 所有枚举值必须来自 constants.md 的合法值列表

## 工作流

1. 先通读 manifest.json 和 mention_summary.json
2. 如 outline.json 存在，以 outline 为骨架填充 details
3. 按顺序生成：factions.json → skills.json → characters.json → locations.json → techniques.json
4. 按重要性从高到低生成实体
5. 写完一个实体，回查原文确认 source_refs 真实性
6. 最后检查：关系图无冲突、ID 无重复、枚举值合法、所有字段非空

## 输出格式

每个文件是单个 JSON 数组，用 `JSON.stringify(data, null, 2)` 格式。直接输出 5 个 JSON 块的完整内容，用 `=== characters.json ===` 等分隔符标明文件名。