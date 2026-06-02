---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说（Sub-Agent 精细提取版）

核心改进：用 `task` sub-agent 替代手动 LLM 调用，实现自动化的骨架提取和精细提取。

## 快速开始

```bash
# 1. 检查进度
cat <小说目录>/progress.json

# 2. 根据进度执行对应步骤（见下方流程）
```

## 核心流程

### Step 0: 检查进度

读取 `<小说目录>/progress.json`，判断当前状态：

**决策树**：

| 条件 | 下一步 |
| --- | --- |
| `ch_formatted/` 不存在或不完整 | 先用 `batch-format-novel` skill 排版 |
| `progress.json` 不存在 | 运行 `setup-novel-dirs.py` 初始化 |
| `skeleton.done` 长度 < skeleton.total | 继续骨架提取（Sub-Agent 模式） |
| `skeleton.done` = total 但 `deep.done` < deep.total | 继续精细提取（Sub-Agent 模式） |
| `deep.done` = total 但 `merge` = false | 合并数据：`merge-chapters.py` |
| `merge` = true 但 Markdown 卡片不完整 | 生成卡片：`json-to-markdown.py` 等 |
| 全部完成 | 验证：`verify-card-output-pipeline.py` |

---

### Step 1: 骨架提取（Sub-Agent）

**触发条件**：`skeleton.done` 长度 < `skeleton.total`

#### 流程

1. **加载进度**，确定需要提取的章节列表（跳过已完成）
2. **对每个章节**，执行以下步骤：

```
a. 读取章节原文：ch_formatted/ch_XX.md（或 ch_original/ch_XX.md）
b. 构建 sub-agent prompt（见下方模板）
c. 用 task 工具 spawn sub-agent（run_in_background=true 可并行）
d. 收集 sub-agent 返回的 JSON 结果
e. 验证 JSON 格式和内容完整性
f. 保存到 chapters/ch_XX_skeleton.json
g. 更新 progress.json
```

#### Sub-Agent Prompt 模板（骨架提取）

构建 prompt 时使用以下结构，将章节原文直接嵌入：

```
你是武侠小说骨架提取专家。从以下章节原文中提取所有出现的人物、门派、地点、武功、物品。

## 提取规则
- 只提取本章实际出现的实体
- 门派如有宗门分支（如无量剑东宗/西宗），作为一个门派，宗门作为 sub_divisions
- 武功需有具体描写，不能只是"武功很高"
- 段誉的武功分两层：known_skills（已掌握）和 related_skills（家族/门派关联但尚未学会）
- ID 格式：char_拼音 / faction_拼音 / loc_拼音 / skill_拼音 / item_拼音

## 输出格式（纯 JSON，不要其他文字）
{
  "chapter": <章节号>,
  "characters": [{"id":"char_xxx","name":"名字","alias":["别名"],"identity":"身份","faction":"faction_id或null","role":"protagonist/companion/npc/villain","one_line":"一句话描述","personality":"一句话性格","known_skills":[],"related_skills":[]}],
  "factions": [{"id":"faction_xxx","name":"名字","type":"武林门派/帮派/家族","location":"loc_id","sub_divisions":[],"one_line":"一句话描述"}],
  "locations": [{"id":"loc_xxx","name":"名字","region":"地理区域","one_line":"一句话描述"}],
  "skills": [{"id":"skill_xxx","name":"名字","type":"剑法/掌法/内功/轻功/暗器/指法","faction":"","one_line":"一句话描述"}],
  "items": [{"id":"item_xxx","name":"名字","type":"weapon/armor/pill/poison/hidden_weapon/special","owner":"char_id或null","one_line":"一句话描述"}]
}

## 第 {N} 章原文

（此处嵌入章节全文）
```

#### 并行策略

- 使用 `task(run_in_background=true)` 一次 spawn 多个 sub-agent（建议 3-5 个并行）
- 每个 sub-agent 处理一个章节，返回该章节的骨架 JSON
- 主 agent 等待所有 sub-agent 完成后，统一收集结果、验证、保存

#### 结果处理

Sub-agent 返回的 JSON 字符串，需要：
1. 尝试解析为 JSON（如果包含 markdown 代码块标记，先清理）
2. 验证必要字段存在（chapter, characters, factions, locations, skills）
3. 保存到 `chapters/ch_XX_skeleton.json`
4. 更新 `progress.json` 的 `skeleton.done` 数组

---

### Step 2: 精细提取（Sub-Agent）

