---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说（单步提取 + 限流版）

核心设计：
- **单步提取**：每章一次 sub-agent 调用，同时输出骨架数据和详细数据
- **限流保护**：每批 3 个 sub-agent，防止 RPM=100 限流
- **上下文优化**：sub-agent 直接写文件，只返回状态摘要
- **断点续传**：通过 `progress.json` 跟踪进度
- **清理中间产物**：验证通过后删除 `chapters/`、`ch_original/`、`chunks/` 等可再生目录

## 快速开始

```bash
# 1. 检查进度
cat <小说目录>/progress.json

# 2. 根据进度执行对应步骤（见下方流程）
```

---

## 并行限流策略

```
MAX_CONCURRENT = 3      # 每批最多 3 个 sub-agent
BATCH_INTERVAL = 3      # 批次间隔 3 秒
```

- Mimo RPM 限制 = 100 请求/分钟
- 3 并发 × 12 批/分钟 = 36 RPM（安全余量充足）

---

## 核心流程

### Step 0: 检查进度

读取 `<小说目录>/progress.json`，判断当前状态：

| 条件 | 下一步 |
| --- | --- |
| `ch_formatted/` 不存在或不完整 | 先用 `batch-format-novel` skill 排版 |
| `progress.json` 不存在 | 运行 `setup-novel-dirs.py` 初始化 |
| `extract.done` 长度 < extract.total | 继续提取（限流批次模式） |
| `extract.done` = total 但 `merge` = false | 合并数据：`merge-chapters.py` |
| `merge` = true 但 Markdown 卡片不完整 | 生成卡片：`json-to-markdown.py` 等 |
| 全部完成 | 验证：`verify-card-output-pipeline.py` |
| 验证通过 | 清理中间产物：`chapters/`、`ch_original/`、`chunks/` |

---

### Step 1: 章节提取（限流批次，单步完成）

**触发条件**：`extract.done` 长度 < `extract.total`

#### 流程

1. **加载进度**，确定需要提取的章节列表（跳过已完成）
2. **分批处理**：每批 3 个章节，批次间隔 3 秒
3. **每个章节**的 sub-agent 执行：
   - 读取章节原文：`ch_formatted/ch_XX.md`
   - 一次性提取所有数据（骨架 + 详细）
   - 直接写文件到 `chapters/ch_XX.json`
   - 输出状态摘要
4. **主 agent 验证**：检查文件存在，更新 `progress.json`

#### JSON 输出格式

每个章节输出一个完整的 JSON 文件，包含两层数据：

```json
{
  "chapter": 1,
  "characters": [
    {
      "id": "char_xxx",
      "name": "中文名",
      "alias": ["别名"],
      "identity": "身份描述",
      "faction": "faction_id或null",
      "role": "protagonist/companion/npc/villain",
      "archetype": "scholar/warrior/monk/assassin/healer",
      "rank": "返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇",
      "one_line": "一句话描述",
      "personality": {
        "traits": ["至少3个"],
        "speech_style": "详细描述",
        "temperament": "气质描述"
      },
      "relationships": [
        {"target": "char_id", "type": "关系类型", "intensity": 0-100, "bond_level": 1-5, "dynamic": "≤30字"}
      ],
      "known_skills": ["skill_id"],
      "related_skills": ["skill_id"]
    }
  ],
  "factions": [
    {"id": "faction_xxx", "name": "名字", "type": "武林门派/帮派/家族/朝廷", "location": "loc_id或null", "sub_divisions": [], "one_line": "一句话描述"}
  ],
  "locations": [
    {"id": "loc_xxx", "name": "名字", "region": "地理区域", "one_line": "一句话描述"}
  ],
  "skills": [
    {
      "id": "skill_xxx",
      "name": "武功名",
      "type": "剑法/掌法/内功/轻功/暗器/指法/拳法/刀法/其他",
      "faction": "",
      "rank": "返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇",
      "one_line": "一句话描述",
      "techniques": [
        {"id": "tech_xxx", "name": "招式名", "type": "attack/defense/buff/debuff/feint/special", "description": "描述"}
      ],
      "progression": [{"level": 1-5, "unlock": "境界描述"}],
      "effects": ["实战效果"],
      "combat_style": "战斗风格"
    }
  ],
  "items": [
    {
      "id": "item_xxx",
      "name": "物品名",
      "type": "weapon/armor/pill/poison/hidden_weapon/special/book/other",
      "owner": "char_id或null",
      "one_line": "一句话描述",
      "description": "详细描述（≥20字）",
      "effects": [{"type": "", "value": "", "description": ""}],
      "origin": "来源",
      "rarity": "绝世神兵/稀世珍品/上乘佳品/寻常凡品",
      "related_skills": ["skill_id"]
    }
  ],
  "events": [
    {"id": "evt_N_序号", "name": "事件名", "participants": ["char_id"], "location": "loc_id", "description": "≥20字"}
  ],
  "dialogues": [
    {"speaker": "char_id", "listener": "char_id或null", "text": "对话原文", "tone": "语气", "chapter": N}
  ]
}
```

#### Sub-Agent Prompt 模板

