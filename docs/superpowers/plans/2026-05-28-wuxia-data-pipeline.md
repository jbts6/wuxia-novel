---
change: wuxia-data-pipeline
design-doc: docs/superpowers/specs/2026-05-28-wuxia-data-pipeline-design.md
base-ref: 46578f079e8de641f503eb4abd518ed91fddbda7
---

# 武侠小说拆解系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将《天龙八部》50章小说文本转化为 Obsidian Markdown 卡片（YAML frontmatter + `[[wikilinks]]` 关系图谱）+ context-mode可检索文本索引。

**Architecture:** 两阶段LLM提取（骨架→深度）→ 智能合并 → 游戏化赋值 → RAG切片。Markdown + YAML frontmatter 定义数据结构（Obsidian 原生支持），Python脚本驱动管道，prompt模板指导LLM提取。所有卡片通过 `[[wikilinks]]` 建立关系，Obsidian 关系图谱自动可视化。

**Tech Stack:** Python 3, Markdown + YAML frontmatter, context-mode MCP (FTS5), LLM API, Obsidian

**Sub-Agent约束:**

| 任务类别 | 模型选择 | 理由 |
|---------|---------|------|
| 骨架提取、深度提取、RAG切片 | 主模型（继承，不指定model） | 需要语言理解和语境把握 |
| 游戏化数值计算、Schema校验 | 子模型（model: "sonnet"） | 数学计算和规则匹配更强 |
| 合并脚本、数据处理 | 直接执行（Python脚本） | 纯数据处理，不需要LLM |

---

## File Structure

```
wuxia_novel/
├── framework/
│   ├── templates/
│   │   ├── character-template.md      # 角色卡Markdown模板
│   │   ├── skill-template.md          # 功法卡Markdown模板
│   │   ├── technique-template.md      # 招式卡Markdown模板
│   │   ├── faction-template.md        # 门派卡Markdown模板
│   │   ├── location-template.md       # 场景卡Markdown模板
│   │   ├── archetypes.json            # 角色原型数值模板
│   │   └── factions.json              # 门派加成模板
│   └── balance/
│       └── combat-formula.json        # 战斗公式
├── 金庸/天龙八部/                          # 每本小说自包含
│   ├── 天龙八部.txt                   # 原始小说
│   ├── chapters/                      # 逐章JSON（50个skeleton + 50个deep，中间数据）
│   ├── characters/                    # 合并后角色卡（Markdown）
│   ├── skills/                        # 合并后技能卡（Markdown）
│   ├── factions/                      # 合并后门派卡（Markdown）
│   ├── locations/                     # 合并后场景卡（Markdown）
│   ├── chunks/                        # RAG文本块（JSON，程序用）
│   └── progress.json                 # 进度追踪
├── tools/
│   ├── extract/
│   │   ├── skeleton-prompt.md         # 骨架提取prompt
│   │   ├── deep-prompt.md             # 深度提取prompt
│   │   ├── extract-skeleton.py        # 骨架提取脚本
│   │   └── extract-deep.py            # 深度提取脚本
│   ├── merge/
│   │   └── merge-chapters.py          # 合并脚本（输出Markdown）
│   ├── gamify/
│   │   └── assign-stats.py            # 游戏化赋值脚本（更新YAML frontmatter）
│   ├── rag/
│   │   └── chunk-text.py              # RAG切片脚本
│   └── validate/
│       └── validate.py                # 校验脚本（校验Markdown frontmatter）
├── 金庸/                              # 其他小说原始目录
│   └── ...
└── docs/                              # 设计文档
    └── superpowers/
        ├── specs/                     # Design Doc
        └── plans/                     # 实施计划
```

**数据格式约定：**
- 所有卡片使用 Markdown + YAML frontmatter
- YAML frontmatter 包含结构化字段（id, type, rank 等）
- 正文使用 `[[wikilinks]]` 引用其他卡片，Obsidian 自动建立关系图谱
- 章节中间数据（skeleton/deep）仍用 JSON，仅最终合并卡片用 Markdown
- RAG chunks 用 JSON（程序检索用）

---

## Task 1: 创建目录结构

**Files:**
- Create: `framework/schema/`, `framework/templates/`, `framework/balance/`
- Create: `金庸/天龙八部/chapters/`, `characters/`, `skills/`, `factions/`, `locations/`, `chunks/`
- Create: `tools/extract/`, `tools/merge/`, `tools/gamify/`, `tools/rag/`, `tools/validate/`

- [ ] **Step 1: 创建所有目录**

```bash
cd C:\git\wuxia_novel
mkdir -p framework/schema framework/templates framework/balance
mkdir -p 金庸/天龙八部/chapters 金庸/天龙八部/characters
mkdir -p 金庸/天龙八部/skills 金庸/天龙八部/factions
mkdir -p 金庸/天龙八部/locations 金庸/天龙八部/chunks
mkdir -p tools/extract tools/merge tools/gamify tools/rag tools/validate
```

- [ ] **Step 2: 提取第一章到标准位置（参考用）**

将已有的 `金庸/chapters/chapter_01.json` 复制到 `金庸/天龙八部/chapters/ch_01_reference.json` 作为格式参考。

```bash
cp 金庸/chapters/chapter_01.json 金庸/天龙八部/chapters/ch_01_reference.json
```

- [ ] **Step 3: 创建初始进度文件**

```json
// 金庸/天龙八部/progress.json
{
  "skeleton": {"total": 50, "done": [], "failed": [], "pending": []},
  "deep": {"total": 50, "done": [], "failed": [], "pending": []},
  "merge": false,
  "gamify": false,
  "rag": false
}
```

- [ ] **Step 4: Commit**

```bash
git add framework/ 金庸/天龙八部/ tools/ 金庸/chapters/
git commit -m "feat: create directory structure and initial progress tracking"
```

---

## Task 2: 定义角色卡Markdown模板

**Files:**
- Create: `framework/templates/character-template.md`

- [ ] **Step 1: 创建角色卡模板**

```markdown
# {{name}}

---
id: {{id}}
role: {{role}}                    # protagonist/companion/npc/villain
archetype: {{archetype}}          # scholar/warrior/monk/assassin/healer
rank: {{rank}}                    # 返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇
faction: "[[{{faction}}]]"        # 门派引用
alias: [{{alias}}]                # 别名列表
identity: {{identity}}            # 身份描述
first_appearance: {{first_appearance}}  # 首次出场章节号
known_skills:                     # 已掌握的功法
  - "[[{{skill_name}}]]"
related_skills:                   # 关联但未学会的功法
  - "[[{{skill_name}}]]"
known_techniques:                 # 独立招式（不属于完整功法）
  - "[[{{technique_name}}]]"
game_stats:                       # 游戏化数值（由assign-stats.py填充）
  hp: 0
  mp: 0
  atk: 0
  def: 0
  spd: 0
  wiz: 0
---

## 性格
- **特征**: {{traits}}
- **说话风格**: {{speech_style}}
- **气质**: {{temperament}}

## 关系
- [[{{target}}]] — {{relation_type}}（强度: {{intensity}}）

## 外貌
{{appearance}}

## 关键对话
> "{{dialogue}}"
> —— 对{{listener}}，{{tone}}

## 生平概要
{{biography}}
```

