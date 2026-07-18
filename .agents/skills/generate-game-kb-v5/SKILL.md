---
name: generate-game-kb-v5
description: Use when generating a source-grounded wuxia game knowledge base quickly while leaving expensive full-book domain distillation for explicit later requests.
---

# generate-game-kb-v5

V5 is the lightweight form of the complete V4 workflow. The base workflow is
non-blocking with respect to deferred domain distillation: it keeps V4 source
grounding, chapter scheduling, acceptance, retry, assembly, verification,
installation, installed verification, receipts, and archival. The only base
pipeline omission is automatic full-book distillation for characters, skills,
items, and factions. Those domains are available through separate skills only
after the user explicitly requests them.

Use `semantic_contract_version: 5` and `profile: v5`. Do not mix V4 and V5
commands in one run. The controller owns source paths, staging paths, attempts,
accepted state, hashes, publication, installation, and archival; never infer
those values from a worker message or reconstruct them from files.

## Data format and chapter jobs

Chapter drafts and all five final knowledge files are YAML. JSON is reserved for
controller metadata: manifests, progress, reports, task state, and receipts.
Never substitute JSON for chapter candidates or final knowledge data.

The controller deterministically packs ordinary jobs from adjacent chapters:

- A job contains 2 or 3 adjacent chapters.
- The combined source is at most 36,000 CJK characters.
- A chapter may run alone only when it exceeds that budget by itself, or when
  an unavoidable final remainder cannot be combined without exceeding it.
- Every worker reads the complete original text for every chapter assigned to
  its job and writes one independent YAML document per chapter.

Each chapter descriptor contains exactly one controller-current `attempt` and
one `staging_path`, together with `unit`, `number`, `title`, `source_file`,
`input_hash`, and `source_char_count`. The worker writes only to that
`staging_path`; the main agent submits that same path to `accept`. Never choose
from a path list or create a replacement staging path.

Follow [`prompts/extract-chapters.md`](prompts/extract-chapters.md) for the
chapter-local YAML contract.

## Base lifecycle

The examples below use the tracked Chinese-path corpus. The `v5-prepare`
response supplies `run_id: run-jian-shen-yi-xiao`; subsequent commands reuse
that exact controller-issued ID. A status response supplies the current
`attempt` and `staging_path`; the example below shows the first chapter's
first attempt.

1. Prepare or resume the V5 run.

   Syntax:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-prepare <novel> --run <run-id> --json
   ```

   Concrete example:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-prepare "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
   ```

2. Read status and follow only its `next_action` and `next_units`.

   Syntax:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-status <novel> --run <run-id> --json
   ```

   Concrete example:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-status "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
   ```

3. For every controller-issued `chapter:NNN`, read the complete source and
   submit the YAML at its one current staging path. A 2-to-3-chapter job still
   receives one draft and one `accept` call per chapter.

   Syntax:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-accept <novel> --run <run-id> --unit <unit> --draft <staging_path>
   ```

   Concrete example using the status response for `chapter:001`:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-accept "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\chapter_001_attempt_01.yaml"
   ```

   Run `v5-status` again after each accepted batch. A rejected draft remains
   reviewable under the run's draft archive; do not delete it or invent a
   replacement path.

4. When status requests optional `basic-curate`, either submit the YAML draft
   at its controller-issued staging path or explicitly skip it.

   Syntax:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate <novel> --run <run-id> --draft <staging_path>
   node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate <novel> --run <run-id> --skip
   ```

   Concrete examples:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\runs\run-jian-shen-yi-xiao\staging\basic-curate_attempt_01.yaml"
   node .agents/skills/generate-game-kb/scripts/flow.js v5-basic-curate "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --skip
   ```

5. Publish only when status reports `next_action: v5-publish`. The command
   atomically performs grounded assembly, workspace verification, installation,
   installed verification, and run archival.

   Syntax:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-publish <novel> --run <run-id> --json
   ```

   Concrete example:

   ```text
   node .agents/skills/generate-game-kb/scripts/flow.js v5-publish "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --json
   ```

Do not manually copy final files, bypass a failed gate, or infer completion
from file presence alone.

## Bounded retry and recovery

Each unit cycle permits its initial validated submission plus at most one
automatic retry. A second rejection enters `manual_review`; no status loop,
scheduler, or worker may start a third attempt. Both rejected drafts remain
available for review. `manual_review` blocks publication until the user decides
what to do.

The user can explicitly start a fresh bounded cycle for one unit. It resets
that unit to attempt one, issues a new controller-current `staging_path`, and
leaves accepted sibling units unchanged. The new cycle again permits at most
one automatic retry. `reset-unit` remains a compatibility command, but public
recovery instructions use `retry-unit`.

Syntax:

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit <novel> --run <run-id> --unit <unit> --confirm
```

Concrete example:

```text
node .agents/skills/generate-game-kb/scripts/flow.js retry-unit "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --unit chapter:001 --confirm
```

After the command, call `v5-status` again and use only the newly issued
`attempt: 1` and `staging_path`. Do not loop automatically after the second
failure.

## Final YAML and audit artifacts

A successful V5 base installs exactly these five YAML knowledge files under
`"C:\git\wuxia-novel\古龙\剑神一笑\data\"` (replace the root with the
controller-resolved `<novel>/data/` for another book):

- `characters.yaml`
- `skills.yaml`
- `items.yaml`
- `factions.yaml`
- `chapter_summaries.yaml`

The files use the final fields and enumerations in
[`../generate-game-kb/schemas.md`](../generate-game-kb/schemas.md). Missing
distill-derived detail remains nullable or conservative; V5 never guesses it.

The controller records the following audit artifacts:

- `assembly-report.json` at `.game-kb-work/runs/<run-id>/final/reports/`;
- `verification-report.json` at the same directory;
- the installation receipt contract, called `install-receipt.json` here and
  written by the controller as `<novel>/reports/generate_game_kb_install.json`;
- `artifact-manifest.json` in the run and its archived copy;
- `archive-receipt.json` in `_archive/generate-game-kb/<run-id>/`.

Treat publication as complete only when `assembly-report.json` and
`verification-report.json` agree on `source_hash` and `final_data_hash`, the
verification report passes source grounding, candidate closure,
reference closure, schema validation, and final hash checks, the install receipt
binds
the installed five-file data to the run and hashes, installed verification
passes, and the archived artifact manifest and archive receipt hashes agree.
Unknown or dangling references, invented evidence, registry drift, hash drift,
failed installed verification, or `manual_review` blocks completion.

## Optional on-demand domain distill

The V5 base is complete without domain distill. Never start a deep skill
automatically and never use one to repair a blocked base run. Load exactly one
of these skills only when the user explicitly requests that enrichment:

- `generate-game-kb-deep-characters`
- `generate-game-kb-deep-skills`
- `generate-game-kb-deep-items`
- `generate-game-kb-deep-factions`

Each deep skill operates against the published V5 base and current installed
data. Its approved YAML overlay is validated against the archived manifest and
current data hash, applied to a copied five-file set, verified, and then
promoted atomically for Dashboard after the previous installed `data/` is
backed up. Successive overlays are cumulative; archived accepted evidence
remains immutable. The deep skills document their own user-invoked commands.

## Resume rule

Resume with the concrete status command above (or its controller-equivalent for
another book) and execute only `next_action`/`next_units`. The controller owns
run selection, accepted state, retry budgets, install recovery, and archive
identity. Never reconstruct state from staging files.
