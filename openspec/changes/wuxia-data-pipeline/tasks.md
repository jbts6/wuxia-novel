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
