# 彻底简化 `generate-game-kb` 章节运输层

## Goal

继续采用减法，把章节 Worker 到 controller 之间的 envelope/stdin/submit 运输层整体移除，使 Claude Code 与 WorkBuddy 都能依靠最基础的“派发子代理 + 读写唯一文件”能力运行；正常运行不得要求 AI 临时创建清洗、修复、拆分或批量提交脚本。

## Background

- `generate-game-kb` 早期多轮迭代持续增加 batch、guard、broker、迁移、重试和严格运输协议，实际使用曾寸步难行。
- 最近两轮减法删除了大部分旧机制，流程已经能够运行，但仍保留“Worker 零写入 -> 返回 envelope -> 主代理经 stdin 调用 submit”的运输链。
- Claude Code 已关闭；《萧十一郎》v6 run 曾完成约一半，相关现象已记录。用户于 2026-07-21 手动删除该 run，准备在 v7 实施完成后从头重跑；实现与测试不得依赖或重建旧现场。
- WorkBuddy 已关闭；《陆小凤传奇》现有 v6 run 已完成，但最终实体未执行有效跨章去重，并曾产生 `.kb-scratch` 下的 raw JSON、清洗脚本和批量提交脚本。根因已记录，用户于 2026-07-21 手动删除 `.kb-scratch`；该目录不作为新合同迁移输入，也不得由新流程重建。
- `flow.js run` 当前只推进确定性 controller 阶段并返回需要 AI 驱动的下一阶段；`worker-pool.js` 只保存并发数字，不执行调度。
- Claude Code 的首次真实运行曾连续按每组 5 个派发全部 25 章，没有等待前 5 个中的任何一个完成；这证明仅在 prompt 中声明“并发 5”不能形成实际上限。
- WorkBuddy 已完成《陆小凤传奇》v6 默认模式，最终得到 1051 个角色、112 项武功、246 件物品、218 个势力。精确名称分析显示：角色只有 293 个唯一名称（758 条为重复名称行），武功 84 个（28 条重复），物品 180 个（66 条重复），势力 99 个（119 条重复）。
- 根因是默认 `buildBasicCandidateRegistry`/`assembleGroundedBook` 没有执行跨章实体归并：同一规范名称下的每个章节候选仍注册为独立实体，随后默认模式清空待决合并组并逐条投影到终态。
- 当前 ID hash 泛滥是上述重复实体的连锁结果：同名候选产生相同 base key 后，每个候选按其 candidate keys 获得独立 collision suffix；最终拼音 ID 再为同 base 冲突分配 disambiguator。

## Requirements

### R1. 删除章节运输层

- 删除章节 Worker envelope 外壳、Worker 侧 attempt/unit/input-hash 身份复制和 stdin 交接要求。
- 删除主代理逐章调用 `submit` 的职责；不得用新名称保留等价运输层。
- 删除章节结果清洗、证据修补、手工 reset、手工删除 controller 私有文件等补救路径。

### R2. 单章唯一写入

