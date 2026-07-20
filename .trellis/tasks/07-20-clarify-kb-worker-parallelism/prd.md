# Clarify KB worker parallelism contract

## Goal

Make the Lite and full game-KB Skills define an executable chapter-worker
orchestration contract that uses the controller-issued concurrency limit without
allowing worker filesystem writes, multi-chapter responses, or ambiguous broker
ordering.

## Background

- `lite-status` exposes all unfinished chapters as ordered single-chapter
  descriptors. Multiple descriptors may share one controller `batch_id`.
- A controller scheduler batch contains at most three chapters, while the worker
  pool starts with `concurrency_limit: 5` and falls back to three after an
  explicit 429.
- The current Skill says to dispatch one worker per single-chapter assignment,
  but does not state how to launch workers concurrently, select assignments,
  collect results, check guards, or submit multiple envelopes.
- Restricting each dispatch wave to one controller batch would cap normal
  concurrency at three and leave part of the configured pool unused.
- Giving one worker two or three chapters would increase response size, weaken
  chapter-level retry isolation, and reintroduce cross-chapter evidence risk.
- The controller already supports opening a guard for a batch by selecting a
  representative `--unit`, checking multiple batch guards before submission,
  and serially submitting single-chapter envelopes against their matching guard.
- Claude Code 2.1.214 supports project-scoped named workflows, structured
  `agent()` results, custom `agentType` definitions, and queued agent calls that
  start as capacity becomes available. Its built-in runtime cap is machine
  derived rather than controller derived, so the project workflow must enforce
  the controller's exact five-or-three active-worker limit itself.
- Historical installed knowledge bases contain 142 `description` values that
  begin with the redundant field label `概述：`; archived/current run copies
  raise the repository-wide total to 674. Current prompts neither request nor
  explicitly forbid that prefix.
- The user assigned historical prefix cleanup to another AI. This task owns
  prevention for newly generated content only and must not overlap that cleanup.
- The user selected a project-scoped Claude Code Workflow with a `Read`-only
  single-chapter agent as the preferred orchestration path. Other platforms
  retain an equivalent native rolling-pool contract.

## Requirements

- Each chapter worker receives exactly one controller descriptor, reads exactly
  one `source_file`, and returns exactly one JSON envelope for that chapter.
- Workers remain read-only and must not call controller commands or create,
  modify, move, or delete files or directories.
- The main agent must build a bounded ordered dispatch window spanning multiple
  `batch_id` values; a controller batch boundary must not by itself cap active
  chapter workers at three.
- The window consists of every descriptor whose `batch_id` is among the first
  `worker_pool.concurrency_limit` distinct batch IDs in stable `chapter_jobs`
  order. Because a controller batch has at most three chapters, the window holds
  at most 15 descriptors at limit five and at most nine at fallback three.
- Before dispatch, the main agent must group the window by `batch_id` and open
  one controller guard for every represented batch, using a representative unit
  to select the exact batch where required.
- Within the window, the main agent must maintain at most
  `worker_pool.concurrency_limit` live sub-agents. Each time one worker returns,
  it should immediately launch the next queued single-chapter descriptor while
  capacity and queued work remain.
- On Claude Code, this rolling pool must be implemented by a project-scoped
  named workflow that receives descriptors and `concurrency_limit` through
  workflow `args`. It must use exactly that many queue-consumer lanes rather
  than relying on the machine-derived default of `parallel()` or `pipeline()`.
- The Claude Code workflow must use a project-local chapter worker agent whose
  tool allowlist contains `Read` only. Each `agent()` call must use a structured
  output schema for exactly one chapter envelope.
- The workflow script itself must not read or write files, invoke controller
  commands, open/check guards, or submit drafts. Those operations remain in the
  main session before and after workflow execution.
- Platforms without Claude Code Workflow support must implement equivalent
  rolling replenishment with their native sub-agent mechanism while preserving
  the same active-worker limit and coordinator-only submission contract.
- The main agent must wait for every worker in the bounded window to finish
  before broker submission.
- Every opened guard must be checked before the first envelope is submitted. If
  any guard reports a violation or cannot be checked, no wave envelope may be
  submitted.
- After all guards are clean, the main agent must submit valid returned
  envelopes unchanged and serially in the original `chapter_jobs` order, using
  the guard associated with each descriptor's `batch_id`.
- A missing or structurally invalid worker result is a transport failure: do
  not submit it and do not consume an attempt. Other complete results in the
  clean window may still be submitted in stable order.
- Any broker rejection, stale identity, replay conflict, or submission command
  failure stops the remaining submissions and requires a fresh status read.
- Invoke controller worker backoff only for an explicit platform 429. Do not
  infer a 429 from a generic null/missing workflow result.
- A halted worker pool dispatches nothing and reports the controller state.
- The 429 policy remains controller-owned: initial five, fallback three, then
  halt after a later distinct-batch 429 at fallback concurrency.
- English and Chinese Lite/full Skill documents must describe the same
  orchestration contract.
- Deterministic contract tests must reject serial one-chapter-at-a-time wording,
  one-batch-only scheduling, multi-chapter worker assignments, submission before
  all represented guards are clean, and parallel broker submission.
- Chapter extraction, domain distillation, and Claude workflow worker prompts
  must state that `description` contains only descriptive content. It must not
  begin with a redundant field label such as `概述：` or `描述：`.
- This task must prevent the redundant prefix in newly generated envelopes but
  must not add a validator hard failure that invalidates existing installed or
  archived knowledge bases.

## Acceptance Criteria

- [ ] The Skills explicitly instruct the main agent to start concurrent
  sub-agents rather than merely saying "dispatch workers".
- [ ] The documented active-worker count is derived from the controller-issued
  `concurrency_limit`, can span multiple `batch_id` values, and is replenished
  from a bounded queue as workers finish.
- [ ] The bounded queue contains exactly the first five distinct controller
  batches normally or the first three after fallback, preserving descriptor
  order and the controller's maximum-three-chapters-per-batch limit.
- [ ] Claude Code uses a project-scoped named workflow with exactly five or
  three queue consumers, rather than an unconstrained `parallel()` call.
- [ ] Claude Code chapter agents expose only the `Read` tool and return a
  schema-validated single-envelope result.
- [ ] Each sub-agent is assigned one chapter and returns one envelope only.
- [ ] One guard is opened per represented batch before worker launch, and all
  guards are checked before any envelope submission.
- [ ] Envelopes are submitted unchanged, serially, and in stable descriptor
  order with the matching batch guard.
- [ ] The contract defines stop/refresh behavior for worker failure, 429, guard
  failure, and broker failure without inventing attempts or state.
- [ ] Lite and full English/Chinese Skill contract tests pass.
- [ ] Relevant game-KB regression tests pass without controller behavior changes.
- [ ] Prompt/workflow contract tests forbid redundant labels inside
  `description` values without rewriting or invalidating historical products.

## Out of Scope

- Changing chapter packing limits or worker-pool persistence.
- Allowing workers to write files or call controller commands.
- Assigning multiple chapters to one worker.
- Parallelizing controller broker submissions.
- Rewriting historical installed data or immutable run artifacts solely to
  remove existing `概述：` prefixes.
