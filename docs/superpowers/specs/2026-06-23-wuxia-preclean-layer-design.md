# 武侠数据预清洗层设计

日期：2026-06-23

## 背景

现有 `distill-*` 技能同时承担两类工作：

1. 机器可以稳定完成的结构化修复：枚举归一、重复去除、引用修复、空值补齐。
2. 需要人工判断的语义清洗：角色是否值得保留、功法是否有独立武学身份、道具是否有图鉴价值。

这两类工作混在一起后，产物容易出现“规则写了，但没真正兜住”的问题。例如 `items.json` 仍能留下非标准类型和 `"未知"` 品阶，`factions.json` 仍有重复势力，`characters.json.faction` 仍能引用不存在的势力名。

本设计在每个 `distill-*` 技能开头加入一层保守预清洗。它先做高置信、可追溯、可逆的自动修复，再把剩余模糊问题交给原本的人工清洗阶段。

## 目标

- 每个 `distill-*` 技能都以内嵌的 Phase 0 预清洗开始。
- 原始输入在第一次修改前备份到 `<小说目录>/archive/` 内。
- 预清洗直接改写工作 JSON，后续人工清洗基于更干净的数据继续。
- 每次自动修复必须生成详细报告，人工可逐条追溯。
- 只做高置信修复；拿不准的记录进入 pending，不自动改。
- 同一套预清洗规则可被多个技能复用，避免每个技能各自分叉。

## 非目标

- 不替代人工清洗。
- 不做依赖原著理解的复杂判断。
- 不做模糊角色合并、模糊门派归属、模糊功法取舍。
- 不根据上下文强推 speaker、owner、faction 这类可能误判的字段。
- 不为了通过校验而删除有价值但不规范的记录；此类记录进入 pending。

## 总体架构

每个 `distill-*` 技能新增相同的第一阶段：

```text
Phase 0: 预清洗
  1. 创建 archive 原始快照
  2. 加载工作 JSON
  3. 调用共享 sanitizer
  4. 写回工作 JSON
  5. 写 archive/preclean 快照
  6. 写 sanitize report 和 pending

Phase 1+: 原技能的人工清洗规则
```

预清洗层是一个深模块：外部接口很小，内部承载枚举映射、引用解析、去重、报告生成等复杂行为。

建议的共享接口：

```text
sanitizeNovelFile({
  novelDir,
  fileName,
  fileKind,
  companionFiles
}) -> {
  changed,
  outputPath,
  rawArchivePath,
  precleanArchivePath,
  reportPath,
  pendingPath
}
```

调用者只需要知道文件类型和小说目录，不需要理解具体映射规则。

## Archive 布局

所有备份和报告继续放在 `<小说目录>/archive/` 下，但不用裸文件名，避免和旧版 `archive/items.json` 这类备份冲突。

```text
archive/
  raw/
    characters.json
    items.json
    skills.json
    techniques.json
    dialogues.json
    locations.json
    factions.json
  preclean/
    characters.json
    items.json
    skills.json
    techniques.json
    dialogues.json
    locations.json
    factions.json
  reports/
    items.sanitize-report.json
    items.sanitize-report.md
    items.pending.json
    factions.sanitize-report.json
    factions.sanitize-report.md
    factions.pending.json
```

规则：

- `archive/raw/<file>.json` 是进入预清洗前的原始快照。已存在时不覆盖。
- `archive/preclean/<file>.json` 是预清洗后的快照。每次预清洗完成后覆盖。
- 工作文件 `<小说目录>/<file>.json` 被预清洗直接改写。
- 报告写入 `archive/reports/`。
- 旧版裸文件 `archive/<file>.json` 不再作为新流程的主备份名。

## 共享预清洗规则

所有文件先经过通用规则：

