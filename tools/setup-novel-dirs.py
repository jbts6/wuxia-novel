#!/usr/bin/env python3
"""初始化所有小说的目录结构：将每本小说包装为自包含文件夹"""

import os
import json
import shutil

# 作者目录列表
AUTHOR_DIRS = ["金庸", "古龙", "温瑞安", "黄易", "梁羽"]

# 每本小说需要的子目录
SUB_DIRS = ["chapters", "characters", "skills", "factions", "locations", "chunks"]

# 初始进度文件模板
INITIAL_PROGRESS = {
    "extract": {"total": 0, "done": [], "failed": [], "pending": []},
    "merge": False,
    "gamify": False,
    "rag": False
}


def setup_novel(author_dir, txt_file):
    """为单本小说创建目录结构"""
    novel_name = os.path.splitext(txt_file)[0]  # 去掉.txt后缀
    novel_dir = os.path.join(author_dir, novel_name)

    # 如果目录已存在，只补充缺失的文件
    if os.path.exists(novel_dir):
        print(f"  [EXISTS] {novel_dir}")
        # 检查并移动txt文件
        src = os.path.join(author_dir, txt_file)
        dst = os.path.join(novel_dir, txt_file)
        if os.path.exists(src) and not os.path.exists(dst):
            shutil.move(src, dst)
            print(f"  [MOVE] {txt_file} → {novel_dir}/")
        # 检查并创建子目录
        for sub in SUB_DIRS:
            sub_path = os.path.join(novel_dir, sub)
            if not os.path.exists(sub_path):
                os.makedirs(sub_path)
                print(f"  [ADD]  {sub}/")
        # 检查progress.json
        progress_path = os.path.join(novel_dir, "progress.json")
        if not os.path.exists(progress_path):
            with open(progress_path, 'w', encoding='utf-8') as f:
                json.dump(INITIAL_PROGRESS, f, ensure_ascii=False, indent=2)
            print(f"  [ADD]  progress.json")
        return

    # 创建小说目录
    os.makedirs(novel_dir, exist_ok=True)

    # 移动txt文件到新目录
    src = os.path.join(author_dir, txt_file)
    dst = os.path.join(novel_dir, txt_file)
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.move(src, dst)
        print(f"  [MOVE] {txt_file} → {novel_dir}/")
    elif os.path.exists(dst):
        print(f"  [SKIP] {txt_file} 已在目标位置")
    else:
        print(f"  [WARN] {src} 不存在")

    # 创建子目录
    for sub in SUB_DIRS:
        sub_path = os.path.join(novel_dir, sub)
        os.makedirs(sub_path, exist_ok=True)

    # 创建progress.json
    progress_path = os.path.join(novel_dir, "progress.json")
    with open(progress_path, 'w', encoding='utf-8') as f:
        json.dump(INITIAL_PROGRESS, f, ensure_ascii=False, indent=2)

    print(f"  [DONE] {novel_dir}/ ({len(SUB_DIRS)} 子目录 + progress.json)")


def main():
    total_novels = 0
    total_skipped = 0

    for author in AUTHOR_DIRS:
        if not os.path.isdir(author):
            print(f"[SKIP] 作者目录不存在: {author}")
            continue

        print(f"\n=== {author} ===")

        # 找到该作者下所有.txt文件
        txt_files = [f for f in os.listdir(author)
                     if f.endswith('.txt') and os.path.isfile(os.path.join(author, f))]

        print(f"找到 {len(txt_files)} 本小说")

        for txt_file in sorted(txt_files):
            setup_novel(author, txt_file)
            total_novels += 1

    print(f"\n=== 完成 ===")
    print(f"处理 {total_novels} 本小说")


if __name__ == "__main__":
    main()
