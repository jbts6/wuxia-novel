---
name: generate-game-kb
description: Use when generating or regenerating a source-grounded wuxia novel knowledge base for game design, especially when fast chapter extraction, nine compatible JSON files, martial-arts recall, bounded retries, or direct data installation are needed.
---

# generate-game-kb

以小说原文为唯一事实来源，生成面向武侠游戏素材的九类知识库。使用 `semantic_contract_version: 3` 与 `semantic_profile: domain-distill-v1`；这是独立的快速实用流程，不能宣称通过审计级 `generate-kb` 的 G1–G5。

人物和武功统一使用 `power_rank`，记录全书证据支持的巅峰状态。八级从低到高固定为：`平平无奇`、`初窥门径`、`略有小成`、`登堂入室`、`炉火纯青`、`出神入化`、`登峰造极`、`返璞归真`。新武功不再输出 `mastery_rank` 或旧 `rank`，物品不再输出 `rarity_tier` 或 `rarity`。

逐章对白提取默认关闭：新章节草稿固定写 `dialogues: []`，最终仍生成兼容的 `dialogues.json`，默认内容为空数组。

设：

```bash
SKILL=.agents/skills/generate-game-kb
CLI="$SKILL/scripts/flow.js"
NOVEL=<作者>/<小说名>
```

用户只需调用本 Skill 并提供书籍目录。当前主模型自主路由、派发 Worker、串行提交并持续推进到安装归档或明确停点。开始任何语义阶段前完整读取 [schemas.md](schemas.md)，再读取对应提示词。

## 状态路由

| 可观察状态 | 动作 |
|---|---|
| 没有活动 run | 只执行一次 `archive-existing`，再 `prepare --run <run-id>` |
| 恰有一个活动 run，且是 `domain-distill-v1` v3 | 不再归档；各执行一次 `prepare` 与 `status --json` 后续做 |
| 恰有一个旧版本或无 profile run | 只执行一次 `status --json` 取证，以 `LEGACY_SEMANTIC_CONTRACT` 停止写流程 |
| 多个活动 run | 报告 run-id 并停止；不得猜测、合并或自动选择 |

所有 v2 run，以及缺少 `semantic_profile: domain-distill-v1` 的 run，都属于只读旧 run。不得静默升级或原地升级，不得 install。只有用户看过影响并明确确认后，才执行：

```bash
node "$CLI" archive-abandoned "$NOVEL" --run <run-id> --confirm
```

## 正常路径

```text
archive-existing（仅 fresh run）
→ prepare
→ chapter:NNN
→ check-coverage 与必要的重点 recall
→ prepare-merge（机械注册表 + 四域工作项）
→ distill:plot / distill:martial / distill:items / distill:world
→ assemble-merge
→ check-resolution 与必要的重点 supplement
→ prepare-clean（0 个 AI 单元）
→ assemble-clean
→ build-final
→ verify / quality:sample / verify
→ install / verify --installed
→ archive-run
```

`merge:book` 与 `clean:book` 是兼容状态，`attempts: 0`；它们不是 AI 草稿。`chapter_summaries` 从最终事件、关键人物和结果机械投影，AI 尝试数为 0。每阶段完成后直接进入下一阶段，不得循环调用 `status` 等待。

## 逐章提取

读取 [prompts/extract-chapters.md](prompts/extract-chapters.md)。使用原生子代理；每个子代理只处理一个章节并直接完整读取对应章节原文；CTX/context-mode、检索摘要、关键词启发式和外部模型 CLI 都不能代替原文读取。

Worker 不摘录对白，也不为 `quotable` 事件生成对白候选；`dialogues` 字段必须为空数组。对白关闭不降低角色、武功、招式、关键物品和事件的提取标准。每个人物和武功候选都必须根据本章证据给出暂定 `power_rank`。

章节与领域阶段共享持久化 Worker 池：主线程之外最多 3 个 Worker。实际批次取并发上限、宿主可用槽位和待处理单元数的最小值。新 run 从 3 开始；同一批次一个或多个明确 429 只记录一次并按 `3 → 1` 退避，429 不消耗语义 attempt。并发为 1 时再次出现新的 429，停止并报告外部限流；恢复或上下文压缩不重置并发。

主模型为每个草稿分配唯一 staging 路径：

```text
<run-dir>/staging/<unit>_attempt_<NN>.json
```

路径必须绑定 run-id、unit 与 `attempts + 1`。Worker 只写该路径，不调用 `accept`，不修改 `progress.json` 或 accepted 产物；完成后只返回路径。禁止使用 `/tmp/chapter.json` 等任意临时文件。主模型等待一批 Worker 完成后逐个串行执行 `accept`。

## 候选注册与四域决策

章节全部接受后执行 `prepare-merge`。脚本先机械完成名称规范化、精确同名合并、证据并集、候选注册和引用迁移；近似名、身份冲突和跨类别同名进入 pending，不做模糊删除。