| 规则 | 自动改写条件 | 不自动改写条件 |
|------|--------------|----------------|
| 字符串清理 | 去 BOM、首尾空白、连续空白规整 | 可能改变原文含义的文本不改 |
| 空值规整 | `""`、`undefined`、`N/A` 等统一为空值 | 字段语义不明时进入 pending |
| 枚举归一 | 值在明确映射表中 | 无映射或多个可能映射 |
| ID 格式 | 可由现有 ID 无歧义转为 lower_snake_case | 需要从中文重新推断 ID |
| 精确重复合并 | `id` 相同或结构完全相同 | 仅 name 相似、alias 相似 |
| 引用修复 | 旧 ID 到新 ID 是一对一映射 | 多个候选目标 |
| 噪声删除 | 空对象、空文本、纯占位记录 | 有剧情信息但不规范 |

## 文件类型规则

### characters.json

自动处理：

- 合并同 `id` 的重复角色，数组字段取并集。
- 修复因为同 `id` 合并导致的 `relationships.target` 引用。
- 规范 `role` 枚举，只接受 `核心/重要/次要/龙套/背景`。
- 将明显空值字段统一为空。

不自动处理：

- 不删除“疑似群体角色”，除非记录没有 source_refs 且 name/identity 同时为空。
- 不把 `江湖人物` 自动改成具体身份。
- 不按 alias 做人物合并，除非 alias 与另一个角色 name 完全一对一且没有冲突。

### dialogues.json

自动处理：

- 删除空 text。
- 删除 `text.length <= 2` 且属于明确感叹词集合的对话。
- 将 tone 映射到标准枚举。
- speaker_name 与 characters 的 `name/alias` 完全匹配且唯一时，修复 speaker ID。
- speaker 指向已合并角色 ID 时同步重写。

不自动处理：

- 不凭上下文推断缺失 speaker。
- speaker_name 匹配多个角色时进入 pending。
- 不删除 speaker 无法识别但 text 有意义的对话。

### locations.json

自动处理：

- region 只按明确关键词映射到标准大区。
- 已经是具体地点名的 region，如 `镇南王府`、`青凤阁`，若能由地点名或 parent 明确归入标准大区，则改写。
- one_line 为空且 source_refs 中有可直接摘取的短句时补全。

不自动处理：

- 不为模糊地点强行归区。
- 不把地点层级重新建模。
- 不合并仅名称相似的地点。

### factions.json

自动处理：

- type 按明确映射表归一到 8 种标准类型。
- name + location 完全相同的势力合并。
- 合并后同步更新 characters.faction 中完全匹配旧 name 的引用。
- location 若是 location ID，且能唯一查到 location name，则改为 location name。

不自动处理：

- 不合并 `少林寺/少林派`、`无量剑/无量剑派` 这种需要语义判断的项。
- 不把国家、军队、门派之间的组织类型重新解释。
- 不修复 characters.faction 中无法一对一匹配的自由文本。

### items.json

自动处理：

- type 通过明确 TYPE_MAP 归一到 11 种标准类型。
- `rarity_tier: "未知"` 改为 `寻常凡品`。
- 同 type + 同 name 的重复道具合并。
- owner 引用已合并角色 ID 时同步修复。
- 英文类型如 `document/medicine/jewelry` 按映射表改写。

不自动处理：

- 不判断一个道具是否有“图鉴价值”。
- 不删除普通货色，除非是空对象或明显无名占位。
- 不按名字相似合并道具。

### skills.json 和 techniques.json

自动处理：

- technique.type 按明确 TYPE_MAP 归一到 13 种标准类型。
- source_skill 指向已合并 skill ID 时同步重写。
- 同 id 或同 name + 同 source_skill 的 technique 合并。
- orphan technique 若 name 和唯一 skill name 完全一致，可补 source_skill；否则进入 pending。

不自动处理：

- 不判断功法是否应该保留。
- 不删除“人名+泛称”功法。
- 不决定内功/身法是否应无 technique。
- 不新建 skill 来承接无归属 technique。

## 报告格式

每个文件输出 JSON 与 Markdown 两份报告。

JSON 报告用于自动校验：

