# 实施基线

- 记录日期：2026-07-13
- `.agents/skills/generate-kb` 与 `.claude/skills/generate-kb` 启动前状态：无未提交修改。
- 既有测试基线：50 tests，50 pass，0 fail。
- Phase A 新测试 RED：因缺少 `scripts/lib/atomic-json.js` 以 `MODULE_NOT_FOUND` 失败。
- Phase A 新测试 GREEN：5 tests，5 pass，0 fail。
- 《天龙八部》保护范围：`data/`、`reports/` 与根目录 `cross_validation_report.json`，共 23 个文件。
- 《天龙八部》保护范围聚合 SHA-256：`998e8b1f74b7b9470125a038f830b64ce1a4d994e5770e83620d5bb4ce29d0f4`。

聚合算法按相对路径排序，依次写入 `relative_path + NUL + file_bytes + NUL` 后计算 SHA-256。
