# 固定样本质量复核

读取 `schemas.md`、`final/reports/quality_sample.json` 中脚本选定的条目，以及每条记录引用的原文章节。只检查这些样本，不自行换样、不补抽、不修数据。

每个样本恰好输出一次：

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

- `name`：原著名称正确。
- `category`：人物、事件、物品、功法、招式、势力、地点或对白类别正确。
- `key_facts`：关键事实未被游戏化改写；不要求覆盖所有长尾细节。
- `chapter`：至少一个引用章节正确；行号和段落不参与通过判断。
- `passed` 必须等于四项检查全部为 `true`；失败时在 `notes` 简述原文差异。
- 禁止修改最终 ID、知识库记录或样本清单，也禁止触发全库清理。

输出 `{ "schema_version": 1, "results": [...] }`，不要附带 JSON 之外的文字。
