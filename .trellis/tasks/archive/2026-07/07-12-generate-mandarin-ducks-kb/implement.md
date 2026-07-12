# Implementation Plan

## 1. Reproduce And Contract

- [x] 增加失败测试，证明骨架记录、缺失最终文件、非法枚举和陈旧报告目前可错误通过。
- [x] 新增最终数据契约模块，覆盖八类文件、嵌套字段、条件丰富规则、证据字段和稳定 hash。
- [x] 为契约模块增加逐类别单元测试，包括合法空值与非法空集。

## 2. Wire Hard Gates

- [x] 将契约结果接入 `collectEvidenceIntegrity()` 和 G3，删除平行的 `DESCRIPTION_FIELDS`。
- [x] 让 `verify.js` 报告最终数据 hash 和所有文件错误，并让 G3 校验新鲜度。
- [x] 让 `cross-validate.js` 报告最终数据 hash，并让 G5 校验新鲜度。
- [x] 加强 semantic non-vacuity 和 decision ledger 必填字段。

## 3. Align Workflow

- [x] 更新端到端最小夹具为完整 enrich 记录，并加入逐项删除字段的回归断言。
- [x] 更新 `SKILL.md`、`pipeline.md`、`schemas.md`、`review.md`，明确可检查完成条件和旧库迁移语义。
- [x] 同步本次修改到 `.claude/skills/generate-kb`，不覆盖已有无关改动。

## 4. Verify

- [x] 运行 generate-kb 全量测试并检查失败输出。
- [x] 运行两份 skill 结构校验与本次镜像文件逐字节比较。
- [x] 对《天龙八部》执行只读质量评估，确认旧骨架库因 schema/enrichment 失败。
- [x] 确认 `金庸/鸳鸯刀` 没有新增知识库产物。
- [x] 运行 `rtk git diff --check`，只暂存/提交本任务文件。

## Validation Commands

```bash
node .agents/skills/generate-kb/tests/run-tests.js
python /Users/jbts6/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/generate-kb
python /Users/jbts6/.codex/skills/.system/skill-creator/scripts/quick_validate.py .claude/skills/generate-kb
node .agents/skills/generate-kb/scripts/assess-quality.js 金庸/天龙八部 --report-only --dry-run
git diff --check
```

## Review Gate

开始实现前确认：本次只修 skill 和门禁，不生成或补写任何小说知识库；旧知识库因新门禁失败属于预期结果。
