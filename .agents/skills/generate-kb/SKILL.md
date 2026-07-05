---
name: generate-kb
description: Use when the user wants to build a high-quality knowledge base for a well-known wuxia novel by leveraging the LLM's prior knowledge. Covers the "four great wuxia masters" — Jin Yong (金庸), Gu Long (古龙), Liang Yusheng (梁羽生), Huang Yi (黄易) — and similar canonical authors. Replaces the deconstruct + distill pipeline for novels the LLM already knows. Trigger on "用 LLM 生成知识库", "generate-kb", "直接生成 KB", or when the user mentions a well-known wuxia author/novel and wants better KB quality than deconstruct provides.
---

# generate-kb

用 LLM 的先验知识直接生成武侠小说知识库，再用原文逐条定位与校验。适用于 **武侠小说四大家** 及同类名家代表作：

- **金庸**：飞雪连天射白鹿，笑书神侠倚碧鸳（天龙八部、射雕英雄传、神雕侠侣、笑傲江湖、鹿鼎记等 15 部）
- **古龙**：多情剑客无情剑、楚留香系列、陆小凤系列、绝代双骄、萧十一郎、天涯明月刀、七种武器等
- **梁羽生**：萍踪侠影、白发魔女传、七剑下天山、云海玉弓缘、大唐游侠传等
- **黄易**：大唐双龙传、寻秦记、覆雨翻云、破碎虚空、边荒传说等

这些作品在主流 LLM 训练数据里是「已知文本」，LLM 已经知道正确答案，可以直接生成高质量结构化知识。

与 `deconstruct-novel` + `distill-*` 流水线的区别：
- 旧：逐章抽碎片 → 脚本合并 → distill 兜底。容易冲突、重复、one_line 随机。
- 新：整体生成 → 代码定位 → 多候选校验。关系图全局一致、one_line 基于全书、alias 无泛称、跨章事件暴露多处证据。

**不适用**：训练数据里没有的小众武侠、网文、原创作品。这些书退回 `deconstruct-novel`。

## 必守规则

- 仅当 `<小说目录>/<小说名>.txt` 存在时才可运行；原文缺失直接报错。
- 每个实体必须附 `source_refs`，采用 **event anchor + 多候选** 格式（详见 `schemas.md`）。LLM 写 `{ chapter, anchor, event_type }`，由 `locate.js` 自动回填 `primary` + `alternatives`。
- 校验阶段必须跑 `locate.js` + `verify.js` + `report.js`。核心质量指标是 **locate 率**（应 ≥ 99%）和 **事件匹配率**（人工抽样 ≥ 90%），不是 grounded 率（测措辞相似度，不反映事件匹配质量）。
- ID、schema、rank、枚举以本技能目录下的 `schemas.md` / `constants.md` 为准。
- 生成阶段必须使用长上下文模型（≥ 1M tokens）。原文超过模型窗口时按章节窗口分批。
- 不要在 prompt 里喂旧产物作为参考——会让 LLM 复制旧错误。
- 生成阶段的 prompt 必须显式禁止：捏造引文、凑数 alias、模板化 description、同一对角色多条冲突 relationship。
- **dialogues 必须用"LLM 读原文 + 关键事件锚定"方案提取**（见 Phase 2.5 详解）：先由 LLM 读原文，再按 chapter_summaries 的 key_events 定向挑选核心对话，最后用子串匹配验证真实性。禁止凭记忆直接生成对话。

## 三段式流水线

### Phase 1：split（纯代码）

```bash
node <技能目录>/scripts/split-chapters.js <小说目录>
node <技能目录>/scripts/compact-mention.js <小说目录>
```

- `split-chapters.js` 按正则 `^第.{1,8}[回章]` 拆分原文（已处理"回目表"假章问题）
- 写入 `<小说目录>/ch_split/ch_NNN.txt`
- 生成 `manifest.json`（章节清单）+ `mention_index.jsonl`（高频实体提及）
- `compact-mention.js` 把 mention_index.jsonl 聚合为 `mention_summary.json`（几十 KB，喂给 LLM）

