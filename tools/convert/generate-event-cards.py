#!/usr/bin/env python3
"""从深度提取结果生成事件卡片

用法:
    python generate-event-cards.py <小说目录>
    
示例:
    python generate-event-cards.py 金庸/天龙八部
"""

import os
import sys
import json

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python generate-event-cards.py <小说目录>")
    sys.exit(1)

NOVELS_DIR = sys.argv[1]
CHAPTERS_DIR = os.path.join(NOVELS_DIR, "chapters")
NOVEL_NAME = os.path.basename(NOVELS_DIR)


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_markdown(output_dir, filename, content):
    """保存Markdown文件"""
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"{filename}.md")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath


def extract_events_from_chapters():
    """从所有章节的深度提取结果中收集事件"""
    all_events = []
    
    # 自动检测章节数量
    import glob
    chapter_files = glob.glob(os.path.join(CHAPTERS_DIR, "ch_*_deep.json"))
    max_chapter = 0
    for f in chapter_files:
        basename = os.path.basename(f)
        try:
            num = int(basename.split('_')[1])
            max_chapter = max(max_chapter, num)
        except:
            pass
    
    for i in range(1, max_chapter + 1):
        deep_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")
        deep_data = load_json(deep_path)
        if deep_data and 'events' in deep_data:
            for event in deep_data['events']:
                event['chapter'] = i
                all_events.append(event)
    
    return all_events


def event_to_markdown(event):
    """将事件数据转换为Markdown"""
    event_id = event.get('id', 'unknown')
    name = event.get('name', '未知事件')
    chapter = event.get('chapter', 0)

    # YAML frontmatter
    frontmatter = f"""---
id: {event_id}
type: event
tags:
  - {NOVEL_NAME}
  - event
chapter: {chapter}
participants: {json.dumps(event.get('participants', []), ensure_ascii=False)}
location: {event.get('location', '')}
---"""

    # Body
    body = f"""
## 描述
{event.get('description', '暂无描述')}

## 参与者
"""

    for participant in event.get('participants', []):
        body += f"- [[{participant}]]\n"

    body += f"""
## 地点
[[{event.get('location', '')}]]
"""

    return f"{frontmatter}\n\n# {name}\n{body}"


def generate_timeline(events):
    """生成事件时间线"""
    timeline = f"# {NOVEL_NAME} 事件时间线\n\n"
    
    # 按章节分组
    by_chapter = {}
    for event in events:
        ch = event.get('chapter', 0)
        by_chapter.setdefault(ch, []).append(event)
    
    for ch in sorted(by_chapter.keys()):
        timeline += f"## 第 {ch} 章\n\n"
        for event in by_chapter[ch]:
            timeline += f"- **{event.get('name', '')}**: {event.get('description', '')[:50]}...\n"
        timeline += "\n"
    
    return timeline


def main():
    print(f"📂 小说目录: {NOVELS_DIR}")
    
    # 收集所有事件
    print("收集事件数据...")
    events = extract_events_from_chapters()
    print(f"  找到 {len(events)} 个事件")

    # 转换并保存事件卡
    print("生成事件卡片...")
    events_dir = os.path.join(NOVELS_DIR, 'events')
    os.makedirs(events_dir, exist_ok=True)
    
    # 重名事件用 id 作文件名
    name_counts = {}
    for e in events:
        n = e.get('name', 'unknown')
        name_counts[n] = name_counts.get(n, 0) + 1
    for event in events:
        name = event.get('name', 'unknown')
        event_id = event.get('id', name)
        filename = event_id if name_counts.get(name, 0) > 1 else name
        markdown = event_to_markdown(event)
        save_markdown(events_dir, filename, markdown)
    print(f"  已生成 {len(events)} 个事件卡")

    # 生成时间线
    print("生成时间线...")
    timeline = generate_timeline(events)
    timeline_path = os.path.join(NOVELS_DIR, 'event_timeline.md')
    with open(timeline_path, 'w', encoding='utf-8') as f:
        f.write(timeline)
    print(f"  时间线已保存到 {timeline_path}")

    print("\n✅ 生成完成！")


if __name__ == "__main__":
    main()
