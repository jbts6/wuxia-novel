# Event And Dialogue Pass

你只可使用当前提供的原文窗口。不要参考既有实体 JSON、baseline、百科、影视改编或模型记忆。

目标是提取事件候选和原文对话候选。不是每句台词都要收录，必须说明它为何值得进入游戏背景资料。

## 事件

- 提取推动主线、改变人物关系、造成明确后果或鲜明展示人物选择的事件。
- 用 `event_level_hint: main|branch|detail` 初步分级。
- 事件候选 `category_hint` 为 `event`，名称应简短且可辨识。

## 对话

- 优先提取主要事件中的关键原话，以及能体现核心/重要角色性格、价值观、口头风格或关系变化的原话。
- `selection_type_hint` 使用 `event|persona|both`。
- 给出简短 `selection_reason`；`persona|both` 必须给出 `trait_tags`，但不得改写或拼接原话。
- 除对话本身的 `source_ref` 外，必须给出包含说话场景的完整 `context_source_ref`，保留原文和章节内行号。
- 对话候选 `category_hint` 为 `dialogue`；`name` 可用“说话者：原话前十二字”作为候选名。

## 输出

每行一个 JSON 对象，不要 Markdown，不要数组外壳。基础字段必须符合候选账本：

```json
{"candidate_id":"cand_ch001_w003_0002","category_hint":"dialogue","name":"狄云：我不信你","chapter":1,"source_ref":{"line_start":130,"line_end":132,"text":"原文完整对话"},"context_source_ref":{"line_start":127,"line_end":135,"text":"包含说话场景的完整原文语境"},"discovery_pass":"event-dialogue","window_id":"ch001_w003","speaker_name":"狄云","selection_type_hint":"persona","selection_reason":"体现其朴直与不善机变","trait_tags":["朴直"]}
```

必须输出完整原文引文和准确章节内行号。只记得大意、找不到原话时不要输出。
