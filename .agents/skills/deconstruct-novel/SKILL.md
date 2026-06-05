---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、对话、剧情摘要等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说

从 `ch_formatted/ch_*.md` 读取排版原文，提取结构化数据写入 JSON。

## 架构：注册表驱动

**核心思路：** `entity_registry.json` 是所有实体的唯一真相源。每章提取时更新注册表，最终从注册表拆分出输出文件。

**主 Agent 不读取章节原文。** 主 Agent 的职责：列目录、创建目录、初始化注册表、启动 Sub Agent（串行）、执行代码合并、验证最终结果。

```
主 Agent（轻量调度，不读章节）
  │
  ├── 准备：列目录、建目录、初始化空 entity_registry.json
  │
  ├── 章级提取（严格串行，每章更新 registry）
  │   ch_001.md → Sub Agent → ch_001.json + 更新 registry
  │   ch_002.md → Sub Agent → ch_002.json + 更新 registry
  │   ...依次直到最后一章
  │
  ├── 代码合并（主 Agent 执行）
  │   · dialogues.json ← ch_N.json 中的 dialogues 拼接
  │   · chapter_summaries.json ← ch_N.json 中的 chapter_summary 拼接
  │
  └── 最终输出（代码执行）
      · entity_registry.json → 拆分为 6 个 JSON 文件
```

---

## 工作流

### 第0步：准备（主 Agent 执行）

1. 确认 `<小说目录>/ch_formatted/` 目录存在
2. 用 `rtk ls` 或 Glob 列出所有 `ch_*.md`，确认完整文件列表和总数
3. 创建 `batch_json/` 目录
4. 初始化空的 `entity_registry.json`：
   ```json
   {
     "characters": [],
     "skills": [],
     "techniques": [],
     "factions": [],
     "locations": [],
     "items": []
   }
   ```

### 第1步：章级提取（Sub Agent 串行执行）

5. **严格串行**：每章的 Sub Agent 完成并更新 registry 后，才能启动下一章

6. 为每章启动一个 Sub Agent，传递以下信息：
   - 章节文件路径：`ch_formatted/ch_N.md`
   - 当前 `entity_registry.json` 的完整内容
   - 输出目录：`batch_json/`
   - 参考文件路径：`schemas.md`、`constants.md`、`dialogue-rules.md`

7. **Sub Agent 必须独立完成以下任务：**
   ```
   a. 阅读 schemas.md、constants.md、dialogue-rules.md，理解所有规则
   b. 用 Read 工具读取 ch_N.md（只传 filePath，不加 limit/offset）
   c. 提取本章实体，对照 registry 中已有的 ID/名称：
      - 已有实体 → 复用 registry 中的 ID
      - 新实体 → 生成新 ID
      - 已有实体有变化 → 记录到 entity_updates
   d. 撰写本章剧情摘要（chapter_summary，约200字）
   e. 写入 batch_json/ch_N.json（delta 文件）
   f. 更新 entity_registry.json：
      - 新实体 → 追加到 registry 对应数组
      - 已有实体更新 → 按 constants.md 中的更新策略表应用
   g. 验证两个 JSON 文件格式正确（node -e "JSON.parse(...)"）
   ```

8. Sub Agent 提取规则：
   - **对话完整性**：每章每一句有明确说话人的对话都必须提取，一条都不能少
   - **speaker 判断**：按 dialogue-rules.md 的 4 条规则（交替模式、代词回溯、立场一致性、直接标注）
   - **JSON 引号安全**：全角引号 `""` 原样保留，不转义、不替换为 ASCII `"`
   - **source_refs**：每个实体必须携带准确的章节号和原文片段
   - **rank 取巅峰值**：rank 始终记录角色/武功的最高水平，临时削弱记在 one_line 或 description 中
   - **物品 owner 取最终归属**：转手历史记在 description 中

9. 每章完成后，主 Agent 读取更新后的 registry 传给下一章的 Sub Agent

### 第2步：代码合并（主 Agent 执行）

10. 主 Agent 用 `ctx_execute` 执行合并脚本：
    ```javascript
    const fs = require('fs');
    const path = require('path');
    const batchDir = '<小说目录>/batch_json';
    const files = fs.readdirSync(batchDir)
      .filter(f => f.startsWith('ch_') && f.endsWith('.json'))
      .sort();
    let allDialogues = [];
    let allSummaries = [];
    for (const f of files) {
      const chapter = JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8'));
      allDialogues = allDialogues.concat(chapter.dialogues || []);
      if (chapter.chapter_summary) {
        allSummaries.push({ chapter: chapter.chapter, summary: chapter.chapter_summary });
      }
    }
    allDialogues.sort((a, b) => a.chapter - b.chapter);
    allSummaries.sort((a, b) => a.chapter - b.chapter);
    fs.writeFileSync('<小说目录>/dialogues.json', JSON.stringify(allDialogues, null, 2), 'utf8');
    fs.writeFileSync('<小说目录>/chapter_summaries.json', JSON.stringify(allSummaries, null, 2), 'utf8');
    console.log(`dialogues.json: ${allDialogues.length} 条对话`);
    console.log(`chapter_summaries.json: ${allSummaries.length} 章摘要`);
    ```

