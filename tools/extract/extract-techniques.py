#!/usr/bin/env python3
"""从 skills.json 提取 techniques 并去重写入 techniques.json

用法:
    python extract-techniques.py <小说目录>
    
示例:
    python extract-techniques.py 金庸/天龙八部
"""

import json
import sys
import os
from pathlib import Path

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python extract-techniques.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]


def extract_techniques():
    base_dir = Path(NOVEL_DIR)
    skills_file = base_dir / 'skills.json'
    if not skills_file.exists():
        skills_file = base_dir / 'game_skills.json'
    output_file = base_dir / 'techniques.json'

    if not skills_file.exists():
        print(f"❌ 错误: 未找到 skills.json 或 game_skills.json")
        sys.exit(1)

    print(f"📂 小说目录: {NOVEL_DIR}")
    print(f"📄 技能文件: {skills_file}")

    # 读取 skills
    with open(skills_file, encoding='utf-8') as f:
        skills = json.load(f)

    # 提取并去重 techniques
    techniques_map = {}

    for skill in skills:
        skill_id = skill.get('id', '')
        for tech in skill.get('techniques', []):
            if not isinstance(tech, dict):
                continue
            tech_id = tech.get('id')
            if not tech_id:
                continue
            if tech_id not in techniques_map:
                techniques_map[tech_id] = dict(tech)
                if skill_id:
                    techniques_map[tech_id].setdefault('source_skill', skill_id)

    techniques = list(techniques_map.values())

    # 写入结果
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(techniques, f, ensure_ascii=False, indent=2)

    print(f"✅ 提取完成: {len(techniques)} 个招式 -> {output_file}")


if __name__ == "__main__":
    extract_techniques()
