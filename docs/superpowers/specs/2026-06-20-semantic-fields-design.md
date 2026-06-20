# Semantic Fields Design

## Context

Deconstructed novel data currently overloads `rank` and `rarity` with several unrelated meanings. Examples found in existing JSON include martial-art mastery (`登峰造极`, `返璞归真`), character power (`绝顶高手`, `一流`), character importance (`主要人物`, `配角`), numeric ratings (`6`, `8`), English values (`rare`, `top`), and typos or local labels.

This makes the global library dashboard difficult to filter because it cannot tell which semantic axis a value belongs to. The existing `deconstruct-novel` skill already treats `entity_registry.json` as the source of truth and splits it into final entity files, so the fix should happen at the schema, validation, migration, and consumer layers rather than only in dashboard filter code.

## Goals

- Split overloaded `rank` and `rarity` data into explicit semantic fields.
- Migrate existing source JSON while preserving original values for audit and future correction.
- Prevent new extraction runs from reintroducing mixed semantics.
- Update dashboard filtering and export to read the new fields first.
- Keep legacy fields temporarily compatible so existing tools do not break in the same change.

## Non-Goals

- Do not redesign entity identity, cross-book deduplication, relationship modeling, or game-stat formulas.
- Do not remove legacy `rank` and `rarity` in the first migration pass.
- Do not manually inspect or rewrite individual novel facts beyond deterministic mapping and anomaly reporting.

## Canonical Fields

### Rank Sequence

Both martial-art mastery and character power use the same ordered Chinese rank sequence:

| Order | Rank |
|------:|------|
| 1 | 平平无奇 |
| 2 | 初窥门径 |
| 3 | 略有小成 |
| 4 | 登堂入室 |
| 5 | 炉火纯青 |
| 6 | 出神入化 |
| 7 | 登峰造极 |
| 8 | 返璞归真 |

`返璞归真` is the strongest value.

### Skills

`Skill.mastery_rank` is the canonical martial-art mastery field. It must be one of the eight rank values above.

`Skill.rank` remains as a legacy compatibility alias during the transition. New extraction and dashboard code should not use it as the semantic source.

### Characters

`Character.power_rank` is the canonical character strength field. It must be one of the eight rank values above.

`Character.importance` is the canonical character importance field. Allowed values:

- `主角`
- `主要人物`
- `配角`
- `路人`
- `未知`

`Character.rank` remains as a legacy compatibility alias during the transition.

### Items

`Item.rarity_tier` is the canonical item rarity field. The `deconstruct-novel` constants and schemas must explicitly define it because the current skill documentation does not carry a complete item rarity norm.

Allowed values:

- `寻常凡品`
- `上乘佳品`
- `稀世珍品`
- `绝世神兵`
- `未知`

`未知` is a migration fallback and an extraction fallback when the text does not support a rarity judgement. `Item.rarity` remains as a legacy compatibility alias during the transition.

### Legacy Audit Data

Migration preserves original mixed values in audit fields:

- `legacy_rank` on skills and characters when the original `rank` differs from the canonical new field or cannot be confidently mapped.
- `legacy_rarity` on items when the original `rarity` differs from `rarity_tier` or cannot be confidently mapped.
- `migration_notes` as an array of short strings for unresolved or lossy mappings.

## Migration

Add a deterministic CommonJS migration script, for example `tools/normalize/semantic-fields.js`.

The script scans book directories and updates these files when present:

- `entity_registry.json`
- `characters.json`
- `skills.json`
- `items.json`

For each entity, it should:

1. Read current canonical fields if they already exist.
2. Inspect legacy `rank` or `rarity` when the canonical field is missing.
3. Map known historical values to the new fields.
4. Preserve original values in `legacy_rank`, `legacy_rarity`, or `migration_notes` when mapping is lossy or uncertain.
5. Synchronize legacy `rank` / `rarity` to the canonical value for short-term compatibility.
6. Write stable pretty JSON and a migration report.

The report should include per-book counts for mapped values, defaulted values, unresolved values, and files changed. It should also list unique unresolved source values with example file paths so future cleanup can be targeted.

## Mapping Policy

Known rank values in the eight-value sequence map directly.

Historical character power labels map conservatively onto `power_rank`, for example:

- `绝顶高手`, `绝顶`, `宗师`, `top` -> `登峰造极` unless stronger textual evidence already produced `返璞归真`.
- `一流高手`, `一流` -> `出神入化`.
- `二流高手`, `二流` -> `炉火纯青`.
- `三流`, `普通`, `平平无奇`, `不入流` -> the closest lower rank in the eight-value sequence.

Historical importance labels map to `importance`, for example:

