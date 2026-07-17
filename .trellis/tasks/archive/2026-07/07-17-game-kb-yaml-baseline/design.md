# Restore YAML contract baseline - Design

## Contract Source

Expand `scripts/lib/semantic-contract.js` instead of adding another overlapping contract module. Existing validators already import its rank/version exports, so extending it minimizes migration churn and gives tests one executable source for domains, filenames, enums, and fields.

## Repair Strategy

1. Add contract tests first, including negative assertions for legacy domains and JSON artifact paths.
2. Repair syntax errors by deleting orphaned removed-category blocks at function boundaries.
3. Update path and domain consumers to import the shared contract.
4. Align chapter/domain field validation and summary projection.
5. Update documentation and the fast-profile Trellis spec to the same mechanical contract.

## Compatibility

The contract version is bumped because accepted paths, domains, and projected fields are incompatible. Existing legacy runs remain readable through status but are not upgraded in place. This child does not remove the legacy commands yet; it prevents them from defining the new contract.

## Verification

Syntax checks cover every production JS file. Focused tests cover the shared contract, chapter drafts, domain drafts, acceptance paths, and flow path discovery. A repository-wide search confirms that remaining JSON references are controller state or explicitly documented legacy evidence.
