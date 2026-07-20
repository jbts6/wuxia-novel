---
name: generate-game-kb-deep-items-cn
description: Use when a Chinese reference is needed for explicit full-book item enrichment after a published Lite base.
---

# deep items 中文参考

这是用户主动触发、非阻塞的 Lite 增强。前提是 Lite 已发布、归档并通过安装验证；基础发布不会自动执行或等待它。已发布 run、当前安装数据、accepted 证据和 candidate registry 都是不可变输入。

## 目标与边界

完整读取 `input_path` 指向的任务输入、accepted 物品证据和当前 `items.yaml`。只保留原文支持且明确命名、稀有或剧情关键的物品；`type` 必须使用完整枚举 `武器/防具/秘籍/丹药/暗器/坐骑/异兽/饰品/其他`，覆盖秘籍、武器、防具、药物、暗器、坐骑、异兽、饰品及其他有名稀有物品。合并别名和重复项，仅完善 `aliases/type/description`。只能操作已知物品 registry key；不得把普通器具或景物升级为物品记录，也不得新增物品、source_refs 或跨类别引用。

## 合并策略

`aliases` 按首次确认顺序并集去重。`type` 或 `description` 出现冲突时，在 accepted 证据裁定前保持 null 或当前值，不得猜测、拼接或任意覆盖。

## 控制器命令

先创建任务：

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-add "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --type items-deep --scope items --requested-by user --json
```

controller 会返回本次生成的 ID、哈希和绝对路径。下面是实际返回结构示例；实跑时必须复制当次返回值，不得照抄或猜测：

```json
{
  "task_id": "items-deep-1763424000000-c3d4e5f6",
  "type": "items-deep",
  "scope": "items",
  "requested_by": "user",
  "base_manifest_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  "base_data_hash": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  "status": "pending",
  "created_at": "2026-07-18T08:00:00.000Z",
  "staging_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\items-deep-1763424000000-c3d4e5f6\\overlay.yaml",
  "input_path": "C:\\git\\wuxia-novel\\古龙\\剑神一笑\\.game-kb-work\\deferred\\run-jian-shen-yi-xiao\\tasks\\items-deep-1763424000000-c3d4e5f6\\input.json"
}
```

读取 `input_path`，只把 overlay YAML 写到 `staging_path`。原样复用上面的 `task_id` 和路径；`task-run` 返回 `status: ready` 后会保留 `staging_path/draft_path` 并新增冻结后的 `overlay_path`，用户才可明确执行 apply：

```text
node .agents/skills/generate-game-kb/scripts/flow.js task-run "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id items-deep-1763424000000-c3d4e5f6 --draft "C:\git\wuxia-novel\古龙\剑神一笑\.game-kb-work\deferred\run-jian-shen-yi-xiao\tasks\items-deep-1763424000000-c3d4e5f6\overlay.yaml" --json
node .agents/skills/generate-game-kb/scripts/flow.js task-apply "C:\git\wuxia-novel\古龙\剑神一笑" --run run-jian-shen-yi-xiao --task-id items-deep-1763424000000-c3d4e5f6 --json
```

## YAML overlay 与安装

overlay 必须绑定上面返回的 `base_manifest_hash` 和 `base_data_hash`，按 `registry_key` 排序，只允许 `keep`、`merge`、`drop` 或受限 `patch`。不得包含 source_refs、证据文本、正式 ID、未知 key、普通物件或无效字段。stale base、无效 merge、重复操作或无证据字段必须失败，并基于当前安装 revision 重新创建任务。

`task-apply` 从当前安装的五个 YAML 开始，在临时副本上合并并验证引用闭包，先备份当前 `<novel>/data/`，再原子安装新 revision 供 Dashboard 读取。最终文件固定为 `characters.yaml`、`skills.yaml`、`items.yaml`、`factions.yaml`、`chapter_summaries.yaml`。每次成功创建不同的可恢复备份，并写 `revision-receipt.json`，绑定 `task_id`、操作、基础 manifest 哈希、旧 data 哈希、备份哈希、新哈希、备份路径和 revision 路径。后续 overlay 从当前安装哈希继续；归档证据不可修改。
