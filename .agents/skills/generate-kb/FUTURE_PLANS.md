# generate-kb 后续优化计划

本文件记录 generate-kb skill 的后续优化方向。这些方向在《天龙八部》pilot 中已验证问题或可行性，但**暂未实施**——需要在后续书籍跑通时再做。

**当前状态**：
- ✅ 方向 A（多候选定位）：已在《天龙八部》pilot 中完整实现并验证，事件匹配率 62% → 100%。
- ✅ 方向 B（LLM 显式输出 event_type）：prompt 已写好，下次重跑自动生效。
- ✅ 方向 C（dialogues 读原文提取）：审阅后发现 dialogues.json 质量很好，无需重读。
- ✅ 方向 E（跨 JSON 一致性校验）：已实现 `cross-validate.js`，检查关系对称、ID 引用完整性、alias 去重。
- ✅ 方向 F（预生成大纲）：已实现 `prompts/outline.md`，添加 Phase 1.5 阶段。
- ✅ 方向 G（幻觉检测器）：已集成到 `cross-validate.js`，检测不在 mention_summary 里的实体（跨书混淆风险）。
- ✅ 方向 H（mention_index 覆盖率闭环）：已实现 `coverage-gap.js`，分析高频缺失实体。
- ✅ 方向 I（双 LLM 对抗校验 Phase 1）：审阅完成，430 条 dialogues 中仅 4 条低严重程度问题。
- ⏳ 方向 D（推广到其他作品）：待实现，依赖前述方向全部跑通。

---

## 方向 B：LLM 显式输出 event_type 字段

### 问题背景

当前 event_type 靠 locate.js 从 anchor 关键词推断，覆盖分布：
- background: 304（79%）—— 大多数 anchor 没有明确事件词
- climax: 40（10%）
- resolution: 16（4%）
- first_mention: 12（3%）

效果观察：
- ✓ first_mention：段誉"初见钟灵" → primary 自动选 ch1（最早章），符合预期
- ✓ 部分 climax：珍珑棋局、雁门关 primary 正确
- ✗ climax 不够翻转 primary：松鹤楼斗酒 anchor 的关键词（乔峰+段誉+无锡+松鹤楼）在 ch18 共现密度比 ch14 还高，导致 primary 错选到"讨论斗酒"的章而不是"真正斗酒"的章

### 根本问题

纯靠 anchor 关键词 + event_type 加分，无法识别"真正的事件发生章"。因为讨论/回忆事件的章，关键词密度可能比事件本身章更高。

### 改造方案

让 LLM 在生成 source_refs 时**显式输出 event_type 字段**，而不是从 anchor 关键词推断。

**新 source_ref 格式**（已在 prompts 里写好，重生成即可生效）：
```json
{
  "chapter": 14,
  "anchor": "段誉与乔峰在无锡松鹤楼斗酒四十碗结拜为兄弟",
  "event_type": "climax"
}
```

**locate.js 已实现的加分策略**（直接生效，无需改代码）：
- `first_mention` → 早章加分（每早一章 +3 分）
- `climax` → 默认按匹配密度选
- `resolution` → 晚章加分（每晚一章 +3 分）
- `background` → 默认

### 实施步骤

1. **重生成 8 个 JSON**：用更新后的 prompts（已写好 event_type 字段要求），对目标书籍跑完整 generate-kb 流水线
2. **评估主备排序改善**：抽样 10 个 climax 事件，看 primary 是否选中真实事件章
3. **必要时调整加分幅度**：如果 climax 仍然翻转不动 primary，把 first_mention/resolution 的 bonus 调高（如每章 +5 或 +10）

### 预期收益

- event_type 覆盖从 21% 提升到 ~100%（每个 source_ref 都有）
- 主备排序更合理：first_mention 事件优先展示首章、resolution 事件优先展示尾章
- 跨章事件的 primary 选择更符合人类直觉

### 风险

- 重生成成本高（需要重新跑 8 个 JSON 的 LLM 生成）
- LLM 对 event_type 的判断可能不完全准确（如把 background 误判为 climax）