- controller 为每个章节单元签发唯一、确定的只读输入文件和唯一、run-scoped 的 staging YAML 输出文件。
- 每个章节 Worker 只读取该章输入，只能写入该单元的唯一输出文件；不同章节之间无共享写入目标。
- Worker 直接写章节 draft YAML，不再返回或落盘 envelope；draft 顶层就是章节 schema，不包含 unit/attempt 等运输字段。
- 后续 `run` 自动发现当前 attempt 的预期 staging YAML，并通过 controller 现有的文件接收事务完成解析、校验、失败稿归档、accepted 写入和进度更新。
- Worker 输出不合格时由 controller 拒绝并隔离，随后重新派发该章；主代理不得修改 Worker 内容后重新提交。
- 每个章节单元最多自动尝试两次：第一次失败后可自动重派，第二次失败后整个 run 必须停在 `manual_review`。
- `manual_review` 后只有用户明确批准，controller 才能为该章开启新的两次尝试周期；主代理不得自行 reset、重开周期或用修补后的输出消耗新尝试。
- controller 不得通过删除校验失败的实体、替换证据、重写摘要或其他语义删改来接受原本不合格的章节；任何语义或证据错误都拒绝整章。
- 第一次失败若错误全部属于 YAML 缩进、引号、代码围栏、明确空数组等机械问题，controller 可标记 `repair_allowed: true`；主代理只能根据拒绝稿和错误报告写 attempt 2，不得读取小说原文或修改语义字段。
- 主代理机械修复必须记录原稿/修复稿哈希、错误码和 `producer: main-agent-repair`，并占用第二次 attempt；修复后仍失败即进入 `manual_review`。
- 实体、关系、描述、摘要、证据、未知/歧义类型等错误必须重新派发章节 Worker，不允许主代理修复。
- controller 必须持久化已签发但尚未产生输出的章节单元，并把“同时在途单元最多 5 个”实现为状态不变量，而不是 Skill 建议。
- controller 使用固定窗口：一次选择最多 5 个独立章节单元作为 `active_units`，不创建 `batch_id` 或共享提交身份。
- 当前 `active_units` 全部完成以前，不得签发窗口外章节；没有待重试的窗口内 job 时，`run` 必须返回无新 job 的 `waiting` 状态。
- 重复调用 `run` 不得签发后续章节或同章重复 job；一个慢 Worker 可以阻塞当前窗口，这是为简化调度而接受的吞吐取舍。
- 只有在预期输出文件出现并被接收，或宿主明确重派同一个既有 job 时，才能继续处理当前窗口；缺失输出不得消耗语义 attempt。

### R3. Controller 边界

