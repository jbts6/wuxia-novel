# Honest Quality Assessment — 绝代双骄

> 生成时间：2026-07-11  
> **结论：上一份 100/100 不可信。** 那是 baseline 自指评估（从 KB 抄名单再回测 KB），不是独立质量。

## 为什么 100 分是假的

`assess-quality.js` 主要指标依赖 `build/baseline.json`：

| 指标 | 实际算法 | 自指时的结果 |
|------|----------|--------------|
| Entity Completeness | baseline 角色是否在 KB | baseline=KB 拷贝 → 恒 100% |
| Relationship Completeness | baseline.relationships 是否命中 | 我们没写 relationships → expected=0 → 默认 100% |
| Event Coverage | baseline.events 是否命中 | 我们没写 events → expected=0 → 默认 100% |
| Description Accuracy | baseline 的 expected_identity/traits | 没写这些字段 → 全算准确 |
| Dialogue Authenticity | baseline.dialogues 章+说话人是否存在 | 对话从 KB 抄进 baseline → 恒 100% |
| Cross-Book Purity | KB 实体是否都在 baseline | baseline 含全量 KB → 恒 100% |

**Entity Quantity 实际只有 60%**（skills/locations 不足最低门槛），且**不计入** overall。  
**Baseline Validation 90%** 曾检出「江家」幻觉，但也不进 overall。

所以 overall 100 只说明「脚本与自造 baseline 一致」，不说明知识库质量。

## 独立度量（不依赖自指 baseline）

基于 `locate` / `verify` / `cross-validate` / 结构统计（本轮修复后）：

| 度量 | 值 | 说明 |
|------|-----|------|
| source_refs locate 率 | **100%**（entities） | 8 类 JSON 中 entity 级 locate，dialogues 572/572 |
| verify grounded（实体+对话） | **97.5%** grand total | 对话 100%；非对话实体约 76–94% |
| characters grounded | 86.2%（50/58） | 8 weak |
| factions grounded | 77.8%（7/9） | 2 weak |
| locations grounded | 83.3%（15/18） | 3 weak |
| skills grounded | 93.8%（15/16） | 1 weak |
| items grounded | 76.9%（10/13） | 3 weak |
| dialogues 原文可定位 | **100%**（572 条，经 locate-dialogues 删幻觉 14） | 正则抽取+定位，非 LLM 编造 quote |
| dialogues 章节覆盖 | **127/127** | 每章最多 5 条，非全书全量对话 |
| cross-validate errors | **0** | 关系对称 / ID / 枚举 |
| 跨书污染（人工规则） | 未检出李寻欢/西门等 | 脚本 Cross-Book 因自指失效，此项靠人工名单 |
| techniques | **0** | 未提取具名招式（可接受或待补） |

### 实体数量 vs 长篇门槛（≥50 章）

| 类型 | 实际 | 建议最低 | 状态 |
|------|------|----------|------|
| characters | 33 | 30 | 过 |
| factions | 6 | 6 | 过 |
| skills | 12 | 15 | **不足** |
| items | 12 | 10 | 过 |
| locations | 16 | 15 | 过 |

### 摘要质量（诚实）

- `chapter_summaries`：127 章齐全，但摘要多为「标题 + 出场名 + 模板句」，**key_events 非人工精读**，事件深度弱。
- 不能宣称 Event Coverage=100% 的剧情意义；只能说「每章有一条 summary 记录」。

## 本轮已修残留

1. **删除** 原文不存在的势力 `江家`（`faction_jiang_jia`），江别鹤/江玉郎 `faction=null`  
2. **删除** 过泛 `skill_an_qi`；补文本可见：毒手、剑法、掌法、内功、化骨、移花接木  
3. **补地点**：昆仑、泰山、皇宫、山洞、赌场、客栈、酒楼、山君、幽谷 等（均在原文出现）  
4. **对话**：全 127 章正则抽取 → 586 → locate 后 **572** 条原文 quote  

## 仍诚实存在的缺口

1. **skills 命名偏泛**（剑法/掌法/内功/点穴）：古龙少专名招式，属原文风格限制，但数量仍低于门槛 15。  
2. **chapter_summaries 偏模板**，未做逐章精读关键事件。  
3. **dialogues 非全量**：每章 cap 5；`listener` 几乎全 null。  
4. **verify weak 约 16 实体**：anchor 关键词与定位段匹配偏弱，需逐条改 anchor。  
5. **outline 锁定清单 ≠ 独立金标准**：当前 outline 也是同一流程产物。  
6. **未跑对抗审阅（Phase 3.5）** 的人工/独立 LLM 交叉检查。  

## 建议真实分数带（人工判断）

| 维度 | 粗评 | 理由 |
|------|------|------|
| 可定位性 / 原文 grounding | **B+ / 85–90** | locate 满，verify 非对话仍有 weak |
| 实体覆盖（名场面级） | **B / 75–85** | 主线人物齐；skills/地点可再挖 |
| 关系图 | **B / 80** | 对称已修，但缺独立 relation baseline |
| 章摘要 | **C / 60–70** | 覆盖有、质量模板化 |
| 对话 | **B / 80** | 真原文；覆盖浅、无 listener |
| 综合（不宜再报 100） | **约 75–82** | 可用骨架库，未达 skill 文档宣称的 95% 硬门槛 |

## 以后怎么评才不虚

1. **baseline 必须独立**：先于 KB 写金标准（或另一模型/人工），禁止从当前 `data/*.json` 生成。  
2. **empty baseline 不得默认 100**：`expected=0` 应记为 `N/A` 并拉低 overall 或标 `invalid`。  
3. **overall 应计入**：entity_quantity、baseline_validation、verify grounded、dialogues 章覆盖率。  
4. **对话真实性**：对 quote 做原文子串，而不是「章+speaker 存在即 authentic」。  

---

**一句话**：上次满分是测量方法错误；修完残留后，这是一个 **locate/verify 尚可、摘要偏弱、未达 95% 宣称门槛** 的可用草稿库，不是完成态。
