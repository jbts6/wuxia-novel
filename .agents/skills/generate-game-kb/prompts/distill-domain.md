# 四域联合蒸馏提示词

你只处理输入工作项指定的一个领域。完整读取 `schemas.md`、本提示词和唯一 `input.json`；只把 JSON 草稿写到主模型分配的 staging 路径，不调用 `accept`，不修改其他文件。

## 输入领域

- `plot`：`characters`、`events`、`dialogues`；新 run 的 `dialogues` 默认没有条目，仅兼容旧输入。
- `martial`：`skills`、`techniques`。
- `items`：`items`。
- `world`：`factions`、`locations`。

输入包含 `unit`、`input_hash`、`semantic_contract_version`、`entries`、`pending`、`allowed_patch_fields` 和引用摘要。每个 `entry_ref` 必须在 `decisions` 中恰好出现一次。

## 输出合同

```json
{
  "schema_version": 1,
  "semantic_contract_version": 3,
  "unit": "distill:martial",
  "input_hash": "sha256:input",
  "decisions": [
    {
      "entry_ref": "martial:001",
      "action": "keep",
      "patch": {
        "description": "原文支持的简述",
        "power_rank": "炉火纯青"
      }
    }
  ],
  "notes": []
}
```

action 只允许：

- `keep`：保留一项，只在 `patch` 写 `allowed_patch_fields`。
- `merge`：合并到同类别 `target_ref`，可附合法 `patch`。
- `reject`：使用 `schemas.md` 的有限 `reason`，并写非空 `detail`。
- `pending`：只表示必须语义补救的未决项，写非空 `detail`；提交会以 `DOMAIN_PENDING_UNRESOLVED` 拒绝且不写 accepted artifact，不得为通过校验而删除。

禁止输出或复制 `candidate_key`、`local_key`、`registry_key`、member refs、private bindings/私有 bindings、完整候选 ledger 或最终 ID。不得读取 CTX/context-mode、检索摘要、旧 `data/`、其他领域输入或外部资料。

## 领域判断

- plot：身份合并要同步考虑事件参与者；事件保留冲突、奇遇、传承、反转和关系转折；旧输入中的普通对白用 `ordinary_dialogue` 拒绝。
- martial：原文明确定名的武功和招式优先保留；招式必须有 `named_in_source: true`。原文明示所属武功时填写同输入中的 `source_skill_ref`；原文未说明所属或归属时独立 `keep` 并省略该字段，最终允许 `source_skill: null`。不得猜测或虚构所属武功；普通动作使用 `ordinary_action` 或 `unnamed_action` 拒绝。
- items：只保留秘籍、剧情关键、高级药毒、神兵利器、其他稀有特殊；普通器具、普通兵器和布景用 `ordinary_item` 拒绝。
- world：保证身份、证据和引用正确；边缘势力和次要地点完整度不足不需要补数。

人物和武功的 keep 补丁必须写全书证据支持的巅峰 `power_rank`，覆盖逐章暂定值。八级从低到高只能是：平平无奇、初窥门径、略有小成、登堂入室、炉火纯青、出神入化、登峰造极、返璞归真。plot 为人物定级，martial 为武功定级，不增加其他工作项。

不得静默截断、拆成逐类别循环或生成 `chapter_summaries`。格式问题只做格式修正；语义问题只按持久化错误做一次语义补救。
