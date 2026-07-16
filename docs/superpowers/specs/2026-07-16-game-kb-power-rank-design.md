# Game KB Power Rank Design

## Goal

Unify character and martial-skill strength under one canonical `power_rank`
field, and remove item rarity from the `generate-game-kb` contract and
Dashboard experience.

## Canonical Contract

Characters and skills both require `power_rank`. The ordered values, weakest
to strongest, are:

1. `平平无奇`
2. `初窥门径`
3. `略有小成`
4. `登堂入室`
5. `炉火纯青`
6. `出神入化`
7. `登峰造极`
8. `返璞归真`

The value records the strongest state supported anywhere in the novel. A
chapter worker supplies a provisional value from that chapter's evidence; the
plot or martial domain decision supplies the final full-book value for each
kept character or skill. This adds no AI work unit.

New `items.json` records do not contain `rarity_tier` or `rarity`. New
`skills.json` records do not contain `mastery_rank` or legacy `rank`.

## Compatibility

This is semantic contract version 3. Existing version 2 runs remain read-only
and must be archived explicitly before regeneration.

The Dashboard normalizer accepts old skill `mastery_rank` or `rank` only at
the raw-data boundary and projects the value into canonical `power_rank`.
Components and application types consume only `power_rank`. Existing item
rarity fields are ignored, and item rarity controls are removed.

Existing book JSON is not rewritten in bulk. Regeneration installs the v3
shape naturally.

## Validation

- Chapter drafts reject missing or invalid character/skill `power_rank`.
- Domain keep decisions for characters and skills require a valid final
  `power_rank` patch.
- Recall and supplement records for characters and skills require the field.
- Merged, cleaned, final, and installed data reject invalid ranks.
- Final skills reject `mastery_rank` and `rank`; final items reject
  `rarity_tier` and `rarity`.

## Verification

Run the complete `generate-game-kb` Node test suite, Dashboard unit tests,
Dashboard lint, and Dashboard production build. Contract tests must also scan
the Skill documentation and prompts for the v3 field names and eight values.
