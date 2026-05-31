#!/usr/bin/env python3
"""将 items JSON 数据转换为 Obsidian Markdown 卡片"""

import os
import json

NOVELS_DIR = "金庸/天龙八部"
OUTPUT_DIR = os.path.join(NOVELS_DIR, "items")

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


def build_id_mapping(characters, items, skills):
    """构建 ID 到中文名的映射"""
    global ID_TO_NAME
    ID_TO_NAME = {}

    for char in characters:
        char_id = char.get('id', '')
        name = char.get('name', '')
        if char_id and name:
            ID_TO_NAME[char_id] = name

    for item in items:
        item_id = item.get('id', '')
        name = item.get('name', '')
        if item_id and name:
            ID_TO_NAME[item_id] = name

    for skill in skills:
        skill_id = skill.get('id', '')
        name = skill.get('name', '')
        if skill_id and name:
            ID_TO_NAME[skill_id] = name

    for alias, target_id in MANUAL_SKILL_ALIASES.items():
        if target_id in ID_TO_NAME:
            ID_TO_NAME[alias] = ID_TO_NAME[target_id]


def id_to_wikilink(entity_id):
    """将 ID 转换为 wikilink（使用中文名）"""
    if not entity_id:
        return ""
    if not entity_id.startswith(('char_', 'skill_', 'faction_', 'loc_', 'item_')):
        return entity_id
    return ID_TO_NAME.get(entity_id, entity_id)


def item_to_markdown(item):
    """将物品数据转换为 Markdown"""
    name = item.get('name', '未命名物品')
    item_type = item.get('type', 'special')
    owner_id = item.get('owner')
    one_line = item.get('one_line', '')

    # 转换 type 为中文
    type_map = {
        'weapon': '武器',
        'armor': '防具',
        'pill': '丹药',
        'poison': '毒药',
        'hidden_weapon': '暗器',
        'special': '特殊物品'
    }
    type_cn = type_map.get(item_type, item_type)

    # 持有者
    owner_name = id_to_wikilink(owner_id) if owner_id else '无'
    owner_link = f"[[{owner_name}]]" if owner_id and owner_name != '无' else owner_name

    frontmatter = f"""---
id: {item.get('id', '')}
type: {item_type}
owner: "{owner_link}"
tags:
  - 天龙八部
  - item
---"""

    # Body
    body = f"""
## 基本信息
- **类型**: {type_cn}
- **持有者**: {owner_link}
- **简介**: {one_line}
"""

    # 详细描述（如果有）
    description = item.get('description', '')
    if description:
        body += f"""
## 描述
{description}
"""

    # 效果（如果有）
    effects = item.get('effects', [])
    if effects:
        body += "\n## 效果\n"
        for effect in effects:
            if isinstance(effect, dict):
                effect_type = effect.get('type', '')
                effect_value = effect.get('value', '')
                effect_desc = effect.get('description', '')
                body += f"- **{effect_type}**: {effect_value} - {effect_desc}\n"
            else:
                body += f"- {effect}\n"

    # 来源（如果有）
    origin = item.get('origin', '')
    if origin:
        body += f"""
## 来源
{origin}
"""

    # 相关人物（如果有）
    related_characters = item.get('related_characters', [])
    if related_characters:
        body += "\n## 相关人物\n"
        for char_id in related_characters:
            char_name = id_to_wikilink(char_id)
            body += f"- [[{char_name}]]\n"

    # 相关技能（如果有）
    related_skills = item.get('related_skills', [])
    if related_skills:
        body += "\n## 相关技能\n"
        for skill_id in related_skills:
            skill_name = id_to_wikilink(skill_id)
            body += f"- [[{skill_name}]]\n"

    # 稀有度（如果有）
    rarity = item.get('rarity', '')
    if rarity:
        rarity_map = {
            'common': '普通',
            'uncommon': '罕见',
            'rare': '稀有',
            'legendary': '传说'
        }
        rarity_cn = rarity_map.get(rarity, rarity)
        body += f"\n**稀有度**: {rarity_cn}\n"

    return f"{frontmatter}\n\n# {name}\n{body}"


def save_markdown(output_dir, filename, content):
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def clear_markdown_output(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    for filename in os.listdir(output_dir):
        if filename.endswith('.md'):
            os.remove(os.path.join(output_dir, filename))


def item_filename(item, duplicate_names):
    name = item.get('name', '未命名物品')
    if name not in duplicate_names:
        return f"{name}.md"
    return f"{name}-{item.get('id', 'unknown')}.md"


def main():
    print("构建 ID 映射...")
    characters = load_json(os.path.join(NOVELS_DIR, "game_characters.json"))
    items = load_json(os.path.join(NOVELS_DIR, "items.json"))
    skills = load_json(os.path.join(NOVELS_DIR, "skills.json"))

    build_id_mapping(characters, items, skills)
    print(f"  已映射 {len(ID_TO_NAME)} 个实体")

    name_counts = {}
    for item in items:
        name = item.get('name', '未命名物品')
        name_counts[name] = name_counts.get(name, 0) + 1
    duplicate_names = {name for name, count in name_counts.items() if count > 1}

    print("转换物品卡...")
    clear_markdown_output(OUTPUT_DIR)
    for item in items:
        markdown = item_to_markdown(item)
        filename = item_filename(item, duplicate_names)
        save_markdown(OUTPUT_DIR, filename, markdown)

    print(f"  已转换 {len(items)} 个物品卡")
    print(f"\n转换完成！")


if __name__ == '__main__':
    main()
