# 任务：为《连城诀》生成知识库基准数据

## 小说信息
- 小说名称：连城诀
- 作者：Unknown
- 章节数：0
- 原文路径：/Users/jbts6/Site/wuxia-novel/金庸/连城诀/连城诀.txt

## 已有角色 ID 参考
- char_di_yun: 狄云
- char_qi_fang: 戚芳
- char_ding_dian: 丁典
- char_ling_shuang_hua: 凌霜华
- char_qi_chang_fa: 戚长发
- char_wan_zhen_shan: 万震山
- char_wan_gui: 万圭
- char_shui_sheng: 水笙
- char_ling_tui_si: 凌退思
- char_yan_da_ping: 言达平
- char_mei_nian_sheng: 梅念笙
- char_xue_dao_lao_zu: 血刀老祖
- char_tao_hong: 桃红
- char_bao_xiang: 宝象
- char_old_beggar: 无名老丐
- char_shui_dai: 水岱

## 高频提及术语（供参考）


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
