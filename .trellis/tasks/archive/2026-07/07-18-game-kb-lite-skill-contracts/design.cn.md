# V4 优先的游戏知识库与 Lite Skill 设计

## 边界

V4 是标准且完整的工作流。只有在 V4 工作流、controller 合同和回归测试全部通过后，才从 V4 提取 Lite。Lite 复用 V4 的章节调度、原文溯源、验收、重试、组装、验证、安装和归档行为，只移除耗时的四域 distill 阶段。四个 deep skill 仅在用户明确调用时，才执行被移出的对应领域分析。

controller 是原文路径、staging 路径、尝试次数、验收、哈希、发布、安装、归档、延迟任务和不可变 revision 的唯一所有者。Skill 文档只引导代理调用这些接口，不自行推导路径，也不重复实现 controller 状态。

## V4 标准合同

### 章节调度

主代理向 controller 请求确定性的章节作业。普通作业根据原文总长度分配相邻的 2 至 3 章。多章节作业不得超过 36000 个中日韩字符。只有两种情况允许单章作业：该章单独就超过长度预算，或者最后剩余的一章无法在不超预算的前提下并入其他作业。每个子代理必须完整读取分配给自己的每章原文，并为每章分别生成一个 YAML 草稿。

每个章节描述符只暴露一个当前 `attempt` 和一个由 controller 生成的 `staging_path`，同时包含标准的 `source_file`、`input_hash` 和原文长度。不得暴露路径列表，让主代理或子代理自行选择。子代理只能写入描述符给出的 `staging_path`；主代理必须把同一路径提交给 `accept`。

### 有界重试

首次提交失败后，controller 最多再提供 1 次重试，因此普通周期最多尝试 2 次。第二次被拒绝后，该单元进入 `manual_review`；status 循环、调度器和子代理都不得自动发起第三次尝试。被拒绝的草稿必须保留供复核，拒绝处理不得删除草稿。

用户可以通过以下显式命令，为一个单元启动新的有界重试周期：

```text
retry-unit <novel> --run <run-id> --unit <unit> --confirm
```

`retry-unit` 只能由用户主动调用。它把指定单元及其 controller 工作项重置到第 1 次尝试，签发新的当前 staging 路径，并保持已经验收的其他单元不变。用户手动启动的每个新周期仍然最多只允许 1 次重试。底层 `reset-unit` 可以为兼容性继续保留，但面向用户的 Skill 恢复说明统一使用 `retry-unit`。

### Skill 范围

V4 Skill 只描述该工作流已经实现的行为和产物。所有尚未实现的未来能力承诺都从面向用户的 Skill 文案中删除。V4 继续负责四类实体、章节摘要、四个领域 distill 决策、五个最终 YAML 文件、验证、安装、安装后验证、回执和归档。

## Lite 基础合同

`generate-game-kb-lite` 继承已经验证的 V4 最终产物合同和 controller 合同，只缩短模型处理流水线。它使用相同的动态章节作业、controller 当前路径和有界重试行为。基础生命周期如下：

```text
lite-prepare -> repeated lite-status/lite-accept -> lite-basic-curate (submit or skip)
-> lite-publish (assemble -> verify -> install -> installed verify -> archive)
```

安装结果仍然是 `<novel>/data/` 下的五个 YAML 文件。章节提取草稿同样使用 YAML。JSON 仅用于 controller 管理的 manifest、进度、报告、任务状态和回执；代理不得用 JSON 替代章节草稿或最终知识数据。成功发布不能只看 YAML 文件是否存在：原文与最终数据哈希、引用闭包、验证状态、安装回执、安装后验证、artifact manifest 和归档回执必须全部一致。

## 按需 Distill 合同

每个领域 Skill 都是共享 deferred-task 接口上可发现、可独立调用的适配器。延迟任务状态位于已归档基础 run 之外，因此 `lite-publish` 完成后仍可执行增强：

```text
task-add <novel> --run <run-id> --type <domain>-deep --scope <domain>
task-run <novel> --run <run-id> --task-id <task-id> --draft <controller-requested-overlay-path>
task-apply <novel> --run <run-id> --task-id <task-id>
```