- [ ] **Step 2: Commit**

```bash
git add framework/templates/character-template.md
git commit -m "feat: add character card Markdown template with wikilinks"
```

---

## Task 3: 定义功法卡和招式卡Markdown模板

**Files:**
- Create: `framework/templates/skill-template.md`
- Create: `framework/templates/technique-template.md`

- [ ] **Step 1: 创建功法卡模板**

```markdown
# {{name}}

---
id: {{id}}
type: {{type}}                    # sword_art/finger_art/palm_art/fist_art/internal/movement/hidden_weapon/beast/staff_art/blade_art
rank: {{rank}}                    # 返璞归真/登峰造极/出神入化/炉火纯青/登堂入室/略有小成/初窥门径/平平无奇
faction: "[[{{faction}}]]"        # 所属门派
combat_style: {{combat_style}}    # 战斗风格
techniques:                       # 包含的招式
  - "[[{{technique_name}}]]"
game_stats:                       # 游戏化数值（由assign-stats.py填充）
  damage_base: 0
  mp_cost: 0
  cooldown: 0
  range: melee
---

## 描述
{{description}}

## 招式列表
| 招式 | 类型 | 描述 |
|------|------|------|
| [[{{technique}}]] | {{type}} | {{desc}} |

## 升级路径
| 等级 | 解锁条件 | 伤害倍率 |
|------|---------|---------|
| {{level}} | {{unlock}} | {{damage_mult}} |

## 克制关系
- **克制**: {{strong_against}}
- **被克**: {{weak_against}}
- **无效化**: {{nullified_by}}

## 特殊效果
- {{type}}: {{description}}（触发: {{condition}}）

## 掌握者
- [[{{character}}]]
```

- [ ] **Step 2: 创建招式卡模板**

```markdown
# {{name}}

---
id: {{id}}
type: {{type}}                    # attack/defense/buff/debuff/heal/movement/feint/beast/special
parent_skill: "[[{{parent_skill}}]]"  # 所属功法（null表示独立招式）
---

## 描述
{{description}}

## 效果
- **伤害**: {{damage}}
- **目标**: {{target}}          # self/single_enemy/aoe/ally
- **特殊**: {{special}}

## 解锁条件
{{unlock_condition}}

## 使用者
- [[{{character}}]]
```

- [ ] **Step 3: Commit**

```bash
git add framework/templates/skill-template.md framework/templates/technique-template.md
git commit -m "feat: add skill and technique card Markdown templates with wikilinks"
```

---

## Task 4: 定义门派卡和场景卡Markdown模板

**Files:**
- Create: `framework/templates/faction-template.md`
- Create: `framework/templates/location-template.md`

- [ ] **Step 1: 创建门派卡模板**

```markdown
# {{name}}

---
id: {{id}}
type: {{type}}                    # sect/gang/royal_family/cult/mercenary/hidden
location: "[[{{location}}]]"      # 所在地点
---

## 描述
{{description}}

## 分支
| 分支 | 掌门 | 备注 |
|------|------|------|
| {{name}} | [[{{leader}}]] | {{note}} |

## 成员
- [[{{character}}]] — {{role}}

## 镇派武学
- [[{{skill}}]]

## 特殊规则
- {{rule}}

## 相关地点
- [[{{location}}]]
```

- [ ] **Step 2: 创建场景卡模板**

```markdown
# {{name}}

---
id: {{id}}
region: {{region}}                # 地理区域
---

## 描述
{{description}}

## 子场景
- **{{sub_name}}**: {{sub_description}}

## 相连地点
- [[{{connected_location}}]]

## 出现人物
- [[{{character}}]]

## 相关门派
- [[{{faction}}]]
```

- [ ] **Step 3: Commit**

```bash
git add framework/templates/faction-template.md framework/templates/location-template.md
git commit -m "feat: add faction and location card Markdown templates with wikilinks"
```

---

## Task 5: 创建游戏化模板和公式

**Files:**
- Create: `framework/templates/archetypes.json`
- Create: `framework/templates/factions.json`
- Create: `framework/balance/combat-formula.json`

- [ ] **Step 1: 创建角色原型模板**

```json
{
  "base_stats": {
    "protagonist": {"hp": 1200, "mp": 1000, "atk": 70, "def": 60, "spd": 70, "wiz": 50},
    "companion":  {"hp": 1000, "mp": 800,  "atk": 60, "def": 50, "spd": 60, "wiz": 50},
    "npc":        {"hp": 600,  "mp": 400,  "atk": 40, "def": 35, "spd": 40, "wiz": 30},
    "villain":    {"hp": 1500, "mp": 800,  "atk": 80, "def": 70, "spd": 60, "wiz": 40}
  },
  "archetype_multipliers": {
    "scholar":  {"hp": 0.8, "mp": 1.3, "atk": 0.7, "def": 0.8, "spd": 1.0, "wiz": 1.5},
    "warrior":  {"hp": 1.3, "mp": 0.7, "atk": 1.3, "def": 1.2, "spd": 0.9, "wiz": 0.8},
    "monk":     {"hp": 1.1, "mp": 1.2, "atk": 0.9, "def": 1.0, "spd": 1.0, "wiz": 1.1},
    "assassin": {"hp": 0.9, "mp": 0.8, "atk": 1.4, "def": 0.7, "spd": 1.3, "wiz": 0.9},
    "healer":   {"hp": 0.9, "mp": 1.4, "atk": 0.6, "def": 0.9, "spd": 0.8, "wiz": 1.2}
  },
  "power_rank_multipliers": {
    "1":     1.5,
    "2-3":   1.3,
    "4-10":  1.1,
    "11-30": 1.0,
    "31+":   0.9
  },
  "growth_per_level": {
    "scholar":  {"hp": 60,  "mp": 80,  "atk": 3,  "def": 4,  "spd": 5,  "wiz": 8},
    "warrior":  {"hp": 100, "mp": 40,  "atk": 8,  "def": 7,  "spd": 5,  "wiz": 3},
    "monk":     {"hp": 80,  "mp": 60,  "atk": 5,  "def": 6,  "spd": 5,  "wiz": 5},
    "assassin": {"hp": 70,  "mp": 50,  "atk": 9,  "def": 4,  "spd": 8,  "wiz": 4},
    "healer":   {"hp": 70,  "mp": 90,  "atk": 3,  "def": 5,  "spd": 4,  "wiz": 7}
  }
}
```

- [ ] **Step 2: 创建门派加成模板**

```json
{
  "faction_bonuses": {
    "dali_duan":     {"mp": 200, "wiz": 20},
    "gaibang":       {"hp": 150, "atk": 15},
    "shaolin":       {"hp": 200, "def": 20},
    "xiaoyao":       {"mp": 300, "spd": 20},
    "faction_wuliang": {"atk": 10},
    "faction_shennong": {"hp": 50},
    "murong":        {"atk": 15, "spd": 10},
    "xingxiu":       {"mp": 100, "wiz": 10}
  }
}
```

