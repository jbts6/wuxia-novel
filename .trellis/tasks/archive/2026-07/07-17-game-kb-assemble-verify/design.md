# Build single assemble and verify flow - Design

## Decision

Use a new v4 assembly boundary and a two-layer verifier. Do not wrap the legacy five-command chain behind an `assemble` alias, and do not keep final JSON or old-domain compatibility.

The approved audit considered three shapes:

1. Hide `prepare-merge -> assemble-merge -> prepare-clean -> assemble-clean -> build-final` behind one command. This minimizes edits but preserves duplicate semantics and the old nine-category contract, so it is rejected.
2. Incrementally adapt the old merged/cleaned books. This reuses more code but keeps verification coupled to fields that no longer exist in the five final files, so it is rejected for the normal path.
3. Expand the four terminal domain decisions once, project the five YAML files once, and verify accepted evidence plus consumer data separately. This is the selected approach because it matches the approved target flow and gives cleanup a clear dependency boundary.

## Boundaries

### Domain planning

The existing candidate registry and domain work-plan creation remain deterministic and reusable. The normal spelling becomes `plan-domains`; it creates exactly the four units from `semantic-contract.js`. The old `prepare-merge` spelling may remain as a deprecated compatibility entry during this child only, then `game-kb-cleanup-performance` removes it.

### Assembly

Add `scripts/lib/assemble.js` as the orchestration boundary. It:

- verifies the writable v4 run and accepted-artifact hashes;
- loads every accepted chapter YAML, the candidate registry, the domain work plan, and exactly four accepted domain YAML decisions;
- expands keep/merge/reject chains and rejects pending, missing, duplicate, cross-category, cyclic, or stale decisions;
- builds one four-category intermediate book with deterministic candidate resolutions and chapter summaries;
- assigns stable IDs and resolves character skill/item/faction plus skill faction references once;
- writes exactly the five final YAML files through an atomic directory swap;
- writes `reports/assembly-report.json`, binding accepted hashes, decision hashes, candidate closure, final hash, and warnings.

The assembly report is controller JSON. It is evidence and resumability state, not a sixth knowledge-base file.

### Verification

Split verification into two layers:

- `verifyDataRoot(dataRoot, options)` validates any five-file YAML dataset: exact files/fields, arrays, IDs, enums, nested technique shape, summary coverage, and reference closure. It is used for workspace staging and installed data.
- `verifyFinal(paths)` adds run-scoped evidence checks: semantic version, manifest/chapter completeness, accepted hash immutability, chapter/domain contract validation, candidate decision closure, source evidence, named-technique evidence, ordinary-item inclusion, assembly-report freshness, and zero unresolved manual review.

Final consumer records intentionally omit `source_refs`. Workspace verification proves evidence from accepted artifacts and binds that proof to the final hash. Installed verification checks the five files and the install receipt that binds the already-verified final hash.

### Installation

Keep the existing backup-and-rename recovery protocol. Replace quality/game-material report dependencies with the v4 verification report and receipt hashes. Staging and post-swap checks use `verifyDataRoot`; the pre-install gate uses `verifyFinal`.

## Data Flow

```text
accepted chapters (.yaml) + artifact manifest
  -> candidate registry + four-domain plan
  -> four accepted terminal decisions (.yaml)
  -> assemble.js
       -> four-category evidence book (controller memory)
       -> stable IDs/reference projection
       -> final/data/{five YAML files}
       -> reports/assembly-report.json
  -> verifyFinal(paths)
       -> reports/verification-report.json
  -> atomic install
       -> data/{five YAML files}
       -> reports/generate_game_kb_install.json
  -> verifyInstalled(novelDir)
```

## Failure and Recovery

- Missing or mutated accepted input fails before final output changes.
- Invalid or unresolved domain decisions fail before ID assignment.
- Reference projection failure removes the staged next directory and preserves the previous final directory.
- Verification never repairs or rewrites semantic content.
- Install rollback behavior remains unchanged: a failure before or after the old-data move restores the previous installed directory.
- A non-v4 run stays observable but every assembly, verification-as-current, and install write path fails with `LEGACY_SEMANTIC_CONTRACT`.

## Testing

- Unit tests cover decision expansion, merge cycles, pending/missing decisions, deterministic ordering, exact final fields, and byte-stable YAML.
- Verification tests cover YAML/schema errors, evidence and summary gaps, named techniques, ordinary items, final references, stale assembly reports, and installed receipt/hash checks.
- A three-chapter flow test runs domain planning, four domain accepts, `assemble`, `verify`, `install`, and `verify --installed` without the old merge/clean/build commands.
- Old-flow tests are migrated or deleted only in `game-kb-cleanup-performance`; they are not reasons to restore removed behavior.

## Rollback Shape

All changes remain isolated in `feat/game-kb-yaml-flow`. No commit, merge, or push is performed during this multi-child implementation. If this child fails its focused gate, remove only the new v4 assembly boundary and restore the prior flow routing; accepted YAML evidence remains untouched.
