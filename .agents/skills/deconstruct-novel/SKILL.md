---
name: deconstruct-novel
description: 解构武侠小说，从排版后的原文中提取人物、武功、物品、地点、势力、事件等结构化数据。Use when user wants to extract structured data from a novel, deconstruct a wuxia novel, or build a knowledge base from novel text.
---

# 解构小说（限流 + 文件直写版）

核心改进：
- **限流保护**：每批 5 个 sub-agent，批次间隔 3 秒，防止 RPM=100 限流
- **上下文优化**：sub-agent 直接写文件，只返回状态摘要，避免主 agent 上下文爆炸
- **断点续传**：每个步骤通过 `progress.json` 跟踪进度

## 快速开始

```bash
# 1. 检查进度
cat <小说目录>/progress.json

# 2. 根据进度执行对应步骤（见下方流程）
```

---

## 并行限流策略

### 核心参数

```
MAX_CONCURRENT = 5      # 每批最多 5 个 sub-agent
BATCH_INTERVAL = 3      # 批次间隔 3 秒
```

### 为什么这样设计？

- Mimo RPM 限制 = 100 请求/分钟
- 5 并发 × 12 批/分钟 = 60 RPM（安全余量充足）
- 批次间隔 3 秒确保不会突发超限

### 主 Agent 批次执行伪代码

```python
def process_in_batches(chapters, max_concurrent=5, interval=3):
    """限流批次处理 - 主 agent 使用"""
    for i in range(0, len(chapters), max_concurrent):
        batch = chapters[i:i + max_concurrent]
        
        # 并行 spawn 当前批次
        jobs = []
        for ch in batch:
            job = task(
                prompt=build_prompt(ch),
                run_in_background=true,
                description=f"提取第 {ch} 章"
            )
            jobs.append(job)
        
        # 等待当前批次完成（不收集内容）
        wait(jobs)
        
        # 批次间隔（除了最后一批）
        if i + max_concurrent < len(chapters):
            sleep(interval)
```

---

## Sub-Agent 文件直写模式

### 核心原则

**❌ 旧模式（上下文爆炸）**：
```
sub-agent → 返回完整 JSON → 主 agent 解析 → 主 agent 写文件
           （5KB+ JSON 进入主上下文）
```

**✅ 新模式（上下文安全）**：
```
sub-agent → 直接写文件 → 返回状态摘要（~100 字节）
           （JSON 不进入主上下文）
```

### Sub-Agent 必须包含的工具

每个 sub-agent prompt 必须明确指示使用 `write_file` 工具：

```
你是武侠小说提取专家。

## 任务
提取第 {N} 章的 {骨架/精细} 数据。

## 输出要求
1. 完成提取后，使用 write_file 工具保存结果到指定路径
2. 保存路径: {novel_dir}/chapters/ch_{N:02d}_{skeleton/deep}.json
3. 最终输出只需一行状态摘要，格式如下：

✅ 第 {N} 章提取完成，已保存到 chapters/ch_{N:02d}_{skeleton/deep}.json

## 提取规则
（具体规则...）
```

### 主 Agent 验证方式

主 agent **不读取** sub-agent 写入的文件内容，只验证文件存在：

```python
# 验证文件存在（不读内容）
rtk ls {novel_dir}/chapters/ch_{N:02d}_skeleton.json

# 如果文件不存在，重新 spawn 该章节
```

---

## 核心流程

### Step 0: 检查进度

读取 `<小说目录>/progress.json`，判断当前状态：

**决策树**：

| 条件 | 下一步 |
| --- | --- |
| `ch_formatted/` 不存在或不完整 | 先用 `batch-format-novel` skill 排版 |
| `progress.json` 不存在 | 运行 `setup-novel-dirs.py` 初始化 |
| `skeleton.done` 长度 < skeleton.total | 继续骨架提取（限流批次模式） |
| `skeleton.done` = total 但 `deep.done` < deep.total | 继续精细提取（限流批次模式） |
| `deep.done` = total 但 `merge` = false | 合并数据：`merge-chapters.py` |
| `merge` = true 但 Markdown 卡片不完整 | 生成卡片：`json-to-markdown.py` 等 |
| 全部完成 | 验证：`verify-card-output-pipeline.py` |

---

### Step 1: 骨架提取（限流批次）

**触发条件**：`skeleton.done` 长度 < `skeleton.total`

#### 流程

1. **加载进度**，确定需要提取的章节列表（跳过已完成）
2. **分批处理**：每批 5 个章节，批次间隔 3 秒
3. **每个章节**的 sub-agent 执行：

```
a. 读取章节原文：ch_formatted/ch_XX.md
b. 执行提取
c. 直接写文件到 chapters/ch_XX_skeleton.json
d. 输出状态摘要
```