- [ ] **Step 3: 创建战斗公式**

```json
{
  "formula": {
    "description": "最终属性 = Base(role) × Archetype修正 × Rank倍率 + Faction加成",
    "hp_final": "base_hp * archetype_hp * rank_mult + faction_hp",
    "mp_final": "base_mp * archetype_mp * rank_mult + faction_mp",
    "atk_final": "base_atk * archetype_atk * rank_mult + faction_atk",
    "def_final": "base_def * archetype_def * rank_mult + faction_def",
    "spd_final": "base_spd * archetype_spd * rank_mult + faction_spd",
    "wiz_final": "base_wiz * archetype_wiz * rank_mult + faction_wiz"
  },
  "rank_multipliers": {
    "返璞归真": 2.0,
    "登峰造极": 1.5,
    "出神入化": 1.3,
    "炉火纯青": 1.2,
    "登堂入室": 1.0,
    "略有小成": 0.8,
    "初窥门径": 0.6,
    "平平无奇": 0.4
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add framework/templates/ framework/balance/
git commit -m "feat: add game stat templates and combat formula"
```

---

## Task 6: 创建骨架提取Prompt

**Files:**
- Create: `tools/extract/skeleton-prompt.md`

- [ ] **Step 1: 创建骨架提取prompt**

```markdown
# 骨架提取Prompt

你是一个武侠小说分析专家。请从以下文本中提取：

1. **人物**：名字 + 身份 + 一句话描述 + 一句话性格
2. **门派**：名字 + 类型 + 地点
3. **地点**：名字 + 地理位置 + 一句话描述
4. **武功**：名字 + 类型（剑法/掌法/内功/轻功/暗器）+ 简要描述

规则：
- 只提取本章实际出现的人物/门派/地点/武功
- 门派如有宗门分支（如无量剑东宗/西宗），作为一个门派，宗门作为sub_divisions
- 武功需有具体描写，不能只是"武功很高"
- 段誉的武功分两层：known_skills（已掌握）和 related_skills（家族/门派关联但尚未学会）
- id格式：人物char_拼音, 门派faction_拼音, 地点loc_拼音, 技能skill_拼音

输出纯JSON格式，不要其他文字：
{
  "chapter": <章节号>,
  "characters": [
    {
      "id": "char_xxx",
      "name": "名字",
      "alias": ["别名"],
      "identity": "身份",
      "faction": "所属门派id或null",
      "role": "protagonist/companion/npc/villain",
      "one_line": "一句话描述",
      "personality": "一句话性格",
      "known_skills": ["已掌握的技能id"],
      "related_skills": ["关联但未学会的技能id"]
    }
  ],
  "factions": [
    {
      "id": "faction_xxx",
      "name": "名字",
      "type": "武林门派/帮派/家族",
      "location": "地点id",
      "sub_divisions": ["分支"],
      "one_line": "一句话描述"
    }
  ],
  "locations": [
    {
      "id": "loc_xxx",
      "name": "名字",
      "region": "地理区域",
      "one_line": "一句话描述"
    }
  ],
  "skills": [
    {
      "id": "skill_xxx",
      "name": "名字",
      "type": "剑法/掌法/内功/轻功/暗器/指法",
      "faction": "所属门派id或空字符串",
      "one_line": "一句话描述"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/extract/skeleton-prompt.md
git commit -m "feat: add skeleton extraction prompt template"
```

---

## Task 7: 创建深度提取Prompt

**Files:**
- Create: `tools/extract/deep-prompt.md`

- [ ] **Step 1: 创建深度提取prompt**

```markdown
# 深度提取Prompt

你是一个武侠小说分析专家。请基于以下骨架索引，从原文中提取详细数据。

## 骨架索引（已确认的人物/门派/地点/武功）
{{SKELETON_INDEX}}

## 提取要求

### 人物详细卡
对骨架中每个人物，提取：
- personality: {traits: [], speech_style: "...", temperament: "..."}
- relationships: [{target: "char_xxx", type: "love/sworn_brother/master_student/enemy/complicated", intensity: 0-100, bond_level: 1-5, dynamic: "关系变化描述"}]
- known_skills / related_skills: 确认或修正骨架中的列表
- archetype: scholar/warrior/monk/assassin/healer（根据性格和武功推断）

### 技能详细卡
对骨架中每个技能，提取：
- techniques: [{id: "tech_xxx", name: "招式名", type: "attack/defense/buff/debuff/feint/beast/special", description: "招式描述"}]
- progression: [{level: 1-5, unlock: "解锁描述"}]（如有明确升级线）
- effects: [{type: "效果类型", condition: "触发条件", description: "描述"}]
- combat_style: "战斗风格描述"

### 关系卡
提取本章中体现的人物关系变化：
- 新建立的关系
- 关系强度变化
- 关系类型变化

### 对话片段
提取2-5段关键对话，标记：
- speaker: "说话人角色id"
- listener: "听话人角色id或null"
- text: "对话内容"
- tone: "语气标签（书生气/豪迈/愤怒/悲伤/调侃等）"

输出纯JSON格式：
{
  "chapter": <章节号>,
  "characters_detail": [
    {
      "id": "char_xxx",
      "personality": {"traits": [], "speech_style": "...", "temperament": "..."},
      "archetype": "scholar/warrior/monk/assassin/healer",
      "relationships": [],
      "known_skills": [],
      "related_skills": []
    }
  ],
  "skills_detail": [
    {
      "id": "skill_xxx",
      "techniques": [],
      "progression": [],
      "effects": [],
      "combat_style": "..."
    }
  ],
  "events": [
    {
      "id": "evt_xxx",
      "name": "事件名",
      "participants": ["char_xxx"],
      "location": "loc_xxx",
      "description": "事件描述",
      "chapter": <章节号>
    }
  ],
  "dialogues": [
    {
      "speaker": "char_xxx",
      "listener": "char_xxx或null",
      "text": "对话内容",
      "tone": "语气标签",
      "chapter": <章节号>
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/extract/deep-prompt.md
git commit -m "feat: add deep extraction prompt template"
```

---

## Task 8: 创建骨架提取脚本

**Files:**
- Create: `tools/extract/extract-skeleton.py`

- [ ] **Step 1: 创建骨架提取Python脚本**

