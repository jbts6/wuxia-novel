---
name: generate-game-kb
description: Use when generating or regenerating a source-grounded wuxia novel knowledge base for game design, especially when fast chapter-level extraction, nine compatible JSON files, martial-arts recall, bounded retries, or direct data installation are needed.
---

# generate-game-kb

以小说原文为唯一事实来源，快速生成面向武侠游戏素材的九类知识库。它是独立的 95 分实用流程，不是审计级 `generate-kb` 的六阶段状态机，也不能宣称通过 G1–G5。

设：

```bash
SKILL=.agents/skills/generate-game-kb
CLI="$SKILL/scripts/flow.js"
NOVEL=<作者>/<小说名>
```

用户只需调用本 Skill 并提供书籍目录。当前主模型必须自主判断当前状态、执行内部命令并持续推进到完成或明确停点，不得要求用户指定脚本、命令或阶段顺序。

当前主模型负责自主路由、原生子代理编排、串行提交，以及合并、清理、补漏和质量复核。逐章语义提取必须交给宿主的原生子代理隔离执行；每个子代理只处理一个章节，直接完整读取该章节原文，并在写出草稿后结束。章节事实输入只能来自当前 run 的原文文件；CTX/context-mode、检索摘要、关键词启发式或其他启发式抽取、外部模型 CLI 都不能代替章节子代理阅读原文。确定性脚本负责归档、状态、哈希、短引用与私有 bindings、candidate_key/local_key、候选 ledger、类别组装、最终 ID、校验、投影、安装和报告；AI 只做受限语义决定。

开始任何阶段前完整读取 [schemas.md](schemas.md)，再读取该阶段对应的 `prompts/*.md`。主模型必须为每份 AI 草稿分配 run 内、受管产物目录外的唯一 staging 路径，再用 `accept` 提交；不能直接编辑 `drafts`、`accepted`、`materialized`、`final`、`progress.json`、`manual_review.json` 或最终 `data/`。

## 自主启动与状态路由

调用后先检查小说根目录和 `.game-kb-work/runs/`，再按可观察状态自行选择入口：

| 状态 | 当前主模型的动作 |
|---|---|
| 没有活动 run | 执行 `archive-existing`，确认根目录只剩唯一原文、`ch_split/`、`_archive/`，再执行 `prepare` 创建带 `semantic_contract_version: 2` 的新 run |
| 恰有一个活动 run（v2） | 不再归档；执行一次 `prepare` 恢复，再执行一次 `status --json` 读取进度 |
| 恰有一个活动 run（legacy） | 不执行 `prepare`；只执行一次 `status --json` 保存只读取证，并以 `LEGACY_SEMANTIC_CONTRACT` 停止写流程 |
| 多个活动 run | 停止并报告各 run-id；不能猜测、合并或选择其中一个 |

以下命令是当前主模型的内部执行步骤，不是交给用户的操作说明。正常顺序为：`archive-existing`（仅新 run）→ `prepare` → 逐章 `chapter:*` → `check-coverage` 与必要的 `recall:*` → `prepare-merge` → 类别 merge 与必要的 consolidate → `assemble-merge` → `check-resolution` 与必要的 `supplement:*` → `prepare-clean` → 类别 clean → 再次 `prepare-clean` 生成 `clean:materials:001` → `assemble-clean` → `build-final` → `verify` 与 `quality:sample` → `install` → `verify --installed` → `archive-run`。`merge:book` 和 `clean:book` 只是 attempts 为 0 的确定性聚合状态，不是 AI 提交单元。每个阶段完成后直接进入下一个可执行阶段，直到归档成功或遇到明确停点。

新书或新 run 必须先归档旧构建，只保留唯一原文、`ch_split/` 和 `_archive/`：

```bash
node "$CLI" archive-existing "$NOVEL"
node "$CLI" prepare "$NOVEL" --run <run-id>
```

