---
comet_change: wuxia-data-pipeline
role: technical-design
canonical_spec: openspec
---

# 武侠小说拆解系统 - 技术设计文档

## 概述

将武侠小说纯文本转化为游戏可用的结构化数据（JSON）+ 可检索文本索引（context-mode FTS5）。

目标：2D像素风武侠RPG，重剧情探索、队友羁绊、功法装备Build。

## 基本原则

1. **不得修改原文小说** — `天龙八部.txt` 等原始小说文件为只读，任何阶段不得写入、覆盖或重编码。所有生成数据写入同目录下的子文件夹。

## 架构

```
小说原文 → 骨架提取 → 深度提取 → 智能合并 → 游戏化赋值 → RAG切片
  (txt)     (LLM×50)  (LLM×50)  (脚本)    (模板+脚本)  (context-mode)
```

### 检索层分工

| 层 | 用途 | 技术 |
|---|------|------|
| 结构化数据 | 属性/数值/关系/状态（精确查询） | JSON文件 |
| 文本索引 | 场景/对话/描写（文本检索） | context-mode FTS5 |
| 运行时 | 理解+生成 | LLM消费检索结果 |

不引入向量DB。武侠关键词天然特异（"六脉神剑"、"降龙十八掌"），BM25够用。

## 提取管道

### Phase 1: 骨架提取

每章1次LLM调用，输出粗列表：

```json
{
  "characters": [{"name": "段誉", "identity": "大理世子", "faction": "大理段氏"}],
  "factions": [{"name": "无量剑", "type": "sect", "sub_divisions": ["东宗","西宗"]}],
  "locations": [{"name": "无量山", "region": "云南"}],
  "skills": [{"name": "六脉神剑", "type": "finger_sword"}]
}
```

目标：建立全局索引，为深度提取提供锚点。

### Phase 2: 深度提取

每章1次LLM调用，输入：章节原文 + 骨架索引。输出详细数据：
- 角色卡（personality, relationships, known_skills, related_skills）
- 技能卡（techniques, effects, progression）
- 事件链
- 对话片段（标记语气）

骨架作为锚点 → 减少幻觉，确保id一致性。

### 总调用量

50章 × 2 = 100次LLM调用。模型：Sonnet。

## 数据Schema

### 双层武功结构

```
Skill（功法）= 技能槽位
  └── Technique（招式）= 实际可释放的技能

六脉神剑 (Skill)
  ├── 商阳剑 (Technique)
  ├── 中冲剑 (Technique)
  └── 六脉齐发 (Technique, Lv5解锁)

角色引用:
  known_skills    → 已掌握的功法
  known_techniques → 已掌握的单个招式
  related_skills  → 关联但未学会
```

### 门派模型

统一实体 + 宗门标记：

```json
{
  "id": "faction_wuliang",
  "name": "无量剑",
  "sub_divisions": [
    {"name": "东宗", "leader": "char_zuo_zimu"},
    {"name": "西宗", "leader": "char_shuang_qing"},
    {"name": "北宗", "note": "已式微"}
  ]
}
```

### 角色卡核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 正式名 |
| gender | enum | male/female |
| age | object | {approximate: int, stage: enum, description: string} |
| role | enum | protagonist/companion/npc/villain |
| rank | enum | 返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇 |
| personality | object | traits[], speech_style, temperament |
| known_skills | string[] | 已掌握功法id |
| related_skills | string[] | 关联未学会功法id |
| relationships | array | target, type, intensity, bond_level |
| rag_refs | object | 文本块引用 |

### 技能卡核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| type | enum | sword_art/finger_art/palm_art/internal/movement/hidden_weapon/beast |
| techniques | string[] | 包含的招式id |
| rank | enum | 功法等级（同角色8级体系） |
| progression | array | Lv1-5解锁效果 |
| counters | object | strong_against, weak_against |

## 智能合并规则

以id为键，多章数据合并：

| 字段 | 策略 |
|------|------|
| name/id | 不可变 |
| alias | 取并集 |
| identity | 取最新（身份可能变化） |
| faction | 取最新 |
| role | 取最新（npc→companion） |
| personality | 取并集 |
| known_skills | 取并集 |
| related_skills | 取并集 |
| relationships | 取并集，intensity取最新 |
| appearances | 取并集 |

## 游戏化赋值

### 公式

```
最终属性 = Base(role) × Archetype修正 × Rank倍率 + Faction加成
```

### 角色模板 (Base)

| role | HP | MP | ATK | DEF | SPD | WIZ |
|------|-----|-----|------|------|------|------|
| protagonist | 1200 | 1000 | 70 | 60 | 70 | 50 |
| companion | 1000 | 800 | 60 | 50 | 60 | 50 |
| npc | 600 | 400 | 40 | 35 | 40 | 30 |
| villain | 1500 | 800 | 80 | 70 | 60 | 40 |

### 原型修正 (Archetype)

