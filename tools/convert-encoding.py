#!/usr/bin/env python3
"""将所有小说文本转换为UTF-8编码，原始文件备份为.bak"""

import os
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

AUTHORS = ['金庸', '古龙', '温瑞安', '黄易', '梁羽']
ENCODINGS = ['utf-8', 'gbk', 'gb18030', 'gb2312', 'big5', 'utf-16']


def detect_encoding(path):
    """检测文件编码，优先尝试严格模式，失败后用replace模式"""
    for enc in ENCODINGS:
        try:
            with open(path, 'r', encoding=enc) as f:
                f.read()
            return enc
        except:
            continue
    # 严格模式都失败，用replace模式重试
    for enc in ENCODINGS:
        try:
            with open(path, 'r', encoding=enc, errors='replace') as f:
                f.read()
            return enc
        except:
            continue
    return None


def convert_file(path, dry_run=False):
    """转换单个文件为UTF-8"""
    # 检测当前编码
    current_enc = detect_encoding(path)
    if current_enc is None:
        print(f"  [FAIL] 无法检测编码: {path}")
        return False

    if current_enc == 'utf-8':
        print(f"  [SKIP] 已是UTF-8: {os.path.basename(path)}")
        return True

    if dry_run:
        print(f"  [DRY]  {current_enc} → utf-8: {os.path.basename(path)}")
        return True

    # 备份原文件
    bak_path = path + '.bak'
    if not os.path.exists(bak_path):
        shutil.copy2(path, bak_path)

    # 读取并转换（replace模式处理损坏字节）
    try:
        with open(path, 'r', encoding=current_enc, errors='replace') as f:
            content = f.read()
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  [DONE] {current_enc} → utf-8: {os.path.basename(path)}")
        return True
    except Exception as e:
        print(f"  [FAIL] {path}: {e}")
        # 恢复备份
        if os.path.exists(bak_path):
            shutil.copy2(bak_path, path)
        return False


def main():
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("=== 模式: 预览（不实际转换）===\n")
    else:
        print("=== 模式: 实际转换（原文件备份为.bak）===\n")

    total = 0
    converted = 0
    skipped = 0
    failed = 0

    for author in AUTHORS:
        if not os.path.isdir(author):
            continue

        print(f"\n=== {author} ===")

        for root, dirs, files in os.walk(author):
            for f in files:
                if f.endswith('.txt') and not f.endswith('.bak.txt'):
                    path = os.path.join(root, f)
                    total += 1
                    result = convert_file(path, dry_run)
                    if result == True:
                        if 'SKIP' in str(result):
                            skipped += 1
                        else:
                            converted += 1
                    else:
                        failed += 1

    print(f"\n=== 统计 ===")
    print(f"总计: {total}")
    print(f"转换: {converted}")
    print(f"跳过: {skipped}")
    print(f"失败: {failed}")

    if not dry_run and converted > 0:
        print(f"\n原始文件已备份为 .bak，确认无误后可删除:")
        print(f"  find . -name '*.bak' -delete")


if __name__ == "__main__":
    main()