---

## 方向 C：dialogues 走"读原文提取"路径 ✅ 已完成（无需重读）

### 问题背景

pilot 中 dialogues.json 的 grounded 率只有 62.8%（vs 实体类 78.6%），且有 84 条 unverified。根本原因是 LLM 凭记忆写台词——无法精确回忆原文原句，必然产生幻觉。

当前数据：
- dialogues 总数：430
- grounded：270（62.8%）
- weak：76（17.7%）
- unverified：84（19.5%）

### 改造方案

**让 agent 直接读 `ch_split/ch_NNN.txt`，每章挑 5-10 条代表性台词**，保留原文一字不改。

**具体流程**：
1. 对每章 `ch_split/ch_NNN.txt` 启动一个 agent（或 batch 处理多章）
2. agent 读完整章原文
3. 按以下标准挑台词：
   - 人物初登场台词（体现性格）
   - 关系转折对话（情感变化）
   - 经典金句（武侠名句）
   - 冲突爆发点（剧情高潮）
4. 每条台词必须保留：
   - `text`：原文一字不改
   - `speaker`：char_id（在 characters.json 里查）
   - `listener`：char_id 或 null
   - `tone`：12 种 dialogue_tone 之一
   - `chapter` / `line_start` / `line_end`：原文精确位置
5. 写入 dialogues.json

### 与当前 LLM 凭记忆方案的对比

| 维度 | LLM 凭记忆 | 读原文提取 |
|------|-----------|-----------|
| grounded 率 | 62.8% | 预期 100% |
| unverified | 19.5% | 0% |
| 台词数量 | 可多（430 条） | 受章节限制（50 章 × 10 条 ≈ 500 条） |
| 成本 | 低（单次生成） | 中（每章一次 agent 调用） |
| 质量 | 措辞可能偏差 | 一字不改 |

### 实施步骤

1. 写一个 `extract-dialogues.js` 脚本或 prompt 模板
2. 对每章跑一次 agent
3. 合并为 dialogues.json
4. 跑 verify.js 验证（预期 100% grounded）

### 预期收益

- dialogues grounded 率 62.8% → 100%
- 整体 grounded 率 71% → 85%（达标）
- 台词一字不改，可直接用于展示

### 天龙八部测试结果

**审阅结果**：
- 430 条 dialogues 中审阅了前 50 条
- 发现 4 条低严重程度措辞问题
- 2 条建议重读原文（#44, #46）

**重读原文验证**：
- #44: "你动不动的便打人，真够横蛮的了！" → 原文一致
- #46: "我一直为人所制，动弹不得，日夜牵挂着你，真是焦急死了。" → 原文一致

**结论**：
- dialogues.json 与原文完全一致，质量很好
- reviewer 的 2 条建议都是假阳性
- **无需全量重读 430 条 dialogues**

---

## 方向 D：推广到其他武侠四大家作品

### 适用范围

generate-kb 已定位为"武侠小说四大家知识库生成器"：
- **金庸**：15 部全部适用（天龙八部已 pilot）
- **古龙**：楚留香系列、陆小凤系列、多情剑客无情剑、绝代双骄、萧十一郎、天涯明月刀、七种武器等
- **梁羽生**：萍踪侠影、白发魔女传、七剑下天山、云海玉弓缘、大唐游侠传等
- **黄易**：大唐双龙传、寻秦记、覆雨翻云、破碎虚空、边荒传说等

### 推广前检查清单

对每本新书，跑前需确认：

1. **原文质量**：`<小说目录>/<小说名>.txt` 是否存在且完整
2. **章节结构**：`^第.{1,8}[回章]` 正则能否正确拆分（古龙常用"第X章"而非"第X回"；黄易有时用数字编号）
3. **mention_index 词典**：当前词典主要覆盖金庸角色名。跑古龙/梁羽生/黄易前，需要扩展词典（在 `locate.js` 的 `extra` 数组里加新书的角色名/地名/武功）
4. **event_type 关键词**：当前 `EVENT_TYPE_KEYWORDS` 主要覆盖金庸常见事件词（斗酒、误杀、破棋等）。新书可能需要加特定事件词（如古龙的"决斗"、黄易的"争霸"）

