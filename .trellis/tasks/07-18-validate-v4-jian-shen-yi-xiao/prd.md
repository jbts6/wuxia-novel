# Validate V4 with Jian Shen Yi Xiao

## Goal

Prove that the writable V4 game-KB workflow works against the tracked full text at `古龙/剑神一笑/剑神一笑.txt`, rather than relying on synthetic fixtures or Skill prose checks.

## Background

The previous task was archived after the generic Node suite passed, but the planned real-corpus integration test was never created and no V4 run artifacts were produced for this book. The earlier completion claim is therefore not valid evidence for this acceptance gate.

## Requirements

- Use the tracked novel text directly through the production V4 controller.
- Keep the Chinese author and book path intact at every controller and worker boundary.
- Add a permanent real-corpus integration test for preparation, source descriptors, status projection, and deterministic dynamic packing.
- The real corpus must resolve to 20 chapters and seven adjacent jobs with chapter counts `[3, 3, 3, 3, 3, 3, 2]`, subject to the 36,000-CJK-character cap.
- Every worker must receive and write only the controller-issued `unit`, `attempt`, and absolute `staging_path`.
- Run every chapter unit against its complete assigned source chapters; do not substitute generated or shortened fixture text.
- Complete all four V4 domain units from accepted chapter evidence.
- Keep character and skill `rank` nullable at chapter, domain, and final levels.
  After reading the complete book in chapter order, write an eight-level rank
  only when reliable evidence supports one. Evidence insufficiency yields
  `rank: null`, does not mean `平平无奇`, and neither blocks publication nor
  enters manual review; only irreconcilable rank evidence does.
- Rank from the full timeline rather than a chapter maximum: later direct
  outcomes, defeats, counters, and reversals outweigh earlier praise,
  hearsay, self-description, or status aura.
- Merge repeated entities through an explicit category-and-field contract;
  scalar conflicts must never be resolved by whichever chapter value happens
  to be first or last.
- For characters, retain the highest narrative `level` in the order
  `核心 > 重要 > 次要 > 龙套 > 背景`, and retain the highest
  full-book-verified peak `rank`. A local high claim that later evidence
  disproves is not a verified peak and must not win the merge.
- Replace the final singular character and skill `faction` field with
  `factions: string[]`. The array contains every explicitly supported
  affiliation, deduplicated and ordered by first confirmed appearance; no
  supported affiliation may be discarded merely because another appears.
- Replace the final singular character `identity` field with
  `identities: string[]`. Preserve every explicitly supported identity,
  deduplicated and ordered by first confirmed appearance; use `[]` when no
  identity is supported.
- Replace the final singular skill `type` field with `types: string[]` because
  one martial skill may explicitly belong to multiple categories. Preserve all
  supported categories in first-confirmed order and use `[]` when none is
  supported. Keep item and faction `type` as a single Dashboard classification;
  full-book distillation must resolve conflicts or route them to manual review.
- Require `aliases: string[]` on character, skill, item, and faction records.
  Preserve only source-explicit alternative names, former names, titles, or
  stable short names, deduplicated in first-confirmed order and excluding the
  canonical name. Use `[]` when none are supported; model-invented abbreviations
  or aliases are forbidden.
- Standardize the prose field across all four entity domains as `description`.
  Character records must use `description` and reject the former `biography`
  field; no dual-field compatibility fallback is permitted in final data or
  downstream consumers.
- Build every entity `description` by semantically rewriting the complete
  evidence timeline, never by selecting the first, last, or longest chapter
  value and never by mechanical concatenation. Character descriptions preserve
  key experiences and identity or affiliation changes in narrative order;
  skill, item, and faction descriptions preserve their stable definition plus
  materially relevant changes, limits, and exceptions. Unsupported causal
  links are forbidden. A conflict the full-book context cannot resolve must
  block completion or enter manual review.
- Exclude structured item ownership from the final contract. Character records
  must not contain `items`; item records must not contain `holder`, `holders`,
  `holder_names`, `ownerships`, or equivalent current/history ownership fields,
  and the model must not infer them. A materially important, source-grounded
  character-item relationship may appear only as prose in `description`.
