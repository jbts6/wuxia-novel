# generate-game-kb 速度与重点质量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `generate-game-kb` 的逐类别重复后处理收敛为确定性候选注册表与四域联合语义决策，并用《雪山飞狐》证明中短篇 fresh v2 可在 45 分钟目标、60 分钟硬上限内完成。

**Architecture:** 保留章节隔离 Worker、主线程串行 accept、稳定 ID、引用闭包和九类 JSON 合同。章节候选先进入高置信机械注册表，再由剧情、武学、物品、世界四个领域各做一次合并与清理决策，最后确定性组装、仅对高优先级缺口做定向 recall，并通过分层质量门安装归档。

**Tech Stack:** Node.js CommonJS、`node:test`、JSON Schema 风格控制器校验、Trellis、CodeGraph CLI。

## Global Constraints

- 不修改 `.agents/skills/generate-kb/`。
- 每章由一个隔离原生 Worker 完整读取；Worker 只写 run-scoped staging 草稿，主线程串行 accept。
- 主线程之外最多 3 个 Worker；逐章和互不依赖的领域单元共享这个上限。
- 《雪山飞狐》必须 fresh v2 冷启动，不复用旧 `data/` 或旧 run 内容。
- 高优先级类别固定为角色、武功、招式、关键物品和事件；地点、势力、普通对白采用软门。
- 四个领域正常路径各一个初始 AI 单元；每域最多一次格式修正和一次语义补救。
- `chapter_summaries` 机械投影，AI 尝试数为 0。
- 九类最终 JSON、稳定 ID、原文章号证据、引用闭包、安装和归档合同保持兼容。
- 自动化结果必须如实区分本任务回归与已知 Windows archive/symlink 基线失败。

---

## Task 1: 固化 fast-domain profile 与三 Worker 运行合同

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/worker-pool.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-isolation.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/worker-pool.test.js`

- [ ] 写失败测试：新 run 持久化 `semantic_contract_version: 2` 与显式 `semantic_profile: domain-distill-v1`，旧 v2 无 profile run 只能作为只读证据，不能原地恢复到新工作流。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/run-isolation.test.js`，确认新断言按预期失败。
- [ ] 写失败测试：新 run 的 Worker 并发上限为 3，429 退避保持持久、按批次有界且不消耗语义 attempt。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/worker-pool.test.js`，确认默认 10 的旧实现导致失败。
- [ ] 最小实现 profile 隔离、run 路径和三 Worker 默认值；不得改变既有归档证据的可读性。
- [ ] 复跑两个测试文件并保持全绿。

## Task 2: 建立确定性候选注册表

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- Create: `.agents/skills/generate-game-kb/tests/candidate-registry.test.js`
- Reuse: `.agents/skills/generate-game-kb/scripts/lib/candidate-ledger.js`
- Reuse: `.agents/skills/generate-game-kb/scripts/lib/source.js`

- [ ] 写失败测试覆盖九类章节候选的注册、名称机械规范化、精确同名合并、证据并集、旧候选 ID 到注册项 ID 的迁移。
- [ ] 写失败测试证明同名异类、近似名、冲突身份进入 `pending`，不能被相似度规则静默合并或删除。
- [ ] 写失败测试证明事件参与者、对白事件、招式所属武功、关键物品关联引用随迁移表一起重写，且一对多/零目标直接失败。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/candidate-registry.test.js`，确认模块缺失导致 RED。
- [ ] 最小实现 `buildCandidateRegistry(chapters)` 与稳定序列化输出；复用既有候选 ledger 和 source-ref 规范，不引入第三方依赖。
- [ ] 复跑测试，确认候选数、pending 数、证据数和迁移闭包均为确定性结果。

## Task 3: 将九类候选路由为四个有界领域工作项

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Create: `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/paths.js`

- [ ] 写失败测试固定类别映射：剧情域 characters/events/dialogues，武学域 skills/techniques，物品域 items，世界域 factions/locations。
- [ ] 写失败测试证明每域只生成 `distill:<domain>` 一个初始工作项，输入含注册项、pending、允许修改字段、引用摘要和输入哈希，不泄漏控制器私有键。
- [ ] 写失败测试覆盖实际序列化字节上限：常规书不分片；单域超限必须给出显式 `DOMAIN_INPUT_TOO_LARGE`，不得静默截断或退回逐类别循环。
- [ ] 写失败测试证明互不依赖的领域可并发生成草稿，但 progress 中的 accept 仍只能由主线程串行推进。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/domain-work.test.js`，确认 RED。
- [ ] 最小实现领域工作计划、稳定输入哈希与私有 binding；保持现有 `semantic-work.js` 的通用原子写入/陈旧轮换机制。
- [ ] 复跑测试，确认四域、四工作项、稳定字节与幂等落盘。

## Task 4: 定义联合 distill 决策合同与有界 accept

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Create: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/progress.js`

