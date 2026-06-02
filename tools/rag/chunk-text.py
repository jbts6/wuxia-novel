#!/usr/bin/env python3
"""RAG切片脚本：从ch_formatted读取排版后文本，切为200-500字的chunk，附加元数据

用法:
    python chunk-text.py <小说目录>
    
示例:
    python chunk-text.py 金庸/天龙八部
"""

import os
import sys
import json
import re
import glob

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python chunk-text.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
FORMATTED_DIR = os.path.join(NOVEL_DIR, "ch_formatted")
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")
CHUNKS_DIR = os.path.join(NOVEL_DIR, "chunks")
PROGRESS_FILE = os.path.join(NOVEL_DIR, "progress.json")

CHAPTER_FILE_PATTERN = re.compile(r'ch_(\d+)\.md$')


def load_formatted_chapters():
    """从ch_formatted目录读取所有格式化章节，按编号排序"""
    chapters = []
    for fname in os.listdir(FORMATTED_DIR):
        match = CHAPTER_FILE_PATTERN.match(fname)
        if not match:
            continue
        ch_num = int(match.group(1))
        filepath = os.path.join(FORMATTED_DIR, fname)
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
        chapters.append({'num': ch_num, 'text': text, 'file': fname})
    
    chapters.sort(key=lambda x: x['num'])
    return chapters


def split_into_chunks(text, min_size=200, max_size=500):
    """将文本切分为chunks"""
    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = []
    current_size = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        para_size = len(para)
        
        if current_size + para_size > max_size and current_size >= min_size:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [para]
            current_size = para_size
        else:
            current_chunk.append(para)
            current_size += para_size
    
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
    
    return chunks


def create_chunk_metadata(chapter_num, chunk_index, chunk_text):
    """创建chunk元数据"""
    return {
        'id': f'ch{chapter_num:02d}_chunk{chunk_index:03d}',
        'chapter': chapter_num,
        'chunk_index': chunk_index,
        'text': chunk_text,
        'char_count': len(chunk_text),
        'paragraph_count': len([p for p in chunk_text.split('\n\n') if p.strip()])
    }


def main():
    print(f"📂 小说目录: {NOVEL_DIR}")
    
    # 加载章节
    print("加载格式化章节...")
    chapters = load_formatted_chapters()
    print(f"  找到 {len(chapters)} 个章节")
    
    # 确保输出目录存在
    os.makedirs(CHUNKS_DIR, exist_ok=True)
    
    all_chunks = []
    
    for chapter in chapters:
        ch_num = chapter['num']
        text = chapter['text']
        
        # 切分文本
        text_chunks = split_into_chunks(text)
        
        # 创建带元数据的chunks
        for i, chunk_text in enumerate(text_chunks):
            metadata = create_chunk_metadata(ch_num, i, chunk_text)
            all_chunks.append(metadata)
        
        print(f"  第 {ch_num} 章: {len(text_chunks)} 个chunks")
    
    # 保存chunks
    output_path = os.path.join(CHUNKS_DIR, "chunks.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 完成：共 {len(all_chunks)} 个chunks已保存到 {output_path}")
    
    # 更新进度
    progress = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['rag'] = True
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
