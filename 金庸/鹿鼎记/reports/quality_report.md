# Quality Report — 鹿鼎记

Generated: 2026-07-11T12:57:10.143Z

**Baseline mode:** `ok`

## Gold Overall: 99/100

## Honest Overall: 87/100

## Completion gate: PASS

### Baseline audit

- baseline.dialogues appear copied from data/dialogues.json

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 98.1% | 0.25 | ✅ |
| Relationship Completeness | 100% | 0.15 | ✅ |
| Relationship Accuracy | 90% | 0.10 | ✅ |
| Description Accuracy | 100% | 0.15 | ✅ |
| Event Coverage | 100% | 0.10 | ✅ |
| Dialogue Authenticity | 100% | 0.10 | ✅ |
| Dialogue Representativeness | 100% | 0.05 | ✅ |
| Cross-Book Purity | 100% | 0.10 | ✅ |

## Honest Metrics（不依赖金标，始终可信）

- Entity grounded: 92.3%
- Dialogue count: 10
- Dialogue chapter coverage: 6%
- Summary quality proxy: 0%
- Entity quantity: 100%

## Entity Quantity

Chapter Count: 50

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 52 | 30 | ✅ |
| factions | 10 | 6 | ✅ |
| skills | 16 | 15 | ✅ |
| items | 10 | 10 | ✅ |
| locations | 21 | 15 | ✅ |

## Entity Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 3 | 3 | 100% |
| 重要 | 21 | 21 | 100% |
| 次要 | 17 | 17 | 100% |
| 龙套 | 13 | 12 | 92.3% |

### Missing Entities (1)

| ID | Name | Importance | Reason |
|-----|------|------------|--------|
| char_wei_jiao | 韦春芳 | 龙套 | Expected by baseline |

## Relationship Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 7 | 7 | 100% |
| 重要 | 12 | 12 | 100% |
| 次要 | 1 | 1 | 100% |

## Event Coverage

Status: ok


## Dialogue Quality

- Total dialogues: 10
- Quote authenticity: 100%
- Chapter coverage: 6%
- With speaker: 10
- Baseline checked: 10

## Baseline Validation

- Score: 100%
- Mode: ok
- Hallucinations: 0
- Duplicates: 0