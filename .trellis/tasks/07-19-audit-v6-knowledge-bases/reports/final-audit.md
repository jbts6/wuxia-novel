# Final V6 Knowledge Base Audit

Repository: `C:\git\wuxia-novel`

Canonical validator: `verifyInstalled()`, semantic contract 6.

Books: 87; knowledge bases: 18; qualified: 18; unqualified: 0; migratable: 0; non-migratable: 0.

## Migration Outcome

- Initially qualified and preserved byte-for-byte: `古龙/剑神一笑`.
- Migrated and installed as V6: `古龙/多情剑客无情剑`, `古龙/绝代双骄`, `古龙/陆小凤传奇`, `古龙/飞刀，又见飞刀`, `金庸/书剑恩仇录`, `金庸/侠客行`, `金庸/倚天屠龙记`, `金庸/天龙八部`, `金庸/射雕英雄传`, `金庸/白马啸西风`, `金庸/碧血剑`, `金庸/神雕侠侣`, `金庸/笑傲江湖`, `金庸/连城诀`, `金庸/雪山飞狐`, `金庸/飞狐外传`, `金庸/鹿鼎记`.
- Final migration failures: none. Archived without migration: none.
- All 17 pre-migration payloads have manifest-backed local archives. `金庸/倚天屠龙记` recovered from one post-archive Windows `EPERM` rename failure by using the recorded same-run retry command.
- Canonical installed verification passed for all 18 active knowledge bases with zero blocking errors. Active knowledge-base directories contain exactly five YAML data files and no legacy JSON data set.

## Acceptance Evidence

- `initial-audit.json` records the original 1 qualified / 17 unqualified classification, source selection, eligibility, rejected records, hashes, and the protected `古龙/剑神一笑` byte hashes.
- `migration-plan.json` records 17 default-dry-run commands and explicit confirm commands; all dry runs left the 17 book trees unchanged, and all 17 isolated candidates passed canonical workspace verification before mutation.
- Each migrated book's `reports/migration-report.json` and install receipt bind the source, converted/rejected records, final hashes, archive manifest, published run, and successful installed verification. `migration-results.json` is the complete outcome/archive/retry index.
- All 17 legacy `archive-manifest.json` files map original paths to archive paths, record `LEGACY_INSTALLATION_UNQUALIFIED` with the initial canonical blocking errors, and still verify all 1,108 archived file hashes.
- The final protection hashes for `古龙/剑神一笑` equal the initial hashes for five YAML files, the install receipt, and 80 published-run files.
- Git path validation found no changes to novel root text, `ch_split/`, `.claude/skills/*`, `docs/wuxia-kb-build-priority.md`, or unexplained user paths; every migrated-path change maps to an archive manifest entry or an approved active V6 file.
- The full generate-game-kb suite passed under `--throw-deprecation`: 58 test files, 525 tests, 0 failures, 0 runtime warnings.

