# Recover Lite worker guard and controller workflow

## Goal

Restore reliable continuation of Lite game-KB runs after worker-policy failures,
make Claude Code use the read-only chapter Workflow without fallback, and make
every Lite controller `next_action` executable without hand-written artifacts.

## Background

- A worker created `worker_output_ch001.json` inside an existing run directory.
  After the file was removed, the immutable guard receipt still contained the
  run directory's changed `mtime`, so the original run remained permanently in
  `worker-write-review`.
- Claude Code initially extracted in the main session, then used generic agents
  instead of `game-kb-chapter-extract`. One generic agent returned prose rather
  than a structured envelope, and the main session rebuilt its output.
- The main session wrote `C:/Users/fh345/AppData/Local/Temp/envelope.json` before
  submission even though worker results must pass directly to controller stdin.
- The blocked run was bypassed by creating a new run even though the controller
  never returned `start-new-run`.
- After the replacement run accepted its only chapter, `lite-status` returned
  `lite-publish`. The Lite route had skipped `planDomains()`, so
  `accepted/candidate-registry.json` did not exist and publication failed.
- Claude Code eventually completed and archived
  `run-bai-ma-xiao-xi-feng-lite-v4`. Installed verification passes with final
  data hash `sha256:f1fa45d379f9d2ca01db19c4a851a6cacf34e86b8eea4cb2d539187d91b41ecb`
  and counts `characters=4, skills=1, items=2, factions=1, summaries=1`.
- The v4 main session manually created the missing candidate registry. A fresh
  deterministic recomputation from the accepted chapter matches it exactly at
  `sha256:f45df18361c68b6eeab9e1503e5af58e369867faa817f51f17955758075495db`.
  The output is therefore preservable, but the manual creation path remains a
  controller-boundary violation that must not recur.
- The five installed YAML files are byte-identical to the archived v4 final
  files. The seven tracked White Horse `data/reports` changes are completed
  product output from Claude Code and are not part of the controller code edits.
- The completed output classifies `白马` and `玉镯` as `其他` because the
  current enum lacks `坐骑` and `饰品`.

## Requirements

- Preserve immutable guard open/check receipts as historical evidence. Do not
  add a reset command and do not rewrite progress or guard receipts.
- Treat an existing directory's size/mtime-only change as derived metadata, not
  a live worker-write violation. Continue detecting added/deleted directories,
  type changes, and all file/other entry additions, modifications, and deletes.
- Apply the same semantic rule when resolving historical receipts so deleting a
  rogue child file unblocks the original run without erasing evidence.
- For Claude Code, require `game-kb-chapter-extract` whenever `chapter_jobs` are
  returned, including a one-chapter short story. Generic Agent/Task dispatch and
  main-session chapter extraction are forbidden.
- If the Claude Workflow is unavailable, returns malformed structured output,
  or times out, stop or retry the Workflow without adapting the worker content.
  Do not fall back to a writable agent.
- Worker envelopes exist only as Workflow return values and controller stdin.
  Neither worker nor main session may write envelope files in the repository,
  `%TEMP%`, `/tmp`, or another filesystem location.
- A new run may be created only when controller status explicitly returns
  `start-new-run`; guard review and Workflow failure are not authorization.
- Add a Lite-profile `lite-plan-domains` controller command. It must build and
  immutably record the deterministic candidate registry from accepted chapters.
- `lite-status` must return `lite-plan-domains` after all chapters are accepted
  and before the candidate registry exists. It may return `lite-publish` only
  after the registry/domain plan exists and Lite-required inputs are complete.
- Keep V4 routing unchanged and preserve the Lite optional `lite-basic-curate`
  step between planning and publication.
- Extend the shared `item.type` enum from
  `武器/防具/秘籍/丹药/暗器/其他` to also include `坐骑/异兽/饰品`.
  Apply the same enum to chapter extraction, final verification, deep-item
  overlays, and legacy type normalization without invalidating existing v6
  runs or rewriting historical data.
- `坐骑` and `异兽` extraction remains subject to item inclusion quality: keep
  named, rare, or plot-relevant animals and exclude undifferentiated background
  livestock. `饰品` covers source-grounded wearable ornaments and jewelry.
- Keep unrelated `dashboard/pnpm-lock.yaml` out of every commit.
- Preserve the completed v4 archived run and its seven tracked installed
  `data/reports` changes as read-only external evidence. Do not stage, commit,
  revise, or regenerate them during this controller task.
- Do not resume the superseded original, v2, or v3 White Horse runs. The guard
  fix may make the original run schedulable again, but completion belongs to v4.

## Acceptance Criteria

- [ ] A regression reproduces an existing directory receiving a rogue child
      file, guard check, child deletion, and automatic exit from
      `worker-write-review` while the immutable check receipt remains unchanged.
- [ ] Future guard checks do not report size/mtime-only modifications for an
      existing directory, but still report added/deleted/type-changed directories
      and file writes.
- [ ] The real original White Horse run no longer reports
      `worker-write-review` after the fix, without modifying its receipts.
- [ ] English and Chinese Lite/V4 Skills state that one chapter has no exception,
      the Claude Workflow is mandatory, generic agents/main extraction are
      forbidden, and only `start-new-run` permits a new run.
- [ ] Skill tests forbid temporary envelope files everywhere and provide a
      direct stdin-only submission recipe.
- [ ] A Lite CLI regression proves `done chapter -> lite-plan-domains -> run the
      returned command -> lite-publish`, with `candidate-registry.json` created
      by the controller.
- [ ] The candidate registry is never accepted from worker or main-session data.
- [ ] The current White Horse installed product remains byte-identical throughout
      this task; its passing installed verification and deterministic registry
      comparison are recorded as read-only real-run evidence.
- [ ] Controller, Skill, task, and verification commits do not include White Horse product files,
      stale run directories, or `dashboard/pnpm-lock.yaml`.
- [ ] `坐骑`, `异兽`, and `饰品` pass the shared item semantic validator,
      appear in both chapter extraction contracts, and survive assembly and
      final verification; an unknown type still fails with `ITEM_TYPE_INVALID`.
- [ ] Legacy item types that explicitly mean mount, exotic beast, or accessory
      normalize to the new canonical Chinese values instead of `其他`.
- [ ] Focused tests, the complete game-KB test suite, both Skill validators, and
      `git diff --check` pass.

## Out Of Scope

- Deleting or resuming the superseded original, v2, or v3 White Horse runs.
- Committing, revising, or rerunning the current White Horse installed product.
  The user may run the small novel again after these controller fixes land.
- Expanding the repository guard to monitor the entire operating-system temp
  directory.
- Changing chapter splitting or merging the one-chapter White Horse source.
