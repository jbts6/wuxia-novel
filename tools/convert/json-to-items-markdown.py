#!/usr/bin/env python3
"""将 items JSON 数据转换为 Obsidian Markdown 卡片

用法:
    python json-to-items-markdown.py <小说目录>
    
示例:
    python json-to-items-markdown.py 金庸/天龙八部
"""

import os
import sys
import json

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python json-to-items-markdown.py <小说目录>")
    sys.exit(1)

NOVELS_DIR = sys.argv[1]
OUTPUT_DIR = os.path.join(NOVELS_DIR, "items")
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


def id_to_wikilink(entity_id):
    """将 ID 转换为 wikilink（使用中文名）"""
    if not entity_id:
        return ""
    if not entity_id.startswith(('char_', 'skill_', 'faction_', 'loc_', 'item_')):
        return entity_id
    return ID_TO_NAME.get(entity_id, entity_id)


def item_to_markdown(item):
    """将物品数据转换为Markdown"""
    name = item.get('name', 'Unknown')
    item_id = item.get('id', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {item_id}
type: {item.get('type', 'special')}
tags:
  - {NOVEL_NAME}
  - item
rarity: {item.get('rarity', 'common')}
owner: "[[{id_to_wikilink(item.get('owner', ''))}]]"
---"""

    # Body
    body = f"""
## 描述
{item.get('description', item.get('one_line', ''))}

## 效果
"""

    for effect in item.get('effects', []):
        if isinstance(effect, dict):
            body += f"- **{effect.get('type', '')}**: {effect.get('description', '')}\n"
        else:
            body += f"- {effect}\n"

    body += f"""
## 来源
{item.get('origin', '未知')}

## 相关技能
"""

    for skill in item.get('related_skills', []):
        body += f"- [[{id_to_wikilink(skill)}]]\n"

    return f"{frontmatter}\n\n# {name}\n{body}"


def main():
    print(f"📂 小说目录: {NOVELS_DIR}")
    
    # 加载数据
    items_path = os.path.join(NOVELS_DIR, 'items.json')
    characters_path = os.path.join(NOVELS_DIR, 'characters.json')
    skills_path = os.path.join(NOVELS_DIR, 'skills.json')

    items = load_json(items_path) if os.path.exists(items_path) else []
    characters = load_json(characters_path) if os.path.exists(characters_path) else []
    skills = load_json(skills_path) if os.path.exists(skills_path) else []

    # 构建 ID 映射
    print("构建 ID 映射...")
    build_id_mapping(characters, items, skills)

    # 转换并保存物品卡
    print("转换物品卡...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for item in items:
        name = item.get('name', 'unknown')
        markdown = item_to_markdown(item)
        filepath = os.path.join(OUTPUT_DIR, f"{name}.md")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown)
    print(f"  已转换 {len(items)} 个物品卡")

    print("\n✅ 转换完成！")


if __name__ == "__main__":
    main()
