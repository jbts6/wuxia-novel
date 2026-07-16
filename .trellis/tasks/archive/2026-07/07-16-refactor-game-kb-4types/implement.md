# 执行计划：重构 generate-game-kb 支持4类知识库

## 步骤

### Phase 1: 核心数据结构 [高优先级]

- [x] 1.1 修改 `book-contract.js`
  - ENTITY_CATEGORIES = ['characters', 'skills', 'items']
  - BOOK_CATEGORIES = [...ENTITY_CATEGORIES, 'chapter_summaries']
  - 移除 events/dialogues/factions/locations 验证
  - 添加 skills.techniques 验证

- [x] 1.2 修改 `domain-work.js`
  - DOMAIN_DEFINITIONS: {characters, skills, items}
  - DOMAIN_PATCH_FIELDS 更新
  - quality_tier 统一为 'hard'

- [x] 1.3 修改 `domain-assembly.js`
  - 移除 events/dialogues/factions/locations 处理
  - 更新 projectChapterSummaries 不依赖 events
  - 确保 skills 有 techniques 数组

### Phase 2: 输出与验证 [中优先级]

- [x] 2.1 修改 `finalize.js`
  - CATEGORY_FILES = {characters, skills, items, chapter_summaries}
  - 移除 events/dialogues/factions/locations 投影
  - 更新 resolveReferences 逻辑

- [x] 2.2 修改 `verify.js`
  - FILE_PREFIX 更新
  - 移除 events/dialogues/factions/locations 验证
  - 添加 skills.techniques 验证

- [x] 2.3 修改 `install.js`
  - DATA_FILES 自动从 CATEGORY_FILES 获取（无需手动修改）

### Phase 3: 流程与命令 [低优先级]

- [x] 3.1 修改 `flow.js`
  - 移除 check-coverage 中 events/dialogues 相关逻辑
  - 移除 check-resolution 中 events 相关逻辑
  - 简化 build-final 逻辑

### Phase 4: 验证

- [x] 4.1 运行测试
  - 项目无测试脚本

- [x] 4.2 手动验证
  - 验证安装的数据结构正确
  - characters.json, skills.json, items.json 存在
  - skills.json 有 techniques 数组

## 验证命令

```bash
# 运行测试
npm test

# 检查特定测试
npm test -- --grep "book-contract"
npm test -- --grep "domain-work"
npm test -- --grep "finalize"

# 验证安装的数据
node .agents/skills/generate-game-kb/scripts/flow.js verify 金庸/书剑恩仇录 --installed
```

## 回滚点

- 每个文件修改前备份
- 如果测试失败，回滚该文件
- 如果整体不兼容，回滚所有修改

## 依赖关系

```
book-contract.js ← domain-work.js ← domain-assembly.js
                                    ← finalize.js
                                    ← verify.js
                                    ← install.js
                                    ← flow.js
```

按依赖顺序修改，每步验证。
