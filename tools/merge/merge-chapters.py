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
    """加载所有章节数据（兼容新单文件格式和旧骨架+精细双文件格式）"""
    chapters = []
    
    # 自动检测章节数量（优先新格式 ch_XX.json，回退到旧格式 ch_XX_skeleton.json）
    new_files = glob.glob(os.path.join(CHAPTERS_DIR, "ch_??.json"))
    old_files = glob.glob(os.path.join(CHAPTERS_DIR, "ch_*_skeleton.json"))
    
    if new_files:
        # 新格式：单文件 ch_XX.json
        max_chapter = 0
        for f in new_files:
            basename = os.path.basename(f)
            try:
                num = int(basename.split('_')[1].split('.')[0])
                max_chapter = max(max_chapter, num)
            except:
                pass
        
        print(f"检测到 {max_chapter} 个章节（新格式）")
        
        for i in range(1, max_chapter + 1):
            ch_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}.json")
            if os.path.exists(ch_path):
                with open(ch_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                chapters.append({
                    'num': i,
                    'skeleton': data,
                    'deep': data,
                    'items_detail': None,
                    'combined': True
                })
            else:
                chapters.append({'num': i, 'skeleton': None, 'deep': None, 'items_detail': None, 'combined': False})
    
    elif old_files:
        # 旧格式：ch_XX_skeleton.json + ch_XX_deep.json
        max_chapter = 0
        for f in old_files:
            basename = os.path.basename(f)
            try:
                num = int(basename.split('_')[1])
                max_chapter = max(max_chapter, num)
            except:
                pass
        
        print(f"检测到 {max_chapter} 个章节（旧格式）")
        
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
                'items_detail': items_detail_data,
                'combined': False
            })
    else:
        print(f"⚠️ 警告: 在 {CHAPTERS_DIR} 中未找到章节文件")

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


