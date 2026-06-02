#!/usr/bin/env python3
"""
标准化原文文本
- 在自然断句处拆分长行
- 添加首行缩进（全角空格）
- 段落之间添加空行
- 保留章节标题格式

用法:
    python normalize-text.py <小说目录>
    
示例:
    python normalize-text.py 金庸/天龙八部
"""

import os
import sys
import re
import shutil
import glob

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python normalize-text.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]

# 自动检测小说文件（.txt 文件）
novel_files = glob.glob(os.path.join(NOVEL_DIR, "*.txt"))
if novel_files:
    NOVEL_FILE = os.path.basename(novel_files[0])
else:
    NOVEL_FILE = None


def backup_original(novel_dir, novel_file):
    """备份原文"""
    src = os.path.join(novel_dir, novel_file)
    backup_dir = os.path.join(novel_dir, "ch_original")
    os.makedirs(backup_dir, exist_ok=True)
    dst = os.path.join(backup_dir, novel_file)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
        print(f"已备份原文到 {dst}")
    return backup_dir


def normalize_text(text):
    """标准化文本"""
    lines = text.split('\n')
    normalized = []
    
    for line in lines:
        line = line.strip()
        if not line:
            normalized.append('')
            continue
        
        # 章节标题（以数字开头）
        if re.match(r'^[一二三四五六七八九十百千]+[　\s\t]+', line):
            normalized.append('')
            normalized.append(line)
            normalized.append('')
            continue
        
        # 普通段落：添加首行缩进
        if line:
            normalized.append('　　' + line)
    
    return '\n'.join(normalized)


def main():
    print(f"📂 小说目录: {NOVEL_DIR}")
    
    if not NOVEL_FILE:
        print("❌ 错误: 未找到小说 .txt 文件")
        sys.exit(1)
    
    print(f"📄 小说文件: {NOVEL_FILE}")
    
    # 备份原文
    backup_original(NOVEL_DIR, NOVEL_FILE)
    
    # 读取原文
    src_path = os.path.join(NOVEL_DIR, NOVEL_FILE)
    with open(src_path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
    
    # 标准化
    print("标准化文本...")
    normalized = normalize_text(text)
    
    # 保存到 ch_formatted 目录
    formatted_dir = os.path.join(NOVEL_DIR, "ch_formatted")
    os.makedirs(formatted_dir, exist_ok=True)
    
    # 按章节分割保存
    chapters = normalized.split('\n\n\n')
    chapter_num = 0
    for chapter in chapters:
        if chapter.strip():
            chapter_num += 1
            output_path = os.path.join(formatted_dir, f"ch_{chapter_num:02d}.md")
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(chapter.strip())
    
    print(f"✅ 完成：共 {chapter_num} 个章节已保存到 {formatted_dir}")


if __name__ == "__main__":
    main()
