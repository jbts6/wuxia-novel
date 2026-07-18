# generate-game-kb-deep-skills

Use this skill only after a published `generate-game-kb-v5` run. Create a
hash-bound `skills-deep` deferred task for martial skills and named techniques.
Only existing grounded skill records may be kept, merged, dropped, or
constrained-patched. Named techniques must remain source-grounded; action
descriptions such as `挥手一击` are not eligible records.

Produce overlay drafts only. Do not write final YAML, accepted evidence, or the
base registry directly. A controller overlay application must validate the
unchanged base hash and materialize a new revision atomically.
