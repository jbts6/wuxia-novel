# 技术设计：陆小凤传奇知识库生成

## 1. 设计目标

在**不改 G1–G5 门禁语义**的前提下，让多卷合订本《陆小凤传奇》能走通 `generate-kb` 四阶段，产出一套原文 grounding 的八类知识库。

## 2. 边界

| 在范围内 | 不在范围内 |
|----------|------------|
| 本小说目录下的 split / build / data / reports | 改写 quality gate 公式 |
| 为多卷重置/楔子做的**最小**切分兼容 | 分卷多目录或多套 KB |
| 按 skill 规范的全窗扫描与归并 | human-gold 制作 |
| 门禁脚本原样验收 | 其他小说数据回填 |

## 3. 架构总览

```
陆小凤传奇.txt
    │
    ▼
[0] 切分兼容（本任务前置）
    split-config.json + split-chapters 顺序编号
    → ch_split/ch_001..N.txt + build/manifest.json
    │
    ▼
[1] Prepare Source
    prepare-source.js
    → build/source-index.json
    → build/scan-manifest.json
    │
    ▼
[2] Inventory From Source
    每 window × {named-inventory, event-dialogue}
    → append build/candidates.jsonl
    → 更新 scan-manifest.completed_window_ids
    │
    ▼
[3] Reconcile And Enrich
    decisions / events / 八类 data/*.json
    → build/decisions.jsonl, build/events.json, data/*
    │
    ▼
[4] Gap Audit And Gate
    gap-audit（≤2 轮）→ 再 Stage3（若有新增）
    → validate / verify / cross-validate / audit-recall / assess-quality / generate-summary
```

## 4. 切分与章节编号

### 4.1 问题

1. 标题数字 `第N回` 每卷重置 → 默认 `ch_00N` 互相覆盖。
2. `楔　子` 不匹配默认 `^第…[回章]` → 首段可能未形成独立章节且可能被丢掉（当前实现从第一个匹配 header 才开始 `current`）。

### 4.2 方案（推荐）

**A. 小说级配置 + 顺序编号开关（优先）**

在 `古龙/陆小凤传奇/split-config.json`：

- `chapterPattern`：匹配 `楔　子` / `楔子` 与 `第N回…`
- `numberPattern`：可保留用于解析原回目
- `numbering: "sequential"`（新增配置；默认省略 = 现有 title-number 行为，保证连城诀等不回归）

`split-chapters.js` 改动：

1. 读到 header 时，若 `numbering === "sequential"`，则 `n = chapters.length + 1`（发现顺序），**不**用 `cnToNum(第N)` 作文件号。
2. 文件仍写 `ch_${pad(n)}.txt`。
3. manifest 每章增加（若可解析则填）：
   - `title`：原行全文（含「第一回　有四条眉毛的人」）
   - `volume`：最近一次出现的 `小说：古龙《…》` 卷名；楔子为 `楔子` 或 null
   - `original_number`：标题中的回目数字（可选）
4. 对「第一个 header 之前」的正文：若存在且非空，作为 `ch_001`（楔子）或并入首章——本小说首行即楔子标题，pattern 匹配后即为 ch_001。
5. **重复标题 TOC 逻辑**：本合订本各回副标题不同，「第一回」整行不重复，现有 “keep last duplicate title” 不会误删；无需为本小说改 TOC 策略。

**B. 备选（仅当不想改脚本）**

手写/本地脚本产出 `ch_001..N` 与 manifest，绕过 title-number；仍须通过 `prepare-source` 的 source alignment。优先 A，避免一次性脚本。

### 4.3 下游兼容

- `lib/source.js` 只认 `ch_(\d+).txt` 的数字为 chapter → 全局顺序号完全兼容。
- window id：`ch{NNN}_w{MMM}`，候选 id 同 skill 约定。
- 摘要/事件中的 chapter 字段用全局号；人类可读标题来自 manifest.title + volume。

## 5. Stage 2 扫描执行模型

### 5.1 输入隔离

每个 window 只给：

