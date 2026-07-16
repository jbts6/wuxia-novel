# 设计文档：重构 generate-game-kb 支持4类知识库

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      flow.js (主流程)                        │
├─────────────────────────────────────────────────────────────┤
│  prepare → chapter:NNN → distill:{domain} → assemble → ...  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   characters              skills                items
   (domain-work.js)        (domain-work.js)      (domain-work.js)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    domain-assembly.js
                    (组装 + techniques嵌套)
                              │
                              ▼
                       finalize.js
                    (4类JSON输出)
                              │
                              ▼
                        verify.js
                       (验证4类)
                              │
                              ▼
                        install.js
                       (安装4类)
```

## 数据结构变更

### 实体类别

**Before (9类)**:
- characters, events, items, skills, techniques, factions, locations, dialogues, chapter_summaries

**After (4类)**:
- characters, skills, items, chapter_summaries

### 蒸馏域

**Before (4域)**:
- plot → [characters, events, dialogues]
- martial → [skills, techniques]
- items → [items]
- world → [factions, locations]

**After (3域)**:
- characters → [characters]
- skills → [skills]
- items → [items]

### skills 结构

```json
{
  "id": "skill_xxx",
  "name": "降龙十八掌",
  "type": "掌法",
  "power_rank": "登峰造极",
  "holders": ["char_qiaofeng", "char_guojing"],
  "techniques": [
    {
      "name": "亢龙有悔",
      "type": "招式",
      "description": "..."
    },
    {
      "name": "飞龙在天",
      "type": "招式",
      "description": "..."
    }
  ]
}
```

## 文件修改清单

### 核心库文件

| 文件 | 变更 |
|------|------|
| `book-contract.js` | ENTITY_CATEGORIES = ['characters', 'skills', 'items'] |
| `domain-work.js` | DOMAIN_DEFINITIONS, DOMAIN_PATCH_FIELDS 更新 |
| `domain-assembly.js` | 移除 events/dialogues/factions/locations 处理 |
| `finalize.js` | CATEGORY_FILES 只输出 4 个文件 |
| `verify.js` | 移除 events/dialogues/factions/locations 验证 |
| `install.js` | DATA_FILES 自动适配 |
| `flow.js` | 移除 plot/world 相关命令 |

### 已更新文件

- `SKILL.md` - 主流程文档
- `schemas.md` - 数据契约
- `prompts/extract-chapters.md` - 章节提取提示词
- `prompts/distill-domain.md` - 域蒸馏提示词
- `prompts/sample-quality.md` - 质量采样提示词
- `scripts/yaml2json.js` - YAML→JSON 转换器

## 兼容性

- 当前书剑恩仇录数据可继续使用（skills.techniques 为空数组）
- chapter_summaries 从章节内容生成，不再依赖 events

## 风险

1. techniques 嵌套可能增加 skills 蒸馏复杂度
2. chapter_summaries 生成逻辑需要调整（不再从 events 投影）
3. 现有测试可能需要更新
