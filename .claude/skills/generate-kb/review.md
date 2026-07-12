# 归并与审核规则

## 候选审核

逐条检查 `build/candidates.jsonl`，不得只抽样：

- source_ref 的完整引文是否在声明章节和行范围命中。
- 名称是否为原文明确定名，而非模型概括。
- skill/technique 是否正确；不确定时保留并 redirect，不能静默删除。
- 同名、别名和跨窗口重复是否 merge 到同一 final ID。
- reject 是否使用标准原因并写清证据。

命名武功与招式即使低频、弱小或不影响主线，也必须进入最终数据并用 `importance` 分级。`non_major`、`trivial` 不得作为武功/招式 reject reason。

## 类别审核

- characters：保留影响事件、关系或具有鲜明辨识度的角色；纯背景人物可 reject，但保留 decision。
- factions：区分正式组织、门派与临时群体；别名合并。
- locations：保留事件发生地、势力驻地和有游戏场景价值的地点。
- items：检查秘笈/图谱、信物、兵器、药物、钥匙及剧情链条中的普通物品，防止只收“神兵”。
- skills：武学体系、功法、门类。
- techniques：命名的一招一式；即使 skill 内已有引用，也要能在 `techniques.json` 独立查询。

## 事件与对话审核

每个 `main` event 必须满足以下之一：

- 至少一条 `event_id` 指向它的完整原文对话。
- `semantic-exemptions.json` 有具体、可审核的无合适对话原因。

每个核心/重要角色必须满足以下之一：

- 至少一条由其说出、`selection_type=persona|both`、带 `selection_reason` 或 `trait_tags` 的原话。
- 有具体的无直接发言豁免。

以下情况不合格：只因“有 speaker”就算代表性；按每章固定条数凑数；改写、拼接或只验证前缀；台词真实但与事件/人物特点无关。

## 完成审核

检查 `reports/quality_report.json`：

- `completion_gate_passed` 必须为 true。
- G1-G5 每项必须单独 PASS，任何一项不得由其他类别数量补偿。
- `baseline_mode=no_gold` 是合法状态，但不能声称已测得完整召回率。
- 人工 gold 只有 `human_curated`、source hash 一致且每项有完整原文证据时有效。

旧 baseline、overall score、类别最低数量只能作为线索，不是完整性证明。
