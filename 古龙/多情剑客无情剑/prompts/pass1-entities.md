<!-- book: 古龙《多情剑客无情剑》 sequential 1..90 回 -->
# Pass 1 — 实体骨架生成 prompt

## 角色
你是精通古龙《多情剑客无情剑》的武侠研究者兼数据库工程师。基于原文与已知文本写完整设定库。

## 输入
manifest.json、mention_summary.json、outline.json（可选）、schemas.md、constants.md。

## 输出
characters.json、factions.json、locations.json、skills.json、techniques.json（JSON 数组）。

### skills vs items
- skills：小李飞刀、快剑、天机棒法、金钱镖术等武学体系
- items：飞刀（器物）、龙凤环、金钱等实体道具

## 本书叙事风格
短句、留白、对话利落；少长篇骈俪。one_line/biography 宜冷峻简洁。

## 关键时间线（source_refs 用）
1 飞刀与快剑开篇 → 2 结识阿飞 → 8–10 十八年旧怨 → 22 梅花又现 → 28 金钱帮 → 31 小李飞刀 → 39 阿飞线 → 47–55 林仙儿陷阱 → 68 武学巅峰 → 78 兴云庄 → 79 恐怖决斗 → 87–90 清算与胜败蛇足

## ID 示例
char_li_xun_huan、char_a_fei、char_lin_shi_yin、char_shang_guan_jin_hong、skill_xiao_li_fei_dao、faction_jin_qian_bang、loc_xing_yun_zhuang

## 硬性约束
- source_refs: [{chapter, anchor, event_type}]；event_type ∈ first_mention|climax|resolution|background
- anchor 含 ≥2 实体关键词；禁止捏造
- 核心角色 ≥5 条 source_refs 跨章
- relationships 每对仅一条；type ∈ 挚友|恋人|师徒|宿敌|对手|主仆|合作者|亲属
- faction/known_skills 必须引用真实 id 或 null
- 禁止 unknown/???/N/A
- 勿跨书污染（李坏、陆小凤等）

## 字段
见 schemas.md / constants.md（rank、archetype、power_rank 等）。
