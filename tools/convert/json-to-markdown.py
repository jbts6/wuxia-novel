#!/usr/bin/env python3
"""将JSON数据转换为Obsidian Markdown卡片

用法:
    python json-to-markdown.py <小说目录>
    
示例:
    python json-to-markdown.py 金庸/天龙八部
    python json-to-markdown.py 金庸/射雕英雄传
"""

import os
import sys
import json

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python json-to-markdown.py <小说目录>")
    print("示例: python json-to-markdown.py 金庸/天龙八部")
    sys.exit(1)

NOVELS_DIR = sys.argv[1]
TEMPLATES_DIR = "framework/templates"

# 从小说目录名提取小说名（用于 tag）
NOVEL_NAME = os.path.basename(NOVELS_DIR)

# ID 到中文名的映射表
ID_TO_NAME = {}

MANUAL_SKILL_ALIASES = {
    'skill_ling_bo_wei_bu': 'skill_lingboweibu',
    'skill_lingbo_weibu': 'skill_lingboweibu',
    'skill_beiming_shengong': 'skill_beimingshengong',
    'skill_yibidaohuanshi': 'skill_yi_bi_zhi_dao_huan_shi_bi_shen',
}


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_id_mapping(characters, skills, factions, locations, skill_aliases=None):
    """构建 ID 到中文名的映射"""
    global ID_TO_NAME
    ID_TO_NAME = {}

    for char in characters:
        char_id = char.get('id', '')
        name = char.get('name', '')
        if char_id and name:
            ID_TO_NAME[char_id] = name

    for skill in skills:
        skill_id = skill.get('id', '')
        name = skill.get('name', '')
        if skill_id and name:
            ID_TO_NAME[skill_id] = name

    for alias, target_id in (skill_aliases or {}).items():
        if target_id in ID_TO_NAME:
            ID_TO_NAME[alias] = ID_TO_NAME[target_id]

    for faction in factions:
        faction_id = faction.get('id', '')
        name = faction.get('name', '')
        if faction_id and name:
            ID_TO_NAME[faction_id] = name

    for location in locations:
        loc_id = location.get('id', '')
        name = location.get('name', '')
        if loc_id and name:
            ID_TO_NAME[loc_id] = name


def id_to_wikilink(entity_id):
    """将 ID 转换为 wikilink（使用中文名）"""
    if not entity_id:
        return ""
    # 如果已经是中文名，直接返回
    if not entity_id.startswith(('char_', 'skill_', 'faction_', 'loc_', 'item_')):
        return entity_id
    # 从映射中获取中文名
    return ID_TO_NAME.get(entity_id, entity_id)


def save_markdown(output_dir, filename, content):
    """保存Markdown文件"""
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"{filename}.md")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath


