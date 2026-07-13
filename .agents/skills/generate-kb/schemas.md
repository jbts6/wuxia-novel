# JSON 契约

## 写入规则

- 八类正式文件和记录的可执行契约由 `scripts/lib/final-data-contract.js` 统一维护；文档示例不能替代控制器在 `publish` staging bundle 内执行的校验。
- 新 run 的唯一写入入口是 `scripts/pipeline.js`。AI 通过 `claim -> draft -> submit` 只写当前 work item 的非受管 draft；控制器拥有 state、events、ledger、materialized、正式数据和报告。
- `prepare` 到 `semantic-audit` 的实体只使用 `provisional_key`。所有正式 ID 和 ID 引用仅在 `publish` 由 ID plan 生成，并由 `scripts/lib/id-contract.js` 校验和统一投影。
- 所有示例中的字段键均必须存在。允许为空的字段仍要保留正确类型；只有下文明确的条件规则允许空内容。
- draft 必须是单个 packet 允许的 JSON/JSONL 结构，回显 stage、work item ID、input hash 和 lease binding；不得手拼 JSON 字符串。
- `submit` 先完整解析和验证 draft，再原子合并。失败不得部分写入受管产物。
- `source_refs` 采用 **event anchor + 多候选** 格式。LLM 写 `{ chapter, anchor }`（事件描述），由 `locate.js` 自动回填：
  - `chapter` / `line_start` / `line_end` / `text`：primary（最高匹配密度）的精确位置
  - `alternatives: [...]`：跨章事件的备选位置（score ≥ 60% primary 的其他章）
  - `locate_status` / `locate_score` / `locate_method` / `anchors_hit`：locate 元信息
- **跨章事件自然暴露多位置**：如"聚贤庄之战"在 ch17 铺垫 + ch18 血战 + ch19 救走 + ch20 疗伤，会作为 primary + alternatives 同时出现，由用户/下游选择最匹配的一处。
- 你只需要确保：(1) `chapter` 大致正确（事件发生的章节之一）；(2) `anchor` 包含足够的实体关键词让代码能定位（至少 2 个实体：人名 / 地名 / 武功 / 事件词）。
- `name`、`one_line`、`description`、`effects`、`origin`、`personality`、`dynamic` 等人工可读字段禁止英文占位或问号兜底，例如 `unknown`、`weapon`、`???`、`?`、`N/A`。
- enrich 草稿是 publish 输入，不是 raw extraction。复杂字段必须综合当前 run 已闭环的全书证据，不能从旧正式 JSON 复制。

以下八类 schema 描述 `publish` 后的消费接口；其中正式 ID 在此前阶段均以 provisional key 表示。

## characters

```json
{
  "id": "char_<pinyin>",
  "name": "中文名",
  "alias": ["原文真正出现过的别名/称呼"],
  "identity": "身份定位（≤20字）",
  "faction": "所属门派/家族",
  "role": "核心 | 重要 | 次要 | 龙套 | 背景",
  "archetype": "scholar | warrior | monk | assassin | healer",
  "power_rank": "<rank>",
  "importance": "核心 | 重要 | 次要 | 龙套 | 背景",
  "one_line": "基于全书的人物定位（≤40字），不是某章事件",
  "biography": "人物生平概述，覆盖出身背景、关键经历、性格转变、最终结局。要求：每个句子都包含实质性信息，禁止用'非常''极其''无比'等程度副词凑字数。仅核心/重要/次要角色填写，龙套/背景角色留空字符串。",
  "personality": {
    "traits": ["至少 5 项性格特征"],
    "speech_style": "说话风格",
    "temperament": "气质"
  },
  "relationships": [
    {
      "target": "char_<pinyin>",
      "type": "<relationship.type>",
      "intensity": 0-100,
      "bond_level": 1-5,
      "dynamic": "关系变化概述（≤40字）"
    }
  ],
  "known_skills": ["skill_<pinyin>"],
  "related_skills": ["skill_<pinyin>"],
  "rag_refs": [1, 3, 7],
  "source_refs": [
    { "chapter": 1, "line_start": 42, "line_end": 45, "text": "原文片段" }
  ]
}
```