领域 Skill 读取已经发布的 Lite 基础数据和溯源证据，执行对应领域达到 V4 质量标准的全书分析，并且只提交针对现有溯源记录的受限操作。任务同时绑定已归档基础 run 的 artifact-manifest 哈希和当前已安装数据身份。应用阶段拒绝过期或无效的 overlay，在五文件 YAML 数据副本上执行操作并完成验证，然后备份当前已安装的 `data/`，最后把新 revision 原子提升到 `<novel>/data/`。revision 回执和备份回执必须绑定相关哈希。待处理或失败的 deep task 不得改变 Lite 基础流程的完成状态。

连续 overlay 必须累计：创建任务时绑定当前已安装数据哈希；如果其他 revision 已经改变当前安装数据，应用阶段必须拒绝旧任务。每次成功应用都必须在 Dashboard 的活动数据切换前创建独立备份。

## Skill 布局

- `generate-game-kb/SKILL.md` 及其章节 prompt：V4 标准调度、当前路径、重试、最终产物和恢复合同。
- `generate-game-kb-lite/SKILL.md`：发现元数据、基础流程、产物与完成合同、恢复方式，以及可选 deep skill 路由。
- `generate-game-kb-lite/prompts/extract-chapters.md`：V4 标准章节合同的轻量适配层，不再独立定义另一套调度规则。
- 四个 deep `SKILL.md`：共享任务生命周期，以及各领域特有的目标和 schema 约束。文档可以引用 V4 标准的 `schemas.md` 和 `distill-domain.md`，不增加重复脚本。
- 合同测试先覆盖 V4，再验证 Lite 和四个 deep skill 对 V4 每个阶段的继承或有意省略。

## 命令示例与真实语料

V4、Lite 和所有 deep skill 文件夹中记录的每一条面向用户命令，后面都必须紧跟一个具体示例。示例统一使用带引号的 Windows 小说路径 `"C:\git\wuxia-novel\古龙\剑神一笑"`、具体 run ID `run-jian-shen-yi-xiao`，以及 `chapter:001`、`distill:characters` 等有效 unit 格式。需要使用动态生成 ID 的命令，必须先展示生成该 ID 的前置命令，再原样复用其输出；主代理和子代理都不得猜测 run、task、unit 或路径。参数占位模板可以作为语法参考保留，但旁边必须有具体示例。

仓库中已跟踪的 `古龙/剑神一笑/剑神一笑.txt` 作为 V4 真实语料集成测试。它当前包含 20 章，约 9.8 万个中日韩字符。按照已确认的最多 3 章和 36000 字符限制，确定性贪心打包应生成 7 个作业，章节数依次为 `[3, 3, 3, 3, 3, 3, 2]`。集成测试用该语料验证中文作者/书籍路径、真实章节长度分布、controller 签发的原文与 staging 路径，以及稳定的恢复和状态行为。小型合成小说继续用于快速单元测试；真实语料不复制到临时测试数据中。

## 兼容性

保留现有命令名称和五个 YAML schema。新增面向用户的显式恢复命令 `retry-unit`，但不删除 `reset-unit`。本次变更不会自动运行 deep skill。它新增发布后的 deferred workspace，并让用户明确批准的 `task-apply` 安装已验证的 revision，同时把之前安装的数据保留为可恢复备份。

## 验证顺序

验证必须按依赖顺序执行：

1. V4 合同和 controller 测试证明：确定性的动态 2 至 3 章作业、每个描述符只有一个当前 staging 路径、controller/主代理/子代理三者路径一致、最多 1 次自动重试、保留被拒绝草稿、支持显式手动重试，并且不会自动发起第三次尝试。
2. `古龙/剑神一笑` 真实语料集成测试证明：确定性生成 7 个作业，章节数为 `[3, 3, 3, 3, 3, 3, 2]`，带引号的中文路径可正常处理，并且所有路径由 controller 统一签发；随后完整 V4 生命周期和五文件 YAML 最终产物通过验证。
3. Lite 测试证明它复用 V4 的章节与重试合同，同时在基础流程中省略领域 distill。
4. deep skill、deferred task、累计 overlay、备份、原子安装和过期任务拒绝测试通过。
5. 最后运行标准 Skill validator、JavaScript 语法检查、完整相关 Node 测试套件和 diff 检查。
