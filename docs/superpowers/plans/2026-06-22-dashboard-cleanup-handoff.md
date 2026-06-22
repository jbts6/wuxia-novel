# Dashboard Cleanup Handoff

Date: 2026-06-22
Repo: `/Users/admin/Site/wuxia-novel`
Focus for next session: continue dashboard architecture/code-quality cleanup with small, verified commits.

## Current State

The working tree was clean before this handoff was written.

Recent cleanup commits, newest first:

- `2ecd967 refactor: trim unused novel store state`
- `fcdcad7 refactor: extract entity row builders`
- `d49b7ec fix: fail static export on corrupt data`
- `fdae410 refactor: centralize dashboard novel data access`
- `35e06e0 fix: harden dashboard quality gates`
- Baseline nearby: `b41f998 clean files`

Use those commits for exact diffs. Do not duplicate their content here.

## Repo Instructions To Preserve

- Use `rtk` prefix for shell commands.
- `.codegraph/` exists, so prefer CodeGraph before grep/find or broad file reads when locating dashboard code.
- Use `apply_patch` for manual file edits.
- Do not revert unrelated or user-made changes.
- Keep generated outputs such as `dashboard/dist` and `dashboard/dist-static` out of commits.
- Keep cleanup commits focused and small.

## Completed This Session

- Re-confirmed that `dashboard/src/stores/useNovelStore.ts` had unused store-owned fields/actions:
  `currentBookPath`, `searchQuery`, `selectedNodeType`, `selectedNodeId`,
  `setBookPath`, `setLoading`, `setError`, `setSearchQuery`.
- Preserved `currentBookPath` in `dashboard/src/stores/useBookStore.ts`; that store still owns book selection.
- Preserved local dialogue search state in `dashboard/src/components/dialogues/DialogueList.tsx`.
- Removed only the dead novel-store fields/actions.
- Verified from `dashboard/`:
  `rtk npm run lint`, `rtk npm run build`, and `rtk npm run test`.
- Committed the cleanup as `2ecd967 refactor: trim unused novel store state`.

## Recommended Next Phase

Start with an isolated entity lookup/index cleanup.

Likely files to inspect:

- `dashboard/src/components/cards/CharacterCard.tsx`
- `dashboard/src/components/cards/SkillCard.tsx`
- `dashboard/src/components/common/DetailPanel.tsx`
- `dashboard/src/components/detail/DetailPanel.tsx`, if that is the active detail panel path

Direction:

1. Re-confirm repeated entity lookup logic with CodeGraph first.
2. If repeated `find`/`filter`/relationship-resolution logic is still spread across card/detail modules, extract a small pure helper.
3. Prefer a helper path such as `dashboard/src/utils/entityLookup.ts`, unless the existing code suggests a better local module.
4. Add focused tests for the helper before replacing UI call sites.
5. Replace only the duplicated lookup logic; do not change UI behavior.
6. Run verification from `dashboard/`:
   `rtk npm run lint`, `rtk npm run build`, `rtk npm run test`.
7. Commit with a focused message, for example:
   `refactor: centralize entity lookup helpers`.

## Defer Unless Explicitly Requested

- Splitting `useNovelStore` into multiple stores or modules.
- Reworking cross-component state ownership.
- Redesigning dashboard UI architecture.
- Combining entity lookup cleanup with static export or store changes in one commit.

## Suggested Skills

- `verification-before-completion`: before claiming completion or committing.
- `test-driven-development`: for helper extraction or behavior-preserving refactors with a test seam.
- `codebase-design`: if considering a deeper store/module split.
- `requesting-code-review`: before merging a larger architecture cleanup batch.
