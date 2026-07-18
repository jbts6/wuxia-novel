# Simplify generate-game-kb flow - Implementation Plan

## Execution Order

- [ ] Complete and verify `07-17-game-kb-yaml-baseline`.
- [ ] Complete and verify `07-17-game-kb-assemble-verify`.
- [ ] Complete and verify `07-17-game-kb-dashboard-yaml`.
- [ ] Complete and verify `07-17-game-kb-cleanup-performance`.
- [ ] Run the parent integration gate and update the owning Trellis specs.

## Parent Integration Gate

```powershell
node --check .agents/skills/generate-game-kb/scripts/flow.js
node --test .agents/skills/generate-game-kb/tests
```

Then run the three-chapter fixture through the full target sequence, verify installed YAML through Dashboard APIs, and execute one representative novel timing run. The parent task is complete only when every acceptance criterion in `prd.md` is evidenced by a command result or generated receipt.
