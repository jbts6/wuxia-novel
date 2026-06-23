---
name: distill-skills-and-techniques
description: Use when a wuxia novel directory needs its skills.json and techniques.json cleaned together. Handles skill filtering, technique type normalization, cross-reference validation, and noise removal in a single pass. Trigger on "clean skills and techniques", "distill all", or "功法招式清洗".
---

# 提炼功法与招式

从 `<小说目录>/archive/skills.json` 和 `<小说目录>/archive/techniques.json` 一次性提炼出干净的 `skills.json` + `techniques.json`。两个文件相互依赖，必须合并处理。

## 核心原则

**功法和招式是一体的。** 删 skill 前要看它有没有合格的 technique；清 technique 前要确认它的 source_skill 是否有效。分开处理会导致误删或孤儿引用。

---

## 第一阶段：备份与读取

1. 确认 `<小说目录>/archive/skills.json` 和 `<小说目录>/archive/techniques.json` 不存在
2. 将 `<小说目录>/skills.json` 复制到 `<小说目录>/archive/skills.json`
3. 将 `<小说目录>/techniques.json` 复制到 `<小说目录>/archive/techniques.json`
4. 读取两个 archive 文件

---

## 第二阶段：清理 techniques

### 标准 type 枚举（13 种）

| type | 说明 |
|------|------|
| `attack` | 攻击招式 |
| `defense` | 防御/格挡 |
| `buff` | 增益/强化 |
| `debuff` | 减益/削弱 |
| `control` | 控制/擒拿 |
| `feint` | 虚招/佯攻 |
| `movement` | 身法/位移 |
| `poison` | 毒术 |
| `internal` | 内功运用 |
| `support` | 辅助/治疗 |
| `combo` | 连招/组合 |
| `counter` | 反击/化解 |
| `special` | 特殊/无法归类 |

### TYPE_MAP

```
剑招/兵刃招/兵器招式/短兵招/掌招/招式 → attack
小指剑气/中指剑气/无名指剑气/食指剑气/剑气 → attack
点穴/擒拿/grab → control
运功 → buff
毒性效果/毒性发作 → debuff
身法剑招 → movement
毒兽攻击/毒药手段 → poison
心法 → internal
药理能力/传音/发声 → support
邪术/暗器发射/暗器手法 → special
healing → support
```

### Technique 删除标准

| 类型 | 示例 |
|------|------|
| type 为 `formation`/`command` | 天罡北斗阵某阵位、讨饭调令 |
| 泛称/描述性名称 | 般若掌掌力、刚猛掌劲、凌空指力、北冥护体 |
| 功法+动作描述 | 一阳指疗伤、天山六阳掌疗伤、天山折梅手起手式 |
| 状态/过程描述 | 生死符发作、符毒发作、生死符解法 |
| 普通兵器动作 | 单刀脱手、横砍而至、连砍四刀、铁拐横扫 |
| 训练/辅助手段 | 王鼎助练、心法配合 |
| 内功/身法类 skill 下的所有 technique | 北冥神功、一阳指、化功大法、凌波微步等 |
| 与同 skill 下其他 technique 高度重复 | — |

### 内功/身法规则

内功类 skill（北冥神功、一阳指、化功大法、小无相功、易筋经等）和身法类 skill（凌波微步、传音入密等）在原著中是整套功法，没有独立招式。其 technique 实为描述性文字，全部删除。

例外：若功法有公认的特定能力（如「返老还童」），可保留为一条 technique。

### 前缀去重

若招式名以所属功法名开头（如「火焰刀凌虚发劲」「大金刚拳隔空震鼎」），去掉功法前缀，只保留招式本名（「凌虚发劲」「隔空震鼎」）。去掉前缀后若只剩泛称（如「掌」「劲」），则删除整条。

### 判断关键

招式名是否有独立的武学身份？「关冲剑」是招式名，「食指剑气」是描述。「见龙在田」是招式名，「刚猛掌劲」是描述。至少要像「关冲剑」「少冲剑」这种级别才算合格。

---

## 第三阶段：清理 skills

### Skill 保留标准

| 条件 | 示例 |
|------|------|
| 有明确招式体系的武功 | 降龙十八掌、打狗棒法、蛤蟆功 |
| 门派标志性功法 | 玉女剑法、弹指神通、全真剑法 |
| 可传承的内功心法 | 玉女心经、九阴真经、寒玉床内功 |
| 有实战价值的独立招式 | 三无三不手、美女拳法、天罗地网势 |
| 阵法（有明确阵位和配合） | 天罡北斗阵、二十八宿大阵 |
| 暗器功夫（有招式体系） | 金铃索法、双轮轮法、驭蜂术 |

### Skill 删除标准

