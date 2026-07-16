# 统一 game-kb 境界字段契约设计

## Architecture

新增 CommonJS 共享契约模块 `scripts/lib/semantic-contract.js`，作为语义版本、profile、八级 `power_rank` 枚举和校验函数的单一来源。生成器各阶段引用该模块，避免版本号和枚举分散。

## Data Contract

- 人物：必需 `power_rank`。
- 武功：必需 `power_rank`，禁止 `mastery_rank` 和 `rank`。
- 物品：禁止 `rarity_tier` 和 `rarity`。
- 四域决策：`plot` 和 `martial` 的允许补丁字段包含 `power_rank`；人物/武功 keep 决策必须提供合法最终值。
- 合并：keep 节点的领域补丁覆盖逐章暂定值，得到全书巅峰状态。

## Compatibility

语义契约从 v2 升到 v3。v2 活动 run 进入只读旧 run 路由，必须显式归档后才能新建 v3 run。现有最终 JSON 不批量改写。

Dashboard 原始输入类型允许旧武功 `mastery_rank`/`rank`，归一化后只输出 `power_rank`。物品旧稀有度字段被忽略，不进入应用模型。

## Validation Boundaries

在章节草稿、领域决定、定向 recall/supplement、book contract、finalize 和 verify 中校验合法境界；最终 shape 额外拒绝禁用旧字段。文档契约测试扫描完整八级枚举和字段规则。

## Rollback

本变更不修改现有书籍数据。回滚只需恢复 v2 契约、旧字段输出及 Dashboard 消费代码；用户已有 `dashboard/package-lock.json` 修改始终保留。