def clear_markdown_output(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    for filename in os.listdir(output_dir):
        if filename.endswith('.md'):
            os.remove(os.path.join(output_dir, filename))


def dedupe_list(values):
    deduped = []
    seen = set()
    for value in values or []:
        if isinstance(value, dict) and value.get('id'):
            marker = ('id', value['id'])
        else:
            marker = ('value', json.dumps(value, ensure_ascii=False, sort_keys=True))
        if marker in seen:
            continue
        seen.add(marker)
        deduped.append(value)
    return deduped


def merge_record(target, source):
    for k, v in source.items():
        if k == 'id':
            continue
        if isinstance(v, list):
            target[k] = dedupe_list(list(target.get(k) or []) + v)
        elif isinstance(v, dict):
            merged = dict(target.get(k) or {})
            for sub_key, sub_value in v.items():
                if sub_value not in (None, '', [], {}):
                    merged.setdefault(sub_key, sub_value)
            target[k] = merged
        elif target.get(k) in (None, '', [], {}):
            target[k] = v


def skill_quality_score(skill):
    score = 0
    name = skill.get('name', '')
    if name and not name.startswith('skill_'):
        score += 100
    if skill.get('faction'):
        score += 30
    score += len(skill.get('techniques') or []) * 10
    score += len(skill.get('progression') or []) * 4
    score += len(skill.get('effects') or []) * 4
    score += len(skill.get('rag_refs') or [])
    if skill.get('combat_style'):
        score += 5
    if skill.get('game_stats'):
        score += 3
    return (score, skill.get('id', ''))


def is_placeholder_skill(skill):
    name = skill.get('name', '')
    return name.startswith('skill_') and skill.get('one_line', '') in ('', name)


def coalesce_skills(skills):
    by_name = {}
    for skill in skills:
        if is_placeholder_skill(skill):
            continue
        name = skill.get('name') or skill.get('id')
        by_name.setdefault(name, []).append(skill)

    coalesced = []
    aliases = dict(MANUAL_SKILL_ALIASES)
    for records in by_name.values():
        canonical = max(records, key=skill_quality_score)
        merged = dict(canonical)
        for record in records:
            record_id = record.get('id')
            if record_id and record_id != canonical.get('id'):
                aliases[record_id] = canonical.get('id')
            merge_record(merged, record)
        for key, value in list(merged.items()):
            if isinstance(value, list):
                merged[key] = dedupe_list(value)
        coalesced.append(merged)
    return coalesced, aliases


def attach_game_stats(skills, game_skills):
    stats_by_id = {
        skill.get('id'): skill.get('game_stats')
        for skill in game_skills
        if skill.get('id') and skill.get('game_stats')
    }
    stats_by_name = {}
    for skill in game_skills:
        name = skill.get('name')
        stats = skill.get('game_stats')
        if name and stats:
            current = stats_by_name.get(name)
            if current is None or skill_quality_score(skill) > skill_quality_score(current):
                stats_by_name[name] = skill

    for skill in skills:
        if skill.get('game_stats'):
            continue
        stats = stats_by_id.get(skill.get('id'))
        if stats is None and skill.get('name') in stats_by_name:
            stats = stats_by_name[skill.get('name')].get('game_stats')
        if stats:
            skill['game_stats'] = stats


def char_to_markdown(char):
    """将角色数据转换为Markdown"""
    name = char.get('name', 'Unknown')
    char_id = char.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {char_id}
type: character
tags:
  - {NOVEL_NAME}
  - character
role: {char.get('role', 'npc')}
archetype: {char.get('archetype', 'warrior')}
rank: {char.get('rank', '登堂入室')}
faction: "[[{id_to_wikilink(char.get('faction', ''))}]]"
alias: {json.dumps(char.get('alias', []), ensure_ascii=False)}
identity: {char.get('identity', '')}
first_appearance: {char.get('first_appearance', '')}
known_skills:"""

    for skill in char.get('known_skills', []):
        frontmatter += f'\n  - "[[{id_to_wikilink(skill)}]]"'

    frontmatter += "\nrelated_skills:"
    for skill in char.get('related_skills', []):
        frontmatter += f'\n  - "[[{id_to_wikilink(skill)}]]"'

    # Game stats
    game_stats = char.get('game_stats', {})
    frontmatter += f"""
game_stats:
  hp: {game_stats.get('hp', 0)}
  mp: {game_stats.get('mp', 0)}
  atk: {game_stats.get('atk', 0)}
  def: {game_stats.get('def', 0)}
  spd: {game_stats.get('spd', 0)}
  wiz: {game_stats.get('wiz', 0)}
---"""

    # Body - handle personality as string or dict
    personality = char.get('personality', {})
    if personality is None:
        traits = ''
        speech_style = ''
        temperament = ''
    elif isinstance(personality, str):
        traits = personality
        speech_style = ''
        temperament = ''
    else:
        traits = ', '.join(personality.get('traits', []))
        speech_style = personality.get('speech_style', '')
        temperament = personality.get('temperament', '')

    body = f"""
## 性格
- **特征**: {traits}
- **说话风格**: {speech_style}
- **气质**: {temperament}

## 关系
"""

    for rel in char.get('relationships', []):
        if isinstance(rel, dict):
            target = rel.get('target', '')
            rel_type = rel.get('type', '')
            intensity = rel.get('intensity', 0)
            body += f"- [[{id_to_wikilink(target)}]] — {rel_type}（强度: {intensity}）\n"

    body += f"""
## 外貌
{char.get('appearance', '暂无描述')}

## 生平概要
{char.get('biography', char.get('one_line', ''))}
"""

    return f"{frontmatter}\n\n# {name}\n{body}"


def skill_to_markdown(skill):
    """将技能数据转换为Markdown"""
    name = skill.get('name', 'Unknown')
    skill_id = skill.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {skill_id}
type: {skill.get('type', 'sword_art')}
tags:
  - {NOVEL_NAME}
  - skill
rank: {skill.get('rank', '登堂入室')}
faction: "[[{id_to_wikilink(skill.get('faction', ''))}]]"
combat_style: {skill.get('combat_style', '')}
techniques:"""

    for tech in skill.get('techniques', []):
        frontmatter += f'\n  - "[[{tech.get("name", "")}]]"'

    # Game stats
    game_stats = skill.get('game_stats', {})
    frontmatter += f"""
game_stats:
  damage_base: {game_stats.get('damage_base', 0)}
  mp_cost: {game_stats.get('mp_cost', 0)}
  cooldown: {game_stats.get('cooldown', 0)}
  range: {game_stats.get('range', 'melee')}
---"""

    # Body
    body = f"""
## 描述
{skill.get('one_line', skill.get('description', ''))}

## 招式列表
| 招式 | 类型 | 描述 |
|------|------|------|
"""

    for tech in skill.get('techniques', []):
        tech_name = tech.get('name', '')
        tech_type = tech.get('type', '')
        tech_desc = tech.get('description', '')
        body += f"| [[{tech_name}]] | {tech_type} | {tech_desc} |\n"

    body += f"""
## 掌握者
"""

    for char_id in skill.get('masters', []):
        body += f"- [[{id_to_wikilink(char_id)}]]\n"

    return f"{frontmatter}\n\n# {name}\n{body}"


def faction_to_markdown(faction):
    """将门派数据转换为Markdown"""
    name = faction.get('name', 'Unknown')
    faction_id = faction.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {faction_id}
type: {faction.get('type', 'sect')}
tags:
  - {NOVEL_NAME}
  - faction
location: "[[{id_to_wikilink(faction.get('location', ''))}]]"
---"""

    # Body
    body = f"""
## 描述
{faction.get('one_line', faction.get('description', ''))}

## 成员
"""

    for member in faction.get('members', []):
        if isinstance(member, dict):
            body += f"- [[{id_to_wikilink(member.get('id', ''))}]] — {member.get('role', '')}\n"
        else:
            body += f"- [[{id_to_wikilink(member)}]]\n"

    body += f"""
## 镇派武学
"""

    for skill in faction.get('signature_skills', []):
        body += f"- [[{id_to_wikilink(skill)}]]\n"

    return f"{frontmatter}\n\n# {name}\n{body}"


def location_to_markdown(location):
    """将地点数据转换为Markdown"""
    name = location.get('name', 'Unknown')
    loc_id = location.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {loc_id}
type: location
tags:
  - {NOVEL_NAME}
  - location
region: {location.get('region', '')}
---"""

    # Body
    body = f"""
## 描述
{location.get('one_line', location.get('description', ''))}

## 相连地点
"""

    for connected in location.get('connected', []):
        body += f"- [[{id_to_wikilink(connected)}]]\n"

    body += f"""
## 出现人物
"""

    for char in location.get('characters', []):
        body += f"- [[{id_to_wikilink(char)}]]\n"

    return f"{frontmatter}\n\n# {name}\n{body}"


def main():
    print(f"📂 小说目录: {NOVELS_DIR}")
    print(f"📝 小说名称: {NOVEL_NAME}")
    
    # 加载数据；技能卡以深度合并后的 skills.json 为内容源，game_skills.json 只补游戏数值。
    game_chars_path = os.path.join(NOVELS_DIR, 'game_characters.json')
    game_skills_path = os.path.join(NOVELS_DIR, 'game_skills.json')
    game_factions_path = os.path.join(NOVELS_DIR, 'game_factions.json')

    characters = load_json(game_chars_path if os.path.exists(game_chars_path) else os.path.join(NOVELS_DIR, 'characters.json'))
    raw_skills = load_json(os.path.join(NOVELS_DIR, 'skills.json'))
    skills, skill_aliases = coalesce_skills(raw_skills)
    if os.path.exists(game_skills_path):
        attach_game_stats(skills, load_json(game_skills_path))
    factions = load_json(game_factions_path if os.path.exists(game_factions_path) else os.path.join(NOVELS_DIR, 'factions.json'))
    locations = load_json(os.path.join(NOVELS_DIR, 'locations.json'))

    # 构建 ID 到中文名的映射
    print("构建 ID 映射...")
    build_id_mapping(characters, skills, factions, locations, skill_aliases)
    print(f"  已映射 {len(ID_TO_NAME)} 个实体")

    # 转换并保存角色卡
    print("转换角色卡...")
    for char in characters:
        name = char.get('name', 'unknown')
        markdown = char_to_markdown(char)
        save_markdown(os.path.join(NOVELS_DIR, 'characters'), name, markdown)
    print(f"  已转换 {len(characters)} 个角色卡")

    # 转换并保存技能卡
    print("转换技能卡...")
    clear_markdown_output(os.path.join(NOVELS_DIR, 'skills'))
    for skill in skills:
        name = skill.get('name', 'unknown')
        markdown = skill_to_markdown(skill)
        save_markdown(os.path.join(NOVELS_DIR, 'skills'), name, markdown)
    print(f"  已转换 {len(skills)} 个技能卡")

    # 转换并保存门派卡
    print("转换门派卡...")
    for faction in factions:
        name = faction.get('name', 'unknown')
        markdown = faction_to_markdown(faction)
        save_markdown(os.path.join(NOVELS_DIR, 'factions'), name, markdown)
    print(f"  已转换 {len(factions)} 个门派卡")

    # 转换并保存地点卡
    print("转换地点卡...")
    for location in locations:
        name = location.get('name', 'unknown')
        markdown = location_to_markdown(location)
        save_markdown(os.path.join(NOVELS_DIR, 'locations'), name, markdown)
    print(f"  已转换 {len(locations)} 个地点卡")

    print("\n✅ 转换完成！")


if __name__ == "__main__":
    main()
