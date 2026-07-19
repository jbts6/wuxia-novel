# Lite Worker Reliability Implementation Plan

> **For inline Codex execution:** REQUIRED SUB-SKILLS: use `trellis-before-dev`, `test-driven-development`, `writing-skills`, and `verification-before-completion`. Do not dispatch implement/check sub-agents.

**Goal:** Make Lite workers return structured extraction data without filesystem writes, then let the main agent submit that data through the controller-owned stdin broker for deterministic path selection, canonical YAML, validation, and status.

**Architecture:** Update contract tests first, then tighten the Lite Skill, extraction prompt, and examples around a zero-write worker JSON envelope plus the prerequisite controller's guard and stdin broker. No path, serializer, or validation logic is duplicated in Markdown.

**Tech Stack:** Markdown Skill contracts, Node.js CommonJS contract tests, `node:test`, the prerequisite controller CLI.

## Global Constraints

- Prerequisite: `07-19-harden-game-kb-controller-invariants` must be complete and green before end-to-end steps.
- Keep the parent audit/migration task paused until both child tasks finish.
- Never expose or write `.game-kb-migration-staging`; it is parent migration-controller state and remains inside the empty worker write set.
- Do not modify `.claude/skills/*`, real novels, existing run artifacts, or unrelated dirty files.
- Prefix shell verification commands with `rtk`.
- Use TDD. Trellis Phase 3 owns commits; do not create intermediate commits from this checklist.
- Neither worker nor main agent may create or hand-edit a normal draft file. The main agent passes the worker envelope unchanged to controller stdin; only controller commands may write, recover, move, copy, or delete task artifacts.
- Attempt 1 content rejection may obtain only controller-issued attempt 2; attempt 2 rejection enters `manual_review`, and no attempt 3 is inferred.

---

### Task 1: Lock the Lite orchestration contract in tests

**Files:**
- Modify: `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/lite-residue-contract.test.js`
- Create: `.agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js`

**Interfaces:**
- Consumes: controller commands and status fields from the prerequisite task.
- Produces: text-contract assertions that the Skill cannot regress to guessed paths or prose validation.

- [ ] **Step 1: Add failing Skill assertions**

```js
assert.match(skill, /worker_write_paths[^\n]*\[\]/);
assert.match(skill, /source_file[^\n]*(absolute|绝对)/);
assert.match(skill, /guard-open/);
assert.match(skill, /guard-check/);
assert.match(skill, /submit-draft[^\n]*(stdin|标准输入)/);
assert.match(skill, /recover-draft[^\n]*--confirm/);
assert.match(skill, /不得[^\n]*(创建|修改|移动|删除)[^\n]*(文件|目录)/);
assert.match(skill, /(JSON envelope|JSON 封装|JSON 信封)/);
assert.match(skill, /controller[^\n]*status|控制器[^\n]*状态/);
```

Also assert that worker-visible payloads contain no `staging_path` or output filename, the main agent must not write a temporary file, identity-matched invalid envelopes consume attempts, rogue files do not, and attempt 3 is forbidden.

- [ ] **Step 2: Add failing CLI lifecycle fixture assertions**

Model the exact sequence `status -> guard-open -> worker message -> guard-check -> main-agent stdin submit -> status`; reject a fixture that skips guard, writes a worker/main-agent file, passes a draft path, mutates the envelope, or trusts worker prose.

- [ ] **Step 3: Run tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/lite-residue-contract.test.js`

Expected: missing zero-write, envelope, broker, guard, and recovery language fails.

---

### Task 2: Rewrite the Lite controller lifecycle

**Files:**
- Modify: `.agents/skills/generate-game-kb-lite/SKILL.md`
- Modify: `.agents/skills/generate-game-kb-lite/SKILL-cn.md`

**Interfaces:**
- Consumes: `chapter_jobs[].worker_write_paths`, submission identities, legacy serialization status, and guard/broker/recovery CLI results.
- Produces: a concise main-agent lifecycle with no model-authored files or inferred state.

- [ ] **Step 1: Replace the dispatch section with the exact lifecycle**

```text
lite-status
-> lite-guard-open --batch <controller batch_id>
-> dispatch read-only descriptor with worker_write_paths = []
-> receive one JSON envelope per chapter in the worker message
-> lite-guard-check --guard <controller guard_id>
-> pipe each unchanged envelope to lite-submit-draft stdin
-> lite-status
```

Document that an identity-matched invalid envelope is formally rejected by `lite-submit-draft`, while stale identity or any worker filesystem effect stops before attempt accounting.

- [ ] **Step 2: Add the explicit recovery branch**

Require user confirmation before `lite-recover-draft`; prohibit manual filesystem operations; require a clean guard re-check before continuing.

- [ ] **Step 3: Keep the Skill concise**

Keep core scheduling/zero-write/broker invariants in the Skill and link to the extraction prompt/schema for field detail. Remove any wording that tells workers or main agents to create YAML, permits inferred directories or generic `game-kb`, allows worker-owned acceptance, or derives status from file counts.

- [ ] **Step 4: Run Skill contract tests**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-residue-contract.test.js`