### 第3步：最终输出（代码执行）

11. 主 Agent 用 `ctx_execute` 执行拆分脚本：
    ```javascript
    const fs = require('fs');
    const registry = JSON.parse(fs.readFileSync('<小说目录>/entity_registry.json', 'utf8'));
    const outputDir = '<小说目录>';
    for (const [type, data] of Object.entries(registry)) {
      fs.writeFileSync(path.join(outputDir, `${type}.json`), JSON.stringify(data, null, 2), 'utf8');
    }
    console.log('最终输出文件已生成：');
    for (const [type, data] of Object.entries(registry)) {
      console.log(`  ${type}.json: ${data.length} 个实体`);
    }
    ```

### 第4步：验证（主 Agent 执行）

12. 验证最终 8 个 JSON 文件：
    - JSON 格式可解析（`node -e "JSON.parse(...)"`）
    - 每个实体的 source_refs 章节号在 1~总章数范围内
    - 关系中的 target_id 全部存在
    - known_skills 中的 skill_id 全部存在
    - chapter_summaries.json 共 N 章
    - dialogues.json 对话数合理
13. 输出最终统计

---

## 核心规则（Sub Agent 必读）

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

### 对话提取完整性

**对话是最容易被遗漏的实体类型。** AI 倾向于只提取几条代表性对话，跳过大量"看起来不重要"的对话，这是严重错误。

**必须执行：**
- ✅ 每章中**每一句有明确说话人的对话**都必须提取，一条都不能少
- ✅ 短对话（"是。"、"好。"、"不错。"）也要提取
- ✅ 内心独白（"心想"、"暗道"）不算对话，不提取
- ✅ 旁白引语（"江湖传言"、"书中写道"）不算对话，不提取
- ✅ 判断标准：**有引号包裹 + 能确定说话人 = 必须提取**

### 关系变化追踪

角色之间的关系会随剧情演变。每章提取时必须识别并记录关系变化：

**必须执行：**
- ✅ 本章中两个角色首次建立关系 → `relationship_updates` 中用 `action: "add"`
- ✅ 本章中已有关系发生变化（亲密/敌意增减）→ `action: "update"`
- ✅ 关系变化的判断依据：角色的互动频率、对话内容、行动选择
- ✅ intensity（0-100）和 bond_level（1-5）反映**当前最新状态**

**示例：**
- 第3章：李寻欢与阿飞初识 → add, intensity: 30, bond_level: 2
- 第15章：共同经历生死 → update, intensity: 80, bond_level: 4
- 第20章：阿飞为救李寻欢受伤 → update, intensity: 95, bond_level: 5

### JSON 格式安全

中文小说原文使用全角引号 `""`（如 `"你好"`），**这些引号必须原样保留在 JSON 字符串中**。

**必须执行：**
- ✅ JSON 字符串值中的引号保持原样（全角 `""`），**不要转为 ASCII `"`**
- ✅ 全角引号 `""` 与 JSON 语法的 ASCII `"`（U+0022）是不同字符，不会破坏 JSON 结构
- ✅ 写入文件后，必须验证 JSON 可被解析

---

## 参考文件

执行本 skill 时，Sub Agent 必须阅读以下文件，获取完整规则：

| 文件 | 内容 |
|------|------|
| `constants.md` | ID 规则、rank 排序表、枚举值域、更新策略表 |
| `schemas.md` | entity_registry.json 格式 + ch_N.json delta 格式 |
| `dialogue-rules.md` | speaker 提取的 4 条判断规则、误判排除、示例 |

---

## 自检清单

### 每章 Sub Agent 完成后
- batch_json/ch_N.json 已成功写入且 JSON 格式正确
- entity_registry.json 已更新且 JSON 格式正确
- 本章每个实体都有 source_refs，chapter 号正确
- **chapter_summary 约200字，概括本章主要情节和关键冲突**
- 角色 personality.traits ≥ 5 项
- 技能 techniques ≥ 2 个招式
- **对话数量合理：本章对话数 ≥ 本章角色数 × 2（短对话也要提取）**
- **对话 speaker 是角色 ID（非"他笑着"等动作描写）**
- **JSON 格式正确：全角引号未被转义或替换为 ASCII 引号**

### 最终验证
- 所有 ID 都是小写拼音+下划线（例：`char_li_xun_huan`、`loc_yang_zhou`、`skill_li_fei_dao`）
- 角色 personality.traits ≥ 5 项，speech_style 和 temperament 非空
- 角色 relationships 字段完整（target, type, intensity, bond_level, dynamic）
- 技能 techniques ≥ 2 个招式，progression 包含功力层级
- 物品 description ≥ 20 字
- chapter_summaries.json 共 N 章
- dialogues.json 对话数合理
- relationships 无重复 (target+type)
- **每个实体的 source_refs 章节号在 1~总章数 范围内**
- **没有遗漏任何章节中出现的实体**
