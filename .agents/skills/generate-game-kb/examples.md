# V4 command examples

The following commands use the real test book `古龙/剑神一笑`. Replace only values returned by `status --json`; keep `batch_id`, `unit`, `attempt`, `input_hash`, and `guard_id` unchanged. Worker envelopes go directly to stdin and must never be written to a temporary file.

```text
node .agents/skills/generate-game-kb/scripts/flow.js archive-existing "C:\git\wuxia-novel\古龙\剑神一笑" --archive-id before-run-jian-shen-yi-xiao --json
node .agents/skills/generate-game-kb/scripts/flow.js prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-check "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --batch chapter-batch-001-003 --unit chapter:001 --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit chapter:001 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js refresh-domain-work "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-real-20260718 --unit distill:characters --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js import-chapters "C:\git\wuxia-novel\古龙\剑神一笑" --from-run run-jian-shen-yi-xiao-v4-real-20260718 --run run-jian-shen-yi-xiao-v4-v6-20260718 --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js plan-domains "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js guard-open "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --unit distill:characters --json
node .agents/skills/generate-game-kb/scripts/flow.js submit-draft "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --batch domain-batch-characters --unit distill:characters --attempt 1 --guard-id <guard-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js assemble "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js install "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
node .agents/skills/generate-game-kb/scripts/flow.js verify "C:\git\wuxia-novel\古龙\剑神一笑" --installed --json
node .agents/skills/generate-game-kb/scripts/flow.js archive-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao-v4-v6-20260718 --json
```

`unit` is a generic controller work unit. `chapter:001` is one chapter unit; `distill:characters` is one full-book domain unit. Open and check a clean guard before each worker envelope is submitted. `retry-unit` starts a new user-confirmed bounded cycle and still allows at most one automatic retry.

## Legacy V6 audit and deterministic migration

These commands use the real Chinese path without renaming it. The first migration command is a read-only plan; the second is the only mutating form.

```text
node .agents/skills/generate-game-kb/scripts/audit-v6.js "C:\git\wuxia-novel" --output ".trellis\tasks\07-19-audit-v6-knowledge-bases\reports"
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\金庸\书剑恩仇录" --run migration-shu-jian-en-chou-lu-v6 --from "C:\git\wuxia-novel\金庸\书剑恩仇录\data" --json
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\金庸\书剑恩仇录" --run migration-shu-jian-en-chou-lu-v6 --from "C:\git\wuxia-novel\金庸\书剑恩仇录\data" --staging-root "C:\git\wuxia-novel\.game-kb-migration-staging\金庸\书剑恩仇录" --confirm --json
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\金庸\书剑恩仇录" --run migration-shu-jian-en-chou-lu-v6 --from "C:\git\wuxia-novel\金庸\书剑恩仇录\_archive\migration-shu-jian-en-chou-lu-v6-legacy\data" --staging-root "C:\git\wuxia-novel\.game-kb-migration-staging\金庸\书剑恩仇录" --confirm --json
```

`migrate-legacy` has no Worker and does not accept `--unit`. After a failed migration, legacy generated data remains only under `_archive`; do not restore it as active `data`. Prefer the exact `retry_command` emitted by `migration-report.json` over reconstructing the final example manually.