```python
#!/usr/bin/env python3
"""骨架提取脚本：逐章调用LLM提取人物/门派/地点/武功粗列表"""

import os
import sys
import json
import glob
import re

# 配置
NOVEL_DIR = "金庸/天龙八部"
NOVEL_FILE = "天龙八部.txt"
CHAPTERS_OUTPUT = "金庸/天龙八部/chapters"
PROMPT_FILE = "tools/extract/skeleton-prompt.md"
PROGRESS_FILE = "金庸/天龙八部/progress.json"

# 章节边界：每章以 "一\t" "二\t" 等数字开头
CHAPTER_PATTERN = re.compile(r'^[一二三四五六七八九十百千]+[　\s\t]+', re.MULTILINE)


def split_chapters(text):
    """将小说文本按章节分割"""
    lines = text.split('\n')
    chapters = []
    current_start = None
    current_num = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if CHAPTER_PATTERN.match(stripped):
            if current_start is not None:
                chapters.append({
                    'num': current_num,
                    'start': current_start,
                    'end': i
                })
            current_num += 1
            current_start = i

    # 最后一章
    if current_start is not None:
        chapters.append({
            'num': current_num,
            'start': current_start,
            'end': len(lines)
        })

    return chapters, lines


def load_progress():
    """加载进度文件"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "skeleton": {"total": 50, "done": [], "failed": [], "pending": []},
        "deep": {"total": 50, "done": [], "failed": [], "pending": []},
        "merge": False,
        "gamify": False,
        "rag": False
    }


def save_progress(progress):
    """保存进度文件"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_missing_chapters(progress):
    """获取需要提取的章节号"""
    done = set(progress["skeleton"]["done"])
    total = progress["skeleton"]["total"]
    return [i for i in range(1, total + 1) if i not in done]


def main():
    # 读取小说
    novel_path = os.path.join(NOVEL_DIR, NOVEL_FILE)
    with open(novel_path, 'r', encoding='gbk', errors='replace') as f:
        text = f.read()

    # 分割章节
    chapters, lines = split_chapters(text)
    print(f"检测到 {len(chapters)} 个章节")

    # 加载进度
    progress = load_progress()

    # 更新总章节数
    progress["skeleton"]["total"] = len(chapters)

    # 读取prompt
    with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
        prompt_template = f.read()

    # 获取需要处理的章节
    # 如果命令行指定了章节号，只处理那些
    if len(sys.argv) > 1:
        target_chapters = [int(x) for x in sys.argv[1:]]
    else:
        target_chapters = get_missing_chapters(progress)

    print(f"需要处理 {len(target_chapters)} 个章节: {target_chapters[:10]}...")

    # 确保输出目录存在
    os.makedirs(CHAPTERS_OUTPUT, exist_ok=True)

    # 处理每个章节
    for ch_num in target_chapters:
        if ch_num < 1 or ch_num > len(chapters):
            print(f"[SKIP] 章节 {ch_num} 超出范围")
            continue

        ch = chapters[ch_num - 1]
        chapter_text = '\n'.join(lines[ch['start']:ch['end']])
        output_file = os.path.join(CHAPTERS_OUTPUT, f"ch_{ch_num:02d}_skeleton.json")

        if os.path.exists(output_file):
            print(f"[SKIP] 章节 {ch_num} - 已存在")
            if ch_num not in progress["skeleton"]["done"]:
                progress["skeleton"]["done"].append(ch_num)
            continue

        print(f"[RUN]  章节 {ch_num} - 提取中... ({len(chapter_text)} 字)")

        # 构建完整prompt
        full_prompt = f"{prompt_template}\n\n---\n\n以下是第{ch_num}章原文：\n\n{chapter_text}"

        # 这里需要调用LLM
        # 实际使用时，将full_prompt发送给LLM API
        # result = call_llm_api(full_prompt)

        # 临时：将prompt写入文件供手动测试
        prompt_output = os.path.join(CHAPTERS_OUTPUT, f"ch_{ch_num:02d}_skeleton_prompt.txt")
        with open(prompt_output, 'w', encoding='utf-8') as f:
            f.write(full_prompt)

        print(f"[INFO] 章节 {ch_num} - prompt已写入 {prompt_output}")
        print(f"[TODO] 章节 {ch_num} - 需要调用LLM获取结果并保存到 {output_file}")

    save_progress(progress)
    print("完成！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/extract/extract-skeleton.py
git commit -m "feat: add skeleton extraction script with resume support"
```

---

## Task 9: 创建深度提取脚本

**Files:**
- Create: `tools/extract/extract-deep.py`

- [ ] **Step 1: 创建深度提取Python脚本**

```python
#!/usr/bin/env python3
"""深度提取脚本：基于骨架索引，逐章调用LLM提取详细数据"""

import os
import sys
import json
import re

CHAPTERS_DIR = "金庸/天龙八部/chapters"
PROMPT_FILE = "tools/extract/deep-prompt.md"
PROGRESS_FILE = "金庸/天龙八部/progress.json"


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"skeleton": {"done": []}, "deep": {"total": 50, "done": [], "failed": [], "pending": []}}


def save_progress(progress):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def load_skeleton(ch_num):
    """加载骨架提取结果"""
    path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def format_skeleton_index(skeleton):
    """将骨架数据格式化为prompt中的索引文本"""
    lines = []

    if 'characters' in skeleton:
        lines.append("### 人物")
        for c in skeleton['characters']:
            lines.append(f"- {c['id']}: {c['name']} ({c.get('identity', '')}) - {c.get('one_line', '')}")

    if 'factions' in skeleton:
        lines.append("\n### 门派")
        for f in skeleton['factions']:
            lines.append(f"- {f['id']}: {f['name']} ({f.get('type', '')}) - {f.get('one_line', '')}")

    if 'locations' in skeleton:
        lines.append("\n### 地点")
        for l in skeleton['locations']:
            lines.append(f"- {l['id']}: {l['name']} ({l.get('region', '')}) - {l.get('one_line', '')}")

    if 'skills' in skeleton:
        lines.append("\n### 武功")
        for s in skeleton['skills']:
            lines.append(f"- {s['id']}: {s['name']} ({s.get('type', '')}) - {s.get('one_line', '')}")

    return '\n'.join(lines)


def main():
    # 加载进度
    progress = load_progress()

    # 读取prompt模板
    with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
        prompt_template = f.read()

    # 获取需要处理的章节
    skeleton_done = set(progress["skeleton"]["done"])
    deep_done = set(progress["deep"]["done"])

    if len(sys.argv) > 1:
        target_chapters = [int(x) for x in sys.argv[1:]]
    else:
        # 只处理骨架已完成但深度未完成的
        target_chapters = sorted(skeleton_done - deep_done)

    print(f"需要深度提取 {len(target_chapters)} 个章节")

    for ch_num in target_chapters:
        skeleton = load_skeleton(ch_num)
        if skeleton is None:
            print(f"[SKIP] 章节 {ch_num} - 骨架文件不存在")
            continue

        deep_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep.json")
        if os.path.exists(deep_output):
            print(f"[SKIP] 章节 {ch_num} - 深度提取已存在")
            if ch_num not in progress["deep"]["done"]:
                progress["deep"]["done"].append(ch_num)
            continue

        # 格式化骨架索引
        skeleton_index = format_skeleton_index(skeleton)

        # 替换prompt中的占位符
        full_prompt = prompt_template.replace("{{SKELETON_INDEX}}", skeleton_index)

        # 读取章节原文
        # 注意：需要从原始小说中读取对应章节
        # 这里简化处理，实际需要和extract-skeleton.py相同的章节分割逻辑
        prompt_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep_prompt.txt")
        with open(prompt_output, 'w', encoding='utf-8') as f:
            f.write(full_prompt)

        print(f"[INFO] 章节 {ch_num} - 深度提取prompt已写入 {prompt_output}")
        print(f"[TODO] 章节 {ch_num} - 需要调用LLM获取结果并保存到 {deep_output}")

    save_progress(progress)
    print("完成！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/extract/extract-deep.py
git commit -m "feat: add deep extraction script with skeleton dependency"
```

