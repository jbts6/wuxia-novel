# factions.json 预清洗报告

## 汇总

| 项 | 数量 |
|----|------|
| 原始记录 | 63 |
| 输出记录 | 62 |
| 修改记录 | 3 |
| 删除记录 | 1 |
| 待复核 | 0 |

## 自动修改

| id | 字段 | 原值 | 新值 | 规则 |
|----|------|------|------|------|
| faction_xing_xiu_pai | * | 星宿派 | [merged into faction_xing_su_pai] | faction_dedup |
| faction_zhi_guan_chan_si | location | loc_zhi_guan_chan_si | 止观禅寺 | location_id_to_name |
| faction_xing_su_pai | location |  | null | null_normalize |

