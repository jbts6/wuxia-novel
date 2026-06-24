# Deconstruct Quality Report

- novel_dir: 金庸/射雕英雄传
- generated_at: 2026-06-24T04:25:45.688Z
- issues: 12 (high 0, medium 7, low 5)

## Counts

| 类型 | 数量 |
|------|------|
| 角色 | 68 |
| 功法 | 23 |
| 招式 | 15 |
| 门派/势力 | 10 |
| 地点 | 16 |
| 物品 | 18 |
| 对话 | 1821 |

## Issue Categories

| 类别 | 数量 |
|------|------|
| thin_character_profile | 5 |
| duplicate_name | 4 |
| generic_character_name | 1 |
| cross_type_name_collision | 1 |
| dialogue_missing_speaker | 1 |

## Review Items

| 严重度 | 类别 | 类型 | 名称 | 说明 |
|--------|------|------|------|------|
| medium | generic_character_name | 角色 | 店小二 | 角色名是泛称；需要后续合并、改名或降级 |
| low | thin_character_profile | 角色 | 柯辟邪 | personality.traits 少于 5 项 |
| low | thin_character_profile | 角色 | 沈青刚 | personality.traits 少于 5 项 |
| low | thin_character_profile | 角色 | 灵智上人 | personality.traits 少于 5 项 |
| low | thin_character_profile | 角色 | 包惜弱 | personality.traits 少于 5 项 |
| low | thin_character_profile | 角色 | 欧阳克 | personality.traits 少于 5 项 |
| medium | duplicate_name | 角色 | 包惜弱 | 角色重名 2 次: 包惜弱 |
| medium | duplicate_name | 角色 | 窝阔台 | 角色重名 2 次: 窝阔台 |
| medium | duplicate_name | 功法 | 分筋错骨手 | 功法重名 2 次: 分筋错骨手 |
| medium | duplicate_name | 物品 | 短剑 | 物品重名 2 次: 短剑 |
| medium | cross_type_name_collision | 招式 | 毒菱 | 同名实体跨类型出现: 毒菱 (招式 / 物品) |
| medium | dialogue_missing_speaker | dialogues |  | speaker 为空 117/1821 |

