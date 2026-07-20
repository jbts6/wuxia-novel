# Verification

Date: 2026-07-20

## Focused Contracts

- Command: `node --test <claude-workflow-contract> <lite-worker-lifecycle> <lite-skill-contract> <v4-skill-contract> <skill-contract> <chapter-batching>`
- Result: PASS, 55 tests, 0 failures.

## Full Game-KB Suite

- Command: `node --test ./.agents/skills/generate-game-kb/tests/*.test.js`
- Result: PASS, 532 tests, 0 failures.

## Skill Validation

- `quick_validate.py ./.agents/skills/generate-game-kb`: PASS.
- `quick_validate.py ./.agents/skills/generate-game-kb-lite`: PASS.

## Invariants Reviewed

- Claude Code uses the project workflow `game-kb-chapter-extract`.
- The workflow creates five consumer lanes normally or three after explicit 429 fallback.
- One bounded window contains all descriptors from the first `concurrency_limit` distinct batch IDs.
- A freed worker slot immediately starts the next queued single-chapter descriptor.
- Each Claude chapter agent exposes `Read` only and returns one schema-constrained envelope.
- Unknown workflow, descriptor, chapter, and submission fields are rejected before worker dispatch.
- Every represented batch guard opens before extraction and all guards are checked before submission.
- The main session submits unchanged envelopes serially in stable `chapter_jobs` order.
- Null or missing worker results are transport failures and do not imply 429 or consume an attempt.
- Domain workers remain separate read-only units; the chapter workflow has no broker or domain operations.
- New `description` values must omit redundant `概述：`, `描述：`, and `说明：` labels.
- Controller scripts, validators, installed knowledge bases, and immutable run artifacts remain unchanged.

## Repository Consistency

- `git diff --check a131fd43..HEAD`: PASS before verification evidence was added.
- No historical knowledge-base file, run artifact, controller script, validator, or schema changed.
