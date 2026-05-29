#!/usr/bin/env python3
"""
标准化原文文本
- 在自然断句处拆分长行
- 添加首行缩进（全角空格）
- 段落之间添加空行
- 保留章节标题格式
"""

import os
import re
import shutil

NOVEL_DIR = "金庸/天龙八部"
NOVEL_FILE = "天龙八部.txt"


def backup_original(novel_dir, novel_file):
    """备份原文"""
    src = os.path.join(novel_dir, novel_file)
    dst = os.path.join(novel_dir, novel_file + ".bak")
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
        print(f"已备份原文到: {dst}")
    else:
        print(f"备份已存在: {dst}")


def is_chapter_title(line):
    """判断是否为章节标题"""
    # 匹配 "一　　青衫磊落险峰行" 这种格式
    if re.match(r'^[一二三四五六七八九十百千]+[　\s]+', line):
        return True
    # 匹配 "第一章 xxx" 这种格式
    if re.match(r'^第[一二三四五六七八九十百千零]+[章节回]', line):
        return True
    return False


def is_poem_or_song(line):
    """判断是否为诗词/歌词（目录部分）"""
    # 目录中的诗词通常有特定格式
    if re.match(r'^[一二三四五六七八九十]+[、.]', line):
        return True
    return False


def normalize_text(text):
    """标准化文本"""
    lines = text.split('\n')
    normalized_lines = []

    for line in lines:
        stripped = line.strip()

        # 跳过空行（后面会统一处理段落间距）
        if not stripped:
            continue

        # 章节标题：保留原格式，前后加空行
        if is_chapter_title(stripped):
            if normalized_lines and normalized_lines[-1] != '':
                normalized_lines.append('')  # 标题前空行
            normalized_lines.append(stripped)
            normalized_lines.append('')  # 标题后空行
            continue

        # 目录诗词：保留原格式
        if is_poem_or_song(stripped):
            normalized_lines.append(stripped)
            continue

        # 普通段落：拆分长行并添加缩进
        if len(stripped) > 100:
            # 长行需要拆分
            sentences = re.split(r'([。！？])', stripped)
            current_line = ""

            for i in range(0, len(sentences), 2):
                sentence = sentences[i]
                punct = sentences[i + 1] if i + 1 < len(sentences) else ""

                if len(current_line) + len(sentence) + len(punct) > 100:
                    if current_line:
                        # 添加首行缩进
                        normalized_lines.append('　　' + current_line)
                    current_line = sentence + punct
                else:
                    current_line += sentence + punct

            if current_line:
                normalized_lines.append('　　' + current_line)
        else:
            # 短行：直接添加缩进
            normalized_lines.append('　　' + stripped)

    # 清理：合并连续空行，确保段落之间只有一个空行
    result = []
    prev_empty = False

    for line in normalized_lines:
        if line == '':
            if not prev_empty:
                result.append(line)
            prev_empty = True
        else:
            result.append(line)
            prev_empty = False

    # 确保文件以换行符结尾
    if result and result[-1] != '':
        result.append('')

    return '\n'.join(result)


def main():
    # 备份原文
    backup_original(NOVEL_DIR, NOVEL_FILE)

    # 读取原文
    novel_path = os.path.join(NOVEL_DIR, NOVEL_FILE)
    with open(novel_path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()

    original_lines = len(text.split('\n'))
    print(f"原文行数: {original_lines}")
    print(f"原文字符数: {len(text)}")

    # 标准化
    normalized = normalize_text(text)
    normalized_lines = normalized.split('\n')

    print(f"标准化后行数: {len(normalized_lines)}")

    # 统计行长分布
    line_lengths = [len(line) for line in normalized_lines if line.strip()]
    if line_lengths:
        avg_len = sum(line_lengths) / len(line_lengths)
        max_len = max(line_lengths)
        print(f"平均行长: {avg_len:.1f} 字符")
        print(f"最大行长: {max_len} 字符")

    # 覆盖原文件
    with open(novel_path, 'w', encoding='utf-8') as f:
        f.write(normalized)

    print(f"\n已标准化并保存到: {novel_path}")
    print(f"原文备份在: {novel_path}.bak")


if __name__ == "__main__":
    main()
