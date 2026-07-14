# Game KB 类别语义决策与确定性组装

## Goal

在已实现的 `generate-game-kb` 快速分章流程上，把容易失败或语义空转的整书 merge/clean AI 草稿替换为类别级短引用决策与确定性整书组装，并用全新 v2 run 完成《飞狐外传》和《笑傲江湖》的正向验收。

## Background

- 前置任务 `07-14-fast-kb-pipeline` 已建立原文直读、隔离章节 worker、run 级 staging、10 起步并在 429 时按 `10 → 5 → 2 → 1` 退避、候选覆盖、最终 ID、安装及归档等基础合同。
- 《飞狐外传》whole-book 试跑证明，47–69 万字节 JSON 本身不是唯一问题：单次 AI 响应同时承担 1,089 个长键的精确搬运、语义去重、引用改写、人物补全和整书复制，造成三次可解析但合同错误的 merge 草稿。
- clean 草稿对 420 个候选重复使用非法删除原因，并删除 76 个原文明确定名招式；后续 keep-all 草稿满足结构却绕过清理语义。旧 run 只作为负向证据。
- 本任务解决的是通用阶段边界，不为任何书籍增加硬编码特判。

## Dependencies

- 依赖 `07-14-fast-kb-pipeline` 已交付的章节提取、run 隔离、候选 ledger、staging/attempt、worker pool、finalize、verify、install 和 archive-run 合同。
- 开始实现前必须以当前代码和自动化测试为准；旧 unversioned whole-book run 不得被修改成 v2 run。

## Requirements

- 新 run 写入 `semantic_contract_version: 2`，并把版本纳入 merge/clean 工作项输入哈希与最终验证证据。
- 新版 run 不再把整本 `merged/book.json` 或 `cleaned/book.json` 作为 AI 提交单元。AI 只处理 `merge:<category>:<shard>`、可选 `merge:<category>:consolidate`、`clean:<category>:<shard>` 和 `clean:materials:001`。
- `merge:book` 与 `clean:book` 保留为 attempts 为 0 的确定性聚合单元，继续产出现有兼容路径和 JSON 形状。
- AI 可见输入只包含短引用与语义判断所需事实；不得复制原始 `candidate_key`、生成 `local_key`、最终 ID、重写章节摘要或重放未变化的完整实体数组。
- 脚本独占私有 bindings、候选键展开、local key 生成、字段继承、source refs 并集、完整 resolution ledger、清理迁移和整书组装。
- 每个工作项中的成员短引用必须恰好裁决一次；缺失、重复、越界、跨类别或跨工作项引用必须在 accept 前 fail closed。
- 稳定分片上限为每项 120 candidates、96 KiB 序列化 AI 输入；相同输入重复规划必须产生字节相同的短引用、分片边界、文件和哈希。
- 任何类别产生两个以上 shard，或同名组因超限被拆分时，必须创建只读取初步实体摘要的 consolidation 单元处理跨 shard 重复。
- merge 组装必须为全部原候选生成唯一 `merged_to`、`rejected` 或阻断性的 `ambiguous` 去向；章节摘要仍由脚本按 manifest 顺序投影。
- clean 前由脚本生成确定性 obligations，至少覆盖未解决歧义、核心/重要人物详情、低等级人物过度展开、物品准入原因、对白事件存在性/章节/唯一性以及现有 book/ledger 合同错误。
- clean 决策继承 merge ledger：`keep`/`edit` 保持去向，`merge_into` 机械重定向，`drop` 用一个实体级有限原因级联到全部关联候选；AI 不得重新输出全量 ledger。
- 原文明确定名功法/招式和核心/重要人物禁止直接 `drop`；只能保留、修订或有依据地合并到仍存在的同类实体。
- 存在未闭合 obligation 时 keep-all 必须失败；obligation 为空、所有实体显式裁决且合同通过时，零删除可以合法通过。
- 类别单元分别继承最多三次提交、无进展熔断、精确 staging、accepted artifact 不可变和 `manual_review` 终态；单类失败不能清空其他完成类别。
- 确定性规划或组装失败不得消耗 AI attempt，也不得触发自动 reset。
- 缺少 v2 版本的旧 run 只允许 status、证据导出和用户明确确认的 abandoned archive；不得静默升级、reset、继续语义阶段、安装或计入正向验收。
- 最终九类 JSON、game materials、最终 ID、消费者接口、安装与完整 run 归档保持前置任务的兼容合同。
- 只使用 fresh v2 run 对《飞狐外传》和《笑傲江湖》做正向试跑；中篇目标不超过 60 分钟，约 50 章长篇目标不超过 90 分钟，并分别记录 AI、脚本、补漏和人工等待耗时。
- 不修改 `.agents/skills/generate-kb/`。

## Acceptance Criteria

- [ ] 新 run 的 AI 提交清单中不存在 `merge:book` 或 `clean:book` 整书语义草稿；二者仅作为 attempts 为 0 的确定性组装单元。
- [ ] 1,089 个真实形状候选键的回归夹具只把短引用交给 AI 草稿，组装后仍得到 1,089 条且每键恰好一条 resolution；任一短引用缺失、重复或跨工作项都会阻断对应类别。
- [ ] 420 个关联候选的删除回归只要求一个实体级有限原因，脚本机械生成 420 条合法 rejected 去向，不重复放大错误。
- [ ] 清理失败只重试受影响的 `clean:<category>:<shard>`；已接受的其他类别、merge 结果、逐章结果和 staging 预算保持不变，三次失败后不自动 reset。
- [ ] 清理空操作只有在 obligations 为空、所有实体显式裁决且清理后合同通过时才合法；存在缺 biography、悬空对白、多对白或未解决歧义时 keep-all 稳定失败。
- [ ] 合并/清理工作项按候选数和序列化字节数稳定分片；同一输入重复 prepare 产生字节相同的计划、短引用、分片边界和输入哈希。
- [ ] 命名功法/招式及核心/重要人物的直接 drop 被确定性拒绝。
- [ ] 类别失败隔离、精确 staging、上下文恢复、429 退避和 accepted artifact 不可变都有自动化回归。
- [ ] 旧 whole-book run 不会被新版代码原地升级或重置；失败草稿与时间线仍可审计。
- [ ] v2 类别流程能继续生成与现有消费者兼容的九类 JSON、game materials、质量报告、安装结果和完整 run 归档。
- [ ] 《飞狐外传》和《笑傲江湖》均由“调用 Skill + 书籍目录”启动 fresh v2 run；两书候选 closure、清理决策、质量结果、安装哈希、归档哈希和分阶段耗时均有证据。
- [ ] 《笑傲江湖》的重要物品不再无解释归零，对白覆盖门禁和不可挪用抽样配额有实际证据；《飞狐外传》使用同一通用流程。
- [ ] `.agents/skills/generate-kb/` 的 git diff 为空。

## Out Of Scope

- 修改或弱化 audit-grade `generate-kb`。
- 重写逐章原文阅读、章节 worker、最终 ID、九文件 schema 或安装接口。
- 把旧 whole-book run 静默升级成 v2，或继续 reset 旧 run 以制造绿色结果。
- 为《飞狐外传》《笑傲江湖》或其他单书写专用实体、数量或章节特判。
- 追求 100% 长尾召回或新增通用发布状态机。

## Notes

- 旧 run 是不可变负向证据；只有 fresh v2 run 能勾选正向验收项。
- 本任务在规划状态创建，不会切换或阻断当前旧任务的收尾。