- [ ] 写失败测试：领域草稿对每个注册项恰好给出 keep/merge/reject/pending 决策，别名合并、噪音删除、证据合并和允许字段补丁在同一单元完成。
- [ ] 写失败测试：武学域同步校验 skills/techniques 从属，剧情域同步校验 characters/events/dialogues 引用，物品域只能使用有限保留/拒绝原因。
- [ ] 写失败测试：控制器键、未知 ref、跨领域修改、普通动作伪装招式和普通物品无理由保留均被拒绝。
- [ ] 写失败测试：`distill:*` 沿用 3 次总提交预算，最多表现为初始提交、一次格式修正、一次语义补救；相同输出/错误和 A-B-A 仍提前 `manual_review`。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/domain-contract.test.js .agents/skills/generate-game-kb/tests/progress.test.js`，确认 RED。
- [ ] 最小实现领域草稿校验、accept 路由、decision 文件和输入哈希绑定。
- [ ] 复跑测试，确认非法草稿不污染 accepted/progress，合法草稿一次接受。

## Task 5: 用四域决策确定性组装九类书对象

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/domain-assembly.js`
- Create: `.agents/skills/generate-game-kb/tests/domain-assembly.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`

- [ ] 写失败测试：四域决策与私有 bindings 组装回 characters/events/dialogues/skills/techniques/items/factions/locations，所有迁移前候选恰好闭合到最终记录或有限拒绝原因。
- [ ] 写失败测试：模糊 pending、丢失决策、重复目标、悬空参与者/武功/事件/物品引用均阻断组装且不修改既有 plan。
- [ ] 写失败测试：`chapter_summaries` 按 manifest 顺序从事件、关键人物和结果机械投影，整个类别不创建 AI work item。
- [ ] 写失败测试：正常路径保留确定性 `merge:book` / `clean:book` attempts=0 兼容标记，但不创建任何逐类别 merge/clean/materials 草稿。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/domain-assembly.test.js .agents/skills/generate-game-kb/tests/book-contract.test.js .agents/skills/generate-game-kb/tests/finalize.test.js`，确认 RED。
- [ ] 最小实现领域组装与旧九类输出适配，优先复用现有稳定 local_key、最终 ID 和引用投影函数。
- [ ] 复跑测试，确认乱序输入下输出字节稳定。

## Task 6: 改造 CLI 路由并移除重复语义阶段

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/tests/cli.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`

- [ ] 写失败 CLI 测试：章节全部接受后，`prepare-merge` 机械创建候选注册表与四个 `distill:*` 单元；events/dialogues 不再形成串行类别链。
- [ ] 写失败 CLI 测试：四域 accepted 后 `assemble-merge` 组装语义结果，`prepare-clean` 返回零 AI 单元，`assemble-clean` 只做确定性最终兼容投影。
- [ ] 写失败集成测试：三章 fixture 的 AI 单元只有 chapters、四域和 quality，逐类别 `merge:*:<shard>`、`merge:*:consolidate`、`clean:*:<shard>`、`clean:materials:001` 均不存在。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/cli.test.js .agents/skills/generate-game-kb/tests/integration.test.js`，确认 RED。
- [ ] 最小改造 `prepareMerge`、`assembleMerge`、`prepareClean`、`assembleClean` 和状态输出；保留已有 CLI 命令名以降低操作迁移成本。
- [ ] 复跑测试并确认恢复同一 run 时 work item 字节、输入哈希和完成状态不变化。

## Task 7: 实现高低优先级质量门与定向 recall

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/gaps.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/quality.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`
- Modify: `.agents/skills/generate-game-kb/tests/targeted-recall.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/quality.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`

- [ ] 写失败测试：角色、skills、techniques、关键 items、events 的候选/引用/证据缺口是 blocking；factions、locations、普通 dialogues 的非结构性缺口是 warning。
- [ ] 写失败测试：武功/招式混淆、普通动作进入招式、普通物品进入关键物品、关键事件缺参与者或结果均阻断 verify。
- [ ] 写失败测试：只有失败的高优先级类别产生 `recall:<category>`，世界域和普通对白不产生 recall；recall 接受后只更新对应注册/领域投影，不重跑四域。
- [ ] 写失败测试：重点质量样本维持 95% 原文支持率硬门，低优先级样本不足只记录 warning。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/targeted-recall.test.js .agents/skills/generate-game-kb/tests/quality.test.js .agents/skills/generate-game-kb/tests/integration.test.js`，确认 RED。
- [ ] 最小实现优先级分类、原因码、warning 输出和有界 recall 路由。
- [ ] 复跑测试，确认失败只触发局部补救且不会重置已完成领域 attempt。

## Task 8: 增加阶段计时与 AI 工作量指标

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/timing.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/archive.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/tests/run-archive.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`

