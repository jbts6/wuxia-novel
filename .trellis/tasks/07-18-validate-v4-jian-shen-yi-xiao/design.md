# Jian Shen Yi Xiao V4 Validation Design

## Boundaries

The production controller remains the only writer for run state, accepted evidence, final data, reports, installation, and archival. AI workers only read controller-issued source files and write YAML to the exact current staging paths.

The permanent integration test covers the deterministic portion that can run without model output: source discovery, chapter splitting, manifest construction, dynamic job packing, status projection, and path identity. The operational run covers the model-dependent portion through installation and archive.

## Data Flow

```text
tracked novel TXT
  -> archive-existing
  -> prepare and status
  -> seven real-corpus jobs / twenty chapter YAML drafts
  -> serial controller accept
  -> four domain decision YAML drafts
  -> serial controller accept
  -> assemble five YAML files
  -> workspace verify
  -> atomic install
  -> installed verify
  -> archive-run
```

## Controller Contract

- Novel directory: `C:\git\wuxia-novel\古龙\剑神一笑`
- Source: `C:\git\wuxia-novel\古龙\剑神一笑\剑神一笑.txt`
- Run ID: `run-jian-shen-yi-xiao-v4-real-20260718`
- Semantic contract: version 5, `domain-distill-v1`, `profile: v4`
- Chapter dispatch: only descriptors returned by `status --json`
- Acceptance: main agent only, one unit at a time
- Retry: initial submission plus at most one automatic retry per cycle; explicit `retry-unit --confirm` starts a new bounded cycle

## Evidence And Failure Handling

Every command result is read as structured JSON. A non-zero exit, malformed JSON, unexpected `next_action`, path mismatch, or `manual_review` stops routing. No staging, accepted, final, data, report, receipt, or archive file is manually moved or deleted.

If preparation or deterministic integration fails, add a failing regression first and change only the production owner of the defect. If model output fails validation, use the controller-issued next attempt and preserve the rejected draft. If a unit reaches manual review, report the unit and controller recovery command rather than fabricating a third automatic attempt.

## Completion Evidence

Completion requires both the tracked integration test and the archived operational run. The final record includes the chapter/job counts, accepted unit list, attempt counts, final data hash, verification-report hash, install-receipt path, archive-receipt path, and final five filenames.
