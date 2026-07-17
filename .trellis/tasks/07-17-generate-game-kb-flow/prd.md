# Simplify generate-game-kb flow

## Goal

Make `generate-game-kb` a runnable, source-grounded fast profile that produces four entity libraries and chapter summaries through one bounded YAML workflow.

## Background

- The approved audit is `docs/generate-game-kb-flow-audit-2026-07-16.md`.
- The intended final files are `characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and `chapter_summaries.yaml`.
- `locations`, `dialogues`, and `events` are not final outputs of this Skill.
- The repository currently mixes the new four-domain contract with the legacy nine-category merge/clean/recall flow.
- Controller-owned state such as `progress.json`, manifests, receipts, and `status --json` remains JSON.

## Requirements

- R1. The normal workflow is `prepare -> chapter:* -> distill:factions -> distill:characters|skills|items -> assemble -> verify -> install -> installed verification -> archive-run`.
- R2. AI drafts, accepted artifacts, and final knowledge-base files use YAML exclusively; no JSON/YAML compatibility layer or conversion stage is added.
- R3. The four entity domains are `characters`, `skills`, `items`, and `factions`; chapter summaries are collected from accepted chapter drafts without a separate AI unit.
- R4. Deterministic code owns source hashes, candidate registration, stable IDs, reference closure, verification, atomic installation, receipts, recovery, and archival.
- R5. Every candidate is source-grounded and receives exactly one terminal domain decision; unresolved `pending` decisions block assembly.
- R6. Character and skill ranks use the fixed eight-level rank enum; named techniques require source naming evidence; ordinary items are rejected.
- R7. Remove the normal-path merge/clean, recall/supplement, quality sampling, game-material projection, and format-conversion stages after their still-needed invariants move into `assemble` or `verify`.
- R8. Dashboard and library APIs read the five YAML files directly and normalize the simplified field contract.
- R9. Preserve bounded attempts, controller-only state mutation, 3-to-1 rate-limit backoff, run isolation, atomic installation, installed-data verification, and archive/resume behavior.
- R10. New incompatible runs use a new semantic contract version; older runs remain observable but cannot be resumed or installed as current output.

## Acceptance Criteria

- [ ] All production JavaScript files pass `node --check`.
- [ ] Skill tests contain no top-level `events`, `dialogues`, or `locations` contract and no `distill:plot|martial|world` units.
- [ ] AI staging, accepted, and final paths are YAML; `yaml2json.js` and conversion paths are absent.
- [ ] A three-chapter fixture completes the full target workflow and closes chapter, summary, candidate, source-reference, and final-reference checks.
- [ ] Installation leaves exactly the five current YAML data files and Dashboard reads them without a JSON fallback.
- [ ] `status --json` returns one deterministic `next_action` from every supported interruption point.
- [ ] A representative roughly 21-chapter novel completes within 45 minutes without recall, quality-sampling, or format-repair AI loops.

## Out Of Scope

- Changing the comprehensive `generate-kb` profile.
- Reintroducing events, dialogues, or locations into this Skill.
- Converting controller-generated JSON state to YAML.
- Maintaining dual final-file formats for existing Dashboard data.
