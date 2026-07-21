# 实施 — 简化 `generate-game-kb`

有序执行计划（trellis 阶段：implement）。

## 1. flow.js 命令面
- [x] 删除 `guard-open`、`guard-check`、`submit-draft`、`check-draft`、`recover-draft`、
      `worker-backoff`、`migrate-legacy`、`import-chapters`、`refresh-domain-work`、
      `basic-curate`，以及所有 `lite-*` 别名。
- [x] 新增 `extract-plan`（扁平章节单元）与 `submit`（stdin 信封）。
- [x] 新增 `run` 编排循环。

## 2. lib 清理
- [x] 删除 `worker-guard.js`、`chapter-batching.js`、`legacy-*.js`、`submission-journal.js`、
      `draft-recovery.js`、`audit-v6.js`。
- [x] 将 `worker-pool.js` 简化为 5→3 计数器。
- [x] 精简 `semantic-contract.js`（移除旧 profile 分支；单一语义合同 + `--deep`）。
- [x] `verify.js` / `assemble.js`：仅保留 `source_hash` + `final_data_hash` 硬门禁。
- [x] `submit` 仅保留普通命令内输入校验（信封形状、schema 版本、unit/attempt/input-hash 身份）——无独立前置阶段。

## 3. 技能文档
- [x] 撰写单一 `generate-game-kb/SKILL.md`（中文）。
- [x] 删除 `SKILL-cn.md`、`generate-game-kb-lite/`、`generate-game-kb-deep-*/`。
- [x] 更新 `examples.md`、`prompts/extract-chapters.md`。

## 4. 测试
- [x] 移除旧前置阶段、分组、legacy、broker、knowledge-base 测试。
- [x] 新增契约测试：扁平 `extract-plan`、五宽并发、两哈希门禁、真实语料 20 个扁平单元、
      以及普通 `submit` 输入校验（畸形/身份不符的信封抛出 `SUBMISSION_*_INVALID`，且不写
      staging/accepted 证据）。
- [x] 新增**高召回**测试：章节单元被要求逐章穷尽扫描、具名实体（含一次性出场/别名/化名/显名
      招式/具名物品势力）作为候选抽出并各自绑定 `source_refs`、抽取阶段不主动合并/去重。
- [x] 新增**低召回门禁**测试：≥5 章小说若最终四文件去重实体总数 ≤9，必须以 `LOW_RECALL`
      使工作区验证失败并阻断归档；重抽达标后才通过；<5 章短篇豁免。

## 5. 冒烟
- [x] 用 `古龙/剑神一笑` 端到端跑通整条新管线。

## 校验
- 新测试通过；真实语料产出恰好五个已安装 YAML 文件。
- `quality-guidelines.md` 与新命令面匹配（无 guard/batch/lite-*/migrate-legacy）。
