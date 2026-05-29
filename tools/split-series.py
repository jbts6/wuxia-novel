#!/usr/bin/env python3
"""拆分系列目录：将系列文件夹中的每本小说独立为单独的目录"""

import os
import json
import shutil

SUB_DIRS = ["chapters", "characters", "skills", "factions", "locations", "chunks"]
INITIAL_PROGRESS = {
    "skeleton": {"total": 0, "done": [], "failed": [], "pending": []},
    "deep": {"total": 0, "done": [], "failed": [], "pending": []},
    "merge": False,
    "gamify": False,
    "rag": False
}

# 需要拆分的系列目录
SERIES_DIRS = [
    "温瑞安/侠者系列",
    "温瑞安/七大寇系列",
    "温瑞安/不平社系列",
    "温瑞安/四大名捕系列",
    "温瑞安/神州奇侠系列",
    "温瑞安/神相李布衣系列",
    "温瑞安/说英雄谁是英雄系列",
    "温瑞安/白衣方振眉",
]


def create_novel_dir(author_dir, novel_name, src_txt):
    """为单本小说创建目录并移动文件"""
    # 命名规则: 系列名之小说名
    novel_dir = os.path.join(author_dir, novel_name)

    if os.path.exists(novel_dir):
        print(f"  [EXISTS] {novel_dir}")
        # 确保txt文件在正确位置
        dst_txt = os.path.join(novel_dir, os.path.basename(src_txt))
        if not os.path.exists(dst_txt) and os.path.exists(src_txt):
            shutil.move(src_txt, dst_txt)
            print(f"  [MOVE] {os.path.basename(src_txt)} → {novel_dir}/")
        return

    # 创建目录
    os.makedirs(novel_dir, exist_ok=True)

    # 移动txt文件
    dst_txt = os.path.join(novel_dir, os.path.basename(src_txt))
    if os.path.exists(src_txt) and not os.path.exists(dst_txt):
        shutil.move(src_txt, dst_txt)
        print(f"  [MOVE] {os.path.basename(src_txt)} → {novel_dir}/")

    # 创建子目录
    for sub in SUB_DIRS:
        os.makedirs(os.path.join(novel_dir, sub), exist_ok=True)

    # 创建progress.json
    with open(os.path.join(novel_dir, "progress.json"), 'w', encoding='utf-8') as f:
        json.dump(INITIAL_PROGRESS, f, ensure_ascii=False, indent=2)

    print(f"  [DONE] {novel_dir}/")


def split_series(series_path):
    """拆分一个系列目录"""
    author_dir = os.path.dirname(series_path)
    series_name = os.path.basename(series_path)

    print(f"\n=== {series_name} ===")

    # 递归找到所有.txt文件
    txt_files = []
    for root, dirs, files in os.walk(series_path):
        for f in files:
            if f.endswith('.txt'):
                txt_files.append(os.path.join(root, f))

    print(f"找到 {len(txt_files)} 本小说")

    for txt_path in sorted(txt_files):
        # 获取小说名（去掉.txt后缀）
        novel_name = os.path.splitext(os.path.basename(txt_path))[0]

        # 如果在子目录中，加上子目录名作为前缀
        rel_path = os.path.relpath(os.path.dirname(txt_path), series_path)
        if rel_path != '.':
            # 子目录中的小说，命名为 系列名之子目录名之小说名
            # 例如: 神州奇侠系列之正传之剑气长江
            full_name = f"{series_name}之{rel_path.replace(os.sep, '之')}之{novel_name}"
            # 简化：如果小说名已经包含系列信息，直接用
            if novel_name.startswith(series_name):
                full_name = novel_name
        else:
            # 根目录中的小说，命名为 系列名之小说名
            full_name = f"{series_name}之{novel_name}"

        create_novel_dir(author_dir, full_name, txt_path)

    # 检查系列目录是否还有文件
    remaining = []
    for root, dirs, files in os.walk(series_path):
        for f in files:
            if not f.startswith('progress.json'):
                remaining.append(os.path.join(root, f))

    if not remaining:
        # 删除空的系列目录（包括子目录）
        shutil.rmtree(series_path)
        print(f"  [CLEAN] 已删除空系列目录: {series_path}")
    else:
        print(f"  [WARN] 系列目录还有 {len(remaining)} 个文件未处理")


def main():
    for series_path in SERIES_DIRS:
        if os.path.isdir(series_path):
            split_series(series_path)
        else:
            print(f"[SKIP] 目录不存在: {series_path}")

    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()
