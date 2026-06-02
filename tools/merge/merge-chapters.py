#!/usr/bin/env python3
"""合并脚本：将章节的骨架+深度提取结果合并为全局数据

用法:
    python merge-chapters.py <小说目录>
    
示例:
    python merge-chapters.py 金庸/天龙八部
    python merge-chapters.py 金庸/射雕英雄传
"""

import os
import sys
import json
import glob
import copy

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python merge-chapters.py <小说目录>")
    print("示例: python merge-chapters.py 金庸/天龙八部")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")
OUTPUT_DIR = NOVEL_DIR
PROGRESS_FILE = os.path.join(NOVEL_DIR, "progress.json")

MANUAL_SKILL_ALIASES = {
    'skill_lingbo_weibu': 'skill_lingboweibu',
    'skill_beiming_shengong': 'skill_beimingshengong',
    'skill_yibidaohuanshi': 'skill_yi_bi_zhi_dao_huan_shi_bi_shen',
}


def load_all_chapters():
    """加载所有章节的骨架+深度数据"""
    chapters = []
    
    # 自动检测章节数量
    chapter_files = glob.glob(os.path.join(CHAPTERS_DIR, "ch_*_skeleton.json"))
    max_chapter = 0
    for f in chapter_files:
        basename = os.path.basename(f)
        try:
            num = int(basename.split('_')[1])
            max_chapter = max(max_chapter, num)
        except:
            pass
    
    if max_chapter == 0:
        print(f"⚠️ 警告: 在 {CHAPTERS_DIR} 中未找到骨架文件")
        return chapters
    
    print(f"检测到 {max_chapter} 个章节")
    
    for i in range(1, max_chapter + 1):
        sk_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_skeleton.json")
        dp_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")
        items_detail_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_items_detail.json")

        sk_data = None
        dp_data = None
        items_detail_data = None

        if os.path.exists(sk_path):
            with open(sk_path, 'r', encoding='utf-8') as f:
                sk_data = json.load(f)

        if os.path.exists(dp_path):
            with open(dp_path, 'r', encoding='utf-8') as f:
                dp_data = json.load(f)

        if os.path.exists(items_detail_path):
            with open(items_detail_path, 'r', encoding='utf-8') as f:
                items_detail_data = json.load(f)

        chapters.append({
            'num': i,
            'skeleton': sk_data,
            'deep': dp_data,
            'items_detail': items_detail_data
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


def dedupe_list(values):
    """按 id/完整内容去重，保留首次出现顺序。"""
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
    return (score, skill.get('id', ''))


def is_placeholder_skill(skill):
    name = skill.get('name', '')
    return name.startswith('skill_') and skill.get('one_line', '') in ('', name)


def normalize_skills(skills):
    """合并同名功法变体，移除占位技能，并返回旧 id 到 canonical id 的映射。"""
    by_name = {}
    aliases = dict(MANUAL_SKILL_ALIASES)

    for skill in skills:
        if is_placeholder_skill(skill):
            continue
        name = skill.get('name') or skill.get('id')
        by_name.setdefault(name, []).append(skill)

    normalized = []
    for records in by_name.values():
        canonical = max(records, key=skill_quality_score)
        merged = copy.deepcopy(canonical)
        for record in records:
            record_id = record.get('id')
            if record_id and record_id != canonical.get('id'):
                aliases[record_id] = canonical.get('id')
            merge_record(merged, record)
        for key, value in list(merged.items()):
            if isinstance(value, list):
                merged[key] = dedupe_list(value)
        normalized.append(merged)

    valid_ids = {skill.get('id') for skill in normalized if skill.get('id')}
    aliases = {old: new for old, new in aliases.items() if new in valid_ids}
    return normalized, aliases


def rewrite_skill_refs(value, aliases):
    if isinstance(value, str):
        return aliases.get(value, value)
    if isinstance(value, list):
        return dedupe_list([rewrite_skill_refs(item, aliases) for item in value])
    if isinstance(value, dict):
        return {k: rewrite_skill_refs(v, aliases) for k, v in value.items()}
    return value


def extract_techniques_from_skills(skills):
    """从合并后的 skills 数据中提取并去重 techniques。"""
    techniques_by_id = {}
    for skill in skills:
        skill_id = skill.get('id', '')
        for technique in skill.get('techniques', []):
            if not isinstance(technique, dict):
                continue
            technique_id = technique.get('id')
            if not technique_id or technique_id in techniques_by_id:
                continue
            extracted = dict(technique)
            if skill_id:
                extracted.setdefault('source_skill', skill_id)
            techniques_by_id[technique_id] = extracted
    return list(techniques_by_id.values())


def merge_all(chapters):
    """合并所有章节数据"""
    all_characters = []
    all_factions = []
    all_locations = []
    all_skills = []
    all_items = []
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
            all_items = merge_list(all_items, sk.get('items', []))

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

        item_details = []
        if ch['deep']:
            item_details.extend(ch['deep'].get('items_detail', []))
        if ch.get('items_detail'):
            item_details.extend(ch['items_detail'].get('items_detail', []))

        for detail in item_details:
            for item in all_items:
                if item['id'] == detail['id']:
                    for k, v in detail.items():
                        if k == 'id':
                            continue
                        if isinstance(v, list) and isinstance(item.get(k), list):
                            existing = set(str(x) for x in item[k])
                            for x in v:
                                if str(x) not in existing:
                                    item[k].append(x)
                        elif v is not None and v != '':
                            item[k] = v
                    break

    all_skills, skill_aliases = normalize_skills(all_skills)
    all_characters = rewrite_skill_refs(all_characters, skill_aliases)
    all_factions = rewrite_skill_refs(all_factions, skill_aliases)
    all_items = rewrite_skill_refs(all_items, skill_aliases)
    all_events = rewrite_skill_refs(all_events, skill_aliases)
    all_dialogues = rewrite_skill_refs(all_dialogues, skill_aliases)

    all_techniques = rewrite_skill_refs(all_techniques, skill_aliases)
    all_techniques = merge_list(all_techniques, extract_techniques_from_skills(all_skills))

    return {
        'characters': all_characters,
        'factions': all_factions,
        'locations': all_locations,
        'skills': all_skills,
        'items': all_items,
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
    print(f"📂 小说目录: {NOVEL_DIR}")
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

    print("✅ 合并完成！")


if __name__ == "__main__":
    main()