- controller 继续负责源书拆章、run 状态、输出解析与 schema 校验、证据校验、accepted 序列化、组装、工作区验证、安装和归档。
- 保留 controller 管理的 `.game-kb-work` 中间数据，用于恢复、拒绝记录和审计；“无中间脚本”不等于“无可恢复中间数据”。
- 核心游戏数据仍安装且只包含 `characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`；审查信息另行安装到独立 report，不作为第六个核心数据文件。
- 使用保守的泛称过滤规则排除不能稳定指向单一实体的亲属称谓、职业称谓和泛化组织名称；“表哥”“管家婆”“店小二”“武林”“江湖”等泛称不进入终态实体，能够稳定指向特定人物的专指称号如“老刀把子”“老实和尚”继续保留。
- 所有被泛称规则过滤的候选必须保留名称、类别、章节、原始证据、过滤原因和 resolution 记录，并安装到独立的候选审查 report；不得因未进入终态 YAML 而丢失。
- Dashboard 必须把候选审查 report 中的过滤记录展示为可查看详情的 warnings，使只有泛称但可能具有剧情重要性的候选仍可被人工发现和复核。
- 五个终态 YAML 不增加 `deprecated` 字段，也不混入已过滤候选；Dashboard 的五文件读取合同保持不变，审查 report 走独立状态/警告通道。
- 安装后的审查文件固定为 `reports/game-kb-review.json`，只包含 report 版本、`source_hash`、`final_data_hash`、warning 分类统计和确需人工关注的 warning entries；每条 entry 至少包含代码、实体类别、名称、章节、`source_refs`、原因和 resolution，不记录已被确定性规则自动解决的 info。
- 既有工作区 `final/reports/assembly-report.json` 承载完整确定性审计：`description`、`rank`、`level`、`types` 的全部候选值与证据、最终选择、选择规则，以及一对一类型别名规范化记录都必须可追溯；这些记录不重复写入 `game-kb-review.json`。
- `/api/library/status` 只暴露每本书的审查 warning 数量和摘要；完整 entries 通过独立只读接口 `/api/library/review-report?path=<author>/<book>` 按需读取，不得加入 `/api/library/book-data`。
- 缺少审查 report 的旧书返回空审查结果；report 哈希与当前源书或终态数据不一致时显示 `REVIEW_REPORT_STALE` warning，但不阻断旧书浏览。
- 保留现有实体高召回要求、`LOW_RECALL` 门禁、`source_hash` 与 `final_data_hash` 硬门禁。
- 章节高召回候选不能直接一对一投影为最终实体；标准流程必须包含确定性的书级归并阶段，至少消除同类、跨章的高置信重复实体。
- 删除 `--deep` 不得意味着保留当前“每个章节候选一个最终 ID”的默认行为；AI 领域蒸馏可以删除，但最终数据必须先经过明确、可测试的归并规则。
- 自动归并键只使用“同一实体类别 + 精确规范名称”；同类且规范名称完全相同的跨章候选自动形成一个书级实体。
- 别名只能在书级实体形成后去重汇总到 `aliases`，别名相同或某候选名称命中另一候选别名都不得触发自动归并。
- 近似名称、包含关系、拼音相似或模型推断为同一人的候选保持分离；需要语义身份判断的情况不得由确定性归并器猜测。
- 同一书级实体存在多个不同 `description` 时，controller 先做精确去重，再选择字符数最长的有证据描述；长度相同则按最早 `source_ref`、文本字典序确定唯一结果。
- 未被选中的 `description` 及其章节证据必须保留在 `assembly-report.json` 的确定性审计中，不能静默丢弃。
- v7 默认流程不增加主代理或子代理执行的 AI 描述总结；主代理不得改写实体语义，AI 描述润色只能作为未来独立、可选且不阻断安装的后处理能力。
- 同一书级人物或武功存在多个不同 `rank` 时，选择出现次数最多的值；最高票并列时选择其最新章节证据更晚的值，不得简单选择等级最高值。
- `rank` 的全部候选值、出现次数、最新证据和最终选择必须写入 `assembly-report.json`。
- 同一书级人物存在多个不同 `level` 时，按 `核心 > 重要 > 次要 > 龙套 > 背景` 选择剧情重要性最高的值，避免核心人物因大量普通出场被多数值降级。
- `level` 的全部候选值、章节证据和最终选择必须写入 `assembly-report.json`。
- 武功、物品和势力在 v7 中统一使用多值 `types`，书级归并时取全部成员候选值的稳定去重并集；“武器/暗器”“门派/朝廷”“门派/商会”等组合是合法的多重分类，不视为冲突。
- v7 章节草稿、accepted 数据和终态 YAML 禁止再写单值 `type`；旧书不迁移，Dashboard 和只读扫描器必须继续兼容旧版单值 `type`，并在内存中按单元素数组展示。
- 去重后不得从某个章节候选的旧 ID 中任意选择赢家；controller 必须先形成书级实体，再从书级实体的 canonical name 和稳定 identity key 生成最终 ID。
- 同一类别下只有一个实体占用某个拼音 base ID 时不添加 hash；hash 只用于不同中文名产生相同拼音 slug，或明确保持分离的同名实体发生真实碰撞。
- 碰撞 hash 不得依赖会随新增章节证据扩张的完整 candidate-key 集合；增加同一实体的新证据不能改变其既有 ID。
- 不同规范中文名碰巧生成相同拼音 slug 时，suffix 只根据规范中文名生成稳定 hash。
- 两个实体规范中文名完全相同但又有明确证据表明不能合并时，controller 不自动生成随机 suffix，而是以身份碰撞进入 `manual_review`；没有稳定区分依据时不得发布两个同名 ID。
- controller 可以执行有显式测试覆盖的一对一类型别名规范化；已知英文别名转换为唯一中文规范值时不消耗 attempt。
- `items[].types`、`skills[].types` 与 `factions[].types` 分别使用独立、无歧义的闭合白名单；每个数组元素独立规范化，禁止自由翻译或跨字段复用模糊映射。
- 每次类型规范化必须在 `assembly-report.json` 中记录字段路径、原值、规范值和规则名；白名单外或有歧义的英文类型属于语义错误，必须重派 Worker，主代理不得猜测或翻译。
- 对用户和 AI 公开的正常命令面只保留：`run`、只读 `status`、用户授权后的 `retry-unit`、显式清理用 `archive-abandoned`。
- 删除公开的 `prepare`、`extract-plan`、`submit`、`plan-domains`、`accept`、`assemble`、`verify`、`install`、`archive-run`、`archive-existing`；必要的底层函数继续由 `run` 和自动化测试直接调用，不再要求 AI 编排。
- `run` 必须创建或恢复 run、接收已出现的章节结果文件、返回下一批章节 job，并在全部章节完成后自动执行组装、验证、安装和归档。

