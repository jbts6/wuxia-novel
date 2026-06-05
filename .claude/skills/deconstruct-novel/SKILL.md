---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 核心原则

### 逐章精读

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
- ✅ 确保每个实体都从原文中找到准确的 source_ref

### 分批处理

**为什么不能一次性读完全部章节再提取：** 上下文越长，AI 注意力越分散，早期章节的信息会被稀释，导致提取不完整。

**必须执行：**
- ✅ 每读完一批章节，立即提取并写入 `batch_json/batch_N.json`
- ✅ 写入 batch 文件后，不再在上下文中保留已处理章节的原文
- ✅ 批次大小由 AI 根据章节长度自行决定（建议 5~10 章）
- ✅ batch 文件保留到最后，方便回溯和重新合并

### 对话提取完整性

**对话是最容易被遗漏的实体类型。** AI 倾向于只提取几条代表性对话，跳过大量"看起来不重要"的对话，这是严重错误。

**必须执行：**
- ✅ 每章中**每一句有明确说话人的对话**都必须提取，一条都不能少
- ✅ 短对话（"是。"、"好。"、"不错。"）也要提取
- ✅ 内心独白（"心想"、"暗道"）不算对话，不提取
- ✅ 旁白引语（"江湖传言"、"书中写道"）不算对话，不提取
- ✅ 判断标准：**有引号包裹 + 能确定说话人 = 必须提取**

### JSON 格式安全

中文小说原文使用全角引号 `""`（如 `"你好"`），**这些引号必须原样保留在 JSON 字符串中**。

**必须执行：**
- ✅ JSON 字符串值中的引号保持原样（全角 `""`），**不要转为 ASCII `"`**
- ✅ 全角引号 `""` 与 JSON 语法的 ASCII `"`（U+0022）是不同字符，不会破坏 JSON 结构
- ✅ 写入文件后，用 `cat` 或 `type` 验证 JSON 可被解析

**错误示例（禁止）：**
```json
{"text": "他说："你好。""}         // ❌ 内层""变成了ASCII"，JSON损坏
{"text": "他说：\"你好。\""}       // ❌ 不要转义，保持原文
```

**正确示例：**
```json
{"text": "他说：\u201c你好。\u201d"}  // ✅ 全角引号原样保留
```

实际效果（UTF-8 编码）：
```json
{"text": "他说："你好。"}
```

---

## 工作流

### 阶段一：分批精读 + 逐批提取（主 Agent 执行）

1. 确认 `<小说目录>/ch_formatted/` 目录存在
2. 用 `rtk ls` 或 Glob 列出所有 `ch_*.md`，确认完整文件列表和总数
3. 创建 `batch_json/` 目录
4. **分批处理**，每批 N 章（AI 自行判断 N 的大小）：

   **批次内流程：**
   ```
   a. 逐章用 Read 工具读取本批章节（不加 limit/offset）
   b. 读完本批全部章节后，立即提取本批实体
   c. 按 schemas.md 中的「批次输出格式」写入 batch_json/batch_N.json
   d. 确认写入成功后，本批章节原文可从上下文中释放
   ```

   **批次间衔接：**
   ```
   - 开始新批次前，上下文中应只保留：
     · 已有实体的 id + name 索引表（用于去重和交叉引用）
     · 当前批次的章节原文
   - 不保留已处理章节的原文
   ```

5. 重复步骤 4 直到全部章节处理完毕
6. 输出统计：总章数、批次数、每批提取的实体数量

### 阶段二：Sub Agent 合并（全新上下文）

主 Agent 上下文被章节原文撑满后，**合并工作交给 Sub Agent**：

7. 主 Agent 启动 Sub Agent，传递以下信息：
   - batch 文件路径：`batch_json/batch_*.json`
   - 最终输出目录：`ch_formatted/` 同级目录
   - 合并规则表位置：`schemas.md` 中的「合并规则表」

8. Sub Agent 执行：
   ```
   a. 读取 schemas.md，理解合并规则表
   b. 读取 constants.md，理解 ID 规则和等级体系
   c. 逐个读取 batch_json/batch_*.json（体积小，不占太多上下文）
   d. 按合并规则表逐实体语义合并：
      - 同一实体跨批次 → 按字段策略合并（keep_first/override/append_dedup 等）
      - AI 理解语义去重（如"冷峻"和"孤傲"是不同特征，都保留）
      - 关系中的 target_id、技能引用等交叉检查
   e. Write 写入最终 8 个 JSON 文件
   ```

9. Sub Agent 完成后，主 Agent 进入阶段三

### 阶段三：交叉验证（主 Agent 执行）

10. 检查：每个实体的 source_refs 指向真实存在的章节（章节号在 1~总数范围内）
11. 检查：角色关系、技能归属等交叉引用一致
12. 检查：后文提到的实体（如某角色后期习得新武功）已更新
13. 输出最终统计：各实体类型数量、来源章节覆盖率

---

## 参考文件

执行本 skill 时必须阅读以下文件，获取完整规则：

| 文件 | 内容 |
|------|------|
| `constants.md` | ID 规则、等级体系、关系类型 |
| `schemas.md` | 8 个 JSON 的完整 Schema 定义 + 批次输出格式 + 合并规则表 |
| `dialogue-rules.md` | speaker 提取的 4 条判断规则、误判排除、示例 |

---

## 自检清单

### 阶段一（每批完成后）
- 本批每个实体都有 source_refs，chapter 号正确
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- **对话数量合理：每章对话数 ≥ 该章角色数 × 2（短对话也要提取）**
- **对话 speaker 是角色 ID（非"他笑着"等动作描写）**
- **JSON 格式正确：全角引号未被转义或替换为 ASCII 引号**
- batch_json/batch_N.json 已成功写入

### 阶段二（Sub Agent 合并完成后）
- 最终 8 个 JSON 文件已写入
- 同一实体跨批次的 source_refs 已合并去重
- 关系中的 target_id 全部存在
- known_skills 中的 skill_id 全部存在

### 阶段三（最终验证）
- 所有 ID 都是小写拼音+下划线（例：`char_li_xun_huan`、`loc_yang_zhou`、`skill_li_fei_dao`）
- 角色 personality.traits ≥ 5 项，speech_style 和 temperament 非空
- 角色 relationships 字段完整（target, type, intensity, bond_level, dynamic）
- 技能 techniques ≥ 2 个招式，progression 包含功力层级
- 物品 description ≥ 20 字
- 事件 description ≥ 20 字
- relationships 无重复 (target+type)
- events id 格式为 evt_N_序号
- **每个实体的 source_refs 章节号在 1~总章数 范围内**
- **没有遗漏任何章节中出现的实体**
