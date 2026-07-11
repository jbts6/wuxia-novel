# Quality Report — 绝代双骄

Generated: 2026-07-11T10:32:08.785Z

**Baseline mode:** `ok`

## Gold Overall: 99/100

## Honest Overall: 100/100

## Completion gate: PASS

### Baseline audit

- character ids are a subset/copy of data/characters.json

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 100% | 0.25 | ✅ |
| Relationship Completeness | 100% | 0.15 | ✅ |
| Relationship Accuracy | 100% | 0.10 | ✅ |
| Description Accuracy | 90.9% | 0.15 | ✅ |
| Event Coverage | 100% | 0.10 | ✅ |
| Dialogue Authenticity | 100% | 0.10 | ✅ |
| Dialogue Representativeness | 100% | 0.05 | ✅ |
| Cross-Book Purity | 100% | 0.10 | ✅ |

## Honest Metrics（不依赖金标，始终可信）

- Entity grounded: 100%
- Dialogue count: 572
- Dialogue chapter coverage: 100%
- Summary quality proxy: 100%
- Entity quantity: 100%

## Entity Quantity

Chapter Count: 127

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 33 | 30 | ✅ |
| factions | 6 | 6 | ✅ |
| skills | 19 | 15 | ✅ |
| items | 12 | 10 | ✅ |
| locations | 16 | 15 | ✅ |

## Entity Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 6 | 6 | 100% |
| 重要 | 15 | 15 | 100% |
| 次要 | 12 | 12 | 100% |
| 龙套 | 0 | 0 | null% |

## Relationship Completeness

Status: ok

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 9 | 9 | 100% |
| 重要 | 8 | 8 | 100% |
| 次要 | 5 | 5 | 100% |

## Event Coverage

Status: ok


## Dialogue Quality

- Total dialogues: 572
- Quote authenticity: 100%
- Chapter coverage: 100%
- With speaker: 572
- Baseline checked: 15

## Baseline Validation

- Score: 100%
- Mode: ok
- Hallucinations: 0
- Duplicates: 0