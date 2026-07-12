# 实施计划：重构 generate-kb

## 实施顺序

### 1. 固化契约与回归失败案例

- [x] 在 `schemas.md` 增加 source index、scan manifest、candidate ledger、decision ledger 和可选人工 gold schema。
- [x] 为最终八类 JSON 记录必须兼容字段与允许新增字段。
- [x] 增加旧版《连城诀》低召回案例：21 角色、3 门派、4 地点、5 武功、3 招式、4 物品、4 对话必须失败。
- [x] 增加当前《天龙八部》指标案例：dialogue chapter coverage 28%、characterFit 0、grand grounded 55.5%、summary proxy 2 必须失败。
- [x] 先写 hard-gate 单元测试，使上述案例在旧实现上失败。

### 2. 建立共享 source 与 ledger 基础设施

- [x] 新建 `scripts/lib/source.js`，统一 source hash、章节内行号、窗口切分、文本规范化和完整引文匹配。
- [x] 新建 `scripts/lib/ledger.js`，统一 JSONL 解析、schema 校验、candidate 去重和 decision 闭环。
- [x] 新建 `scripts/prepare-source.js`，复用现有章节拆分能力并生成 `build/source-index.json`、`build/scan-manifest.json`。
- [x] 覆盖超长章节、多窗口重叠、CRLF、中文标点和 source hash 变化测试。

### 3. 实现原文候选账本

- [x] 将通用大 prompt 拆成 `named-inventory.md`、`event-dialogue.md`、`gap-audit.md` 三个短 prompt。
- [x] prompt 强制只消费当前 source window，不读取 `data/*.json` 或模型先验事实。
- [x] 新建 `scripts/validate-inventory.js`，校验窗口覆盖、source ref、candidate ID、类别和扫描完成状态。
- [x] 实现 overlap 去重，但保留全部 occurrence 和 discovery pass。
- [x] 对 skills/techniques 添加“明确定名且 grounded 即不可按重要性删除”的校验。

### 4. 实现归并、分类与最终数据兼容

- [x] 定义 keep/merge/redirect/reject 状态及标准 reason enum。
- [x] 校验每个 candidate 恰好被一个 decision 处理，所有保留决定可追到 final ID。
- [x] 修订 `skills.json` / `techniques.json` 契约，使所有命名招式在 `techniques.json` 可独立查询，同时允许 skill 引用 technique ID。
- [x] 为 dialogue 增加必需的选择目的与上下文证据字段，以及按类型必需的 `event_id`、`trait_tags`。
- [x] 为 main event 和 core/important character 实现 dialogue-or-exemption 校验。
- [x] 运行 dashboard 类型检查，确认新增字段不破坏现有消费者。

### 5. 替换验证与质量门禁

- [x] 让 `verify.js`、`verify_dialogues.js` 复用 `scripts/lib/source.js`，删除 15/40 字符前缀命中捷径。
- [x] 新建 `scripts/audit-recall.js`，检查 gap audit、词法信号、candidate 决策和可选 human gold。
- [x] 重写 `assess-quality.js`：按 G1-G5 汇总 hard gates，不再让类别互相补偿。
- [x] gate 必须读取 grand verification 状态；任何阻塞 unverified、扫描缺口或 unresolved candidate 都失败。
- [x] self-referential/LLM-generated baseline 不再参与评分；无人工 gold 时输出 `no_gold`。
- [x] 更新 `generate-summary.js` 以展示各 gate、原始计数和缺口，不依赖 overall score。

### 6. 收敛 skill 与流水线

- [x] 将 `SKILL.md` 和 `pipeline.md` 重写为 Prepare、Inventory、Reconcile、Audit 四阶段。
- [x] 将 `review.md` 的“对照原文检查重大遗漏”替换为 ledger closure 与 gap audit 的可执行检查。
- [x] 删除 baseline 生成作为必经步骤的说明。
- [x] 标记旧 prompt/scripts 为 legacy，并明确迁移用途；新流程不得调用它们。
- [x] 保持每个阶段幂等，失败后只重做未通过的窗口或 decision。

### 7. 验证与试运行

- [x] 运行 `node --test .agents/skills/generate-kb/tests/run-tests.js`。
- [x] 运行新增 ledger/source/gate 测试，覆盖解析失败、source hash 变化、未闭环 candidate、武功误删、对话不完整匹配。
- [x] 对《连城诀》旧版回归夹具确认门禁失败原因包含技能/招式/物品/对话召回不足。
- [x] 对当前《天龙八部》运行只读 audit，确认因 dialogue/persona/event coverage 与 grand grounded 问题失败。
- [x] 对现有 dashboard 运行类型检查和构建，确认最终 JSON 兼容。
- [x] 检查 `git diff`，确保没有为通过门禁而修改现有小说数据。

## 预计验证命令

```bash
node --test .agents/skills/generate-kb/tests/run-tests.js
node --test .agents/skills/generate-kb/tests/source-ledger.test.js
node --test .agents/skills/generate-kb/tests/quality-gate.test.js
node .agents/skills/generate-kb/scripts/audit-recall.js "金庸/连城诀" --legacy --dry-run
node .agents/skills/generate-kb/scripts/audit-recall.js "金庸/天龙八部" --legacy --dry-run
npm --prefix dashboard run typecheck
npm --prefix dashboard run build
```

实际命令以仓库 `package.json` 中存在的 script 为准；若无 `typecheck`，使用项目当前的等价命令。

## 风险与回滚点

- Stage 2 产物格式确定后再改质量门禁；否则 gate 会依赖不稳定 schema。
- 先保留 legacy scripts，不在同一提交删除，以便旧知识库仍可维护。
- 所有新 audit 默认 dry-run，不自动改写 `data/*.json`。
- 若 dashboard 兼容失败，优先调整 adapter 或新增 optional 字段，不回退 source-first 账本。

## 完成前检查

- [x] PRD 中每个 acceptance criterion 都有对应测试或验证命令。
- [x] `design.md` 中 G1-G5 均在报告中有独立结果和失败原因。
- [x] 文档不再把低数量阈值或 LLM baseline 称为完整性证明。
- [x] 用户审核并批准本 PRD、设计和实施计划后，才运行 `task.py start`。
