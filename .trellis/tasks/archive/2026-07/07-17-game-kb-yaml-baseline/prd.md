# Restore YAML contract baseline

## Goal

Restore a parseable production baseline and make every executable contract surface agree on four domains, five YAML outputs, simplified fields, and accepted YAML paths.

## Requirements

- R1. Repair the seven production JavaScript syntax failures identified in the approved audit without restoring removed event/dialogue/location behavior.
- R2. Extend `scripts/lib/semantic-contract.js` as the declarative source for the new contract version, four domains, five final YAML filenames, rank enum, character levels, item types, and final field lists.
- R3. Chapter drafts and domain drafts use `.yaml`; accepted chapter and domain artifacts use `.yaml`; controller machine state remains JSON.
- R4. `flow.js` reads and hashes accepted chapters as YAML.
- R5. `accept.js`, domain planning, and validators recognize only `distill:characters|skills|items|factions`.
- R6. Chapter and domain contracts consistently use `rank`, `level`, `faction`, `chapter_summary.summary`, and the simplified final fields. Remove the stale `items.tags` contract.
- R7. Preserve source hash and `source_refs` validation in accepted artifacts.
- R8. Tests added or updated in this child must describe the new contract; legacy flow behavior is addressed by later children rather than reintroduced.

## Acceptance Criteria

- [ ] Every production `.js` file passes `node --check`.
- [ ] Contract tests pass for the four domains, five YAML filenames, enums, paths, and simplified fields.
- [ ] Focused chapter/domain/accept/flow tests pass with YAML fixtures.
- [ ] No production staging or accepted-artifact path ends in `.json`.
- [ ] No executable contract accepts `distill:plot`, `distill:martial`, or `distill:world`.
- [ ] `SKILL.md`, prompts, tests, and the fast-profile Trellis spec no longer contradict the executable baseline.

## Out Of Scope

- Implementing the final `assemble` command.
- Removing all legacy merge/clean/recall modules.
- Migrating Dashboard consumers.
