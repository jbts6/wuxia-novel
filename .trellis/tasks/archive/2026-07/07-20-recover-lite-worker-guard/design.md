# Lite Worker Recovery And Controller Routing Design

## 1. Boundaries

The controller remains the only component that writes run artifacts. Claude
Workflow workers read one source chapter and return one schema-constrained JSON
envelope. The main session only schedules, opens/checks guards, and streams an
unchanged Workflow result to controller stdin.

The completed White Horse v4 run is an immutable baseline, not an execution
target. Its installed product remains external dirty work and is excluded from
every task commit. Superseded White Horse runs remain untouched.

## 2. Guard Remediation Semantics

Guard receipts remain immutable and continue to record the raw snapshot diff.
The live unresolved projection interprets that evidence semantically:

- added entries remain unresolved while present;
- deleted entries remain unresolved until restored to their baseline state;
- modified files/other entries remain unresolved until type, size, and mtime
  match the baseline;
- a modified directory remains unresolved only when it is absent or its entry
  type changed. Size/mtime-only directory changes are derived from child changes
  and cannot be restored reliably after the child is removed.

Future guard checks omit size/mtime-only changes between two directory entries,
reducing noisy receipts. Historical receipts use the live semantic projection,
so no migration or reset receipt is needed.

## 3. Claude Workflow Hard Gate

The bilingual Lite and V4 Skills place the Claude rule immediately after status
routing, before prose about batching:

1. Any returned chapter descriptor invokes `game-kb-chapter-extract`, even when
   there is exactly one descriptor.
2. Only that Workflow may invoke `game-kb-chapter-worker`; generic Agent/Task
   dispatch and main-session source reading are invalid execution paths.
3. Workflow unavailable/timeout/malformed output stops the window. The main
   session does not reconstruct, repair, or normalize the envelope.
4. The envelope remains in memory and is piped directly to
   `lite-submit-draft`. Files in the repository, `%TEMP%`, `/tmp`, or any other
   location are forbidden for both worker and main session.
5. A replacement run is legal only when `lite-status` returns `start-new-run`.

The existing read-only Claude worker definition and structured-output schema
remain the enforcement mechanism inside the Workflow.

## 4. Candidate Registry Routing

`planDomains()` already owns deterministic registry construction and immutable
recording. Reuse it instead of adding a second registry builder.

Add a profile alias:

```text
lite-plan-domains -> plan-domains with profile=lite
```

`resolveNextAction()` receives the profile-required domain unit list. V4 keeps
the existing four domain units; Lite passes an empty list. The Lite status
projection maps:

```text
plan-domains                         -> lite-plan-domains
assemble / verify / install / archive-run -> lite-publish
```

After `lite-plan-domains`, the candidate registry and domain plan exist. Lite
does not dispatch full-book domain workers, so the next status advances to the
single `lite-publish` transaction. Optional `lite-basic-curate` remains callable
between those two actions.

## 5. Failure And Recovery

- `lite-plan-domains` is idempotent when the current registry matches accepted
  chapters and fails closed on stale accepted artifacts.
- Missing/malformed Workflow output consumes no controller attempt.
- Controller validation, not main-session judgment, decides whether a structured
  envelope is accepted or rejected.
- Existing immutable guard and submission receipts are never rewritten.
- A partial Lite publication continues to route to `lite-publish` until its
  atomic transaction completes or reports a controller error.

## 6. Item Type Extension

`ITEM_TYPES` in `semantic-contract.js` remains the single runtime source of
truth. Append `坐骑`, `异兽`, and `饰品`; do not create a dashboard-only or
prompt-only enum. This is an additive v6 change: all existing values and null
remain valid, so active and installed v6 artifacts require no migration.

Chapter prompts enumerate the complete canonical list and add inclusion
guidance:

- `坐骑`: named or plot-relevant rideable animals;
- `异兽`: source-described rare, supernatural, or exceptional beasts;
- `饰品`: wearable ornaments and jewelry with item-level relevance.

Legacy normalization recognizes explicit Chinese/English equivalents before
falling back to `其他`. It does not infer a mount or beast solely from an
ambiguous entity name. Deep-item overlays reuse final verification, so their
documentation lists the same enum while the controller remains authoritative.

The dashboard derives item filters from loaded data and needs no enum mapping
change.

The current White Horse product remains unchanged. A future user-triggered rerun
will exercise the expanded enum naturally; this task does not use deep-items or
hand-edit installed YAML.

## 7. Verification

Tests cover the historical directory-mtime reproduction, future guard diff
noise, mandatory Claude Workflow wording, no-file stdin transfer, one-chapter
behavior, replacement-run prohibition, the new CLI alias, and the complete Lite
status transition through candidate registry creation. Item tests cover all
three new values at shared-contract, legacy-normalization, chapter-prompt, and
final-verification boundaries.

Use the completed White Horse baseline read-only at two points: before changes,
record that installed verification passes and the manual registry equals a fresh
deterministic controller recomputation; after changes, confirm its installed
bytes are unchanged. These checks preserve evidence without legitimizing the
manual workflow or absorbing external product changes into task commits.