运行后检查：`manifest.json.totalChapters` 应匹配已知章节数。

### Phase 1.6：prompt-craft（LLM 生成书籍专属 prompt）

```bash
# 主 agent 生成书籍专属 prompt
# 读取：prompts/prompt-craft.md（meta-prompt）
# 输入：manifest.json + mention_summary.json + 原文采样（前3章+中间2章+最后2章）
# 输出：<小说目录>/prompts/ 下 4 个文件
```

**核心思路**：通用 prompt 对所有书用同一套话术，效果有限。书籍专属 prompt 能提前告诉 LLM 这本书的关键特征、已知陷阱、锚定策略，大幅提升生成质量。

**输出文件**：
- `<小说目录>/prompts/outline.md` — 本书的大纲生成 prompt
- `<小说目录>/prompts/pass1-entities.md` — 本书的实体生成 prompt
- `<小说目录>/prompts/pass2-details.md` — 本书的细节生成 prompt
- `<小说目录>/prompts/review-dialogues.md` — 本书的审阅 prompt

**专属 prompt 包含**：
- 本书简介（核心故事线、时代背景、叙事特色）
- 核心角色/门派/地点提示（从 mention_summary 提取）
- 易混淆提醒（相似角色名、容易搞混的门派）
- 跨书混淆风险（同作者其他作品的易混淆元素）
- 叙事风格描述（从原文采样总结）
- source_ref 锚定策略（哪些事件适合作为锚点）
- 角色说话风格速查表
- 经典台词参考（用于审阅对比）

**后续使用**：Phase 1.5 和 Phase 2 优先读 `<小说目录>/prompts/xxx.md`，不存在时 fallback 到技能目录的通用 prompt。

### Phase 1.6.5：prompt 校验（subagent 干净上下文）

Phase 1.6 生成的专属 prompt 必须校验，因为 LLM 一次性生成 50 章的事件分配容易出错。

**校验方法**：用 subagent（干净上下文）逐个检查 4 个 prompt：
1. 章节号是否与 `manifest.json` 的章节标题对应
2. key_events 是否与 `ch_split/ch_NNN.txt` 的实际内容匹配
3. 角色/门派/功法列表是否完整（对照 `mention_summary.json`）
4. 跨书混淆检查清单是否准确

**已知陷阱**（天龙八部 pilot 实测）：
- LLM 容易把事件张冠李戴到错误章节（如把 ch19 的聚贤庄血战标到 ch18）
- 章节范围描述可能有偏差（如"乔峰登场 ch9-13"实际是 ch14）
- 这些错误会级联影响后续所有阶段

**校验不通过时**：直接修正 prompt 中的错误章节号和事件分配，不要等后续阶段暴露问题。

### Phase 1.5：outline（LLM 骨架生成）

```bash
# 主 agent 生成 outline（一次性小生成）
# 读取：<小说目录>/prompts/outline.md（专属）或 prompts/outline.md（通用 fallback）
# 输入：manifest.json + mention_summary.json
# 输出：outline.json（约 20-30KB）
```

- `outline.json` 包含 4 个清单：characters、factions、locations、skills
- 每个实体只有 name、role/type/region、one_line，不生成 details
- LLM 注意力集中在宏观结构上，避免一次性生成太多内容导致尾部实体质量下降

**后续使用**：Pass 1 以 outline.json 为骨架，对每个实体填充 details（relationships、personality、source_refs 等）。LLM 不再需要同时决定"列谁"和"细节是什么"，注意力更聚焦。

### Phase 2：generate（LLM 主力，2 个 pass）

主 agent 直接调用长上下文模型（当前会话模型）。每个 pass 单独 prompt，输出指定 JSON。

