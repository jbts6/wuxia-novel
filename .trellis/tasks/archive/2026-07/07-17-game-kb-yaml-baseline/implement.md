# Restore YAML contract baseline - Implementation Plan

> **For agentic workers:** Execute inline in this task. Use test-driven development and run each gate before moving to the next checklist item.

**Goal:** Establish one parseable YAML/four-domain contract that later flow simplification can build on.

**Architecture:** Extend `semantic-contract.js` as the shared executable contract, then migrate validators, paths, tests, prompts, Skill docs, and the owning Trellis spec to it. Keep JSON only for controller-owned state.

**Tech Stack:** Node.js CommonJS, `node:test`, `js-yaml`, Trellis Markdown specs.

## Global Constraints

- Do not restore `locations`, `dialogues`, or `events` behavior.
- Do not modify or delete user-owned `CLAUDE.md`.
- Use YAML for AI, accepted, and final artifacts; use JSON for controller state.
- Preserve legacy-run fail-closed behavior and source-grounding checks.

### Task 1: Add The Shared Contract Tests

**Files:**
- Create: `.agents/skills/generate-game-kb/tests/semantic-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`

**Interfaces:**
- Produces: exported contract version/profile, `DOMAIN_UNITS`, `FINAL_FILES`, `POWER_RANKS`, character levels, item types, and final field lists.

- [ ] Write failing tests asserting the exact four domain units and five `.yaml` filenames.
- [ ] Add negative assertions for legacy domains and `.json` final filenames.
- [ ] Add enum and final-field assertions, including absence of `items.tags`.
- [ ] Run `node --test .agents/skills/generate-game-kb/tests/semantic-contract.test.js` and confirm failure.
- [ ] Implement the minimal exports in `semantic-contract.js` and rerun the test to pass.

### Task 2: Restore Production Parseability

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/candidate-registry.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/clean-obligations.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/coverage.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/gaps.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`

- [ ] Run per-file `node --check` and capture all seven failures.
- [ ] Delete orphaned removed-category blocks at complete function/block boundaries.
- [ ] Rerun `node --check` across every production `.js` file and require zero failures.

### Task 3: Align YAML Paths And Domain Units

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/flow.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Test: `.agents/skills/generate-game-kb/tests/domain-work.test.js`
- Test: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- Test: `.agents/skills/generate-game-kb/tests/domain-flow.test.js`

- [ ] Add failing tests for accepted chapter `.yaml` discovery/hash and the exact four domain units.
- [ ] Import shared contract constants and remove executable legacy-domain acceptance.
- [ ] Run the three focused test files and require zero failures.

### Task 4: Align Fields And Documentation

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/finalize.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

- [ ] Add failing assertions for `rank`, `level`, `chapter_summary.summary`, simplified final fields, and no item tags.
- [ ] Update implementation and documentation to the shared contract.
- [ ] Run the focused contract/finalize tests and require zero failures for baseline-owned assertions.

### Task 5: Baseline Gate

- [ ] Run all production `node --check` checks.
- [ ] Run the baseline-focused tests from Tasks 1, 3, and 4.
- [ ] Search production paths for staging/accepted `.json` and legacy domain units; classify every remaining match as controller state, legacy evidence, or a later-child removal.
- [ ] Record verification evidence in the task journal before marking the child complete.