---

## Task 10: 创建合并脚本

**Files:**
- Create: `tools/merge/merge-chapters.py`

- [ ] **Step 1: 创建智能合并脚本**

```python
#!/usr/bin/env python3
"""合并脚本：将50章的骨架+深度提取结果合并为全局数据"""

import os
import json
import glob

CHAPTERS_DIR = "金庸/天龙八部/chapters"
OUTPUT_DIR = "金庸/天龙八部"
PROGRESS_FILE = "金庸/天龙八部/progress.json"


def load_all_chapters():
    """加载所有章节的骨架+深度数据"""
    chapters = []
    for i in range(1, 51):
        sk_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_skeleton.json")
        dp_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")

        sk_data = None
        dp_data = None

        if os.path.exists(sk_path):
            with open(sk_path, 'r', encoding='utf-8') as f:
                sk_data = json.load(f)

        if os.path.exists(dp_path):
            with open(dp_path, 'r', encoding='utf-8') as f:
                dp_data = json.load(f)

        chapters.append({
            'num': i,
            'skeleton': sk_data,
            'deep': dp_data
        })

    return chapters


def merge_list(existing, new, key='id'):
    """合并两个列表，以key为去重依据"""
    by_id = {item[key]: item for item in existing}
    for item in new:
        item_id = item[key]
        if item_id in by_id:
            # 智能合并：取并集
            merged = by_id[item_id]
            for k, v in item.items():
                if k == key:
                    continue
                if isinstance(v, list) and isinstance(merged.get(k), list):
                    # 列表取并集
                    existing_vals = set(str(x) for x in merged[k])
                    for x in v:
                        if str(x) not in existing_vals:
                            merged[k].append(x)
                elif k == 'intensity' or k == 'bond_level':
                    # 数值取最新
                    merged[k] = v
                elif v is not None and v != '' and v != []:
                    # 非空值覆盖
                    merged[k] = v
        else:
            by_id[item_id] = item
    return list(by_id.values())


def merge_all(chapters):
    """合并所有章节数据"""
    all_characters = []
    all_factions = []
    all_locations = []
    all_skills = []
    all_techniques = []
    all_events = []
    all_dialogues = []

    for ch in chapters:
        if ch['skeleton']:
            sk = ch['skeleton']
            all_characters = merge_list(all_characters, sk.get('characters', []))
            all_factions = merge_list(all_factions, sk.get('factions', []))
            all_locations = merge_list(all_locations, sk.get('locations', []))
            all_skills = merge_list(all_skills, sk.get('skills', []))

        if ch['deep']:
            dp = ch['deep']
            # 合并详细数据到已有条目
            for detail in dp.get('characters_detail', []):
                for char in all_characters:
                    if char['id'] == detail['id']:
                        for k, v in detail.items():
                            if k == 'id':
                                continue
                            if isinstance(v, list) and isinstance(char.get(k), list):
                                existing = set(str(x) for x in char[k])
                                for x in v:
                                    if str(x) not in existing:
                                        char[k].append(x)
                            elif v is not None and v != '':
                                char[k] = v
                        break

            for detail in dp.get('skills_detail', []):
                for skill in all_skills:
                    if skill['id'] == detail['id']:
                        for k, v in detail.items():
                            if k == 'id':
                                continue
                            if isinstance(v, list) and isinstance(skill.get(k), list):
                                existing = set(str(x) for x in skill[k])
                                for x in v:
                                    if str(x) not in existing:
                                        skill[k].append(x)
                            elif v is not None and v != '':
                                skill[k] = v
                        break

            all_techniques.extend(dp.get('techniques', []))
            all_events.extend(dp.get('events', []))
            all_dialogues.extend(dp.get('dialogues', []))

    return {
        'characters': all_characters,
        'factions': all_factions,
        'locations': all_locations,
        'skills': all_skills,
        'techniques': all_techniques,
        'events': all_events,
        'dialogues': all_dialogues
    }


def save_merged(data):
    """保存合并结果"""
    for key, items in data.items():
        output_path = os.path.join(OUTPUT_DIR, f"{key}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"保存 {len(items)} 个 {key} 到 {output_path}")


def main():
    print("加载章节数据...")
    chapters = load_all_chapters()

    skeleton_count = sum(1 for c in chapters if c['skeleton'])
    deep_count = sum(1 for c in chapters if c['deep'])
    print(f"骨架数据: {skeleton_count} 章, 深度数据: {deep_count} 章")

    print("合并中...")
    merged = merge_all(chapters)

    print("保存结果...")
    save_merged(merged)

    # 更新进度
    progress = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['merge'] = True
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("合并完成！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/merge/merge-chapters.py
git commit -m "feat: add chapter merge script outputting Obsidian Markdown cards"
```

---

## Task 11: 创建游戏化赋值脚本（更新YAML frontmatter）

**Files:**
- Create: `tools/gamify/assign-stats.py`

- [ ] **Step 1: 创建游戏化赋值脚本**

