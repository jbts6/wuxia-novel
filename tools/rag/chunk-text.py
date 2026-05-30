#!/usr/bin/env python3
"""RAG切片脚本：从ch_formatted读取排版后文本，切为200-500字的chunk，附加元数据"""

import os
import json
import re

NOVEL_DIR = "金庸/天龙八部"
FORMATTED_DIR = os.path.join(NOVEL_DIR, "ch_formatted")
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")
CHUNKS_DIR = os.path.join(NOVEL_DIR, "chunks")
PROGRESS_FILE = os.path.join(NOVEL_DIR, "progress.json")

CHAPTER_FILE_PATTERN = re.compile(r'ch_(\d+)\.md$')


def load_formatted_chapters():
    """从ch_formatted目录读取所有格式化章节，按编号排序"""
    chapters = []
    for fname in os.listdir(FORMATTED_DIR):
        m = CHAPTER_FILE_PATTERN.match(fname)
        if m:
            path = os.path.join(FORMATTED_DIR, fname)
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                text = f.read()
            chapters.append({'num': int(m.group(1)), 'text': text, 'file': fname})
    chapters.sort(key=lambda c: c['num'])
    return chapters


def chunk_paragraph(text, min_size=100, max_size=500):
    """将文本按段落切分为chunk"""
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) < min_size:
            current_chunk += para + "\n"
        elif len(current_chunk) + len(para) <= max_size:
            current_chunk += para + "\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # 处理超长段落
            if len(para) > max_size:
                # 按句号拆分
                sentences = re.split(r'([。！？])', para)
                temp = ""
                for sent in sentences:
                    if len(temp) + len(sent) <= max_size:
                        temp += sent
                    else:
                        if temp:
                            chunks.append(temp.strip())
                        temp = sent
                if temp:
                    current_chunk = temp + "\n"
                else:
                    current_chunk = ""
            else:
                current_chunk = para + "\n"

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def load_skeleton(ch_num):
    """加载骨架数据用于元数据标注"""
    path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def annotate_chunk(chunk_text, skeleton):
    """为chunk添加元数据"""
    metadata = {
        'characters': [],
        'locations': [],
        'type': 'narration'
    }

    if skeleton:
        # 检测chunk中出现的人物
        for char in skeleton.get('characters', []):
            if char['name'] in chunk_text:
                metadata['characters'].append(char['id'])

        # 检测chunk中出现的地点
        for loc in skeleton.get('locations', []):
            if loc['name'] in chunk_text:
                metadata['locations'].append(loc['id'])

    # 检测类型
    if '"' in chunk_text or '"' in chunk_text or '道：' in chunk_text:
        metadata['type'] = 'dialogue'
    elif '只见' in chunk_text or '眼前' in chunk_text or '远处' in chunk_text:
        metadata['type'] = 'scene'

    return metadata


def main():
    # 从ch_formatted读取格式化章节
    formatted_chapters = load_formatted_chapters()
    print(f"检测到 {len(formatted_chapters)} 个格式化章节")

    # 确保输出目录存在
    os.makedirs(CHUNKS_DIR, exist_ok=True)

    all_chunks = []
    chunk_id = 0

    for ch in formatted_chapters:
        skeleton = load_skeleton(ch['num'])

        chunks = chunk_paragraph(ch['text'])
        print(f"第{ch['num']}章: {len(chunks)} 个chunk")

        for i, chunk_text in enumerate(chunks):
            chunk_id += 1
            metadata = annotate_chunk(chunk_text, skeleton)
            metadata['chapter'] = ch['num']
            metadata['chunk_index'] = i
            metadata['id'] = f"chunk_{chunk_id:04d}"

            all_chunks.append({
                'id': f"chunk_{chunk_id:04d}",
                'chapter': ch['num'],
                'text': chunk_text,
                'metadata': metadata
            })

    # 保存chunks
    output_path = os.path.join(CHUNKS_DIR, 'all_chunks.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\n总共 {len(all_chunks)} 个chunk，保存到 {output_path}")

    # 更新进度
    progress_path = os.path.join(NOVEL_DIR, 'progress.json')
    progress = {}
    if os.path.exists(progress_path):
        with open(progress_path, 'r', encoding='utf-8') as f:
            progress = json.load(f)
    progress['rag'] = True
    with open(progress_path, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    print("RAG切片完成！")


if __name__ == "__main__":
    main()
