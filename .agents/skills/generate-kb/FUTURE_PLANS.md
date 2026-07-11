# generate-kb 后续计划

已落地能力见 `pipeline.md` / `scripts/`。此处只列**未做或可选**项。

## 已完成（勿重复立项）

- 多候选 locate、event_type 入 prompt、dialogues 读原文  
- cross-validate / coverage-gap / outline / 对抗审阅 Phase1  
- 双轨 assess（gold + honest）、自指 baseline 检测  
- namesMatch 短词保护、importance 中英映射、locate-dialogues 兼容 quote  

## 待做 / 可选

| ID | 项 | 说明 |
|----|----|------|
| D | 推广到梁/黄代表作 | 检查清单见下 |
| J | anchor 质量分级 | 生成后对 anchor 打分，低分重写（≥2 实体、具体动词、20–50 字） |
| I2 | 多 reviewer prompt | 跨书 / 文风 / 时代分视角（成本×3） |
| I3 | 异模型审阅 | 生成与审阅不同模型（高成本） |
| Q | 长书 skills 门槛 | 区分 named vs generic，quantity 只计具名 |
| R | source_ref 章节自动修正 | 正式 `fix-chapter-refs.js`（现可临时代码） |

## 推广检查清单（方向 D）

- [ ] 原文 txt + 可 split 的回/章标题  
- [ ] 作者在四大家/名家范围内  
- [ ] 跑通 1.7 独立 baseline 契约  
- [ ] completion_gate PASS  

## 明确不做

- climax 细分子类型  
- 二次 LLM 给 locate 候选打分  
- 为刷分把 baseline 做成 data 镜像  