- Retain character `skills: string[]` as stable references to martial skills the
  character is explicitly shown to have learned, practised, mastered, or used.
  Hearing about, witnessing, or being targeted by a skill does not establish
  possession. Deduplicate references in first-confirmed order; retain a formerly
  possessed skill without adding temporal status fields, and describe any
  material loss or change only in grounded character prose.
- Build skill `techniques` only from source-explicitly named moves; ordinary
  actions must not be promoted to techniques. Merge repeated techniques by
  canonical move name, order them by first confirmation, and semantically
  rewrite each description from its complete evidence. An irreconcilable
  same-name collision enters manual review. Technique rank, user, holder, and
  temporal-state fields are out of contract.
- Never merge entities solely because their canonical names match. Merge only
  when full-book evidence resolves them as the same entity; alias overlap is
  evidence but is insufficient by itself. Preserve clearly distinct same-name
  entities and route unresolved identity to manual review.
- For every set of distinct entities sharing an exact canonical name, the
  controller must generate and persist an evidence-identity-bound
  `disambiguator`. Their final IDs always use
  `<domain-prefix>_<pinyin>_<stable-alphabetic-digest>`, even if a later revision
  leaves only one member of the former collision set. Models must not author the
  discriminator, ordinal suffixes are forbidden, and record order or unrelated
  entity additions/removals must not change the ID.
- Use one uniform absence representation in all final records: required `id`
  and `name` are non-empty strings; arrays use `[]`; optional scalar `level`,
  `rank`, item/faction `type`, and every entity `description` use `null` when
  reliable evidence is absent. Empty strings and placeholder text such as
  `未知`, `其他`, or `暂无描述` are forbidden. Insufficient evidence does not
  block publication; only irreconcilable evidence enters manual review.
- Choose canonical names after reading the complete book. A later-revealed true
  name may replace an earlier designation in `name`, with the earlier form
  moved to `aliases`; the same rule applies to formal names of skills, items,
  and factions. Once issued, an entity ID is controller-owned registry state:
  renaming, alias changes, input order, and unrelated additions must never
  re-mint it. New entities use the current domain-prefix plus pinyin form and a
  persisted collision disambiguator when required; implicit rename or reorder
  migrations are forbidden.
- Store cross-domain references as stable IDs only: character `skills` and
  `factions`, and skill `factions`, are resolved from registry keys after merge
  and ID assignment. References are deduplicated in first-confirmed order;
  unresolved, dangling, or ambiguous references block assembly and enter manual
  review rather than creating records or retaining display names.
- Do not publish a separate ID-name artifact. On each book load or overlay
  reload, Dashboard builds in-memory ID-name maps from the current entity files,
  which remain the sole name source. Generation and installed-data verification
  must reject duplicate IDs and unresolved references before Dashboard reads
  them; an unexpected runtime miss is surfaced as a data error, never silently
  rendered as a technical ID or placeholder.
- Publish these breaking field changes as semantic contract version 6. Preserve
  the current version-5 Jian Shen Yi Xiao run read-only and create a new
  version-6 run; never upgrade accepted artifacts in place. A controller-owned
  `import-chapters` operation may reuse its 20 accepted chapters only after
  validating source paths, chapter numbers, source hashes, and accepted hashes.
  The importer performs only contract-listed mechanical transformations such as
  `biography` to `description` and removal of forbidden item ownership fields,
  writes old/new hashes plus a migration receipt, and fails closed on anything
  non-mechanical. All four domain decisions are regenerated under version 6.
- Remove every inverse holder/member relationship from AI and final contracts:
  skills reject `holder`, `holders`, `holder_names`, and `users`; factions reject
  `member`, `members`, and `member_names`. Character `skills` and `factions` are
  the only structured relationship sources. Dashboard derives reverse skill-user
  and faction-member indexes in memory on load; they are neither AI-generated
  nor written to the five final YAML files.
- Update every shipped version-6 example together with the executable schemas,
  including the chapter-draft YAML, domain-decision drafts, final-data examples,
  command examples, and test fixtures. Examples must demonstrate the new fields
  and must not preserve legacy fields as compatibility hints.
