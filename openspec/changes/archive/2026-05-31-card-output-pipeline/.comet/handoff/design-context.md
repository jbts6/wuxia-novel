# Comet Design Handoff

- Change: card-output-pipeline
- Phase: design
- Mode: compact
- Context hash: 29716c79732b697b3a428c8372ec009c275f717f7395d7065eca1c40506c4751

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/card-output-pipeline/proposal.md

- Source: openspec/changes/card-output-pipeline/proposal.md
- Lines: 1-14
- SHA256: 22d1ee7c34a29c4a10bd612f805a5c3b16af7789b7e916147e78eb1fdc8a4884

```md
# 卡片产出 + 数据补全 Proposal

## Why
管道已完成到 JSON 合并和游戏化赋值，但最终产物（Obsidian Markdown 卡片）从未生成。同时 techniques.json 为空数组，物品数据完全缺失。

## What Changes
1. 运行 `json-to-markdown.py` 和 `generate-event-cards.py` 产出全部卡片
2. 修复 `techniques.json`（从 skills 提取招式）
3. 新增物品管道（提取 prompt → 合并 → 卡片生成）

## Capabilities
- `card-generation`: JSON 到 Obsidian Markdown 卡片转换
- `techniques-extraction`: 招式独立实体提取
- `item-extraction`: 物品数据提取（新）
```

## openspec/changes/card-output-pipeline/design.md

- Source: openspec/changes/card-output-pipeline/design.md
- Lines: 1-33
- SHA256: 7c58785ee597d56d3d4cd37bc0e1461c9118c8988efa97bc0256a856f14a8431

```md
# 卡片产出 + 数据补全 Design

## 架构决策

### 1. 执行策略
- **顺序执行**：Phase 1 → Phase 2 → Phase 3
- Phase 1 和 Phase 2 可并行，但 Phase 3 依赖 Phase 2 完成（需要 techniques 数据模型）

### 2. 脚本复用 vs 新建
- Phase 1: 复用现有脚本（`json-to-markdown.py`, `generate-event-cards.py`）
- Phase 2: 优先修改 `merge-chapters.py` 而非新建独立脚本
- Phase 3: 需要新建 `json-to-items-markdown.py`

### 3. 数据流
```
Phase 1: game_*.json → 现有脚本 → *.md 卡片
Phase 2: skills.json → 提取逻辑 → techniques.json
Phase 3: chapters/*.json → 更新 prompts → 重新提取 → merge → items.json → *.md 卡片
```

### 4. 增量式重提取
- Phase 3.5/3.6 需要重新运行 50 章提取
- 策略：检查现有 JSON 是否已有 items 字段，有则跳过
- 避免覆盖已有的 characters/skills/events 数据

## 约束
- 不修改现有 game_*.json 结构
- 保持 Obsidian wikilink 格式一致性
- YAML frontmatter 必须包含必要字段（type, tags, etc.）

## 风险
- Phase 3 重提取可能耗时较长（50 章 × 2 次提取）
- items 数据模型尚未定义，需要在 Phase 3.1 明确
```

## openspec/changes/card-output-pipeline/tasks.md

- Source: openspec/changes/card-output-pipeline/tasks.md
- Lines: 1-27
- SHA256: 6c7f319681136124e87dae6e6bf4a8183eeb10654d8848b87dc088efeed44be5

```md
# 卡片产出 + 数据补全

## Phase 1: 运行已有卡片生成脚本

- [ ] 1.1 运行 `tools/convert/json-to-markdown.py` → 生成角色/功法/门派/地点卡片
  - 输入: `金庸/天龙八部/game_characters.json`, `game_skills.json`, `game_factions.json`, `locations.json`
  - 输出: `金庸/天龙八部/characters/*.md`, `skills/*.md`, `factions/*.md`, `locations/*.md`
- [ ] 1.2 运行 `tools/convert/generate-event-cards.py` → 生成事件卡片 + 时间线
  - 输入: `金庸/天龙八部/chapters/ch_XX_deep.json` (50章)
  - 输出: `金庸/天龙八部/events/*.md`, `金庸/天龙八部/事件时间线.md`
- [ ] 1.3 验证卡片数量和质量（wikilinks、YAML frontmatter 完整性）

## Phase 2: 修复 techniques.json

- [ ] 2.1 分析 skills.json 中内嵌的 techniques 数据分布
- [ ] 2.2 编写脚本或修改 merge-chapters.py，从 skills 提取并去重 techniques 写入 techniques.json
- [ ] 2.3 验证 techniques.json 非空且与 skills 引用一致

## Phase 3: 物品卡片管道

- [ ] 3.1 更新 `tools/extract/skeleton-prompt.md` — 增加 items 提取要求
- [ ] 3.2 更新 `tools/extract/deep-prompt.md` — 增加 items_detail 提取要求
- [ ] 3.3 更新 `tools/merge/merge-chapters.py` — 增加 items 合并逻辑
- [ ] 3.4 编写 `tools/convert/json-to-items-markdown.py` — 物品 JSON 转卡片
- [ ] 3.5 对 50 章重新执行骨架提取（增量式，仅补 items）
- [ ] 3.6 对 50 章重新执行深度提取（增量式，仅补 items_detail）
- [ ] 3.7 运行 merge + items 卡片生成，验证完整性
```

