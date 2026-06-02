---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

## 快速开始

以金庸/天龙八部为例：

```bash
# 1. 检查进度，决定下一步
cat 金庸/天龙八部/progress.json

# 2. 根据进度执行对应步骤（见下方流程）
```

## 核心流程

### Step 0: 检查进度

读取 `<小说目录>/progress.json`，判断当前状态：

```json
{
  "skeleton": {"total": 50, "done": [1,2,3,...], "failed": [], "pending": []},
  "deep": {"total": 50, "done": [1,2,3,...], "failed": [], "pending": []},
  "merge": true,
  "gamify": true,
  "rag": true
}
```

**决策树**：

| 条件 | 下一步 |
| --- | --- |
| `ch_formatted/` 不存在或不完整 | 先用 `batch-format-novel` skill 排版 |
| `progress.json` 不存在 | 运行 `setup-novel-dirs.py` 初始化 |
| `skeleton.done` 长度 < skeleton.total | 继续粗提取：`extract-skeleton.py` |
| `skeleton.done` = total 但 `deep.done` < deep.total | 继续精细提取：`extract-deep.py` |
| `deep.done` = total 但 `merge` = false | 合并数据：`merge-chapters.py` |
| `merge` = true 但 Markdown 卡片不完整 | 生成卡片：`json-to-markdown.py` 等 |
| 全部完成 | 验证：`verify-card-output-pipeline.py` |

### Step 1: 粗提取（Skeleton）

**触发条件**：`skeleton.done` 长度 < `skeleton.total`

```bash
# 批量处理（自动跳过已完成）
python tools/extract/extract-skeleton.py "金庸/天龙八部"

# 或指定章节
python tools/extract/extract-skeleton.py "金庸/天龙八部" 1 5  # 第1-5章
```

**每章输出** `chapters/ch_XX_skeleton.json`：

```json
{
  "chapter": 1,
  "characters": [
    {"id": "char_duanyu", "name": "段誉", "identity": "大理段氏公子", "faction": "faction_dali", "role": "protagonist", "one_line": "大理段氏的年轻公子", "personality": "书生气重", "known_skills": [], "related_skills": ["skill_yiyangzhi"]}
  ],
  "factions": [{"id": "faction_wuliangjian", "name": "无量剑", "type": "武林门派", "location": "loc_wuliangshan"}],
  "locations": [{"id": "loc_jianhugong", "name": "剑湖宫", "region": "无量山"}],
  "skills": [{"id": "skill_wuliangjianfa", "name": "无量剑法", "type": "剑法"}],
  "items": [{"id": "item_qinggangjian", "name": "青钢剑", "type": "weapon", "owner": "char_chu"}]
}
```

**ID 命名**：`char_`/`faction_`/`loc_`/`skill_`/`item_` + 拼音

### Step 2: 精细提取（Deep）

**触发条件**：`skeleton.done` = total 但 `deep.done` < deep.total

```bash
python tools/extract/extract-deep.py "金庸/天龙八部"
```

**前置**：该章节 skeleton 必须已完成

**每章输出** `chapters/ch_XX_deep.json`：

```json
{
  "chapter": 1,
  "characters_detail": [
    {
      "id": "char_duanyu",
      "personality": {"traits": ["宅心仁厚", "不谙世事"], "speech_style": "谈吐文雅", "temperament": "温文尔雅"},
      "archetype": "scholar",
      "relationships": [{"target": "char_zhongling", "type": "companion", "intensity": 40, "bond_level": 1, "dynamic": "初识"}]
    }
  ],
  "skills_detail": [{"id": "skill_wuliangjianfa", "techniques": [...], "effects": [...]}],
  "items_detail": [{"id": "item_qinggangjian", "description": "...", "effects": [...]}],
  "events": [{"id": "evt_01_bijian", "name": "无量剑比剑", "participants": [...], "location": "loc_jianhugong"}],
  "dialogues": [{"speaker": "char_zhongling", "listener": "char_duanyu", "text": "...", "tone": "调侃"}]
}
```

**物品补全**（如 deep 未覆盖）：
```bash
python tools/extract/generate-items-detail-prompts.py "金庸/天龙八部" <章节号>
```

### Step 3: 合并全局数据

**触发条件**：`deep.done` = total 但 `merge` = false

```bash
python tools/merge/merge-chapters.py "金庸/天龙八部"
```

**输出**：`characters.json`, `skills.json`, `factions.json`, `locations.json`, `items.json`, `techniques.json`, `events.json`, `dialogues.json`

### Step 4: 生成 Markdown 卡片

**触发条件**：`merge` = true 但卡片不完整

```bash
python tools/convert/json-to-markdown.py "金庸/天龙八部"
python tools/convert/json-to-items-markdown.py "金庸/天龙八部"
python tools/convert/generate-event-cards.py "金庸/天龙八部"
```

### Step 5: Wikilink 修复（可选）

统一 wikilink 格式为 `[[目录/中文名]]`：
- `[[characters/段誉]]`、`[[locations/剑湖宫]]`、`[[skills/一阳指]]`

### Step 6: 验证

**触发条件**：所有步骤完成

```bash
python tools/verify/verify-card-output-pipeline.py "金庸/天龙八部"
```

## 断点续传

每个脚本自动检查 `progress.json`，跳过已完成章节。中断后重新运行同一命令即可继续。

**强制重跑某章**：删除 `progress.json` 中对应章节号，或指定章节号：
```bash
python tools/extract/extract-deep.py "金庸/天龙八部" 5  # 重跑第5章
```

## 常见问题

**Q: 如何添加新小说？**
A: `python tools/setup-novel-dirs.py "<作者>/<小说名>"`，然后按流程执行。

**Q: 提取结果不准确？**
A: 检查 `tools/extract/deep-prompt.md`，调整后重跑对应章节。

**Q: 如何查看进度？**
A: `cat <小说目录>/progress.json | python -m json.tool`
