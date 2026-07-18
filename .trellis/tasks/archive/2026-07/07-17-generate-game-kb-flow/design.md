# Simplify generate-game-kb flow - Design

## Architecture

The fast profile has one declarative semantic contract, one run-scoped state machine, two AI phases, and deterministic publication. `semantic-contract.js` is the single source for contract version, domain names, final filenames, rank/level/item enums, and field lists. Prompts and documentation explain judgment rules; executable tests verify that their mechanical lists match the contract.

```text
novel source
  -> prepare and chapter manifest (JSON machine state)
  -> chapter YAML drafts -> accepted chapter YAML
  -> candidate registry
  -> four domain YAML decisions
  -> assemble five YAML files
  -> verify workspace
  -> atomic install -> verify installed data
  -> archive run
```

## Boundaries

- AI boundary: chapter and domain workers may write only their assigned run-scoped YAML draft.
- Controller boundary: only the main controller accepts drafts and mutates progress, receipts, manifests, and worker-pool JSON.
- Assembly boundary: AI never writes final IDs or final files; deterministic code applies decisions and resolves references.
- Consumer boundary: Dashboard parses YAML once in the server/data layer and exposes normalized typed records to UI code.

## Contract And Migration

- Bump `SEMANTIC_CONTRACT_VERSION` for the incompatible four-domain YAML workflow.
- Keep old runs status-readable and fail closed for resume, assembly, install, or positive verification.
- Do not add aliases for legacy domain names or fallback reads for legacy JSON final files.
- Preserve evidence in accepted artifacts and verification reports; simplified final records remain browse-oriented.

## Task Map

1. `07-17-game-kb-yaml-baseline`: restore parseability and align the executable YAML/four-domain contract.
2. `07-17-game-kb-assemble-verify`: implement the single deterministic assembly and verification path.
3. `07-17-game-kb-dashboard-yaml`: migrate installation and Dashboard/library consumers to the five YAML files.
4. `07-17-game-kb-cleanup-performance`: remove unreachable legacy stages and apply bounded-attempt/status/concurrency optimizations.

## Rollback Shape

Each child task is independently reviewable. If a child fails its gate, revert only that child's files while leaving earlier contract migrations intact. Installation changes must retain the existing pre/post-move recovery and receipt behavior throughout the migration.
