# Ignore Local Book Archives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every book's `_archive/` evidence locally while removing it from the current index and all local Git history.

**Architecture:** Git continues to track `data/` and `ch_split/`, while a repository-level ignore rule excludes every `_archive/` segment. A temporary external tar preserves the current local archive tree across a `git-filter-repo` rewrite; the remote is retained as configuration but is not fetched or pushed.

**Tech Stack:** Git, git-filter-repo, repository `.gitignore`, PowerShell/Windows filesystem

## Global Constraints

- Never delete the local `_archive/` evidence.
- Never modify installed `data/` or source `ch_split/` content.
- Never fetch or push during the history rewrite.
- Do not change `generate-game-kb` runtime behavior.
- Prefix every shell command with `rtk`.

---

### Task 1: Record the rewrite boundary and preserve local evidence

**Files:**
- Read: `.git/config`
- Create outside repository: `%TEMP%/wuxia-novel-local-archives-20260716.tar`

**Interfaces:**
- Consumes: current `main`, `origin` URL, tracked archive paths
- Produces: external tar backup, pre-rewrite counts and remote-main object ID

- [ ] **Step 1: Record the current boundary**

Run read-only Git commands to record `HEAD`, `origin/main`, the `origin` URL, local branches, tags, and counts for tracked `data/`, `ch_split/`, `_archive/`, and historical `_archive/` objects.

Expected: one local `main` branch, no tags, 322 tracked `_archive/` paths, and 737 historical `_archive/` objects before the rewrite.

- [ ] **Step 2: Export current archives outside the repository**

```powershell
rtk git archive --format=tar --output="$env:TEMP/wuxia-novel-local-archives-20260716.tar" HEAD -- ":(glob)**/_archive/**"
```

Expected: the tar exists outside the repository and contains the same 322 tracked archive files.

- [ ] **Step 3: Verify the backup before changing Git state**

List the tar in a sandboxed command and compare its file count with the current local `_archive/` count.

Expected: both counts are 322 and representative archive receipts and accepted chapter artifacts are present.

### Task 2: Make archives local-only

**Files:**
- Modify: `.gitignore:49`
- Modify: `docs/superpowers/specs/2026-07-16-ignore-book-archives-design.md`
- Create: `docs/superpowers/plans/2026-07-16-ignore-book-archives.md`

**Interfaces:**
- Consumes: approved archive-retention design
- Produces: `**/_archive/` ignore contract in the current `main` tree

- [ ] **Step 1: Add the ignore rule**

Add this rule beside the existing game-KB working-directory rules:

```gitignore
**/_archive/
```

- [ ] **Step 2: Verify rule precision**

Run `git check-ignore -v` against a representative `_archive/` path and verify representative `data/` and `ch_split/` files are not ignored.

Expected: only the archive path matches the new rule.

- [ ] **Step 3: Commit the policy before rewriting**

```powershell
rtk git add .gitignore
rtk git commit -m "chore: keep book archives local"
```

Expected: the policy is committed; `_archive/` remains tracked until history filtering.

### Task 3: Rewrite local history and restore evidence

**Files:**
- Rewrite: local Git commit graph for all branches and tags
- Restore as ignored files: `**/_archive/**`

**Interfaces:**
- Consumes: external tar backup, saved `origin` URL, committed ignore rule
- Produces: rewritten local history with zero `_archive/` paths and restored local evidence

- [ ] **Step 1: Install the standard rewrite tool temporarily**

```powershell
rtk python -m pip install --user git-filter-repo
```

Expected: `rtk git filter-repo --version` exits successfully. Uninstall it after verification because it is not a project dependency.

- [ ] **Step 2: Rewrite all local refs**

```powershell
rtk python -m git_filter_repo --force --path-regex "(^|.*/)_archive(/|$)" --invert-paths
```

Expected: all local branches and tags are rewritten; `origin` may be removed by the tool as a safety measure.

- [ ] **Step 3: Restore remote configuration without network access**

If `origin` was removed, re-add the exact URL recorded in Task 1. Do not fetch.

Expected: `git remote get-url origin` matches the saved URL and no remote-tracking ref reintroduces old history.

- [ ] **Step 4: Restore local archives**

```powershell
rtk python -c "import os, tarfile; p=os.path.join(os.environ['TEMP'],'wuxia-novel-local-archives-20260716.tar'); tarfile.open(p,'r').extractall(r'C:\git\wuxia-novel', filter='data')"
```

Expected: all 322 UTF-8 path files return to their original paths and are ignored by Git. Python's standard-library extractor is required because the installed Windows `tar.exe` creates the directory tree but does not restore these Chinese-path files correctly.

- [ ] **Step 5: Verify the rewritten repository**

Run checks that prove:

- `git ls-files` contains zero `_archive/` paths.
- `git rev-list --all --objects` contains zero `_archive/` paths.
- local `_archive/` file count remains 322.
- tracked non-archive `data/` remains 219 files and tracked non-archive `ch_split/` remains 679 files; the pre-rewrite broad counts were larger only because they included 86 archived `data/` files and one archived `ch_split/` file.
- `git status --porcelain` is clean.
- `git diff --check` exits successfully.
- the current design and plan files still exist.

- [ ] **Step 6: Remove temporary tooling and backup**

After every check passes, uninstall the newly installed `git-filter-repo` package and delete only the temporary tar created by Task 1. Do not remove any restored `_archive/` directory.

Expected: the repository remains clean and local archives remain present.
