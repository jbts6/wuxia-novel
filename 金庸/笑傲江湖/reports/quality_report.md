# Quality Report — 笑傲江湖

Generated: 2026-07-11T02:18:33.870Z

## Overall Score: 100/100

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 100% | 0.25 | ✅ |
| Relationship Completeness | 100% | 0.15 | ✅ |
| Relationship Accuracy | 100% | 0.10 | ✅ |
| Description Accuracy | 100% | 0.15 | ✅ |
| Event Coverage | 100% | 0.10 | ✅ |
| Dialogue Authenticity | 100% | 0.10 | ✅ |
| Dialogue Representativeness | 100% | 0.05 | ✅ |
| Cross-Book Purity | 100% | 0.10 | ✅ |

## Entity Quantity (参考建议，不计入综合分数)

Chapter Count: 40

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 56 | 20 | ✅ |
| factions | 14 | 5 | ✅ |
| skills | 24 | 10 | ✅ |
| items | 14 | 8 | ✅ |
| locations | 20 | 10 | ✅ |

## Entity Completeness

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 3 | 3 | 100% |
| 重要 | 12 | 12 | 100% |
| 次要 | 15 | 15 | 100% |
| 龙套 | 26 | 26 | 100% |

## Relationship Completeness

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 0 | 0 | 100% |
| 重要 | 0 | 0 | 100% |
| 次要 | 0 | 0 | 100% |

## Event Coverage

| Type | Expected | Actual | Coverage |
|------|----------|--------|----------|
| main | 0 | 0 | 100% |
| branch | 0 | 0 | 100% |
| detail | 0 | 0 | 100% |

## Dialogue Quality

- Total dialogues: 90
- With speaker: 90
- With listener: 45
- Baseline checked: 10
- Baseline matched: 10

### Dialogue Issues (9)

| Index | Chapter | Speaker | Issue |
|-------|---------|---------|-------|
| 26 | 10 | 风清扬 | Speech style mismatch: expected "淡泊名利，传授剑道真谛", got "淡泊名利，不问世事" |
| 26 | 10 | 风清扬 | Speech style mismatch: expected "指点剑术", got "淡泊名利，不问世事" |
| 16 | 5 | 令狐冲 | Speech style mismatch: expected "幽默诙谐，调侃应对", got "幽默诙谐，口无遮拦，常以俏皮话化解危机" |
| 56 | 39 | 令狐冲 | Speech style mismatch: expected "豪放不羁，拒绝谀词", got "幽默诙谐，口无遮拦，常以俏皮话化解危机" |
| 23 | 7 | 令狐冲 | Speech style mismatch: expected "调侃幽默", got "幽默诙谐，口无遮拦，常以俏皮话化解危机" |
| 48 | 34 | 岳不群 | Speech style mismatch: expected "伪善谦虚", got "表面温文尔雅，实则口蜜腹剑" |
| 50 | 35 | 林平之 | Speech style mismatch: expected "愤怒偏执", got "初期温文尔雅，后期阴沉偏执" |
| 57 | 40 | 方证大师 | Speech style mismatch: expected "慈悲智慧", got "慈祥温和，充满智慧" |
| 80 | 37 | 任我行 | Speech style mismatch: expected "霸道威胁", got "霸气十足，唯我独尊" |

## Cross-Book Purity

- Total entities: 108
- Pure entities: 108
- Suspicious: 0

## Baseline Validation

- Score: 80%
- Hallucinations: 2
- Duplicates: 0

### Baseline Hallucinations (2)

| Type | ID | Name | Issue |
|------|-----|------|-------|
| item | item_xiao_ao_jiang_hu_qu_pu | 笑傲江湖曲谱 | Item "笑傲江湖曲谱" not found in original text |
| item | item_guang_ling_san_qin_pu | 广陵散琴谱 | Item "广陵散琴谱" not found in original text |