读取 [prompts/distill-domain.md](prompts/distill-domain.md)。四个工作项固定为：

| 单元 | 类别 | 标准 |
|---|---|---|
| `distill:plot` | characters、events、dialogues | 角色与事件硬门；人物 keep 必须给全书巅峰 `power_rank`；dialogues 仅作兼容 |
| `distill:martial` | skills、techniques | 武功 keep 必须给全书巅峰 `power_rank`；只在原文明示时关联招式所属武功 |
| `distill:items` | items | 只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊 |
| `distill:world` | factions、locations | 身份、证据和引用正确；完整度采用软门 |

每域正常只生成一个草稿；互不依赖的领域可在 3 Worker 上并发生成，但主模型始终串行 `accept`。输入超过控制器上限时以 `DOMAIN_INPUT_TOO_LARGE` 停止，不静默截断，也不退回逐类别循环。

AI 只输出 keep/merge/reject/pending 决策和允许字段补丁。人物和武功的 keep 补丁必须包含合法 `power_rank`，该全书判断覆盖逐章暂定值，不增加 AI 单元。`candidate_key`、`local_key`、私有 bindings、完整 ledger 与最终 ID 归脚本所有。领域接受后，`assemble-merge` 确定性闭合迁移链并组装八类实体；`prepare-clean` 返回 0 个 AI 单元，`assemble-clean` 只生成兼容 cleaned book。

## 重点 recall 与质量门

高优先级固定为角色、武功、招式、关键物品、事件。recall 只针对高优先级类别的确定性覆盖缺口创建 `recall:<category>` 或 `supplement:<category>`；补漏只更新对应投影，不重跑四域。

地点、势力、普通对白和 chapter_summaries 的非结构性完整度问题只记 warning，不创建 recall。任何类别的 JSON 结构错误、缺失原文证据、悬空引用、候选未闭合或不唯一迁移始终阻塞。

`verify` 独立阻断：

- 武功/招式混淆、未由原文明确定名的招式、原文明示但引用错误或悬空的所属武功；
- 普通物品进入关键物品库；
- 核心/重要事件缺参与者或结果；
- 稳定 ID、引用闭包、证据章号、安装或归档不完整。

首次 `verify` 固定质量样本并以 `QUALITY_REVIEW_REQUIRED` 停止。读取 [prompts/sample-quality.md](prompts/sample-quality.md)，提交 `quality:sample` 后复验。重点类别独立满足 95% 原文支持率；低优先级样本不足只产生 warning，不能抵消重点类别失败。

## 有界失败与恢复

每个 `chapter:*`、`distill:*`、重点 recall/supplement 和 `quality:sample` 最多 3 次总提交：初始提交、至多一次格式修正、至多一次语义补救。相同输出、相同标准化错误或 A→B→A 震荡会提前进入 `manual_review`。

领域草稿含 `pending` 时，`accept` 以 `DOMAIN_PENDING_UNRESOLVED` 拒绝且不写 accepted artifact。若旧实现已接受含 `pending` 的领域决定，`assemble-merge` 只恢复对应 `distill:*` 单元为下一 attempt，保留 attempts 与 output history，并受控释放该领域旧 artifact；这不是任意覆盖 accepted artifact 的入口。

原文明确定名、但原文未说明所属或归属武功的招式必须独立保留，最终允许 `source_skill: null`。只有原文明示归属时才填写关联；不得猜测或虚构所属武功，任何非空但悬空的武功引用仍然阻断。

`manual_review` 是人工终态；不得自动 `reset-unit`。待处理单元的下一 staging attempt 固定为持久化 `attempts + 1`：精确文件存在时直接串行 `accept`；精确 staging 不存在时才派发新子代理，并要求其完整读取原文。小于该编号的 staging 不得重交。成功或拒绝后 staging 都由 CLI 删除。状态为 done 且输入哈希未变化的单元不重读、不重做。

## 安装、归档与指标

```bash
node "$CLI" build-final "$NOVEL"
node "$CLI" verify "$NOVEL"
node "$CLI" accept "$NOVEL" --unit quality:sample --draft <staging>
node "$CLI" verify "$NOVEL"
node "$CLI" install "$NOVEL"
node "$CLI" verify "$NOVEL" --installed
node "$CLI" archive-run "$NOVEL" --run <run-id>
```

只有 `archive-run` 成功、九类数组已安装、无人工问题时才能声明完成。归档内 `reports/run-metrics.json` 记录 prepare、章节、注册表、领域、定向 recall、质量、install、archive 和 total 耗时，以及 AI 单元 planned/done/attempts、格式修正、语义补救、最大 AI 输入字节和候选数量变化；归档回执绑定 metrics hash。

中短篇 fresh run 以 45 分钟为目标、60 分钟为硬上限。超时不能放宽正确性门，也不能废弃已验证数据。
