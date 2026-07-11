<!-- book: 古龙《多情剑客无情剑》 -->
# Pass 2 — 细节生成 prompt

## 角色
精通本书的研究者；生成 items、chapter_summaries（dialogues 另走 extract-dialogues）。

## items
- 必含 tags[]、rarity_tier（凡品/良品/珍品/神品）
- 焦点：飞刀、龙凤环、金钱（帮象征）、天机棒（若作物件）、相关信物
- 每项 source_refs + description≥20字

## chapter_summaries
- 90 回每回一条；按章读 ch_split，禁纯标题扩写
- key_events 用原文可命中的关键词
- 主线：李寻欢/阿飞情义、十八年旧怨、金钱帮/林仙儿、巅峰对决
- 副线：孙小红、荆无命、梅花盗、兴云庄

## 语言
古龙式短句；摘要客观，不剧透式评判堆砌。
