# Comet Design Handoff

- Change: wuxia-data-pipeline
- Phase: design
- Mode: compact
- Context hash: 436c50cb095b96b76e9fa7084ea3a00a6d30bff5d4408295e2ae0b86dc7cfdd1

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/wuxia-data-pipeline/proposal.md

- Source: openspec/changes/wuxia-data-pipeline/proposal.md
- Lines: 1-30
- SHA256: f7b8b239bfa450f7fb8e283364389eda203827c66efef50e57499dbdc81aa9bc

```md
## Why

武侠RPG游戏需要从小说文本中提取结构化数据（人物、武功、门派、关系、场景），供游戏引擎运行时使用。目前项目有210本武侠小说纯文本，无任何结构化数据。需要一套提取管道，将小说转化为游戏可用的JSON数据+context-mode可检索的文本索引。

## What Changes

- 建立武侠小说数据提取管道：小说原文 → 骨架提取 → 深度提取 → 合并去重 → 游戏化赋值 → RAG切片
- 定义通用数据Schema（角色卡、技能卡、功法卡、门派卡、场景卡、任务卡）
- 设计"框架模板+小说补丁"架构，支持多小说复用
- 先从《天龙八部》单本验证，再扩展到通用框架

## Capabilities

### New Capabilities

- `novel-extraction`: 小说文本提取管道——骨架提取（人物/门派/地点/武功粗列表）+ 深度提取（详细属性/关系/事件/对话）
- `data-schema`: 通用武侠数据Schema定义——角色卡、功法卡（含招式子层）、门派卡、场景卡、任务卡、关系卡
- `game-stats`: 游戏化数值系统——角色模板、原型修正、实力排名倍率、门派加成、成长曲线、战斗公式
- `framework-patch`: 框架+补丁架构——通用模板定义 + 小说级覆盖/扩展机制

### Modified Capabilities

（无，这是全新系统）

## Impact

- 新增目录结构：`openspec/specs/` 下4个能力规格文件
- 新增数据目录：`金庸/chapters/`（逐章JSON）、`framework/`（模板）、`novels/tianlong-babu/`（合并数据）
- 依赖：context-mode MCP（FTS5文本索引）、LLM API（提取用）
- 无现有代码影响，纯新增系统
```

## openspec/changes/wuxia-data-pipeline/design.md

- Source: openspec/changes/wuxia-data-pipeline/design.md
- Lines: 1-88
- SHA256: db66f64b6079e09401189bd7c30085ae496e60c2f92a073e46dc31f7e19dc796

[TRUNCATED]

```md
# 武侠小说拆解系统 - 设计文档

## 架构概览

```
小说原文 → 骨架提取 → 深度提取 → 合并去重 → 游戏化赋值 → RAG切片
  (txt)     (LLM)      (LLM)     (脚本)     (模板+脚本)  (context-mode)
