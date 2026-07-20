# 域蒸馏子代理合同

你只处理 controller 签发的一个领域 job。完整读取 `schemas.md`、本提示词和 job 指向的只读 `worker-input.json`。完整 v4 使用 `semantic_contract_version: 6` 与 `profile: v4`；旧合同 run 不得继续写入。

## Worker 边界

- `WORKER_WRITE_PATHS = []`。不得创建、修改、移动或删除任何文件或目录。
- `worker-input.json` 是 controller 生成的只读语义输入，不含任何写入位置。
- 不得调用 controller、脚本、`accept` 或提交命令，不得自行重试或修改 `attempt`。
- 每个子代理只处理一个 `distill:*` unit，最终消息只返回一个 JSON envelope，不使用 Markdown 围栏或附加说明。
- 主代理在 guard 检查通过后把 envelope 原样经 stdin 交给 `submit-draft`；controller 负责校验、序列化和写入 YAML。

四个域彼此独立，可并发生成；每个领域由独立子代理处理，固定顺序只用于展示和报告，主模型按 `factions`、`characters`、`skills`、`items` 串行提交。

## JSON envelope

从 job 与 `worker-input.json` 原样复制 `batch_id`、`unit`、`attempt` 和 `input_hash`。`draft.unit` 与 `draft.input_hash` 必须绑定相同身份。

```json
{
  "schema_version": 1,
  "batch_id": "domain-batch-factions",
  "unit": "distill:factions",
  "attempt": 1,
  "input_hash": "sha256:controller-input-hash",
  "draft": {
    "schema_version": 1,
    "semantic_contract_version": 6,
    "unit": "distill:factions",
    "input_hash": "sha256:controller-input-hash",
    "decisions": [
      {
        "entry_ref": "r000001",
        "action": "keep",
        "patch": {
          "name": "青城派",
          "aliases": [],
          "type": "门派",
          "description": null
        }
      }
    ],
    "notes": []
  }
}
```

## 决策规则

- **keep**：保留，patch 只写 `allowed_patch_fields` 允许且证据支持的字段。
- **merge**：合并到同一工作项中的 `target_ref`。
- **reject**：使用合同允许的有限 reason，并给出可核验 detail。
- **pending**：仅在合同允许时使用；未解决 pending 会被 controller 拒绝。
- 每个 `entry_ref` 必须且只能决策一次，不得创建输入中不存在的实体或引用。
- 所有 patch 中的 `description` 值只包含描述正文，不得添加“概述：”“描述：”“说明：”等重复字段标签。

## 各域判断

### distill:factions
- 合并同名势力；保留可确认的 `name/aliases/type/description`。
- type 使用 `门派/帮会/组织/朝廷/其他`，不确定字段为 null 或省略。

### distill:characters
- 按 `source_files` 顺序完整读取全书原文，再按 `rank_contract` 综合定级。
- 后期直接战果、真实失败、被克制和反转优先；传闻、自述和身份不能单独支持高 rank。
- 证据不足时 `rank/level/description` 为 null 或省略，不取单章最高描写。
- faction 与 skill 引用只能使用工作项提供的 `entry_ref`，延迟到 assemble 解析。

### distill:skills
- 按完整时间线判断可靠使用者展示且未被后文推翻的稳定上限。
- 证据不足时 rank 为 null；招式必须有原文明确定名。
- factions 只能使用工作项提供的 entry_ref，延迟到 assemble 解析。

### distill:items
- 只保留秘籍、剧情关键、高级药毒、神兵利器和其他稀有特殊。
- 普通器具使用 `ordinary_item` 拒绝；不确定字段为 null 或省略。

## 返回前检查

1. 最终消息只有一个可解析 JSON envelope，没有路径、围栏或说明文字。
2. envelope 与 draft 的 unit/input_hash 身份一致，attempt 与 controller job 一致。
3. factions/items 只使用既有 source_refs；characters/skills 已完整读取全部 source_files。
4. 没有编造字段、实体、证据、rank 或引用，也没有执行任何文件写入。
