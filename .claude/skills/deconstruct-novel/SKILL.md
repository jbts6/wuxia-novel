---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说（全书一次性提取）

核心设计：
- **全书读入**：主 agent 一次性读完全部 `ch_formatted/ch_*.md`，在同一上下文中提取所有实体
- **无中间产物**：直接写入最终 JSON，不需要分批合并
- **断点续传**：通过 `progress.json` 跟踪提取状态

## 快速开始

```bash
cat <小说目录>/progress.json          # 检查进度
python tools/setup-novel-dirs.py <小说目录>  # 初始化（如需要）
```

---

## 工作流

### Step 0: 预检

1. 确认 `ch_formatted/ch_*.md` 存在且完整（不完整则先用 `batch-format-novel` 排版）
2. 运行 `python tools/setup-novel-dirs.py <小说目录>` 初始化目录结构
3. 读取 `progress.json`，若 `extract.done = true` 则跳到 Step 2

### Step 1: 全书一次性提取

**详细原则**：提取必须详尽完整，不能草率。每个实体都要有丰富的描述和引用。

- **dialogues.json**：至少 100+ 条（长篇小说目标 300+），覆盖每章关键对白
- **events.json**：至少覆盖全部章节，每章至少 1 个事件，重大章节多个事件
- **characters.json**：主角完整 personality（5+ traits），所有配角也要有基本描述
- **event_timeline.md**：每章都要有情节概述，不能只列标题

主 agent 直接执行：

1. `ls <novel_dir>/ch_formatted/` 获取全部章节文件列表
2. 依次 `read_file` 每个 `ch_formatted/ch_XX.md`，全部读入上下文
3. 按下方 Schema 提取全部实体（务必详尽）
4. 一次性 `write_file` 写入以下 8 个根目录 JSON 文件 + `event_timeline.md`：
   - `characters.json`
   - `skills.json`
   - `techniques.json`
   - `factions.json`
   - `locations.json`
   - `items.json`
   - `events.json`
   - `dialogues.json`
   - `event_timeline.md`
5. 更新 `progress.json`：`extract.done = true, extract.chapter_count = 总章数`

### Step 2: 生成 Markdown 卡片

```bash
python tools/convert/json-to-markdown.py "<小说目录>"
python tools/convert/json-to-items-markdown.py "<小说目录>"
python tools/convert/generate-event-cards.py "<小说目录>"
```

### Step 3: 生成实力等级概览

读取 `characters.json`、`skills.json`、`items.json`，按等级分类汇总，写入 `<小说目录>/实力等级概览.md`。

```bash
cd "<小说目录>" && node -e "
const chars = JSON.parse(require('fs').readFileSync('characters.json','utf-8'));
const skills = JSON.parse(require('fs').readFileSync('skills.json','utf-8'));
const items = JSON.parse(require('fs').readFileSync('items.json','utf-8'));

const charByRank = {};
chars.forEach(c => { const r = c.rank||'未定'; if(!charByRank[r]) charByRank[r]=[]; charByRank[r].push(c.name); });

const skillByRank = {};
skills.forEach(s => { const r = s.rank||'未定'; if(!skillByRank[r]) skillByRank[r]=[]; skillByRank[r].push(s.name); });

const itemByRarity = {};
items.forEach(i => { const r = i.rarity||'未定'; if(!itemByRarity[r]) itemByRarity[r]=[]; itemByRarity[r].push(i.name); });

console.log(JSON.stringify({charByRank, skillByRank, itemByRarity}));
"
```

然后按以下格式写入 `实力等级概览.md`：

```markdown
# {小说名} · 实力等级概览

## 一、角色实力等级

### 返璞归真（已臻化境，天下无敌）
- 角色A
...

### 登峰造极（五绝级别，当世最强）
- 角色B
...

（8个等级依次列出，空等级标注"（无）"）

## 二、功法品级

### 返璞归真（武学至高境界，超越招式）
- 武功A
...

（8个等级依次列出）

## 三、物品等级

### 绝世神兵（百年难遇的神物，可遇不可求，N 件）
- 物品A
...

（4个等级依次列出，标题含件数）
```

等级顺序：返璞归真 → 登峰造极 → 出神入化 → 炉火纯青 → 登堂入室 → 略有小成 → 初窥门径 → 平平无奇
物品顺序：绝世神兵 → 稀世珍品 → 上乘佳品 → 寻常凡品

