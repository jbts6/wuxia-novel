# distill-techniques 计划

## 问题诊断

以天龙八部（223 条）为主要样本，横向对比射雕（91）、神雕（306）、绝代双骄（55）、多情剑客无情剑（84）：

| 问题 | 天龙八部 | 神雕 | 射雕 | 古龙×2 |
|------|---------|------|------|--------|
| type 种类 | 44 | 39 | 6 | 6–7 |
| 中文 type | 26 种 | 28 种 | 0 | 0–1 |
| 无效 source_skill | 77 (34%) | 177 (58%) | 28 (31%) | 4–6 |
| 无 source_skill | 7 | 0 | 5 | 6 |
| 同名条目 | 1 | — | — | — |

**根因**：天龙八部和神雕的 techniques 提取 prompt 较早，允许中文 type 且粒度过细（六脉神剑每路单独一个 type）；射雕和古龙的 prompt 已标准化。`distill-skills` 删除了被引用的 skill，但 techniques.json 未同步清理。

## 标准 type 枚举（13 种）

参考射雕（干净基线）+ 天龙八部合理英文 type，定义：

| type | 说明 | 映射来源 |
|------|------|---------|
| `attack` | 攻击招式 | 原有；+剑招/兵刃招/兵器招式/短兵招/掌招/小指剑气/中指剑气/无名指剑气/食指剑气/剑气 |
| `defense` | 防御/格挡 | 原有 |
| `buff` | 增益/强化 | 原有；+运功 |
| `debuff` | 减益/削弱 | 原有；+毒性效果/毒性发作 |
| `control` | 控制/擒拿 | 原有；+点穴/擒拿/`grab` |
| `feint` | 虚招/佯攻 | 原有 |
| `movement` | 身法/位移 | 原有；+身法剑招 |
| `poison` | 毒术 | 原有；+毒兽攻击/毒药手段 |
| `internal` | 内功运用 | 原有；+心法/运功 |
| `support` | 辅助/治疗 | 原有；+药理能力/传音/发声 |
| `combo` | 连招/组合 | 原有 |
| `counter` | 反击/化解 | 原有 |
| `special` | 特殊/无法归类 | 原有；+邪术/暗器发射/暗器手法 |

**删除 type**：`formation`（阵法，应属 skills 范畴）、`command`（指挥号令，非技法）、`healing`（疗伤，归入 support）、`?`（7 条逐条判断）

## 清洗规则

### 1. type 标准化

按上表映射，消灭所有中文 type 和 `?`。合并 `grab` → `control`。

### 2. 无效 source_skill 处理

三种情况分别处理：

**a) skill 被 distill-skills 删除**（最常见）
→ 尝试从 deleted skill 名推断：若 technique 名与某现存 skill 高度关联，重指向；否则删除 technique（被删的 skill 本身就不合格，其 technique 通常也不合格）

**b) skill ID 拼写错误/格式问题**
→ 修正 ID

**c) 无 source_skill 的 7 条**
→ 保留名字有武学价值的招式，创建新 skill 收归：

| technique | 归属 |
|-----------|------|
| 春雷乍动 | → 现有 `skill_lei_gong_hong`（雷公轰）|
| 千里横行 | → 新建 `skill_mu_rong_fu_za_zhao`（慕容复杂招）|
| 金灯万盏 | → 新建 `skill_mu_rong_fu_za_zhao`（慕容复杂招）|
| 披襟当风 | → 新建 `skill_mu_rong_fu_za_zhao`（慕容复杂招）|
| 白帝斩蛇势 | → 新建 `skill_mu_rong_fu_za_zhao`（慕容复杂招）|
| 大漠飞沙 | → 新建 `skill_yu_shu_pai_dao_fa`（玉树派刀法）|
| 凭虚临风 | → 新建 `skill_bu_ping_dao_ren`（不平道人拂尘）|

新建 skill 的 one_line 和 source_refs 从 technique 的 source_refs 提取。

### 3. 同名合并

"锁喉" x2 → 保留信息更丰富的一条，合并 source_refs

### 4. 删除标准

| 条件 | 示例 |
|------|------|
| source_skill 已被 distill-skills 删除且无法重指向 | — |
| type 原为 `formation`/`command` | 天罡北斗阵指挥 |
| description < 10 字且无独特信息 | — |
| 与同 skill 下其他 technique 高度重复 | — |

### 5. 保留标准

- source_skill 指向有效 skill
- type 属于 13 种标准枚举
- description 有具体招式描述（非泛称）

## 执行步骤

1. 备份 `<小说目录>/techniques.json` → `<小说目录>/archive/techniques.json`
2. 读取 archive/techniques.json + skills.json
3. **type 映射**：按标准枚举批量替换
4. **source_skill 校验**：标记无效引用
5. **删除**：无效引用 + 无法重指向 + 噪声条目
6. **合并**：同名 technique
7. **人工复核**：输出 `techniques_pending.md`，列出不确定项
8. 写入 techniques.json + techniques_summary.md

## 产物校验

- JSON 可解析
- 无重复 ID
- 所有 `type` 属于 14 种标准枚举
- 所有 `source_skill` 指向有效 skill
- 保留率预期 60%–75%（天龙 223 → ~140–170）
- `source_refs` 原样保留

## 与其他 distill 的依赖

`distill-techniques` 必须在 `distill-skills` **之后**运行（否则 source_skill 引用校验无意义）。

## 已确认

- [x] `grab` 合并入 `control` → 最终 13 种 type 枚举
- [x] `formation`/`command` 删除
- [x] 无 source_skill 的 7 条保留，创建 3 个新 skill 收归（慕容复杂招、玉树派刀法、不平道人拂尘）