- 当前 window 文本
- 章节内 `line_start` / `line_end`
- 对应 prompt（`named-inventory.md` 或 `event-dialogue.md`）

禁止提供：现有 `data/*`、baseline、百科、其他窗口摘要。

### 5.2 产出

- 逐行 append `build/candidates.jsonl`
- 每完成一个 window，把 id 写入 `scan-manifest.passes[pass].completed_window_ids`
- 可中断恢复：只扫未完成 window

### 5.3 工作量量级（估）

- ~66 章 × 每章约 `ceil(lines/100)` 窗（120 行 / 重叠 20 → 步进 100）
- 三类 pass：named-inventory + event-dialogue + gap-audit（gap 最多 2 轮）
- 需按章或按批推进，并在任务 notes / journal 记录进度

### 5.4 执行责任

- 机械脚本：`split-chapters`、`prepare-source`、validate/verify/… 由主会话或实现 agent 直接跑。
- LLM 扫描与归并：按 skill prompts 执行；可用 sub-agent 分批，但**必须**统一写同一 `candidates.jsonl` / `decisions.jsonl`，且遵守 source hash 一致。

## 6. Stage 3 归并规则（本小说要点）

- **跨卷同人同物**：陆小凤、花满楼、西门吹雪、司空摘星等跨卷出现 → merge 为同一 final id，aliases 与多章 source_refs 合并。
- **skill vs technique**：灵犀一指等为 skill；明确「一招/一式」名为 technique。
- **武学**：禁止因 non_major/trivial reject；类别错用 redirect；证据不足用 not_source_grounded。
- **对话**：`event|both` 绑 `event_id`；`persona|both` 带 `trait_tags`；缺覆盖写 `semantic-exemptions.json`。

## 7. Stage 4 与门禁

严格按 pipeline：

```bash
node scripts/validate-inventory.js "古龙/陆小凤传奇"
node scripts/verify.js "古龙/陆小凤传奇"
node scripts/cross-validate.js "古龙/陆小凤传奇"
node scripts/audit-recall.js "古龙/陆小凤传奇"
node scripts/assess-quality.js "古龙/陆小凤传奇"
node scripts/generate-summary.js "古龙/陆小凤传奇"
```

成功定义：`reports/quality_report.json` 中 `completion_gate_passed: true` 且 G1–G5 各自 `passed: true`。

## 8. 兼容与回归

| 变更 | 风险 | 缓解 |
|------|------|------|
| `split-chapters` 增加 `numbering: sequential` | 默认路径改行为 | 默认保持 title-number；仅配置开启 |
| 扩展 chapterPattern 含楔子 | 其他小说误匹配短行 | 仅写在本小说 `split-config.json`，不改全局 default 除非同样需要 |
| 大量 candidates | 磁盘/上下文 | jsonl 追加；分批 reconcile |

回归检查：对 `金庸/连城诀` 在**不改其 split-config** 下重跑 split（或 dry 对比 chapter 数/文件名）应与改前一致；若仓库不便重跑，则用单元测试/fixture 覆盖 sequential 分支。

## 9. 回滚

- 切分工具改动：git revert skill 脚本；删除本小说 `ch_split/`、`build/` 即可。
- 生成中途失败：保留 `scan-manifest` 与已写 candidates，修源后从断点续扫；**source hash 变则清空 candidates/decisions 重来**。
- 门禁未过：不得宣称完成；按 G1–G5 reasons 回对应 Stage，禁止改门禁阈值凑 PASS。

## 10. 关键文件

- `.claude/skills/generate-kb/scripts/split-chapters.js` — 顺序编号开关
- `.claude/skills/generate-kb/scripts/prepare-source.js` / `lib/source.js` — 一般无需改
- `古龙/陆小凤传奇/split-config.json` — 本小说切分配置
- `古龙/陆小凤传奇/{ch_split,build,data,reports}/` — 产物
- `.claude/skills/generate-kb/prompts/{named-inventory,event-dialogue,gap-audit}.md`
- `.claude/skills/generate-kb/{pipeline,schemas,review,constants}.md`
