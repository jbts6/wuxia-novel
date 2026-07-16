# 重构 generate-game-kb 支持4类知识库

## Goal

将 generate-game-kb skill 从 9 种实体类型精简为 4 类，降低构建复杂度和时间。

## Requirements

### 核心变更

1. **实体类型**：9 → 4
   - characters（人物）
   - skills（武功，含 techniques 嵌套数组）
   - items（关键物品、武器装备）
   - chapter_summaries（章节摘要）

2. **蒸馏域**：4 → 3
   - characters
   - skills
   - items

3. **AI 输出格式**：JSON → YAML（用 yaml2json.js 转换）

4. **移除内容**
   - events/dialogues → 移至单独 skill
   - factions/locations → 移除
   - techniques 独立实体 → 合并为 skills.techniques

### 约束

- 所有中间产物路径固定在书籍目录内
- 记录每个环节耗时
- 目标构建时间 < 45 分钟

## Acceptance Criteria

- [ ] `book-contract.js` ENTITY_CATEGORIES = ['characters', 'skills', 'items']
- [ ] `domain-work.js` DOMAIN_DEFINITIONS = {characters, skills, items}
- [ ] `domain-assembly.js` 处理 skills 嵌套 techniques
- [ ] `finalize.js` CATEGORY_FILES 只输出 4 个文件
- [ ] `verify.js` 验证 4 类实体
- [ ] `install.js` 安装 4 类数据
- [ ] flow.js 移除 plot/world 相关命令

## Notes

- 提示词模板已更新（SKILL.md, schemas.md, extract-chapters.md 等）
- yaml2json.js 已创建
- 当前书剑恩仇录数据：characters 111, skills 65, items 51