| Author | Book | Classification | Migration | Reasons |
| --- | --- | --- | --- | --- |
| 古龙 | 七杀手 | not_knowledge_base | not_applicable | - |
| 古龙 | 三少爷的剑 | not_knowledge_base | not_applicable | - |
| 古龙 | 九月鹰飞 | not_knowledge_base | not_applicable | - |
| 古龙 | 借尸还魂 | not_knowledge_base | not_applicable | - |
| 古龙 | 凤舞九天 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑·花·烟雨江南 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑客行 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑毒梅香 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑气书香 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑玄录 | not_knowledge_base | not_applicable | - |
| 古龙 | 剑神一笑 | qualified | not_required | - |
| 古龙 | 午夜兰花 | not_knowledge_base | not_applicable | - |
| 古龙 | 名剑风流 | not_knowledge_base | not_applicable | - |
| 古龙 | 圆月弯刀 | not_knowledge_base | not_applicable | - |
| 古龙 | 多情剑客无情剑 | qualified | not_required | - |
| 古龙 | 多情环 | not_knowledge_base | not_applicable | - |
| 古龙 | 大人物 | not_knowledge_base | not_applicable | - |
| 古龙 | 大地飞鹰 | not_knowledge_base | not_applicable | - |
| 古龙 | 大旗英雄传 | not_knowledge_base | not_applicable | - |
| 古龙 | 大沙漠 | not_knowledge_base | not_applicable | - |
| 古龙 | 天涯·明月·刀 | not_knowledge_base | not_applicable | - |
| 古龙 | 失魂引 | not_knowledge_base | not_applicable | - |
| 古龙 | 孔雀翎 | not_knowledge_base | not_applicable | - |
| 古龙 | 孤星传 | not_knowledge_base | not_applicable | - |
| 古龙 | 彩环曲 | not_knowledge_base | not_applicable | - |
| 古龙 | 情人箭 | not_knowledge_base | not_applicable | - |
| 古龙 | 护花铃 | not_knowledge_base | not_applicable | - |
| 古龙 | 拳头 | not_knowledge_base | not_applicable | - |
| 古龙 | 新月传奇 | not_knowledge_base | not_applicable | - |
| 古龙 | 月异星邪 | not_knowledge_base | not_applicable | - |
| 古龙 | 桃花传奇 | not_knowledge_base | not_applicable | - |
| 古龙 | 欢乐英雄 | not_knowledge_base | not_applicable | - |
| 古龙 | 武林外史 | not_knowledge_base | not_applicable | - |
| 古龙 | 残金缺玉 | not_knowledge_base | not_applicable | - |
| 古龙 | 流星·蝴蝶·剑 | not_knowledge_base | not_applicable | - |
| 古龙 | 浣花洗剑录 | not_knowledge_base | not_applicable | - |
| 古龙 | 游侠录 | not_knowledge_base | not_applicable | - |
| 古龙 | 湘妃剑 | not_knowledge_base | not_applicable | - |
| 古龙 | 火并萧十一郎 | not_knowledge_base | not_applicable | - |
| 古龙 | 画眉鸟 | not_knowledge_base | not_applicable | - |
| 古龙 | 白玉老虎 | not_knowledge_base | not_applicable | - |
| 古龙 | 白玉雕龙 | not_knowledge_base | not_applicable | - |
| 古龙 | 碧玉刀 | not_knowledge_base | not_applicable | - |
| 古龙 | 碧血洗银枪 | not_knowledge_base | not_applicable | - |
| 古龙 | 神君别传 | not_knowledge_base | not_applicable | - |
| 古龙 | 绝代双骄 | qualified | not_required | - |
| 古龙 | 苍穹神剑 | not_knowledge_base | not_applicable | - |
| 古龙 | 英雄无泪 | not_knowledge_base | not_applicable | - |
| 古龙 | 萧十一郎 | not_knowledge_base | not_applicable | - |
| 古龙 | 蝙蝠传奇 | not_knowledge_base | not_applicable | - |
| 古龙 | 血海飘香 | not_knowledge_base | not_applicable | - |
| 古龙 | 血鹦鹉 | not_knowledge_base | not_applicable | - |
| 古龙 | 边城浪子 | not_knowledge_base | not_applicable | - |
| 古龙 | 长生剑 | not_knowledge_base | not_applicable | - |
| 古龙 | 陆小凤传奇 | qualified | not_required | - |
| 古龙 | 霸王枪 | not_knowledge_base | not_applicable | - |
| 古龙 | 风铃中的刀声 | not_knowledge_base | not_applicable | - |
| 古龙 | 飘香剑雨 | not_knowledge_base | not_applicable | - |
| 古龙 | 飞刀，又见飞刀 | qualified | not_required | - |
| 梁羽生 | 侠骨丹心 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 剑网尘丝 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 幻剑灵旗 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 弹指惊雷 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 武当一剑 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 游剑江湖 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 牧野流星 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 绝塞传烽录 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 风雷震九州 | not_knowledge_base | not_applicable | - |
| 梁羽生 | 飞凤擒龙 | not_knowledge_base | not_applicable | - |
| 金庸 | 三十三剑客图 | not_knowledge_base | not_applicable | - |
| 金庸 | 书剑恩仇录 | qualified | not_required | - |
| 金庸 | 侠客行 | qualified | not_required | - |
| 金庸 | 倚天屠龙记 | qualified | not_required | - |
| 金庸 | 天龙八部 | qualified | not_required | - |
| 金庸 | 射雕英雄传 | qualified | not_required | - |
| 金庸 | 白马啸西风 | qualified | not_required | - |
| 金庸 | 碧血剑 | qualified | not_required | - |
| 金庸 | 神雕侠侣 | qualified | not_required | - |
| 金庸 | 笑傲江湖 | qualified | not_required | - |
| 金庸 | 越女剑 | not_knowledge_base | not_applicable | - |
| 金庸 | 连城诀 | qualified | not_required | - |
| 金庸 | 雪山飞狐 | qualified | not_required | - |
| 金庸 | 飞狐外传 | qualified | not_required | - |
| 金庸 | 鸳鸯刀 | not_knowledge_base | not_applicable | - |
| 金庸 | 鹿鼎记 | qualified | not_required | - |
| 黄易 | 大唐双龙传 | not_knowledge_base | not_applicable | - |
| 黄易 | 寻秦记 | not_knowledge_base | not_applicable | - |
