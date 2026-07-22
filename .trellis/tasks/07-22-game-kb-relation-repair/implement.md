# 实施计划

## 1. 确定性名称解析

- 在 `scripts/lib/finalize.js` 拆分正式名称、内部候选键与别名索引，实现固定优先级解析。
- 扩展 `finalize.test.js`：正式名称压过冲突别名、唯一别名、歧义别名、旧内部候选键兼容与缺失目标。
- 验证：目标测试、`node --check scripts/lib/finalize.js`、全量测试。
- 提交：`fix(game-kb): resolve final relations by canonical name`。

## 2. 章节级关系闭包

- 在 `scripts/lib/chapter-contract.js` 增加关系目标校验；在 `chapter-worker-contract.js`、`schemas.md`、`prompts/extract-chapters.md` 同步合同文本。
- 让 `chapter-receiver.js` 把闭包错误按语义错误走 `chapter-worker` 重试，而不是机械 repair。
- 增加章节合同、接收器和简化合同测试，覆盖三种关系字段、正式名称优先、唯一别名、多义与缺失目标。
- 验证：相关测试、语法检查、全量测试。
- 提交：`feat(game-kb): enforce chapter relation closure`。

## 3. 关系溯源报告

- 在 `book-assembly.js` 保留非终态 relation provenance；在 `assemble.js`/`finalize.js` 将无法解析的关系展开为章节级 recovery report。
- 在 `flow.js` 将终态关系失败转为可读取的 `manual_review` 状态并保存报告，不更改 parent accepted artifact。
- 增加 assembly、flow 和 archive/immutability 回归测试，验证报告稳定排序、哈希绑定、精确章节映射与父 run 不变。
- 验证：相关测试、全量测试。
- 提交：`feat(game-kb): report final relation failures by chapter`。

## 4. 派生恢复 run

- 在 `run.js`、`paths.js`、`chapter-progress.js` 与 candidate ledger 新增 recovery run 初始化和 receipt 校验。
- 在 `flow.js` 实现 `recover-relations --run --confirm`；在 `chapter-work.js` 构建带父 draft/错误上下文的 chapter-worker 输入。
- 复制未受影响章节为新 run 的 immutable carry-forward artifacts，只把报告映射到的单元置为 pending；复用既有窗口、接收、组装、验证和归档。
- 扩展 CLI、progress、artifact immutability、run archive 与端到端流测试：确认门禁、父 run 不变、5+2 章节签发、恢复中断、源/报告/父 artifact 篡改拒绝、成功安装。
- 验证：相关测试、全量 `generate-game-kb` 测试、所有修改脚本 `node --check`、`git diff --check`。
- 提交：`feat(game-kb): recover final relation failures selectively`。

## 风险与检查点

- 不得为通过终态验证自动删除缺失关系；所有语义修复必须回到 `chapter-worker` 读取原文。
- 不得修改当前《萧十一郎》run；使用新的临时 fixture run 验证 recovery。
- 每个提交前确认五个终态 YAML 合同、artifact manifest 不可变规则、source hash 绑定和 `retry-unit` 原语义均未回归。