```

## 核心设计决策

### 1. 检索层：context-mode FTS5 + JSON结构化

- **JSON结构化**：精确查询（属性/数值/关系/状态）
- **context-mode FTS5**：文本检索（场景/对话/描写）
- **LLM**：理解+生成（消费检索结果）
- 不引入向量DB，武侠关键词天然特异，BM25够用

### 2. 数据Schema：双层武功结构

- **Skill（功法）**：完整武功体系，如"六脉神剑"、"无量剑法"
- **Technique（招式）**：功法内的具体招式，如"商阳剑"、"跌扑步"
- 角色引用分为：`known_skills`（已掌握）+ `related_skills`（关联未学会）

### 3. 门派：统一实体+宗门标记

- 无量剑派作为统一实体，东宗/西宗/北宗作为sub_divisions
- 不拆成独立门派

### 4. 框架+补丁架构

- `framework/`：通用Schema + 模板（角色模板、门派模板、数值公式）
- `novels/<name>/`：小说级数据 + patch.yaml覆盖/扩展

### 5. 游戏化赋值公式

```
最终属性 = Base(role) × Archetype修正 × PowerRank倍率 + Faction加成
```

## 数据结构

### 角色卡
- id, name, alias, identity, faction, role
- personality (traits, speech_style, temperament)
- known_skills, related_skills
- relationships (target, type, intensity, bond_level)
- rag_refs (appearance, personality, key_dialogue)

### 功法卡
- id, name, type, faction, techniques[]
- novel_power_rank, combat_style
- stats (damage, mp_cost, cooldown, range)
- progression (level 1-5 unlock effects)
- counters (strong_against, weak_against)

### 招式卡
- id, name, parent_skill, type
- effects (damage, debuff, buff)

## 提取流程

1. **骨架提取**：每章一次，输出人物/门派/地点/武功粗列表
2. **深度提取**：每章一次，输出详细属性/关系/事件/对话
3. **合并去重**：50章合并，按id取并集
4. **游戏化赋值**：模板+公式计算数值
5. **RAG切片**：场景/对话/描写切块，context-mode索引

## 目录结构

```
wuxia_novel/
├── framework/
│   ├── schema/          # JSON Schema定义
│   ├── templates/       # 数值模板
│   └── balance/         # 平衡公式
├── novels/
│   └── tianlong-babu/
│       ├── chapters/    # 逐章JSON
│       ├── characters/  # 合并后角色
```

Full source: openspec/changes/wuxia-data-pipeline/design.md

## openspec/changes/wuxia-data-pipeline/tasks.md

- Source: openspec/changes/wuxia-data-pipeline/tasks.md
- Lines: 1-38
- SHA256: aa462fbbcef18b1aac352f6577ba7d508194b13064b8bd7b8e30c7fccfd0f6fb

```md
# 任务清单

## Phase 1: Schema与模板定义

- [ ] 1.1 定义角色卡JSON Schema (`framework/schema/character.schema.json`)
- [ ] 1.2 定义功法卡JSON Schema (`framework/schema/skill.schema.json`)
- [ ] 1.3 定义招式卡JSON Schema (`framework/schema/technique.schema.json`)
- [ ] 1.4 定义门派卡JSON Schema (`framework/schema/faction.schema.json`)
- [ ] 1.5 定义场景卡JSON Schema (`framework/schema/location.schema.json`)
- [ ] 1.6 定义任务卡JSON Schema (`framework/schema/quest.schema.json`)
- [ ] 1.7 创建角色模板 (`framework/templates/archetypes.json`)
- [ ] 1.8 创建门派模板 (`framework/templates/factions.json`)
- [ ] 1.9 创建数值平衡公式 (`framework/balance/combat-formula.json`)

## Phase 2: 提取管道

- [ ] 2.1 编写骨架提取prompt模板 (`tools/extract/skeleton-prompt.md`)
- [ ] 2.2 编写深度提取prompt模板 (`tools/extract/deep-prompt.md`)
- [ ] 2.3 编写骨架提取脚本 (`tools/extract/extract-skeleton.py`)
- [ ] 2.4 编写深度提取脚本 (`tools/extract/extract-deep.py`)
- [ ] 2.5 对天龙八部50章执行骨架提取

## Phase 3: 合并与游戏化

- [ ] 3.1 编写多章合并脚本 (`tools/merge/merge-chapters.py`)
- [ ] 3.2 编写游戏化赋值脚本 (`tools/gamify/assign-stats.py`)
- [ ] 3.3 对天龙八部执行合并+游戏化

## Phase 4: RAG索引

- [ ] 4.1 编写RAG切片脚本 (`tools/rag/chunk-text.py`)
- [ ] 4.2 对天龙八部执行RAG切片并建立context-mode索引

## Phase 5: 验证

- [ ] 5.1 验证提取数据完整性（人物/技能/门派数量）
- [ ] 5.2 验证游戏化数值合理性
- [ ] 5.3 验证context-mode检索效果
```

