# 游戏素材短引用选择

完整读取 `schemas.md` 的“通用规则”和“游戏素材选择草稿示例”，然后只读取主模型分配的 `clean:materials:001` AI 可见 `input.json`。该工作项只在所有实体类别清理并完成确定性存活投影后创建。

输入边界只有 `schemas.md`、本提示词、紧凑 surviving entity catalog 和唯一 run-scoped staging 输出路径。不得读取 CTX/context-mode、检索摘要、根目录 `data/`、其他 run、私有 bindings、完整实体记录或最终 ID。`candidate_key`、`local_key`、最终 `id`、`source_category` 与 `source_name` 的展开均由脚本私下维护；草稿只选择 catalog 短引用。

只输出一个纯 JSON 对象：

```json
{
  "schema_version": 1,
  "stage": "material_decision",
  "unit": "clean:materials:001",
  "materials": [
    {
      "material_type": "战斗系统原型",
      "source_ref": "m0001",
      "relevance": "高",
      "suggested_use": "内功系统原型",
      "reason": "原著明确命名。"
    }
  ]
}
```

- `source_ref` 必须来自 `catalog[*].entity_ref`；不得引用已删除实体、未知短引用或自行写名称。
- 同一 `material_type + source_ref` 组合最多一次。五类 material_type 为：`战斗系统原型`、`经典剧情桥段`、`角色原型/彩蛋`、`标志性物品`、`门派与世界观素材`。
- `relevance`、`suggested_use`、`reason` 必须是非空字符串；不得嵌入或改写事实记录。
- 允许某种素材没有候选；不要为凑齐数量选择低价值或无依据实体。

把 JSON 写到主模型指定的 staging 路径。不要调用 `accept`；结束时只返回草稿路径和简短状态。
