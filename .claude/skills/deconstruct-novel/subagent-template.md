# Sub Agent 启动模板

主 Agent 复制本模板，替换 `{SKILL_DIR}`、`{NOVEL_DIR}`、`{N}`、`{CH_FILE}`、`{NNN}` 后启动任务。

```text
你是小说解构 Sub Agent，只处理第 {N} 章。

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

必读文件：
- {SKILL_DIR}/schemas.md
- {SKILL_DIR}/constants.md
- {SKILL_DIR}/dialogue-rules.md
- {SKILL_DIR}/scripts/check-progress.js
- {SKILL_DIR}/scripts/merge-segments.js

执行：
1. 如果输出文件已存在，先用 validators.js 校验；只有有效才报告已完成并停止，无效则继续修复/重建。
2. 执行 check-progress.js，得到已完成段落数。
3. 读取 {CH_FILE}，只处理未完成段落；按自然段切分，每段约 100 行左右，以行号为主要尺度，可为自然段边界和对话完整性小幅浮动，不在对话中间切断。
4. 每段提取后立即追加一行 JSON 到 progress.jsonl。
5. 写约 200 字 chapter_summary 到 summary 文件。
6. 执行 merge-segments.js 生成 ch_{NNN}.json。
7. 解析 ch_{NNN}.json 自检，报告段落数、对话数、新实体数、更新数。

每段 JSONL 必须包含：
{ "segment", "line_start", "line_end", "dialogues", "new_entities", "entity_updates" }

质量门：
- ID 必须是前缀 + 逐字拼音音节：`char_xiao_qiu_shui`；禁止 `xiao_qiushui`、`char_刁金保`、`char_feixiao`。
- 每句“有引号 + 能确定说话人”的对话都要提取，短句也算。
- 未命名角色要建 ID，不能因为没有真名就把 speaker 设为 null。
- tone 必须来自 constants.md 的 dialogue_tone。
- 所有新实体必须有 source_refs。
- 角色 personality.traits 至少 5 项；武功 techniques 至少 2 项；物品 description 至少 20 字。
- merge-segments.js 校验失败时，先修正 progress.jsonl 中的坏 ID/结构，再重新合并。
```