- Keep entity field names and cardinality consistent from version-6 chapter
  drafts through domain decisions to final data. Characters use `aliases`,
  `identities`, `factions`, `skills`, `level`, `rank`, and `description`; skills
  use `aliases`, `types`, `factions`, `rank`, `description`, and `techniques`;
  items and factions use `aliases`, singular `type`, and `description`.
  Chapter references carry local keys, domain work carries registry references,
  and final references carry IDs. Only stage metadata/evidence fields differ.
- Union and deduplicate aliases, techniques, and entity references. A semantic
  scalar conflict that cannot be reconciled must block completion or enter
  manual review rather than silently selecting one value.
- Apply the same explicit merge discipline to characters, skills, items, and
  factions, with executable rules shared by planning, assembly, verification,
  overlays, and Dashboard normalization.
- Controller-issued character and skill domain inputs must bind every split
  source chapter path and hash. A changed path, chapter hash, AI input, or
  binding must fail closed at consumption time.
- Permit an explicit confirmed controller refresh only for pending domain
  units with zero submissions. Refreshing character or skill work must not
  change an accepted faction unit or an unsubmitted item draft.
- Complete `assemble`, workspace `verify`, `install`, installed `verify`, and `archive-run` without bypassing a gate.
- Preserve rejected drafts and stop on `manual_review`; use `retry-unit --confirm` only when an actual bounded retry cycle requires user-authorized recovery.
- Do not modify production behavior unless the real-corpus test or run exposes a reproducible defect.

## Acceptance Criteria

- [ ] A tracked integration test reads `古龙/剑神一笑/剑神一笑.txt` through the production prepare/status path.
- [ ] The integration test proves 20 chapters, seven jobs, counts `[3, 3, 3, 3, 3, 3, 2]`, adjacent chapters, Chinese path preservation, and one current staging path per descriptor.
- [ ] A fresh real V4 run records the writable contract as semantic version 6 with `profile: v4`.
- [ ] All 20 chapter units are accepted in the version-6 run through the
  controller-validated migration of model-generated YAML grounded in the actual
  chapter text.
- [ ] `distill:factions`, `distill:characters`, `distill:skills`, and `distill:items` are accepted from the real run's chapter evidence.
- [ ] Character and skill work items contain all 20 controller-issued absolute
  chapter paths and hashes, preserve the Chinese path, and reject tampering.
- [ ] Every retained V4 character and skill has either a valid rank supported by
  the whole-book timeline or `rank: null` for insufficient evidence; null is not
  normalized to `平平无奇` and does not block publication, while irreconcilable
  evidence routes to manual review.
- [ ] Repeated-character tests prove that `level` selects the highest narrative
  importance, `rank` selects the highest full-book-verified peak rather than a
  raw chapter maximum, and `factions` preserves the ordered deduplicated union
  of all explicit affiliations.
- [ ] Character and skill final records use `factions: string[]` with `[]` for
  no known affiliation; the singular final `faction` field is rejected.
- [ ] Character final records use `identities: string[]` with `[]` for no
  supported identity; repeated identities are deduplicated without discarding
  distinct concurrent or historical identities, and singular `identity` is
  rejected.
- [ ] Skill final records use `types: string[]`, ordered by first confirmation
  and deduplicated; the singular skill `type` field is rejected. Item and
  faction final records retain singular `type`, with unresolved conflicts
  blocked or routed to manual review.
- [ ] Character, skill, item, and faction final records require
  `aliases: string[]`; aliases are source-explicit, canonical-name-excluding,
  first-confirmed ordered, deduplicated, and empty rather than invented when no
  alias is supported.
- [ ] Character, skill, item, and faction final records all use `description`;
  character `biography` is rejected by generation, assembly, verification,
  overlays, deep-domain outputs, and Dashboard normalization.
- [ ] Description merge tests prove all four domains synthesize grounded prose
  from the complete ordered timeline, reject first/last/longest-value shortcuts
  and mechanical concatenation, preserve material changes or limitations, and
  route irreconcilable contradictions to manual review.
- [ ] Final generation, assembly, verification, overlays, deep-domain outputs,
  and Dashboard normalization reject character `items` and every structured
  item holder or ownership field; important supported relationships remain
  optional description prose only.
