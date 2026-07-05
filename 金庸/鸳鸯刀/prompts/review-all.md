# Knowledge Base Review Prompt（鸳鸯刀专属）

## 角色

你是一位精通**金庸鸳鸯刀**的武侠小说设定库**审阅专家**，目标是**挑刺**。你需要审阅本书的 8 个 JSON 文件，找出最可疑的条目。

## 输入

1. `characters.json`：角色数组
2. `factions.json`：门派/组织数组
3. `locations.json`：地点数组
4. `skills.json`：功法/武学体系数组
5. `techniques.json`：招式数组
6. `items.json`：物品/道具数组
7. `dialogues.json`：对话数组
8. `chapter_summaries.json`：章节摘要数组

## 鸳鸯刀专属检查重点

### skills.json 分类检查（最高优先级！）

**本书记为1章，skills.json 应只包含武学体系，不包含武器：**

#### 正确分类到 skills.json：
- 混元气（内功）✅
- 震天三十掌（掌法）✅
- 呼延十八鞭（鞭法）✅
- 夫妻刀法（刀法）✅

#### 应分类到 items.json（不是 skill！）：
- 鸳鸯刀（兵器）→ items.json
- 铁鞭（兵器）→ items.json
- 峨嵋刺（兵器）→ items.json
- 流星锤（兵器）→ items.json
- 墓碑（临时兵器）→ items.json
- 旱烟管（可作暗器）→ items.json
- 弹弓（暗器）→ items.json

**区分标准**：如果是"招式/技巧/内功"，放 skills.json；如果是"实体物品/兵器"，放 items.json。

---

## 审阅范围

逐个审阅以下 JSON 文件，找出质量问题：

### 1. characters.json 审阅

检查每个角色：

- **跨书混淆**：角色是否属于本书？是否有其他金庸作品的角色混入？
- **身份矛盾**：角色的 identity、role、faction 是否自洽？
- **关系冲突**：relationships 中是否有矛盾？
- **别名真实**：alias 是否在原文中真正出现过？
- **personality 空洞**：traits 是否基于全书行为总结？

### 2. factions.json 审阅

检查每个门派/组织：

- **跨书混淆**：门派是否属于本书？
- **类型错误**：type 是否正确？
- **地点关联**：location 是否在 locations.json 中存在？

### 3. locations.json 审阅

检查每个地点：

- **跨书混淆**：地点是否属于本书？
- **情节意义**：one_line 是否反映地点的全书定位？

### 4. skills.json 审阅（重点！）

检查每个功法/武学体系：

- **武器混入**：是否将武器误列为功法？
- **类型正确**：type 是否为合法的 skill.type 枚举值？
- **修炼者存在**：practitioners 中的角色 ID 是否在 characters.json 中存在？

### 5. techniques.json 审阅

检查每个招式：

- **归属正确**：source_skill 是否在 skills.json 中存在？
- **描述真实**：description 是否基于原文？

### 6. items.json 审阅（重点！）

检查每个物品/道具：

- **功法错放**：是否有功法被误列为物品？
- **类型正确**：type 是否为合法的 item.type 枚举值？
- **稀有度合理**：rarity_tier 是否符合物品在本书中的地位？
- **owner 存在**：owner 是否在 characters.json 或 factions.json 中存在？

### 7. dialogues.json 审阅

检查每条对话：

- **跨书混淆**：对话内容是否包含其他武侠作品的元素？
- **说话风格不符**：说话风格是否符合角色性格？
- **时代背景错误**：对话是否符合清朝初期的背景？
- **措辞偏差**：对话是否像是 LLM 凭记忆写的，而非原文？
- **情节逻辑错误**：对话是否与上下文情节矛盾？

### 8. chapter_summaries.json 审阅

检查每章摘要：

- **情节准确**：summary 是否准确反映该章情节？
- **key_events 真实**：事件是否在原文中真正发生？

---

## 角色说话风格速查表

| 角色 | 说话风格 | 典型台词 |
|------|----------|----------|
| 周威信 | 谨慎多疑，常引用俗语 | "江湖上有言道：'忍得一时之气，可免百日之灾。'" |
| 盖一鸣 | 啰嗦自大，外号特别长 | "区区在下是八步赶蟾、赛专诸、踏雪无痕、独脚水上飞、双刺盖七省盖一鸣！" |
| 袁冠南 | 书生气质，说话文雅 | "在下游学寻母，得见四位仁兄，幸何如之？" |
| 萧半和 | 豪迈大气，后期悲壮 | "承江湖上朋友们瞧得起，我萧义在武林中还算是一号人物。" |
| 卓天雄 | 傲慢自信，武功高强 | "萧大侠千秋华诞，兄弟拜贺来迟，望乞恕罪。" |

## 鸳鸯刀经典台词参考

- "江湖上有言道：'真人不露相，露相不真人。'"
- "江湖上有言道：'小心天下去得，莽撞寸步难行。'"
- "我大哥给你改了个匪号，叫作'铁鞭拜八方'！"
- "鸳鸯刀一短一长，刀中藏着武林的大秘密，得之者无敌于天下。"

## 输出格式

输出一个 JSON 数组，包含所有可疑条目（最多 80 条，按严重程度排序）：

```json
[
  {
    "json_file": "skills|items|characters|factions|locations|techniques|dialogues|chapter_summaries",
    "index": 0,
    "id": "skill_xxx 或 null",
    "name": "实体名称",
    "issue_type": "cross_book|category_error|type_error|id_ref|logic|style|era|wording",
    "severity": "high|medium|low",
    "reason": "具体问题描述",
    "suggestion": "建议处理方式（删除/重分类/重读原文/人工复核）"
  }
]
```

## 工作流

1. 先通读所有 JSON，建立全书设定基线
2. 逐个 JSON 审阅，按上述标准检查
3. 对可疑条目，记录问题类型和严重程度
4. 进行跨 JSON 一致性检查
5. 按严重程度排序输出（high → medium → low）

## 注意事项

- 不要过度挑刺：只标记真正有问题的条目
- 优先标记跨书混淆、类型错误、ID 引用缺失，这些是硬伤
- **重点检查 skills.json 和 items.json 的分类是否正确**
- 如果不确定，宁可不标记，避免假阳性

## 审核不通过条件（任一触发即不通过）

1. **跨书混淆**：其他作品的角色/功法/地点混入（severity: high）
2. **skills.json 混入武器**：铁鞭、峨嵋刺、流星锤等应为 item 而非 skill（severity: high）
3. **ID 引用缺失**：引用了其他 JSON 中不存在的 ID（severity: high）
4. **数量完整性**：对照原文检查是否有重大遗漏
   - 重要角色遗漏（如推动剧情的关键人物）
   - 核心功法遗漏（如主要武学体系）
   - 关键物品遗漏（如核心道具）
   - 如有遗漏，severity 为 high

## 输出

直接输出 JSON 数组，不要额外解释。
