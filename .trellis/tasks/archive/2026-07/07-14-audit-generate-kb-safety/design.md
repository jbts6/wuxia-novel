# generate-kb Safety Audit Design

## Scope And Boundaries

This task performs a read-only audit of `.agents/skills/generate-kb`. It may create temporary fixtures outside managed novel data and write audit artifacts under this Trellis task, but it must not edit the skill implementation, managed runs, `.kb/current`, formal data, or reports.

The audit treats the following as separate contract layers:

1. Human-facing rules in `SKILL.md`, `pipeline.md`, `schemas.md`, `constants.md`, and `review.md`.
2. CLI routing and orchestration in `scripts/pipeline.js`.
3. State projection and transitions in `scripts/lib/pipeline-reducer.js`, `pipeline-state.js`, `work-items.js`, staged processors, review readiness, and publish modules.
4. Executable gates in source, semantic, final-data, verification, cross-validation, quality-gate, bundle, promote, and rollback code.
5. Tests that prove rejection, crash recovery, stale-input invalidation, exclusivity, and bounded failure behavior.

## Audit Model

### Contract Traceability

Build a traceability table from each normative rule to the enforcing function and test. A documented guarantee without an executable enforcement point is a finding unless the boundary is intentionally external and explicitly documented.

### State-Machine Analysis

Derive a transition table containing current stage/status, command, preconditions, emitted event, resulting state, invalidated downstream state, and failure result. Check:

- all six stages are ordered and cannot be skipped;
- `next_action` returns one legal, deterministic action;
- `advance` and remediation transitions are mutually consistent;
- exclusive commands cannot overlap with active leases or incompatible review/publish states;
- replaying events reconstructs the same projected state;
- rejected operations do not partially mutate managed state.

### Gate Analysis

Model every gate as fail-closed predicates. Verify that missing, malformed, stale, contradictory, or partially present evidence fails; a PASS in one gate cannot compensate for another gate's failure; human receipts cannot bypass automatic gates; publish and promote revalidate current hashes.

### Bounded-Failure Analysis

Exercise at least these failure sequences:

- the same draft produces the same validation error repeatedly;
- alternating validation errors avoid a naive per-error counter;
- a lease expires before submit and is reclaimed;
- a worker crashes after claim or during a controller write;
- remediation returns a stage to an earlier phase repeatedly;
- review receipts become stale after upstream changes;
- publish/build/promote repeatedly fail or encounter a changed current pointer.

A safe fallback must make lack of progress observable and bounded. Acceptable mechanisms include a persisted attempt budget plus error/progress fingerprint and a terminal/manual-intervention state. Merely returning a non-zero exit code while `next_action` continues to offer the same action is not sufficient.

## Evidence And Severity

Every finding must include a file:line anchor, reachable reproduction path, violated contract or invariant, impact, and missing/insufficient test. Severity is based on consequence and reachability:

- Critical: can publish/promote invalid or mixed-version data, corrupt managed state, or bypass mandatory gates.
- High: can deadlock or loop indefinitely, skip a stage/review, lose accepted work, or make recovery nondeterministic.
- Medium: rejects valid work, exposes misleading status, or leaves a meaningful contract untested.
- Low: clear coding defect with limited impact or maintainability risk that can realistically cause future behavior errors.

Potential findings are checked against actual call paths and tests to reduce reviewer false positives.

## Deliverable

Write `audit.md` in this task directory. Findings lead the report, followed by gate/transition coverage, anti-loop conclusion, verification evidence, and residual risks. No implementation fix is included in this task.
