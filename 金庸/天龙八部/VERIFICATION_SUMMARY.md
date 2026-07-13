# 天龙八部知识库验证摘要

## 验证时间
2026-07-13

## 数据规模

| 类别 | 数量 |
|---|---:|
| characters | 105 |
| factions | 28 |
| locations | 61 |
| skills | 28 |
| techniques | 58 |
| items | 63 |
| dialogues | 151 |
| chapter_summaries | 50 |
| events | 398 |

## 门禁状态

- G1 (Source Coverage): PASS
- G2 (Ledger Closure): PASS
- G3 (Evidence Integrity): PASS
- G4 (Recall Evidence): PASS
- G5 (Semantic Coverage): PASS
- completion_gate_passed: true
- review_readiness: ready_for_human_review

## 验证结果

### 1. 角色召回
- 核心/重要角色: 75
- 有对话的角色: 32
- 有豁免的角色: 47
- 覆盖率: 100%

### 2. 对话 Speaker
- 总对话数: 151
- 有真实 speaker: 151
- speaker 为"未知": 0

### 3. Persona 豁免
- 有对话角色的豁免: 0
- 无对话角色的豁免: 47

### 4. Field Source Refs
- 语义独立性检查: 通过
- 机械复用: 仅限单源角色

### 5. Skill/Technique/Item 分类
- Skill: 28 (正确分类)
- Technique: 58 (正确分类)
- Item: 63 (已移除幻觉物品)

### 6. Hash 一致性
- final_data_validation hash: f2de1553d4b4ac47...
- cross_validation hash: f2de1553d4b4ac47...
- 一致性: PASS

### 7. 扫描覆盖
- 窗口数: 224
- 三类扫描: 224/224
- 实际输出证据: 存在

## 待人工审核
- 4 个高风险裁决
- 详见 reports/review_packet.md

## 验证报告
- reports/quality_report.json
- reports/review_packet.json
- reports/verification_result.json
- reports/cross_validation_report.json
- reports/inventory_validation.json
- reports/final_data_validation.json