```
武侠小说提取。读取原文，一次性提取所有实体和详细信息。

读取: {novel_dir}/ch_formatted/ch_{N:02d}.md
保存: {novel_dir}/chapters/ch_{N:02d}.json

步骤: 1)read_file原文 2)提取 3)write_file保存 4)输出一行摘要

规则:
- 只提取实际出现的实体。ID格式严格一致：char_guo_jing（每个字下划线分隔、全小写），禁止 char_guojing 或 char_guo_jin。faction_/loc_/skill_/item_ 同理。门派分支放sub_divisions
- 武功需有名称。字符串中不要用双引号，引用语用单引号。relationships.dynamic≤30字
- 所有字段必须有值（faction可null）。无实体用[]。字符串不留空
- rank评级必须填写（见下方等级体系）。rarity必须用wuxia风格

等级体系（8级，从高到低）:
  返璞归真: 已臻化境，超越招式，当世无敌
  登峰造极: 五绝级别，当世最强
  出神入化: 仅次于绝顶，能与五绝对招
  炉火纯青: 江湖顶尖，门派掌门级
  登堂入室: 已入武学正途，门派核心弟子
  略有小成: 初窥门径，有一定战力
  初窥门径: 学过一些粗浅武功
  平平无奇: 不会武功或仅有蛮力

物品稀有度（4级）:
  绝世神兵: 百年难遇的神物
  稀世珍品: 世间少有，武林中人争相抢夺
  上乘佳品: 品质精良，名家所制
  寻常凡品: 江湖中随处可见

JSON schema:
{"chapter":N,"characters":[{"id":"","name":"","alias":[],"identity":"","faction":null,"role":"","archetype":"","rank":"返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇","one_line":"","personality":{"traits":["≥3"],"speech_style":"","temperament":""},"relationships":[{"target":"","type":"","intensity":0,"bond_level":0,"dynamic":"≤30字"}],"known_skills":[],"related_skills":[]}],"factions":[{"id":"","name":"","type":"","location":null,"sub_divisions":[],"one_line":""}],"locations":[{"id":"","name":"","region":"","one_line":""}],"skills":[{"id":"","name":"","type":"","faction":"","rank":"返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇","one_line":"","techniques":[{"id":"","name":"","type":"","description":""}],"progression":[{"level":0,"unlock":""}],"effects":[],"combat_style":""}],"items":[{"id":"","name":"","type":"","owner":null,"one_line":"","description":"","effects":[],"origin":"","rarity":"绝世神兵/稀世珍品/上乘佳品/寻常凡品","related_skills":[]}],"events":[{"id":"evt_N_序号","name":"","participants":[],"location":"","description":""}],"dialogues":[{"speaker":"","listener":null,"text":"","tone":"","chapter":N}]}

完成后: ✅ 第 {N} 章提取完成
```

---

### Step 1.5: JSON 格式校验（自动修复）

**触发条件**：`extract.done` = total，合并之前

```bash
python tools/validate/fix-json.py "<小说目录>"
```

自动修复常见问题：字符串内未转义的双引号、尾部多余逗号、括号不匹配。修复后输出统计。

---

### Step 2: 合并全局数据

**触发条件**：`extract.done` = total 但 `merge` = false

```bash
python tools/merge/merge-chapters.py "<小说目录>"
```

**输出**：`characters.json`, `skills.json`, `factions.json`, `locations.json`, `items.json`, `techniques.json`, `events.json`, `dialogues.json`

### Step 3: 生成 Markdown 卡片

**触发条件**：`merge` = true 但卡片不完整

```bash
python tools/convert/json-to-markdown.py "<小说目录>"
python tools/convert/json-to-items-markdown.py "<小说目录>"
python tools/convert/generate-event-cards.py "<小说目录>"
```

### Step 4: 验证

**触发条件**：所有步骤完成

```bash
python tools/verify/verify-card-output-pipeline.py "<小说目录>"
```

### Step 5: 清理中间产物

**触发条件**：验证通过后

可删除的目录（均可从原始 txt 重新生成）：

| 目录 | 说明 | 大小（约） |
|------|------|------------|
| `ch_original/` | txt 拆分后的原始章节 | ~3 MB |
| `chapters/` | 章节 JSON（中间产物） | ~1.5 MB |
| `chunks/` | RAG 分块（通常为空） | ~0 |

**保留**：`ch_formatted/`（排版后章节，断点续传需要）、所有根目录 JSON 和 Markdown 卡片。

```bash
rm -rf "<小说目录>/ch_original" "<小说目录>/chapters" "<小说目录>/chunks"
```

---

## 断点续传

每个步骤通过 `progress.json` 跟踪进度，中断后重新运行即可继续。

**强制重跑某章**：删除对应章节的 JSON 文件后重跑。

---

## progress.json 格式

```json
{
  "extract": {
    "total": 40,
    "done": [1, 2, 3],
    "failed": [],
    "pending": [4, 5, ..., 40]
  },
  "merge": false,
  "cleanup": false,
  "gamify": false,
  "rag": false
}
```

---

## 性能预估

假设小说 50 章，每章处理时间约 30 秒：

| 指标 | 数值 |
|------|------|
| 提取批次 | 10 批 |
| 提取总时间 | ~5.5 分钟（含间隔） |
| 峰值 RPM | 60 RPM（安全） |
| 主 Agent 上下文占用 | ~2 KB（仅状态摘要） |

---

## 添加新小说

```bash
python tools/setup-novel-dirs.py "<作者>/<小说名>"
```

然后按流程执行。