**Pass 1 — 实体骨架**
- 读取：`<小说目录>/prompts/pass1-entities.md`（专属）或 `<技能目录>/prompts/pass1-entities.md`（通用 fallback）
- 输入：`manifest.json` + `mention_summary.json` + `outline.json`（如果存在）
- 输出 5 个 JSON：`characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`
- 输出位置：`<小说目录>/`

**Pass 2 — 细节**
- 读取：`<小说目录>/prompts/pass2-details.md`（专属）或 `<技能目录>/prompts/pass2-details.md`（通用 fallback）
- 输入：同 Pass 1 + Pass 1 生成的 5 个 JSON
- 输出 3 个 JSON：`items.json`、`dialogues.json`、`chapter_summaries.json`

**Phase 2.2：chapter_summaries 交叉验证**

Pass 2 生成的 `chapter_summaries.json` 必须校验，因为 LLM 一次性生成 50 章摘要时容易出现章节号错位。

**校验方法**：用脚本或 subagent 检查每章的 `key_events` 是否与原文匹配：
```bash
# 检查每章 key_events 中的关键词是否在原文中出现
node -e "
const fs = require('fs');
const path = require('path');
const summaries = JSON.parse(fs.readFileSync('<小说目录>/chapter_summaries.json', 'utf8'));
for (const s of summaries) {
  const content = fs.readFileSync('<小说目录>/ch_split/ch_' + s.chapter.toString().padStart(3,'0') + '.txt', 'utf8');
  for (const ev of s.key_events) {
    const keywords = ev.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    for (const kw of keywords) {
      if (!content.includes(kw)) {
        console.log('⚠ ch' + s.chapter + ': \"' + ev + '\" 中 \"' + kw + '\" 未在原文找到');
      }
    }
  }
}
"
```

**已知陷阱**（天龙八部 pilot 实测）：
- ch17-20 的事件分配全部错位（聚贤庄血战标到 ch18，实际在 ch19）
- 错位会导致 Phase 2.5 dialogues 提取全部失败（按错误事件去提取，自然找不到对应台词）
- 修正 chapter_summaries 后需重跑受影响章节的 dialogues

### Phase 2.5 — dialogues 提取（LLM 读原文 + 事件锚定 + 真实性验证）**

dialogues 是唯一需要从原文中提取而非凭记忆生成的 JSON。流程：

1. **准备**：读取 `chapter_summaries.json` 的 key_events，以及 `ch_split/ch_NNN.txt` 原文
2. **LLM 提取**：用 subagent 逐批（每批 5-10 章）读取原文，按 key_events 挑选 5-10 条核心对话。选择标准：
   - 推动剧情：身世揭秘、关系转折、冲突爆发
   - 角色标签：初登场经典台词、性格标志句
   - 不要：日常寒暄、动作描写碎语、无情节推动的闲聊
3. **真实性验证**：用 `verify_dialogues.js` 对每条对话做子串匹配（精确→片段→前缀），真实率应 ≥ 70%
4. **清理**：删除未找到的条目，保留验证通过的
5. **输出**：`dialogues.json`，每条包含 `chapter`、`speaker`、`text`、`event`

验证脚本用法：`node verify_dialogues.js <dialogues_json_file>`

**Pass 3 — 补丁**（可选，Phase 3 校验后触发）
- 读取：`<小说目录>/prompts/pass3-patch.md`（专属，如有）或 `<技能目录>/prompts/pass3-patch.md`（通用 fallback）
- 输入：`verification_report.md` 里的问题条目（not_located / 低覆盖实体）
- 输出：覆盖/合并到对应 JSON

### Phase 3：locate + verify + cross-validate（纯代码）

```bash
node <技能目录>/scripts/locate.js <小说目录>
node <技能目录>/scripts/verify.js <小说目录>
node <技能目录>/scripts/report.js <小说目录>
node <技能目录>/scripts/cross-validate.js <小说目录>
```

