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
- **dialogues 建议用 agent 直接读原文提取**：每章挑 5-10 条代表性台词，避免 LLM 凭记忆写台词导致幻觉。

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

运行后检查：`manifest.json.totalChapters` 应匹配已知章节数（天龙八部 = 50）。

### Phase 2：generate（LLM 主力，2 个 pass）

主 agent 直接调用长上下文模型（当前会话模型）。每个 pass 单独 prompt，输出指定 JSON。

**Pass 1 — 实体骨架**
- 读取：`<技能目录>/prompts/pass1-entities.md`
- 输入：`manifest.json` + `mention_summary.json`（不是全文）
- 输出 5 个 JSON：`characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`
- 输出位置：`<小说目录>/`

**Pass 2 — 细节**
- 读取：`<技能目录>/prompts/pass2-details.md`
- 输入：同 Pass 1 + Pass 1 生成的 5 个 JSON
- 输出 3 个 JSON：`items.json`、`dialogues.json`、`chapter_summaries.json`
- **dialogues 建议走"读原文提取"路径**：每章让 agent 直接读 `ch_split/ch_NNN.txt`，挑 5-10 条代表性台词（人物初登场、关系转折、经典金句），保留原文不重写。

**Pass 3 — 补丁**（可选，Phase 3 校验后触发）
- 读取：`<技能目录>/prompts/pass3-patch.md`
- 输入：`verification_report.md` 里的问题条目（not_located / 低覆盖实体）
- 输出：覆盖/合并到对应 JSON

### Phase 3：locate + verify（纯代码）

```bash
node <技能目录>/scripts/locate.js <小说目录>
node <技能目录>/scripts/verify.js <小说目录>
node <技能目录>/scripts/report.js <小说目录>
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

## 执行顺序

0. 前置检查：确认 `<小说目录>/<小说名>.txt` 存在。
1. Phase 1：`node <技能目录>/scripts/split-chapters.js <小说目录>` + `node <技能目录>/scripts/compact-mention.js <小说目录>`
2. 检查 `manifest.json` 的章节数是否合理。
3. Phase 2 Pass 1：按 `prompts/pass1-entities.md` 调用 LLM，写入 5 个 JSON。
4. 立即跑 Phase 3 的 locate + verify + report，评估 Pass 1 质量。
5. 如 locate 率 < 95% 或人工抽样事件匹配 < 80%，调整 prompt 后重跑 Pass 1；否则继续。
6. Phase 2 Pass 2：按 `prompts/pass2-details.md` 调用 LLM，写入 3 个 JSON。dialogues 建议走"读原文提取"路径。
7. 跑完整 Phase 3 校验，必要时触发 Pass 3 补丁。
8. 最终验证：8 个 JSON 可解析、schema 合法、ID 合规、主角色关系图无冲突、跨章事件在 UI 里能展示为时间线。

## 验证重点

- 所有 JSON 可解析，schema 字段齐全。
- ID 全部是小写拼音加下划线，前缀正确。
- `relationships.target` 在 `characters.json` 里能找到对应条目。
- 主角色（武侠四大家的代表作里通常有 3-5 个核心主角）的关系图两两一致，同一对角色无重复条目。
- `verification_report.md` 的 **locate 率 ≥ 99%**、**跨章事件清单** 覆盖关键剧情（决战、揭秘、定情、身死等武侠经典桥段）。
- `one_line`、`alias`、`personality` 抽样 5 条人工核对，明显优于旧产物。
- **人工抽样 10 个 source_ref 的事件匹配率 ≥ 90%**。

## 最终产物

8 个 JSON + 2 个校验报告：

- `characters.json`
- `skills.json`
- `techniques.json`
- `factions.json`
- `locations.json`
- `items.json`
- `dialogues.json`
- `chapter_summaries.json`
- `verification_report.json`
- `verification_report.md`

## 参考文件

| 文件 | 用途 |
|------|------|
| `schemas.md` | 8 个 JSON 的 schema 定义（含多候选 source_ref 格式） |
| `constants.md` | ID 规则、rank 序列、枚举值 |
| `prompts/pass1-entities.md` | Pass 1 生成 prompt |
| `prompts/pass2-details.md` | Pass 2 生成 prompt |
| `prompts/pass3-patch.md` | Pass 3 补丁 prompt |
| `scripts/split-chapters.js` | Phase 1 拆分 + mention_index 脚本 |
| `scripts/compact-mention.js` | Phase 1 mention 聚合脚本 |
| `scripts/locate.js` | Phase 3 多候选定位脚本（含 event_type 加分） |
| `scripts/verify.js` | Phase 3 校验脚本（校验 primary + alternatives） |
| `scripts/report.js` | Phase 3 报告生成脚本（含跨章事件清单） |

## 相关文档

- `FUTURE_PLANS.md`：后续优化方向（event_type 显式化、dialogues 读原文提取、推广到其他武侠四大家作品）
