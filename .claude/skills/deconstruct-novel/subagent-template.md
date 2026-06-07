# Sub Agent 启动模板 + 规则

## Sub Agent 启动模板

主 Agent 复制此模板，替换变量后使用 Task 工具：

```
你是小说解构专家。请处理第 {N} 章。

**任务**：提取本章的结构化数据（增量写入模式）。

**文件路径**：
- 章节文件：ch_formatted/ch_{N}.md
- 进度文件：batch_json/ch_{N}_progress.jsonl（增量追加）
- 输出文件：batch_json/ch_{N}.json（最终合并）

**参考文件**（必须先阅读）：
- .agents/skills/deconstruct-novel/schemas.md
- .agents/skills/deconstruct-novel/constants.md
- .agents/skills/deconstruct-novel/dialogue-rules.md

**恢复检测（先执行）**：
1. 检查 batch_json/ch_{N}.json 是否已存在 → 如果存在，报告"已完成"并退出
2. 检查 batch_json/ch_{N}_progress.jsonl 是否存在
3. 如果存在：读取行数，这就是已完成的段落数，从下一段继续
4. 如果不存在：从头开始

**执行步骤（增量模式）**：

1. **读取章节并分段**
   - 用 Read 工具读取 ch_formatted/ch_{N}.md（只传 filePath）
   - 按段落分段（每段约 300-500 字，或按自然段落）

2. **逐段处理**（跳过已完成的段）
   对于每个段落：
   a. 提取本段的对话（speaker、text、tone）
   b. 识别本段的新实体
   c. 识别本段的实体更新（关系变化、rank 变化等）
   d. 用 ctx_execute 追加一行 JSON 到进度文件：
      ```javascript
      const fs = require('fs');
      const line = JSON.stringify({
        segment: SEGMENT_NUM,
        line_start: START_LINE,
        line_end: END_LINE,
        dialogues: [...],
        new_entities: {...},
        entity_updates: [...]
      }) + '\n';
      fs.appendFileSync('batch_json/ch_{N}_progress.jsonl', line, 'utf8');
      ```

3. **生成章节摘要**
   - 所有段落处理完后，根据全文内容撰写 chapter_summary（约200字）

4. **合并为最终文件**
   - 用 ctx_execute 读取 progress.jsonl 的所有行
   - 合并所有 dialogues、new_entities、entity_updates
   - 加上 chapter_summary
   - 写入 batch_json/ch_{N}.json
   - 删除 progress.jsonl（可选）

**关键规则**：
- 禁止使用 Write 工具写入 JSON，必须用 ctx_execute
- ❌ 禁止创建任何中间文件（progress.jsonl 除外）
- ❌ 禁止往系统临时目录写入任何文件
- 每章最终只产出一个文件：batch_json/ch_{N}.json
- progress.jsonl 是临时进度文件，合并后可删除
- 禁止对 speaker 识别过度思考，5秒内无法判断就标 null
- 每句有说话人的对话都必须提取
- tone 字段：从 constants.md 的 dialogue_tone 枚举中选择，无法判断用"陈述"
```

---

## 增量写入详解

### JSONL 进度文件格式

每行是一个 JSON 对象，代表一个段落的处理结果：

```jsonl
{"segment": 1, "line_start": 1, "line_end": 45, "dialogues": [...], "new_entities": {...}, "entity_updates": [...]}
{"segment": 2, "line_start": 46, "line_end": 92, "dialogues": [...], "new_entities": {...}, "entity_updates": [...]}
```

### 恢复逻辑

```javascript
// 读取已完成的段落数
const progressFile = 'batch_json/ch_{N}_progress.jsonl';
let completedSegments = 0;
if (fs.existsSync(progressFile)) {
  const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n');
  completedSegments = lines.length;
}
// 从 segment = completedSegments + 1 开始处理
```

### 合并逻辑