**触发条件**：`skeleton.done` = total 但 `deep.done` < deep.total

#### 流程

1. **加载进度**，确定需要精细提取的章节列表
2. **对每个章节**，执行以下步骤：

```
a. 读取骨架数据：chapters/ch_XX_skeleton.json
b. 读取章节原文：ch_formatted/ch_XX.md
c. 格式化骨架索引（将 skeleton JSON 转为人类可读的索引文本）
d. 构建 sub-agent prompt（见下方模板）
e. 用 task 工具 spawn sub-agent
f. 收集并验证 JSON 结果
g. 保存到 chapters/ch_XX_deep.json
h. 更新 progress.json
```

#### 格式化骨架索引

将 skeleton JSON 转换为 sub-agent 可读的索引文本：

```
### 人物
- char_duanyu: 段誉 (大理段氏公子) - 大理段氏的年轻公子
- char_zhongling: 钟灵 () - 古灵精怪的少女

### 门派
- faction_wuliangjian: 无量剑 (武林门派) - 无量山上的剑派

### 地点
- loc_jianhugong: 剑湖宫 (无量山) - 无量剑派的总部

### 武功
- skill_wuliangjianfa: 无量剑法 (剑法) - 无量剑派的看家剑法

### 物品
- item_qinggangjian: 青钢剑 (weapon) - 普通的钢剑
```

#### Sub-Agent Prompt 模板（精细提取）

```
你是顶尖的武侠小说精细提取专家。基于骨架索引和章节原文，执行深度数据提取。

## 核心规则
1. 所有数组字段必须填充，禁止留空数组 []（除非确实没有内容）
2. 所有字符串字段必须有值，禁止空字符串 ""（无法确定时合理推断）
3. 严格基于原文，不要编造原文中没有的内容
4. 阅读本章全部原文后再提取，不要遗漏出场人物和事件
5. 输出纯 JSON，不要包含任何注释或说明文字

## 骨架索引
（此处嵌入格式化后的骨架索引）

## 章节原文
（此处嵌入章节全文）

## 提取要求

### 人物详细卡
对骨架中每个在本章出现的人物，提取：
- personality.traits: 至少3个精准的性格特质词
- personality.speech_style: 详细描述说话风格
- personality.temperament: 气质描述
- archetype: scholar/warrior/monk/assassin/healer
- relationships: 本章中体现出的人物关系（target, type, intensity 0-100, bond_level 1-5, dynamic）
- known_skills: 本章已掌握的技能id列表
- related_skills: 关联但未学会的技能id列表

### 技能详细卡
对骨架中每个在本章出现或使用的技能，提取：
- techniques: 本章展示的具体招式（id, name, type: attack/defense/buff/debuff/feint/beast/special, description）
- progression: 功力层级（level: 1-5, unlock: 境界描述）
- effects: 实战效果
- combat_style: 战斗风格描述

### 物品详细卡
对骨架中每个在本章出现的物品，提取：
- description: 详细描述（外观、材质、特性等，至少20字）
- effects: 效果列表（type, value, description）
- origin: 来源或制作者
- rarity: common/uncommon/rare/legendary
- related_skills: 使用该物品需要的技能id列表

### 事件卡
提取本章中发生的所有重要事件：
- id: "evt_章节号_序号" 格式
- name: 事件名称
- participants: 参与角色id列表
- location: 发生地点id
- description: 事件详细描述（至少20字）

### 对话片段
提取本章中所有关键对话（至少5段）：
- speaker: 说话人角色id
- listener: 听话人角色id或null
- text: 对话原文
- tone: 语气标签
- chapter: 章节号

## 输出格式（纯 JSON）
{
  "chapter": <章节号>,
  "characters_detail": [{"id":"char_xxx","personality":{"traits":[],"speech_style":"","temperament":""},"archetype":"","relationships":[{"target":"","type":"","intensity":0,"bond_level":0,"dynamic":""}],"known_skills":[],"related_skills":[]}],
  "skills_detail": [{"id":"skill_xxx","techniques":[{"id":"","name":"","type":"","description":""}],"progression":[{"level":0,"unlock":""}],"effects":[],"combat_style":""}],
  "items_detail": [{"id":"item_xxx","description":"","effects":[],"origin":"","rarity":"","related_skills":[]}],
  "events": [{"id":"","name":"","participants":[],"location":"","description":""}],
  "dialogues": [{"speaker":"","listener":null,"text":"","tone":"","chapter":0}]
}
```

#### 并行策略

与骨架提取相同，可并行 spawn 多个 sub-agent 处理不同章节。

