# generate-game-kb 全流程审计

日期：2026-07-16
范围：`.agents/skills/generate-game-kb` 的 Skill 文档、提示词、控制器、验证/安装逻辑、测试、Trellis 规范及 Dashboard 消费端。
性质：只读审计；本报告不修改流程实现。

## 结论

方向是对的：删除 `locations`、`dialogues`、`events`，压缩最终字段，并把 AI 产物统一为 YAML，确实能显著降低调用次数、格式返工和跨类别引用复杂度。

但当前 `main` 上不是“新流程已经完成、还可继续优化”，而是“新四域文档覆盖在旧九类控制器之上”。此时不应继续叠加局部删改，应先统一唯一契约。当前流程无法端到端运行：

- 7 个生产 JS 文件存在语法错误，`flow.js` 无法正常加载。
- 全量测试被语法错误阻断；单独运行 Skill 契约测试时，11 个测试仅 1 个通过。
- JSON → YAML 迁移只完成了生产端的一部分：prompts、accepted 写入和 finalizer 已使用 YAML，但 Skill 中部分 staging 示例、控制器读取路径、测试和 Trellis 规范仍残留 JSON 契约。
- 新文档声明的四域与 `assemble` 命令，和控制器仍实现的旧域、merge/clean 命令面不一致。
- 最终 YAML 即使安装成功，Dashboard 也只读取 JSON；安装器还会把旧 JSON 当作“未知文件”保留下来，导致界面继续展示旧数据。

因此建议按以下顺序推进：先恢复一致性和可运行性，再删除旧阶段，最后做并发和重试优化。

## P0：立即修复的阻断项

### 1. 删除三类产物时留下了 7 个语法错误

逐文件 `node --check` 的失败位置：

- `scripts/lib/book-assembly.js:223`
- `scripts/lib/candidate-registry.js:64`
- `scripts/lib/chapter-contract.js:113`
- `scripts/lib/clean-obligations.js:180`
- `scripts/lib/coverage.js:64`
- `scripts/lib/gaps.js:149`
- `scripts/lib/semantic-work.js:253`

这些不是测试期望差异，而是解析阶段就会失败。例如 `book-assembly.js` 删除了 `if (dialogues)` 条件，却留下了条件体和孤立右花括号；`chapter-contract.js` 同时留下未定义的 `category` 循环体和 `draft.events` 校验。

建议：不要继续逐行删除三类名称。以函数为单位删除旧分支，然后先加一条最低成本的 CI/本地门禁：

```text
node --check <所有生产 .js>
node --test <skill tests>
```

### 2. JSON → YAML 迁移尚未完成闭环

当前证据：

- `SKILL.md:14-23,60-62` 声明 YAML 最终文件、YAML 草稿和 YAML accepted 产物。
- `prompts/extract-chapters.md:5-7,86`、`prompts/distill-domain.md:5-7,79` 强制模型输出 YAML。
- `scripts/lib/accept.js:45-46,95,125,138,250-251,296,304` 生成 `.yaml` 路径并调用 `readYaml`。
- `scripts/lib/finalize.js:11-16,214-215` 输出五个 `.yaml` 文件。
- `scripts/lib/verify.js:37-57` 使用 `js-yaml` 读取最终文件。
- `scripts/yaml2json.js` 仍存在，但从 `flow.js` 的生产依赖图不可达，是死代码。

建议一次性完成严格 YAML 迁移：

1. AI 草稿、accepted、final 全部使用 `.yaml`。
2. `accept` 继续使用 `readYaml`，并统一结构错误码为 `DRAFT_YAML_INVALID`。
3. `finalize` 只用 `atomicWriteYaml`；`verify` 只从 YAML 读取最终数据。
4. 保留 `readYaml`、`atomicWriteYaml` 和生产路径中的 `js-yaml`；只删除不可达的 `yaml2json.js` 及其他格式转换路径。
5. 修正 Skill 中 staging `.json` 示例、Trellis 规范和旧测试，不保留 JSON/YAML 双格式兼容层。`progress.json`、manifest、receipt 和 `status --json` 等由控制器生成的机器状态可继续使用 JSON。