- [ ] 写失败测试：run/archive 指标包含 prepare、chapter_extraction、registry、domain_distill、targeted_recall、quality、install、archive、total 的墙钟耗时。
- [ ] 写失败测试：按 unit type 统计 planned/done/attempts/format_repairs/semantic_remedies，并记录最大 AI 输入字节和各阶段候选数变化。
- [ ] 写失败测试：恢复后统计幂等，脚本自身耗时与 AI/human wait 分离；缺少阶段时为 0 而不是伪造时间。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/run-archive.test.js .agents/skills/generate-game-kb/tests/integration.test.js`，确认 RED。
- [ ] 最小扩展 timing/run/archive 元数据与机器可读 run metrics 文件。
- [ ] 复跑测试，确认 archive receipt 与 run metrics 一致。

## Task 9: 更新 Skill、提示词、Schema 和可执行规范

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Create: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

- [ ] 先写失败的 Skill 合同测试，要求主模型自主路由 fresh profile、3 Worker、四域并发草稿/串行 accept、零逐类别后处理、重点质量门、定向 recall、计时归档和有界补救。
- [ ] 运行 `node --test .agents/skills/generate-game-kb/tests/skill-contract.test.js`，确认旧 Skill 文案失败。
- [ ] 最小更新 SKILL：删除旧 merge/clean 循环的操作路径，主流程控制语句保持简洁；详细 JSON 合同下沉到 `schemas.md` 和单一领域 prompt。
- [ ] 在 `schemas.md` 给出一个完整四域草稿示例和有限 reason 枚举，不复制九份近似模板。
- [ ] 更新后端质量规范，明确 fast-domain profile 与托管 G1-G5 流程的边界、重点硬门和低优先级 warning。
- [ ] 复跑 Skill 合同测试，并执行 Skill frontmatter/链接/占位符/命令路径检查。

## Task 10: 全量回归与《雪山飞狐》fresh v2 速度验收

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/integration.test.js`
- Create: `.trellis/tasks/07-15-game-kb-speed-quality/evidence/xueshan-run-report.json`
- Create: `.trellis/tasks/07-15-game-kb-speed-quality/evidence/xueshan-quality-audit.json`
- Create: `.trellis/tasks/07-15-game-kb-speed-quality/evidence/README.md`
- Modify: `.trellis/tasks/07-15-game-kb-speed-quality/prd.md`
- Modify: `.trellis/tasks/07-15-game-kb-speed-quality/implement.md`

- [ ] 运行聚焦测试：`node --test .agents/skills/generate-game-kb/tests/candidate-registry.test.js .agents/skills/generate-game-kb/tests/domain-work.test.js .agents/skills/generate-game-kb/tests/domain-contract.test.js .agents/skills/generate-game-kb/tests/domain-assembly.test.js`。
- [ ] 运行 Skill 全套：`node --test .agents/skills/generate-game-kb/tests/*.test.js`，用 context-mode 只提取通过/失败/跳过计数和失败原因；保留已知 Windows 基线说明。
- [ ] 对所有修改的 JS 执行 `node --check`，执行 `git diff --check`，运行 CodeGraph `sync` 与 `affected` 核对漏测影响面。
- [ ] 对 `金庸/雪山飞狐` 执行一次 `archive-existing`，确认根目录仅余唯一原文、`ch_split/`、`_archive/`，再 fresh prepare；禁止重复归档和循环 status。
- [ ] 按 3 Worker 批次完成 10 章隔离提取，主线程串行 accept；按最多 3 Worker 完成四域草稿，主线程串行 accept。
- [ ] 完成确定性组装、重点覆盖检查、必要的局部 recall、质量抽样、build-final、verify、install、installed verify 和 archive-run。
- [ ] 写入真实 run ID、profile、阶段耗时、AI 单元/attempt、最大输入字节、候选变化、重点类别计数、抽样证据、installed hash 和 archive hash。
- [ ] 若总耗时 `<=45m` 勾选目标；`45m < elapsed <=60m` 只判定硬门通过并记录目标未达；`>60m` 或重点质量失败则验收失败，不得美化结论。
- [ ] 压缩可展开 run 产物，只保留最终证据、必要审计文件和可验证归档，确保仓库不留下大量中间文件。
- [ ] 完成 Trellis 全范围检查，更新 PRD/implement 勾选状态，按逻辑批次提交并恢复干净工作区。
