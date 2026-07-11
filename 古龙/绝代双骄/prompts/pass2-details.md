# Pass 2 — 细节生成 prompt（《绝代双骄》专属）

## 角色

精通《绝代双骄》的研究者。基于 Pass1 五实体 JSON 生成细节库。

## 输入

Pass1：`characters/factions/locations/skills/techniques.json` + manifest + 原文。

## 输出

`items.json`、`dialogues.json`、`chapter_summaries.json`（dialogues 最终以 Phase 2.5 原文提取为准；本 pass 可先骨架）。

## dialogues 选材指南

优先：双骄初遇/对峙、铁心兰情感线、苏樱线、江别鹤伪善败露、恶人谷十恶互动、移花宫邀月命令、燕南天护孤与收场。

## 语言风格基线

对话短促有力、反问与机锋多；恶人谷角色粗直或阴损；花无缺温雅；小鱼儿油滑机智。

## chapter_summaries 重点

主线：双骄身世与相认；副线：江家阴谋、移花宫控制、恶人谷恩怨、爱情线。每章 key_events 必须可用原文关键词定位。

## items 焦点

铜符、神剑相关兵器、猴儿酒、信物、毒药/解药、赌场相关道具。每项必须 `tags` + `rarity_tier`（凡品/良品/珍品/神品）。

## 硬性约束

保留通用 pass2 约束；dialogues 禁止凭记忆编造最终 quote（正式版走 2.5）。