**硬性约束**：
- 同一对 `(id, target)` 在 `relationships` 里只能出现一条。综合全书给出最具代表性的关系。
- `alias` 只收原文真正出现过的称呼。禁止泛称（"青衫年轻男子"、"白衣女子"除非这是唯一称呼）。
- `one_line` 必须反映人物全书定位（如"大理段氏世子，后为帝，一生追寻王语嫣与身世之谜"），不能是某章情节（如"在第3章被蜂麻倒"）。
- 核心/重要/次要角色的 `biography` 必须非空，`personality.traits` 至少 5 项，`speech_style` 与 `temperament` 必须非空。龙套/背景允许空 biography 和空 personality 内容，但字段及其数组/字符串类型必须存在。

## skills

```json
{
  "id": "skill_<pinyin>",
  "name": "功法名",
  "type": "<skill.type>",
  "faction": "所属门派",
  "mastery_rank": "<rank>",
  "one_line": "全书定位（≤40字）",
  "techniques": [
    {
      "id": "tech_<pinyin>",
      "name": "招式名",
      "type": "<technique.type>",
      "description": "从原文提取的真实描述（≥20字），禁止模板"
    }
  ],
  "progression": "功法修炼阶段（如有）",
  "effects": [{ "type": "<effect.type>", "description": "..." }],
  "combat_style": "战斗风格",
  "rag_refs": [1, 5, 12],
  "source_refs": [{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "..." }]
}
```

**硬性约束**：
- `techniques` 仅当原文有明确招式名时才填入，不要凑数。内功/身法类（北冥神功、凌波微步）通常 `techniques: []`。
- 禁止模板化 description："降龙十八掌的代表性变化：亢龙有悔" 是错的。"洪七公传授的第一招，劲力刚猛，蓄而后发，留有余力" 是对的。
- `type`、`mastery_rank`、`one_line`、`combat_style` 必须非空且符合枚举；`faction`、`progression`、`techniques`、`effects`、`rag_refs` 可以按原文为空，但字段必须存在且类型正确。

## techniques

所有原文明确定名且可定位的招式都必须作为独立条目写入 `techniques.json`。`skills.techniques` 可同时引用它们，但不能替代独立条目。冷门、低频或威力弱只影响 `importance`，不得删除。

必填：`id`、`name`、`type`、`description`、`source_skill`（可为 null）、`source_refs`。

`description` 必须非空；`source_skill` 无法归属时写 null，不能省略字段。

## factions

```json
{
  "id": "faction_<pinyin>",
  "name": "门派名",
  "type": "<faction.type>",
  "location": "loc_<pinyin>",
  "leader": "char_<pinyin> 或 null",
  "sub_divisions": [],
  "one_line": "≤40字",
  "source_refs": [{ "chapter": 1, "anchor": "..." }]
}
```

必填：`id`、`name`、`type`、`location`、`leader`、`sub_divisions`、`one_line`、`source_refs`。

`type` 与 `one_line` 必须非空；`location`、`leader` 可为 null，`sub_divisions` 可为空数组，但字段不能缺失。

## locations

必填：`id`、`name`、`region`、`one_line`、`source_refs`，且 `region`、`one_line` 必须非空。

## items

```json
{
  "id": "item_<pinyin>",
  "name": "物品名",
  "type": "<item.type>",
  "tags": ["<tag1>", "<tag2>"],
  "owner": "char_<pinyin>、faction_<pinyin> 或 null",
  "one_line": "≤40字",
  "description": "≥20字",
  "effects": [{ "type": "<effect.type>", "description": "..." }],
  "origin": "来源",
  "related_characters": ["char_<pinyin>"],
  "related_skills": ["skill_<pinyin>"],
  "rarity_tier": "<item.rarity_tier>",
  "rag_refs": [1, 5],
  "source_refs": [{ "chapter": 1, "line_start": 42, "line_end": 45, "text": "..." }]
}
```