### 3. accepted 章节的扩展名在同一控制器内自相矛盾

- `scripts/lib/accept.js:94-96` 把章节写为 `accepted/chapters/ch_NNN.yaml`。
- `scripts/flow.js:83-88` 只读取 `ch_NNN.json`。
- `scripts/flow.js:140-143` 在 `prepare-merge` 中也按 `.json` 计算 accepted hash。

结果是章节即使 accept 成功，后续仍会认为没有已接受章节。应把 `flow.js` 的章节读取和 accepted hash 计算统一改为 `.yaml`；`accept.js` 当前写 YAML 的方向是正确的。

### 4. 新四域和旧四域同时存在

- `scripts/lib/domain-work.js:11-15` 生成 `distill:characters|skills|items|factions`。
- `scripts/lib/accept.js:38` 和 `scripts/lib/semantic-work.js:529` 仍只接受 `distill:plot|martial|items|world`。
- `tests/skill-contract.test.js:27,40-42,110` 仍把旧域当作正确契约。

这会使 `characters`、`skills`、`factions` 三个新域在提交时被拒绝。应保留新四域，删除旧域名称，不建立别名兼容。

### 5. 文档命令不存在，控制器仍要求旧 merge/clean 链

`SKILL.md:103` 要求执行 `flow.js assemble`，但 `scripts/flow.js` 没有 `assemble` 分支，仍暴露：

```text
prepare-merge → assemble-merge → prepare-clean → assemble-clean → build-final
```

建议用一个确定性的 `assemble` 替换这五步；`status --json` 返回唯一 `next_action`，避免 Skill 文档手工复制内部命令顺序。

### 6. 字段精简只改了表面，内部投影仍读取旧字段

当前至少有四条会产生错误数据的链路：

- 域契约要求 `rank`，但 `finalize.js:137,161` 读取 `record.power_rank`，最终人物/武功 `rank` 会变成空字符串。
- `domain-work.js:24-27` 的 skills patch 不允许 `faction`/`faction_name`，但 `finalize.js:153-155` 只从 `faction_name` 解析势力，skill faction 无法闭合。
- 章节提示词输出 `chapter_summary.summary`，`chapter-contract.js` 校验 `draft.summary`，`domain-assembly.js:121-126` 又读取 `chapter.summary.text`；正常草稿最终会被拒绝或退化为“本章摘要待补充”。
- `items.tags` 已从 schema/finalizer 删除，但 `SKILL.md` 最终字段表仍保留 `tags`。

应为每类只定义一套端到端字段名，并让章节 schema、域 patch、assembler、finalizer、verify 和 Dashboard 迁移测试共同引用它。

### 7. 最终输出与 Dashboard 不兼容

Dashboard 明确读取：

```text
characters.json
factions.json
skills.json
items.json
chapter_summaries.json
```

见 `dashboard/src/types/library.ts:4-11`。当前 fast flow 输出 YAML；`install.js:399-402` 复制新 YAML 后，还会把旧 JSON 作为未知条目保留。于是安装后 Dashboard 仍读取旧 JSON，而不是本次生成结果。

字段也存在迁移断点：

- Dashboard 人物归一化读取 `role` 和 `power_rank`，新契约输出 `level` 和 `rank`。
- Dashboard 的人物 `biography`、`skills`、`items` 已有兼容路径。
- Dashboard 当前把 `skills[].techniques` 归一化为 `string[]`，新契约输出 technique 对象数组，对象会被丢弃。

建议把 Dashboard 的 scanner/server 直接切换为读取并解析五个 YAML 文件，安装时删除或替换旧的同名 JSON，不建立文件格式双读层。字段 normalizer 可暂时保留 `level ?? role`、`rank ?? power_rank`，并把 technique 对象投影为 `name`；待旧字段淘汰后再移除字段兼容。

## 建议的唯一目标流程

