---
name: distill-techniques
description: DEPRECATED — use distill-skills-and-techniques instead. Kept for reference only.
---

# 提炼招式（已合并）

> **⚠ 已合并入 `distill-skills-and-techniques`。** 单独运行会导致 skill 交叉校验缺失。请使用合并版本。

# 提炼招式（旧版，仅供参考）

从 `<小说目录>/techniques.json` 提炼出干净的招式数据：标准化 type 枚举、修复无效 source_skill 引用、去除噪声条目。

## 核心原则

**像编纂招式图鉴一样筛选。** 有明确招式名称、有归属功法、有实战描述的招式才配列入图鉴。一次性的动作描述、阵法指挥、疗伤操作不配。

## 标准 type 枚举（13 种）

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

## TYPE_MAP（非标准 type 自动映射）

```
剑招/兵刃招/兵器招式/短兵招/掌招 → attack
小指剑气/中指剑气/无名指剑气/食指剑气/剑气 → attack
点穴/擒拿/grab → control
运功 → buff
毒性效果/毒性发作 → debuff
身法剑招 → movement
毒兽攻击/毒药手段 → poison
心法 → internal
药理能力/传音/发声 → support
邪术/暗器发射/暗器手法 → special
```

未映射的非标准 type → 逐条判断，无法归类则删除。

## 删除标准

| 类型 | 示例 |
|------|------|
| type 为 `formation`（阵法） | 天罡北斗阵某阵位 |
| type 为 `command`（号令） | 指挥号令 |
| source_skill 已被 distill-skills 删除且无法重指向 | — |
| 泛称/描述性名称，非独立招式名 | 般若掌掌力、刚猛掌劲、凌空指力、北冥护体 |
| 功法+动作描述 | 一阳指疗伤、天山六阳掌疗伤、天山折梅手起手式 |
| 状态/过程描述 | 生死符发作、符毒发作、生死符解法 |
| 普通兵器动作 | 单刀脱手、横砍而至、连砍四刀、铁拐横扫 |
| 训练/辅助手段 | 王鼎助练、心法配合 |
| 内功/特殊功法下的所有 technique | 北冥神功、一阳指、化功大法、小无相功等本身无招式体系 |
| 与同 skill 下其他 technique 高度重复 | — |

**内功规则**：内功类 skill（北冥神功、一阳指、化功大法、小无相功、易筋经等）在原著中是整套功法，没有独立招式。其 technique 实为描述性文字，全部删除。例外：若功法有公认的特定能力（如「返老还童」），可保留为一条 technique。

**身法规则**：身法类 skill（凌波微步、传音入密等）在原著中是整套身法/技能，没有独立招式。其 technique 实为动作描述，全部删除。

**判断关键**：招式名是否有独立的武学身份？「关冲剑」是招式名，「食指剑气」是描述。「见龙在田」是招式名，「刚猛掌劲」是描述。至少要像「关冲剑」「少冲剑」这种级别才算合格。

**前缀去重**：若招式名以所属功法名开头（如「火焰刀凌虚发劲」「大金刚拳隔空震鼎」），去掉功法前缀，只保留招式本名（「凌虚发劲」「隔空震鼎」）。去掉前缀后若只剩泛称（如「掌」「劲」），则删除整条。

## 无效 source_skill 处理

三种情况：

**a) skill 被 distill-skills 删除**（最常见）
→ 检查 technique 名和 description，若与某现存 skill 高度关联则重指向；否则删除

**b) skill ID 拼写错误/格式问题**
→ 修正 ID

**c) 无 source_skill**
→ 若招式有武学价值（名字有独立性、description 有具体招式描述），创建新 skill 收归：
   - 为该角色/门派创建 skill
   - 从 technique 的 source_refs 提取 one_line 和 source_refs
   - 将 technique 的 source_skill 指向新 skill

## 同名合并

同一名称的 technique 合并为一条：
- 保留信息更丰富（description 更详细、source_refs 更多）的条目
- 合并 source_refs

## 执行

1. 确认 `<小说目录>/techniques.json` 存在且 `<小说目录>/archive/techniques.json` 不存在
2. 将 `<小说目录>/techniques.json` 复制到 `<小说目录>/archive/techniques.json`
3. 读取 `archive/techniques.json` + `skills.json`
4. **type 标准化**：按 TYPE_MAP 批量替换非标准 type
5. **source_skill 校验**：标记所有指向无效 skill 的条目
6. **修复无效引用**：按三种情况分别处理（重指向 / 修正 ID / 创建新 skill）
7. **删除**：按删除标准去除噪声条目
8. **合并**：同名 technique
9. **人工复核**：输出 `techniques_pending.md`，列出不确定项供用户确认
10. 写入 `<小说目录>/techniques.json` + `<小说目录>/techniques_summary.md`

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

## 产物校验

- JSON 可解析
- 无重复 ID
- 所有 ID 为小写下划线
- 所有 `type` 属于 13 种标准枚举
- 所有 `source_skill` 指向有效 skill（在 skills.json 中存在）
- `source_refs` 原样保留
- 保留率预期 35%–50%（仅保留有独立招式名的，内功/身法/泛称/描述类删除）

## 与其他 distill 的依赖

**必须在 `distill-skills` 之后运行。** distill-skills 会删除不合格的 skill，distill-techniques 需要根据最终的 skills.json 校验 source_skill 引用。
