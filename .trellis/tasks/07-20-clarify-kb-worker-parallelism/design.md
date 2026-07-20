# Game-KB Worker Parallelism Design

## 1. Decision

Use a project-scoped Claude Code Workflow as the preferred chapter extraction
orchestrator. The workflow maintains the controller-issued active-worker limit
with a rolling queue, while each sub-agent reads one chapter and returns one
structured envelope. The main session remains the only coordinator allowed to
open/check guards, invoke controller commands, serialize the returned envelope
to stdin, or report accepted state.

Platforms without Claude Code Workflow support follow the same queue and
coordinator contract using their native sub-agent APIs.

## 2. Boundaries

The change adds orchestration and prompt contracts; it does not change chapter
packing, progress persistence, worker-pool state, guard receipts, broker
identity validation, attempt accounting, or accepted artifact serialization.

The following invariants remain authoritative:

- one worker descriptor contains one chapter and `worker_write_paths = []`;
- workers never call controller commands or write files;
- one guard receipt is bound to one controller batch;
- every represented guard is clean before the first broker submission;
- broker submissions are serial and controller-owned;
- status is the sole scheduler and acceptance authority.

## 3. Project Files

### 3.1 Claude Workflow

Add `.claude/workflows/game-kb-chapter-extract.js` as a project-scoped named
workflow. It accepts one object through `args`:

```json
{
  "concurrency_limit": 5,
  "prompt_file": "C:\\...\\prompts\\extract-chapters.md",
  "descriptors": [
    {
      "run_id": "run-id",
      "batch_id": "chapter-batch-001-003",
      "worker_write_paths": [],
      "chapters": [
        {
          "unit": "chapter:001",
          "attempt": 1,
          "input_hash": "sha256:...",
          "source_file": "C:\\...\\ch_001.txt"
        }
      ],
      "submissions": [
        {
          "unit": "chapter:001",
          "attempt": 1,
          "input_hash": "sha256:..."
        }
      ]
    }
  ]
}
```

The workflow validates that:

- `concurrency_limit` is exactly 5 or 3;
- descriptors are non-empty and preserve caller order;
- each descriptor has one chapter and one matching submission;
- `worker_write_paths` is an empty array;
- every `source_file` and `prompt_file` is absolute;
- the window contains no more than `concurrency_limit` distinct batch IDs and
  no more than `concurrency_limit * 3` descriptors.

The workflow has no filesystem or Node.js access and does not invoke shell or
controller commands. It only calls `agent()` and returns results.

### 3.2 Read-Only Chapter Agent

Add `.claude/agents/game-kb-chapter-worker.md` with `tools: Read`. Its system
contract requires it to:

1. read the controller-selected prompt file;
2. read only the descriptor's absolute `source_file` as chapter source;
3. process exactly one descriptor;
4. return exactly one envelope through Workflow structured output;
5. never call scripts or claim acceptance.

The Workflow `agent()` call uses this `agentType` plus an outer-envelope JSON
Schema. The schema requires `schema_version`, `batch_id`, `unit`, `attempt`,
`input_hash`, and an object-valued `draft`, with no extra envelope fields. The
controller remains responsible for complete V6 draft validation and grounding.

## 4. Window Selection

The main session reads `chapter_jobs` in controller order and records distinct
`batch_id` values in first-seen order. It selects the first
`worker_pool.concurrency_limit` batch IDs and includes every descriptor carrying
one of those IDs.

This produces:

- limit 5: at most five batches and fifteen chapter descriptors;
- limit 3: at most three batches and nine chapter descriptors;
- tail work: fewer batches/descriptors without padding or invented work.

The main session opens one guard for every selected batch before invoking the
workflow. For each batch after the first, it passes a representative descriptor
unit to `guard-open --unit` so the controller selects the exact owning batch.

## 5. Dynamic Queue

Do not use an unconstrained `parallel(descriptors.map(...))`: Claude Code's
native workflow cap is machine-derived and may exceed five.

Create exactly `concurrency_limit` asynchronous consumer lanes over one shared
monotonic cursor. Each lane repeatedly claims the next descriptor, awaits one
`agent()` call, stores the result at the descriptor's original index, and then
claims another descriptor. `Promise.all()` waits for the fixed set of lanes,
not for one fixed batch of chapter calls.

This keeps five or three workers active whenever queued work remains, while
preserving stable result order and one chapter per agent.

## 6. Guard And Submission Barrier

After the workflow returns, the main session checks every opened guard before
submitting any envelope. Controller writes must not occur while another batch's
guard is still unchecked because those writes would contaminate its repository
snapshot.

If any guard reports a violation or cannot produce a clean receipt:

- submit no envelope from the window;
- preserve and report controller evidence;
- resolve/recheck every affected guard before scheduling more work.

If all guards are clean, iterate descriptors in original order:

- null/missing/structurally invalid workflow result: skip submission, consume no
  attempt, and retain the unit for the next status cycle;
- valid result: JSON-serialize that exact structured envelope without field
  edits and submit it through stdin using the matching batch guard;
- any broker rejection or command failure: stop remaining submissions and
  refresh status immediately.

After the serial loop, read status again before selecting another window.

## 7. Rate Limiting

The workflow receives the persisted controller limit; it never chooses its own
fallback. On an explicit platform 429, the main session invokes the controller
worker-backoff command for the affected batch. The next status determines
whether the limit is three or the pool is halted.

A null workflow result without an explicit 429 is a generic transport failure,
not evidence of rate limiting. It does not change worker-pool state or consume a
submission attempt.

## 8. Description Content Contract

Update full/Lite chapter extraction and full domain-distillation prompts to say
that `description` contains descriptive content only. Values must not repeat a
field label such as `概述：` or `描述：`.

The new Workflow agent inherits the same rule by reading the selected canonical
prompt. Contract tests enforce the wording. Runtime validators remain backward
compatible, and this task does not rewrite historical installed data or run
artifacts.

## 9. Compatibility And Rollback

Claude Code gains a preferred named Workflow path. Other platforms continue to
work through explicit native rolling-pool instructions in the shared Skills.
Removing the project Workflow and agent restores manual orchestration without
changing controller state or artifact formats.

The existing user-global `process-chapters.js` workflow is not reused or edited;
it writes model-authored YAML, calls legacy acceptance, and is outside this
project task's ownership.

## 10. Verification

Add deterministic tests for:

- project Workflow metadata, input validation, fixed consumer-lane scheduling,
  stable output ordering, and absence of controller/file operations;
- project agent `Read`-only frontmatter and single-envelope instructions;
- Lite/full English and Chinese Skill parity for window selection, workflow
  preference, native fallback, guard barrier, and serial submission;
- extraction/distillation prompt rejection of redundant description labels;
- unchanged controller regression behavior and historical-product tolerance.