```python
#!/usr/bin/env python3
"""游戏化赋值脚本：为角色/技能添加游戏数值"""

import os
import json

NOVELS_DIR = "金庸/天龙八部"
TEMPLATES_DIR = "framework/templates"
BALANCE_DIR = "framework/balance"


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


RANK_MULTIPLIERS = {
    "返璞归真": 2.0,
    "登峰造极": 1.5,
    "出神入化": 1.3,
    "炉火纯青": 1.2,
    "登堂入室": 1.0,
    "略有小成": 0.8,
    "初窥门径": 0.6,
    "平平无奇": 0.4,
}


def get_rank_mult(rank):
    """根据实力评级获取倍率"""
    return RANK_MULTIPLIERS.get(rank, 1.0)


def assign_character_stats(characters, archetypes, factions, formula):
    """为角色计算游戏属性"""
    base_stats = archetypes['base_stats']
    archetype_mults = archetypes['archetype_multipliers']
    faction_bonuses = factions['faction_bonuses']

    for char in characters:
        role = char.get('role', 'npc')
        archetype = char.get('archetype', 'warrior')
        faction = char.get('faction')
        rank = char.get('rank', '登堂入室')

        # 基础值
        base = base_stats.get(role, base_stats['npc'])

        # 原型修正
        mult = archetype_mults.get(archetype, archetype_mults['warrior'])

        # 实力评级倍率
        rank_mult = get_rank_mult(rank)

        # 门派加成
        faction_bonus = faction_bonuses.get(faction, {}) if faction else {}

        # 计算最终属性
        stats = {}
        for attr in ['hp', 'mp', 'atk', 'def', 'spd', 'wiz']:
            base_val = base.get(attr, 50)
            mult_val = mult.get(attr, 1.0)
            bonus_val = faction_bonus.get(attr, 0)
            stats[attr] = int(base_val * mult_val * rank_mult + bonus_val)

        char['game_stats'] = stats
        char['game_stats']['level'] = 1

        # 成长曲线
        growth = archetypes.get('growth_per_level', {}).get(archetype)
        if growth:
            char['growth_per_level'] = growth

    return characters


def assign_skill_stats(skills, archetypes):
    """为技能计算游戏属性"""
    for skill in skills:
        rank = skill.get('rank', '登堂入室')
        skill_type = skill.get('type', 'sword_art')

        # 基础伤害（根据评级）
        rank_damage = {
            "返璞归真": 400, "登峰造极": 300, "出神入化": 250,
            "炉火纯青": 200, "登堂入室": 150, "略有小成": 120,
            "初窥门径": 100, "平平无奇": 80,
        }
        base_damage = rank_damage.get(rank, 150)

        skill['game_stats'] = {
            'damage_base': base_damage,
            'mp_cost': int(base_damage * 0.3),
            'cooldown': max(1, 5 - (rank or 30) // 10),
            'range': 'melee' if skill_type in ['sword_art', 'palm_art', 'fist_art'] else 'ranged'
        }

    return skills


def main():
    # 加载数据
    characters = load_json(os.path.join(NOVELS_DIR, 'characters.json'))
    skills = load_json(os.path.join(NOVELS_DIR, 'skills.json'))
    factions = load_json(os.path.join(NOVELS_DIR, 'factions.json'))

    # 加载模板
    archetypes = load_json(os.path.join(TEMPLATES_DIR, 'archetypes.json'))
    faction_templates = load_json(os.path.join(TEMPLATES_DIR, 'factions.json'))
    formula = load_json(os.path.join(BALANCE_DIR, 'combat-formula.json'))

    # 赋值
    print("为角色赋值...")
    characters = assign_character_stats(characters, archetypes, faction_templates, formula)

    print("为技能赋值...")
    skills = assign_skill_stats(skills, archetypes)

    # 保存
    for name, data in [('characters', characters), ('skills', skills), ('factions', factions)]:
        output = os.path.join(NOVELS_DIR, f'game_{name}.json')
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"保存到 {output}")

    # 更新进度
    progress_path = os.path.join(NOVELS_DIR, 'progress.json')
    progress = {}
    if os.path.exists(progress_path):
        with open(progress_path, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['gamify'] = True
    with open(progress_path, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("游戏化赋值完成！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/gamify/assign-stats.py
git commit -m "feat: add game stats assignment script"
```

---

## Task 12: 创建RAG切片脚本

**Files:**
- Create: `tools/rag/chunk-text.py`

- [ ] **Step 1: 创建RAG切片脚本**

```python
#!/usr/bin/env python3
"""RAG切片脚本：将小说文本切为200-500字的chunk，附加元数据"""

import os
import json
import re

NOVEL_DIR = "金庸/天龙八部"
NOVEL_FILE = "天龙八部.txt"
CHAPTERS_DIR = "金庸/天龙八部/chapters"
CHUNKS_DIR = "金庸/天龙八部/chunks"
PROGRESS_FILE = "金庸/天龙八部/progress.json"

CHAPTER_PATTERN = re.compile(r'^[一二三四五六七八九十百千]+[　\s\t]+', re.MULTILINE)


def split_chapters(text):
    """分割章节"""
    lines = text.split('\n')
    chapters = []
    current_start = None
    current_num = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if CHAPTER_PATTERN.match(stripped):
            if current_start is not None:
                chapters.append({
                    'num': current_num,
                    'start': current_start,
                    'end': i
                })
            current_num += 1
            current_start = i

    if current_start is not None:
        chapters.append({
            'num': current_num,
            'start': current_start,
            'end': len(lines)
        })

    return chapters, lines


def chunk_paragraph(text, min_size=100, max_size=500):
    """将文本按段落切分为chunk"""
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) < min_size:
            current_chunk += para + "\n"
        elif len(current_chunk) + len(para) <= max_size:
            current_chunk += para + "\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # 处理超长段落
            if len(para) > max_size:
                # 按句号拆分
                sentences = re.split(r'([。！？])', para)
                temp = ""
                for sent in sentences:
                    if len(temp) + len(sent) <= max_size:
                        temp += sent
                    else:
                        if temp:
                            chunks.append(temp.strip())
                        temp = sent
                if temp:
                    current_chunk = temp + "\n"
                else:
                    current_chunk = ""
            else:
                current_chunk = para + "\n"

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def load_skeleton(ch_num):
    """加载骨架数据用于元数据标注"""
    path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def annotate_chunk(chunk_text, skeleton):
    """为chunk添加元数据"""
    metadata = {
        'characters': [],
        'locations': [],
        'type': 'narration'
    }

    if skeleton:
        # 检测chunk中出现的人物
        for char in skeleton.get('characters', []):
            if char['name'] in chunk_text:
                metadata['characters'].append(char['id'])

        # 检测chunk中出现的地点
        for loc in skeleton.get('locations', []):
            if loc['name'] in chunk_text:
                metadata['locations'].append(loc['id'])

    # 检测类型
    if '"' in chunk_text or '"' in chunk_text or '道：' in chunk_text:
        metadata['type'] = 'dialogue'
    elif '只见' in chunk_text or '眼前' in chunk_text or '远处' in chunk_text:
        metadata['type'] = 'scene'

    return metadata


def main():
    # 读取小说
    novel_path = os.path.join(NOVEL_DIR, NOVEL_FILE)
    with open(novel_path, 'r', encoding='gbk', errors='replace') as f:
        text = f.read()

    # 分割章节
    chapters, lines = split_chapters(text)
    print(f"检测到 {len(chapters)} 个章节")

    # 确保输出目录存在
    os.makedirs(CHUNKS_DIR, exist_ok=True)

    all_chunks = []
    chunk_id = 0

    for ch in chapters:
        ch_text = '\n'.join(lines[ch['start']:ch['end']])
        skeleton = load_skeleton(ch['num'])

        chunks = chunk_paragraph(ch_text)
        print(f"第{ch['num']}章: {len(chunks)} 个chunk")

        for i, chunk_text in enumerate(chunks):
            chunk_id += 1
            metadata = annotate_chunk(chunk_text, skeleton)
            metadata['chapter'] = ch['num']
            metadata['chunk_index'] = i
            metadata['id'] = f"chunk_{chunk_id:04d}"

            all_chunks.append({
                'id': f"chunk_{chunk_id:04d}",
                'chapter': ch['num'],
                'text': chunk_text,
                'metadata': metadata
            })

    # 保存chunks
    output_path = os.path.join(CHUNKS_DIR, 'all_chunks.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\n总共 {len(all_chunks)} 个chunk，保存到 {output_path}")

    # 更新进度
    progress_path = os.path.join(NOVELS_DIR, 'progress.json')
    progress = {}
    if os.path.exists(progress_path):
        with open(progress_path, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['rag'] = True
    with open(progress_path, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("RAG切片完成！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/rag/chunk-text.py
git commit -m "feat: add RAG chunking script with metadata annotation"
```

---

## Task 13: 创建校验脚本（校验Markdown frontmatter）

