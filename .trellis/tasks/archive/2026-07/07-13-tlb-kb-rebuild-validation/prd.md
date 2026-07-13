# 天龙八部知识库重建与 generate-kb 流程验证

## Goal

以《天龙八部》现有原文扫描证据为基础，重建符合新版 `generate-kb` 契约的最终知识库，并用该流程验证新版 skill 能否正确阻止骨架数据、非法 ID、陈旧报告和无证据 enrich。

本任务不默认重扫原文：在源文件 hash 未变化且 Stage 1/2 证据可复用时，复用现有窗口和候选账本；最终数据与质量报告必须重新生成。

## Requirements

- 保留并验证当前源文件、`build/source-index.json`、`build/scan-manifest.json`、`build/candidates.jsonl` 等可追溯证据；源 hash 变化时停止复用并重新 Prepare Source。
- 重新审查候选归并和分类：每个候选必须有合法 `keep|merge|redirect|reject` decision；保留项必须包含 canonical name、final category、importance、reason 和正式 final ID。
- 正式 ID 必须使用固定类别前缀和逐字无声调拼音；所有实体、引用、事件和对话引用保持一致。不得把 `auto_*` 或中文 ID 转写后直接当作既定事实。
- 从原文候选证据重新生成八类最终 JSON；角色、功法、招式、物品、地点、势力等必须满足 schema 的字段和条件 enrich 要求，解释性字段必须有可命中的 `field_source_refs`。
- 事件表、语义豁免、章节摘要和对话必须与当前正式 ID、章节行号和原文证据一致；不得静默跳过主要事件或核心/重要角色的语义覆盖。
- 独立执行 gap audit，确认最后一轮没有有效新增候选；随后重新生成全部验证、交叉验证、召回审计、审核包和摘要报告。
- 通过新版 `generate-kb` 的 G1-G5 完成门禁，并确保所有报告的 `final_data_hash` 与当前最终八类数据一致。
- 使用 staging/归档方式保护当前工作区，重建失败时可以回滚；不把临时调试脚本或运行时依赖加入正式项目流程。

## Acceptance Criteria

- [ ] 源 hash、章节 corpus hash 和 scan manifest 一致；所有必需窗口的 named-inventory、event-dialogue、gap-audit 覆盖符合门禁。
- [ ] `validate-inventory.js`、`validate-final-data.js`、`verify.js`、`cross-validate.js`、`audit-recall.js` 均针对同一份当前数据完成，且无阻塞错误。
- [ ] `validate-final-data.js` 明确拒绝骨架记录、非法 ID、非法引用、缺失条件字段和缺少字段级证据的记录；重建结果通过该校验。
- [ ] `reports/quality_report.json` 的 `completion_gate_passed` 为 `true`，G1-G5 全部 PASS；`reports/review_packet.json` 状态为 `ready_for_human_review`。
- [ ] `verification_report.json`、`cross_validation_report.json` 和 `final_data_validation.json` 的 hash 与当前八类最终数据完全一致。
- [ ] 产出重建前后差异摘要，说明哪些旧产物被复用、哪些最终数据被重建、哪些候选被合并/重定向/拒绝以及剩余人工风险。

## Scope Boundary

- 本任务只处理《天龙八部》知识库及新版 `generate-kb` 流程验证，不扩展到其他小说。
- 不凭空增加原文没有的实体、人物关系、武学效果或背景资料。
- 不把人工审核替代 AI 的召回、归并、证据和 enrich 工作；人工只处理最终审核包中的有限高风险项。

## Confirmed Baseline

- 当前源 hash 与 scan manifest 一致，224 个窗口、1661 条候选均已生成，三类扫描记录为 224/224。
- `decisions.jsonl` 可解析且覆盖全部候选，但 1015 条 decision 全部为 `keep`，需要重新进行语义归并审查。
- 六类实体最终 JSON 主要只有 `id/name/source_refs`；现有正式 ID 含 `auto_*` 和中文，不能继续作为成品。
- 现有 `final_data_validation.json` 曾标记通过，但其 hash 与当前八类数据 hash 不一致，属于陈旧报告。

## Open Questions

- 无阻塞问题。默认采用“先写 staging，再通过门禁后替换正式 `data/`”的发布策略。
