# Quality Report — 射雕英雄传

Generated: 2026-07-09T13:02:16.970Z

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
| Dialogue Representativeness | 96.4% | 0.05 | ✅ |
| Cross-Book Purity | 97.5% | 0.10 | ✅ |

## Entity Quantity (参考建议，不计入综合分数)

Chapter Count: 40

| Type | Actual | Minimum | Status |
|------|--------|---------|--------|
| characters | 67 | 20 | ✅ |
| factions | 12 | 5 | ✅ |
| skills | 24 | 10 | ✅ |
| items | 18 | 8 | ✅ |
| locations | 21 | 10 | ✅ |

## Entity Completeness

| Importance | Expected | Actual | Coverage |
|------------|----------|--------|----------|
| 核心 | 2 | 2 | 100% |
| 重要 | 15 | 15 | 100% |
| 次要 | 18 | 18 | 100% |
| 龙套 | 29 | 29 | 100% |

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

- Total dialogues: 192
- With speaker: 185
- With listener: 99
- Baseline checked: 7
- Baseline matched: 7

### Dialogue Issues (7)

| Index | Chapter | Speaker | Issue |
|-------|---------|---------|-------|
| 0 | 1 | 张十五 | Speech style mismatch: expected "说书人语气，慷慨激昂", got "说书人口吻，善引诗词典故" |
| 5 | 1 | 曲三 | Speech style mismatch: expected "意味深长，暗含机锋", got "言辞不多，语带沧桑感慨" |
| 24 | 3 | 丘处机 | Speech style mismatch: expected "豪迈果断，一言九鼎", got "言辞激昂，善辩好争，道家装束却性如烈火" |
| 66 | 7 | 黄蓉 | Speech style mismatch: expected "聪明伶俐，古灵精怪", got "口齿伶俐，善于诡辩，说话刁钻有趣" |
| 68 | 7 | 郭靖 | Speech style mismatch: expected "质朴憨厚，直来直去", got "言语质朴，不善辞令，说话直来直去" |
| 137 | 31 | 一灯大师 | Speech style mismatch: expected "感慨万千，唏嘘不已", got "佛门口吻，慈悲平和" |
| 170 | 40 | 欧阳锋 | Speech style mismatch: expected "疯癫失常，反复追问", got "言辞阴沉，语气傲慢，常以冷语威胁" |

## Cross-Book Purity

- Total entities: 121
- Pure entities: 118
- Suspicious: 3

### Suspicious Entities (3)

| ID | Name | Type |
|-----|------|------|
| char_gao_zong_huang_di | 高宗皇帝 | character |
| char_qin_hui | 秦桧 | character |
| char_yue_fei | 岳飞 | character |

## Baseline Validation

- Score: 30%
- Hallucinations: 7
- Duplicates: 0

### Baseline Hallucinations (7)

| Type | ID | Name | Issue |
|------|-----|------|-------|
| character | char_ying_gu | 瑛姑 | Character "瑛姑" not found in original text |
| skill | skill_nan_shan_quan_fa | 南山拳法 | Skill "南山拳法" not found in original text |
| skill | skill_luo_ying_shen_jian_zhang | 落英神剑掌 | Skill "落英神剑掌" not found in original text |
| skill | skill_yu_xiao_jian_fa | 玉箫剑法 | Skill "玉箫剑法" not found in original text |
| item | item_zhu_hong_mang_she_yao_xue | 朱红蟒蛇药血 | Item "朱红蟒蛇药血" not found in original text |
| item | item_zhe_shan | 折扇 | Item "折扇" not found in original text |
| item | item_xiu_hua_xie | 绣花鞋 | Item "绣花鞋" not found in original text |