```text
prepare（确定性）
  ↓
chapter:NNN（每章一次 AI；3 并发；四类候选 + chapter_summary）
  ↓
distill:factions
  ↓
distill:characters / distill:skills / distill:items（并发）
  ↓
assemble（确定性：合并、ID、引用投影、五个 YAML）
  ↓
verify（确定性：schema、证据、候选闭环、引用闭包、章节完整性）
  ↓
install（原子替换并立即复验 installed data）
  ↓
archive-run
```

这是当前 `SKILL.md` 想表达的流程。重点不是再增加一个“兼容阶段”，而是让控制器真正只实现这条路径。

## 可以直接去掉或折叠的环节

### A. 删除独立 merge/clean 双层

建议删除/折叠：

- `prepare-merge`
- `assemble-merge`
- `prepare-clean`
- `assemble-clean`
- `build-final`

原因：新的域蒸馏已经同时表达 `keep|merge|reject|pending + patch`；再做一次 merge decision 和 clean decision 是重复语义。保留一个 `assemble`，负责：

1. 展开域 decisions。
2. 拒绝未解决 pending。
3. 分配稳定 ID。
4. 解析 faction、skill、item 引用。
5. 投影五个最终 YAML。

### B. 把 coverage/resolution 合入 verify

建议删除独立命令：

- `check-coverage`
- `check-resolution`
- `recall:*`
- `supplement:*`

快速版已要求每个 worker 完整读取一章，且每个候选必须在域 decisions 中闭环。此时应保留确定性完整性检查，而不是再开启额外 AI 补漏循环：

- 所有章节都有 accepted draft 或结构化 `none_found`。
- chapter summary 数量与章节数一致。
- 所有候选恰有一个 keep/merge/reject 结果。
- 所有最终实体保留至少一个合法 source ref。
- 所有引用可闭合。

这些检查统一在 `verify` 阻断。数量稀疏只做 warning，不创建新 work item。

### C. 删除质量抽样和二次“游戏素材”构建

以下内容与精简最终产物重复，可从正常路径去掉：

- `quality:sample`
- `sample-quality.md`
- `select-materials.md`
- `reports/game_materials.json`
- `game-materials.js`
- 固定配额和 95% 抽样门禁

四类最终实体本身就是游戏素材；再生成一个素材索引并进行固定样本审查，只会重建旧九类流程的复杂度。若仍需要质量抽样，可作为可选诊断命令，不能阻塞 45 分钟快速路径。

### D. 删除旧事件/对白/地点专属逻辑

不应保留空兼容文件，也不应保留以下概念：

- important event / quote status
- dialogue-to-event coverage
- event participant closure
- dialogue/persona sampling quota
- location recall 与 location quantity
- technique 独立顶层类别

招式只在 `skills[].techniques[]` 内验证 `name` 与 `named_in_source`。

### E. 删除独立格式修正阶段

统一 YAML 后，把三次提交缩为最多两次更合适：

1. 初始提交。
2. 根据结构化 validator errors 修正一次；这一次可同时处理 YAML 解析或语义问题。

相同输出、相同错误或第二次仍失败，直接进入 `manual_review`。YAML 已降低严格 JSON 常见的引号、逗号和转义返工，不再维护独立 `format_attempts` 和“格式修正后再语义补救”的第三次路径。

## 可进一步优化但不是 P0 的项目

### 1. 取消 factions 的串行前置（可节省约 2–3 分钟）

当前四个域的 `entry_ref` 已由候选 registry 一次稳定生成，assembler 也可以在全部 decisions 到齐后统一应用 faction alias/merge 映射。因此可以让四域全部并发，characters/skills 只输出 late-bound faction ref/name，最后统一解析。

若暂时不愿改引用投影，则保留 factions 先行；不要一边同时创建四个 work item，一边在文档中宣称它是运行时依赖。

### 2. chapter summary 不要单独建工作项

保留在章节提取的同一次 AI 输出中即可。所谓“AI 尝试数为 0”应准确表述为“无独立 summary AI 调用/工作项；assembler 只机械收集已接受章节摘要”，而不是声称摘要文本本身由机械生成。

### 3. 用一个声明式契约消除漂移

当前同一事实至少复制在：

