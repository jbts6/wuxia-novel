# 严格的证据排版符号等价匹配

## Goal

在不修改原文的前提下，对白名单排版符号做唯一命中、原文回填和审计，保持措辞改写 fail closed

## Requirements

- R1：小说原文、prepared chapter 和旧 run 保持不变；Worker 继续被要求逐字引用，不获得主动改写标点的许可。
- R2：沿用 BOM、CRLF、NFKC、空白折叠；只有 exact match 失败后才启用显式 allowlist typography folding。
- R3：首批额外 allowlist 只包含一对一排版字形：`。` / `.`，`“”「」『』` / `"`，`‘’` / `'`。NFKC 已处理的全角 ASCII 字符不重复实现规则。
- R4：不得折叠或删除 `、`、`—`、`…`、书名号等非稳定一对一符号；不得使用编辑距离、模糊匹配或删除全部标点。
- R5：fallback 除 allowlist 字符外，汉字、数字、字母、其他符号及顺序必须完全一致，并且在当前章节或已验证行范围内唯一命中。
- R6：唯一命中后，accepted `source_refs[].text` 回填章节 canonical text 中的源标点；行号从同一命中位置派生。
- R7：符号恢复写入 accepted chapter 既有 `normalizations`，字段至少包含 `field_path`、`original_value`、`normalized_value`、`normalization_rule`；最终 assembly 将其归入独立 grounding 审计，不混入 `type_normalizations`。
- R8：零命中、多命中、非 allowlist 差异和任何措辞改写继续返回 `SOURCE_QUOTE_NOT_FOUND`。

## Dependencies

- 代码实现不依赖父任务的 rank/level 合同变更，也不修改 `chapter-worker-contract.js`，可以独立测试和提交。
- 父任务 `.trellis/tasks/07-23-fix-v7-rank-contract/` 的《血海飘香》最终重跑必须等待本任务和 rank/level 修复都通过。
- 复用 accepted chapter 已有 `normalizations` 数据结构；不新建旁路 receipt 格式。

## Acceptance Criteria

- [ ] exact quote 行为不变且不产生 typography normalization。
- [ ] 仅 `。` / `.` 或 allowlist 引号字形不同的候选在当前章节唯一命中，accepted quote 使用源章节字形并派生正确行号。
- [ ] 每次 fallback 恢复生成一条稳定、可排序的 grounding normalization audit。
- [ ] 同一 folded quote 多次出现时拒绝，不擅自选择首次命中。
- [ ] `、` / `,`、`—` / `-`、省略号长度变化等非 allowlist 差异继续拒绝。
- [ ] `chapter:015 attempt_01` 的真实错误引文作为 false-pass 固件继续返回 `SOURCE_QUOTE_NOT_FOUND`。
- [ ] accepted artifact 和最终 deterministic audit 正确区分 grounding 与 type normalizations。
- [ ] 定向测试及 generate-game-kb 全量测试通过。

## Notes

- 本任务解决模型无意统一排版字形造成的假拒绝，不降低逐字证据门禁。
- 本次 prepared corpus 同时含 2,436 个 `。` 和 2,240 个 `.`，证明源文本本身是混合排版体系。
