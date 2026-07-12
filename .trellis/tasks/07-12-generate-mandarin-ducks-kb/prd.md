# 修复 generate-kb 完整性门禁

## Goal

让 `generate-kb` 只有在八类最终 JSON 已完成结构化丰富、字段合法、证据闭环且验证报告对应当前数据时，才能通过 G1-G5。消除“只写 id/name/source_refs 的骨架记录仍被判定完成”的空集通过问题。

## Background

- `pipeline.md` 要求 Stage 3 使用候选证据窗口丰富最终八类 JSON，但流水线没有可执行门禁证明 enrich 已完成。
- 当前 `collectEvidenceIntegrity()` 仅在描述字段已经存在且非空时检查 `field_source_refs`；字段完全缺失时直接跳过。
- `DESCRIPTION_FIELDS` 与 `schemas.md` 不一致，例如 skill 契约要求 `type`、`one_line`、`combat_style`，审计代码却关注 `description`、`mechanism`。
- `cross-validate.js` 对引用和枚举采用“字段存在才检查”，因此字段缺失会空集通过。
- `loadJson(..., [])` 使缺失的最终数据文件可被当作空类别处理；`verify.js` 聚合时跳过出错文件，质量门没有检查这些错误。
- 当前《天龙八部》有 179 个角色、39 种功法、59 个招式、79 个物品，但这些类别的大部分丰富字段全部缺失；现有报告仍显示 `completion_gate_passed: true`、G3 PASS。

## Requirements

- R1. 建立代码级、单一来源的最终数据契约，覆盖八个 `data/*.json` 文件的文件存在性、数组形态、必填字段、字段类型、枚举、嵌套结构和条件必填规则。
- R2. 将“结构完整”和“内容已丰富”分开报告。允许语义上合理的空数组或空值，但核心描述字段不得因完全缺失而通过；不同重要性角色采用明确的条件规则，避免为了过门而幻觉补全。
- R3. 由同一契约声明需要独立 `field_source_refs` 的丰富字段，删除审计代码与文档之间的平行字段表。
- R4. G3 必须阻止缺失最终文件、无效 JSON/非数组、schema 错误、enrichment 错误、缺少字段证据、验证文件错误和验证报告陈旧。
- R5. G5 必须阻止 cross-validation 报告缺失或对应旧数据；语义覆盖不能因没有核心/重要角色而空集通过。
- R6. `verify.js` 与 `cross-validate.js` 的报告必须写入当前八类最终数据的稳定 hash，并保留被跳过文件的错误信息；质量门必须核对 hash。
- R7. 候选/决策账本补齐同类结构约束：非 reject 决策必须有规范名、重要性、理由、最终类别和最终 ID；空白字符串不得视为有效。
- R8. 更新 `SKILL.md`、`pipeline.md`、`schemas.md` 与 `review.md`，明确 enrich 的可检查完成条件和骨架数据的失败语义。
- R9. `.agents/skills/generate-kb` 与 `.claude/skills/generate-kb` 的本次修改保持逐字节同步，不覆盖两侧已有的无关改动。
- R10. 本次不创建或修改 `金庸/鸳鸯刀/data`、`build`、`reports`、`ch_split` 等知识库产物。

## Acceptance Criteria

- [x] 删除任意一个八类最终 JSON 文件时，G3 失败并报告具体文件。
- [x] 最终 JSON 不是数组、记录缺少必填字段、字段类型错误或枚举非法时，G3 失败并定位到 `file/id/field`。
- [x] 仅含 `id/name/source_refs` 的 character、skill、technique、item 等骨架记录无法通过 G3。
- [x] 已填丰富字段但缺少可命中的 `field_source_refs` 时继续失败；合法的条件空值不会被误判。
- [x] `verification_report.json` 或 `cross_validation_report.json` 缺失、含文件错误、hash 陈旧时，完成门禁失败。
- [x] 没有核心/重要角色时，语义门禁失败并给出可执行原因。
- [x] 现有《天龙八部》只读回归由错误的 PASS 变为 FAIL，原因包含缺失丰富字段，而不是数量阈值。
- [x] 新增测试覆盖每种失败类型和一套完整最小知识库的成功路径；generate-kb 全量测试通过。
- [x] 两份 skill 结构校验通过，本次修改文件镜像一致，`git diff --check` 通过。
- [x] `金庸/鸳鸯刀` 除现有人工样本和原文外无新增或修改文件。

## Out Of Scope

- 生成或修复任何具体小说的最终知识库内容，包括《鸳鸯刀》和《天龙八部》。
- 以数量下限替代结构、语义或证据完整性证明。
- 引入第三方 JSON Schema 依赖或更改下游八类文件名。
