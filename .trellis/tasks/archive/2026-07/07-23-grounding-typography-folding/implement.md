# 实施计划

## 1. 先写 grounding 失败测试

修改 `.agents/skills/generate-game-kb/tests/grounding.test.js`：

1. exact quote 继续通过，文本与行号不变，不产生 typography metadata。
2. Worker 使用 `.`、源文本使用 `。` 时，唯一 folded match 返回源文本 `。` 和正确行号。
3. 弯引号、直引号和角引号的 allowlist 变体唯一命中。
4. folded quote 在章节出现两次时返回 `SOURCE_QUOTE_NOT_FOUND`。
5. `、` / `,`、`—` / `-`、省略号长度变化继续失败。
6. 加入 `chapter:015 attempt_01` 的真实错误 quote 与正文邻近固件，证明措辞改写继续失败。

先运行：

`node --test .agents/skills/generate-game-kb/tests/grounding.test.js`

确认新增恢复用例失败、false-pass 用例通过后再写实现。

## 2. 实现共用 resolver

修改 `.agents/skills/generate-game-kb/scripts/lib/grounding.js`：

1. 增加显式一对一 allowlist folding 常量与纯函数。
2. 扩展 chapter index 的 typography comparison view，保持 offset 长度一致。
3. 抽取验证和 `deriveSourceRefs()` 共用的 quote resolver。
4. exact match 保持现有优先级；fallback 强制唯一命中。
5. resolver 返回 canonical source quote、行范围及可选 normalization metadata。
6. 零命中、多命中统一保留 `SOURCE_QUOTE_NOT_FOUND`。

运行 grounding 定向测试直到通过，再重构重复搜索逻辑。

## 3. 接入 accepted projection 和审计

修改：

- `.agents/skills/generate-game-kb/scripts/lib/accepted-chapter.js`
- `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`

让 `acceptedSourceRefs()` 提供稳定 field path 并收集 resolver 的 normalization；断言 accepted quote 使用源标点，`normalizations` 使用既有四字段结构。

修改：

- `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- `.agents/skills/generate-game-kb/tests/book-assembly.test.js` 或 `.agents/skills/generate-game-kb/tests/assemble-flow.test.js`

按 `normalization_rule` 前缀拆分 type 与 grounding audit，保留现有 type 输出兼容性。

## 4. 同步说明与验证

更新 `.agents/skills/generate-game-kb/schemas.md`，说明 Controller 的严格 fallback、唯一命中、源文本回填及非 allowlist 边界；继续要求 Worker 逐字引用。

依次运行：

- `node --test .agents/skills/generate-game-kb/tests/grounding.test.js`
- `node --test .agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- 对应 assembly 测试文件
- generate-game-kb 完整测试目录
- `git diff --check`

完成后独立提交：`fix(game-kb): normalize grounded typography safely`。

## 5. 父任务集成条件

- 本子任务完成后不单独重跑《血海飘香》。
- 等父任务 rank/level v4 合同修复完成后，用同一个新 run 同时验证两项变更。
- 不修改旧 v3 run，也不把历史 accepted artifact 重新投影。

