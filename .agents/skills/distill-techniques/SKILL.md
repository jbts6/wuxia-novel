---
name: distill-techniques
description: Use when a wuxia novel directory needs its techniques.json cleaned — normalizing types, fixing broken source_skill references, and removing noise. Trigger on "clean techniques", "distill techniques", "fix technique types", or "招式清洗".
---

# 提炼招式

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
| description < 10 字且无独特信息 | — |
| 与同 skill 下其他 technique 高度重复 | — |

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

## 按功法统计（top 10）
| 功法 | 招式数 |
|------|--------|
| 六脉神剑 | 6 |
| ... | ... |
```

## 产物校验

- JSON 可解析
- 无重复 ID
- 所有 ID 为小写下划线
- 所有 `type` 属于 13 种标准枚举
- 所有 `source_skill` 指向有效 skill（在 skills.json 中存在）
- `source_refs` 原样保留
- 保留率预期 60%–75%

## 与其他 distill 的依赖

**必须在 `distill-skills` 之后运行。** distill-skills 会删除不合格的 skill，distill-techniques 需要根据最终的 skills.json 校验 source_skill 引用。
