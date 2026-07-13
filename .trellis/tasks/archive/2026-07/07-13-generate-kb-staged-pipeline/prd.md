# 重构 generate-kb 阶段化流程与硬门禁

## Goal

把 `generate-kb` 从依赖 AI 自觉遵守的长流程，重构为可暂停、可恢复、不可越级的阶段化流水线。每个阶段只接收约定输入、写入约定产物，并由代码门禁决定能否进入下一阶段；最终 ID、正式 JSON 和完成报告只能在所有语义工作通过后发布。

用户价值：降低长篇小说知识库生成时的目标漂移、机械补字段、滥用豁免、错误分类和报告假通过，使换一个 AI 或跨会话继续执行时仍能得到相同的阶段约束。

## Background

- 当前四阶段把候选归并、分类、丰富字段、正式 ID 和最终 JSON 集中在 `Reconcile And Enrich`，单阶段负担过大。
- 《天龙八部》重建暴露了可重复的失败模式：AI 优先修正式 ID；主要人物只进入事件而未进入角色；对白只覆盖前段章节；核心人物被通用理由批量豁免；多个字段共用同一条弱证据；穴位、经脉和茶花进入错误类别；最终验证报告 hash 过期但 G1-G5 仍显示通过。
- 当前校验器主要验证字段存在、枚举、引用命中和账本闭环，没有充分验证字段内容质量、证据是否支持对应字段、豁免是否可信、扫描窗口是否实际产出。
- 现有 `.agents/skills/generate-kb/tests/` 已覆盖最终数据契约、流水线集成、质量门禁、审核就绪和 source ledger，但 `collectEvidenceIntegrity`、`collectSemanticCoverage` 等关键语义路径缺少针对上述失败模式的回归测试。
- `.agents/skills/generate-kb` 与 `.claude/skills/generate-kb` 当前各有 59 个文件且内容完全一致，但它们是两份独立目录而非软链接；历史任务同时引用两条路径，后续存在实现漂移风险。
- 当前《天龙八部》产物和历史任务只作为失败回归证据，不作为新知识库的生成输入。

## Requirements

### R1. 六阶段模型

流程必须拆成以下六个有序阶段，阶段名称及职责保持稳定：

1. `prepare`：原文、章节、窗口和 source hash。
2. `inventory`：只从原文窗口提取候选和章节摘要草稿。
3. `reconcile`：候选归并、canonical name、最终类别和重要性；不生成正式 ID。
4. `enrich`：生成无正式 ID 的丰富草稿及字段级证据。
5. `semantic-audit`：检查主要角色召回、对白 speaker、语义豁免、字段证据、类别和事件参与者。
6. `publish`：生成正式 ID、统一重写引用、写入八类正式 JSON，并生成同一 hash 下的全部报告。

### R2. 持久状态与恢复

- 每本书必须维护机器可读的流水线状态，记录当前阶段、各阶段状态、输入 hash、输出 hash、失败原因和唯一允许的下一阶段。
- `inventory`、`reconcile`、`enrich` 等大阶段必须维护有稳定 ID 的 work item 队列，记录每项的 pending/claimed/submitted/accepted/failed 状态、尝试次数、输入 hash、输出 hash 和 receipt。
- 任何 AI 或新会话必须先读取状态，只能执行当前允许的阶段。
- 每次执行只能处理状态机给出的下一个 work item；不得由 AI 自选范围或一次吞掉整阶段。
- 原文或上游产物变化后，下游阶段必须自动失效，不得沿用旧 PASS。
- 重跑同一阶段必须可重复且不得隐式推进到下一阶段。

### R3. 阶段输入隔离

- `inventory` 不得读取现有 `data/*.json`、旧 baseline 或百科资料。
- `reconcile` 和 `enrich` 只能读取当前 source hash 下的候选、窗口和本轮草稿。
- `prepare` 到 `semantic-audit` 不得创建正式 ID 或写入正式 `data/*.json`。
- 旧正式数据只能进入隔离归档或测试 fixture，不得作为新草稿模板。

### R4. 阶段硬门禁

- `prepare`：source/chapter 对齐、窗口完整性和 hash 一致。
- `inventory`：每个窗口记录实际输出数量、输出 hash；空输出必须记录结构化原因。仅登记 `completed_window_ids` 不算完成。
- `reconcile`：按候选簇或稳定批次执行；所有候选闭环；主要事件参与者和强人物信号必须形成角色候选或有证据化处理；skill/technique/item 分类规则可执行。
- `enrich`：按类别与稳定实体批次执行；复杂字段内容达到契约要求；禁止占位句、同义反复和模板描述；三个或以上语义不同字段完全复用同一组引用时默认以 `evidence_padding` 阻塞。
- 合法共享证据必须提交结构化 `shared_evidence_justification`，逐字段说明同一原文中的哪项事实支持哪个字段；通用、循环、无法对应原文或用于掩盖模板内容的说明不得放行。
- 共享证据说明必须进入 semantic audit 和高风险证据检查，不能仅由 enrich 提交者自行批准。
- `semantic-audit`：persona/both 对话必须有真实 speaker；`speaker_name` 不得为“未知”；主要角色有原文对白时不得使用 persona 豁免；豁免必须包含可定位证据和具体原因；事件参与者必须有角色记录或合法豁免；穴位、经脉、普通动作、外号、普通花名及无剧情作用物品不得进入错误类别。
- `publish`：只接受通过 semantic audit 的草稿；正式 ID 在此阶段一次生成；所有引用统一重写；全部报告必须携带并匹配当前 `final_data_hash`。