`prepare` 创建的新 run 必须由脚本在 `run.json` 中持久化 `semantic_contract_version: 2`；主模型不得手工补写、伪造或覆盖这个版本。

恢复已有且 `semantic_contract_version: 2` 的 run 时不要再次归档，只运行一次：

```bash
node "$CLI" prepare "$NOVEL"
node "$CLI" status "$NOVEL" --json
```

缺少 `semantic_contract_version: 2` 的 run 是 legacy 只读取证，不是可恢复的 v2 run。主模型只允许对它运行一次 `status --json`；不得静默升级或原地升级，不得执行 `prepare`、`reset-unit`、`accept`、coverage/resolution、merge/clean、`build-final`、工作区 `verify`、`install` 或 `archive-run`。旧 run 尤其不得 install，也不得计入新版正向验收。只有用户在看过 run-id 和影响后明确确认放弃，主模型才可执行：

```bash
node "$CLI" archive-abandoned "$NOVEL" --run <run-id> --confirm
```

`archive-abandoned` 只移动完整 legacy run 并写入 `abandonment.json`，必须保留 drafts、进度和证据；它不把旧 run 标记为通过，也不把旧产物转换为 v2。没有明确确认时，报告 `LEGACY_SEMANTIC_CONTRACT` 后停止该书的写流程。

`prepare` 会保留输入哈希未变化的已完成章节。`status` 只用于观察文件清单，不返回命令，也不得循环调用来等待进展；读完一次状态后，选择一个尚未完成且未进入 `manual_review` 的单元处理。

发生自动或手动上下文压缩后，按唯一活动 run 的恢复流程重新读取本 Skill、`schemas.md` 和当前阶段提示词。先辨认合同版本：v2 run 再各执行一次 `prepare` 与 `status --json`；legacy run 只执行一次 `status --json` 取证并按 `LEGACY_SEMANTIC_CONTRACT` 停止。压缩摘要和未落盘记忆都不是恢复输入。恢复只以 status、work item、accepted artifact 和 staging 文件为准，状态为 `done` 且输入哈希未变化的章节或类别单元不重读、不重做。待处理且非 `manual_review` 单元的下一个 attempt 固定为持久化 `attempts + 1`；只有这个 attempt 的精确 staging 文件存在时，主模型才直接串行 `accept` 让校验器裁决。attempt 编号小于 `attempts + 1` 的 staging 文件已经被提交或属于崩溃残留，不得再次 `accept`；下一个章节 staging 不存在时启动新章节子代理从头完整读原文，下一个类别 staging 不存在时启动新类别 worker 只读该 work item。

## 1. 逐章提取

读取 [prompts/extract-chapters.md](prompts/extract-chapters.md)。主模型从 manifest 和持久化进度中选择尚未完成且未进入 `manual_review` 的章节，并为每章启动一个隔离的原生子代理；可按宿主并发上限同时启动多个，但每个子代理只负责一个章节。

章节子代理的持久化并发上限初始为 10。每一批的实际派发数取当前并发上限、宿主可用子代理槽位和待处理章节数中的最小值；主模型必须先从 `status --json` 的 `worker_pool` 读取当前上限，再派发这一批。

同一派发批次出现一个或多个明确的 429 时，只记录一次限流事件，并由主模型执行内部命令 `worker-backoff --batch <batch-id> --reason 429`；持久化上限依次按 `10 → 5 → 2 → 1` 折半。429 不消耗章节语义提交次数，也不调用 `accept`；重试必须换一个新子代理并从头完整读取该章原文。当前 run 不自动升回并发，上下文压缩或恢复也不重置并发；新 run 重新从 10 开始。并发为 1 时再次遇到新的 429，流程停止并报告外部限流，不能死循环重试。