- `主角`, `protagonist` -> `主角`.
- `主要人物`, `重要人物`, `major` -> `主要人物`.
- `配角`, `minor` -> `配角`.
- `路人`, `群众`, `unknown` -> `路人` or `未知` depending on source value.

Numeric values map to the same order when they are integers from 1 to 8. Values outside that range are unresolved.

Historical item rarity labels map to `rarity_tier`, for example:

- `legendary`, `绝世`, `神兵`, `绝世神兵` -> `绝世神兵`.
- `rare`, `稀有`, `珍稀`, `稀世`, `稀世珍品` -> `稀世珍品`.
- `uncommon`, `上乘`, `珍贵`, `上乘佳品` -> `上乘佳品`.
- `common`, `普通`, `寻常`, `寻常凡品` -> `寻常凡品`.

Ambiguous values such as `特殊`, `重要`, `危险`, or local descriptive labels should not be guessed into a high tier unless a specific mapping is defined. They should use `未知` and keep the raw value in audit data.

## Extraction Contract

Update `.agents/skills/deconstruct-novel/constants.md`:

- Define the shared eight-value rank sequence.
- Define `item.rarity_tier` allowed values.
- Define `character.importance` allowed values.
- State that legacy `rank` and `rarity` are compatibility aliases, not semantic output targets.

Update `.agents/skills/deconstruct-novel/schemas.md`:

- Require `Skill.mastery_rank`.
- Require `Character.power_rank` and `Character.importance`.
- Require `Item.rarity_tier`.
- Keep legacy fields optional during transition.

Update `.agents/skills/deconstruct-novel/subagent-template.md`:

- Instruct subagents to emit the new fields in `new_entities` and `entity_updates`.
- Forbid stuffing importance, rarity, English labels, or numeric scores into `rank`.

## Validation

Update `.agents/skills/deconstruct-novel/scripts/validators.js` so both chapter files and `entity_registry.json` enforce:

- `Skill.mastery_rank` is present and belongs to the eight-value sequence.
- `Character.power_rank` is present and belongs to the eight-value sequence.
- `Character.importance` is present and belongs to its allowed values.
- `Item.rarity_tier` is present and belongs to its allowed values.
- Legacy `rank` / `rarity`, when present, must either equal the corresponding canonical field or be paired with `legacy_rank` / `legacy_rarity`.

The validator should fail fast for future extraction output, but the migration script should report and fix historical data before validation is applied across the full repository.

## Dashboard And Export

Update dashboard types and utilities:

- `Skill` reads `mastery_rank`.
- `Character` reads `power_rank` and `importance`.
- `Item` reads `rarity_tier`.
- Predicates such as top-tier martial arts use `mastery_rank` values `登峰造极` and `返璞归真`.
- Legendary item logic uses `rarity_tier === '绝世神兵'`.

Global library filters should require a material type before showing semantic filters:

- `功法`: show `境界/强度`, backed by `mastery_rank`.
- `角色`: show `强度` and `角色重要性`, backed by `power_rank` and `importance`.
- `物品`: show `稀有度` and item `type`, backed by `rarity_tier` and `type`.
- `门派`: show faction type, author, and book filters.
- `全部` or no type: show only common filters such as keyword, author, and book.

Exports should include the new canonical fields. Legacy `rank` and `rarity` can remain for one compatibility release but should be labeled or documented as legacy fields.

## Error Handling

The migration script should avoid silent data loss:

- Invalid JSON stops processing for that file and records an error in the report.
- Unknown values are preserved in audit fields rather than discarded.
- Existing canonical fields are not overwritten by weaker legacy guesses unless an explicit force option is added later.
- A dry-run mode should show planned changes without writing files.
- Re-running the migration should be idempotent.

## Testing

Unit tests should cover:

- Mapping known rank, power, importance, and rarity values.
- Numeric 1-8 rank migration.
- Unknown values preserving legacy data and producing migration notes.
- Idempotent re-runs.
- Validator failures for missing or invalid canonical fields.
- Dashboard filter options changing by selected material type.
- Export containing canonical fields and preserving legacy columns during transition.

Repository verification should include:

- Running the migration in dry-run mode.
- Running validator checks on a representative migrated book.
- Running dashboard unit tests for library filters, aggregate predicates, and export shape.

## Acceptance Criteria

- Existing source JSON can be migrated without losing original dirty values.
- New extraction output cannot pass validation if it writes mixed meanings into `rank` or `rarity`.
- Dashboard global filters no longer show one combined `rank` selector across skills, characters, and items.
- Top-tier skills, character strength, character importance, and item rarity are filtered from separate canonical fields.
- Migration produces a report listing unresolved historical values for later cleanup.