| archetype | HP | MP | ATK | DEF | SPD | WIZ |
|-----------|------|------|------|------|------|------|
| scholar | 0.8 | 1.3 | 0.7 | 0.8 | 1.0 | 1.5 |
| warrior | 1.3 | 0.7 | 1.3 | 1.2 | 0.9 | 0.8 |
| monk | 1.1 | 1.2 | 0.9 | 1.0 | 1.0 | 1.1 |
| assassin | 0.9 | 0.8 | 1.4 | 0.7 | 1.3 | 0.9 |
| healer | 0.9 | 1.4 | 0.6 | 0.9 | 0.8 | 1.2 |

### 实力评级 (Rank)

8级体系，用武侠世界观术语，不用字母/Tier。

| Rank | 含义 | 倍率 | 天龙代表 |
|------|------|------|---------|
| 返璞归真 | 超越武学极限 | 2.0 | 扫地僧 |
| 登峰造极 | 绝对巅峰 | 1.5 | 萧峰、虚竹、段誉（后期） |
| 出神入化 | 超一流 | 1.3 | 鸠摩智、慕容复、丁春秋 |
| 炉火纯青 | 一流高手 | 1.2 | 段正淳、四大恶人 |
| 登堂入室 | 二流高手 | 1.0 | 无量剑掌门 |
| 略有小成 | 三流 | 0.8 | 钟灵（靠闪电貂） |
| 初窥门径 | 入门 | 0.6 | 无量剑弟子 |
| 平平无奇 | 普通 | 0.4 | 马五德 |

### 门派加成 (Faction)

| 门派 | 加成 |
|------|------|
| 大理段氏 | MP+200, WIZ+20 |
| 丐帮 | HP+150, ATK+15 |
| 少林 | HP+200, DEF+20 |
| 逍遥派 | MP+300, SPD+20 |
| 无量剑 | ATK+10 |

## RAG切片策略

混合粒度：

- 段落级为主
- 短段落(<100字) → 合并到相邻段落
- 长段落(>500字) → 按句号拆分
- 目标chunk: 200-500字
- 每chunk附加元数据：`{chapter, characters[], locations[], type}`
- type枚举：scene / dialogue / narration / description
- 建立context-mode FTS5索引

## 框架+补丁架构

### 目录结构

```
wuxia_novel/
├── framework/
│   ├── schema/              # JSON Schema
│   ├── templates/           # 数值模板
│   └── balance/             # 平衡公式
├── 天龙八部/                # 每本小说自包含
│   ├── 天龙八部.txt         # 原始小说
│   ├── chapters/            # 逐章JSON
│   ├── characters/          # 合并后角色
│   ├── skills/              # 合并后技能
│   ├── factions/            # 合并后门派
│   ├── locations/           # 合并后场景
│   ├── chunks/              # RAG文本块
│   └── progress.json        # 进度追踪
├── 金庸/                    # 其他小说（保留原始目录）
│   └── ...
└── tools/
    ├── extract/             # 提取脚本+prompt
    ├── merge/               # 合并脚本
    ├── gamify/              # 游戏化脚本
    └── rag/                 # RAG切片脚本
```

### 框架 vs 补丁决策规则

**改框架**（稀少，需评审）：
- 通用概念缺失，且≥2本小说遇到相同限制
- 例：3本小说都有"毒"系统 → 框架加poison字段

**写补丁**（常见，默认）：
- 小说独有机制（如天龙八部的"生死符"）
- 数值覆盖（如暴击倍率2.5）
- 门派特有属性（如逍遥派"北冥吸取"）

策略：先补丁，够2本再提框架。补丁是实验场，框架是稳定层。

## 断点续传

文件即checkpoint。每个阶段的输出文件存在即跳过。

### 续传逻辑

| 阶段 | 完成标志 | 续传行为 |
|------|---------|---------|
| 骨架提取 | `chapters/ch_XX_skeleton.json` 存在 | 跳过已有，只提取缺失 |
| 深度提取 | `chapters/ch_XX_deep.json` 存在 | 跳过已有，需对应skeleton存在 |
| 合并 | `characters.json` 等存在 | 重跑覆盖（幂等） |
| 游戏化 | `game_characters.json` 等存在 | 重跑覆盖（幂等） |
| RAG | `chunks/` 目录有内容 | 重跑覆盖（幂等） |

### 进度追踪

`novels/tianlong-babu/progress.json` 记录每阶段完成状态。
每次启动时扫描实际文件，修正记录，从第一个pending项开始。

## 并行策略

### 可并行点

1. **Schema定义 vs Prompt设计**：互不依赖，同时跑
2. **50章骨架提取**：5个agent各处理10章
3. **50章深度提取**：骨架完成后，5个agent各处理10章

### 并行限制

- 深度提取依赖骨架结果，不能与骨架提取并行
- 合并/游戏化/RAG必须串行（依赖上游全部完成）

### 时间线

```
Phase1: Schema + Prompt设计        → 2 agents 并行
Phase2: 50骨架 (5×10)             → 并行
Phase3: 50深度 (5×10)             → 并行
Phase4: 合并+赋值+RAG             → 串行
```

## 验证策略

### 自动校验

- 人物id唯一性（无重复）
- 技能归属一致性（known_skills中的id必须存在于skills表）
- 关系双向性（A→B存在则B→A也应存在）
- faction引用完整性

### 人工抽查

- 前5章提取结果人工比对原文
- 关键角色（段誉/萧峰/虚竹）属性合理性检查
