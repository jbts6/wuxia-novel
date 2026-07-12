# Design: generate-kb 完整性门禁

## Boundary

新增一个无第三方依赖的最终数据契约模块，作为八类 JSON 的结构、丰富字段和证据字段单一来源。现有 G1-G5 语义保持五道独立门禁，不增加可补偿总分；结构与 enrich 完整性归入 G3，语义非空与 cross-validation 新鲜度归入 G5。

## Contract Model

每类记录声明以下规则：

- 文件必须存在且顶层必须是数组。
- required fields：键必须存在，值类型必须正确。
- required content：名称、分类、定位和核心描述等不可为空。
- conditional enrichment：例如核心/重要/次要角色必须有 biography 和 personality；龙套/背景允许明确的空内容，但字段仍必须存在。
- enums and nested shapes：rank、type、importance、tone、rarity、relationship、effects 等使用现有常量校验。
- evidence fields：`one_line`、`biography`、`personality`、`combat_style`、`description`、`origin`、`summary` 等非空丰富字段必须有 grounded `field_source_refs`。

契约输出稳定、可操作的错误字符串，包含文件、记录 ID/索引和字段路径。空数组只在契约明确允许时有效，不能依靠 JavaScript `every/some` 的空集真值隐式通过。

## Data Flow

```text
data/*.json
    -> validateFinalData()
       -> file/schema/enrichment errors
       -> final_data_hash
       -> evidence field declarations
    -> verify.js ---------------------> verification_report.final_data_hash + file_errors
    -> cross-validate.js -------------> cross_validation_report.final_data_hash
    -> collectEvidenceIntegrity() ----> G3
    -> collectSemanticCoverage() -----> G5
    -> assess-quality/review packet
```

`final_data_hash` 对八个文件按固定文件顺序读取原始字节并做 SHA-256；缺失文件仍产生契约错误，不能生成可接受的 hash。任何数据编辑都会使旧 verification/cross-validation 报告失效。

## Gate Changes

- G3 新增：`missing_data_files`、`invalid_data_files`、`schema_errors`、`enrichment_errors`、`verification_file_errors`、`verification_data_hash_valid`。
- G3 保留：实体 source refs、丰富字段 refs、对话原文、grand weak/unverified。
- G5 新增：`cross_validation_data_hash_valid`，以及至少一个核心/重要角色的非空语义检查。
- G2 加强 decision 结构，但不改变 keep/merge/redirect/reject 语义。
- G4 和人工审核数量报警不承担 enrich 完整性职责。

## Compatibility

- 八类最终文件名和消费字段不删除；只把文档已经要求的字段从“事实上可缺失”提升为可执行契约。
- 旧骨架知识库会在重新 enrich 和重新运行 verify/cross-validate 前失败，这是预期迁移行为。
- 合理的空数组和 nullable 引用继续允许；不要求凭空补写原文没有的信息。
- `.claude` 镜像仅同步本次涉及的文件，保留 `split-chapters.js` 等现有无关改动。

## Risks And Controls

- 过严导致幻觉补全：用条件规则区分字段存在、内容非空和允许空值，测试合法空值。
- 文档与代码再次漂移：证据字段和枚举从代码契约单点导出；测试覆盖各类别代表字段，文档只解释规则。
- 陈旧报告误判：hash 绑定当前八类数据，报告缺 hash 一律视为未证明完整。
- 测试夹具过度简化：端到端最小夹具必须写完整记录，不再以骨架作为成功样本。

## Rollback

修改集中在新增契约模块、门禁接线、报告 hash、测试和文档。若某类条件规则误伤，可单独放宽该类别契约；不需要回滚 source/ledger 格式或小说数据。
