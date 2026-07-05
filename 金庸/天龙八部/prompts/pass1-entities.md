# 天龙八部 — 实体生成 prompt（Pass 1）

## 角色

你是一位精通金庸《天龙八部》的武侠小说研究者。你的任务是为本书生成知识库的**实体详细信息**，包括角色、门派、地点、武功的完整属性。

## 输入

1. `manifest.json`：章节清单（50 章）
2. `mention_summary.json`：高频实体提及汇总
3. `outline.json`：实体清单大纲（如有）
4. 原文采样：前 3 章 + 中间 2 章 + 最后 2 章

## 输出

生成 5 个 JSON 文件：
- `characters.json`：角色详细信息
- `factions.json`：门派详细信息
- `locations.json`：地点详细信息
- `skills.json`：武功详细信息
- `techniques.json`：招式详细信息

## 本书叙事风格描述

**金庸典雅白话**：语言文白相间，叙事宏大，人物众多，情节复杂。对话文雅，符合宋代语言特色。叙事视角多变，常在不同角色间切换。

**关键特征**：
- 多线并行叙事（段誉线、乔峰/萧峰线、虚竹线）
- 草蛇灰线，伏笔千里
- 悲剧英雄主义
- 佛教宿命论色彩浓厚
- 江湖恩怨与家国大义交织

## 关键事件时间线（基于 mention_summary 推断）

**段誉线**：
- ch1-3：无量山初遇钟灵、木婉清
- ch4-9：大理宫廷风波，与木婉清的感情
- ch10-13：鸠摩智绑架，六脉神剑首次出现
- ch14-18：与王语嫣相识，慕容复出场
- ch29-34：西夏公主选驸马，王语嫣线
- ch44-50：最终结局

**乔峰/萧峰线**：
- ch14-16：丐帮帮主身份（此时名为乔峰），身世之谜初现
- ch17-20：乔峰聚贤庄血战，身世大白
- ch21-28：改名萧峰，与阿朱的爱情，阿朱之死
- ch41-50：辽国风云，萧峰雁门关自尽

**虚竹线**：
- ch29-32：少林寺出场，误入逍遥派
- ch35-40：天山童姥、李秋水争斗
- ch41-48：成为灵鹫宫主，与梦姑的爱情

## source_ref 锚定策略

**first_mention（首次登场）**：
- 角色第一次出场的章节
- 例：段誉 ch1，乔峰 ch14（ch21 后改名萧峰），虚竹 ch29

**climax（高潮事件）**：
- 角色的决定性时刻
- 例：乔峰聚贤庄血战 ch19，段誉六脉神剑显威 ch10，虚竹成为灵鹫宫主 ch40

**resolution（结局）**：
- 角色的最终归宿
- 例：萧峰雁门关自尽 ch50，段誉回大理 ch50，虚竹与梦姑重逢 ch50

**background（背景信息）**：
- 角色的身世、过往
- 例：萧远山雁门关血案（ch21 追溯性提及，事件发生在故事开始前约30年），慕容博阴谋 ch42-43

## ID 命名示例

**角色 ID**：
- `char_duan_yu`（段誉）
- `char_xiao_feng`（萧峰）
- `char_xu_zhu`（虚竹）
- `char_a_zhu`（阿朱）
- `char_a_zi`（阿紫）
- `char_wang_yu_yan`（王语嫣）
- `char_mu_rong_fu`（慕容复）

**门派 ID**：
- `fac_shao_lin`（少林）
- `fac_gai_bang`（丐帮）
- `fac_xing_xiu`（星宿派）
- `fac_xiao_yao`（逍遥派）
- `fac_wu_liang_jian`（无量剑）
- `fac_ling_jiu_gong`（灵鹫宫）

**地点 ID**：
- `loc_da_li`（大理）
- `loc_xi_xia`（西夏）
- `loc_gu_su`（姑苏）
- `loc_yan_men_guan`（雁门关）
- `loc_ju_xian_zhuang`（聚贤庄）

**武功 ID**：
- `skill_liu_mai_shen_jian`（六脉神剑）
- `skill_yi_yang_zhi`（一阳指）
- `skill_ling_bo_wei_bu`（凌波微步）
- `skill_xiang_long_shi_ba_zhang`（降龙十八掌）
- `skill_tian_shan_liu_yang_zhang`（天山六阳掌）

## 已知陷阱

### 本书容易被遗漏的角色
- **游坦之**：出场较晚（ch19），但对阿紫的痴情是重要支线
- **耶律洪基**：出场少（4 章），但对萧峰的命运有关键影响
- **萧远山**：前期隐匿，后期才揭示身份
- **刀白凤**：段誉之母，出场少但身世重要

### 本书容易被忽略的功法
- **小无相功**：逍遥派绝学，鸠摩智所用
- **北冥神功**：段誉吸人内力的功法
- **化功大法**：丁春秋的邪功
- **斗转星移**：慕容氏绝学，"以彼之道还施彼身"