### 建议的推广顺序

1. **金庸其他作品**（低风险）：词典几乎通用，只需加少量角色名。建议先跑《射雕英雄传》《笑傲江湖》验证
2. **古龙**（中风险）：角色名/武功名差异大，需要大幅扩展词典。建议先跑《多情剑客无情剑》
3. **梁羽生**（中风险）：相对冷门，LLM 训练数据可能不如金庸/古龙丰富。建议先跑《萍踪侠影》
4. **黄易**（高风险）：作品篇幅巨大（大唐双龙传 63 卷），可能需要分批生成。建议先跑《破碎虚空》（篇幅短）

### 失败模式

如果某本书跑出来 locate 率 < 95% 或事件匹配率 < 80%，可能原因：
- LLM 训练数据里这本书不够丰富（小众梁羽生作品）→ 退回 `deconstruct-novel` + `distill-*` 流水线
- 章节结构不符合正则 → 改 `split-chapters.js` 适配
- 词典缺漏严重 → 大量扩展 `locate.js` 的 `extra` 数组

---

## 方向 E：跨 JSON 一致性校验（关系对称 + ID 引用完整性）✅ 已完成

### 问题背景

pilot 暴露的"不一致"类问题：
- **关系不对称**：A 的 relationships 里有 B，但 B 的 relationships 里可能没有 A（如段誉↔阿碧单向）
- **ID 引用悬空**：`known_skills` 引用不存在的 skill_id；`faction` 字段值在 factions.json 里找不到；`items.related_characters` 引用不存在的 char_id
- **power_rank 不一致**：同一个人物在不同 context 下 power_rank 不同（如萧峰在 characters.json 是"出神入化"，但在 skills.mastery_rank 是"登峰造极"）
- **faction/character 对不上**：characters.faction = "大理段氏"，但 factions.json 里没这个 faction

### 实现状态

已实现 `cross-validate.js`，检查项包括：
1. ✅ 关系对称性：对每个 (A→B, type)，检查 B→A 是否存在
2. ✅ ID 引用完整性：characters.known_skills/faction、items.owner/related_characters、dialogues.speaker/listener、skills.faction、techniques.source_skill
3. ✅ 枚举一致性：检查 character.power_rank vs skill.mastery_rank 的差距
4. ✅ alias 去重：同一 alias 不能出现在多个 character 下（除泛称）
5. ✅ 幻觉检测：检查实体是否在 mention_summary.json 里被提及（方向 G 已集成）

**输出**：`cross_validation_report.json`，包含 errors/warnings/info 分级的问题列表。

### 天龙八部测试结果

- Total issues: 127
- Errors: 38（主要是 faction ID 引用不匹配、skill ID 不存在）
- Warnings: 80（关系不对称、幻觉检测）
- Info: 9（等级不一致）

---

## 方向 F：预生成大纲（outline）阶段 ✅ 已完成

### 问题背景

pilot 暴露的"浅层"类问题：
- 一些次要角色的 personality / one_line 是套话（如"豪迈刚烈"）
- 一些事件的 anchor 过于笼统（如"段誉在江湖中历练"）
- LLM 在单次大生成里对后期实体（如第 42 个角色）的注意力不如前期

根本问题：LLM 一次性生成 42 个角色 + 数百条 source_ref 时，注意力分散，对尾部实体的细节处理粗糙。

### 改造方案

在 Phase 2 Pass 1 之前，加一个 **Phase 1.5：outline 阶段**：

```bash
# 主 agent 生成 outline（一次性小生成）
# 读取：prompts/outline.md
# 输入：manifest.json + mention_summary.json
# 输出：outline.json（约 20-30KB）
```

**产物**：`outline.json`（约 20-30KB，LLM 注意力集中在宏观结构上）