**硬性约束**：只收真正重要的物品（推动剧情/体现人物/武学相关），不要凑数。**必须为每个物品分配 `rarity_tier`**（凡品/良品/珍品/神品），不能全部设为"未知"。

所有示例字段必须存在；`tags` 至少一项，`one_line`、`description`、`origin` 必须非空。`owner` 可为 null，`effects`、关联实体与 `rag_refs` 可为空数组。

**tags 字段**：标签数组，用于更灵活的分类。一个物品可以有多个标签。
- 大类：兵器、秘籍、丹药、剧情关键
- 小类：刀、剑、暗器、内功、外功、信物、钥匙等

**type 分类标准**：
- 兵器：刀、剑、枪、棍、棒等武器
- 暗器：袖箭、飞刀、毒针等暗器
- 防具：盔甲、护腕等防护装备
- 丹药：有名字的丹药、补药
- 毒药：毒药、迷药、解药
- 信物：帮派信物、家族信物、身份象征
- 秘籍：武功秘籍、图谱、经书
- 奇门：特殊功法体系（如斗转星移、化功大法等不属于传统兵器/秘籍的武学）
- 坐骑：马匹、骆驼等坐骑
- 食物：有特殊功效的食物
- 工具：有特殊功能的工具
- 饰品：珠宝、玉佩等装饰品
- 异兽：有名字的灵兽、毒物、宠物等活物（如闪电貂、莽牯朱蛤）

**rarity_tier 稀有度**：
- 凡品：普通兵器、常见药物、日常工具
- 良品：名门正派的兵器、有特殊功效的药物、珍贵的秘籍
- 珍品：失传秘籍、罕见神兵、珍贵丹药
- 神品：传说级神兵、失传绝学、极品丹药
- 未知：无法确定稀有度的物品

## dialogues

```json
{
  "id": "dialogue_<pinyin>",
  "speaker": "char_<pinyin> 或 null",
  "speaker_name": "中文名或称呼",
  "listener": "char_<pinyin> 或 null",
  "text": "对话原文，不重写",
  "tone": "<dialogue_tone>",
  "chapter": 1,
  "line_start": 42,
  "line_end": 45,
  "event_id": "event_<pinyin>（event/both 必填）",
  "selection_type": "event|persona|both",
  "selection_reason": "为何是关键事件/人物特征对话",
  "trait_tags": ["朴直", "机敏"],
  "context": "对话发生时的完整原文语境",
  "context_line_start": 40,
  "context_line_end": 47
}
```

**硬性约束**：每个主要事件至少一条关键对话或结构化豁免；每个核心/重要角色至少一条人物特征对话或结构化豁免。必须是完整原文，不重写，不用固定的“每章 N 条”代替语义覆盖。

对话示例字段均必须存在；`speaker`、`listener` 可为 null，但 `speaker` 与 `speaker_name` 至少一个非空。`tone` 必须使用固定枚举；`event|both` 必须有 `event_id`，`persona|both` 必须有非空 `trait_tags`。

## chapter_summaries

```json
{
  "chapter": 1,
  "title": "第X回 标题",
  "summary": "150-250字，覆盖主要情节推进、人物变化、关系转折",
  "key_events": ["事件1", "事件2"],
  "key_characters": ["char_<pinyin>"],
  "source_refs": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}],
  "field_source_refs": {
    "summary": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}],
    "key_events": [{"chapter": 1, "line_start": 1, "line_end": 80, "text": "完整原文证据"}]
  }
}
```

## 描述字段证据

最终实体保持原有 `source_refs` 字段。只要写入 personality、description、effects、mechanism、function、significance 等解释性字段，还必须增加兼容的可选 `field_source_refs` 映射：

