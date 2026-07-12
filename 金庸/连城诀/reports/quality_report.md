# Quality Report — 连城诀

Generated: 2026-07-11T14:58:42.020Z

**Baseline mode:** `ok`

## Gold Overall: 95/100

## Honest Overall: 93/100

## Completion gate: PASS

### Baseline audit

- character ids are a subset/copy of data/characters.json

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 100% | 0.25 | ✅ |
| Relationship Completeness | 100% | 0.15 | ✅ |
| Relationship Accuracy | 95% | 0.10 | ✅ |
| Description Accuracy | 78.6% | 0.15 | ⚠️ |
| Event Coverage | 100% | 0.10 | ✅ |
| Dialogue Authenticity | 100% | 0.10 | ✅ |
| Dialogue Representativeness | 100% | 0.05 | ✅ |
| Cross-Book Purity | 91.9% | 0.10 | ✅ |

## Honest Metrics（不依赖金标，始终可信）

- Entity grounded: 85.7%
- Dialogue count: 60
- Dialogue chapter coverage: 100%
- Summary quality proxy: 100%
- Entity quantity: 100%

## Entity Quantity

Chapter Count: 12

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 35 | 8 | ✅ |
| factions | 3 | 3 | ✅ |
| skills | 12 | 5 | ✅ |
| items | 12 | 3 | ✅ |
| locations | 10 | 5 | ✅ |

## Entity Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 3 | 3 | 100% |
| 重要 | 11 | 11 | 100% |
| 次要 | 17 | 17 | 100% |
| 龙套 | 3 | 3 | 100% |

## Relationship Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 6 | 6 | 100% |
| 重要 | 12 | 12 | 100% |
| 次要 | 2 | 2 | 100% |

## Event Coverage

Status: ok


## Dialogue Quality

- Total dialogues: 60
- Quote authenticity: 100%
- Chapter coverage: 100%
- With speaker: 60
- Baseline checked: 13

## Baseline Validation

- Score: 90%
- Mode: ok
- Hallucinations: 1
- Duplicates: 0

### Baseline Hallucinations (1)

| Type | ID | Name | Issue |
|------|-----|------|-------|
| skill | undefined | 龙沙帮武功 | Skill "龙沙帮武功" not found in original text |