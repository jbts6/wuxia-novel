# 技术设计：原文先行的武侠知识库生成流程

## 1. 设计目标

将 `generate-kb` 从“先凭模型记忆生成完整 JSON，再对已生成内容做 locate/verify”改为“先扫描原文建立证据账本，再归并、丰富并生成兼容 JSON”。

设计不承诺在没有人工金标时数学证明绝对召回；它必须做到：

1. 不把固定低数量阈值伪装成完整性。
2. 让每个原文窗口、每个候选和每个淘汰决定可审计。
3. 用独立查漏结果和未解释原文信号衡量召回风险。
4. 让旧版《连城诀》和当前《天龙八部》这类明显不完整产物硬失败。

## 2. 核心原则

### 2.1 召回与丰富分离

召回阶段只做低认知负担的工作：名称、类别提示、原文位置和短引文。不得同时生成 biography、personality、effects、relationships 等复杂字段。复杂 schema 会消耗输出预算并诱发漏项。

丰富阶段只处理已建立证据的 canonical candidate，并且只能使用该候选关联的原文窗口补充字段。

### 2.2 原文证据先于结论

每个候选先有 source reference，再有名称归一化、分类、重要性和描述。模型先验可提出检索词，但候选没有原文命中就不能进入正式账本。

### 2.3 不做可补偿总分

角色多不能补偿招式少，对话真实不能补偿对话毫无代表性。完成状态由一组逐项 hard gate 的逻辑与决定，不再由加权平均分决定。

### 2.4 保留信息，消费端筛选

所有原文明确定名且可定位的武功与招式均保留，用 `importance` 分级。其他类别按剧情作用筛选，但淘汰必须有证据和标准原因。

## 3. 四阶段架构

### Stage 1：Prepare Source

输入：`<novel>/<novel>.txt`、`split-config.json`。

输出：

- `ch_split/*.txt`：继续兼容现有目录。
- `build/source-index.json`：source SHA-256、章节、稳定的章节内行号、窗口 ID、窗口范围和重叠信息。
- `build/scan-manifest.json`：后续各扫描通道的窗口完成状态。

章节过长时按稳定行窗口拆分，窗口间小幅重叠。最终 `SourceRef.line_start/line_end` 仍使用章节内行号，新增中间元数据保存 source hash 和 window ID。

### Stage 2：Inventory From Source

对每个 source window 执行两个职责单一的 source-bound map：

1. `named-inventory`：角色、武功、招式、物品、地点、门派/势力的命名候选。
2. `event-dialogue`：事件原子、事件中的关键原话、体现人物特点的原话。

模型只接收当前原文窗口和最小 schema，不接收现有 `data/*.json`、baseline 或小说百科知识。

统一写入 `build/candidates.jsonl`：

```json
{
  "candidate_id": "cand_ch001_w003_0001",
  "category_hint": "skill",
  "name": "躺尸剑法",
  "chapter": 1,
  "source_ref": {
    "line_start": 120,
    "line_end": 123,
    "text": "原文节选"
  },
  "discovery_pass": "named-inventory",
  "window_id": "ch001_w003"
}
```

每个窗口即使没有候选，也必须在 `scan-manifest.json` 标记成功扫描。缺失窗口、解析失败或空白占位都不能进入下一阶段。

### Stage 3：Reconcile And Enrich

先对候选做名称归一、别名合并和跨类别重定向，再生成 `build/decisions.jsonl`：

```json
{
  "candidate_ids": ["cand_ch001_w003_0001"],
  "decision": "keep",
  "canonical_name": "躺尸剑法",
  "final_category": "skill",
  "importance": "important",
  "reason": "原文明确定名的剑法",
  "final_id": "skill_tang_shi_jian_fa"
}
```

允许的 decision：

- `keep`：进入最终数据。
- `merge`：合并到 canonical candidate，必须指向 `final_id`。
- `redirect`：纠正类别后保留。
- `reject`：仅允许 `duplicate`、`generic_unnamed`、`not_an_entity`、`not_source_grounded`、`trivial`、`non_major` 等标准原因。

武功/招式不得因 `non_major` 或低频被 reject；如类别错误必须 redirect，不能静默删除。

丰富时只读取候选关联的原文窗口，生成兼容的八类最终数据：

- `characters.json`
- `factions.json`
- `locations.json`
- `skills.json`
- `techniques.json`
- `items.json`
- `dialogues.json`
- `chapter_summaries.json`（主要事件继续放在 `key_events`）

可新增可选字段，不删除 dashboard 已使用字段。`skills.json` 与 `techniques.json` 都保留命名招式的查询能力：skill 可内嵌 technique ID，独立 `techniques.json` 保存完整招式条目。

### Stage 4：Independent Gap Audit And Gate

查漏 pass 再次逐窗口读取原文，但只接收该窗口已发现名称的简表，不接收描述和质量报告。其任务是找出缺失候选，而不是评价已有内容。

新候选写入同一 ledger，`discovery_pass=gap-audit`。只要出现新的、原文可证且应保留的候选，当前版本就不能完成；回到 Stage 3 归并一次。最多允许两轮，防止无限循环。最终必须满足：

