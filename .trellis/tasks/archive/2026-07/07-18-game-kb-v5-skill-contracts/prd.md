# Repair v5 lightweight and on-demand distill skills

## Goal

Restore generate-game-kb-v5 as the lightweight v4 flow and complete four user-invoked domain distill skills.

## Requirements

- `generate-game-kb-v5` is the lightweight form of v4, not a separate product contract. It must retain the same source-grounding, five-file final data shape, verification, installation, installed verification, receipts, and run archival guarantees.
- V5 model drafts and knowledge-base data are YAML. JSON is limited to controller-owned metadata, manifests, reports, state, and receipts; it is not a knowledge-data output format.
- The normal v5 base flow omits the four expensive domain-distill stages. It performs chapter extraction, optional basic curation, grounded assembly, verification, installation, installed verification, and archival.
- The v5 skill must state the exact final YAML files, installed location, run reports and receipts, success conditions, blocking conditions, and recovery/status loop.
- Character, skill, item, and faction distillation are independent, user-invoked skills. They must never run automatically or block completion of the v5 base flow.
- Each deep skill must expose the complete domain-distill contract: trigger, prerequisites, controller commands, domain input, model objective, output/overlay rules, source-grounding constraints, failure and stale-base handling, revision result, and verification.
- All five skills must conform to the Agent Skills format with valid `name` and discovery-oriented `description` frontmatter.
- Reuse the existing controller, v4 schemas, and domain prompt semantics. Do not duplicate controller implementation in skill prose or invent unsupported commands.
- Do not weaken immutable-base, manifest-hash binding, deterministic overlay ordering, atomic revision materialization, or no-invented-evidence constraints.
- Every approved overlay application must back up the currently installed `<novel>/data/`, merge the overlay into a new verified five-file data set, and atomically install that new data for Dashboard consumption. Successive overlays are cumulative and each backup remains recoverable.
- V4 is repaired and verified before V5 is derived. Normal chapter jobs contain 2-3 adjacent chapters, contain no more than 36,000 CJK characters, and expose one controller-current `attempt` plus `staging_path` per chapter. Oversized chapters and unavoidable final remainders may run alone.
- A normal unit cycle permits the initial validated submission plus at most one retry. A second failure enters `manual_review`, preserves rejected drafts, and is never scheduled automatically again. The user may explicitly start a new bounded cycle with `retry-unit <novel> --run <run-id> --unit <unit> --confirm`; `reset-unit` remains compatible.
- User-facing V4, V5, and deep Skill prose must not describe event or dialogue processing. It must describe only capabilities implemented by this workflow.
- Every documented user-facing command must include a concrete adjacent example using `"C:\git\wuxia-novel\古龙\剑神一笑"`, `run-jian-shen-yi-xiao`, and controller-issued unit/task/path values. Agents must not guess dynamic identifiers.
- The tracked `古龙/剑神一笑/剑神一笑.txt` is the V4 integration corpus. Its 20 chapters must deterministically pack into seven jobs with chapter counts `[3, 3, 3, 3, 3, 3, 2]`.

## Acceptance Criteria

- [ ] Standard `quick_validate.py` validation passes for `generate-game-kb-v5` and all four `generate-game-kb-deep-*` skills.
- [ ] A contract test fails on the original malformed/thin skills and passes only when discovery metadata, final output contract, on-demand semantics, commands, domain instructions, and revision verification are present.
- [ ] `generate-game-kb-v5/SKILL.md` identifies v5 as the lightweight v4 flow and documents the complete base lifecycle through installed verification and archive.
- [ ] The v5 skill explicitly requires YAML for chapter drafts and all five final knowledge files, while identifying JSON artifacts as controller metadata only.
- [ ] The v5 skill names `characters.yaml`, `skills.yaml`, `items.yaml`, `factions.yaml`, and `chapter_summaries.yaml`, plus the installed `data/` directory, verification report, install receipt, archive receipt, and their hash/closure gates.
- [ ] Each deep skill explicitly requires a published v5 base, is user-invoked and non-blocking, invokes its matching `*-deep` task type through `task-add`, `task-run`, and `task-apply`, and produces a verified immutable revision rather than mutating the base.
- [ ] Each deep skill contains domain-specific distill objectives and prohibitions consistent with the v4 domain prompt and final schemas.
- [ ] A deep task can be created after `v5-publish` has archived the base run, while remaining hash-bound to the published artifact manifest and installed data identity.
- [ ] `task-apply` applies keep/merge/drop/patch operations to YAML, verifies the resulting five-file revision, backs up the previous installed data, atomically promotes the revision to `<novel>/data/`, and writes receipts that bind the base, backup, revision, and installed hashes.
- [ ] A second overlay starts from the currently installed data and creates a distinct backup, so Dashboard always reads the latest successfully applied revision.
- [ ] Existing v5 CLI, publish, deferred-task, and overlay tests remain passing; the complete relevant `generate-game-kb` test suite reports no regression attributable to this change.
- [ ] No controller behavior, final schema, or production dependency is changed unless a failing contract test proves the documentation cannot truthfully describe the current implementation.
- [ ] V4 controller tests prove 2-3 chapter dynamic packing, one current staging path, path equality across controller and agents, at most one retry, retained rejected drafts, explicit `retry-unit`, and no automatic third attempt.
- [ ] The tracked `剑神一笑` corpus passes through normal preparation/status projection with Chinese paths intact and produces job counts `[3, 3, 3, 3, 3, 3, 2]`.
- [ ] V4, V5, and deep Skill contract tests reject event/dialogue workflow prose and commands without concrete examples.

## Notes

- Confirmed by the user on 2026-07-18: v5 is v4 with costly distill separated for explicit, on-demand loading.
- The prior split produced thin, invalid skill files and omitted the planned per-skill contract tests and end-to-end skill gate.
