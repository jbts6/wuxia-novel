# Lite Worker Reliability Verification

## Scope

- Baseline: `d8119524`.
- Implementation commits:
  - `fb0791e4` `docs(game-kb-lite): enforce zero-write broker lifecycle`
  - `b218322a` `fix(game-kb): preserve controller-issued lite identities`
  - `2e5acec9` `fix(game-kb-lite): close worker incident recovery gaps`
  - `521f5d0f` `test(game-kb): isolate legacy import fixture`
- Live worker forward-testing remains intentionally deferred. No real novel was used as a disposable worker target.

## Acceptance Evidence

| Contract | Authoritative evidence |
| --- | --- |
| Zero-write worker projection and exact broker lifecycle | `lite-skill-contract.test.js`, `lite-worker-lifecycle.test.js`, and `lite-cli-contract.test.js` |
| Controller-issued batch/unit/attempt/input identities | `lite-worker-safety.test.js`: multi-chapter batch identity submits unchanged through the broker |
| Canonical YAML owned by the Controller | `lite-worker-safety.test.js` valid-envelope acceptance and schema-version rejection cases |
| Guard inventory and incident-path reporting | `lite-worker-safety.test.js` incident-class repository writes case |
| Immutable guard evidence and explicit recovery | `lite-worker-safety.test.js` recovery/remediation case plus `worker-guard.test.js` |
| Bounded attempts and machine-readable validation | `lite-worker-safety.test.js` stale identity, formal rejection, and no-attempt-three cases |
| Legacy serialization stop gate | `lite-worker-safety.test.js` legacy accepted serialization case and `accepted-serialization.test.js` |
| No stale V5 or writable-path wording | `lite-residue-contract.test.js` and the project-local Skill validator |

## Fresh Verification

Run on 2026-07-20 from `C:/git/wuxia-novel`:

1. Project-local Skill validation:
   - Command: `rtk python C:/Users/fh345/.codex/skills/.system/skill-creator/scripts/quick_validate.py C:/git/wuxia-novel/.agents/skills/generate-game-kb-lite`
   - Result: `Skill is valid!`
2. Focused Lite reliability suite:
   - Command: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/lite-residue-contract.test.js .agents/skills/generate-game-kb/tests/lite-worker-safety.test.js`
   - Result: `40` tests, `40` passed, `0` failed.
3. Complete suite, serial diagnostic control:
   - Command: `rtk node --test --test-concurrency=1 .agents/skills/generate-game-kb/tests/*.test.js`
   - Result: `477` tests, `477` passed, `0` failed.
4. Complete suite, required default concurrency:
   - Command: `rtk node --test .agents/skills/generate-game-kb/tests/*.test.js`
   - Result: three consecutive post-diagnostic runs each reported `477` tests, `477` passed, `0` failed.

An earlier default-concurrency run transiently produced JSON parse failures in unrelated CLI tests. The failure did not reproduce in the individual failing file, the serial full suite, a traced default-concurrency full suite, or two additional default-concurrency full runs. The only stable diagnostic finding was an existing `DEP0187` warning at `publish.test.js:91`, where a removed path field is passed to `fs.existsSync`; this is recorded for the parent audit rather than hidden or mixed into the Lite implementation commits.

## Protected Scope

- `git diff --name-only d8119524 -- 古龙/凤舞九天` returned no paths.
- The committed `古龙/凤舞九天` tree object is unchanged at `44ebfb70bf1dfbf37e7f1c08043291d05ac95410`.
- The frozen tree contains `144` files.
- No changed path since the baseline is under `.claude/skills/`, `古龙/凤舞九天/`, `.game-kb-migration-staging/`, or an existing real run directory.
- Before this evidence update, the only dirty path was `.trellis/spec/backend/quality-guidelines.md`.

## Residual Risk

- Repository guards detect writes inside the Git repository root; they are not an operating-system sandbox and do not claim to detect arbitrary writes outside that root.
- A guard whose immutable check receipt recorded a violation cannot be reused for submission even after status stops projecting a restored path. A new clean guard is required.