- `locate.js`：对每个 source_ref 的 `{ chapter, anchor }` 在原文中定位，输出 **primary + alternatives**（top-3 候选）
  - **同章去重**：每章只保留最高分候选
  - **跨章保留**：score ≥ 60% primary 的其他章都作为 alternatives
  - **event_type 加分**：根据 ref.event_type 或 anchor 关键词推断类型（first_mention / climax / resolution / background），给对应章节加分
  - **hint 容差**：hinted chapter 在 ±1 范围内视为命中，避免误报 diff_ch
- `verify.js`：对 primary 和每个 alternative 独立校验（子串匹配 / 宽窗口 / 关键词共现），标记 `grounded` / `weak` / `unverified`
- `report.js`：输出 `verification_report.md` 和 `verification_report.json`，包含：
  - primary 的 grounded 率（措辞相似度指标）
  - alternatives 的 grounded 率
  - **跨章事件清单**（alternatives 跨 ≥2 章的 source_refs，UI 适合展示为时间线）
  - 低置信度实体
- `cross-validate.js`：跨 JSON 一致性校验，检查：
  - 关系对称性（A→B 是否有 B→A）
  - ID 引用完整性（characters.faction、known_skills、items.owner 等）
  - 幻觉检测（实体是否在 mention_summary.json 里）

### Phase 3.5：双视角对抗校验（同模型 + 不同 prompt）

```bash
node <技能目录>/scripts/review-dialogues.js <小说目录>
# 用同一 LLM + reviewer prompt 审阅 review/review-prompt.md
# 输出到 review/review-result.json
node <小说目录>/review/check-review.js
```

**核心思路**：同一个模型在不同 prompt 下会给出不同的关注点——这是 prompt engineering 的 "debate" 模式。

- **生成者 prompt**：你是知识库建设者，目标是写全、写连贯
- **审阅者 prompt**：你是知识库质疑者，目标是挑刺、找反例

**工具**：
- `review-dialogues.js`：生成 dialogues 审阅 prompt
- `prompts/review-dialogues.md`：审阅 prompt 模板（跨书混淆、说话风格、时代背景、措辞偏差、情节逻辑）
- 优先使用 `<小说目录>/prompts/review-dialogues.md`（专属），fallback 到技能目录的通用模板
- 用同一 LLM 审阅，输出 JSON 结果到 `review/review-result.json`
- `check-review.js`：分析审阅结果，提取可疑对话索引到 `review/suspicious-indices.json`

**审阅标准**：
- 跨书混淆（最严重）：对话是否包含其他武侠作品的元素？
- 说话风格不符：说话风格是否符合角色性格？
- 时代背景错误：对话是否符合本书的时代背景？
- 措辞偏差：对话是否像 LLM 凭记忆写的而非原文？
- 情节逻辑错误：对话是否与上下文情节矛盾？

**后续处理**：
- 如果发现高严重程度问题，触发 Pass 3 补丁或人工复核
- 如果可疑对话数量少（< 10 条），可直接重读原文验证

## 武侠小说适用 + 质量指标（天龙八部 pilot 实测）

本 skill 对武侠小说四大家（金庸、古龙、梁羽生、黄易）的代表作均适用。下表指标来自金庸《天龙八部》pilot，但方法论可推广到上述四大家的其他作品。

| 指标 | 含义 | pilot 结果 |
|------|------|----------|
| **locate 率** | 能找到至少一个候选的 source_ref 比例 | 100% ✓ |
| **事件匹配率** | 人工抽样看 (primary + alternatives) 是否覆盖真实事件章 | 100% ✓ |
| **跨章事件识别** | 跨 ≥2 章的 source_ref 数量 | 367 个 |
| primary grounded 率 | 措辞相似度（不反映事件匹配） | ~55% |
| alternatives grounded 率 | 同上 | ~42% |
| relationship 冲突数 | 同一对 (id, target) 多条记录 | 0 ✓ |
| 英文占位 / 泛称 alias | unknown / "青衫年轻男子" 等 | 0 ✓ |
| **dialogues 真实率** | 验证通过的对话比例（精确+片段匹配） | 75% ✓ |