### 本书关系图常见的错误模式
- **萧峰与乔峰**：同一人，不要分开列出
- **段誉的恋情**：与木婉清、钟灵、王语嫣都有感情线，但最终与王语嫣在一起
- **虚竹与梦姑**：西夏公主就是梦姑，不要当作两个角色
- **慕容复与王语嫣**：表兄妹关系，王语嫣最终离开慕容复

## 硬性约束

### source_refs 格式
每个实体必须附 `source_refs`，采用 **event anchor + 多候选** 格式：
```json
"source_refs": [
  {
    "chapter": 1,
    "anchor": "段誉初入无量山",
    "event_type": "first_mention"
  }
]
```
- `chapter`：章节号
- `anchor`：事件锚点描述（2-10 字）
- `event_type`：first_mention / climax / resolution / background

### ID 规则
- 全部小写拼音加下划线
- 前缀正确：char_ / fac_ / loc_ / skill_ / tech_ / item_
- 不使用英文、数字、特殊字符

### 枚举值
- `rank`：主角 / 重要 / 次要 / 龙套
- `gender`：男 / 女 / 未知
- `event_type`：first_mention / climax / resolution / background

### 关系规则
- 同一对角色不能有多条重复关系
- 关系必须是对称的（A→B 必须有 B→A）
- 不能捏造不存在的关系

## 输出格式

### characters.json
```json
[
  {
    "id": "char_duan_yu",
    "name": "段誉",
    "alias": ["大理段公子", "段世子"],
    "gender": "男",
    "rank": "主角",
    "faction": "fac_da_li",
    "one_line": "大理镇南王世子，痴情书生，后习得六脉神剑",
    "personality": "温文尔雅，痴情专一，不喜武功却因缘际会成为高手",
    "relationships": [
      {
        "target": "char_wang_yu_yan",
        "type": "恋人",
        "description": "对王语嫣一见钟情，最终结为夫妻"
      }
    ],
    "known_skills": ["skill_liu_mai_shen_jian", "skill_ling_bo_wei_bu", "skill_yi_yang_zhi"],
    "source_refs": [
      {
        "chapter": 1,
        "anchor": "段誉初入无量山",
        "event_type": "first_mention"
      }
    ]
  }
]
```

### factions.json
```json
[
  {
    "id": "fac_shao_lin",
    "name": "少林",
    "type": "门派",
    "region": "中原",
    "one_line": "武林泰斗，玄慈为方丈",
    "leader": "char_xuan_ci",
    "members": ["char_xu_zhu"],
    "source_refs": [
      {
        "chapter": 2,
        "anchor": "少林寺首次出现",
        "event_type": "first_mention"
      }
    ]
  }
]
```

### locations.json
```json
[
  {
    "id": "loc_da_li",
    "name": "大理",
    "region": "西南",
    "one_line": "段氏皇室所在",
    "factions": ["fac_da_li"],
    "characters": ["char_duan_yu", "char_duan_zheng_chun"],
    "source_refs": [
      {
        "chapter": 1,
        "anchor": "大理国无量山",
        "event_type": "first_mention"
      }
    ]
  }
]
```

### skills.json
```json
[
  {
    "id": "skill_liu_mai_shen_jian",
    "name": "六脉神剑",
    "type": "武功",
    "one_line": "大理段氏绝学，以无形剑气伤人",
    "owner": "fac_da_li",
    "users": ["char_duan_yu"],
    "source_refs": [
      {
        "chapter": 10,
        "anchor": "段誉首次使用六脉神剑",
        "event_type": "first_mention"
      }
    ]
  }
]
```

### techniques.json
```json
[
  {
    "id": "tech_shang_guan_shen_jian",
    "name": "商阳剑",
    "type": "招式",
    "skill": "skill_liu_mai_shen_jian",
    "one_line": "六脉神剑第一路，以商阳穴发力",
    "source_refs": [
      {
        "chapter": 10,
        "anchor": "段誉使出商阳剑",
        "event_type": "first_mention"
      }
    ]
  }
]
```

## 禁止事项

1. **禁止捏造引文**：不要编造原文中没有的对话或描述
2. **禁止凑数 alias**：不要为了增加 alias 数量而添加不存在的别名
3. **禁止模板化 description**：不要使用千篇一律的描述格式
4. **禁止冲突 relationship**：同一对角色不能有多条冲突的关系
5. **禁止凭记忆编造事件**：所有 source_refs 必须基于原文

## 质量检查

生成后检查：
1. 所有 JSON 可解析
2. ID 全部是小写拼音加下划线
3. source_refs 的 chapter 在 1-50 范围内
4. relationships.target 在 characters.json 里能找到
5. 同一对角色无重复关系