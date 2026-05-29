# 任务清单

## Phase 1: Markdown模板定义

- [x] 1.1 创建角色卡Markdown模板 (`framework/templates/character-template.md`)
- [x] 1.2 创建功法卡Markdown模板 (`framework/templates/skill-template.md`)
- [x] 1.3 创建招式卡Markdown模板 (`framework/templates/technique-template.md`)
- [x] 1.4 创建门派卡Markdown模板 (`framework/templates/faction-template.md`)
- [x] 1.5 创建场景卡Markdown模板 (`framework/templates/location-template.md`)
- [x] 1.6 创建物品卡Markdown模板 (`framework/templates/item-template.md`)
- [x] 1.7 创建角色原型数值模板 (`framework/templates/archetypes.json`)
- [x] 1.8 创建门派加成模板 (`framework/templates/factions.json`)
- [x] 1.9 创建数值平衡公式 (`framework/balance/combat-formula.json`)

## Phase 2: 提取管道

- [x] 2.1 编写骨架提取prompt模板 (`tools/extract/skeleton-prompt.md`)
- [x] 2.2 编写深度提取prompt模板 (`tools/extract/deep-prompt.md`)
- [x] 2.3 编写骨架提取脚本 (`tools/extract/extract-skeleton.py`)
- [x] 2.4 编写深度提取脚本 (`tools/extract/extract-deep.py`)
- [ ] 2.5 对天龙八部50章执行骨架提取

## Phase 3: 合并与游戏化（输出Markdown卡片）

- [x] 3.1 编写合并脚本 (`tools/merge/merge-chapters.py`) — 输出Obsidian Markdown卡片
- [x] 3.2 编写游戏化赋值脚本 (`tools/gamify/assign-stats.py`) — 更新YAML frontmatter
- [ ] 3.3 对天龙八部执行合并+游戏化

## Phase 4: RAG索引

- [x] 4.1 编写RAG切片脚本 (`tools/rag/chunk-text.py`)
- [ ] 4.2 对天龙八部执行RAG切片并建立context-mode索引

## Phase 5: 验证

- [ ] 5.1 验证Markdown卡片完整性（wikilinks引用、必需字段）
- [ ] 5.2 验证游戏化数值合理性
- [ ] 5.3 验证context-mode检索效果
- [ ] 5.4 验证Obsidian关系图谱显示

## 数据格式说明

所有最终数据使用 **Markdown + YAML frontmatter**：
- YAML frontmatter 包含结构化字段（id, type, rank, game_stats 等）
- 正文使用 `[[wikilinks]]` 引用其他卡片，Obsidian 自动建立关系图谱
- 章节中间数据（skeleton/deep）仍用 JSON
- RAG chunks 用 JSON（程序检索用）
