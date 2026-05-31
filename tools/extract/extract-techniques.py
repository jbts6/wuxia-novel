#!/usr/bin/env python3
"""从 skills.json 提取 techniques 并去重写入 techniques.json"""

import json
from pathlib import Path

def extract_techniques():
    base_dir = Path('金庸/天龙八部')
    skills_file = base_dir / 'skills.json'
    if not skills_file.exists():
        skills_file = base_dir / 'game_skills.json'
    output_file = base_dir / 'techniques.json'

    # 读取 skills
    with open(skills_file, encoding='utf-8') as f:
        skills = json.load(f)

    # 提取并去重 techniques
    techniques_map = {}

    for skill in skills:
        if 'techniques' not in skill or not skill['techniques']:
            continue

        for tech in skill['techniques']:
            tech_id = tech.get('id')
            if not tech_id:
                continue

            if tech_id not in techniques_map:
                extracted = dict(tech)
                skill_id = skill.get('id')
                if skill_id:
                    extracted.setdefault('source_skill', skill_id)
                techniques_map[tech_id] = extracted

    # 转换为列表
    techniques = list(techniques_map.values())

    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(techniques, f, ensure_ascii=False, indent=2)

    print(f'提取完成：{len(techniques)} 个 techniques')
    print(f'输出文件：{output_file}')

if __name__ == '__main__':
    extract_techniques()
