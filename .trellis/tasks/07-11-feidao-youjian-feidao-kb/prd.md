# generate-kb: 飞刀，又见飞刀

## Goal

为古龙《飞刀，又见飞刀》构建高质量武侠知识库（8 个核心 JSON + 校验报告 + summary.md），综合质量分数 ≥ 95%，且全部单项门槛达标。

## Scope

- **小说目录**：`古龙/飞刀，又见飞刀/`
- **原文**：`古龙/飞刀，又见飞刀/飞刀，又见飞刀.txt`（已存在）
- **技能**：`.agents/skills/generate-kb`（LLM 先验 + 原文定位校验）
- **参考完成样例**：`金庸/书剑恩仇录` 等已完成 KB（schema/目录结构对齐）

## Requirements

1. 仅基于本书原文与 LLM 对本书的先验知识生成，禁止串书实体（Cross-Book Purity = 100%）。
2. 产出 8 个核心数据文件：`characters` / `factions` / `locations` / `skills` / `techniques` / `items` / `dialogues` / `chapter_summaries`。
3. 每个实体必须有可定位的 `source_refs`（locate 后 primary 可用）。
4. dialogues 必须从原文提取（禁止凭记忆编造），经 `locate-dialogues.js` 精确定位，幻觉条目删除。
5. items 必须含 `tags` 与合理 `rarity_tier`（不能全为「未知」）。
6. 实体审核采用「广撒网 → 精挑选」（见 skill `review.md`）。
7. ID、schema、枚举遵循 `schemas.md` / `constants.md`。
8. 生成阶段优先使用长上下文模型（≥ 1M tokens，若环境可用）。

## Constraints

- 原文 txt 必须始终存在；不得删除或覆盖原文。
- 中间产物可写在 `build/`、`ch_split/`、`prompts/`、`review/`、`reports/`。
- 单项指标任一门槛不达标则修复后重跑，不得仅凭综合分放行。
- 同一操作最多重试 3 次；超过则报告状态并求决策。

## Acceptance Criteria

- [ ] `data/` 下 8 个 JSON 均可解析且 schema 合法
- [ ] Entity Completeness = 100%（相对 outline 锁定清单）
- [ ] Relationship Completeness = 100%
- [ ] Relationship Accuracy = 100%
- [ ] Description Accuracy ≥ 70%
- [ ] Event Coverage = 100%
- [ ] Dialogue Authenticity = 100%
- [ ] Cross-Book Purity = 100%
- [ ] 综合质量分数 ≥ 95%
- [ ] `verify` / `cross-validate` / `check-skill-items` 无 blocking errors（errors = 0）
- [ ] 存在 `summary.md` 与 `reports/` 质量/校验报告
- [ ] locate 率 ≥ 95%（或经修复后达标）

## Out of Scope

- 其他古龙作品 KB
- 前端展示、检索服务、RAG 索引接入
- 修改 generate-kb 技能本身（除非发现阻塞 bug 并单独说明）

## Notes

- 当前仓库古龙侧尚无完成样例；以金庸已完成 KB 为结构参考。
- 用户已同意创建 Trellis 任务；实现须在 `task.py start` 与产物评审通过后开始。