### R4. 宿主与范围

- 第一阶段不新增 MCP 服务、跨平台调度框架或 Claude Code/WorkBuddy 专用大型适配器。
- 新流程只依赖宿主具备派发只读章节子代理和写入唯一结果文件的基本能力。
- 新合同只用于新 run；《陆小凤传奇》归档 v6 run 不迁移、不续跑、不修补、不删除，《萧十一郎》已删除的 v6 run 不作为实现或测试输入。
- 用户已于 2026-07-21 确认 WorkBuddy 与 Claude Code 均已关闭，不再调用共享的 `flow.js`；实现前现场会话门禁已满足，但仍须完成规划文档评审并显式启动 Trellis 任务。
- 用户已手动删除 `.kb-scratch` 和《萧十一郎》v6 run；本任务不得重建这些观察现场，也不得删除、移动或修改《陆小凤传奇》归档 run 或其他用户现场文件。
- 新合同删除 `--deep`、`plan-domains`、四个 `distill:*` Worker 及其 prompt/attempt/accept 生命周期，不保留或改写第二套领域运输机制。
- 默认章节抽取与确定性组装仍产出五个终态 YAML；移除 `--deep` 所提供的全书 AI 去重决策与最终 rank 蒸馏是本轮接受的功能收缩。

### R5. 运行洁净度

- 正常运行不得在仓库根目录或 `.kb-scratch` 产生临时脚本、raw envelope、拆章片段或修复日志。
- 失败产物必须由 controller 放入 run 私有目录并可追溯，不能散落到工作区。
- Skill 文档必须准确描述 controller 与 AI 的真实职责，不能把“返回下一阶段”描述为脚本已经完成端到端编排。

## Acceptance Criteria