**然后 Pass 1 改为**：以 outline.json 为骨架，对每个实体填充 details。LLM 不再需要同时决定"列谁"和"细节是什么"，注意力更聚焦。

### 预期收益

- 实体遗漏率 0%（outline 已锁定清单）
- 尾部实体的细节质量提升（每次只填 5-10 个实体的 details）
- 套话率下降（因为 LLM 在 outline 阶段已写过"一句话定位"，Pass 1 不会再写套话）

### 风险

- 多一次 LLM 调用（但成本小，outline 生成 < 50K tokens）
- 如果 outline 里有遗漏，Pass 1 不会补

### 实现状态

**已实现**：
- `prompts/outline.md`：outline 生成 prompt 模板
- 更新 `prompts/pass1-entities.md`：添加对 outline.json 的支持
- 更新 `SKILL.md`：添加 Phase 1.5 阶段说明

**使用流程**：
1. Phase 1 完成后，运行 Phase 1.5 生成 outline.json
2. Pass 1 读取 outline.json 作为骨架，对每个实体填充 details
3. 如果 outline.json 不存在，Pass 1 按原有流程生成

---

## 方向 G：幻觉检测器（跨书混淆专项）✅ 已完成

### 问题背景

pilot 暴露的"幻觉"类问题：
- **跨书混淆**：items.json 里出现"玄铁令"（实际是《侠客行》的道具，不是《天龙八部》的）
- **武功张冠李戴**：某 character 的 known_skills 里出现其他书的武功
- **人物混入**：character 里出现其他书的配角

根本问题：LLM 的训练数据里金庸 15 部作品高度重叠，生成《天龙八部》时容易混入《射雕》《神雕》《侠客行》的元素。

### 实现状态

已集成到 `cross-validate.js` 的幻觉检测模块：
1. ✅ 阶段 2（生成后反向校验）：检查 character/item/skill/faction 是否在 mention_summary.json 里被提及
2. ⏳ 阶段 1（生成时显式约束）：需要在 prompt 里添加禁用清单（待实施）

**幻觉检测逻辑**：
- 对每个 character，检查 name 或 alias 是否在 mention_summary.json 的 terms 里
- 对每个 item/skill/faction，检查 name 是否在 mention_summary.json 里
- 如果不在，标记为 `possible_hallucination`（severity: warning/info）

### 天龙八部测试结果

- 16 个 character 被标记为可能幻觉（如扫地僧、段延庆、康敏等 —— 这些可能是 mention_summary 覆盖不全，需要人工复核）
- 18 个 item 被标记（如六脉神剑谱、北冥神功帛卷、珍珑棋局等）
- 3 个 skill 被标记（天山折梅手、天山六阳掌、八荒六合唯我独尊功）
- 5 个 faction 被标记（大理段氏、姑苏慕容氏等）

**注意**：部分标记的实体可能是 mention_summary 覆盖不全（如"扫地僧"在原文中可能用其他称呼），需要人工复核确认。

---

## 方向 H：mention_index 覆盖率闭环 ✅ 已完成

### 问题背景

pilot 中 mention_summary.json 有 85 个高频术语，但 KB 只覆盖了 24 个（28%）。剩下的 61 个里：
- 一些是已被 KB 实体覆盖但 alias 没匹配（如"少林"在 factions.json 是"少林寺"，alias 没含"少林"）
- 一些是 LLM 认为不重要没生成（如配角名、小地名）
- 一些是 mention_index 误识别（如把"段誉"误识别为两个独立词）

### 改造方案

**闭环流程**：

1. 跑 mention_index 后得到 `mention_summary.json`
2. LLM 生成 KB（8 个 JSON）
3. **新增**：跑 `coverage-gap.js`，对比 mention_summary.json 和 KB，输出：
   ```
   高频提及但 KB 缺失的实体（total mentions > 100）：
   - 少林 (852 mentions)
   - 大理 (661 mentions)
   - 西夏 (424 mentions)
   ...
   ```
