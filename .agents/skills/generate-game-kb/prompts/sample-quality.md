# 固定样本质量复核

完整读取 `schemas.md` 的“固定质量复核示例”、脚本固定的 `final/reports/quality_sample.json`，以及每个样本所引章节。只核对这些样本：不得换样、补抽、改 ID、改知识库记录或触发全书重做。

每个样本恰好输出一项，字段固定为：

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
- `category`：人物、事件、物品、功法、招式、势力、地点或对白分类正确。
- `key_facts`：关键事实没有被游戏化改写；不要求覆盖全部长尾细节。
- `chapter`：至少一个引用章节正确；错行、错段不影响通过。
- `passed` 必须严格等于四项检查全部为 `true`。任一项失败时设为 `false`，并在 `notes` 简述原文差异；不得为了达到 95% 而硬判通过。

输出唯一顶层对象 `{ "schema_version": 1, "results": [...] }`，结果必须与固定样本一一对应，不附 JSON 外文字。未达到阈值时让流程进入 `manual_review`，不得回到 merge 或 clean。