Expected: all Skill lifecycle assertions pass.

---

### Task 3: Harden the extraction prompt and examples

**Files:**
- Modify: `.agents/skills/generate-game-kb-lite/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb-lite/examples.md`
- Modify: `.agents/skills/generate-game-kb-lite/examples-cn.md`
- Modify: `.agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`

**Interfaces:**
- Produces: low-freedom worker instructions using an absolute read-only source path and one V6 JSON submission envelope per chapter.

- [ ] **Step 1: Add failing prompt assertions**

Require phrases or structured fields covering: absolute read-only source path, zero filesystem writes, no controller/script invocation, exact envelope identity fields, one `draft` object per chapter, exact top-level draft fields, `local_key`, `source_refs`, exact source hash, exact quotes, and forbidden `book/author/summary/role`.

- [ ] **Step 2: Run prompt tests and confirm RED**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js`

Expected: the current Lite prompt lacks several required safety clauses.

- [ ] **Step 3: Update the prompt without duplicating the full schema reference**

Use an imperative block such as:

```text
WORKER_WRITE_PATHS = [].
Do not create, modify, move, or delete any file or directory.
Read only source_file. Return one JSON envelope per descriptor in your final
message. Do not call controller or submission commands and do not claim acceptance.
```

Replace the worker-authored YAML example with one valid JSON envelope whose `draft` object demonstrates the same explicit field/grounding rules. State that controller—not the worker—serializes the accepted `.yaml` bytes.

- [ ] **Step 4: Update English and Chinese command examples**

Show guard open/check, a worker message envelope, main-agent stdin `lite-submit-draft`, path-only recovery with `--confirm`, and status refresh. The normal submission example contains no output path or temporary file.

- [ ] **Step 5: Run prompt and CLI contract tests**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js`

Expected: all prompt and lifecycle assertions pass.

---

### Task 4: Incident-class regression fixtures

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/lite-worker-safety.test.js`

**Interfaces:**
- Consumes: controller guard/submission/recovery commands.
- Produces: disposable tests for every observed incident class without using the live run.

- [ ] **Step 1: Create a temporary two-chapter novel fixture**

Use existing test helpers to create source, prepare a Lite run, read one status job, and assert `worker_write_paths` is empty while submission identities match the current chapters.

- [ ] **Step 2: Add scripted rogue-write cases**

Create `game-kb/`, `.trellis/game-kb/`, `docs/game-kb/`, run `out/`, run `output/`, a changed novel source, and `chapter_001_attempt_03.yaml`. Assert each guard report blocks acceptance and leaves progress unchanged.

Also create a runtime-random nested repository path that is absent from the worker report. Assert the controller delta report supplies the exact normalized absolute path without any filename guess, and assert the Skill describes repository-root coverage without promising whole-machine discovery.

- [ ] **Step 3: Add content-validation cases**

Cover malformed JSON envelope, mismatched envelope identity, forbidden fields, missing `local_key/source_refs/title`, wrong hash, fabricated quote, and missing source name. Assert machine-readable error codes, controller-authored canonical YAML, and bounded attempts.

- [ ] **Step 4: Add path-only valid recovery**

Write a fully valid draft to `game-kb/chapter.yaml`; assert it is recoverable, confirmation is mandatory, source remains, destination becomes canonical YAML, no failed attempt is consumed, and guard remains unresolved until the stray source is removed/restored.

- [ ] **Step 5: Run the incident suite**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-worker-safety.test.js .agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/accept-retry.test.js`

Expected: all observed incident classes are deterministic and green.

---

### Task 5: Skill validation and full regression

**Files:**
- Verify only; fix only files owned by Tasks 1–4 when necessary.

- [ ] **Step 1: Validate the project-local Skill structure**

Run: `rtk python C:/Users/fh345/.codex/skills/.system/skill-creator/scripts/quick_validate.py C:/git/wuxia-novel/.agents/skills/generate-game-kb-lite`

Expected: validation succeeds with no frontmatter or naming errors.

- [ ] **Step 2: Run focused Lite tests**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/lite-skill-contract.test.js .agents/skills/generate-game-kb/tests/lite-worker-lifecycle.test.js .agents/skills/generate-game-kb/tests/lite-cli-contract.test.js .agents/skills/generate-game-kb/tests/lite-residue-contract.test.js .agents/skills/generate-game-kb/tests/lite-worker-safety.test.js`

Expected: zero failures.

- [ ] **Step 3: Run the complete game-KB suite**

Run: `rtk node --test .agents/skills/generate-game-kb/tests/*.test.js`

Expected: zero failures.

- [ ] **Step 4: Verify protected files and scope**

Run `rtk git status --short` and compare protected artifact hashes. Expected: no changes to `.claude/skills/*`, `古龙/凤舞九天`, existing accepted artifacts, installed data, or parent migration implementation files beyond the already stabilized shared controller entrypoint.

- [ ] **Step 5: Defer live forward-testing**

Do not dispatch a real worker in inline mode. If the user later approves a disposable forward-test, run it only against a temporary fixture after opening the controller guard; never use a real novel.
