# Lite chapter extraction contract

The active controller contract is `semantic_contract_version: 6`. Read the
complete source assigned to each chapter and return YAML, not JSON.
Do not add `semantic_contract_version` or `profile` to chapter YAML; both belong
only to controller JSON metadata.

The controller packs adjacent jobs of 2 or 3 chapters with no more than 36,000
CJK characters in the combined source. An oversized chapter or unavoidable
tail may run alone. Each descriptor exposes exactly one controller-issued attempt
and exactly one controller-issued staging_path. Write one chapter
YAML to that path before moving to the next descriptor. Never invent or reuse a
different path.

Each unit cycle allows the initial validated submission plus at most one
automatic retry. After a second failure, no scheduler or worker may start an
automatic third attempt. Only the user's documented `retry-unit --confirm`
command can begin a new bounded cycle.

Every retained candidate needs a stable chapter-local `local_key`, a non-empty
`name`, and an exact source quote in `source_refs`. Keep each quote, candidate,
and summary inside its own chapter.

```yaml
schema_version: 1
chapter: 1
title: "Chapter title"
source_hash: "sha256:controller-input-hash"
factions:
  - local_key: "faction:example"
    name: "Example faction"
    aliases: []
    type: null
    description: null
    source_refs:
      - chapter: 1
        text: "Exact source quote"
characters:
  - local_key: "character:example"
    name: "Example character"
    aliases: []
    identities: []
    level: null
    rank: null
    description: null
    factions: []
    skills: []
    source_refs:
      - chapter: 1
        text: "Exact source quote"
skills:
  - local_key: "skill:example"
    name: "Example skill"
    aliases: []
    types: []
    factions: []
    rank: null
    description: null
    techniques:
      - name: "Explicitly named move"
        description: null
    source_refs:
      - chapter: 1
        text: "Exact source quote"
items:
  - local_key: "item:example"
    name: "Example item"
    aliases: []
    type: null
    description: null
    source_refs:
      - chapter: 1
        text: "Exact source quote"
chapter_summary:
  title: "Chapter title"
  summary: "Grounded chapter summary."
  source_refs:
    - chapter: 1
      text: "Exact source quote"
```

Use empty arrays and nulls for insufficient chapter evidence. Do not author
formal IDs. Add a technique only when the source explicitly names the move.
Write the YAML first, then report the chapter number, issued attempt, exact
staging path, validation result, and current grouped-job progress to the main
agent. The main agent alone submits acceptance.
