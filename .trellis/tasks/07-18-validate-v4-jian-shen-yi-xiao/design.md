# Jian Shen Yi Xiao V4 Semantic Contract V6 Design

## Boundaries

The production controller is the only writer for run state, accepted evidence,
work plans, final data, reports, installation, overlays, and archives. AI workers
read controller-issued inputs and write YAML only to the exact current staging
path. The main agent alone accepts drafts and advances state.

The current version-5 Jian Shen Yi Xiao run remains immutable evidence. Version
6 uses a new run and imports only its accepted chapter evidence through a
controller command. No accepted file, work item, progress file, or hash is
edited in place.

## Semantic Contract V6

The same entity field names and cardinality apply at chapter, domain, and final
stages. Stage-specific metadata changes, but entity semantics do not.

| Domain | Final fields |
| --- | --- |
| characters | `id`, `name`, `aliases`, `identities`, `level`, `rank`, `description`, `factions`, `skills` |
| skills | `id`, `name`, `aliases`, `types`, `factions`, `rank`, `description`, `techniques` |
| items | `id`, `name`, `aliases`, `type`, `description` |
| factions | `id`, `name`, `aliases`, `type`, `description` |
| nested techniques | `name`, `description` |
| chapter summaries | `chapter`, `title`, `summary` |

Chapter candidates use `local_key` references and complete `source_refs`.
Domain decisions bind registry references and the complete accepted evidence
timeline. Final projection replaces references with stable IDs and excludes
evidence fields. The installed product remains exactly five YAML files.

Arrays use `[]` when no value is supported. Optional `level`, `rank`, item or
faction `type`, and every `description` use `null` for insufficient evidence.
`id` and `name` are required non-empty strings. Empty strings and placeholder
unknown values are invalid.

Legacy fields are rejected rather than normalized in version-6 generation and
final data. This includes `biography`, singular character `identity` or
character/skill `faction`, singular skill `type`, character `items`, item
ownership, skill holders/users, and faction members. The controlled version-5
chapter importer is the only compatibility boundary.

## Merge Rules

Entity identity is resolved before field merging. An exact name or overlapping
alias is not sufficient to merge two candidates. Full-book evidence must show
that they are the same entity; clearly distinct same-name entities remain
separate, and unresolved identity enters manual review.

- `name`: choose the full-book true or formal name; move prior supported names
  to `aliases`.
- `aliases`: source-explicit ordered union, deduplicated by first confirmation,
  excluding the canonical name.
- `identities`, `factions`, and skill `types`: ordered union of supported values
  or references, deduplicated by first confirmation.
- character `level`: highest supported narrative importance in
  `核心 > 重要 > 次要 > 龙套 > 背景`; use `null` if unsupported.
- character or skill `rank`: highest full-book-verified credible peak, not a
  raw chapter maximum. A later contradiction invalidates an earlier inflated
  claim. Use `null` for insufficient evidence; irreconcilable evidence enters
  manual review.
- `description`: semantic rewrite of the complete ordered evidence timeline,
  never first/last/longest selection or mechanical concatenation.
- character `skills`: ordered union of explicitly learned, practised, mastered,
  or used martial skills. Awareness, observation, or victimhood is insufficient.
- skill `techniques`: merge only source-named moves by canonical move name,
  ordered by first confirmation, and synthesize each description from its full
  evidence. Ordinary actions and temporal/user/rank fields are invalid.
- item/faction `type`: one source-supported Dashboard classification; use
  `null` for insufficiency and manual review for irreconcilable conflict.

Structured inverse relationships do not exist. Dashboard derives skill users
and faction members by scanning character `skills` and `factions` in memory.

## Stable IDs

The controller extends the existing `final/id_plan.json` into the persistent ID
registry outside the five Dashboard data files. A first-issued ID never changes because of canonical-name corrections,
alias edits, record order, retries, or unrelated additions/removals. Registry
state is bound into installation and archive receipts and remains available from
the archived run for later overlays or controlled migrations.

New non-colliding entities use the existing domain-prefix plus pinyin form.
Distinct entities with the same exact canonical name receive controller-created
persistent disambiguators and always retain an alphabetic digest suffix, even
if another member of the collision set is later removed. Models cannot author
disambiguators or numeric ordinals.

Final character `skills` and `factions`, and skill `factions`, contain IDs only.
Assembly resolves registry references after merge and ID assignment. Unknown,
dangling, or ambiguous references block completion.

## Version-5 Chapter Import

`import-chapters --from-run <v5-run> --run <v6-run> --confirm` is a
controller-owned, fail-closed migration. It validates source paths, chapter
numbers, source hashes, accepted hashes, and source evidence before writing.
It performs only an allowlisted mechanical transformation:

- rename character `biography` to `description`;
- wrap version-5 singular character/skill affiliation, character identity, and
  skill type values into their version-6 arrays;
- remove character item references and every forbidden inverse relationship;
- normalize supported absent arrays to `[]` and absent optional scalars to
  `null` without inventing content.

The import writes old/new hashes and an atomic migration receipt. Any
non-mechanical ambiguity stops without partially modifying the target run. All
four domain units are planned and regenerated under version 6.

## Work-Item Integrity And Refresh

Every work item has a mandatory known `hash_contract`. Missing or unknown values
fail closed. Consumption always recomputes AI input, binding, path, and source
hashes; no legacy downgrade path exists.

Pending-work refresh validates the existing plan, work item, binding, unit, and
progress hash even on an equal-hash request. It is allowed only for a pending
zero-submission unit. Changed-hash refresh requires an existing artifact to
archive. Work, plan, and progress update as one transaction: any write failure
restores all prior bytes and leaves a retryable state.

Each unit cycle permits the initial submission plus at most one automatic retry.
`retry-unit --confirm` starts a user-authorized bounded cycle and preserves all
rejected drafts and validation history.

## Publication, Overlay, And Dashboard

Assembly produces exactly `characters.yaml`, `skills.yaml`, `items.yaml`,
`factions.yaml`, and `chapter_summaries.yaml`. Workspace verification binds the
version-6 schema, evidence closure, reference closure, ID registry, and final
data hash. Installation backs up the previous `data/`, atomically installs the
verified five files, writes bound receipts, and passes installed-only
verification before archival.

Every overlay first backs up the current installed `data/`, then merges into a
new verified revision and makes that revision the active Dashboard data. It
never patches active files in place. Overlay fields use the same version-6
contract and cannot restore legacy fields.

Dashboard parses the five files once at the server boundary, normalizes only
version-6 data, and builds ID-name maps plus reverse relationship indexes in
memory on every book load or overlay reload. It emits no mapping artifact. A
runtime unresolved ID is a visible data error, never a raw technical ID or a
placeholder.

## Validation Sequence

1. Repair and commit the existing work-item hash/refresh safety foundation.
2. Implement and commit version-6 schemas, merge rules, stable IDs, and tests.
3. Implement and commit controlled chapter import plus publication/overlay
   integration.
4. Implement and commit Dashboard types, normalization, maps, reverse indexes,
   and UI error behavior.
5. Update and commit SKILL files, prompts, schemas, real command examples, and
   every chapter/domain/final example.
6. Create the version-6 Jian Shen Yi Xiao run, import 20 chapters, regenerate all
   four domains, assemble, verify, install, verify installed data, and archive.
7. Only after V4 passes, extract the lightweight V5 and deep-domain skills from
   the validated V4 contract.
