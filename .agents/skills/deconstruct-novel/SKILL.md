---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 核心原则：逐章精读

**禁止以下行为：**
- ❌ 使用 shell/python 脚本批量读取或处理章节文件
- ❌ 使用 `head`、`tail`、`wc`、`grep` 等命令限制读取范围
- ❌ 用 `ctx_execute` 或 `ctx_execute_file` 批量处理章节
- ❌ 跳过任何章节（即使是"不重要的章节"）
- ❌ 假设后续章节内容与前文重复而跳过
- ❌ Read 时使用 `limit` 或 `offset` 参数截断章节内容（必须读全文）
- ❌ 分批次读取同一章节（如先读200行再用offset继续）— 这是偷懒行为，必须禁止

**必须执行：**
- ✅ 用 Read 工具**逐个**读取每一个 `ch_*.md` 文件
- ✅ Read 调用**只传 filePath 一个参数**，不传 limit、不传 offset
- ✅ Read 默认返回前2000行，排版章节几乎不会超过此限制，**一次调用即可读完整章**
- ✅ 如果章节确实超过2000行（极罕见），才允许用 offset 继续读取，但必须在读取前说明原因
- ✅ 读完一章后再读下一章，**每章完整读全文一次**
- ✅ 读完全部章节后，再开始提取和写入 JSON
- ✅ 确保每个实体都从原文中找到准确的 source_ref

## 工作流

### 阶段一：全量阅读（不可跳过）

1. 确认 `<小说目录>/ch_formatted/` 目录存在
2. 用 `rtk ls` 或 Glob 列出所有 `ch_*.md`，确认完整文件列表
3. **逐章用 Read 工具读取**，每章读全文（不要用 offset/limit 截断）：
   ```
   Read("ch_formatted/ch_001.md")
   → 理解全部内容，记住人物、武功、事件
   Read("ch_formatted/ch_002.md")
   → 继续积累，注意新出现的实体
   ...依次直到最后一章
   ```
4. 阅读过程中**在脑中建立全局视图**：谁会什么武功、谁属于哪个势力、各事件的因果链

### 阶段二：提取与写入

5. 基于全量阅读的理解，一次性提取全部实体
6. 按 `schemas.md` 中的 Schema 写入 8 个 JSON 文件：
   - `characters.json` · `skills.json` · `techniques.json` · `factions.json`
   - `locations.json` · `items.json` · `events.json` · `dialogues.json`

### 阶段三：交叉验证

7. 检查：每个实体的 source_refs 指向真实存在的章节
8. 检查：角色关系、技能归属等交叉引用一致
9. 检查：后文提到的实体（如某角色后期习得新武功）已更新

---

## 参考文件

执行本 skill 时必须阅读以下文件，获取完整规则：

| 文件 | 内容 |
|------|------|
| `constants.md` | ID 规则、等级体系、关系类型 |
| `schemas.md` | 8 个 JSON 的完整 Schema 定义 |
| `dialogue-rules.md` | speaker 提取的 4 条判断规则、误判排除、示例 |

---

## 自检清单

- 所有 ID 都是小写拼音+下划线（例：`char_li_xun_huan`、`loc_yang_zhou`、`skill_li_fei_dao`）
- 角色 personality.traits ≥ 5 项，speech_style 和 temperament 非空
- 角色 relationships 字段完整（target, type, intensity, bond_level, dynamic）
- 技能 techniques ≥ 2 个招式
- 技能 progression 包含功力层级
- 物品 description ≥ 20 字
- 事件 description ≥ 20 字
- 对话 speaker 是角色 ID，speaker_name 是**真实姓名**（非"他笑着"等动作描写）
- relationships 无重复 (target+type)
- events id 格式为 evt_N_序号
- **每个实体的 source_refs 章节号在 1~总章数 范围内**
- **没有遗漏任何章节中出现的实体**
