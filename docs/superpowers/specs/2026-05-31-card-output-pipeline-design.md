---
comet_change: card-output-pipeline
role: technical-design
canonical_spec: openspec
archived-with: 2026-05-31-card-output-pipeline
status: final
---

# 卡片产出 + 数据补全 - 技术设计

## 技术方案

### Phase 1: 卡片生成（复用现有脚本）

**实现方案**：
- 直接运行现有脚本：
  - `tools/convert/json-to-markdown.py` - 生成角色/功法/门派/地点卡片
  - `tools/convert/generate-event-cards.py` - 生成事件卡片 + 时间线
- 输入文件（已存在）：
  - `金庸/天龙八部/game_characters.json`
  - `金庸/天龙八部/game_skills.json`
  - `金庸/天龙八部/game_factions.json`
  - `金庸/天龙八部/locations.json`
  - `金庸/天龙八部/chapters/ch_XX_deep.json` (50章)
- 输出目录：
  - `金庸/天龙八部/characters/*.md`
  - `金庸/天龙八部/skills/*.md`
  - `金庸/天龙八部/factions/*.md`
  - `金庸/天龙八部/locations/*.md`
  - `金庸/天龙八部/events/*.md`
  - `金庸/天龙八部/事件时间线.md`

**技术风险**：低 - 脚本已存在且经过验证

### Phase 2: Techniques 提取

**实现方案**：
- 从 `game_skills.json` 提取 `techniques` 字段
- 数据结构已确认：77 个 skills，每个包含 `techniques` 数组
- 处理逻辑：
  1. 遍历所有 skills
  2. 提取每个 skill 的 `techniques` 数组
  3. 扁平化并去重（基于 technique id 或 name）
  4. 写入 `金庸/天龙八部/techniques.json`

**实现选择**：
- 优先方案：修改 `tools/merge/merge-chapters.py`，添加 techniques 提取逻辑
- 备选方案：创建独立脚本 `tools/extract/extract-techniques.py`

**技术风险**：低 - 数据结构明确，逻辑简单

### Phase 3: 物品管道（新增能力）

**实现方案**：

#### 3.1-3.2: Prompt 更新
- 更新 `tools/extract/skeleton-prompt.md`：
  - 添加 items 提取要求
  - 定义 items 数据模型（参考 characters/skills 模式）
- 更新 `tools/extract/deep-prompt.md`：
  - 添加 items_detail 提取要求
  - 明确物品属性字段（name, type, owner, description, effects 等）

#### 3.3: 合并逻辑
- 修改 `tools/merge/merge-chapters.py`：
  - 添加 items 合并逻辑（类似现有 characters/skills 合并）
  - 去重策略：基于 item name + owner
  - 输出：`金庸/天龙八部/game_items.json`

#### 3.4: 卡片生成脚本
- 创建 `tools/convert/json-to-items-markdown.py`：
  - 参考 `json-to-markdown.py` 的实现模式
  - 生成 Obsidian Markdown 格式
  - YAML frontmatter 包含：type, owner, tags
  - 正文包含：description, effects, wikilinks

#### 3.5-3.6: 增量重提取
- 策略：检查现有章节 JSON 是否已有 `items` 字段
  - 有 → 跳过
  - 无 → 重新提取
- 避免覆盖已有数据（characters, skills, events）
- 执行顺序：
  1. skeleton 提取（50章）
  2. deep 提取（50章）
- 实施更新：items 深度信息沿用现有项目的 prompt → 外部 LLM → JSON 回填方式；脚本生成 `ch_XX_items_detail_prompt.txt`，LLM 结果保存为 `ch_XX_items_detail.json`，再由 merge 管道合并进 `items.json`。

#### 3.7: 验证
- 运行 merge 生成 `game_items.json`
- 运行卡片生成脚本
- 验证输出完整性

**技术风险**：
- 中等 - 重提取 50 章耗时较长（预计 30-60 分钟）
- items 数据模型需要在 3.1 明确定义
- 增量提取逻辑需要正确处理已有数据

## 数据流

```
Phase 1:
  game_*.json → [json-to-markdown.py] → *.md 卡片
  chapters/*.json → [generate-event-cards.py] → events/*.md + 时间线

Phase 2:
  game_skills.json → [提取逻辑] → techniques.json

Phase 3:
  skeleton-prompt.md (更新) → [骨架提取] → ch_XX_skeleton.json (补充 items)
  deep-prompt.md (更新) → [深度提取] → ch_XX_deep.json (补充 items_detail)
  chapters/*.json → [merge-chapters.py] → game_items.json
  game_items.json → [json-to-items-markdown.py] → items/*.md
```

## 测试策略

### Phase 1 验证
- 检查生成卡片数量是否符合预期
- 抽样验证 wikilinks 格式正确性
- 验证 YAML frontmatter 包含必要字段（type, tags）
- 检查事件时间线完整性

### Phase 2 验证
- 验证 `techniques.json` 非空
- 检查 techniques 数量合理性（预期 > 0）
- 验证与 skills 的引用一致性（每个 technique 应该被至少一个 skill 引用）

### Phase 3 验证
- 抽样检查 3-5 章的 items 提取质量
- 验证 `game_items.json` 结构正确
- 检查生成的 items 卡片格式一致性
- 验证 wikilinks 指向正确（owner → character）

## 约束

1. **数据完整性**：不修改现有 `game_*.json` 结构
2. **格式一致性**：保持 Obsidian wikilink 格式一致（`[[entity_name]]`）
3. **YAML 规范**：所有卡片必须包含完整的 frontmatter
4. **增量安全**：Phase 3 重提取不能覆盖已有的 characters/skills/events 数据

## 关键技术决策

1. **执行顺序**：Phase 1 和 Phase 2 可并行，Phase 3 依赖 Phase 2 完成（需要 techniques 数据模型作为参考）
2. **脚本复用**：优先修改现有脚本而非创建新脚本（Phase 2）
3. **增量策略**：检查字段存在性而非时间戳，避免误覆盖
4. **数据模型**：items 模型在 Phase 3.1 明确定义后，后续步骤严格遵循

## 边界条件

- 章节数量固定为 50 章（ch_01 到 ch_50）
- 现有脚本假设输入文件存在且格式正确
- 卡片输出目录需要预先创建（或脚本内自动创建）
- items 数据可能为空（某些章节可能没有物品描述）
- 对包含 `items` 的章节，`items_detail` 输出必须覆盖该章节全部 item id；缺失时 verification 失败，不能归档。
