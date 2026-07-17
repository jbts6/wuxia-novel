# Build single assemble and verify flow

## Goal

Replace the legacy merge/clean/build chain with one deterministic `assemble` command and one authoritative `verify` gate.

## Background

- The approved source is `docs/generate-game-kb-flow-audit-2026-07-16.md`.
- The v4 baseline already defines four domain units, five final YAML files, YAML accepted artifacts, and simplified fields.
- Domain planning is a deterministic controller transition, not another semantic merge stage. This child may expose it as `plan-domains`; the old `prepare-merge` spelling can remain temporarily only so cleanup can remove it with the rest of the legacy command surface.

## Requirements

- R1. Consume accepted chapter YAML and exactly four terminal domain decision sets.
- R2. Expand keep/merge/reject decisions, reject unresolved pending entries, assign stable IDs, and resolve faction/skill/item references once.
- R3. Project exactly five final YAML files using the shared contract.
- R4. Fold chapter completeness, summary completeness, candidate closure, source evidence, named-technique rules, ordinary-item rejection, schema validation, and reference closure into `verify`.
- R5. Preserve atomic writes, reproducible hashes, installed-data verification, and legacy-run fail-closed behavior.
- R6. Expose `assemble` and the target normal-stage order through `flow.js`.
- R7. Keep evidence in controller-owned reports/receipts; do not add `source_refs` back to the simplified final consumer files.

## Acceptance Criteria

- [x] `assemble` is deterministic and produces byte-stable YAML for identical accepted inputs.
- [x] Pending decisions, missing chapters/summaries, invalid evidence, or unresolved references fail closed.
- [x] A three-chapter fixture reaches workspace verification through `plan-domains -> four distill accepts -> assemble -> verify`, without `assemble-merge`, prepare/assemble-clean, or `build-final`.
- [x] `verify --installed` validates the installed five-file YAML dataset.

## Out Of Scope

- Dashboard parsing and presentation.
- Final deletion of every legacy module before replacement invariants are covered.
- `status.next_action`, two-attempt optimization, and removal of deprecated command aliases.