4. **主 agent 验证**：检查文件存在，更新 progress.json

#### Sub-Agent Prompt 模板（骨架提取）

构建 prompt 时使用以下结构：

```
你是武侠小说骨架提取专家。从以下章节原文中提取所有出现的人物、门派、地点、武功、物品。

## 任务
提取第 {N} 章的骨架数据。

## 提取规则
- 只提取本章实际出现的实体
- 门派如有宗门分支（如无量剑东宗/西宗），作为一个门派，宗门作为 sub_divisions
- 武功需有具体描写，不能只是"武功很高"
- 段誉的武功分两层：known_skills（已掌握）和 related_skills（家族/门派关联但尚未学会）
- ID 格式：char_拼音 / faction_拼音 / loc_拼音 / skill_拼音 / item_拼音

## 输出要求
1. 完成提取后，使用 write_file 工具保存 JSON 到: {novel_dir}/chapters/ch_{N:02d}_skeleton.json
2. JSON 格式如下：
{
  "chapter": <章节号>,
  "characters": [{"id":"char_xxx","name":"名字","alias":["别名"],"identity":"身份","faction":"faction_id或null","role":"protagonist/companion/npc/villain","one_line":"一句话描述","personality":"一句话性格","known_skills":[],"related_skills":[]}],
  "factions": [{"id":"faction_xxx","name":"名字","type":"武林门派/帮派/家族","location":"loc_id","sub_divisions":[],"one_line":"一句话描述"}],
  "locations": [{"id":"loc_xxx","name":"名字","region":"地理区域","one_line":"一句话描述"}],
  "skills": [{"id":"skill_xxx","name":"名字","type":"剑法/掌法/内功/轻功/暗器/指法","faction":"","one_line":"一句话描述"}],
  "items": [{"id":"item_xxx","name":"名字","type":"weapon/armor/pill/poison/hidden_weapon/special","owner":"char_id或null","one_line":"一句话描述"}]
}

3. 最终输出只需一行：
✅ 第 {N} 章骨架提取完成，已保存到 chapters/ch_{N:02d}_skeleton.json

## 第 {N} 章原文

（此处嵌入章节全文）
```

#### 主 Agent 执行代码

```python
# 获取待处理章节列表
pending_chapters = get_pending_skeleton_chapters(novel_dir)

# 分批处理
for i in range(0, len(pending_chapters), MAX_CONCURRENT):
    batch = pending_chapters[i:i + MAX_CONCURRENT]
    
    print(f"📦 处理批次 {i//MAX_CONCURRENT + 1}: 第 {batch} 章")
    
    # 并行 spawn
    for ch_num in batch:
        chapter_text = read_file(f"{novel_dir}/ch_formatted/ch_{ch_num:02d}.md")
        prompt = build_skeleton_prompt(ch_num, chapter_text, novel_dir)
        task(prompt=prompt, run_in_background=true, description=f"骨架提取-第{ch_num}章")
    
    # 等待批次完成
    wait()
    
    # 验证文件并更新进度
    for ch_num in batch:
        file_path = f"{novel_dir}/chapters/ch_{ch_num:02d}_skeleton.json"
        if file_exists(file_path):
            update_progress("skeleton", ch_num)
            print(f"✅ 第 {ch_num} 章骨架提取完成")
        else:
            print(f"❌ 第 {ch_num} 章骨架提取失败，需要重试")
    
    # 批次间隔
    if i + MAX_CONCURRENT < len(pending_chapters):
        print(f"⏳ 等待 {BATCH_INTERVAL} 秒后处理下一批...")
        sleep(BATCH_INTERVAL)
```

---

### Step 2: 精细提取（限流批次）

**触发条件**：`skeleton.done` = total 但 `deep.done` < deep.total

#### 流程

与骨架提取相同的限流批次模式，但 prompt 不同。

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

## 任务
精细提取第 {N} 章的详细数据。

## 核心规则
1. 所有数组字段必须填充，禁止留空数组 []（除非确实没有内容）
2. 所有字符串字段必须有值，禁止空字符串 ""（无法确定时合理推断）
3. 严格基于原文，不要编造原文中没有的内容
4. 阅读本章全部原文后再提取，不要遗漏出场人物和事件

