#!/usr/bin/env python3
"""游戏化赋值脚本：为角色/技能添加游戏数值"""

import os
import json

NOVELS_DIR = "金庸/天龙八部"
TEMPLATES_DIR = "framework/templates"
BALANCE_DIR = "framework/balance"


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


RANK_MULTIPLIERS = {
    "返璞归真": 2.0,
    "登峰造极": 1.5,
    "出神入化": 1.3,
    "炉火纯青": 1.2,
    "登堂入室": 1.0,
    "略有小成": 0.8,
    "初窥门径": 0.6,
    "平平无奇": 0.4,
}


def get_rank_mult(rank):
    """根据实力评级获取倍率"""
    return RANK_MULTIPLIERS.get(rank, 1.0)


def assign_character_stats(characters, archetypes, factions, formula):
    """为角色计算游戏属性"""
    base_stats = archetypes['base_stats']
    archetype_mults = archetypes['archetype_multipliers']
    faction_bonuses = factions['faction_bonuses']

    for char in characters:
        role = char.get('role', 'npc')
        archetype = char.get('archetype', 'warrior')
        faction = char.get('faction')
        rank = char.get('rank', '登堂入室')

        # 基础值
        base = base_stats.get(role, base_stats['npc'])

        # 原型修正
        mult = archetype_mults.get(archetype, archetype_mults['warrior'])

        # 实力评级倍率
        rank_mult = get_rank_mult(rank)

        # 门派加成
        faction_bonus = faction_bonuses.get(faction, {}) if faction else {}

        # 计算最终属性
        stats = {}
        for attr in ['hp', 'mp', 'atk', 'def', 'spd', 'wiz']:
            base_val = base.get(attr, 50)
            mult_val = mult.get(attr, 1.0)
            bonus_val = faction_bonus.get(attr, 0)
            stats[attr] = int(base_val * mult_val * rank_mult + bonus_val)

        char['game_stats'] = stats
        char['game_stats']['level'] = 1

        # 成长曲线
        growth = archetypes.get('growth_per_level', {}).get(archetype)
        if growth:
            char['growth_per_level'] = growth

    return characters


def assign_skill_stats(skills, archetypes):
    """为技能计算游戏属性"""
    # 冷却时间根据评级
    rank_cooldown = {
        "返璞归真": 1, "登峰造极": 2, "出神入化": 2,
        "炉火纯青": 3, "登堂入室": 3, "略有小成": 4,
        "初窥门径": 4, "平平无奇": 5,
    }

    for skill in skills:
        rank = skill.get('rank', '登堂入室')
        skill_type = skill.get('type', 'sword_art')

        # 基础伤害（根据评级）
        rank_damage = {
            "返璞归真": 400, "登峰造极": 300, "出神入化": 250,
            "炉火纯青": 200, "登堂入室": 150, "略有小成": 120,
            "初窥门径": 100, "平平无奇": 80,
        }
        base_damage = rank_damage.get(rank, 150)

        skill['game_stats'] = {
            'damage_base': base_damage,
            'mp_cost': int(base_damage * 0.3),
            'cooldown': rank_cooldown.get(rank, 3),
            'range': 'melee' if skill_type in ['sword_art', 'palm_art', 'fist_art'] else 'ranged'
        }

    return skills


def main():
    # 加载数据
    characters = load_json(os.path.join(NOVELS_DIR, 'characters.json'))
    skills = load_json(os.path.join(NOVELS_DIR, 'skills.json'))
    factions = load_json(os.path.join(NOVELS_DIR, 'factions.json'))

    # 加载模板
    archetypes = load_json(os.path.join(TEMPLATES_DIR, 'archetypes.json'))
    faction_templates = load_json(os.path.join(TEMPLATES_DIR, 'factions.json'))
    formula = load_json(os.path.join(BALANCE_DIR, 'combat-formula.json'))

    # 赋值
    print("为角色赋值...")
    characters = assign_character_stats(characters, archetypes, faction_templates, formula)

    print("为技能赋值...")
    skills = assign_skill_stats(skills, archetypes)

    # 保存
    for name, data in [('characters', characters), ('skills', skills), ('factions', factions)]:
        output = os.path.join(NOVELS_DIR, f'game_{name}.json')
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"保存到 {output}")

    # 更新进度
    progress_path = os.path.join(NOVELS_DIR, 'progress.json')
    progress = {}
    if os.path.exists(progress_path):
        with open(progress_path, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['gamify'] = True
    with open(progress_path, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("游戏化赋值完成！")


if __name__ == "__main__":
    main()