主模型传给章节子代理的只能是 `schemas.md`、`prompts/extract-chapters.md`、本章 source 文件、对应 manifest 条目和唯一草稿路径。`prepare` 已创建 `<run-dir>/staging/`；文件名必须同时由 run-id、unit 和 attempt 决定，固定为 `<run-dir>/staging/<unit>_attempt_<NN>.json`；禁止使用 `/tmp/chapter_026_draft.json` 这类不绑定 run 的任意临时文件。子代理只写主模型分配的路径，不调用 `accept`，不编辑任何进度或 accepted 产物；完成后只返回草稿路径和简短状态，不把原文、JSON 正文或章节摘要回传主上下文。

主模型等待已派发的子代理结束后，逐个检查草稿文件存在，再串行执行 `accept`，禁止多个子代理并发写 `progress.json`：

```bash
node "$CLI" accept "$NOVEL" --unit chapter:003 --draft <run-dir>/staging/chapter_003_attempt_01.json
node "$CLI" accept "$NOVEL" --unit chapter:004 --draft <run-dir>/staging/chapter_004_attempt_01.json
```

`accept` 只接收当前 run 中与 `unit` 和下一个 attempt 完全一致的 staging 路径；路径不一致会在写入进度前失败。`accept` 把原始提交复制到 run 的 `drafts/` 后，无论成功或拒绝都会由 CLI 删除对应 staging 文件。提交被拒时，用持久化错误和下一个 attempt 路径启动新的章节子代理；新子代理仍须从头完整读取本章原文。不得让主模型根据子代理摘要修补草稿，也不得通过更换子代理绕过三次提交预算。

完成标准：每个 manifest 章节都有一个 `done` 章节单元，或已明确进入 `manual_review`。每次成功提交后，该子代理上下文即可丢弃；后续章节和恢复流程只依赖落盘状态。某章转人工后继续其他独立章节；不要重做未变化的 `done` 章节。

## 2. 类别合并与确定性整书组装

所有章节均已接受且没有缺章时，主模型执行 `prepare-merge`，再从 status 和生成的 `work/merge/**/input.json` 选择待处理单元：

```bash
node "$CLI" prepare-merge "$NOVEL" --run <run-id> --json
```

读取 [prompts/merge-category.md](prompts/merge-category.md)。每个类别 worker 只接收 `schemas.md`、该提示词、一个 AI 可见 work item 和该单元唯一 staging 路径；不得接收或读取私有 bindings、其他工作项、accepted 全书对象、CTX/context-mode、根目录旧 data 或最终 ID。AI 不得输出 `candidate_key`、`local_key` 或最终 ID；脚本独占短引用展开、全书 local key、source refs 并集、章节摘要和完整 candidate ledger。

独立的非对白类别 worker 可使用与章节阶段同一个持久化 worker pool 并发生成草稿，但主模型必须逐个串行 `accept`。events 类别必须先完成并接受，dialogues 类别随后处理，使对白引用由脚本绑定到已裁决事件。每个 `merge:<category>:<shard>` 的所有 member_refs 必须恰好裁决一次：

```bash
node "$CLI" accept "$NOVEL" --run <run-id> --unit merge:items:001 --draft <run-dir>/staging/merge_items_001_attempt_01.json
```

类别有多个 shard 或同名组被拆分时，全部 shard done 后再次执行一次 `prepare-merge`，它会确定性生成只含初步实体摘要的可选 `merge:<category>:consolidate` work item；按同一 worker 与串行 accept 合同处理。全部类别和 consolidate done 后执行：

```bash
node "$CLI" assemble-merge "$NOVEL" --run <run-id> --json
```

`assemble-merge` 不调用 AI，不消耗 attempt，生成 attempts 为 0 的 `merge:book` 以及兼容的 `accepted/merged/book.json`。歧义或 ledger 未闭合时停止，不猜测、不重跑整本。

## 3. 确定性覆盖检查与类别补漏

在合并前后都可以运行一次确定性检查；它只报告缺口并打开受影响的类别单元，不调用模型，也不提供全书重跑动作：