#### 物品补全（可选）

如果 deep 提取中物品信息不充分，可单独 spawn 一个 sub-agent 补充：

```
你是武侠小说物品分析专家。根据以下物品索引和章节原文，补全物品的详细信息。

## 物品索引
（从 skeleton 中提取的 items 列表）

## 章节原文
（章节全文）

## 输出格式
{"items_detail": [{"id":"item_xxx","description":"","effects":[],"origin":"","rarity":"","related_skills":[]}]}
```

---

### Step 3: 合并全局数据

**触发条件**：`deep.done` = total 但 `merge` = false

```bash
python tools/merge/merge-chapters.py "<小说目录>"
```

**输出**：`characters.json`, `skills.json`, `factions.json`, `locations.json`, `items.json`, `techniques.json`, `events.json`, `dialogues.json`

### Step 4: 生成 Markdown 卡片

**触发条件**：`merge` = true 但卡片不完整

```bash
python tools/convert/json-to-markdown.py "<小说目录>"
python tools/convert/json-to-items-markdown.py "<小说目录>"
python tools/convert/generate-event-cards.py "<小说目录>"
```

### Step 5: Wikilink 修复（可选）

统一 wikilink 格式为 `[[目录/中文名]]`：
- `[[characters/段誉]]`、`[[locations/剑湖宫]]`、`[[skills/一阳指]]`

### Step 6: 验证

**触发条件**：所有步骤完成

```bash
python tools/verify/verify-card-output-pipeline.py "<小说目录>"
```

---

## 完整执行示例（骨架提取）

假设需要提取第 1-3 章的骨架：

```python
# 主 agent 伪代码
for ch_num in [1, 2, 3]:
    # 1. 读取章节原文
    chapter_text = read_file(f"{novel_dir}/ch_formatted/ch_{ch_num:02d}.md")

    # 2. 构建 prompt
    prompt = f"""你是武侠小说骨架提取专家...（规则）...
    ## 第 {ch_num} 章原文
    {chapter_text}"""

    # 3. spawn sub-agent（后台并行）
    task(prompt=prompt, run_in_background=true)

# 4. 等待所有 sub-agent 完成
wait()

# 5. 逐个收集结果，验证 JSON，保存文件
for ch_num in [1, 2, 3]:
    result = collect_result(ch_num)
    json_data = validate_and_parse(result)
    save_file(f"chapters/ch_{ch_num:02d}_skeleton.json", json_data)
    update_progress("skeleton", ch_num)
```

## 完整执行示例（精细提取）

假设需要精细提取第 1 章：

```python
# 1. 读取骨架数据
skeleton = read_file(f"{novel_dir}/chapters/ch_01_skeleton.json")

# 2. 读取章节原文
chapter_text = read_file(f"{novel_dir}/ch_formatted/ch_01.md")

# 3. 格式化骨架索引
skeleton_index = format_skeleton_index(skeleton)  # 转为人类可读文本

# 4. 构建 prompt
prompt = f"""你是顶尖的武侠小说精细提取专家...
## 骨架索引
{skeleton_index}
## 第 1 章原文
{chapter_text}"""

# 5. spawn sub-agent
result = task(prompt=prompt)

# 6. 验证并保存
json_data = validate_and_parse(result)
save_file(f"chapters/ch_01_deep.json", json_data)
update_progress("deep", 1)
```

---

## 断点续传

每个步骤通过 `progress.json` 跟踪进度，中断后重新运行即可继续。

**强制重跑某章**：删除 `progress.json` 中对应章节号，或删除对应的 JSON 文件后重跑。

## 常见问题

**Q: Sub-agent 返回的 JSON 格式不对？**
A: Sub-agent 可能包含 markdown 代码块标记。收集结果后先清理：移除 ```json 和 ``` 标记，然后尝试 JSON.parse。如果仍然失败，重新 spawn 该章节的 sub-agent。

**Q: 如何控制并行度？**
A: 通过 `task(run_in_background=true)` 的数量控制。建议每次 3-5 个并行，避免 context 过大。等一批完成后再启动下一批。

**Q: 提取结果不准确？**
A: 检查并调整 prompt 模板中的规则描述。可以增加 few-shot 示例来提高准确性。

**Q: 如何添加新小说？**
A: `python tools/setup-novel-dirs.py "<作者>/<小说名>"`，然后按流程执行。

**Q: 如何查看进度？**
A: `cat <小说目录>/progress.json | python -m json.tool`
