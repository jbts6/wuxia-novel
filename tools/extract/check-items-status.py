#!/usr/bin/env python3
"""增量补充 items 数据：只对缺少 items 的章节重新提取"""

import os
import json
import sys

CHAPTERS_DIR = "金庸/天龙八部/chapters"

def check_items_status():
    """检查每章的 items 状态"""
    skeleton_missing = []
    deep_missing = []

    for i in range(1, 51):
        sk_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_skeleton.json")
        dp_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")

        # 检查 skeleton
        if os.path.exists(sk_path):
            with open(sk_path, encoding='utf-8') as f:
                sk = json.load(f)
                if 'items' not in sk or not sk['items']:
                    skeleton_missing.append(i)
        else:
            skeleton_missing.append(i)

        # 检查 deep
        if os.path.exists(dp_path):
            with open(dp_path, encoding='utf-8') as f:
                dp = json.load(f)
                if 'items_detail' not in dp or not dp['items_detail']:
                    deep_missing.append(i)
        else:
            deep_missing.append(i)

    return skeleton_missing, deep_missing

def main():
    print("检查 items 数据状态...")
    skeleton_missing, deep_missing = check_items_status()

    print(f"\nSkeleton 缺少 items 的章节: {len(skeleton_missing)}/50")
    print(f"章节号: {skeleton_missing[:10]}{'...' if len(skeleton_missing) > 10 else ''}")

    print(f"\nDeep 缺少 items_detail 的章节: {len(deep_missing)}/50")
    print(f"章节号: {deep_missing[:10]}{'...' if len(deep_missing) > 10 else ''}")

    print("\n要重新提取这些章节，请运行:")
    if skeleton_missing:
        print(f"  python tools/extract/extract-skeleton.py {' '.join(map(str, skeleton_missing[:5]))} ...")
    if deep_missing:
        print(f"  python tools/extract/extract-deep.py {' '.join(map(str, deep_missing[:5]))} ...")

if __name__ == '__main__':
    main()
