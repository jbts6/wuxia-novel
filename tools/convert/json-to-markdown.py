#!/usr/bin/env python3
"""将JSON数据转换为Obsidian Markdown卡片"""

import os
import json

NOVELS_DIR = "金庸/天龙八部"
TEMPLATES_DIR = "framework/templates"


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_markdown(output_dir, filename, content):
    """保存Markdown文件"""
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"{filename}.md")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath


def char_to_markdown(char):
    """将角色数据转换为Markdown"""
    name = char.get('name', 'Unknown')
    char_id = char.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {char_id}
role: {char.get('role', 'npc')}
archetype: {char.get('archetype', 'warrior')}
rank: {char.get('rank', '登堂入室')}
faction: "[[{char.get('faction', '')}]]"
alias: {json.dumps(char.get('alias', []), ensure_ascii=False)}
identity: {char.get('identity', '')}
first_appearance: {char.get('first_appearance', '')}
known_skills:"""

    for skill in char.get('known_skills', []):
        frontmatter += f'\n  - "[[{skill}]]"'

    frontmatter += "\nrelated_skills:"
    for skill in char.get('related_skills', []):
        frontmatter += f'\n  - "[[{skill}]]"'

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
    if isinstance(personality, str):
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
            body += f"- [[{target}]] — {rel_type}（强度: {intensity}）\n"

    body += f"""
## 外貌
{char.get('appearance', '暂无描述')}

## 生平概要
{char.get('biography', char.get('one_line', ''))}
"""

    return f"# {name}\n\n{frontmatter}\n{body}"


def skill_to_markdown(skill):
    """将技能数据转换为Markdown"""
    name = skill.get('name', 'Unknown')
    skill_id = skill.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {skill_id}
type: {skill.get('type', 'sword_art')}
rank: {skill.get('rank', '登堂入室')}
faction: "[[{skill.get('faction', '')}]]"
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
        body += f"- [[{char_id}]]\n"

    return f"# {name}\n\n{frontmatter}\n{body}"


def faction_to_markdown(faction):
    """将门派数据转换为Markdown"""
    name = faction.get('name', 'Unknown')
    faction_id = faction.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {faction_id}
type: {faction.get('type', 'sect')}
location: "[[{faction.get('location', '')}]]"
---"""

    # Body
    body = f"""
## 描述
{faction.get('one_line', faction.get('description', ''))}

## 成员
"""

    for member in faction.get('members', []):
        if isinstance(member, dict):
            body += f"- [[{member.get('id', '')}]] — {member.get('role', '')}\n"
        else:
            body += f"- [[{member}]]\n"

    body += f"""
## 镇派武学
"""

    for skill in faction.get('signature_skills', []):
        body += f"- [[{skill}]]\n"

    return f"# {name}\n\n{frontmatter}\n{body}"


def location_to_markdown(location):
    """将地点数据转换为Markdown"""
    name = location.get('name', 'Unknown')
    loc_id = location.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {loc_id}
region: {location.get('region', '')}
---"""

    # Body
    body = f"""
## 描述
{location.get('one_line', location.get('description', ''))}

## 相连地点
"""

    for connected in location.get('connected', []):
        body += f"- [[{connected}]]\n"

    body += f"""
## 出现人物
"""

    for char in location.get('characters', []):
        body += f"- [[{char}]]\n"

    return f"# {name}\n\n{frontmatter}\n{body}"


def main():
    # 加载数据
    characters = load_json(os.path.join(NOVELS_DIR, 'characters.json'))
    skills = load_json(os.path.join(NOVELS_DIR, 'skills.json'))
    factions = load_json(os.path.join(NOVELS_DIR, 'factions.json'))
    locations = load_json(os.path.join(NOVELS_DIR, 'locations.json'))

    # 转换并保存角色卡
    print("转换角色卡...")
    for char in characters:
        name = char.get('name', 'unknown')
        markdown = char_to_markdown(char)
        save_markdown(os.path.join(NOVELS_DIR, 'characters'), name, markdown)
    print(f"  已转换 {len(characters)} 个角色卡")

    # 转换并保存技能卡
    print("转换技能卡...")
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

    print("\n转换完成！")


if __name__ == "__main__":
    main()
