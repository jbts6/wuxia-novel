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
- Complete `assemble`, workspace `verify`, `install`, installed `verify`, and `archive-run` without bypassing a gate.
- Preserve rejected drafts and stop on `manual_review`; use `retry-unit --confirm` only when an actual bounded retry cycle requires user-authorized recovery.
- Do not modify production behavior unless the real-corpus test or run exposes a reproducible defect.

## Acceptance Criteria

- [ ] A tracked integration test reads `古龙/剑神一笑/剑神一笑.txt` through the production prepare/status path.
- [ ] The integration test proves 20 chapters, seven jobs, counts `[3, 3, 3, 3, 3, 3, 2]`, adjacent chapters, Chinese path preservation, and one current staging path per descriptor.
- [ ] A fresh real V4 run records the writable contract as semantic version 5 with `profile: v4`.
- [ ] All 20 chapter units are accepted from model-generated YAML grounded in the actual chapter text.
- [ ] `distill:factions`, `distill:characters`, `distill:skills`, and `distill:items` are accepted from the real run's chapter evidence.
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