```json
{
  "novel": "金庸/天龙八部",
  "file": "items.json",
  "started_at": "2026-06-23T00:00:00+08:00",
  "raw_archive": "archive/raw/items.json",
  "preclean_archive": "archive/preclean/items.json",
  "summary": {
    "records_before": 187,
    "records_after": 187,
    "changed_records": 61,
    "deleted_records": 0,
    "pending_records": 12
  },
  "changes": [
    {
      "id": "item_jin_chai",
      "field": "type",
      "before": "jewelry",
      "after": "饰品",
      "rule": "items.type_map",
      "confidence": "high"
    }
  ],
  "pending": [
    {
      "id": "item_tong_lao_duan_tui",
      "reason": "type_not_in_map",
      "value": "遗体残肢"
    }
  ]
}
```

Markdown 报告用于人工复核：

```markdown
# items.json 预清洗报告

## 汇总

| 项 | 数量 |
|----|------|
| 原始记录 | 187 |
| 输出记录 | 187 |
| 修改记录 | 61 |
| 删除记录 | 0 |
| 待复核 | 12 |

## 自动修改

| id | 字段 | 原值 | 新值 | 规则 |
|----|------|------|------|------|
| item_jin_chai | type | jewelry | 饰品 | items.type_map |

## 待复核

| id | 原因 | 值 |
|----|------|----|
| item_tong_lao_duan_tui | type_not_in_map | 遗体残肢 |
```

## 技能接入方式

各 `distill-*` 技能的执行顺序调整如下。

### distill-characters

1. Phase 0：预清洗 `characters.json`。
2. Phase 1：执行人物图鉴式人工删除与合并。
3. Phase 2：分级、身份修正、summary。

### distill-dialogues-locations-factions

1. Phase 0：依次预清洗 `characters.json`、`dialogues.json`、`locations.json`、`factions.json`。
2. Phase 1：对话 tone 和 speaker 人工补强。
3. Phase 2：地点 region 人工归并。
4. Phase 3：势力语义合并和角色 faction 对齐。

### distill-items

1. Phase 0：预清洗 `items.json`，补品阶、归一 type、输出 pending。
2. Phase 1：人工判断图鉴价值。
3. Phase 2：去人名前缀、合并、summary。

### distill-skills-and-techniques

1. Phase 0：同时预清洗 `skills.json` 和 `techniques.json`。
2. Phase 1：人工判断功法/招式保留。
3. Phase 2：交叉校验、去重、summary。

## 校验策略

预清洗阶段必须通过：

- JSON 可解析。
- 工作 JSON 与 `archive/preclean/<file>.json` 内容一致。
- `archive/raw/<file>.json` 存在且不被覆盖。
- 每条自动修改都出现在 JSON 报告中。
- Markdown 报告和 JSON 报告的汇总数字一致。
- 运行第二次预清洗时，除时间戳外没有新的数据变化。

文件级硬校验：

| 文件 | 校验 |
|------|------|
| characters | 无重复 id；role 枚举合法；relationship target 若非空必须可解析或进入 pending |
| dialogues | tone 枚举合法；空 text 为 0；speaker 无效引用进入 pending |
| locations | region 为空或标准大区；非标准 region 必须进入 pending |
| factions | type 枚举合法；重复 name+location 为 0；location ID 残留为 0 |
| items | type 枚举合法；rarity_tier 枚举合法；`未知` 为 0 |
| techniques | type 枚举合法；source_skill 无效引用为 0 或进入 pending |

## 风险与取舍

- 预清洗层会让后续人工清洗更轻，但不能追求“自动洗完”。过度自动化会把错误隐藏进干净格式里。
- `archive/raw` 是安全底线，任何自动改写都必须能回溯。
- pending 数量不是失败信号。pending 是保守策略的结果，表示这些问题需要人工判断。
- 若某个文件 pending 过多，应改进提取或规则表，而不是放宽自动修改标准。

## 完成标准

这套设计完成后，任意一本小说运行 `distill-*` 时应满足：

1. 所有被处理文件都在 `archive/raw/` 有原始快照。
2. 所有被处理文件都在 `archive/preclean/` 有预清洗快照。
3. 所有被处理文件都有 `archive/reports/*.sanitize-report.json` 和 `.md`。
4. 自动可修复的枚举、空值、精确重复、明确引用问题不再进入人工阶段。
5. 模糊问题集中出现在 pending，人工清洗只处理真正需要判断的条目。
