#!/usr/bin/env python3
"""增量补充 items 数据：只对缺少 items 的章节重新提取

用法:
    python check-items-status.py <小说目录>
    
示例:
    python check-items-status.py 金庸/天龙八部
"""

import os
import json
import sys
import glob

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python check-items-status.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")


def check_items_status():
    """检查每章的 items 状态"""
    skeleton_missing = []
    deep_missing = []
    items_detail_missing = []

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
        print(f"⚠️ 警告: 在 {CHAPTERS_DIR} 中未找到骨架文件")
        return

    print(f"📂 检查目录: {CHAPTERS_DIR}")
    print(f"检测到 {max_chapter} 个章节\n")

    for i in range(1, max_chapter + 1):
        sk_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_skeleton.json")
        dp_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")
        items_detail_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_items_detail.json")

        # 检查 skeleton
        if os.path.exists(sk_path):
            with open(sk_path, 'r', encoding='utf-8') as f:
                sk_data = json.load(f)
            if not sk_data.get('items'):
                skeleton_missing.append(i)
        else:
            skeleton_missing.append(i)

        # 检查 deep
        if os.path.exists(dp_path):
            with open(dp_path, 'r', encoding='utf-8') as f:
                dp_data = json.load(f)
            if not dp_data.get('items_detail'):
                deep_missing.append(i)
        else:
            deep_missing.append(i)

        # 检查 items_detail
        if not os.path.exists(items_detail_path):
            items_detail_missing.append(i)

    # 输出结果
    print("=" * 50)
    print("📊 Items 状态报告")
    print("=" * 50)
    
    print(f"\n🔴 Skeleton 缺少 items ({len(skeleton_missing)} 章):")
    if skeleton_missing:
        print(f"   {skeleton_missing}")
    else:
        print("   ✅ 全部完整")

    print(f"\n🟡 Deep 缺少 items_detail ({len(deep_missing)} 章):")
    if deep_missing:
        print(f"   {deep_missing}")
    else:
        print("   ✅ 全部完整")

    print(f"\n🔵 缺少独立 items_detail 文件 ({len(items_detail_missing)} 章):")
    if items_detail_missing:
        print(f"   {items_detail_missing[:20]}{'...' if len(items_detail_missing) > 20 else ''}")
    else:
        print("   ✅ 全部完整")

    # 建议操作
    print("\n" + "=" * 50)
    print("💡 建议操作")
    print("=" * 50)
    
    if skeleton_missing:
        print(f"\n1. 补充 skeleton items:")
        print(f"   python extract-skeleton.py {NOVEL_DIR} {' '.join(map(str, skeleton_missing[:10]))}")
    
    if deep_missing:
        print(f"\n2. 补充 deep items_detail:")
        print(f"   python extract-deep.py {NOVEL_DIR} {' '.join(map(str, deep_missing[:10]))}")
    
    if items_detail_missing:
        print(f"\n3. 生成独立 items_detail:")
        print(f"   python generate-items-detail-prompts.py {NOVEL_DIR}")


if __name__ == "__main__":
    check_items_status()