### R5. 失败即停止

- 任一阶段门禁失败时命令必须非零退出，状态保留在当前阶段，并输出可执行的失败清单。
- 禁止用数量、总分、审核就绪状态或人工检查补偿硬门禁失败。
- reconcile 后的中途人工状态必须命名为 `awaiting_recall_review`，不得复用暗示整库完成的 `ready_for_human_review`；若保留最终审核就绪状态，只能在全部自动门禁通过后出现。

### R6. 人工审核可追踪

- 所有人工动作必须通过总控 CLI 写入机器可读 receipt；聊天中的口头确认不能作为流水线状态。
- 高风险裁决上限可配置，默认最多 15 个；用户可以按精力把上限降到 10 个或更低。
- 超过当前配置上限时必须由 AI 继续复核、修正或确定化，审核包不得截断后把未展示的高风险项留在流程外。
- 人工选择及备注必须绑定 source hash、reconcile output hash 和裁决标识；任一绑定对象变化后 receipt 自动失效。
- 人工确认不能掩盖未通过的自动语义门禁。
- 有效的中途 receipt 已覆盖召回和高风险裁决时，发布后不再强制第二次逐项人工审核；最终摘要仍可供人工查看。

### R7. 回归测试

至少为以下失败模式增加自动测试：

- 窗口标记完成但没有产出记录或空输出原因。
- 主要角色只出现在事件名称中，未形成角色记录。
- persona/both 对话 speaker 为空、未知或不存在。
- 有明显原文对白的主要角色被通用理由豁免。
- 多个 enrich 字段全部复用同一条引用。
- `X。`、`X的招式。`、`X的来历不明。` 等占位内容通过 schema。
- 一阳指进入 technique；穴位进入 techniques；经脉进入 skills；普通茶花被标成兵器或剧情物品。
- `final_data_validation`、verification、cross-validation 或质量报告使用过期 hash。
- 未通过前置阶段时直接执行 publish。
- 上游 hash 变化后仍沿用下游 PASS。

### R8. 文档与执行入口

- `SKILL.md`、`pipeline.md`、schemas、prompts、CLI 帮助和测试必须描述同一套阶段语义。
- 执行入口必须告诉 AI 当前阶段、允许操作、禁止操作、门禁命令和停止条件，避免一次加载整条长流程后自由发挥。
- `.agents/skills/generate-kb` 是唯一真实实现目录；`.claude/skills/generate-kb` 必须改为指向它的软链接，避免两份流程漂移。

### R9. 唯一写入入口

- 新的总控 CLI 是生成流程唯一受支持的写入入口。
- 旧脚本可以保留为内部实现、纯函数库或只读诊断入口；涉及阶段产物、状态推进、正式数据和报告写入时，必须由总控 CLI 调用。
- 直接调用旧写入脚本绕过状态时必须拒绝执行，并由回归测试证明无法旁路。
- 总控 CLI 的一次调用最多执行当前允许的一个阶段，不得自动串行跑完整本书。

### R10. 受控 work item 提交

- AI 批次必须使用 `claim -> draft -> submit` 协议。
- `claim` 只能领取状态机确定的下一 work item，并生成绑定 stage、work item ID 和 input hash 的只读任务包。
- AI 只允许写入该 work item 对应的非受管 draft；不得直接编辑 pipeline state、候选账本、decision ledger、受管阶段产物、正式数据或报告。
- `submit` 必须验证 stage、work item ID、input hash、schema、证据与阶段规则；验证通过后才由 CLI 原子合并到受管产物并生成 receipt。
- 提交失败不得部分写入受管产物；错误和尝试次数写入 work item 状态，支持修正同一 draft 后重交。
- 非当前 work item、陈旧 hash、重复提交和跨阶段提交必须拒绝。

### R11. 长篇召回人工检查点

- 长篇小说在 `reconcile` 通过后、`enrich` 开始前必须暂停，生成紧凑的 recall review packet。
- 审核包只展示拟定核心/重要角色、主要事件、主要武功、章节覆盖异常和自动发现的疑似漏项，不展示全量 candidates/decisions。
- 审核包同时展示不超过当前配置上限的高风险 reconcile 裁决；人工动作至少包含 `accept_recall`、`rerun_recall` 及每个高风险项的结论，并保存绑定 source hash、reconcile output hash 和审核人的机器可读 receipt。
- 人工补充的名称只作为下一轮原文检索锚点；未经原文扫描、candidate、decision 和证据闭环不得直接进入草稿。
- 中短篇在自动召回门禁通过时可以不强制暂停；若自动异常或未决高风险项存在，仍可触发同一检查点。
- 未取得有效 recall receipt 时，长篇小说不得 claim 任何 enrich work item。

