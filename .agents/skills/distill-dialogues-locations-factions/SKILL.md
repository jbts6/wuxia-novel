---
name: distill-dialogues-locations-factions
description: Use when a wuxia novel directory needs its dialogues.json, locations.json, and factions.json cleaned together. Handles tone normalization, speaker reconciliation, region standardization, faction type cleanup, and cross-reference validation in a single pass. Trigger on "clean dialogues", "distill dialogues", or "对话地点势力清洗".
---

# 提炼对话、地点与势力

从 `<小说目录>` 的 `dialogues.json`、`locations.json`、`factions.json` 一次性提炼出干净数据。三个文件共享 characters.json 的角色信息，合并处理效率更高。

---

## 第一阶段：备份与读取

1. 确认 `archive/dialogues.json`、`archive/locations.json`、`archive/factions.json` 不存在
2. 将三个文件复制到 `archive/`
3. 读取 archive 三个文件 + `characters.json`（用于 speaker 匹配和 faction 归一化）

---

## 第二阶段：清理 dialogues.json

### 标准 tone 枚举（12 种）

| tone | 说明 | 合并来源 |
|------|------|---------|
| 陈述 | 默认兜底 | 含平静、淡然、低语、喃喃、温柔、柔声、娇声、严肃、沉声、无奈、苦笑、犹豫 |
| 疑问 | 疑问/好奇 | 含好奇 |
| 愤怒 | 愤怒/厉声 | 含厉声 |
| 激动 | 激动/惊讶 | 含惊讶 |
| 悲伤 | 悲伤/悲痛 | 含悲痛、痛苦、颤声、嘶声 |
| 恳求 | 恳求 | — |
| 嘲讽 | 嘲讽/冷笑 | 含冷笑 |
| 调侃 | 调侃 | — |
| 冷酷 | 冷酷 | — |
| 恐惧 | 恐惧 | — |
| 欣喜 | 欣喜/微笑 | 含微笑、轻笑、大笑、狂笑、欣慰、得意 |
| 焦急 | 焦急/担心 | 含慌张、担心 |

### 删除标准

- text ≤ 2 字的感叹词（"嗤""啊""嘶""着！""是！"）→ 删除
- text 为空或纯空白 → 删除

### speaker 归一化

- 用 characters.json 的角色名和别名做匹配
- speaker_name 匹配到角色 → 用角色 ID 填充 speaker
- speaker_name 无法匹配 → 保留原值

### 缺 speaker 处理

- 优先从上下文推断：同 chapter 前后对话的 listener 可能是当前 speaker
- 无法推断 → 保留对话但 speaker 置 null，不删除

---

## 第三阶段：清理 locations.json

### region 标准化

建立标准 region 层级，从 source_refs 推断缺失 region：

| 标准 region | 关键词 |
|-------------|--------|
| 大理 | 大理、镇南、万劫谷 |
| 无量山 | 无量 |
| 天山 | 天山、缥缈峰、灵鹫 |
| 中原 | 少林、丐帮、河南、信阳、擂鼓 |
| 江南 | 苏州、姑苏、燕子坞、太湖、无锡、曼陀 |
| 西夏 | 西夏 |
| 辽国 | 辽国、契丹 |
| 吐蕃 | 吐蕃 |

### one_line 补全

从 source_refs 的 text 推断，取第一句概括性描述。

---

## 第四阶段：清理 factions.json

### 标准 type 枚举（8 种）

| type | 说明 |
|------|------|
| 武林门派 | 门派、宗派、剑派 |
| 帮派 | 帮会、分舵 |
| 家族 | 世家、武林家族 |
| 军队 | 军事组织 |
| 王族 | 皇室、王室 |
| 寺院 | 佛寺、道观 |
| 部族 | 游牧部落 |
| 官署 | 官府机构 |

### type 映射

```
武林家族/武林世家 → 家族
丐帮分舵 → 帮派
剑派/岛派 → 武林门派
佛寺与大理段氏护国武学重地/吐蕃佛寺武学势力 → 寺院
上位江湖势力 → 武林门派
```

### 删除标准

| 类型 | 示例 |
|------|------|
| 非组织类型 | 追捕队伍、骑队、师门群体 |
| 活动/聚会 | 万仙大会 |
| 描述性称呼 | 打草谷辽兵、辽国叛军 |

### 合并标准

同一势力存在多个条目时合并：
- 姑苏慕容氏 = 燕国慕容氏 = 慕容家 → 合并为「姑苏慕容氏」
- 灵鹫宫 = 天山灵鹫宫 → 合并为「灵鹫宫」
- 吐蕃 = 吐蕃国 → 合并为「吐蕃」
- 大理段家 = 大理段氏 → 合并为「大理段氏」

合并后同步更新 characters.json 的 faction 字段。

---

## 第五阶段：收尾

1. 写入三个 JSON 文件
2. 写入三个 summary 文件
3. 更新 deconstruct-novel 的 constants.md（如枚举有变化）

---

## dialogues_summary.md 格式

```markdown
# 《书名》对话清单

共 N 条

## tone 分布
| tone | 数量 | 占比 |
|------|------|------|
| 陈述 | 6720 | 51% |
| ... | ... | ... |

## speaker 排名（top 20）
| 角色 | 对话数 |
|------|--------|
| 段誉 | 2500 |
| ... | ... |
```

## locations_summary.md 格式

```markdown
# 《书名》地点清单

共 N 条

## region 分布
| region | 数量 |
|--------|------|
| 中原 | 45 |
| ... | ... |
```

## factions_summary.md 格式

```markdown
# 《书名》势力清单

共 N 条

## type 分布
| type | 数量 |
|------|------|
| 武林门派 | 32 |
| ... | ... |

## 势力列表
| 势力 | 类型 | 地点 |
|------|------|------|
| 丐帮 | 帮派 | 中原 |
| ... | ... | ... |
```

---

## 产物校验

### dialogues.json
- JSON 可解析
- 所有 tone 属于 12 种标准枚举
- 无空 text
- speaker 有值的条目，speaker ID 在 characters.json 中存在

### locations.json
- JSON 可解析
- region 尽量补全（允许少量无法推断的为空）

### factions.json
- JSON 可解析
- 所有 type 属于 8 种标准枚举
- 无重复势力（同名/同地点合并后）
- characters.json 的 faction 字段与 factions.json 的 name 一致
