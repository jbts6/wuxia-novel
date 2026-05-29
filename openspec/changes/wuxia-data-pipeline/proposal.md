## Why

武侠RPG游戏需要从小说文本中提取结构化数据（人物、武功、门派、关系、场景），供游戏引擎运行时使用。目前项目有210本武侠小说纯文本，无任何结构化数据。需要一套提取管道，将小说转化为游戏可用的JSON数据+context-mode可检索的文本索引。

## What Changes

- 建立武侠小说数据提取管道：小说原文 → 骨架提取 → 深度提取 → 合并去重 → 游戏化赋值 → RAG切片
- 定义通用数据Schema（角色卡、技能卡、功法卡、门派卡、场景卡、任务卡）
- 设计"框架模板+小说补丁"架构，支持多小说复用
- 先从《天龙八部》单本验证，再扩展到通用框架

## Capabilities

### New Capabilities

- `novel-extraction`: 小说文本提取管道——骨架提取（人物/门派/地点/武功粗列表）+ 深度提取（详细属性/关系/事件/对话）
- `data-schema`: 通用武侠数据Schema定义——角色卡、功法卡（含招式子层）、门派卡、场景卡、任务卡、关系卡
- `game-stats`: 游戏化数值系统——角色模板、原型修正、实力排名倍率、门派加成、成长曲线、战斗公式
- `framework-patch`: 框架+补丁架构——通用模板定义 + 小说级覆盖/扩展机制

### Modified Capabilities

（无，这是全新系统）

## Impact

- 新增目录结构：`openspec/specs/` 下4个能力规格文件
- 新增数据目录：`金庸/chapters/`（逐章JSON）、`framework/`（模板）、`novels/tianlong-babu/`（合并数据）
- 依赖：context-mode MCP（FTS5文本索引）、LLM API（提取用）
- 无现有代码影响，纯新增系统
