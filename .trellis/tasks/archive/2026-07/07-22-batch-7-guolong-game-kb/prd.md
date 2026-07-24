# 批量构建古龙 7 本 game-kb

## Goal

按固定顺序，用 `generate-game-kb` v7 skill 为以下小说生成并安装游戏知识库：

1. 古龙/血海飘香（ch_split 27 章）
2. 古龙/大沙漠（ch_split 36 章）
3. 古龙/画眉鸟（ch_split 36 章）
4. 古龙/桃花传奇（ch_split 14 章）
5. 古龙/新月传奇（ch_split 13 章）
6. 古龙/午夜兰花（ch_split 12 章）
7. 古龙/蝙蝠传奇（ch_split 23 章）

合计约 161 章。串行：上一本 `status: complete` 后再开下一本。

## Requirements

- 使用 `node .agents/skills/generate-game-kb/scripts/flow.js` 的 v7 公开命令：`run` / `status` / `retry-unit` / `archive-abandoned`
- 严格 skill 循环：`run` → 按返回 `jobs` 派发 Worker → 写完后再 `run`；`waiting` 不补位
- 固定窗口最多 5 章；`producer: chapter-worker` 派章节 Worker；`main-agent-repair` 由主代理机械修复
- 同一单元 cycle 最多两次 attempt；第二次失败进入 `manual_review`，须用户确认后才 `retry-unit --confirm`
- 旧版本 run 只允许 `status` / `archive-abandoned`；继续写入必须新开 v7 run
- 本任务只做运行与跟踪，不改 skill / controller 代码（关系修复见 `07-22-game-kb-relation-repair`）

## Acceptance Criteria

每本小说完成后，`<novel>/data/` 恰好包含且通过安装验证：

- [x] characters.yaml
- [x] skills.yaml
- [x] items.yaml
- [x] factions.yaml
- [x] chapter_summaries.yaml

顺序完成清单：

- [x] 血海飘香 complete（27，commit `49776516`）
- [x] 大沙漠 complete（36）
- [x] 画眉鸟 complete（36）
- [x] 桃花传奇 complete（14）
- [x] 新月传奇 complete（13，含 relation-recovery）
- [x] 午夜兰花 complete（12）
- [x] 蝙蝠传奇 complete（23）
- [x] 剑神一笑 complete（20，旧 archive + 新 v7）
- [x] 多情剑客无情剑 complete（90，run `run-2026-07-23T11-16-12-172Z-37452-aef76d15`，commit `bf878f35`）
- [x] 陆小凤传奇 complete（65，run `run-2026-07-23T11-16-13-296Z-37604-e262c2ab`）
- [x] 绝代双骄 complete（127，run `run-2026-07-23T11-16-14-397Z-39924-541d9cbd`，commit `14f18e33`）

**追加批次（梁羽生，用户 2026-07-24）** — 括号为用户参考字数/规模，实际章数以 controller 拆章为准：

- [x] 游剑江湖（81.2）complete 69 章，commit `e3d4cb2e`
- [x] 牧野流星（80.2）complete 65 章，commit `8fddd8be`
- [x] 风雷震九州（63.5）complete 56 章，commit `d286b57f`
- [x] 武当一剑（58.8）complete 18 章，commit `8f9212d7`
- [x] 剑网尘丝（58.6）complete 18 章，commit `20db7549`
- [x] 侠骨丹心（57.6）complete 52 章，commit `a44d9068`
- [x] 弹指惊雷（47.0）complete 20 章，commit `3cb25007`
- [x] 绝塞传烽录（34.4）complete 17 章，commit `2653ed12`
- [x] 幻剑灵旗（33.6）complete 2 章，commit `92d4eb62`

路径前缀：`梁羽生/<书名>/`。

**派发顺序（用户纠正 2026-07-24）**：**按清单顺序串行开书**，不要一次开全部。
只有当前焦点书的可派发 active job **填不满**跨书 cap 时，才开下一本补位。
例：单书窗口 10、跨书 cap 20 → 通常同时最多 2 本；上一本可派发数填不满空位时才 `run` 下一本。
已误开的后续 run 可保留在磁盘，但**不得向非焦点书派 worker**，直到轮到它。

与古龙批次共用：跨书 worker cap 20；单书新建 run `max_active_units` 10；每本 complete 后单独 commit。

**中断原因**：skill 升级要求 `timing_contract_version: 1`，无该字段的既有 v7 run 变为只读，禁止补写/迁移，只能 archive-abandoned 后新开 run。

用户授权：manual_review 自动 `retry-unit --confirm`；`reference-recovery` 自动 `recover-relations --confirm`；worker 并发 **20**（跨书合计，有空位即补；单本 `max_active_units` 默认 10，旧 run 无字段兼容 5）

## Constraints

- 进度以各本 `.game-kb-work/runs/<run_id>/` 与本 PRD 勾选为准
- `manual_review` 时停止自动推进，报告用户
- 会话中断后用 `status` 恢复 active job 路径，不得猜路径

## Notes

- Lightweight task：PRD-only
- 括号数字（用户参数 14.9 等）与 ch_split 章数不一致时，以 controller 从根 `.txt` 拆章结果为准

用户补充：worker 并发 cap 20（跨书）；**每本书 complete 后单独 commit 一次**（data + reports）。


Skill 更新：单书固定窗口默认 `max_active_units: 10`（新建 run）；旧 run 无该字段仍兼容 5。跨书 worker 派发 cap 20。
开书策略：**顺序焦点书优先**；仅当焦点书填不满 cap 才开下一本（禁止一次拉起全部书）。