4. 如果缺失项 > 5 个，触发 Pass 3 补丁：让 LLM 专门补生成这些实体
5. 重复直到覆盖率 ≥ 90%

### 预期收益

- mention 覆盖率 28% → 90%+
- 重要配角/门派/地点不会遗漏

### 天龙八部测试结果

**覆盖率分析**：
- Total mention terms: 85
- Covered by KB: 231（names + aliases）
- Gaps found: 17

**高频缺口（>=100 mentions）**：
- 少林 (852 mentions) - 可能是"少林寺"的简称
- 大理 (661 mentions) - 可能是"大理段氏"的简称
- 西夏 (424 mentions) - 可能是"西夏皇室"的简称
- 星宿 (420 mentions) - 可能是"星宿派"的简称
- 姑苏 (188 mentions) - 可能是"姑苏慕容氏"的简称
- 慕容氏 (163 mentions) - 可能是"姑苏慕容氏"的简称
- 段氏 (144 mentions) - 可能是"大理段氏"的简称
- 辽国 (134 mentions) - 可能是"辽国皇室"的简称
- 青城 (100 mentions) - 可能是"青城派"的简称

**结论**：这些"缺口"很可能是 alias匹配问题（如"少林"是"少林寺"的简称），需要在下次重跑时补充 alias。

---

## 方向 I：双视角对抗校验（同模型 + 不同 prompt）✅ Phase 1 已完成

### 问题背景

当前 pipeline 只有一个 LLM 角色（生成者），没有 reviewer。生成者自己不会发现自己的错误——比如把《侠客行》的"玄铁令"错当成《天龙八部》的道具写进 items.json（pilot 中真实发生过，后人工剔除），或者把其他书的人物/武功混入当前书，只有人工核对才能发现。

### 核心思路：同模型 + 不同 prompt = 视角切换

审阅的核心价值不是"知识不同"，而是**prompt 驱动的视角切换**：
- **生成者 prompt**：你是知识库建设者，目标是写全、写连贯
- **审阅者 prompt**：你是知识库质疑者，目标是挑刺、找反例

同一个模型在两种 prompt 下会给出不同的关注点——这是 prompt engineering 的 "debate" 模式。**同模型 + 不同 prompt 就能拿到 80% 的收益**。

**为什么不需要不同模型**：
- 审阅的价值在于"视角切换"，不在于"知识不同"
- 同模型在不同 prompt 下会关注不同的问题
- 成本更低（只需多一次 LLM 调用）

**什么时候需要不同模型**：
1. **训练数据偏差**：如梁羽生小说，不同模型覆盖差异大
2. **模型特定幻觉**：某模型有稳定可复现的幻觉模式
3. **质量要求极高**：KB 准备作为下游 RAG 系统的核心数据源

### 分级实施方案

#### Phase 1（必做）：同模型 + 单个 reviewer prompt ✅ 已完成

```
生成者 LLM (model A) → 8 个 JSON
↓
同一 LLM (model A) + reviewer prompt → review_report.md
prompt: "你是武侠设定库的审阅专家，目标是挑刺。请审阅以下 JSON，
挑出 10-20 条最可疑的条目（可能错误 / 可能幻觉 / 可能错位），
给出你的质疑理由和依据。"
↓
主 agent 根据 review_report 决定：
- 高置信质疑 → 触发 Pass 3 补丁
- 低置信质疑 → 标为"待人工复核"
```

- **成本**：×2（多一次 LLM 调用）
- **收益**：80%（能捕获逻辑错误、事实冲突、跨书混淆等明显错误）
- **适用**：所有书籍的常规跑

**已实现工具**：
- `scripts/review-dialogues.js`：生成 dialogues 审阅 prompt
- `prompts/review-dialogues.md`：审阅 prompt 模板（检查跨书混淆、说话风格、时代背景、措辞偏差、情节逻辑）
- 输出：`<小说目录>/review/review-prompt.md`（供 LLM 审阅）
- 分析：`<小说目录>/review/check-review.js`（分析审阅结果，提取可疑对话索引）

