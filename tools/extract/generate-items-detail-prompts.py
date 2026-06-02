#!/usr/bin/env python3
"""Generate item-detail prompts for chapters with skeleton items.

用法:
    python generate-items-detail-prompts.py <小说目录> [章节号...]
    
示例:
    python generate-items-detail-prompts.py 金庸/天龙八部           # 处理所有章节
    python generate-items-detail-prompts.py 金庸/天龙八部 1 2 3    # 只处理第1-3章
"""

from __future__ import annotations

import json
import os
import sys
import glob

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python generate-items-detail-prompts.py <小说目录> [章节号...]")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")
CHAPTER_TEXT_DIR = os.path.join(NOVEL_DIR, "ch_formatted")
PROMPT_FILE = "tools/extract/items-detail-prompt.md"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_chapter_text(ch_num):
    path = os.path.join(CHAPTER_TEXT_DIR, f"ch_{ch_num:02d}.md")
    if not os.path.exists(path):
        path = os.path.join(NOVEL_DIR, "ch_original", f"ch_{ch_num:02d}.md")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_skeleton(ch_num):
    path = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_skeleton.json")
    if not os.path.exists(path):
        return None
    return load_json(path)


def load_item_detail_ids(ch_num):
    paths = [
        os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_items_detail.json"),
        os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_deep.json"),
    ]
    ids = set()
    for path in paths:
        if not os.path.exists(path):
            continue
        data = load_json(path)
        for item in data.get("items_detail", []):
            item_id = item.get("id")
            if item_id:
                ids.add(item_id)
    return ids


def item_ids(items):
    return {item.get("id") for item in items if item.get("id")}


def format_item_index(items):
    lines = []
    for item in items:
        lines.append(
            "- {id}: {name} ({type}) 持有者={owner} - {one_line}".format(
                id=item.get("id", ""),
                name=item.get("name", ""),
                type=item.get("type", ""),
                owner=item.get("owner", ""),
                one_line=item.get("one_line", ""),
            )
        )
    return "\n".join(lines)


def main():
    print(f"📂 小说目录: {NOVEL_DIR}")
    
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
        print("❌ 错误: 未找到骨架文件")
        sys.exit(1)
    
    print(f"检测到 {max_chapter} 个章节")
    
    # 获取目标章节
    if len(sys.argv) > 2:
        target_chapters = [int(arg) for arg in sys.argv[2:]]
    else:
        target_chapters = list(range(1, max_chapter + 1))
    
    # 读取prompt模板
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        template = f.read()

    generated = 0
    skipped = 0
    for ch_num in target_chapters:
        skeleton = load_skeleton(ch_num)
        if not skeleton:
            skipped += 1
            continue

        items = skeleton.get("items", [])
        expected_ids = item_ids(items)
        if not expected_ids:
            skipped += 1
            continue

        existing_ids = load_item_detail_ids(ch_num)
        if expected_ids.issubset(existing_ids):
            print(f"[SKIP] 章节 {ch_num} - items_detail 已覆盖全部物品")
            skipped += 1
            continue

        chapter_text = load_chapter_text(ch_num)
        if chapter_text is None:
            print(f"[SKIP] 章节 {ch_num} - 章节原文不存在")
            skipped += 1
            continue

        prompt = template.replace("{{ITEM_INDEX}}", format_item_index(items))
        prompt = prompt.replace("{{CHAPTER_TEXT}}", chapter_text)

        prompt_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_items_detail_prompt.txt")
        result_output = os.path.join(CHAPTERS_DIR, f"ch_{ch_num:02d}_items_detail.json")
        with open(prompt_output, "w", encoding="utf-8") as f:
            f.write(prompt)

        missing_count = len(expected_ids - existing_ids)
        print(f"[INFO] 章节 {ch_num} - 已写入 {prompt_output}，缺少 {missing_count} 个物品详情")
        print(f"[ACTION] 请将 LLM JSON 输出保存到 {result_output}")
        generated += 1

    print(f"\n✅ 完成：生成 {generated} 个 prompt，跳过 {skipped} 个章节")


if __name__ == "__main__":
    main()
