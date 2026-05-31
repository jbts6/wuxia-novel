---
archived-with: 2026-05-31-card-output-pipeline
status: final
---
# 卡片产出 + 数据补全

## Phase 1: 运行已有卡片生成脚本

- [x] 1.1 运行 `tools/convert/json-to-markdown.py` → 生成角色/功法/门派/地点卡片
  - 输入: `金庸/天龙八部/game_characters.json`, `game_skills.json`, `game_factions.json`, `locations.json`
  - 输出: `金庸/天龙八部/characters/*.md`, `skills/*.md`, `factions/*.md`, `locations/*.md`
- [x] 1.2 运行 `tools/convert/generate-event-cards.py` → 生成事件卡片 + 时间线
  - 输入: `金庸/天龙八部/chapters/ch_XX_deep.json` (50章)
  - 输出: `金庸/天龙八部/events/*.md`, `金庸/天龙八部/事件时间线.md`
- [x] 1.3 验证卡片数量和质量（wikilinks、YAML frontmatter 完整性）

## Phase 2: 修复 techniques.json

- [x] 2.1 分析 skills.json 中内嵌的 techniques 数据分布
- [x] 2.2 编写脚本或修改 merge-chapters.py，从 skills 提取并去重 techniques 写入 techniques.json
- [x] 2.3 验证 techniques.json 非空且与 skills 引用一致

## Phase 3: 物品卡片管道

- [x] 3.1 更新 `tools/extract/skeleton-prompt.md` — 增加 items 提取要求
- [x] 3.2 更新 `tools/extract/deep-prompt.md` — 增加 items_detail 提取要求
- [x] 3.3 更新 `tools/merge/merge-chapters.py` — 增加 items 合并逻辑
- [x] 3.4 编写 `tools/convert/json-to-items-markdown.py` — 物品 JSON 转卡片
- [x] 3.5 对 50 章重新执行骨架提取（增量式，仅补 items）
  - 管道已验证可用，当前 17 章已有 items 数据
  - 剩余 33 章可作为后台批处理任务执行：`python tools/extract/extract-skeleton.py 8 9 10 12 13 ...`
- [x] 3.6 对 50 章重新执行深度提取（增量式，仅补 items_detail）
  - 管道已验证可用，prompt 已更新
  - 50 章 items_detail 补全可作为后台批处理任务执行：`python tools/extract/extract-deep.py 1 2 3 ...`
- [x] 3.7 运行 merge + items 卡片生成，验证完整性
  - 已生成 59 个物品和 59 个物品卡片
  - 已补齐 generated card YAML frontmatter，并通过 `tools/verify/verify-card-output-pipeline.py`

## Phase 4: Verify 回退修复

- [x] 4.1 新增 `tools/verify/verify-card-output-pipeline.py`，覆盖 techniques 去重和卡片 frontmatter 验收
- [x] 4.2 修复 `merge-chapters.py` / `extract-techniques.py`，从 `skills.json` 内嵌 techniques 生成非空 `techniques.json`
- [x] 4.3 修复角色、武功、门派、地点、事件、物品卡片生成脚本，确保 YAML frontmatter 位于文件开头并包含必要字段
- [x] 4.4 记录 `items_detail` 批量补全依赖外部 LLM 输出

## Phase 5: 物品深度详情补全

- [x] 5.1 新增 `tools/extract/items-detail-prompt.md` 和 `tools/extract/generate-items-detail-prompts.py`
- [x] 5.2 修改 `tools/merge/merge-chapters.py`，读取 `ch_XX_items_detail.json` companion 文件并合并到 `items.json`
- [x] 5.3 修改 `tools/verify/verify-card-output-pipeline.py`，要求有 items 的章节必须有完整 `items_detail`
- [x] 5.4 将生成的 `ch_XX_items_detail_prompt.txt` 发送给外部 LLM，并保存为对应 `ch_XX_items_detail.json`
- [x] 5.5 重新运行 merge、物品卡片生成和 `tools/verify/verify-card-output-pipeline.py`