```bash
node "$CLI" check-coverage "$NOVEL" --run <run-id> --json
node "$CLI" check-resolution "$NOVEL" --run <run-id> --json
```

读取 [prompts/recall-category.md](prompts/recall-category.md) 或 [prompts/supplement-category.md](prompts/supplement-category.md)，只为报告列出的类别和章节生成一次补漏草稿，再提交：

```bash
node "$CLI" accept "$NOVEL" --run <run-id> --unit recall:items --draft <物品补漏草稿>
node "$CLI" accept "$NOVEL" --run <run-id> --unit recall:dialogues --draft <对白补漏草稿>
node "$CLI" accept "$NOVEL" --run <run-id> --unit supplement:items --draft <物品补充草稿>
```

补漏语义生成次数独立写入 `progress.json`，重启不能刷新预算；只允许一次语义不变的格式修正。补漏只生成 `materialized/` 投影，不改写任何 accepted 产物，也不重跑全书。合法空物品库必须持久化 `none_found` 章节复核；候选仍无唯一去向时转人工。

## 4. 类别清理、素材选择与确定性组装

确定性合并完成且补漏去向闭合后，执行：

```bash
node "$CLI" prepare-clean "$NOVEL" --run <run-id> --json
```

读取 [prompts/clean-category.md](prompts/clean-category.md)。每个 `clean:<category>:<shard>` worker 只接收 `schemas.md`、该提示词、一个 AI 可见 work item 和唯一 staging 路径；它对每个 entity_ref 恰好给出一个 keep/edit/merge_into/drop 决定，并只引用输入 obligation。AI 不得复制 candidate ledger、`candidate_key`、`local_key` 或最终 ID；脚本继承未变化字段、迁移 ledger 并复验义务。

独立类别可使用同一个持久化 worker pool 并发，但 events 必须先接受、dialogues 随后处理，主模型始终串行 `accept`。命名功法/招式及核心/重要人物不得直接 drop。存在未闭合 obligation 时 keep-all 会失败；obligation 为空且所有实体显式裁决时零删除合法。数量说明只作一次解释，不能触发补数、删数或整书重跑。

所有实体类别 clean 单元 done 后，再次执行 `prepare-clean`。脚本用确定性存活投影创建 `clean:materials:001`；读取 [prompts/select-materials.md](prompts/select-materials.md)，让 worker 只从紧凑 surviving entity catalog 选择 source_ref，不读取完整实体或私有 bindings。接受素材决定后执行：

```bash
node "$CLI" assemble-clean "$NOVEL" --run <run-id> --json
```

`assemble-clean` 不调用 AI，不消耗 attempt，生成 attempts 为 0 的 `clean:book` 以及兼容的 `accepted/cleaned/book.json`。它机械迁移 candidate ledger、展开素材名称并汇总数量说明；任何类别或 obligation 未完成都会在写入前阻断。

## 5. 稳定 ID、质量抽样与安装

AI 不生成、修补或猜测最终 ID。脚本一次生成稳定 ID 并重写全部引用：

```bash
node "$CLI" build-final "$NOVEL"
node "$CLI" verify "$NOVEL"
```

首次 `verify` 会固定 `final/reports/quality_sample.json`，并以 `QUALITY_REVIEW_REQUIRED` 停止。读取 [prompts/sample-quality.md](prompts/sample-quality.md)，只核对样本及其引用章节，再提交：

```bash
node "$CLI" accept "$NOVEL" --unit quality:sample --draft <抽样复核草稿>
node "$CLI" verify "$NOVEL"
```

工作区验证通过后才允许安装，并必须复验已安装结果：

```bash
node "$CLI" install "$NOVEL"
node "$CLI" verify "$NOVEL" --installed
node "$CLI" archive-run "$NOVEL" --run <run-id>
```

只有最后一条命令成功，且 `data/` 中存在九类数组、安装回执存在、无人工问题，才可声明完成。`install` 会完整备份非空旧 `data/`、保留未知非目标条目、移除并记录 `REBUILD_REQUIRED.md`，失败时恢复旧目录。