## 执行顺序

0. 前置检查：确认 `<小说目录>/<小说名>.txt` 存在。
1. Phase 1：`node <技能目录>/scripts/split-chapters.js <小说目录>` + `node <技能目录>/scripts/compact-mention.js <小说目录>`
2. 检查 `manifest.json` 的章节数是否合理。
3. **Phase 1.6**：按 `prompts/prompt-craft.md` 调用 LLM，读取 `manifest.json` + `mention_summary.json` + 原文采样，生成 `<小说目录>/prompts/` 下 4 个专属 prompt。
4. **Phase 1.6.5**：用 subagent 校验 4 个专属 prompt 的章节号、事件分配、角色列表是否准确。不通过则直接修正。
5. Phase 1.5（可选）：按 `<小说目录>/prompts/outline.md`（专属）调用 LLM，生成 `outline.json`（实体清单大纲）。
6. Phase 2 Pass 1：按 `<小说目录>/prompts/pass1-entities.md`（专属）调用 LLM，写入 5 个 JSON（如有 outline.json 则作为输入）。
7. 立即跑 Phase 3 的 locate + verify + cross-validate，评估 Pass 1 质量。
8. 如 locate 率 < 95% 或 cross-validate 有 errors，调整 `<小说目录>/prompts/pass1-entities.md` 后重跑 Pass 1；否则继续。
9. Phase 2 Pass 2：按 `<小说目录>/prompts/pass2-details.md`（专属）调用 LLM，写入 `items.json` + `chapter_summaries.json`。
10. **Phase 2.2**：交叉验证 `chapter_summaries.json` 的 key_events 是否与原文匹配。错位的章节必须修正后才能进入 Phase 2.5。
11. **Phase 2.5**：用 subagent 逐批读原文提取 dialogues（每批 5-10 章），然后跑 `verify_dialogues.js` 验证真实性，清理未通过条目。如某章验证通过率为 0，检查 chapter_summaries 的事件分配是否正确。
12. 跑完整 Phase 3 校验，必要时触发 Pass 3 补丁。
13. Phase 3.5：双 LLM 对抗校验（使用 `<小说目录>/prompts/review-dialogues.md` 专属 prompt），审阅 dialogues.json，筛选可疑对话。
14. 最终验证：8 个 JSON 可解析、schema 合法、ID 合规、cross-validate errors = 0、主角色关系图无冲突。

## 验证重点

- 所有 JSON 可解析，schema 字段齐全。
- ID 全部是小写拼音加下划线，前缀正确。
- `relationships.target` 在 `characters.json` 里能找到对应条目。
- 主角色（武侠四大家的代表作里通常有 3-5 个核心主角）的关系图两两一致，同一对角色无重复条目。
- `verification_report.md` 的 **locate 率 ≥ 99%**、**跨章事件清单** 覆盖关键剧情（决战、揭秘、定情、身死等武侠经典桥段）。
- `one_line`、`alias`、`personality` 抽样 5 条人工核对，明显优于旧产物。
- **人工抽样 10 个 source_ref 的事件匹配率 ≥ 90%**。

## 最终产物

8 个 JSON + 4 个校验报告 + 4 个书籍专属 prompt：

- `characters.json`
- `skills.json`
- `techniques.json`
- `factions.json`
- `locations.json`
- `items.json`
- `dialogues.json`
- `chapter_summaries.json`
- `verification_report.json` / `verification_report.md`（locate + verify 结果）
- `cross_validation_report.json`（跨 JSON 一致性校验）
- `coverage_gap_report.json`（mention 覆盖率分析）
- `review/review-result.json`（双 LLM 对抗校验结果）
- `<小说目录>/prompts/outline.md`（书籍专属大纲 prompt）
- `<小说目录>/prompts/pass1-entities.md`（书籍专属实体 prompt）
- `<小说目录>/prompts/pass2-details.md`（书籍专属细节 prompt）
- `<小说目录>/prompts/review-dialogues.md`（书籍专属审阅 prompt）

