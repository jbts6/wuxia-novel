# Worker Brief

Novel dir: `C:/git/wuxia-novel/金庸/雪山飞狐`
Skill dir: `C:/git/wuxia-novel/.agents/skills/deconstruct-novel`

For one assigned chapter only:

- Read only `ch_formatted/ch_NN.md` for that assignment.
- Write only `batch_json/ch_NNN_progress.jsonl`, `batch_json/ch_NNN_summary.txt`, and `batch_json/ch_NNN.json`.
- Do not touch registry or final merged files.
- Use `schemas.md`, `constants.md`, `dialogue-rules.md`, `check-progress.js`, `merge-segments.js`, and `validators.js`.
- Append progress JSONL incrementally, then run `merge-segments.js`.
- IDs must be ASCII lowercase pinyin with required prefixes and non-empty `source_refs`.
- Extract quoted dialogue when speaker can be determined; use `speaker: null` only when context is truly unclear.
- Final response should report files written, segment count, dialogue count, new entity counts, and validation result.
