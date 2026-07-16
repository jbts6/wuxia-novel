# Game KB Power Rank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `power_rank` the only strength field for characters and skills, and remove item rarity from new knowledge bases and Dashboard views.

**Architecture:** A shared CommonJS semantic-contract module owns contract version 3 and the eight ordered ranks. Extraction, domain decisions, deterministic assembly, final verification, and Dashboard normalization enforce one cross-layer shape. The Dashboard keeps legacy reads at its raw-data boundary only.

**Tech Stack:** Node.js CommonJS, Node test runner, TypeScript, React, Vitest, Vite.

## Global Constraints

- Preserve source-grounded evidence and existing bounded workflow stages.
- Do not add an AI work unit or broaden item extraction.
- Do not modify existing book JSON in bulk.
- Preserve the unrelated `dashboard/package-lock.json` worktree change.

---

### Task 1: Semantic Contract And Backend Tests

**Files:**
- Create: `.agents/skills/generate-game-kb/scripts/lib/semantic-contract.js`
- Modify: `.agents/skills/generate-game-kb/tests/helpers.js`
- Modify: `.agents/skills/generate-game-kb/tests/chapter-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/domain-contract.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/finalize.test.js`
- Modify: `.agents/skills/generate-game-kb/tests/skill-contract.test.js`

**Interfaces:**
- Produces: `SEMANTIC_CONTRACT_VERSION`, `SEMANTIC_PROFILE`, `POWER_RANKS`, and `isPowerRank(value)`.
- Requires final characters and skills to expose `power_rank` only.

- [ ] Add failing tests for missing/invalid chapter ranks, missing/invalid domain keep patches, final field shape, and Skill documentation.
- [ ] Run the focused tests and confirm failures are caused by the absent v3 behavior.
- [ ] Add the shared semantic-contract module and update test fixtures to use `初窥门径`.

### Task 2: Generator Contract And Assembly

**Files:**
- Modify: `.agents/skills/generate-game-kb/scripts/lib/run.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/semantic-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/chapter-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-work.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/domain-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/book-contract.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/accept.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/finalize.js`
- Modify: `.agents/skills/generate-game-kb/scripts/lib/verify.js`

**Interfaces:**
- Consumes: shared v3 semantic contract and rank validator.
- Produces: `characters.json` and `skills.json` with valid `power_rank`; `items.json` without rarity fields.

- [ ] Route all semantic version checks and hashes through contract version 3.
- [ ] Validate ranks at chapter, domain, targeted, book, and final-data boundaries.
- [ ] Emit skill `power_rank`; remove skill legacy rank fields and item rarity fields.
- [ ] Run focused backend tests until green.

### Task 3: Skill Documentation And Prompts

**Files:**
- Modify: `.agents/skills/generate-game-kb/SKILL.md`
- Modify: `.agents/skills/generate-game-kb/schemas.md`
- Modify: `.agents/skills/generate-game-kb/prompts/extract-chapters.md`
- Modify: `.agents/skills/generate-game-kb/prompts/distill-domain.md`
- Modify: `.trellis/spec/backend/quality-guidelines.md`

**Interfaces:**
- Documents the same v3 field names, rank order, peak-state rule, and legacy-run behavior enforced by code.

- [ ] Replace v2 examples and routing with v3.
- [ ] Require provisional chapter ranks and final domain rank patches.
- [ ] Remove item rarity and skill `mastery_rank` from final examples.
- [ ] Run Skill contract tests.

### Task 4: Dashboard Canonical Model

**Files:**
- Modify: `dashboard/src/types/novel.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.ts`
- Modify: `dashboard/src/lib/normalizeNovelData.test.ts`
- Modify: `dashboard/src/lib/entityContent.ts`
- Modify: `dashboard/src/lib/globalLibrary.ts`
- Modify: `dashboard/src/components/library/GlobalEntityDetail.tsx`
- Modify: `dashboard/src/pages/Skills.tsx`
- Modify: `dashboard/src/pages/Skills.test.tsx`
- Modify: `dashboard/src/pages/Items.tsx`

**Interfaces:**
- Raw compatibility input: `power_rank ?? mastery_rank ?? rank`.
- Application output: canonical `power_rank` only; no item rarity property or UI.

- [ ] Add failing normalization and component tests.
- [ ] Normalize legacy skill ranks into `power_rank` and delete legacy application fields.
- [ ] Remove item rarity filters, columns, details, and content heuristics.
- [ ] Run Dashboard tests, lint, and build.

### Task 5: Full Verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Confirms the complete workflow and frontend share the same contract.

- [ ] Run all `generate-game-kb` tests.
- [ ] Run all Dashboard unit tests, lint, and production build.
- [ ] Search the active workflow and Dashboard for forbidden `mastery_rank`, `rarity_tier`, and item `rarity` consumers; allow only the raw legacy normalizer.
- [ ] Inspect `git diff --check` and final worktree status without touching unrelated changes.
