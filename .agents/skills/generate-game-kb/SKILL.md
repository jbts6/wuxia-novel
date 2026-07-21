---
name: generate-game-kb
description: 从中文武侠小说生成溯源证据完备的游戏知识库（角色/武功/物品/势力/章节摘要）。当用户需要根据小说目录产出结构化、可溯源的游戏素材知识库时使用。
---

# generate-game-kb — v7 直写版

从一本中文武侠小说生成游戏知识库。controller（`scripts/flow.js`）把源书拆成章节单元，AI 派发隔离的子代理逐章抽取实体并直接写 YAML 到唯一输出文件，controller 自动接收、校验、归并、组装并安装五个终态 YAML 文件。

使用 `semantic_contract_version: 7`、`semantic_profile: chapter-direct-v1`。

## 最终产物

成功安装后，`<novel>/data/` 必须恰好包含五个 YAML：

```text
characters.yaml
skills.yaml
items.yaml
factions.yaml
chapter_summaries.yaml
```

## 命令面（v7 仅四个命令）

```text
run <novel> [--run <id>]                # 推进管线：准备、派发、接收、组装、安装、归档
status <novel> [--run <id>]             # 只读：查看进度、活跃 job、manual_review
retry-unit <novel> --run <id> --unit <u> --confirm  # 用户确认后为 manual_review 单元开启新周期
archive-abandoned <novel> [--run <id>]  # 归档废弃 run（不解析、不迁移）
```

## 核心循环

主代理只需反复调用 `run`：

```
1. 调用 run → 返回 jobs（最多 5 个章节）
2. 为每个 job 派发一个子代理（Worker）
3. Worker 读取 input_file，写 YAML 到 output_file
4. 再次调用 run → controller 自动接收已有输出，推进状态
5. 重复 1-4 直到 status 为 complete
```

### `run` 返回状态

| status | 含义 | 主代理动作 |
|--------|------|-----------|
| `jobs` | 有新章节 job 需要派发 | 派发 Worker，写完后再次 run |
| `waiting` | 当前窗口有未完成单元 | 等待 Worker 完成，再次 run |
| `dispatched` | 重试 job 已签发 | 派发修复 Worker |
| `manual_review` | 有单元两次失败 | 告知用户，等用户 retry-unit |
| `complete` | 全部完成并归档 | 结束 |

### 固定窗口规则

- 每次最多 5 个章节同时在途（`active_units.length <= 5`）
- 当前窗口全部 accepted 前不签发新章节
- `waiting` 不返回新 job，主代理不得自行补位

## Worker 合同

Worker 读取 controller 生成的 `input_file`（JSON），写 YAML 到 `output_file`。

### Worker 输出格式（纯 YAML，无 envelope）

```yaml
characters:
  - name: "陆小凤"
    aliases: []
    identities: []
    level: "核心"
    rank: "登堂入室"
    description: "..."
    factions: []
    skills: []
    source_refs:
      - text: "原文证据"
        line_start: 10
        line_end: 12

skills:
  - name: "灵犀一指"
    aliases: []
    types: ["指法"]
    factions: []
    rank: "登峰造极"
    description: "..."
    techniques:
      - name: "灵犀一指"
        description: "..."
    source_refs: [...]

items:
  - name: "孔雀翎"
    aliases: []
    types: ["武器", "暗器"]
    description: "..."
    source_refs: [...]

factions:
  - name: "青衣楼"
    aliases: []
    types: ["组织"]
    description: "..."
    source_refs: [...]

chapter_summary:
  summary: "本章摘要..."
  source_refs: [...]
```

### Worker 禁止事项

- 不得输出 envelope、unit、cycle、attempt、schema_version、chapter、title、source_hash
- 不得输出 `id`、`local_key`、`candidate_key`
- 不得使用单值 `type` 字段（必须用 `types: string[]`）
- 不得调用 controller 命令
- 不得写入 output_file 以外的任何路径

### types 白名单

- **skills**: 内功、心法、外功、轻功、身法、剑法、刀法、枪法、棍法、棒法、鞭法、拳法、掌法、腿法、爪法、指法、点穴、擒拿、暗器、毒功、医术、易容、音律、阵法、奇门、合击、其他
- **items**: 武器、防具、秘籍、丹药、暗器、坐骑、异兽、饰品、其他
- **factions**: 门派、帮会、组织、家族、世家、朝廷、官府、商会、镖局、教派、寺院、部族、王朝、山庄、其他

## 两次 Attempt 与修复

- 每章每周期最多 2 个 attempt
- 第一次失败若仅为 YAML 机械错误（代码围栏、缩进、引号、空集合），controller 标记 `repair_allowed: true`
- 修复 Worker 只读取拒绝稿和错误报告，不读小说原文，不修改语义字段
- 第二次失败进入 `manual_review`，只有用户 `retry-unit --confirm` 才能开启新周期

## 实体高召回（强制）

- 每章必须穷举所有有名字的角色、武功、物品、势力
- 宁多勿漏：龙套、背景角色、提及但未出场的角色都要收录
- source_refs 必须引用原文真实存在的文字片段
- 泛称（店小二、管家婆、表哥）会被 controller 自动过滤为 warning

## 归并规则

- 只按"类别 + 精确规范名称"归并
- 别名、近似名、拼音相似不触发归并
- description 取最长、rank 取多数票、level 取最高优先级
- types 取稳定并集
