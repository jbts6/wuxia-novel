# v5 chapter extraction prompt

Read the complete source assigned to each chapter. Return YAML, not JSON, and
write one document for each chapter in the controller-provided staging path.
Do not copy a candidate, quote, or summary across chapter boundaries.

The controller groups ordinary work into adjacent jobs of 2 or 3 chapters, with
no more than 36,000 CJK characters in the combined source. Oversized chapters
and an unavoidable final remainder may run alone. A descriptor exposes exactly
one controller-issued `attempt` and one controller-issued `staging_path`; write
only to that path and never invent another. Each chapter in a grouped job still
gets its own YAML document and acceptance call.

Each unit cycle allows the initial validated submission plus at most one
automatic retry. A second failure is `manual_review`; no scheduler or worker may
start an automatic third attempt. The user may explicitly begin a new cycle via
the documented `retry-unit` command.

Every retained candidate needs a stable chapter-local `local_key`, a non-empty
`name`, and at least one `source_refs` entry whose `chapter` matches the
document. Each source quote must be an exact span of the prepared chapter.
Technique names are allowed only when the source explicitly names them and
must carry `named_in_source: true`.

```yaml
schema_version: 1
semantic_contract_version: 5
chapter: 1
title: "Chapter title"
source_hash: "sha256:..."
characters: []
skills:
  - local_key: "skill:example"
    name: "Example skill"
    rank: null
    description: null
    techniques: []
    source_refs:
      - chapter: 1
        text: "Exact source quote"
items: []
factions: []
chapter_summary:
  title: "Chapter title"
  summary: "Grounded chapter summary."
  source_refs:
    - chapter: 1
      text: "Exact source quote"
```
