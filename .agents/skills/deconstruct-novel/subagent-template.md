# 章节工作模板（Sub Agent / 顺序兼容模式）

主 Agent 复制本模板，替换 `{SKILL_DIR}`、`{NOVEL_DIR}`、`{N}`、`{CH_FILE}`、`{NNN}` 后执行章节任务。

- Sub Agent 可用时：用本模板启动 1 个 Sub Agent。
- Sub Agent 不可用或第三方模型派发失败时：主 Agent 按本模板亲自处理当前 1 章；处理完立刻运行 `resume.js` 决定下一章。

```text
你是小说解构章节处理 Agent，只处理第 {N} 章。

输入：
- 技能目录：{SKILL_DIR}
- 小说目录：{NOVEL_DIR}
- 章节文件：{NOVEL_DIR}/ch_formatted/{CH_FILE}
- 进度文件：{NOVEL_DIR}/batch_json/ch_{NNN}_progress.jsonl
- 摘要文件：{NOVEL_DIR}/batch_json/ch_{NNN}_summary.txt
- 输出文件：{NOVEL_DIR}/batch_json/ch_{NNN}.json

硬性边界：
- 只处理这一章；不要读取其他章节正文。
- 禁止创建脚本文件；需要代码时只用 ctx_execute。
- 禁止使用 Write 工具；写 JSONL/摘要只能用 ctx_execute + fs。
- 只允许写本章 progress、summary、最终 ch_{NNN}.json。
- 使用 CommonJS require；不要 import，不要 .cjs。
- 本章产物是 raw extraction 候选层：优先保留原文证据和可清洗信息，不要假装已经完成最终整理。

必读文件：
- {SKILL_DIR}/schemas.md
- {SKILL_DIR}/constants.md
- {SKILL_DIR}/dialogue-rules.md
- {SKILL_DIR}/scripts/check-progress.js
- {SKILL_DIR}/scripts/merge-segments.js

执行：
1. 如果输出文件已存在，先用 validators.js 校验；只有有效才报告已完成并停止，无效则继续修复/重建。
2. 执行 check-progress.js，得到已完成段落数。
3. **预扫描本章所有功法名称**：通读本章全文，列出所有出现的武功/功法名称（含门派名+武功、角色+武功等组合）。对照 entity_registry.json 已有 skills，标记哪些是新功法、哪些需要更新。这一步是硬性要求，不可跳过。
4. 读取 {CH_FILE}，只处理未完成段落；按自然段切分，每段约 100 行左右，以行号为主要尺度，可为自然段边界和对话完整性小幅浮动，不在对话中间切断。
5. 每段提取后立即追加一行 JSON 到 progress.jsonl。
6. 写约 200 字 chapter_summary 到 summary 文件。
7. 执行 merge-segments.js 生成 ch_{NNN}.json。
8. 解析 ch_{NNN}.json 自检，报告段落数、对话数、新实体数、更新数。

每段 JSONL 必须包含：
{ "segment", "line_start", "line_end", "dialogues", "new_entities", "entity_updates" }

质量门：
- ID 必须是前缀 + 逐字拼音音节：`char_xiao_qiu_shui`；禁止 `xiao_qiushui`、`char_刁金保`、`char_feixiao`。
- 每句“有引号 + 能确定说话人”的对话都要提取，短句也算。
- 未命名角色要建 ID，不能因为没有真名就把 speaker 设为 null。
- tone 必须来自 constants.md 的 dialogue_tone。
- 所有新实体必须有 source_refs。
- `source_refs[].text` 必须能让人工复核，不要只写一两个字；尽量保留包含实体名和动作/描述的原文短句。
- 实体输出必须使用语义字段：功法写 `mastery_rank`，角色写 `power_rank` 与 `importance`，物品写 `rarity_tier`。
- 不要把角色重要性、英文标签、数字评分或物品稀有度塞进 `rank`；`rank` / `rarity` 只作为兼容别名。
- 人工可读字段禁止写英文占位或问号：不要写 `unknown`、`weapon`、`hidden_weapon`、`???`、`?`、`N/A`。无法判断时用中文说明；字段枚举不允许中文说明时，按 schema 的合法兜底值处理。
- 角色 personality.traits 至少 5 项；武功 techniques 至少 2 项（原文有更多招式时必须全部提取）；物品 description 至少 20 字。
- technique 的 description 禁止使用"XXX的代表性变化：YYY"模板，必须从原文提取真实描述。
- 功法名去掉人名前缀（"柯镇恶伏魔杖法"→"伏魔杖法"），保留门派前缀（"全真剑法"保留）。
- 道具 type 必须映射为 11 种标准值（兵器/暗器/防具/丹药/毒药/信物/秘籍/坐骑/食物/工具/饰品），未映射的不提取。
- 道具必须有剧情意义或明确特殊属性；普通兵器、临时物、场景物、日用品不提取。类型不明时不要用英文原始类型硬塞。
- 泛称角色（黑衣人、老者、女子、弟子等）只在对话归属、剧情动作或后续身份揭示需要追踪时建立；不要把普通路人批量提升为重要角色。
- `one_line` 要能让人工一眼判断实体是什么，不要只重复名称或写空泛词。
- merge-segments.js 校验失败时，先修正 progress.jsonl 中的坏 ID/结构，再重新合并。
```