def merge_items_by_name(items):
    """按名称合并重复物品：同名物品综合所有章的信息，保留最佳 ID"""
    by_name = {}
    for item in items:
        name = item.get('name', '')
        if not name:
            by_name.setdefault(item.get('id', ''), []).append(item)
            continue
        by_name.setdefault(name, []).append(item)

    merged = []
    for name, group in by_name.items():
        if len(group) == 1:
            merged.append(group[0])
            continue

        # 多个同名物品：合并为一个
        # 选择最佳 ID：优先 char_xxx 格式中最短的，否则第一个
        best = min(group, key=lambda x: (len(x.get('id', '')), x.get('id', '')))
        result = dict(best)

        for item in group:
            if item is best:
                continue
            for k, v in item.items():
                if k == 'id' or k == 'name':
                    continue
                if isinstance(v, list) and isinstance(result.get(k), list):
                    existing = set(str(x) for x in result[k])
                    for x in v:
                        if str(x) not in existing:
                            result[k].append(x)
                elif isinstance(v, str) and v and v != str(result.get(k, '')):
                    # 字符串字段：拼接不同值
                    existing = result.get(k, '')
                    if isinstance(existing, list):
                        pass  # skip: list vs string mismatch
                    elif existing and v not in str(existing):
                        result[k] = str(existing) + '；' + v
                    elif not existing:
                        result[k] = v
                elif v is not None and v != '' and v != [] and v != result.get(k):
                    result[k] = v

        merged.append(result)

    return merged


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
    """合并所有章节数据（兼容新单文件格式和旧双文件格式）"""
    all_characters = []
    all_factions = []
    all_locations = []
    all_skills = []
    all_items = []
    all_techniques = []
    all_events = []
    all_dialogues = []

    is_combined = any(ch.get('combined') for ch in chapters)

    for ch in chapters:
        if not ch.get('skeleton'):
            continue

        if is_combined:
            # 新格式：characters/skills/items 已包含全部字段，直接合并
            sk = ch['skeleton']
            all_characters = merge_list(all_characters, sk.get('characters', []))
            all_factions = merge_list(all_factions, sk.get('factions', []))
            all_locations = merge_list(all_locations, sk.get('locations', []))
            all_skills = merge_list(all_skills, sk.get('skills', []))
            all_items = merge_list(all_items, sk.get('items', []))
            all_events.extend(sk.get('events', []))
            all_dialogues.extend(sk.get('dialogues', []))
        else:
            # 旧格式：先合并骨架，再叠加精细数据
            sk = ch['skeleton']
            all_characters = merge_list(all_characters, sk.get('characters', []))
            all_factions = merge_list(all_factions, sk.get('factions', []))
            all_locations = merge_list(all_locations, sk.get('locations', []))
            all_skills = merge_list(all_skills, sk.get('skills', []))
            all_items = merge_list(all_items, sk.get('items', []))

            if ch.get('deep'):
                dp = ch['deep']
                for detail in dp.get('characters_detail', []):
                    for char in all_characters:
                        if char['id'] == detail['id']:
                            for k, v in detail.items():
                                if k == 'id': continue
                                if isinstance(v, list) and isinstance(char.get(k), list):
                                    existing = set(str(x) for x in char[k])
                                    for x in v:
                                        if str(x) not in existing: char[k].append(x)
                                elif v is not None and v != '': char[k] = v
                            break

                for detail in dp.get('skills_detail', []):
                    for skill in all_skills:
                        if skill['id'] == detail['id']:
                            for k, v in detail.items():
                                if k == 'id': continue
                                if isinstance(v, list) and isinstance(skill.get(k), list):
                                    existing = set(str(x) for x in skill[k])
                                    for x in v:
                                        if str(x) not in existing: skill[k].append(x)
                                elif v is not None and v != '': skill[k] = v
                            break

                all_techniques.extend(dp.get('techniques', []))
                all_events.extend(dp.get('events', []))
                all_dialogues.extend(dp.get('dialogues', []))

            item_details = []
            if ch.get('deep'): item_details.extend(ch['deep'].get('items_detail', []))
            if ch.get('items_detail'): item_details.extend(ch['items_detail'].get('items_detail', []))

            for detail in item_details:
                for item in all_items:
                    if item['id'] == detail['id']:
                        for k, v in detail.items():
                            if k == 'id': continue
                            if isinstance(v, list) and isinstance(item.get(k), list):
                                existing = set(str(x) for x in item[k])
                                for x in v:
                                    if str(x) not in existing: item[k].append(x)
                            elif v is not None and v != '': item[k] = v
                        break


    # 按名称合并重复角色：同名角色取最佳 ID，综合所有章的信息
    all_characters = merge_items_by_name(all_characters)

        # 按名称合并重复门派和地点
    all_factions = merge_items_by_name(all_factions)
    all_locations = merge_items_by_name(all_locations)

        # 按名称合并重复物品：同名物品取最佳 ID，综合所有章的信息
    all_items = merge_items_by_name(all_items)

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


def cleanup_invalid_refs(data):
    """清理 items/characters 中引用了不存在的 skill ID"""
    valid_skill_ids = set(s.get('id') for s in data.get('skills', []))
    cleaned = 0

    # 清理 items 的 related_skills
    for item in data.get('items', []):
        before = len(item.get('related_skills', []))
        normalized = []
        for sid in item.get('related_skills', []):
            if isinstance(sid, dict):
                normalized.append(sid.get('id', ''))
            else:
                normalized.append(sid)
        item['related_skills'] = [sid for sid in normalized if sid in valid_skill_ids]
        if len(item.get('related_skills', [])) != before:
            cleaned += 1

    # 清理 characters 的 known_skills / related_skills
    for char in data.get('characters', []):
        for key in ('known_skills', 'related_skills'):
            before = len(char.get(key, []))
            # Normalize: extract id from dicts if needed
            normalized = []
            for sid in char.get(key, []):
                if isinstance(sid, dict):
                    normalized.append(sid.get('id', ''))
                else:
                    normalized.append(sid)
            char[key] = [sid for sid in normalized if sid in valid_skill_ids]
            if len(char.get(key, [])) != before:
                cleaned += 1

    if cleaned > 0:
        print(f"  🧹 清理了 {cleaned} 个无效技能引用")
    return data


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
    merged = cleanup_invalid_refs(merged)
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
