#!/usr/bin/env python3
"""骨架提取脚本：逐章调用LLM提取人物/门派/地点/武功粗列表"""

import os
import sys
import json
import glob
import re

# 配置
NOVEL_DIR = "金庸/天龙八部"
NOVEL_FILE = "天龙八部.txt"
CHAPTERS_OUTPUT = "金庸/天龙八部/chapters"
PROMPT_FILE = "tools/extract/skeleton-prompt.md"
PROGRESS_FILE = "金庸/天龙八部/progress.json"

# 章节边界：每章以 "一\t" "二\t" 等数字开头
CHAPTER_PATTERN = re.compile(r'^[一二三四五六七八九十百千]+[　\s\t]+', re.MULTILINE)


def split_chapters(text):
    """将小说文本按章节分割"""
    lines = text.split('\n')
    chapters = []
    current_start = None
    current_num = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if CHAPTER_PATTERN.match(stripped):
            if current_start is not None:
                chapters.append({
                    'num': current_num,
                    'start': current_start,
                    'end': i
                })
            current_num += 1
            current_start = i

    # 最后一章
    if current_start is not None:
        chapters.append({
            'num': current_num,
            'start': current_start,
            'end': len(lines)
        })

    return chapters, lines


def load_progress():
    """加载进度文件"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "skeleton": {"total": 50, "done": [], "failed": [], "pending": []},
        "deep": {"total": 50, "done": [], "failed": [], "pending": []},
        "merge": False,
        "gamify": False,
        "rag": False
    }


def save_progress(progress):
    """保存进度文件"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_missing_chapters(progress):
    """获取需要提取的章节号"""
    done = set(progress["skeleton"]["done"])
    total = progress["skeleton"]["total"]
    return [i for i in range(1, total + 1) if i not in done]


def main():
    # 读取小说
    novel_path = os.path.join(NOVEL_DIR, NOVEL_FILE)
    with open(novel_path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()

    # 分割章节
    chapters, lines = split_chapters(text)
    print(f"检测到 {len(chapters)} 个章节")

    # 加载进度
    progress = load_progress()

    # 更新总章节数
    progress["skeleton"]["total"] = len(chapters)

    # 读取prompt
    with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
        prompt_template = f.read()

    # 获取需要处理的章节
    # 如果命令行指定了章节号，只处理那些
    if len(sys.argv) > 1:
        target_chapters = [int(x) for x in sys.argv[1:]]
    else:
        target_chapters = get_missing_chapters(progress)

    print(f"需要处理 {len(target_chapters)} 个章节: {target_chapters[:10]}...")

    # 确保输出目录存在
    os.makedirs(CHAPTERS_OUTPUT, exist_ok=True)

    # 处理每个章节
    for ch_num in target_chapters:
        if ch_num < 1 or ch_num > len(chapters):
            print(f"[SKIP] 章节 {ch_num} 超出范围")
            continue

        ch = chapters[ch_num - 1]
        chapter_text = '\n'.join(lines[ch['start']:ch['end']])
        output_file = os.path.join(CHAPTERS_OUTPUT, f"ch_{ch_num:02d}_skeleton.json")

        if os.path.exists(output_file):
            print(f"[SKIP] 章节 {ch_num} - 已存在")
            if ch_num not in progress["skeleton"]["done"]:
                progress["skeleton"]["done"].append(ch_num)
            continue

        print(f"[RUN]  章节 {ch_num} - 提取中... ({len(chapter_text)} 字)")

        # 构建完整prompt
        full_prompt = f"{prompt_template}\n\n---\n\n以下是第{ch_num}章原文：\n\n{chapter_text}"

        # 这里需要调用LLM
        # 实际使用时，将full_prompt发送给LLM API
        # result = call_llm_api(full_prompt)

        # 临时：将prompt写入文件供手动测试
        prompt_output = os.path.join(CHAPTERS_OUTPUT, f"ch_{ch_num:02d}_skeleton_prompt.txt")
        with open(prompt_output, 'w', encoding='utf-8') as f:
            f.write(full_prompt)

        print(f"[INFO] 章节 {ch_num} - prompt已写入 {prompt_output}")
        print(f"[TODO] 章节 {ch_num} - 需要调用LLM获取结果并保存到 {output_file}")

    save_progress(progress)
    print("完成！")


if __name__ == "__main__":
    main()
