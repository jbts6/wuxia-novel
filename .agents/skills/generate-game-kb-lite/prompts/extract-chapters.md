# Lite chapter extraction contract

The active controller contract is `semantic_contract_version: 6`.

## Worker boundary

`source_file` is an absolute read-only path. Read only `source_file`.
`WORKER_WRITE_PATHS = []`.

Do not create, modify, move, or delete any file or directory.
Do not call controller or script commands. Do not claim that a chapter was accepted. The
controller is the only scheduler, validator, serializer, and acceptance
authority.

The controller packs a scheduler batch of 2 or 3 chapters from adjacent source with no more
than 36,000 CJK characters in the combined source. An oversized chapter or
unavoidable tail may run alone. Each worker receives exactly one chapter
descriptor from that batch with one controller-issued attempt together with
its `batch_id`, `unit`, and `input_hash`.

Return exactly one JSON envelope in your final message.
Do not use Markdown fences, file paths, validation claims, or surrounding prose. Return the
envelope unchanged. The main agent passes it to
the controller through stdin.

## Envelope contract

Copy `batch_id`, `unit`, `attempt`, and `input_hash` exactly from the descriptor.
The `draft.source_hash` must equal the same descriptor `input_hash` byte for
byte. The envelope schema version and chapter draft schema version are both 1.

```json
{
  "schema_version": 1,
  "batch_id": "controller-batch-id",
  "unit": "chapter:001",
  "attempt": 1,
  "input_hash": "sha256:controller-input-hash",
  "draft": {
    "schema_version": 1,
    "chapter": 1,
    "title": "Chapter title",
    "source_hash": "sha256:controller-input-hash",
    "factions": [
      {
        "local_key": "faction:example",
        "name": "Example faction",
        "aliases": [],
        "type": null,
        "description": null,
        "source_refs": [
          { "chapter": 1, "text": "Example faction appears here." }
        ]
      }
    ],
    "characters": [
      {
        "local_key": "character:example",
        "name": "Example character",
        "aliases": [],
        "identities": [],
        "level": null,
        "rank": null,
        "description": null,
        "factions": [],
        "skills": [],
        "source_refs": [
          { "chapter": 1, "text": "Example character appears here." }
        ]
      }
    ],
    "skills": [
      {
        "local_key": "skill:example",
        "name": "Example skill",
        "aliases": [],
        "types": [],
        "factions": [],
        "rank": null,
        "description": null,
        "techniques": [
          { "name": "Explicitly named move", "description": null }
        ],
        "source_refs": [
          { "chapter": 1, "text": "Example skill appears here." }
        ]
      }
    ],
    "items": [
      {
        "local_key": "item:example",
        "name": "Example item",
        "aliases": [],
        "type": null,
        "description": null,
        "source_refs": [
          { "chapter": 1, "text": "Example item appears here." }
        ]
      }
    ],
    "chapter_summary": {
      "title": "Chapter title",
      "summary": "Grounded chapter summary.",
      "source_refs": [
        { "chapter": 1, "text": "Exact source quote for the summary." }
      ]
    }
  }
}
```

The `draft` top-level keys are exactly `schema_version`, `chapter`, `title`,
`source_hash`, `factions`, `characters`, `skills`, `items`, and
`chapter_summary`. Do not add top-level `book`, `author`, or `summary`. Entity
records must not add `role` or a formal `id`.

Every retained entity needs a stable chapter-local `local_key`, a non-empty
`name`, and non-empty `source_refs`. Each quote must be an exact verbatim slice
of the current `source_file`; each retained name must appear or be locatable in
that same `source_file`. Keep evidence inside its own chapter. Use empty arrays
and nulls when the chapter lacks evidence. Add a technique only when the source
explicitly names the move. See
[the complete chapter schema](../../generate-game-kb/schemas.md) for field
details.

A `description` value contains descriptive content only. Do not prefix it with a redundant field label such as `概述：`, `描述：`, or `说明：`.

The controller serializes accepted `.yaml` bytes. The worker returns only JSON.
Each unit cycle allows the initial validated submission plus at most one
automatic retry. After a second failure, no scheduler or worker may start an
automatic third attempt. Only the user's documented `retry-unit --confirm`
command can begin a new bounded cycle.
