#!/usr/bin/env python3
"""合并脚本：将50章的骨架+深度提取结果合并为全局数据"""

import os
import json
import glob

CHAPTERS_DIR = "金庸/天龙八部/chapters"
OUTPUT_DIR = "金庸/天龙八部"
PROGRESS_FILE = "金庸/天龙八部/progress.json"


def load_all_chapters():
    """加载所有章节的骨架+深度数据"""
    chapters = []
    for i in range(1, 51):
        sk_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_skeleton.json")
        dp_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")

        sk_data = None
        dp_data = None

        if os.path.exists(sk_path):
            with open(sk_path, 'r', encoding='utf-8') as f:
                sk_data = json.load(f)

        if os.path.exists(dp_path):
            with open(dp_path, 'r', encoding='utf-8') as f:
                dp_data = json.load(f)

        chapters.append({
            'num': i,
            'skeleton': sk_data,
            'deep': dp_data
        })

    return chapters


def merge_list(existing, new, key='id'):
    """合并两个列表，以key为去重依据"""
    by_id = {item[key]: item for item in existing}
    for item in new:
        item_id = item[key]
        if item_id in by_id:
            # 智能合并：取并集
            merged = by_id[item_id]
            for k, v in item.items():
                if k == key:
                    continue
                if isinstance(v, list) and isinstance(merged.get(k), list):
                    # 列表取并集
                    existing_vals = set(str(x) for x in merged[k])
                    for x in v:
                        if str(x) not in existing_vals:
                            merged[k].append(x)
                elif k == 'intensity' or k == 'bond_level':
                    # 数值取最新
                    merged[k] = v
                elif v is not None and v != '' and v != []:
                    # 非空值覆盖
                    merged[k] = v
        else:
            by_id[item_id] = item
    return list(by_id.values())


def merge_all(chapters):
    """合并所有章节数据"""
    all_characters = []
    all_factions = []
    all_locations = []
    all_skills = []
    all_techniques = []
    all_events = []
    all_dialogues = []

    for ch in chapters:
        if ch['skeleton']:
            sk = ch['skeleton']
            all_characters = merge_list(all_characters, sk.get('characters', []))
            all_factions = merge_list(all_factions, sk.get('factions', []))
            all_locations = merge_list(all_locations, sk.get('locations', []))
            all_skills = merge_list(all_skills, sk.get('skills', []))

        if ch['deep']:
            dp = ch['deep']
            # 合并详细数据到已有条目
            for detail in dp.get('characters_detail', []):
                for char in all_characters:
                    if char['id'] == detail['id']:
                        for k, v in detail.items():
                            if k == 'id':
                                continue
                            if isinstance(v, list) and isinstance(char.get(k), list):
                                existing = set(str(x) for x in char[k])
                                for x in v:
                                    if str(x) not in existing:
                                        char[k].append(x)
                            elif v is not None and v != '':
                                char[k] = v
                        break

            for detail in dp.get('skills_detail', []):
                for skill in all_skills:
                    if skill['id'] == detail['id']:
                        for k, v in detail.items():
                            if k == 'id':
                                continue
                            if isinstance(v, list) and isinstance(skill.get(k), list):
                                existing = set(str(x) for x in skill[k])
                                for x in v:
                                    if str(x) not in existing:
                                        skill[k].append(x)
                            elif v is not None and v != '':
                                skill[k] = v
                        break

            all_techniques.extend(dp.get('techniques', []))
            all_events.extend(dp.get('events', []))
            all_dialogues.extend(dp.get('dialogues', []))

    return {
        'characters': all_characters,
        'factions': all_factions,
        'locations': all_locations,
        'skills': all_skills,
        'techniques': all_techniques,
        'events': all_events,
        'dialogues': all_dialogues
    }


def save_merged(data):
    """保存合并结果"""
    for key, items in data.items():
        output_path = os.path.join(OUTPUT_DIR, f"{key}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"保存 {len(items)} 个 {key} 到 {output_path}")


def main():
    print("加载章节数据...")
    chapters = load_all_chapters()

    skeleton_count = sum(1 for c in chapters if c['skeleton'])
    deep_count = sum(1 for c in chapters if c['deep'])
    print(f"骨架数据: {skeleton_count} 章, 深度数据: {deep_count} 章")

    print("合并中...")
    merged = merge_all(chapters)

    print("保存结果...")
    save_merged(merged)

    # 更新进度
    progress = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['merge'] = True
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("合并完成！")


if __name__ == "__main__":
    main()