- 所有窗口的 named/event-dialogue/gap 三类扫描完成。
- 所有候选都有 decision，无 unresolved。
- gap audit 新增的有效候选已归并，最后一轮没有新的有效武功、招式或高重要性实体。
- 确定性词法审计发现的高置信武学/招式信号均被 final 或 reject decision 解释。

## 4. 分类与保留规则

### 4.1 武功与招式

- 明确定名且原文可定位：全部保留。
- 武功是体系、功法、武学门类；招式是具体一招、一式或命名变化。
- 同一招式既可由 skill 引用，也必须能在 `techniques.json` 独立查询。
- `importance` 仅分级，不参与删除。

### 4.2 物品

保留剧情钥匙、信物、秘籍、独特兵器、毒物/药物、人物标志物。普通器皿、食物、环境物和人体部位默认淘汰。地点、武功误入物品时必须 redirect。

### 4.3 角色、地点、势力

基于跨章出现、关键事件参与、关系改变、剧情后果和人物辨识度判断是否保留。命名但纯背景的对象可以 reject，但必须保留 decision。

### 4.4 事件与对话

事件分 `main|branch|detail`。每个 main event 必须有：

- 原文证据窗口。
- 参与角色。
- 至少一条关键对话，或结构化 `no_suitable_dialogue` 理由。

每个 core/important 角色必须有体现人物特点的对话，或结构化 `no_suitable_dialogue` 理由。对话新增可选字段：

- `selection_type`: `event|persona`
- `selection_reason`
- `event_id`
- `trait_tags`
- `context`

真实性使用规范化后的完整引文匹配，不再用前 15 个字符命中。

## 5. 完成门禁

`completion_gate_passed` 仅在所有 hard gate 通过时为 true：

### G1 Source Coverage

- source hash 存在且与当前原文一致。
- 三类扫描覆盖 100% source windows。
- 每章有且仅有一个 chapter summary。

### G2 Ledger Closure

- candidates 全部有 decision。
- keep/merge/redirect 全部能追到 final ID。
- reject reason 合法；武功/招式不存在 importance-based reject。

### G3 Evidence Integrity

- 正式实体至少一个 grounded source ref。
- 重要描述字段有对应 source refs。
- 对话完整引文 100% 原文命中。
- `verification_report` 的 unverified/weak 阻塞项为 0；不能只读取局部 entity ratio 而忽略 grand ratio。

### G4 Recall Evidence

- 最后一轮 gap audit 没有未处理的有效候选。
- 高置信词法信号全部被解释。
- 所有命名武功/招式候选进入 final 或以非武学/未命名/重复等证据原因处理。
- 可配置的人类回归 `must_include` 全部命中。

### G5 Semantic Coverage

- 每个 main event 有关键对话或明确豁免。
- 每个 core/important 角色有人物特征对话或明确豁免。
- cross-reference、ID、枚举和 skills/items 分类校验无阻塞错误。

不再计算可补偿的 `honest_overall_score` 作为完成依据。报告保留各 gate 的原始计数和失败原因。没有人工金标时，gold completeness 明确为 `no_gold`。

## 6. Baseline 策略

删除 LLM 自动生成 baseline 参与质量评分的路径。可选人工金标必须：

- 位于独立 `audit/gold.json`。
- 声明 `provenance: human_curated`。
- 绑定 source SHA-256。
- 只保存 source-grounded 的 `must_include` / `must_exclude` 和证据位置。

不满足以上条件的文件只可作为提示材料，不可计算召回率或完成分数。

## 7. 代码边界

计划新增：

- `scripts/lib/source.js`：source hash、章节行号、窗口、规范化引文匹配。
- `scripts/lib/ledger.js`：JSONL 读写、candidate/decision schema、闭环校验。
- `scripts/prepare-source.js`：生成 source index 和 scan manifest。
- `scripts/validate-inventory.js`：扫描覆盖、candidate 与 decision 校验。
- `scripts/audit-recall.js`：gap/词法/回归清单审计。

计划重写或收敛：

- `assess-quality.js`：改为 hard-gate 聚合器。
- `verify.js` / `verify_dialogues.js`：共享 exact source matcher。
- `generate-summary.js`：消费新 gate report，不依赖 baseline 总分。
- `pipeline.md`、`SKILL.md`、prompts：改成四阶段说明和三类短 prompt。

旧 `generate-baseline-prompt.js`、`compact-mention.js`、`extract-keywords.js`、`coverage-gap.js` 等先标为 legacy；新流程验证稳定后再删除，避免一次改动破坏旧知识库维护能力。

## 8. 兼容与迁移

- 最终八个 JSON 文件名与现有主要字段保持兼容。
- 新增字段均为 optional，dashboard 旧代码可忽略。
- 现有知识库不自动声明合格；先运行 legacy audit 生成缺口报告，再决定是否重生成。
- 当前《天龙八部》应在新门禁下失败，但本任务不以修改数据来迎合门禁。
- 质量报告 schema 允许重构；保留 `completion_gate_passed` 便于现有总览工具迁移。

## 9. 取舍

- 逐窗口双 map + gap audit 比单次生成调用更多，但职责更短、可并行、可恢复，并减少大规模人工返工。
- 保存 candidates/decisions 会增加中间文件体积，但换来可追踪召回与淘汰原因。
- 无人工金标时不输出“95 分完整性”会降低表面可读性，但避免错误完成信号。

