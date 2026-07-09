# Quality Report — 鸳鸯刀

Generated: 2026-07-09T09:45:47.167Z

## Overall Score: 89/100

## Metric Scores

| Metric | Score | Weight | Status |
|--------|-------|--------|--------|
| Entity Completeness | 94.1% | 0.25 | ✅ |
| Relationship Completeness | 100% | 0.15 | ✅ |
| Relationship Accuracy | 100% | 0.10 | ✅ |
| Description Accuracy | 66.7% | 0.15 | ❌ |
| Event Coverage | 100% | 0.10 | ✅ |
| Dialogue Authenticity | 75% | 0.10 | ⚠️ |
| Dialogue Representativeness | 100% | 0.05 | ✅ |
| Cross-Book Purity | 78.8% | 0.10 | ⚠️ |

## Entity Quantity (参考建议，不计入综合分数)

Chapter Count: 1

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 16 | 8 | ✅ |
| factions | 2 | 3 | ⚠️ |
| skills | 4 | 5 | ⚠️ |
| items | 11 | 3 | ✅ |
| locations | 8 | 5 | ✅ |

## Entity Completeness

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 3 | 3 | 100% |
| 重要 | 6 | 6 | 100% |
| 次要 | 7 | 7 | 100% |
| 龙套 | 1 | 0 | 0% |

### Missing Entities (1)

| ID | Name | Importance | Reason |
|-----|------|------------|--------|
| char_yu_biao_shi | 詹镖师 | 龙套 | 威信镖局镖师，随镖队行动 |

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

- Total dialogues: 21
- With speaker: 21
- With listener: 13
- Baseline checked: 4
- Baseline matched: 3

### Dialogue Issues (3)

| Index | Chapter | Speaker | Issue |
|-------|---------|---------|-------|
| 8 | 1 | 周威信 | Speech style mismatch: expected "爱说江湖谚语，谨慎胆小，老江湖口吻", got "满口江湖谚语，自我吹嘘" |
| 0 | 1 | 盖一鸣 | Speech style mismatch: expected "口若悬河，爱吹牛，自报家门时外号极长", got "滔滔不绝，自我吹嘘" |
| 2 | 1 | 逍遥子 | Speech style mismatch: expected "故作高深，爱装世外高人，实则武功平平", got "故作高深，自我吹嘘" |

## Cross-Book Purity

- Total entities: 33
- Pure entities: 26
- Suspicious: 7

### Suspicious Entities (7)

| ID | Name | Type |
|-----|------|------|
| item_e_mei_ci | 峨嵋刺 | item |
| item_liu_xing_chui | 流星锤 | item |
| item_mu_bei | 墓碑 | item |
| item_han_yan_guan | 旱烟管 | item |
| item_shuai_shou_jian | 甩手箭 | item |
| item_fei_cu_shou_gao | 腐骨穿心膏 | item |
| item_yu_shi_zi | 翡翠狮子 | item |

## Baseline Validation

- Score: 100%
- Hallucinations: 0
- Duplicates: 0