## 输出要求
1. 完成提取后，使用 write_file 工具保存 JSON 到: {novel_dir}/chapters/ch_{N:02d}_deep.json
2. JSON 格式如下：
{
  "chapter": <章节号>,
  "characters_detail": [{"id":"char_xxx","personality":{"traits":[],"speech_style":"","temperament":""},"archetype":"","relationships":[{"target":"","type":"","intensity":0,"bond_level":0,"dynamic":""}],"known_skills":[],"related_skills":[]}],
  "skills_detail": [{"id":"skill_xxx","techniques":[{"id":"","name":"","type":"","description":""}],"progression":[{"level":0,"unlock":""}],"effects":[],"combat_style":""}],
  "items_detail": [{"id":"item_xxx","description":"","effects":[],"origin":"","rarity":"","related_skills":[]}],
  "events": [{"id":"","name":"","participants":[],"location":"","description":""}],
  "dialogues": [{"speaker":"","listener":null,"text":"","tone":"","chapter":0}]
}

3. 最终输出只需一行：
✅ 第 {N} 章精细提取完成，已保存到 chapters/ch_{N:02d}_deep.json

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
```

#### 主 Agent 执行代码

```python
# 获取待处理章节列表
pending_chapters = get_pending_deep_chapters(novel_dir)

# 分批处理
for i in range(0, len(pending_chapters), MAX_CONCURRENT):
    batch = pending_chapters[i:i + MAX_CONCURRENT]
    
    print(f"📦 处理批次 {i//MAX_CONCURRENT + 1}: 第 {batch} 章")
    
    # 并行 spawn
    for ch_num in batch:
        # 读取骨架数据并格式化
        skeleton_json = read_file(f"{novel_dir}/chapters/ch_{ch_num:02d}_skeleton.json")
        skeleton_index = format_skeleton_index(skeleton_json)
        
        # 读取章节原文
        chapter_text = read_file(f"{novel_dir}/ch_formatted/ch_{ch_num:02d}.md")
        
        # 构建 prompt
        prompt = build_deep_prompt(ch_num, skeleton_index, chapter_text, novel_dir)
        task(prompt=prompt, run_in_background=true, description=f"精细提取-第{ch_num}章")
    
    # 等待批次完成
    wait()
    
    # 验证文件并更新进度
    for ch_num in batch:
        file_path = f"{novel_dir}/chapters/ch_{ch_num:02d}_deep.json"
        if file_exists(file_path):
            update_progress("deep", ch_num)
            print(f"✅ 第 {ch_num} 章精细提取完成")
        else:
            print(f"❌ 第 {ch_num} 章精细提取失败，需要重试")
    
    # 批次间隔
    if i + MAX_CONCURRENT < len(pending_chapters):
        print(f"⏳ 等待 {BATCH_INTERVAL} 秒后处理下一批...")
        sleep(BATCH_INTERVAL)
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

## 断点续传

每个步骤通过 `progress.json` 跟踪进度，中断后重新运行即可继续。

**强制重跑某章**：删除 `progress.json` 中对应章节号，或删除对应的 JSON 文件后重跑。

**重试失败章节**：

```python
# 找出失败的章节（progress 中标记完成但文件不存在）
failed = []
for ch_num in progress["skeleton"]["done"]:
    if not file_exists(f"{novel_dir}/chapters/ch_{ch_num:02d}_skeleton.json"):
        failed.append(ch_num)
        progress["skeleton"]["done"].remove(ch_num)

# 重新处理失败的章节
if failed:
    process_in_batches(failed)
```

---

## 常见问题

**Q: Sub-agent 返回的内容被截断？**
A: 这是正常的，因为我们只关心状态摘要。只要文件存在且 progress.json 更新了，提取就成功了。

**Q: 如何确认 sub-agent 成功写入了文件？**
A: 检查文件存在性：`rtk ls {novel_dir}/chapters/ch_XX_skeleton.json`。文件存在即成功。

**Q: 某个章节提取失败怎么处理？**
A: 删除该章节的 progress.json 记录，重新运行即可。系统会自动重试。

**Q: 如何调整并行度？**
A: 修改 `MAX_CONCURRENT` 参数。降低可减少 RPM 压力，提高可加快处理速度。

**Q: 批次间隔可以缩短吗？**
A: 可以，但不建议低于 2 秒。Mimo RPM=100 时，5 并发 + 2 秒间隔 = 75 RPM，仍有风险。

**Q: 如何查看实时进度？**
A: `watch -n 1 'cat <小说目录>/progress.json | python -m json.tool'`

---

## 性能预估

假设小说 50 章，每章处理时间约 30 秒：

| 指标 | 数值 |
|------|------|
| 骨架提取批次 | 10 批 |
| 骨架提取总时间 | ~5.5 分钟（含间隔） |
| 精细提取批次 | 10 批 |
| 精细提取总时间 | ~5.5 分钟（含间隔） |
| 峰值 RPM | 60 RPM（安全） |
| 主 Agent 上下文占用 | ~2 KB（仅状态摘要） |

---

## 添加新小说

```bash
python tools/setup-novel-dirs.py "<作者>/<小说名>"
```

然后按流程执行。
