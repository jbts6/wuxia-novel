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
- 实施更新：items 深度信息沿用现有项目的 prompt → 外部 LLM → JSON 回填方式；脚本生成 `ch_XX_items_detail_prompt.txt`，LLM 结果保存为 `ch_XX_items_detail.json`，再由 merge 管道合并进 `items.json`。

## 约束
- 不修改现有 game_*.json 结构
- 保持 Obsidian wikilink 格式一致性
- YAML frontmatter 必须包含必要字段（type, tags, etc.）

## 风险
- Phase 3 重提取可能耗时较长（50 章 × 2 次提取）
- items 数据模型尚未定义，需要在 Phase 3.1 明确
- 对包含 `items` 的章节，`items_detail` 输出必须覆盖该章节全部 item id；缺失时 verification 失败，不能归档。
