# generate-kb Safety Audit Plan

## Audit Checklist

- [x] Read the complete authoritative contracts: `SKILL.md`, `pipeline.md`, `schemas.md`, `constants.md`, and `review.md`.
- [x] Use CodeGraph to map CLI dispatch, state reducer, work-item protocol, remediation, review, publish, promote, rollback, and their tests.
- [x] Run syntax/basic static checks over all authoritative JavaScript and JSON files; inspect imports/exports, unreachable command branches, unsafe null assumptions, write ordering, and error-code stability.
- [x] Build the command/state transition matrix and verify stage ordering, deterministic `next_action`, event replay, invalidation, lease rules, and command exclusivity.
- [x] Build the gate matrix and test missing/malformed/stale/contradictory evidence, cross-gate non-compensation, receipt scope, and publish hash rebinding.
- [x] Trace every managed write and fault-inject failures around event append, state projection, materialization, staging, pointer replacement, and cleanup to assess crash consistency.
- [x] Inspect and dynamically test repeated-failure behavior for same-error, rotating-error, expired-lease, remediation-cycle, review-cycle, and publish-cycle scenarios.
- [x] Run the existing generate-kb test suite and targeted temporary tests; record commands, exit codes, failures, and coverage gaps.
- [x] Verify every Critical/High/Medium candidate against current source and a reachable reproduction before including it.
- [x] Write `audit.md` with severity-ordered findings and a specific conclusion on whether the current fallback prevents unbounded AI correction loops.

## Validation Commands

Run large-output commands through context-mode and retain only derived results.

```bash
node --check .agents/skills/generate-kb/scripts/pipeline.js
node .agents/skills/generate-kb/tests/run-tests.js
node .agents/skills/generate-kb/scripts/pipeline.js status <isolated-fixture> --json
node .agents/skills/generate-kb/scripts/pipeline.js check <isolated-fixture>
```

Additional targeted harnesses may import controller modules or invoke the CLI against temporary copies of test data. They must not touch a real managed run.

## Review Gates

- Planning approval is required before starting the audit.
- A reported defect requires both a source anchor and a reachable scenario; speculative concerns remain residual risks.
- The task is complete only when all PRD acceptance criteria are mapped in `audit.md` and the verification commands have recorded outcomes.

## Rollback And Safety

The audit is read-only for product code. Temporary fixtures must live under the system temporary directory or this task directory and be deleted after verification. If a command resolves to a real novel path or `.kb/current`, stop before executing it.