**天龙八部审阅结果**：
- 430 条 dialogues 中审阅了前 50 条
- 发现 4 条低严重程度措辞问题（无 high/medium）
- 没有跨书混淆、时代错误或情节逻辑错误
- 2 条建议重读原文（#44 "横蛮"词序错误, #46 "焦急死了"现代口语）
- 结论：dialogues.json 质量不错，仅需重读 2 条

#### Phase 2（可选）：同模型 + 多个 reviewer prompt（多角度审阅）

```
生成者 LLM (model A) → 8 个 JSON
↓
同一 LLM (model A) + reviewer prompt A（跨书混淆视角）→ review_report_A.md
同一 LLM (model A) + reviewer prompt B（说话风格视角）→ review_report_B.md
同一 LLM (model A) + reviewer prompt C（时代背景视角）→ review_report_C.md
↓
合并 review_report_A/B/C，去重后触发 Pass 3 补丁
```

- **成本**：×3-4（多个 reviewer prompt）
- **收益**：90%（多角度审阅，覆盖更多问题）
- **适用**：对质量有更高要求，或跑新书时

#### Phase 3（高要求）：不同模型 + reviewer prompt（捕获训练数据偏差）

```
生成者 LLM (model A) → 8 个 JSON
↓
审阅者 LLM (model B) + reviewer prompt → review_report.md
例：Claude 审 Gemini 生成的 / GPT-4 审 Qwen 生成的
```

- **成本**：×2-3（不同模型价格差异）
- **收益**：95%（额外捕获训练数据偏差、模型特定幻觉）
- **适用**：对质量有极高要求，或跑小众作品（梁羽生/黄易）时

### 预期收益

- 跨书混淆类幻觉（如"玄铁令"事件）能被自动发现
- 同模型 reviewer 能捕获 80% 的明显事实错误
- 多角度审阅（Phase 2）能覆盖更多问题
- 不同模型（Phase 3）能捕获训练数据偏差

### 风险

- Phase 1 成本低但审阅者可能有"假阳性"（误判正确条目为错误），需要主 agent 裁决
- Phase 2 成本中等，按需启用
- Phase 3 成本高，仅在质量要求极高时启用
- reviewer prompt 需要仔细调优，避免过度挑刺

---

## 方向 J：source_ref 质量分级

### 问题背景

pilot 中 source_ref 的 anchor 描述质量参差不齐：
- 高质量："段誉与乔峰在无锡松鹤楼斗酒四十碗结拜为兄弟"（具体人物 + 地点 + 事件）
- 低质量："段誉在江湖中历练"（笼统，无法定位）

低质量 anchor 导致 locate.js 无法找到合适的候选位置。

### 改造方案

在 prompt 里加 **anchor 质量标准**：

```markdown
### anchor 质量标准（每条必须满足）

1. **至少 2 个具体实体**：人名 + 地名，或人名 + 武功名，或人名 + 事件词
2. **避免笼统动词**：不要"历练、游历、参与、出现"，要用"斗酒、误杀、拜师、定情、揭晓"
3. **长度控制**：20-50 字之间（太短无法定位，太长 locate 匹配率下降）
4. **事件明确**：必须能回答"谁在什么地方做了什么"
```

**生成后评分**：给每个 anchor 打分（基于上述 4 条标准），低分触发重生成。

### 预期收益

- locate.js 的"无法定位"率从 0%（当前已 100% locate）进一步降低"候选错位"率
- 人工抽样事件匹配率从 100% 保持（已是满分）

---

## 不做的事

- **方向 B 的扩展：climax 子类型**（如 fight / revelation / romance / death）—— 收益递减，不做
- **二次 LLM 评估**：让 LLM 对候选段落打分（"此段是否描述 anchor 事件？"）—— 成本高，事件匹配已 100%，不做
- **direction A 继续细化**（如按段落事件类型二次排序）—— 当前多候选已够用，不做