- `SKILL.md`
- `schemas.md`
- 两个 prompts
- 多个 JS 常量/正则
- `.trellis/spec/backend/quality-guidelines.md`
- `tests/skill-contract.test.js`
- Dashboard normalizer

建议建立一个控制器可导入的 `contract.js` 或 JSON Schema，单点声明：

- 四类实体 + chapter summaries
- 五个 `.yaml` 文件名
- domain unit 名称
- draft/final 字段
- rank、level、item type 枚举
- 引用字段和最终 ID 前缀

文档只解释判断规则，不再复制机械列表；测试直接遍历同一契约。

### 4. 让 status 返回 next_action

保留 `progress.json` 和 hash-based resume，但让 `status --json` 返回唯一下一动作。这样可以删除 Skill 中容易漂移的内部命令清单，同时避免跨会话猜测进度。

## 建议保留的保护机制

精简不等于删除以下机制：

- 原文是唯一事实来源；不读旧 final data 作为事实。
- 每章完整读取，accepted 产物绑定 source/input hash。
- 草稿实体必须有 `source_refs`；最终文件可按消费需求省略，但归档证据链必须存在。
- 主控制器独占 progress、accepted、final 和 install 写入。
- 429 时并发 `3 → 1`，传输失败不消耗语义 attempt。
- 稳定 ID、候选闭环和引用闭包由脚本确定性验证。
- install 使用原子目录替换，并在切换前后复验。
- run 完整归档，支持中断恢复和事后定位。

这些机制带来的主要是脚本成本，而不是额外 AI 时间，值得保留。

## 候选删除规模

当前 fast skill 约有 8,554 行生产 JS、5,608 行测试。若按上述目标流收敛，以下旧层是候选删除/重写集合：

```text
book-assembly.js
category-contract.js
clean-obligations.js
candidate-ledger.js
gaps.js
supplements.js
semantic-work.js
game-materials.js
quantity.js
coverage.js
priority.js
quality.js
```

这组约 3,127 行生产代码；另有 143 行旧 prompts 和 104 行 `yaml2json.js`。不是要求盲删全部文件：其中仍有价值的“候选闭环、引用校验、原子写入”应迁入新的 `assemble`/`verify`，其余旧九类语义再删除。

## 推荐实施顺序

1. **恢复绿色基线**：先写新四域 + 五 YAML 契约测试，确认在当前实现上失败；修复 7 个语法错误。
2. **完成 YAML 和字段名统一**：同时更新 Skill、schemas、prompts、控制器、Trellis spec、测试与 Dashboard YAML 读取链路。
3. **建立单一 `assemble`**：用新域 decisions 直接生成最终五个 YAML。
4. **把完整性检查合入 `verify`**：移除 recall/supplement/quality-sample 正常路径。
5. **删除旧模块和旧测试**：以生产依赖图与新端到端测试证明不再需要。
6. **做性能优化**：四域并发、两次 attempt、`status.next_action`。
7. **跑一个 3 章 fixture 和一本真实 20±章小说**：验证恢复、重试、安装、Dashboard 展示和 45 分钟目标。

## 验收标准

- 所有生产 JS 通过 `node --check`。
- 全部 skill tests 通过，且测试中不存在 `events|dialogues|locations` 顶层类别和旧 `distill:plot|martial|world`。
- generate-game-kb 的 AI 草稿、accepted 和 final 路径不存在 `.json`；生产路径保留并统一使用 `.yaml`、`readYaml` 和 `js-yaml`，不可达的 `yaml2json.js` 已删除。
- `status --json` 能从任意中断点给出唯一下一动作。
- 3 章 fixture 能走完 `prepare → chapters → 4 domains → assemble → verify → install → archive`。
- 安装目录只有五个当前 YAML，不残留旧的同名 JSON；Dashboard 能直接读取 YAML，并正确显示 level/rank 与 techniques。
- 章节数、摘要数、candidate decision 闭环、source refs 和最终引用闭包全部通过。
- 真实约 21 章小说在 45 分钟内完成，且没有 JSON↔YAML 格式转换脚本或额外 recall/quality AI 回合。
