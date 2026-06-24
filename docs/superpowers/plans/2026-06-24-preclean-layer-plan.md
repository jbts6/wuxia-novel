# 预清洗层实现计划

日期：2026-06-24
设计文档：`docs/superpowers/specs/2026-06-23-wuxia-preclean-layer-design.md`

## 任务清单

- [x] 1. 创建共享 sanitizer 模块 `scripts/preclean/sanitizer.js`
  - 通用规则：字符串清理、空值规整、ID 格式化、精确去重
  - 文件类型路由：characters / dialogues / locations / factions / items / skills / techniques
  - 报告生成：JSON + Markdown
  - Pending 输出
  - Archive 管理（raw / preclean / reports）

- [x] 2. 实现 characters 预清洗规则
  - 合并同 id 重复角色，数组字段取并集
  - 规范 role 枚举（核心/重要/次要/龙套/背景）
  - 修复 relationships.target 引用
  - 空值规整

- [x] 3. 实现 dialogues 预清洗规则
  - 删除空 text
  - 删除 text≤2 感叹词
  - tone 枚举归一（12 种标准值）
  - speaker_name 唯一匹配时修复 speaker ID

- [x] 4. 实现 locations 预清洗规则
  - region 按明确关键词映射到标准大区
  - one_line 空值补全（从 source_refs 提取）

- [x] 5. 实现 factions 预清洗规则
  - type 按明确映射表归一（8 种标准类型）
  - name+location 完全相同的势力合并
  - location ID 残留修复

- [x] 6. 实现 items 预清洗规则
  - type 通过 TYPE_MAP 归一（11 种标准类型）
  - `rarity_tier: "未知"` → `寻常凡品`
  - 同 type+同 name 重复道具合并
  - 英文类型映射

- [x] 7. 实现 skills+techniques 预清洗规则
  - technique.type 按 TYPE_MAP 归一（13 种标准类型）
  - source_skill 指向已合并 skill ID 时同步重写
  - 同 id 或同 name+同 source_skill 的 technique 合并
  - orphan technique 补 source_skill（name 完全匹配唯一 skill 时）

- [x] 8. 更新 distill-characters SKILL.md — 加入 Phase 0
- [x] 9. 更新 distill-items SKILL.md — 加入 Phase 0
- [x] 10. 更新 distill-dialogues-locations-factions SKILL.md — 加入 Phase 0
- [x] 11. 更新 distill-skills-and-techniques SKILL.md — 加入 Phase 0

- [x] 12. 在天龙八部上运行验证
  - 执行 preclean
  - 检查 archive 布局
  - 检查报告内容
  - 检查 idempotent（二次运行无新变化）
