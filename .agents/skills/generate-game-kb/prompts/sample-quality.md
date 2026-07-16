# 固定样本质量复核（精简版）

完整读取 `schemas.md`、脚本固定的 `final/reports/quality_sample.json`，以及每个样本所引章节。

## 样本配额

- 人物：5
- 武功/招式：5
- 物品：3
- 章节摘要：2

总计 15 个样本（原 36 个精简为 15 个）。

## 检查项

每个样本输出：

```json
{
  "id": "脚本给出的稳定 ID",
  "passed": true,
  "checks": {
    "name": true,
    "category": true,
    "key_facts": true,
    "chapter": true
  },
  "notes": ""
}
```

- **name**：原著名称正确
- **category**：分类正确
- **key_facts**：关键事实没有被游戏化改写
- **chapter**：至少一个引用章节正确
- **passed**：四项检查全部为 true 时才为 true

## 输出格式

```json
{
  "schema_version": 1,
  "results": [
    {
      "id": "char_jia",
      "passed": true,
      "checks": {"name": true, "category": true, "key_facts": true, "chapter": true},
      "notes": ""
    }
  ]
}
```

## 注意事项

1. 只检查固定样本，不得换样、补抽
2. 不得修改知识库记录
3. 合法为空时核对 none_found 复核
4. 未达到 95% 阈值时进入 manual_review