| 类型 | 示例 |
|------|------|
| **人名+泛称** | 乔峰轻功、少林高僧掌法、木婉清剑法、风波恶刀法、公冶干掌法 |
| **门派+泛称** | 丐帮轻功、少林内功、无量轻功 |
| **事件/场景描述** | 雁门暗器伏击、江南追杀阵 |
| **非武术能力** | 腹语术、易容术、棋艺、音律、口技、谭公金创药 |
| **人名+武器** | 秦红棉短箭、叶二娘薄刀、南海鳄神鳄嘴剪、段延庆铁杖功 |
| **统称/泛称** | 星宿邪功、轻功、毒箭暗器、算盘珠暗器 |
| 医术/疗伤 | 接骨点穴、闻香点穴 |
| 威慑/标记 | 血手印、赤练血手印 |
| 驯养/驱使 | 双雕驯令、玉蜂驯召 |
| 泛称/总类 | 全真武功、古墓派武功 |
| 入门/基础 | 全真入门心法、全真入门拳法 |
| 训练法（非实战） | 古墓派绳上睡法 |
| 个人临场发挥 | 郭靖推劲、杨过飞石点穴 |
| 临时/一次性 | 杨过大剪刀破拂尘 |
| 重复/已合并 | 李莫愁赤练神掌（已有赤练神掌） |
| 太过细碎的单招 | 太公钓鱼、李莫愁拂尘巧劲 |
| 伪装/易容 | 周伯通易容混战 |
| 情绪/音律攻击 | 李莫愁悲歌慑心 |

**判断关键**：skill 名称是否有独立的武学身份？「降龙十八掌」是功法名，「乔峰轻功」是描述。「六脉神剑」是功法名，「少林内功」是描述。

### 命名规则

去除技能名中的人名前缀，保留功法本名。若功法名以「人名 + 功法名」开头，去掉人名。若功法名本身含门派名且门派名是功法标识的一部分（如「全真剑法」），则保留门派名。

---

## 第四阶段：交叉校验

这是合并流程的关键——单独处理时缺失的步骤。

### 4a. 保 skill：有合格 technique 的 skill 不删

遍历待删除 skill 列表，检查 techniques 中是否有 technique 指向该 skill。若 technique 名称合格（有独立招式名，非泛称/描述），则保留该 skill。

**案例**：蓬莱八仙招只有 1 条 source_refs，看似不合格。但它下辖「张果老倒骑驴」「韩湘子雪拥蓝关」「遨游东海」3 个正经八仙招式名，应保留。

### 4b. 删 technique：指向已删 skill 的 technique 处理

遍历所有 technique，若 source_skill 指向已删除的 skill：
- 该 technique 名称合格且可归属其他现存 skill → 重指向
- 该 technique 名称合格但无合适归属 → 为角色/门派创建新 skill 收归
- 该 technique 名称不合格（泛称/描述）→ 删除

### 4c. 补 skill：无 source_skill 的 technique

若 technique 无 source_skill 但名称有武学价值，创建新 skill 收归。

---

## 第五阶段：去重与收尾

1. **同名 technique 合并**：保留信息更丰富的一条，合并 source_refs
2. **同名 skill 合并**：去人名后同名功法合并为一条
3. **输出待复核**：`techniques_pending.md` + `skills_pending.md`（如有不确定项）
4. **写入**：`skills.json` + `techniques.json` + `skills_summary.md` + `techniques_summary.md`

---

## skills_summary.md 格式

```markdown
# 《书名》功法清单

共 N 条（原 M 条，保留 X%）

| 功法 | 保留原因 |
|------|----------|
| 降龙十八掌 | 丐帮绝学，有明确招式体系 |
| ... | ... |
```

## techniques_summary.md 格式

```markdown
# 《书名》招式清单

共 N 条（原 M 条，保留 X%）

## 按 type 统计
| type | 数量 |
|------|------|
| attack | 45 |
| ... | ... |

## 按功法统计（全部）
| 功法 | 招式数 | 招式 |
|------|--------|------|
| 六脉神剑 | 6 | 少商剑、商阳剑、中冲剑、关冲剑、少冲剑、少泽剑 |
| ... | ... | ... |
```

每个功法下列出具体招式名，便于人工校对归属是否合理。

---

## 产物校验

### skills.json
- JSON 可解析
- 无重复 ID
- 所有 ID 为小写下划线
- `source_refs` 和 `rag_refs` 原样保留

### techniques.json
- JSON 可解析
- 无重复 ID
- 所有 ID 为小写下划线
- 所有 `type` 属于 13 种标准枚举
- 所有 `source_skill` 指向有效 skill
- `source_refs` 原样保留

### 交叉校验
- 无孤儿 technique（source_skill 指向不存在的 skill）
- 有合格 technique 的 skill 未被误删
- 内功/身法类 skill 下无 technique
