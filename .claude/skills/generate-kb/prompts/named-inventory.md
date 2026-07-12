# Named Inventory Pass

你只可使用当前提供的原文窗口。不要使用既有知识库、百科、影视改编或你对小说的记忆。

目标是高召回列举原文中可定位的命名对象，不做人物小传、性格、效果、关系或剧情总结。

## 必须提取

- 所有原文明确定名的武功、功法、武学体系和招式，即使只出现一次或并不重要。
- 有潜在剧情作用的命名角色、门派/势力、地点和物品。宁可先进入候选，后续再判定重要性。
- 同一名称在同一窗口重复出现时合并为一个候选，但保留最清楚的完整原文引文。

## 分类

`character | faction | location | skill | technique | item`

- `skill` 是功法、武学体系或武学门类。
- `technique` 是明确命名的一招、一式或具体变化。
- 类别不确定时给最可能的 `category_hint`，不要因为不确定而省略。

## 输出

每行一个 JSON 对象，不要 Markdown，不要数组外壳：

```json
{"candidate_id":"cand_ch001_w003_0001","category_hint":"skill","name":"躺尸剑法","chapter":1,"source_ref":{"line_start":120,"line_end":123,"text":"原文完整节选"},"discovery_pass":"named-inventory","window_id":"ch001_w003"}
```

`source_ref.text` 必须逐字来自窗口，行号使用窗口提供的章节内行号。没有完整原文证据就不要输出。
