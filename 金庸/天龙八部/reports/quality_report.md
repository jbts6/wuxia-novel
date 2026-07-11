# Quality Report — 天龙八部

Generated: 2026-07-11T11:26:57.970Z

**Baseline mode:** `ok`

## Gold Overall: N/A

## Honest Overall: 87/100

## Completion gate: PASS

### Baseline audit

- character ids are a subset/copy of data/characters.json

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 100% | 0.25 | ✅ |
| Relationship Completeness | N/A | 0.15 | N/A |
| Relationship Accuracy | N/A | 0.10 | N/A |
| Description Accuracy | 100% | 0.15 | ✅ |
| Event Coverage | N/A | 0.10 | N/A |
| Dialogue Authenticity | 100% | 0.10 | ✅ |
| Dialogue Representativeness | 83.8% | 0.05 | ⚠️ |
| Cross-Book Purity | 86.5% | 0.10 | ⚠️ |

## Honest Metrics（不依赖金标，始终可信）

- Entity grounded: 100%
- Dialogue count: 37
- Dialogue chapter coverage: 28%
- Summary quality proxy: 2%
- Entity quantity: 100%

## Entity Quantity

Chapter Count: 50

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 72 | 30 | ✅ |
| factions | 12 | 6 | ✅ |
| skills | 27 | 15 | ✅ |
| items | 15 | 10 | ✅ |
| locations | 26 | 15 | ✅ |

## Entity Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 3 | 3 | 100% |
| 重要 | 20 | 20 | 100% |
| 次要 | 20 | 20 | 100% |
| 龙套 | 26 | 26 | 100% |

## Relationship Completeness

Status: no_gold

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 0 | 0 | N/A |
| 重要 | 0 | 0 | N/A |
| 次要 | 0 | 0 | N/A |

## Event Coverage

Status: no_gold


## Dialogue Quality

- Total dialogues: 37
- Quote authenticity: 100%
- Chapter coverage: 28%
- With speaker: 31
- Baseline checked: 10

## Baseline Validation

- Score: 80%
- Mode: ok
- Hallucinations: 2
- Duplicates: 0

### Baseline Hallucinations (2)

| Type | ID | Name | Issue |
|------|-----|------|-------|
| dialogue | undefined | 降龙廿八掌的精义，乃是有余不尽四字，一掌之出，必须留有余力。... | Dialogue not found in original text |
| dialogue | undefined | 佛经有云：无量有四：一慈、二悲、三喜、四舍。... | Dialogue not found in original text |