### Step 4: 验证 + 清理

```bash
python tools/verify/verify-card-output-pipeline.py "<小说目录>"
rm -rf "<小说目录>/ch_original" "<小说目录>/chunks"
```

---

## 提取 Schema

### ID 格式规则（严格执行）

ID格式：全小写拼音，字间下划线分隔
- char_guo_jing / loc_yangzhou / faction_tiandihui ✅
- char_郭靖 / loc_yang_zhou ❌

前缀统一：`char_` `faction_` `loc_` `skill_` `item_` `tech_`

### source_refs（行号引用，必须）

每个实体必须携带 source_refs 字段:
```json
"source_refs": [{"chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段"}]
```

### 字段必填规则

- personality（每个角色）: traits ≥ 3 项，speech_style 和 temperament 非空
- events: name 非空，id 格式 `evt_{章节号}_{序号}`，source_refs 必填
- relationships 去重: 同一 (target, type) 只保留一条，取 intensity 最高的

### 等级体系（rank 必填）

返璞归真 > 登峰造极 > 出神入化 > 炉火纯青 > 登堂入室 > 略有小成 > 初窥门径 > 平平无奇
物品稀有度: 绝世神兵 / 稀世珍品 / 上乘佳品 / 寻常凡品

### 输出 JSON Schema

```json
{
  "characters": [{"id": "char_xxx", "name": "中文名", "alias": ["别名"], "identity": "身份", "faction": "faction_id或null", "role": "protagonist/companion/npc/villain", "archetype": "scholar/warrior/monk/assassin/healer", "rank": "等级", "one_line": "一句话描述", "personality": {"traits": ["特征"], "speech_style": "风格", "temperament": "气质"}, "relationships": [{"target": "char_id", "type": "类型", "intensity": 0-100, "bond_level": 1-5, "dynamic": "≤30字"}], "known_skills": ["skill_id"], "related_skills": ["skill_id"], "source_refs": []}],
  "skills": [{"id": "skill_xxx", "name": "武功名", "type": "剑法/掌法/内功/轻功/暗器", "faction": "", "rank": "等级", "one_line": "一句话描述", "techniques": [{"id": "tech_xxx", "name": "招式名", "type": "attack/defense/buff/debuff/feint/special", "description": "描述"}], "progression": [], "effects": [], "combat_style": "风格", "source_refs": []}],
  "techniques": [{"id": "tech_xxx", "name": "招式名", "type": "类型", "description": "描述", "source_skill": "skill_id", "source_refs": []}],
  "factions": [{"id": "faction_xxx", "name": "名字", "type": "武林门派/帮派/家族", "location": "loc_id", "sub_divisions": [], "one_line": "描述", "source_refs": []}],
  "locations": [{"id": "loc_xxx", "name": "名字", "region": "地理区域", "one_line": "描述", "source_refs": []}],
  "items": [{"id": "item_xxx", "name": "物品名", "type": "weapon/armor/pill/poison/hidden_weapon/special", "owner": "char_id", "one_line": "描述", "description": "详细描述", "effects": [], "origin": "来源", "rarity": "稀有度", "related_skills": [], "source_refs": []}],
  "events": [{"id": "evt_N_序号", "name": "事件名", "participants": ["char_id"], "location": "loc_id", "description": "描述", "chapter": N, "source_refs": []}],
  "dialogues": [{"speaker": "char_id", "listener": "char_id或null", "text": "原文", "tone": "语气", "chapter": N}]
}
```

### 生成时自检清单（写文件前逐项检查）

□ 所有ID都是小写拼音+下划线
□ 每个角色 personality.traits ≥ 3 项，speech_style 和 temperament 非空
□ 每个事件 name 非空，source_refs 非空
□ relationships 无重复 (target+type)
□ events 的 id 格式为 evt_N_序号
□ dialogues ≥ 100 条，覆盖每章关键对白
□ events 覆盖全部章节，每章至少 1 个事件
□ event_timeline.md 每章都有情节概述

---

## progress.json 格式

```json
{
  "extract": {"done": true, "chapter_count": 10},
  "merge": true,
  "cleanup": false
}
```

提取完成后设 `extract.done = true`，卡片生成后设 `merge = true`。
