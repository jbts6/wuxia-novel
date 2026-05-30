#!/usr/bin/env python3
"""精细化深度提取脚本：基于骨架索引+章节原文，逐章生成LLM提取prompt"""

import os
import sys
import json
import re

CHAPTERS_DIR = "金庸/天龙八部/chapters"
CHAPTER_TEXT_DIR = "金庸/天龙八部/ch_formatted"
PROMPT_FILE = "tools/extract/deep-prompt.md"
PROGRESS_FILE = "金庸/天龙八部/progress.json"


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"skeleton": {"done": []}, "deep": {"total": 50, "done": [], "failed": [], "pending": []}}


def save_progress(progress):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def load_chapter_text(ch_num):
    """加载章节格式化原文"""
    path = os.path.join(CHAPTER_TEXT_DIR, f"ch_{ch_num:02d}.md")
    if not os.path.exists(path):
        path = os.path.join("金庸/天龙八部/ch_original", f"ch_{ch_num:02d}.md")
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def load_skeleton(ch_num):
    """加载骨架提取结果"""
    path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def format_skeleton_index(skeleton):
    """将骨架数据格式化为prompt中的索引文本"""
    lines = []

    if 'characters' in skeleton:
        lines.append("### 人物")
        for c in skeleton['characters']:
            lines.append(f"- {c['id']}: {c['name']} ({c.get('identity', '')}) - {c.get('one_line', '')}")

    if 'factions' in skeleton:
        lines.append("\n### 门派")
        for f in skeleton['factions']:
            lines.append(f"- {f['id']}: {f['name']} ({f.get('type', '')}) - {f.get('one_line', '')}")

    if 'locations' in skeleton:
        lines.append("\n### 地点")
        for l in skeleton['locations']:
            lines.append(f"- {l['id']}: {l['name']} ({l.get('region', '')}) - {l.get('one_line', '')}")

    if 'skills' in skeleton:
        lines.append("\n### 武功")
        for s in skeleton['skills']:
            lines.append(f"- {s['id']}: {s['name']} ({s.get('type', '')}) - {s.get('one_line', '')}")

    return '\n'.join(lines)


def main():
    # 加载进度
    progress = load_progress()

    # 读取prompt模板
    with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
        prompt_template = f.read()

    # 获取需要处理的章节
    skeleton_done = set(progress["skeleton"]["done"])
    deep_done = set(progress["deep"]["done"])

    if len(sys.argv) > 1:
        target_chapters = [int(x) for x in sys.argv[1:]]
    else:
        # 只处理骨架已完成但深度未完成的
        target_chapters = sorted(skeleton_done - deep_done)

    print(f"需要深度提取 {len(target_chapters)} 个章节")

    for ch_num in target_chapters:
        skeleton = load_skeleton(ch_num)
        if skeleton is None:
            print(f"[SKIP] 章节 {ch_num} - 骨架文件不存在")
            continue

        chapter_text = load_chapter_text(ch_num)
        if chapter_text is None:
            print(f"[SKIP] 章节 {ch_num} - 章节原文不存在")
            continue

        deep_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep.json")
        if os.path.exists(deep_output):
            print(f"[SKIP] 章节 {ch_num} - 深度提取已存在（如需重跑请先删除）")
            if ch_num not in progress["deep"]["done"]:
                progress["deep"]["done"].append(ch_num)
            continue

        # 格式化骨架索引
        skeleton_index = format_skeleton_index(skeleton)

        # 替换prompt中的占位符
        full_prompt = prompt_template
        full_prompt = full_prompt.replace("{{CHAPTER_TEXT}}", chapter_text)
        full_prompt = full_prompt.replace("{{SKELETON_INDEX}}", skeleton_index)

        # 写入prompt文件供LLM调用
        prompt_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep_prompt.txt")
        with open(prompt_output, 'w', encoding='utf-8') as f:
            f.write(full_prompt)

        print(f"[INFO] 章节 {ch_num} - 精细化深度提取prompt已写入 {prompt_output}")
        print(f"[ACTION] 章节 {ch_num} - 请将 {prompt_output} 发送给LLM，将输出保存到 {deep_output}")

    save_progress(progress)
    print("完成！")


if __name__ == "__main__":
    main()
