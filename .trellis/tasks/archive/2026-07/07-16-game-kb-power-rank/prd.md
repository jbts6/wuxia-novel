# 统一 game-kb 境界字段契约

## Goal

让 `generate-game-kb` 与 Dashboard 使用同一个强度字段契约：人物和武功只使用 `power_rank`，物品不再包含或展示稀有度。

## Background

当前飞狐外传数据在 Dashboard 中显示为“未标明境界”，原因是生成流程和页面使用了不一致的字段。用户确认将人物和武功统一为 `power_rank`，并删除物品稀有度字段与页面能力。

## Requirements

- 人物和武功必须使用同一个 `power_rank` 字段。
- `power_rank` 仅允许以下八级值，顺序从低到高：`平平无奇`、`初窥门径`、`略有小成`、`登堂入室`、`炉火纯青`、`出神入化`、`登峰造极`、`返璞归真`。
- `power_rank` 记录全书证据支持的巅峰状态。
- 逐章人物和武功候选提供暂定 `power_rank`；`distill:plot` 和 `distill:martial` 为保留实体给出最终 `power_rank`，不增加 AI 工作单元。
- 新武功数据不得输出 `mastery_rank` 或旧 `rank`。
- 新物品数据不得输出 `rarity_tier` 或 `rarity`。
- 语义契约版本升级为 v3；现有 v2 run 保持只读，不能静默升级或安装。
- Dashboard 只在原始数据归一化边界兼容旧武功字段，优先级为 `power_rank ?? mastery_rank ?? rank`；应用内部只保留 `power_rank`。
- Dashboard 删除物品稀有度筛选、表格列和详情展示。
- 不批量重写现有知识库；重新生成时自然迁移到 v3。
- 保留现有有界重试、证据门和九类 JSON 兼容输出。

## Acceptance Criteria

- [ ] 章节、领域 keep、定向补漏、合并、清洗、最终与安装边界拒绝缺失或非法的人物/武功 `power_rank`。
- [ ] 最终人物和武功只输出合法 `power_rank`；武功不含 `mastery_rank`/`rank`。
- [ ] 最终物品不含 `rarity_tier`/`rarity`。
- [ ] Skill、schema、提示词和后端质量规范一致声明 v3、八级境界、巅峰状态和字段归属。
- [ ] Dashboard 能将旧武功字段归一化到 `power_rank`，其类型和组件不再消费旧字段。
- [ ] Dashboard 物品页面不再显示或筛选稀有度。
- [ ] `generate-game-kb` 全量测试、Dashboard 测试、lint 和生产构建通过。
- [ ] 除 Dashboard 原始兼容边界外，活动流程无旧武功境界字段或物品稀有度消费者。

## Out Of Scope

- 批量迁移现有书籍 JSON。
- 修改重试策略、质量门、领域输入大小或其他先前审阅问题。
- 恢复逐章对白提取。
