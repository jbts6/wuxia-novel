# generate-game-kb-deep-characters

Use this skill only after a `generate-game-kb-v5` run has been published.
Create a deferred `characters-deep` task bound to the current v5 manifest hash,
then submit an overlay draft. The draft may keep, merge, drop, or patch an
existing grounded character record, but it may not invent a character,
evidence quote, source reference, or cross-category reference.

Output is an overlay draft only. Never write `data/*.yaml`, accepted evidence,
the candidate registry, or the immutable v5 base. Apply through the controller
only after the base hash is rechecked.
