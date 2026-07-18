# generate-game-kb-v5

This skill is the isolated fast, source-grounded base profile for a game
knowledge base. It writes `semantic_contract_version: 5` runs with the
explicit `profile: v5` route. The audit-grade `generate-game-kb` profile is a
separate workflow and must not be mixed with this one.

## Base flow

Use the controller commands in this order:

```text
node .agents/skills/generate-game-kb/scripts/flow.js v5-prepare <novel>
node .agents/skills/generate-game-kb/scripts/flow.js v5-status <novel> --run <run-id> --json
node .agents/skills/generate-game-kb/scripts/flow.js v5-accept <novel> --run <run-id> --unit chapter:NNN --draft <chapter.yaml>
node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate <novel> --run <run-id> --skip
node .agents/skills/generate-game-kb/scripts/flow.js v5-publish <novel> --run <run-id>
```

Chapter extraction is the only required model step. Read the complete chapter
source, keep every quote chapter-local, and write one YAML draft per chapter.
The controller owns run paths, hashes, acceptance, quarantine, and publication
receipts. Optional enrichment fields may remain null; never invent evidence to
fill them.

The base profile publishes exactly five YAML files after grounded assembly:
`characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and
`chapter_summaries.yaml`. A failed optional `v5-basic-curate` call does not
invalidate the deterministic grounded result.

## Deferred enrichment

Deep enrichment is intentionally outside this skill. Use the isolated
[`generate-game-kb-deep-characters`](../generate-game-kb-deep-characters/SKILL.md),
[`generate-game-kb-deep-skills`](../generate-game-kb-deep-skills/SKILL.md),
[`generate-game-kb-deep-items`](../generate-game-kb-deep-items/SKILL.md), and
[`generate-game-kb-deep-factions`](../generate-game-kb-deep-factions/SKILL.md)
skills for hash-bound overlays. Those skills may enrich existing grounded
records only and never mutate the v5 base artifact directly.

