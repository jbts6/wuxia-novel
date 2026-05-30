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
│       ├── skills/      # 合并后技能
│       ├── factions/    # 合并后门派
│       └── chunks/      # RAG文本块
└── tools/
    ├── extract/         # 提取脚本
    ├── merge/           # 合并脚本
    └── gamify/          # 游戏化脚本
```