```javascript
const fs = require('fs');
const lines = fs.readFileSync('batch_json/ch_{N}_progress.jsonl', 'utf8')
  .trim().split('\n').filter(Boolean);

let allDialogues = [];
let allNewEntities = { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] };
let allEntityUpdates = [];

for (const line of lines) {
  const seg = JSON.parse(line);
  allDialogues.push(...(seg.dialogues || []));
  
  for (const [type, entities] of Object.entries(seg.new_entities || {})) {
    if (Array.isArray(entities)) {
      allNewEntities[type].push(...entities);
    }
  }
  
  allEntityUpdates.push(...(seg.entity_updates || []));
}

// 去重对话（按 speaker + text + line_start）
const dialogueSet = new Set();
allDialogues = allDialogues.filter(d => {
  const key = `${d.speaker}_${d.text}_${d.line_start}`;
  if (dialogueSet.has(key)) return false;
  dialogueSet.add(key);
  return true;
});

// 去重实体（按 id）
for (const [type, entities] of Object.entries(allNewEntities)) {
  const seen = new Set();
  allNewEntities[type] = entities.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// 合并 entity_updates（按 id 聚合）
const updateMap = new Map();
for (const update of allEntityUpdates) {
  if (!updateMap.has(update.id)) {
    updateMap.set(update.id, update);
  } else {
    // 合并 updates 和 relationship_updates
    const existing = updateMap.get(update.id);
    if (update.updates) {
      existing.updates = { ...existing.updates, ...update.updates };
    }
    if (update.relationship_updates) {
      existing.relationship_updates = [
        ...(existing.relationship_updates || []),
        ...update.relationship_updates
      ];
    }
  }
}

// 写入最终文件
const result = {
  chapter: CHAPTER_NUM,
  chapter_summary: CHAPTER_SUMMARY, // AI 生成
  dialogues: allDialogues,
  new_entities: allNewEntities,
  entity_updates: Array.from(updateMap.values())
};

fs.writeFileSync('batch_json/ch_{N}.json', JSON.stringify(result, null, 2), 'utf8');
```

---

## 逐段处理原则

**分段策略：**
- 按自然段落分段（推荐）
- 或每 300-500 字一段
- 避免在对话中间断开

**跨段实体识别：**
- 每段处理前，读取已完成段落的实体列表
- 新段落中出现已知实体时，使用已有 ID
- 新段落中出现新实体时，添加到 new_entities

**对话提取：**
- 每段独立提取对话
- speaker 识别需要上下文时，参考前面段落的说话人

---

## JSON 写入规则

**⚠️ 禁止使用 Write 工具写入 JSON 文件。**

原因：
- `progress.jsonl`：需要追加写入（`fs.appendFileSync`），Write 只能覆盖
- `ch_N.json`：最终合并后可能很大，Write 可能报错

**必须使用 ctx_execute：**
```javascript
// ✅ 追加到 progress.jsonl
fs.appendFileSync('batch_json/ch_{N}_progress.jsonl', line + '\n', 'utf8');

// ✅ 写入最终 ch_N.json
fs.writeFileSync('batch_json/ch_{N}.json', JSON.stringify(result, null, 2), 'utf8');
```

---

## 其他禁止行为

- ❌ 使用 shell/python 脚本批量读取或处理章节文件
- ❌ 用 `ctx_execute` 或 `ctx_execute_file` 批量**读取**章节
- ❌ Read 时使用 `limit` 或 `offset` 参数截断章节内容
- ❌ 创建 `.cjs` 文件

**必须执行：**
- ✅ 用 Read 工具读取整个 `ch_*.md` 文件
- ✅ Read 调用**只传 filePath 一个参数**
- ✅ 确保每个实体都从原文中找到准确的 source_ref

---

## 对话提取完整性

**必须执行：**
- ✅ 每章中**每一句有明确说话人的对话**都必须提取
- ✅ 短对话（"是。"、"好。"、"不错。"）也要提取
- ✅ 内心独白不算对话，不提取
- ✅ 判断标准：**有引号包裹 + 能确定说话人 = 必须提取**

---

## JSON 格式安全

**必须使用 `JSON.stringify` 写入 JSON**，它会自动处理引号转义。不要手动拼接 JSON 字符串。

---

## Sub Agent 自检清单

### 每段完成后
- ✅ 进度已追加到 progress.jsonl
- ✅ 本段对话已提取
- ✅ 本段实体已识别

### 最终合并后
- ✅ batch_json/ch_N.json 已成功写入且 JSON 格式正确
- ✅ **JSON 文件是通过 ctx_execute 写入的（非 Write 工具）**
- ✅ 本章每个实体都有 source_refs，chapter 号正确
- ✅ **chapter_summary 约200字**
- ✅ 角色 personality.traits ≥ 5 项
- ✅ 技能 techniques ≥ 2 个招式
- ✅ **对话数量合理：本章对话数 ≥ 本章角色数 × 2**
- ✅ **所有 dialogue.tone 均属于 constants.md 的 dialogue_tone 枚举**

### 中断恢复检查
- ✅ 检查 batch_json/ch_N.json 是否已存在
- ✅ 如果已存在，直接报告完成并退出
- ✅ 读取 progress.jsonl 行数，跳过已完成的段
