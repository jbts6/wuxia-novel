# Pass 1 — 实体骨架生成 prompt（《绝代双骄》专属）

## 角色

你是精通古龙《绝代双骄》的研究者兼数据库工程师。基于原文与 outline，生成完整无冲突设定库。

## 输入

1. `manifest.json`（127 回）
2. `mention_summary.json`
3. `data/outline.json`
4. 原文（已注入上下文）

## 输出

5 个 JSON 数组文件到 `data/`：`characters.json`、`factions.json`、`locations.json`、`skills.json`、`techniques.json`。

严格遵守 `schemas.md` / `constants.md`。

## 本书叙事风格

古龙短句、白描、对话推进情节；反派伪善与主角机智对照鲜明。source_refs 的 anchor 应用「人名+地点/势力+事件动词」短句。

## 关键事件时间线（锚定参考）

- 回1–4：江枫、花月奴遭十二星相/碧蛇神君追杀，燕南天护孤
- 回5–20：恶人谷、十大恶人抚养小鱼儿；移花宫花无缺成长
- 中段：江家（江别鹤、江玉郎）、铁心兰、慕容九、无牙门魏无牙阴谋
- 后段：双骄相认、移花宫邀月/怜星、苏樱、决战与真相

## source_ref 锚定策略

- first_mention：首次登场章（如江枫回1、恶人谷回5 附近）
- climax：双骄对峙、江家阴谋败露、移花宫冲突
- resolution：终局真相、归宿（约 125–127 回）
- anchor 至少含 2 个关键词：人名/门派/地名

## ID 命名示例

- `char_xiao_yu_er`、`char_hua_wu_que`、`char_yan_nan_tian`
- `faction_yi_hua_gong`、`faction_e_ren_gu`
- `loc_e_ren_gu`、`skill_ming_yu_gong`、`skill_yi_hua_jie_yu`

## 已知陷阱

1. 小鱼儿/江小鱼 同一角色，`alias` 互收，一个 id。
2. 江玉郎 ≠ 玉郎江枫。
3. 武器/铜符/猴儿酒 → items（Pass2），勿塞进 skills。
4. 勿引入他书角色。
5. `characters.faction` 必须是 faction id 或 null。
6. 关系类型仅用：挚友/恋人/师徒/宿敌/对手/主仆/合作者/亲属。

## 硬性约束

完整保留通用 pass1-entities 硬性约束：source_refs、关系唯一、字段质量、ID 引用顺序（factions+skills → characters → locations+techniques）。

## 输出格式

每个文件为 JSON 数组，`JSON.stringify(data, null, 2)`。
