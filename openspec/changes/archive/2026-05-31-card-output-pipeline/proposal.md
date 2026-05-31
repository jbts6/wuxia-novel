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