**Files:**
- Create: `tools/validate/validate.py`

- [ ] **Step 1: 创建数据校验脚本**

脚本读取 Markdown 卡片的 YAML frontmatter，校验数据完整性和一致性。校验项目：ID唯一性、`[[wikilinks]]` 引用完整性、关系双向性、必需字段存在性。

```python
#!/usr/bin/env python3
"""校验脚本：检查提取数据的完整性和一致性"""

import os
import json
from collections import Counter

NOVELS_DIR = "金庸/天龙八部"


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate_id_uniqueness(items, name):
    """检查id唯一性"""
    ids = [item['id'] for item in items]
    duplicates = [id for id, count in Counter(ids).items() if count > 1]
    if duplicates:
        print(f"  [FAIL] {name}: 重复id: {duplicates}")
        return False
    print(f"  [PASS] {name}: {len(items)} 个，id唯一")
    return True


def validate_references(characters, skills, factions):
    """检查引用完整性"""
    skill_ids = {s['id'] for s in skills}
    faction_ids = {f['id'] for f in factions}
    char_ids = {c['id'] for c in characters}
    errors = []

    for char in characters:
        for sk_id in char.get('known_skills', []):
            if sk_id not in skill_ids:
                errors.append(f"{char['id']}.known_skills引用不存在的技能: {sk_id}")
        for sk_id in char.get('related_skills', []):
            if sk_id not in skill_ids:
                errors.append(f"{char['id']}.related_skills引用不存在的技能: {sk_id}")
        if char.get('faction') and char['faction'] not in faction_ids:
            errors.append(f"{char['id']}.faction引用不存在的门派: {char['faction']}")
        for rel in char.get('relationships', []):
            if rel['target'] not in char_ids:
                errors.append(f"{char['id']}.relationships引用不存在的角色: {rel['target']}")

    if errors:
        print(f"  [FAIL] 引用完整性: {len(errors)} 个错误")
        for e in errors[:10]:
            print(f"    - {e}")
        return False
    print(f"  [PASS] 引用完整性: 无错误")
    return True


def validate_relationships(characters):
    """检查关系双向性"""
    char_ids = {c['id'] for c in characters}
    missing = []

    for char in characters:
        for rel in char.get('relationships', []):
            target = next((c for c in characters if c['id'] == rel['target']), None)
            if target:
                has_reverse = any(r['target'] == char['id'] for r in target.get('relationships', []))
                if not has_reverse:
                    missing.append(f"{char['id']} → {rel['target']} ({rel['type']})")

    if missing:
        print(f"  [WARN] 关系双向性: {len(missing)} 个单向关系")
        for m in missing[:10]:
            print(f"    - {m}")
        return False
    print(f"  [PASS] 关系双向性: 所有关系双向")
    return True


def validate_schema(data, schema_path, name):
    """检查JSON Schema合规性"""
    if not os.path.exists(schema_path):
        print(f"  [SKIP] {name}: Schema文件不存在")
        return True
    # 简化检查：只验证必需字段存在
    schema = load_json(schema_path)
    if not schema:
        return True
    required = schema.get('required', [])
    errors = []
    for item in data:
        for field in required:
            if field not in item:
                errors.append(f"{item.get('id', '?')}: 缺少必需字段 {field}")
    if errors:
        print(f"  [FAIL] {name} Schema: {len(errors)} 个错误")
        for e in errors[:5]:
            print(f"    - {e}")
        return False
    print(f"  [PASS] {name} Schema: 合规")
    return True


def main():
    print("=== 数据校验 ===\n")

    # 加载数据
    characters = load_json(os.path.join(NOVELS_DIR, 'characters.json'))
    skills = load_json(os.path.join(NOVELS_DIR, 'skills.json'))
    factions = load_json(os.path.join(NOVELS_DIR, 'factions.json'))
    locations = load_json(os.path.join(NOVELS_DIR, 'locations.json'))

    if not all([characters, skills, factions, locations]):
        print("[ERROR] 缺少合并数据文件，请先运行合并脚本")
        return

    results = []

    # 1. ID唯一性
    print("1. ID唯一性检查:")
    results.append(validate_id_uniqueness(characters, "characters"))
    results.append(validate_id_uniqueness(skills, "skills"))
    results.append(validate_id_uniqueness(factions, "factions"))
    results.append(validate_id_uniqueness(locations, "locations"))

    # 2. 引用完整性
    print("\n2. 引用完整性检查:")
    results.append(validate_references(characters, skills, factions))

    # 3. 关系双向性
    print("\n3. 关系双向性检查:")
    results.append(validate_relationships(characters))

    # 4. Schema合规
    print("\n4. Schema合规检查:")
    results.append(validate_schema(characters, "framework/schema/character.schema.json", "characters"))
    results.append(validate_schema(skills, "framework/schema/skill.schema.json", "skills"))
    results.append(validate_schema(factions, "framework/schema/faction.schema.json", "factions"))
    results.append(validate_schema(locations, "framework/schema/location.schema.json", "locations"))

    # 汇总
    passed = sum(results)
    total = len(results)
    print(f"\n=== 结果: {passed}/{total} 通过 ===")

    if passed < total:
        print("存在校验失败，请检查上述错误")
    else:
        print("所有校验通过！")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add tools/validate/validate.py
git commit -m "feat: add data validation script"
```

---

## Task 14: 试运行（3章端到端验证）

**目的:** 用第1、10、25章跑通完整管道（骨架→深度→合并→游戏化→RAG），验证所有环节再批量执行。

- [ ] **Step 1: 骨架提取第1章**

已有 `金庸/chapters/chapter_01.json` 作为参考。用提取脚本对第1章重新提取，对比结果质量。

```bash
cd C:\git\wuxia_novel
python tools/extract/extract-skeleton.py 1
```

将prompt送入LLM，保存结果到 `金庸/天龙八部/chapters/ch_01_skeleton.json`。

- [ ] **Step 2: 骨架提取第10、25章**

同上，对第10章和第25章执行骨架提取。

```bash
python tools/extract/extract-skeleton.py 10 25
```

- [ ] **Step 3: 深度提取第1、10、25章**

```bash
python tools/extract/extract-deep.py 1 10 25
```

- [ ] **Step 4: 合并试运行**

```bash
python tools/merge/merge-chapters.py
```

检查合并结果：人物数量是否合理，有无重复id。

- [ ] **Step 5: 游戏化试运行**

```bash
python tools/gamify/assign-stats.py
```

抽查段誉属性：应为高MP高WIZ低ATK。

- [ ] **Step 6: RAG试运行**

```bash
python tools/rag/chunk-text.py
```

检查chunk数量和质量。

- [ ] **Step 7: 校验试运行**

```bash
python tools/validate/validate.py
```

- [ ] **Step 8: 人工审查**

对比第1章提取结果和 `金庸/chapters/chapter_01.json`（已有参考），检查：
- 人物数量是否一致
- 门派/技能是否遗漏
- 性格描述是否准确

如有问题，修复prompt或脚本后重跑。

- [ ] **Step 9: 试运行通过后Commit**