```json
{
  "description": "根据原文归纳的描述",
  "field_source_refs": {
    "description": [
      {"chapter": 1, "line_start": 42, "line_end": 45, "text": "支持该描述的完整原文"}
    ]
  }
}
```

`field_source_refs` 是新增可选字段，旧消费者可忽略；但生成了受检描述字段却没有可命中的对应证据时，G3 失败。

受检字段由最终数据契约单点声明：characters 的 `identity/one_line/biography/personality/relationships`，factions 的 `one_line`，locations 的 `region/one_line`，skills 的 `one_line/techniques/progression/effects/combat_style`，techniques 的 `description`，items 的 `one_line/description/effects/origin`，chapter summaries 的 `summary/key_events`。字段非空时必须有独立、可命中的 `field_source_refs`。

## 受管运行与中间产物契约

每个 managed run 位于 `build/generate-kb/runs/<run-id>/`。`events.jsonl` 是 append-only 事实源，`state.json` 是可重建投影；二者只能由控制器写入。阶段产物位于 `materialized/<stage>/`，work item 位于 `work-items/<stage>/{packets,drafts,receipts}/`。

### Work item packet

`claim` 生成的只读 packet 至少包含：

```json
{
  "schema_version": 1,
  "run_id": "run_...",
  "stage": "inventory",
  "work_item_id": "inventory_ch001_w003_named",
  "input_hash": "sha256",
  "worker_id": "worker-a",
  "lease_id": "lease_...",
  "lease_expires_at": "ISO-8601",
  "draft_path": "work-items/inventory/drafts/inventory_ch001_w003_named.json",
  "inputs": []
}
```

AI 不得扩展 `inputs` 范围，也不得改 packet。draft 回显 `run_id/stage/work_item_id/input_hash/lease_id`，并只包含该 packet 的结果。

### Inventory draft 与 receipt

有候选时提交 `payload.candidates`；实际零产出时提交非空的结构化 `payload.empty_result`。receipt 记录 output count、empty result、output hash、attempt 和 packet binding。空文件、只写 `completed_window_ids` 或占位 candidate 均不表示完成。

候选记录使用稳定 `candidate_id`，至少包含 `category_hint`、`name`、`chapter`、`window_id`、`discovery_pass` 和逐字命中的 `source_ref`。允许类别为 `character|faction|location|skill|technique|item|event|dialogue`。

### Reconcile decision

```json
{
  "candidate_ids": ["cand_ch001_w003_0001"],
  "decision": "keep",
  "canonical_name": "躺尸剑法",
  "final_category": "skill",
  "importance": "important",
  "reason": "原文明确定名的剑法",
  "provisional_key": "entity_skill_<stable-hash>",
  "ai_review": {
    "status": "confirmed",
    "note": "复核原文窗口与同名候选后确认"
  }
}
```

允许 decision：`keep|merge|redirect|reject`。reject reason 仅可为 `duplicate|generic_unnamed|not_an_entity|not_source_grounded|trivial|non_major`；命名武功/招式不得用 `trivial` 或 `non_major` 删除。非 reject decision 必须有 canonical name、importance、reason、final category 和 provisional key，但不得有正式 ID。

主要事件、参与者、对白和 semantic exemptions 同样引用 provisional key。豁免必须包含具体原因、可定位 source refs、适用对象和提交它的 work item；“不重要”“无合适对白”等通用文字不能通过 semantic audit。

### Enrich draft

每个实体草稿使用 `provisional_key` 替代正式 `id`，实体引用也使用 provisional key。所有非空受检复杂字段都必须在 `field_source_refs` 中有对应证据。

三个或以上语义不同字段完全复用同一证据组时，必须提交：

```json
{
  "shared_evidence_justification": {
    "field_a": "原文中的哪项事实支持此字段",
    "field_b": "原文中的哪项不同事实支持此字段"
  }
}
```

说明由 `semantic-audit` 独立复核；通用、循环或无法映射原文事实的说明按 `evidence_padding` 阻塞。

### Publish draft