## 有界失败规则

- 每个 `chapter:*`、`merge:<category>:<shard>`、可选 `merge:<category>:consolidate`、`clean:<category>:<shard>`、`clean:materials:001`、`quality:sample` 最多 3 次总提交；首次生成已计入。`merge:book` 和 `clean:book` attempts 固定为 0，禁止作为 AI 草稿提交。
- 相同输出、相同标准化错误或 `A → B → A` 震荡会提前进入 `manual_review`。
- 重启不会重置同一输入哈希的次数。不得自动执行 `reset-unit`，也不得换文件名、换会话或反复调用 `accept` 绕过预算。
- `manual_review` 是人工终态，不得自动执行 `reset-unit`：继续无依赖章节，但禁止 `build-final`/`install`。把问题清单交给用户，只有用户明确授权后才能重置指定单元。
- 有效但低于 95% 的质量复核直接转人工，不回到 merge/clean，也不重建全库。
- 任何确定性引用无法唯一解析时转人工；禁止让 AI 在多个 ID 方案之间循环修正。

## 内容取舍

- 功法与原文明确定名的招式优先高召回；“全力一挥”“拍出一掌”等普通动作既不是招式，也不另建动作类别。
- 事件优先经典冲突、奇遇、传承、反转和关系转折；允许跨多个不连续章节。
- 人物分 `核心/重要/次要/龙套/背景`；只详写前两级，后三档保持短记录。
- 物品只保留秘籍、剧情关键物、高级药毒、神兵利器或其他稀有特殊物品。
- 对白从属于事件；逐章提取可为同一事件保留多条短候选，最终合并/清理后才限制每个事件最多一条。
- 证据必须不错章；行号、段落和锚点只需近似。旧 `data/`、百科、影视改编和模型记忆不能成为生成输入。

## 命令速查

| 命令 | 完成标准 |
|---|---|
| `prepare` | manifest 和逐章源文件存在 |
| `archive-existing` | 根目录只保留原文、`ch_split/` 和 `_archive/` |
| `status --json` | 读取一次当前清单，不执行循环 |
| `worker-backoff --batch ... --reason 429` | 同批 429 只将同一持久化 worker pool 的并发上限按 10 → 5 → 2 → 1 折半一次；仅供主模型内部调用 |
| `check-coverage` | 持久化候选/对白覆盖报告，并仅打开受影响的 recall 单元 |
| `prepare-merge` | 稳定生成类别 merge shard；依赖满足时生成 consolidate work item |
| `assemble-merge` | 确定性生成 attempts 为 0 的 merge:book 与兼容 merged book |
| `check-resolution` | 持久化候选去向报告，并仅打开受影响的 supplement 单元 |
| `prepare-clean` | 生成类别 clean obligations/work item；全部类别完成后生成 materials work item |
| `assemble-clean` | 确定性生成 attempts 为 0 的 clean:book 与兼容 cleaned book |
| `accept --unit ... --draft ...` | 单元变为 `done` 或有界转人工 |
| `build-final` | 九类 final JSON 与游戏素材索引生成 |
| `verify` | 固定抽样已通过且无阻断问题 |
| `install` | 旧数据已备份、目录已替换、回执已写 |
| `verify --installed` | 只用已安装 data/报告/回执复验通过 |
| `archive-run` | 已安装结果复验通过，完整 run 移入 `_archive/generate-game-kb/` |
| `archive-abandoned --run <run-id> --confirm` | 仅在用户明确确认后，把 legacy run 连同 drafts 和失败证据完整移入 abandoned 归档；不产生通过状态 |

约 20 章中篇以 60 分钟为试跑基准，约 50 章长篇以 90 分钟为基准。耗时是性能证据，不是正确性门禁；超时不废弃已验证数据，也不能放宽上述停止条件。