- [ ] 新章节合同不再包含 envelope 外壳、stdin submit 或主代理逐章 submit。
- [ ] CLI、Skill、schema、运行时和测试不再暴露 `--deep`、`plan-domains` 或 `distill:*` 领域 Worker 合同。
- [ ] 正常 Skill 流程只调用公开的 `run/status/retry-unit/archive-abandoned`，其中端到端成功路径只需要反复调用 `run`。
- [ ] 每个章节 job 具有唯一输入路径和唯一输出路径，两个并发 Worker 不共享写入目标。
- [ ] 无论主代理如何重复调用 `run`，controller 同时签发且未完成的章节 job 永远不超过 5 个；满载时返回 `waiting` 且 `jobs: []`。
- [ ] 25 章场景下，首次调用只能签发前 5 章；在任何输出出现之前，后续调用都不能签发第 6 章。
- [ ] 当前窗口即使已有 1 至 4 章完成，也不能签发下一窗口的章节；只有窗口内全部单元完成后才能选择后续最多 5 章。
- [ ] Worker 写入唯一 staging YAML 后，下一次 `run` 无需 `submit` 即可自动接收；成功时消费 staging 文件，失败时保留可审计的拒绝记录。
- [ ] 合格章节输出可由 controller 自动接收并进入 accepted；不合格输出被隔离并保持该章可重新派发。
- [ ] `weapon -> 武器` 等白名单映射由 controller 确定性完成且不消耗 attempt；`book`、`poison` 等歧义值被拒绝，接收记录可追溯所有规范化。
- [ ] 同一章节连续两次失败后 run 硬停；没有用户明确批准时，任何自动推进或主代理 reset 都被拒绝。
- [ ] controller 不再执行实体级 quarantine/sanitize 后继续接受；任何语义或证据错误拒绝整章且原稿保持可审计。
- [ ] 主代理只可对 allowlist 中的机械错误执行一次 attempt-2 修复，且不能读取源章节或改变语义内容。
- [ ] 全流程不需要生成 `.kb-scratch`、清洗脚本、批量提交脚本或手工修复证据。
- [ ] `run` 内部的组装、工作区验证、安装、已安装验证和归档阶段仍产出恰好五个核心 YAML，并通过现有硬门禁。
- [ ] 泛称过滤使用保守规则：不能稳定指向单一实体的泛称不进入终态 YAML，稳定专指称号不被误删。
- [ ] 每个被过滤候选都能在独立审查 report 中追溯到类别、章节、证据、过滤原因和 resolution，且 Dashboard 能以 warning 展示数量与详情。
- [ ] 五个终态 YAML schema 不增加 `deprecated`，`/book-data` 仍精确返回五个核心 YAML；缺少审查 report 的旧书仍可正常读取。
- [ ] `reports/game-kb-review.json` 绑定当前 `source_hash` 与 `final_data_hash`，且只包含人工 warning，不包含 `info_count` 或已自动解决的字段归并记录；状态接口只返回 warning 摘要，独立 review-report 接口返回完整 warning entries，陈旧报告产生非阻断 warning。
- [ ] `assembly-report.json` 对每个确定性 `description`、`rank`、`level`、`types` 决策和类型别名规范化保留全部候选、证据、规则与最终结果，并通过工作区验证确认可由 accepted candidates 重算。
- [ ] 同一书中反复出现的高置信同一实体不会按章节生成多个最终 ID；测试覆盖跨章同名角色、武功、物品和势力的归并。
- [ ] 只有“同类别 + 精确规范名称”触发自动归并；测试证明别名重合、近似名称、名称包含关系和拼音相似都不会误触发归并。
- [ ] 自动归并后的 `aliases` 是全部成员候选别名的稳定去重并集，别名集合增加或排序变化不会改变实体 ID。
- [ ] 多个不同 `description` 按“最长文本 -> 最早证据 -> 文本字典序”确定性选择，其他版本与证据进入 assembly report；默认流程不派发 AI 总结任务。
- [ ] `rank` 冲突按“出现次数最多 -> 最新章节证据”确定性选择，不使用章节最高值；assembly report 可追溯完整票数、证据和最终选择。
- [ ] 人物 `level` 冲突按固定剧情重要性顺序选择最高值，不能被多数普通出场降级；assembly report 可追溯全部候选值与证据。
- [ ] 武功、物品和势力在 v7 中都只写 `types`，跨章值取稳定去重并集；合法多重分类不会触发冲突或 warning。
- [ ] v7 校验拒绝物品、武功和势力的单值 `type`；Dashboard 与只读扫描器仍能读取旧书的 `type`，且无需改写旧 YAML。
- [ ] 去重后的唯一实体获得无 hash 的稳定 base ID；只有真实 ID 碰撞才使用稳定 suffix，且为实体增加后续章节证据不会改变 ID。
- [ ] 真实同名异人不会因 candidate-key 集合不同而自动获得随机 ID；身份碰撞会阻断发布并保留证据供审查。
- [ ] 新旧合同严格隔离；《陆小凤传奇》归档 v6 run 的文件与状态保持不变，已删除的《萧十一郎》v6 run 不被重建。
- [ ] 旧 run 拒写与只读兼容测试只使用临时合成 v6 fixture，不迁移、续跑、修补或改写任何真实书籍 run；用户已确认两个宿主会话均已关闭。
- [ ] 自动化测试覆盖唯一写入、拒绝与重派发、恢复、并发隔离、最终发布和旧 run 拒绝继续写入。
- [ ] 使用同一份 6 章专用验收语料，分别在 Claude Code 与 WorkBuddy 上完成一次真实模型全流程；覆盖超过首个并发窗口后的继续派发，并确认两边都不产生临时脚本或散落的 raw envelope。

## Out of Scope

- 迁移、修复或继续处理任何真实 v6 run，包括《陆小凤传奇》归档 run；《萧十一郎》只在 v7 完成后作为全新 run 重跑。
- 新建通用 AI 调度平台、MCP 服务或 broker。
- 为实体 description 增加主代理总结、子代理总结或其他 AI 语义润色阶段。
- 改变五个终态 YAML 的文件名、`/book-data` 五文件顶层合同或 rank 语义；物品和势力从 `type` 升级为 `types` 是本任务明确包含的 v7 字段合同变更。
