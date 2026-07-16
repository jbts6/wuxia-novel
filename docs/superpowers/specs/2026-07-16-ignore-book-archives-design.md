# Ignore Local Book Archives

## Context

`generate-game-kb` keeps active work under `.game-kb-work/`, which Git already ignores. After a successful install and installed verification, `archive-run` moves the complete run to `<novel>/_archive/generate-game-kb/<run-id>/`. `archive-existing` also moves previous build artifacts into timestamped `<novel>/_archive/<archive-id>/` directories.

These archives remain useful as local evidence while the knowledge-base quality is still improving, but they are not product data. The repository should track the source chapters in `ch_split/` and the installed knowledge base in `data/`, not local recovery evidence.

## Considered Approaches

1. Ignore only `**/_archive/generate-game-kb/`. This is precise for completed runs but misses timestamped `archive-existing` output.
2. Ignore every `**/_archive/` directory. This covers both archive paths and keeps all recovery evidence local. This is the selected approach.
3. Delete archives after completion. This reduces local files but removes evidence needed to tune the flow before quality stabilizes.

## Design

- Add `**/_archive/` to the repository `.gitignore` next to the existing game-KB working-directory rules.
- Remove already tracked `_archive/` files from the Git index without deleting their working-tree copies.
- Do not change `archive-run`, `archive-existing`, installation, verification, or data-generation behavior.
- Continue tracking every book's `data/` and `ch_split/` directories.
- Before rewriting history, export the current tracked `_archive/` tree to a temporary archive outside the repository.
- Rewrite every local branch and tag with the path regex `(^|.*/)_archive(/|$)`, then expire the replaced objects through `git-filter-repo`.
- Restore the exported files to their original paths after rewriting; the new ignore rule keeps them local and untracked.
- Record the original `origin` URL and remote-main object ID, but leave `origin` unconfigured after filtering so background fetch cannot reintroduce the old objects. Re-add it only when the rewritten branch is ready to be force-pushed.

## Validation

- `git check-ignore -v` identifies representative `_archive/` files through the new rule.
- No `_archive/` path remains in `git ls-files` after the index update.
- No `_archive/` path remains in `git rev-list --all --objects` after the history rewrite.
- No remote-tracking ref remains that can retain or automatically fetch the old history.
- Existing local `_archive/` directories and files still exist after the index update.
- Tracked non-archive `data/` and `ch_split/` counts do not decrease; validation excludes any same-named directory nested below `_archive/`.
- `git diff --check` passes.

## Scope

This change controls Git tracking and rewrites local Git history. It does not clean local disk space, prune archives by age, change the `generate-game-kb` completion contract, or push rewritten history to the remote repository. The saved remote URL is `https://github.com/jbts6/wuxia-novel.git`; the pre-rewrite `origin/main` object ID is `357f723aa97be156931c15ae0d3f926f9ce37535`.
