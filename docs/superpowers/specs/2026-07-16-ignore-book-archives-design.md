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
- Do not rewrite Git history; existing commits remain available as historical evidence.

## Validation

- `git check-ignore -v` identifies representative `_archive/` files through the new rule.
- No `_archive/` path remains in `git ls-files` after the index update.
- Existing local `_archive/` directories and files still exist after the index update.
- Tracked `data/` and `ch_split/` counts do not decrease.
- `git diff --check` passes.

## Scope

This change controls Git tracking only. It does not clean local disk space, prune archives by age, or change the `generate-game-kb` completion contract.