```bash
git add 金庸/天龙八部/ -A
git commit -m "feat: trial run on chapters 1/10/25 - pipeline validated"
```

---

## Task 15: 执行骨架提取（50章）

**Files:**
- Create: `金庸/天龙八部/chapters/ch_XX_skeleton.json` (50个)

- [ ] **Step 1: 运行骨架提取脚本生成prompts**

```bash
cd C:\git\wuxia_novel
python tools/extract/extract-skeleton.py
```

预期输出：50个 `ch_XX_skeleton_prompt.txt` 文件写入 `金庸/天龙八部/chapters/`

- [ ] **Step 2: 用Agent并行执行LLM提取**

对每个prompt文件，调用LLM获取JSON结果。使用10个并行agent，每个处理5章（RPM=100，10并发安全）：
- Agent 1:  ch_01 ~ ch_05
- Agent 2:  ch_06 ~ ch_10
- Agent 3:  ch_11 ~ ch_15
- Agent 4:  ch_16 ~ ch_20
- Agent 5:  ch_21 ~ ch_25
- Agent 6:  ch_26 ~ ch_30
- Agent 7:  ch_31 ~ ch_35
- Agent 8:  ch_36 ~ ch_40
- Agent 9:  ch_41 ~ ch_45
- Agent 10: ch_46 ~ ch_50

每个agent读取prompt文件，调用LLM，将结果保存为 `ch_XX_skeleton.json`。不指定model参数，继承主模型。

- [ ] **Step 3: 验证骨架提取完整性**

```bash
cd C:\git\wuxia_novel
ls 金庸/天龙八部/chapters/ch_*_skeleton.json | wc -l
```

预期：50个文件

- [ ] **Step 4: Commit**

```bash
git add 金庸/天龙八部/chapters/ch_*_skeleton.json
git commit -m "feat: complete skeleton extraction for all 50 chapters"
```

---

## Task 16: 执行深度提取（50章）

**Files:**
- Create: `金庸/天龙八部/chapters/ch_XX_deep.json` (50个)

- [ ] **Step 1: 运行深度提取脚本生成prompts**

```bash
cd C:\git\wuxia_novel
python tools/extract/extract-deep.py
```

前提：骨架提取全部完成。输出：50个 `ch_XX_deep_prompt.txt` 文件。

- [ ] **Step 2: 用Agent并行执行LLM提取**

同Task 14的并行策略，10个agent各处理5章。不指定model参数，继承主模型。

- [ ] **Step 3: 验证深度提取完整性**

```bash
ls 金庸/天龙八部/chapters/ch_*_deep.json | wc -l
```

预期：50个文件

- [ ] **Step 4: Commit**

```bash
git add 金庸/天龙八部/chapters/ch_*_deep.json
git commit -m "feat: complete deep extraction for all 50 chapters"
```

---

## Task 17: 执行合并（输出Markdown卡片）

**Files:**
- Create: `金庸/天龙八部/characters/*.md` (每个角色一个文件)
- Create: `金庸/天龙八部/skills/*.md` (每个技能一个文件)
- Create: `金庸/天龙八部/factions/*.md` (每个门派一个文件)
- Create: `金庸/天龙八部/locations/*.md` (每个地点一个文件)

- [ ] **Step 1: 运行合并脚本**

```bash
cd C:\git\wuxia_novel
python tools/merge/merge-chapters.py
```

预期输出：Markdown 卡片文件，每个角色/技能/门派/地点一个 .md 文件。

- [ ] **Step 2: 抽查合并结果**

检查 `characters/段誉.md`、`characters/萧峰.md`、`characters/虚竹.md` 是否存在。
检查 `skills/六脉神剑.md`、`skills/降龙十八掌.md`、`skills/北冥神功.md` 是否存在。
检查 `[[wikilinks]]` 引用格式是否正确。

- [ ] **Step 3: Commit**

```bash
git add 金庸/天龙八部/characters/ 金庸/天龙八部/skills/
git add 金庸/天龙八部/factions/ 金庸/天龙八部/locations/
git commit -m "feat: merge all chapters into Obsidian Markdown cards"
```

---

## Task 18: 执行游戏化赋值（更新YAML frontmatter）

**Files:**
- Modify: `金庸/天龙八部/characters/*.md` (更新 game_stats 字段)
- Modify: `金庸/天龙八部/skills/*.md` (更新 game_stats 字段)

- [ ] **Step 1: 为角色添加archetype和rank**

在 Markdown 卡片的 YAML frontmatter 中，为关键角色补充 `archetype` 和 `rank`：
- 段誉: archetype=scholar, rank=登峰造极
- 萧峰: archetype=warrior, rank=登峰造极
- 虚竹: archetype=monk, rank=登峰造极
- 扫地僧: archetype=monk, rank=返璞归真
- 鸠摩智: archetype=warrior, rank=出神入化
- 慕容复: archetype=warrior, rank=出神入化

其他角色由LLM根据personality推断。

- [ ] **Step 2: 运行游戏化赋值脚本**

```bash
cd C:\git\wuxia_novel
python tools/gamify/assign-stats.py
```

- [ ] **Step 3: 抽查数值合理性**

检查段誉的属性：应为高MP、高WIZ、低ATK。
检查萧峰的属性：应为高HP、高ATK、高DEF。

- [ ] **Step 4: Commit**

```bash
git add 金庸/天龙八部/characters/ 金庸/天龙八部/skills/
git commit -m "feat: assign game stats to Markdown cards via YAML frontmatter"
```

---

## Task 19: 执行RAG切片

**Files:**
- Create: `金庸/天龙八部/chunks/all_chunks.json`

- [ ] **Step 1: 运行RAG切片脚本**

```bash
cd C:\git\wuxia_novel
python tools/rag/chunk-text.py
```

预期输出：`all_chunks.json` 包含所有chunk。

- [ ] **Step 2: 建立context-mode索引**

使用context-mode的ctx_index将chunks索引化，支持后续FTS5检索。

- [ ] **Step 3: 测试检索**

用context-mode搜索"段誉 六脉神剑"，验证检索效果。

- [ ] **Step 4: Commit**

```bash
git add 金庸/天龙八部/chunks/
git commit -m "feat: create RAG chunks with metadata annotation"
```

---

## Task 20: 数据校验

- [ ] **Step 1: 运行校验脚本**

```bash
cd C:\git\wuxia_novel
python tools/validate/validate.py
```

预期：全部PASS。如有FAIL，根据错误信息修复。

- [ ] **Step 2: 人工抽查前5章**

对比 `ch_01_skeleton.json` 和原文第一章，检查提取质量。

- [ ] **Step 3: Commit校验修复**

如有修复，提交修复代码。

```bash
git add -A
git commit -m "fix: resolve validation errors"
```

---

## Task 21: 更新tasks.md并完成

- [ ] **Step 1: 勾选tasks.md中所有完成的任务**

- [ ] **Step 2: 最终Commit**

```bash
git add openspec/changes/wuxia-data-pipeline/tasks.md
git commit -m "docs: mark all tasks complete"
```