### R12. 原子发布与回滚

- `publish` 必须先在独立 staging bundle 中生成八类正式 JSON、全部报告和 bundle manifest，不得边生成边覆盖当前正式版本。
- staging bundle 必须有唯一 bundle hash，并在目录内完成 schema、enrichment、semantic、cross-reference、source grounding 和所有报告 hash 一致性校验。
- 任一校验失败时不得修改当前正式 `data/`、`reports/` 或当前版本指针。
- promote 必须校验开始发布时记录的当前正式版本 hash；检测到其他 AI 或进程修改时拒绝覆盖。
- 正式版本存放于 `.kb/versions/<bundle-hash>/{data,reports}`；`.kb/current` 是唯一可变版本指针，逻辑 `data/` 与 `reports/` 是分别指向 `.kb/current/data`、`.kb/current/reports` 的兼容软链接。
- promote 通过原子替换 `.kb/current` 一条软链接同时切换数据和报告；现有消费者继续使用 `data/*.json` 与 `reports/*.json`，不需要感知物理目录变化。
- 首次迁移必须把现有真实 `data/`、`reports/` 完整封装为一个 legacy bundle 后再创建兼容软链接，不得丢失或混合用户文件。
- 旧版本保留在包含 source hash、final data hash、bundle hash 和创建时间的版本 manifest 中。
- 必须提供可验证的 rollback 操作；rollback 本身也要检查目标归档完整性并生成审计 receipt。

### R13. 受限并发与租约

- 默认并发数为 1，用户可配置到最多 4。
- 只有 `inventory` 的不同窗口 work item 与 `enrich` 的不重叠实体 work item 可以并发 claim。
- `prepare`、`reconcile`、人工检查点、`semantic-audit`、`publish`、promote 和 rollback 必须独占执行。
- 并发 claim 必须记录 worker ID、lease ID、领取时间与过期时间；只有租约过期或显式释放后才能由其他 worker 回收。
- draft、submit validation 和 receipt 按 work item 隔离；阶段合并按稳定 work item ID 确定性排序，不依赖提交先后。
- 上游 hash 或阶段版本变化时，所有未提交租约与 draft 必须失效。

## Acceptance Criteria

- [ ] 存在一个机器可读的六阶段状态契约，能够初始化、检查、推进、失败和使下游失效。
- [ ] 每个阶段都有独立命令或明确的命令模式，且不能跳过前置阶段。
- [ ] 大阶段具有稳定 work item 队列；单次执行只领取和提交一个 work item，并可从中断处确定性恢复。
- [ ] 默认只允许一个活动 worker；配置并发时仅 inventory/enrich 可同时 claim，且租约回收、确定性合并和上游失效均有测试。
- [ ] `publish` 前不会产生正式 ID 或覆盖 `data/*.json`。
- [ ] inventory receipt 能证明每个窗口的实际产出或结构化空输出原因。
- [ ] enrich 与 semantic audit 能阻塞《天龙八部》本轮暴露的机械证据、占位内容、过宽豁免和错误分类样本。
- [ ] 三个以上字段机械复用同一引用会失败；真实共享证据只有在逐字段说明通过独立 semantic audit 后才能放行。
- [ ] 所有正式报告绑定同一个当前 `final_data_hash`；任一陈旧报告都会使完成门禁失败。
- [ ] staging bundle 任一验证失败时正式版本保持逐字节不变；通过后可原子 promote，并可从完整归档回滚。
- [ ] `data/` 与 `reports/` 通过同一个 `.kb/current` 版本指针解析；切换指针时二者始终来自同一 bundle。
- [ ] 人工审核结果可持久化和复核，但不能覆盖自动门禁失败。
- [ ] 高风险人工队列默认不超过 15 项且可降到 10 项；超过配置上限时流程返回 AI 复核而非截断队列。
- [ ] 长篇 reconcile 结束后会强制暂停；没有绑定当前 reconcile hash 的 `accept_recall` receipt 时无法进入 enrich。
- [ ] 所有生成写入均经过总控 CLI；旧脚本无法绕过阶段状态直接修改受管产物。
- [ ] `claim -> draft -> submit` 可阻止陈旧、越权、重复或跨阶段的 AI 输出污染受管产物。
- [ ] `.claude/skills/generate-kb` 是指向 `.agents/skills/generate-kb` 的软链接，测试能检测链接被替换为漂移副本的情况。
- [ ] 现有合法 generate-kb fixture 仍能通过，新失败 fixture 均按预期失败。
- [ ] 相关 Node 测试、集成测试和文档一致性检查全部通过。
- [ ] 当前《天龙八部》正式数据不会在本任务中被修补或作为生成输入。

## Out of Scope

- 使用新流程重新生成《天龙八部》知识库；这将在流程实现并验证后建立独立 Trellis 任务。
- 修补当前《天龙八部》的正式 JSON 或伪造报告通过状态。
- 修改 dashboard 消费接口或增加第九类正式数据文件。
- 以外部百科、模型先验或旧最终 JSON 代替小说原文证据。
