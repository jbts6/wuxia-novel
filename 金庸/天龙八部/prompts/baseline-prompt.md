# 任务：为《天龙八部》生成知识库基准数据

## 小说信息
- 小说名称：天龙八部
- 作者：Unknown
- 章节数：0
- 原文路径：/Users/jbts6/Site/wuxia-novel/金庸/天龙八部/天龙八部.txt

## 已有角色 ID 参考
- char_duan_yu: 段誉
- char_xiao_feng: 萧峰
- char_xu_zhu: 虚竹
- char_a_zhu: 阿朱
- char_a_zi: 阿紫
- char_wang_yu_yan: 王语嫣
- char_mu_rong_fu: 慕容复
- char_duan_zheng_chun: 段正淳
- char_mu_wan_qing: 木婉清
- char_jiu_mo_zhi: 鸠摩智
- char_you_tan_zhi: 游坦之
- char_zhong_ling: 钟灵
- char_ding_chun_qiu: 丁春秋
- char_xuan_ci: 玄慈
- char_li_qiu_shui: 李秋水
- char_ye_lv_hong_ji: 耶律洪基
- char_mu_rong_bo: 慕容博
- char_xiao_yuan_shan: 萧远山
- char_duan_yan_qing: 段延庆
- char_dao_bai_feng: 刀白凤

## 高频提及术语（供参考）
段誉、萧峰、虚竹、乔峰、阿紫、阿朱、王语嫣、慕容复、少林、段正淳、木婉清、大理、丐帮、鸠摩智、游坦之、钟灵、丁春秋、西夏、星宿、王夫人、玄慈、李秋水、耶律洪基、姑苏、慕容博、灵鹫宫、六脉神剑、慕容氏、段氏、辽国、秦红棉、生死符、阮星竹、萧远山、刀白凤、雁门关、青城、无量剑、逍遥派、缥缈峰、一阳指、无崖子、凌波微步、聚贤庄、天山、无量山、甘宝宝、少室山、火焰刀、小无相功

## Prompt 模板

# Baseline Generation Prompt

你是一个武侠小说知识库质量评估专家。你的任务是基于对小说的认知，生成一个**基准数据**（baseline），用于评估知识库的完整性。

## 输入

- 小说名称：`{{novel_name}}`
- 作者：`{{author}}`
- 原文路径：`{{novel_path}}`（可选，用于参考）

## 输出格式

输出一个 JSON 文件，结构如下：

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
        "importance": "核心",
        "reason": "为什么是核心角色",
        "expected_identity": "预期身份定位",
        "expected_traits": ["性格特征1", "性格特征2"]
      }
    ],
    "important": [...],
    "secondary": [...],
    "minor": [...]
  },
  "factions": [
    {
      "id": "fac_xxx",
      "name": "门派名",
      "importance": "核心",
      "reason": "为什么重要"
    }
  ],
  "relationships": [
    {
      "source": "char_xxx",
      "target": "char_yyy",
      "type": "恋人",
      "importance": "核心",
      "reason": "为什么这个关系重要"
    }
  ],
  "events": {
    "1": [
      {
        "event": "事件描述",
        "importance": "主线",
        "characters": ["char_xxx"]
      }
    ]
  },
  "skills": [
    {
      "id": "skill_xxx",
      "name": "武功名",
      "importance": "核心",
      "reason": "为什么重要"
    }
  ],
  "items": [
    {
      "id": "item_xxx",
      "name": "物品名",
      "importance": "重要",
      "reason": "为什么重要"
    }
  ],
  "dialogues": [
    {
      "chapter": 1,
      "speaker": "角色名",
      "expected_style": "说话风格",
      "reason": "为什么这段对话代表性"
    }
  ]
}
```

## 角色分级标准

- **核心**：小说的绝对主角，故事围绕他们展开（通常 1-3 人）
- **重要**：对剧情有重大影响的配角，有完整的人物弧线（通常 5-15 人）
- **次要**：有一定戏份但不是主线关键的配角（通常 10-30 人）
- **龙套**：出场次数少但有名字的角色（通常 20-50 人）
- **背景**：仅被提及但未正面出场的角色

## 关系分级标准

- **核心**：主角之间的关系（如段誉↔王语嫣）
- **重要**：主角与重要配角之间的关系
- **次要**：配角之间的关系

## 事件分级标准

- **主线**：推动故事核心发展的事件（如主角登场、重大转折）
- **支线**：重要但非核心的事件（如配角的故事线）
- **细节**：丰富世界观的事件（如日常互动、背景交代）

## 指导原则

1. **基于对书籍的认知**：利用你对这本书的了解来生成基准
2. **ID 规则**：使用 `char_`、`fac_`、`skill_`、`item_` 前缀，拼音逐字拆分
3. **完整性**：尽量覆盖所有重要实体，宁多勿少
4. **准确性**：确保角色分级、关系类型、事件描述准确
5. **可验证性**：每个实体都要说明为什么重要

## 示例（天龙八部部分）

```json
{
  "novel": "天龙八部",
  "author": "金庸",
  "characters": {
    "core": [
      {
        "id": "char_duan_yu",
        "name": "段誉",
        "importance": "核心",
        "reason": "三大主角之一，大理段氏世子",
        "expected_identity": "大理段氏世子，后为大理皇帝",
        "expected_traits": ["善良", "书生气", "痴情", "幽默", "不谙世事"]
      },
      {
        "id": "char_xiao_feng",
        "name": "萧峰",
        "importance": "核心",
        "reason": "三大主角之一，丐帮帮主",
        "expected_identity": "丐帮帮主，契丹人",
        "expected_traits": ["豪迈", "义薄云天", "悲情", "武功盖世", "正直"]
      },
      {
        "id": "char_xu_zhu",
        "name": "虚竹",
        "importance": "核心",
        "reason": "三大主角之一，少林弟子",
        "expected_identity": "少林弟子，后为灵鹫宫主",
        "expected_traits": ["老实", "善良", "迂腐", "运气好", "痴情"]
      }
    ],
    "important": [
      {
        "id": "char_wang_yu_yan",
        "name": "王语嫣",
        "importance": "重要",
        "reason": "段誉的恋人，知晓天下武功"
      }
    ]
  },
  "relationships": [
    {
      "source": "char_duan_yu",
      "target": "char_wang_yu_yan",
      "type": "恋人",
      "importance": "核心",
      "reason": "段誉痴恋王语嫣，最终相守"
    },
    {
      "source": "char_xiao_feng",
      "target": "char_a_zhu",
      "type": "恋人",
      "importance": "核心",
      "reason": "萧峰与阿朱的爱情悲剧"
    }
  ],
  "events": {
    "1": [
      {
        "event": "段誉初入无量山",
        "importance": "主线",
        "characters": ["char_duan_yu"]
      }
    ],
    "19": [
      {
        "event": "聚贤庄血战",
        "importance": "主线",
        "characters": ["char_xiao_feng"]
      }
    ]
  }
}
```

## 输出要求

1. 输出完整的 JSON，不要省略
2. 确保 JSON 格式正确，可以直接 parse
3. 角色 ID 必须与知识库中的 ID 一致
4. 事件按章节组织
5. 关系包含 source、target、type、importance


## 输出要求

请生成完整的 baseline.json，包含：
1. characters：按核心/重要/次要/龙套分级
2. relationships：所有重要关系对
3. events：每章重要事件
4. skills：重要武功/技能
5. items：重要物品
6. dialogues：代表性对话示例

输出格式为 JSON，直接写入文件。
