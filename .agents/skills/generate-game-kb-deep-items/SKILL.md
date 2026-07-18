# generate-game-kb-deep-items

Use this skill only against a published v5 base and the `items` scope. Submit
an `items-deep` deferred task bound to the base manifest hash. Enrichment may
keep, merge, drop, or patch existing grounded items only; it cannot introduce
new items, descriptions, ranks, evidence, or source references.

The only output is an overlay draft. Base YAML, accepted evidence, and the
candidate registry remain immutable until a validated controller overlay is
applied atomically.