- [ ] Character `skills` contains only stable references supported by explicit
  learning, practice, mastery, or use, ordered by first confirmation and
  deduplicated; mere awareness, observation, or victimhood cannot create a
  reference, and no per-skill temporal status structure is introduced.
- [ ] Skill `techniques` contains only explicitly named moves, merges repeated
  canonical names in first-confirmed order with full-evidence descriptions,
  routes distinct same-name collisions to manual review, and rejects rank,
  user/holder, and temporal-state fields.
- [ ] Same canonical names never trigger an automatic merge; distinct entities
  remain separate, alias-only identity is insufficient, and unresolved identity
  blocks completion through manual review.
- [ ] Exact-name collision tests prove controller-owned persistent
  disambiguators produce distinct alphabetic-suffix IDs that remain unchanged
  across input order, retries, revisions, unrelated additions/removals, and
  removal of the other colliding entity; models and numeric ordinals cannot
  supply the suffix.
- [ ] Final schemas and Dashboard normalization require non-empty `id`/`name`,
  normalize absent arrays to `[]`, preserve absent optional scalar classifications
  and descriptions as `null`, reject empty strings and placeholder unknowns,
  and distinguish ordinary insufficiency from blocking contradiction.
- [ ] Canonical-name tests prove full-book naming can promote a true/formal name
  and demote the former name to `aliases` without changing the controller-issued
  ID; retries, reordered inputs, alias edits, and unrelated entity changes do
  not re-mint existing IDs, while new same-name entities receive persisted
  disambiguators.
- [ ] Cross-domain reference tests prove final character/skill reference arrays
  contain stable IDs in first-confirmed order, resolve after merges and renames,
  reject display-name references, and block dangling or ambiguous targets.
- [ ] Dashboard builds ID-name maps in memory from the current loaded entities,
  refreshes them after overlays, emits no mapping artifact, and surfaces an
  unexpected unresolved ID as a data error rather than raw ID or fallback text.
- [ ] A new version-6 Jian Shen Yi Xiao run imports all 20 version-5 accepted
  chapters through the controller with complete source/hash validation and a
  migration receipt, leaves the old run unchanged, rejects non-mechanical
  conversion, and regenerates all four domain units without reusing version-5
  domain decisions.
- [ ] Chapter/domain/final schemas reject all skill holder/user and faction
  member fields; Dashboard reverse-index tests derive users and members solely
  from character `skills`/`factions`, refresh after overlays, and produce no
  additional artifact.
- [ ] `schemas.md`, prompts, command examples, and fixtures contain matching
  version-6 chapter/domain/final examples and no legacy `biography`, character
  item, item ownership, skill holder/user, faction member, singular final
  affiliation/identity/type, empty-string, or placeholder-unknown examples.
- [ ] Chapter, domain, and final executable schemas use the same version-6 field
  names and cardinality, reject legacy singular character/skill fields, and
  prove reference values transition only from local key to registry key to ID.
- [ ] Skill, item, and faction merge tests cover every scalar, array, reference,
  alias, technique, and descriptive field, and prove unresolved scalar
  conflicts cannot fall back to the first chapter value.
- [ ] Assembly, verification, overlays, deep skills, and Dashboard consumers
  all read the same plural affiliation contract without a singular fallback.
- [ ] Assembly produces exactly `characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and `chapter_summaries.yaml`.
- [ ] Workspace verification passes with no unresolved manual review, stale evidence, missing source reference, ordinary-item violation, or open final reference.
- [ ] Installation backs up any prior `data/` as required and the Dashboard-facing `data/` contains exactly the verified five-file revision.
- [ ] `verify --installed` passes from installed artifacts without workspace fallback.
- [ ] `archive-run` writes an archive receipt bound to the artifact manifest and passing verification report.
- [ ] The complete V4 Node suite, production JavaScript syntax checks, Skill validator, and `git diff --check` pass after any required fix.
- [ ] Evidence paths, hashes, counts, retry history, reports, receipts, and exact commands are recorded in the Trellis journal before completion.

## Out Of Scope

- V5 generation or deep overlays.
- Replacing the V4 controller with a separate test-only pipeline.
- Claiming audit-grade recall beyond the V4 source-grounded contract.
- Editing the novel source to make preparation or extraction pass.
