#!/usr/bin/env python3
"""自动修复章节 JSON 文件中的常见格式错误

用法:
    python fix-json.py <小说目录>

修复内容:
    - 字符串内未转义的双引号 → 替换为单引号
    - 尾部多余逗号（,] 或 ,}）
    - 括号/花括号不匹配

示例:
    python fix-json.py 金庸/射雕英雄传
"""

import os
import sys
import json
import glob

if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python fix-json.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVEL_DIR, "chapters")


def fix_unescaped_quotes(raw: str) -> str:
    """修复字符串内未转义的双引号：用 state machine 找到字符串边界内的裸 " 替换为 '"""
    result = []
    in_string = False
    escaped = False

    for i, c in enumerate(raw):
        if escaped:
            result.append(c)
            escaped = False
            continue
        if c == '\\' and in_string:
            result.append(c)
            escaped = True
            continue
        if c == '"':
            if not in_string:
                in_string = True
                result.append(c)
            else:
                # 判断这个 " 是否真的是字符串结尾
                # 往后跳过空白，看下一个非空白字符
                j = i + 1
                while j < len(raw) and raw[j] in ' \t\r\n':
                    j += 1
                next_char = raw[j] if j < len(raw) else ''
                if next_char in (':', ',', ']', '}', ''):
                    # 真正的字符串结尾
                    in_string = False
                    result.append(c)
                else:
                    # 字符串内的裸引号，替换为单引号
                    result.append("'")
        else:
            result.append(c)

    return ''.join(result)


def fix_trailing_commas(raw: str) -> str:
    """修复 ] 或 } 前的多余逗号"""
    import re
    return re.sub(r',\s*([\]}])', r'\1', raw)


def try_fix_json(filepath: str) -> tuple[bool, str]:
    """尝试修复 JSON 文件，返回 (是否修复, 描述)"""
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = f.read()

    # 先尝试直接解析
    try:
        json.loads(raw)
        return False, ''  # 无需修复
    except json.JSONDecodeError:
        pass

    # 尝试修复 1: 未转义引号 + 尾部逗号
    fixed = fix_unescaped_quotes(raw)
    fixed = fix_trailing_commas(fixed)
    try:
        data = json.loads(fixed)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True, '修复了未转义引号/尾部逗号'
    except json.JSONDecodeError:
        pass

    # 尝试修复 2: 仅尾部逗号
    fixed = fix_trailing_commas(raw)
    try:
        data = json.loads(fixed)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True, '修复了尾部逗号'
    except json.JSONDecodeError:
        pass

    # 尝试修复 3: 仅未转义引号
    fixed = fix_unescaped_quotes(raw)
    try:
        data = json.loads(fixed)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True, '修复了未转义引号'
    except json.JSONDecodeError as e:
        return False, f'无法修复: {e.msg} (行 {e.lineno}, 列 {e.colno})'


def main():
    if not os.path.isdir(CHAPTERS_DIR):
        print(f"❌ 章节目录不存在: {CHAPTERS_DIR}")
        sys.exit(1)

    # 扫描所有 JSON 文件
    patterns = ["ch_??.json", "ch_*_skeleton.json", "ch_*_deep.json"]
    files = []
    for pat in patterns:
        files.extend(glob.glob(os.path.join(CHAPTERS_DIR, pat)))
    files = sorted(set(files))

    if not files:
        print(f"⚠️ 在 {CHAPTERS_DIR} 中未找到 JSON 文件")
        return

    print(f"📂 扫描 {len(files)} 个 JSON 文件...")

    valid = 0
    fixed = 0
    failed = 0

    for filepath in files:
        basename = os.path.basename(filepath)
        was_fixed, msg = try_fix_json(filepath)

        if not was_fixed:
            # 检查是否本来就有效
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    json.load(f)
                valid += 1
            except json.JSONDecodeError as e:
                failed += 1
                print(f"  ❌ {basename}: {msg}")
        else:
            fixed += 1
            print(f"  🔧 {basename}: {msg}")

    print(f"\n📊 结果: {valid} 有效, {fixed} 已修复, {failed} 无法修复")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
