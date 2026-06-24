# Detailed Summary Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate readable root-level summary markdown files that list concrete entity names and make uncertain item cleanup decisions understandable.

**Architecture:** Add a small Node.js generator under `scripts/summaries/` that reads the novel JSON files and writes `characters_summary.md`, `items_summary.md`, `factions_summary.md`, `locations_summary.md`, `skills_summary.md`, and `techniques_summary.md`. Keep generation deterministic and data-only: no deletion or mutation of source JSON.

**Tech Stack:** Node.js built-ins (`fs`, `path`, `assert`, `os`, `child_process`).

---

### Task 1: Summary Generator Contract

**Files:**
- Create: `scripts/summaries/generate.test.js`
- Create: `scripts/summaries/generate.js`

- [ ] **Step 1: Write a failing test**

Test a tiny novel directory with characters, items, factions, locations, skills, and techniques. Assert generated markdown includes concrete names and the item decision table with Chinese explanations for unknown or English types.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk node scripts/summaries/generate.test.js`
Expected: failure because the generator does not exist yet.

- [ ] **Step 3: Implement minimal generator**

Create `generateDetailedSummaries(novelDir)` and a CLI entrypoint. Generate stable tables grouped by entity category.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk node scripts/summaries/generate.test.js`
Expected: all assertions pass.

### Task 2: Regenerate Tianlong Summaries

**Files:**
- Modify: `金庸/天龙八部/*_summary.md`

- [ ] **Step 1: Run generator**

Run: `rtk node scripts/summaries/generate.js 金庸/天龙八部`
Expected: six root summary files are rewritten with detailed tables.

- [ ] **Step 2: Verify output**

Run syntax checks and inspect generated summaries for concrete names, pending item decisions, and no source JSON changes.
