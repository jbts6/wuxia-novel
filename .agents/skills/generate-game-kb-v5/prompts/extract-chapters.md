# v5 chapter extraction prompt

Read the complete source assigned to each chapter. Return YAML, not JSON, and
write one document for each chapter in the controller-provided staging path.
Do not copy a candidate, quote, or summary across chapter boundaries.

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