## 参考文件

| 文件 | 用途 |
|------|------|
| `schemas.md` | 8 个 JSON 的 schema 定义（含多候选 source_ref 格式） |
| `constants.md` | ID 规则、rank 序列、枚举值 |
| `prompts/prompt-craft.md` | Phase 1.6 书籍专属 prompt 生成（meta-prompt） |
| `prompts/outline.md` | Phase 1.5 大纲生成 prompt（通用 fallback） |
| `prompts/pass1-entities.md` | Pass 1 生成 prompt（通用 fallback） |
| `prompts/pass2-details.md` | Pass 2 生成 prompt（通用 fallback） |
| `prompts/pass3-patch.md` | Pass 3 补丁 prompt（通用 fallback） |
| `scripts/split-chapters.js` | Phase 1 拆分 + mention_index 脚本 |
| `scripts/compact-mention.js` | Phase 1 mention 聚合脚本 |
| `scripts/locate.js` | Phase 3 多候选定位脚本（含 event_type 加分） |
| `scripts/verify.js` | Phase 3 校验脚本（校验 primary + alternatives） |
| `scripts/report.js` | Phase 3 报告生成脚本（含跨章事件清单） |
| `scripts/cross-validate.js` | Phase 3 跨 JSON 一致性校验（关系对称、ID 引用、幻觉检测） |
| `scripts/review-dialogues.js` | 生成 dialogues 审阅 prompt，筛选可疑对话 |
| `prompts/review-dialogues.md` | dialogues 审阅 prompt 模板 |
| `scripts/coverage-gap.js` | 分析 mention_index 覆盖率缺口，输出高频缺失实体 |
| `scripts/verify_dialogues.js` | Phase 2.5 对话真实性验证（子串匹配） |

## 天龙八部 pilot 经验教训

### 章节事件错位是最大风险

LLM 一次性生成 50 章的 chapter_summaries 时，最容易出现的错误是**事件与章节号错位**——记得事件本身，但记错了发生在哪一章。天龙八部 pilot 中 ch17-20 全部错位：

| 章节 | LLM 标注 | 实际内容 |
|------|----------|----------|
| ch17 | 聚贤庄英雄宴 | 段誉王语嫣逃离西夏 |
| ch18 | 聚贤庄血战 | 乔峰养父母被害、玄苦圆寂 |
| ch19 | 乔峰阿朱感情发展 | **聚贤庄血战** |
| ch20 | 雁门关伏击真相 | 乔峰身世大白（基本正确） |

**后果**：Phase 2.5 按错误事件提取对话，ch18 提取了 6 条对话但全部验证失败（0% 真实率）。

**解决**：Phase 2.2 交叉验证 + 错误章节修正后重跑。

### dialogues 提取方案演进

1. **旧方案（正则提取）**：每章抓 100+ 条对话，大量噪音，说话者识别不准
2. **LLM 凭记忆生成**：75% 真实率，但对虚竹线等段落记忆偏差大
3. **当前方案（LLM 读原文 + 事件锚定）**：66-73% 真实率，232 条对话覆盖 47/50 章

关键改进：让 LLM 先读原文再挑选对话，而不是凭记忆生成。验证脚本 `verify_dialogues.js` 用子串匹配确认真实性。

### prompt 质量直接影响后续阶段

专属 prompt 中的章节号错误会级联影响：
- outline.json 的实体分布
- Pass 1 的 source_refs 锚定
- chapter_summaries 的事件分配
- dialogues 的提取成功率

Phase 1.6.5 的 prompt 校验是必要的防御步骤。

## 相关文档

- `FUTURE_PLANS.md`：后续优化方向（event_type 显式化、dialogues 读原文提取、推广到其他武侠四大家作品）
