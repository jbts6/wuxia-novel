#!/usr/bin/env python3
"""精细化深度提取脚本：基于骨架索引+章节原文，逐章生成LLM提取prompt

用法:
    python extract-deep.py <小说目录> [章节号...]
    
示例:
    python extract-deep.py 金庸/天龙八部           # 处理所有未完成章节
    python extract-deep.py 金庸/天龙八部 1 2 3    # 只处理第1-3章
"""

import os
import sys
import json
import glob

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python extract-deep.py <小说目录> [章节号...]")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")
CHAPTER_TEXT_DIR = os.path.join(NOVEL_DIR, "ch_formatted")
PROGRESS_FILE = os.path.join(NOVEL_DIR, "progress.json")
PROMPT_FILE = "tools/extract/deep-prompt.md"


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"skeleton": {"done": []}, "deep": {"total": 0, "done": [], "failed": [], "pending": []}}


def save_progress(progress):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_missing_chapters(progress):
    """获取需要精细提取的章节号"""
    done = set(progress["deep"]["done"])
    total = progress["deep"]["total"]
    return [i for i in range(1, total + 1) if i not in done]


def load_skeleton(ch_num):
    """加载骨架数据"""
    skeleton_path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if os.path.exists(skeleton_path):
        with open(skeleton_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def load_chapter_text(ch_num):
    """加载章节原文"""
    # 优先从 ch_formatted 读取
    text_path = os.path.join(CHAPTER_TEXT_DIR, f"ch_{ch_num:02d}.md")
    if not os.path.exists(text_path):
        # 尝试 ch_original
        text_path = os.path.join(NOVEL_DIR, "ch_original", f"ch_{ch_num:02d}.md")
    if os.path.exists(text_path):
        with open(text_path, 'r', encoding='utf-8') as f:
            return f.read()
    return None


def format_skeleton_index(skeleton):
    """将骨架数据格式化为可读索引"""
    lines = []
    
    if 'characters' in skeleton:
        lines.append("### 人物")
        for char in skeleton['characters']:
            char_id = char.get('id', '')
            name = char.get('name', '')
            identity = char.get('identity', '')
            one_line = char.get('one_line', '')
            lines.append(f"- {char_id}: {name} ({identity}) - {one_line}")
        lines.append("")
    
    if 'factions' in skeleton:
        lines.append("### 门派")
        for faction in skeleton['factions']:
            faction_id = faction.get('id', '')
            name = faction.get('name', '')
            ftype = faction.get('type', '')
            one_line = faction.get('one_line', '')
            lines.append(f"- {faction_id}: {name} ({ftype}) - {one_line}")
        lines.append("")
    
    if 'locations' in skeleton:
        lines.append("### 地点")
        for loc in skeleton['locations']:
            loc_id = loc.get('id', '')
            name = loc.get('name', '')
            region = loc.get('region', '')
            one_line = loc.get('one_line', '')
            lines.append(f"- {loc_id}: {name} ({region}) - {one_line}")
        lines.append("")
    
    if 'skills' in skeleton:
        lines.append("### 武功")
        for skill in skeleton['skills']:
            skill_id = skill.get('id', '')
            name = skill.get('name', '')
            stype = skill.get('type', '')
            one_line = skill.get('one_line', '')
            lines.append(f"- {skill_id}: {name} ({stype}) - {one_line}")
        lines.append("")
    
    if 'items' in skeleton:
        lines.append("### 物品")
        for item in skeleton['items']:
            item_id = item.get('id', '')
            name = item.get('name', '')
            itype = item.get('type', '')
            one_line = item.get('one_line', '')
            lines.append(f"- {item_id}: {name} ({itype}) - {one_line}")
        lines.append("")
    
    return '\n'.join(lines)


def main():
    print(f"📂 小说目录: {NOVEL_DIR}")
    
    # 加载进度
    progress = load_progress()
    
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
        print("❌ 错误: 未找到骨架文件，请先运行骨架提取")
        sys.exit(1)
    
    progress["deep"]["total"] = max_chapter
    print(f"检测到 {max_chapter} 个章节")
    
    # 获取需要处理的章节
    if len(sys.argv) > 2:
        target_chapters = [int(x) for x in sys.argv[2:]]
    else:
        target_chapters = get_missing_chapters(progress)
    
    print(f"需要处理 {len(target_chapters)} 个章节: {target_chapters[:10]}...")
    
    # 读取prompt模板
    with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
        prompt_template = f.read()
    
    # 处理每个章节
    for ch_num in target_chapters:
        if ch_num < 1 or ch_num > max_chapter:
            print(f"[SKIP] 章节 {ch_num} 超出范围")
            continue
        
        output_file = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep.json")
        
        if os.path.exists(output_file):
            print(f"[SKIP] 章节 {ch_num} - 已存在")
            if ch_num not in progress["deep"]["done"]:
                progress["deep"]["done"].append(ch_num)
            continue
        
        # 加载骨架数据
        skeleton = load_skeleton(ch_num)
        if not skeleton:
            print(f"[SKIP] 章节 {ch_num} - 无骨架数据")
            continue
        
        # 加载章节原文
        chapter_text = load_chapter_text(ch_num)
        if not chapter_text:
            print(f"[SKIP] 章节 {ch_num} - 无章节原文")
            continue
        
        # 格式化骨架索引
        skeleton_index = format_skeleton_index(skeleton)
        
        print(f"[RUN]  章节 {ch_num} - 生成prompt... ({len(chapter_text)} 字)")
        
        # 构建完整prompt
        full_prompt = prompt_template.replace("{{SKELETON_INDEX}}", skeleton_index)
        full_prompt = full_prompt.replace("{{CHAPTER_TEXT}}", chapter_text)
        full_prompt = full_prompt.replace("{{CHAPTER_NUM}}", str(ch_num))
        
        # 保存prompt
        prompt_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep_prompt.txt")
        with open(prompt_output, 'w', encoding='utf-8') as f:
            f.write(full_prompt)
        
        print(f"[INFO] 章节 {ch_num} - prompt已写入 {prompt_output}")
        print(f"[TODO] 章节 {ch_num} - 需要调用LLM获取结果并保存到 {output_file}")
    
    save_progress(progress)
    print("✅ 完成！")


if __name__ == "__main__":
    main()