`build-publish <novel-dir> --draft <publish-draft>` 接收一个位于受管 run 目录之外的 JSON 草稿。草稿只提供不能由控制器自行推导的 token plan：

```json
{
  "schema_version": 1,
  "run_id": "run-20260713-001",
  "semantic_audit_hash": "sha256",
  "token_plan": {
    "entity_skill_<stable-hash>": {
      "canonical_name": "躺尸剑法",
      "pinyin_tokens": ["tang", "shi", "jian", "fa"]
    }
  }
}
```

草稿不得放入 `build/generate-kb/runs/<run-id>/`，也不得包含 `report_inputs`、provisional records、source validation、semantic audit 或 recall packet 的替代副本。控制器只从当前 run 的受管 `materialized/`、`source/` 和 `review/` 读取这些内容，重算 reconcile/enrich/semantic hashes 后才构建 bundle。控制器投影正式数据后，用显式 staging data root 实际运行 verification 与 cross-validation，再结合当前受管 source、recall、semantic 和 final-data 结果确定性生成 quality report。`semantic_audit_hash`、`run_id`、未知 provisional key、错误拼音 token、报告生成失败或阶段 PASS 后被修改的 materialized 产物都会阻塞 publish。

### Publish ID plan

只有 `publish` 可把 provisional key 映射为正式 ID：

```json
{
  "entity_skill_<stable-hash>": {
    "canonical_name": "躺尸剑法",
    "pinyin_tokens": ["tang", "shi", "jian", "fa"]
  }
}
```

控制器校验 token plan 后生成带 `final_id` 的受管 `publish/id-plan.json`，并使用同一 ID plan 重写全部记录与引用；遗漏映射、前缀不匹配、冲突 ID 或残留 provisional key 都使 staging bundle 失败。

## 质量报告与审核包

正式报告先生成在 publish staging bundle 的 `reports/`，通过 bundle 自验证和 promote 后才由逻辑 `reports/` 暴露。`quality_report.json` 保留 `completion_gate_passed` 与 G1-G5；不得把低召回报警写成新的 G1-G5，也不得用数量覆盖硬门禁结果。

`final_data_validation.json` 记录八类文件的 `final_data_hash`、数量、缺失/无效文件、schema errors 和 enrichment errors。source validation、semantic audit、verification、cross-validation、quality report、review summary 与 manifest 必须携带并匹配当前 source/final data/bundle hashes；缺 hash 或 hash 陈旧时 publish 失败。

reconcile 后的中途审核包位于 run 的 `review/recall-review-packet.json`，状态使用 `awaiting_recall_review`，不得使用暗示整库完成的 `ready_for_human_review`。它至少包含：

- `source_scale`：章节数、行数、窗口数和 short/medium/long。
- `category_stats`：各类别候选、保留、拒绝、未决和保留率。
- `plausibility_alerts`：blocking/warning、证据和 AI 下一步。
- `high_risk_decisions`：使用 run 配置的上限，默认最多 15 项且可降至 10 项或更低；超过上限时返回 AI 复核，不能截断未展示项。
- `deterministic_samples.retained|rejected`：两侧各最多 3 项，且不得混入未展示的高风险项。
- `actions`：`accept_recall|rerun_recall` 以及每个高风险 decision 的结构化结论。

`recall-review-receipt.json` 必须绑定 source hash、reconcile output hash、reviewer、decision IDs 与人工备注。任一绑定变化后 receipt 失效；receipt 只允许进入 enrich，不能覆盖 semantic 或 publish 门禁。publish 后的 review summary 复用有效 receipt，不再制造第二轮逐项人工终审。

## 可选人工金标

仅识别 `audit/gold.json`，且必须同时满足：

- `provenance` 为 `human_curated`。
- `source_hash` 与当前原文 SHA-256 一致。
- `must_include` / `must_exclude` 每项均有完整、可命中的原文证据位置。

LLM 自动生成的 baseline 不参与召回率或完成门禁。
