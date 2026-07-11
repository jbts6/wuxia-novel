# 任务：为《鹿鼎记》生成知识库基准数据

## 小说信息
- 小说名称：鹿鼎记
- 作者：Unknown
- 章节数：0
- 原文路径：/Users/jbts6/Site/wuxia-novel/金庸/鹿鼎记/鹿鼎记.txt

## 已有角色 ID 参考


## 高频提及术语（供参考）
韦小宝、康熙、吴三桂、阿珂、双儿、天地会、鳌拜、郑克塽、陈近南、方怡、北京、施琅、台湾、沐剑屏、扬州、云南、胖头陀、多隆、索额图、沐王府、冯锡范、九难、五台山、神龙教、瘦头陀、风际中、少林寺、陆高轩、皇宫、清凉寺、四十二章经、陶红英、苏荃、神龙岛、丽春院、归二娘、建宁公主、曾柔、归辛树、海大富、归钟、平西王府、明珠、洪安通、王屋派、毛东珠、化骨绵掌、鹿鼎山、神行百变、化尸粉

## Prompt 模板

# Baseline Generation Prompt

基于对本书的认知，生成**独立金标** `build/baseline.json`，用于评估 KB 完整性。  
**禁止**从 `data/*.json` 拷贝全量实体。

## 输入

- 小说名称：`{{novel_name}}`
- 作者：`{{author}}`
- 原文路径：`{{novel_path}}`（应用原文核对 quote / 专名）

## 契约（硬性）

| 项 | 要求 |
|----|------|
| 角色规模 | **15–25** 人短名单（core+important+secondary 为主；minor 少） |
| 与未来 KB | 金标是「应有的核心集合」，不是 data 镜像；id 可与后续 KB 对齐，但勿等 KB 写完再反抄 |
| relationships | ≥15；`importance` **仅英文**：`core` \| `important` \| `secondary` |
| events | ≥20；按章号为 key；`importance` **仅英文**：`main` \| `branch` \| `detail` |
| dialogues | ≥10；必须含可在原文命中的 `quote`；勿复制 data/dialogues |
| 实体名 | 须能在原文出现（无幻觉） |
| items 名 | 用具名（如「飞刀」），避免单字「剑」「刀」 |

## 输出结构

```json
{
  "novel": "小说名称",
  "author": "作者",
  "generated_at": "ISO 时间戳",
  "characters": {
    "core": [
      {
        "id": "char_xxx",
        "name": "角色名",
        "importance": "core",
        "reason": "为何核心",
        "expected_identity": "身份",
        "expected_traits": ["特征1", "特征2"]
      }
    ],
    "important": [],
    "secondary": [],
    "minor": []
  },
  "factions": [
    { "id": "faction_xxx", "name": "门派", "importance": "core", "reason": "..." }
  ],
  "relationships": [
    {
      "source": "char_xxx",
      "target": "char_yyy",
      "type": "恋人",
      "importance": "core",
      "reason": "..."
    }
  ],
  "events": {
    "1": [
      { "event": "可在章摘要中匹配的关键词事件", "importance": "main", "characters": ["char_xxx"] }
    ]
  },
  "skills": [
    { "id": "skill_xxx", "name": "武功名", "importance": "core", "reason": "..." }
  ],
  "items": [
    { "id": "item_xxx", "name": "物品名", "importance": "important", "reason": "..." }
  ],
  "dialogues": [
    {
      "chapter": 1,
      "speaker": "角色名",
      "quote": "必须是原文子串",
      "expected_style": "说话风格",
      "reason": "为何经典"
    }
  ]
}
```

## 分级（写入 JSON 时用英文 importance）

**角色 / 关系**

- `core`：绝对主角或主角间关系  
- `important`：主线关键配角 / 主角–配角关系  
- `secondary`：有戏份配角 / 配角间关系  

**事件**

- `main`：主线转折  
- `branch`：重要支线  
- `detail`：细节（少用）  

中文说明仅用于思考，**JSON 字段值必须是英文 key**。

## 原则

1. 先验 + 原文可验证，宁缺毋滥（角色勿「宁多勿少」灌龙套）  
2. ID：`char_` / `faction_` / `skill_` / `item_` + 拼音逐字  
3. relationship.type 用 constants 枚举（挚友/恋人/师徒/宿敌/对手/主仆/合作者/亲属）  
4. events 的 `event` 字符串应能与 chapter_summaries.key_events 或回目关键词匹配  

## 输出

完整可 parse 的 JSON，直接写入 `build/baseline.json`。


## 输出要求

请生成完整的 baseline.json，包含：
1. characters：按核心/重要/次要/龙套分级
2. relationships：所有重要关系对
3. events：每章重要事件
4. skills：重要武功/技能
5. items：重要物品
6. dialogues：代表性对话示例

输出格式为 JSON，直接写入文件。
