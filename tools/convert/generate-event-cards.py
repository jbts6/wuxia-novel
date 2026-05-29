#!/usr/bin/env python3
"""从深度提取结果生成事件卡片"""

import os
import json

NOVELS_DIR = "金庸/天龙八部"
CHAPTERS_DIR = "金庸/天龙八部/chapters"


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


def event_to_markdown(event, characters_map):
    """将事件数据转换为Markdown"""
    event_id = event.get('id', '')
    name = event.get('name', 'Unknown Event')
    chapter = event.get('chapter', 0)
    event_type = event.get('type', 'plot')
    importance = event.get('importance', 'major')
    description = event.get('description', '')
    location = event.get('location', '')
    participants = event.get('participants', [])
    dialogues = event.get('dialogues', [])
    impacts = event.get('impacts', [])
    related_events = event.get('related_events', [])
    aftermath = event.get('aftermath', '')

    # YAML frontmatter
    frontmatter = f"""---
id: {event_id}
chapter: {chapter}
type: {event_type}
importance: {importance}
participants:"""

    for participant in participants:
        char_name = characters_map.get(participant, participant)
        frontmatter += f'\n  - "[[{char_name}]]"'

    if location:
        frontmatter += f'\nlocation: "[[{location}]]"'

    frontmatter += "\n---"

    # Body
    body = f"""
## 描述
{description}

## 关键对话
"""

    for dialogue in dialogues:
        speaker = dialogue.get('speaker', '')
        listener = dialogue.get('listener', '')
        text = dialogue.get('text', '')
        tone = dialogue.get('tone', '')
        body += f'> "{text}"\n'
        body += f"> —— {speaker}，{tone}\n\n"

    body += "## 影响\n"
    for impact in impacts:
        body += f"- {impact}\n"

    if related_events:
        body += "\n## 相关事件\n"
        for related in related_events:
            body += f"- [[{related}]]\n"

    if aftermath:
        body += f"\n## 后续发展\n{aftermath}\n"

    return f"# {name}\n\n{frontmatter}\n{body}"


def main():
    # 加载角色映射
    characters = load_json(os.path.join(NOVELS_DIR, 'characters.json'))
    characters_map = {}
    if characters:
        for char in characters:
            char_id = char.get('id', '')
            char_name = char.get('name', '')
            if char_id and char_name:
                characters_map[char_id] = char_name

    # 加载所有深度提取结果
    all_events = []
    for i in range(1, 51):
        deep_path = os.path.join(CHAPTERS_DIR, f"ch_{i:02d}_deep.json")
        if os.path.exists(deep_path):
            with open(deep_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                events = data.get('events', [])
                for event in events:
                    event['chapter'] = i
                    all_events.append(event)

    print(f"找到 {len(all_events)} 个事件")

    # 生成事件卡片
    events_dir = os.path.join(NOVELS_DIR, 'events')
    os.makedirs(events_dir, exist_ok=True)

    for event in all_events:
        event_id = event.get('id', '')
        event_name = event.get('name', 'unknown')
        markdown = event_to_markdown(event, characters_map)
        save_markdown(events_dir, event_name, markdown)

    print(f"已生成 {len(all_events)} 个事件卡片")

    # 生成事件时间线
    timeline_path = os.path.join(NOVELS_DIR, '事件时间线.md')
    with open(timeline_path, 'w', encoding='utf-8') as f:
        f.write("# 天龙八部 事件时间线\n\n")
        f.write("| 章节 | 事件 | 类型 | 参与者 | 地点 |\n")
        f.write("|------|------|------|--------|------|\n")

        # 按章节排序
        sorted_events = sorted(all_events, key=lambda x: x.get('chapter', 0))

        for event in sorted_events:
            chapter = event.get('chapter', 0)
            name = event.get('name', '')
            event_type = event.get('type', '')
            participants = [characters_map.get(p, p) for p in event.get('participants', [])]
            location = event.get('location', '')

            participants_str = ', '.join(participants[:3])  # 最多显示3个
            if len(participants) > 3:
                participants_str += '...'

            f.write(f"| {chapter} | [[{name}]] | {event_type} | {participants_str} | {location} |\n")

    print(f"已生成事件时间线: {timeline_path}")


if __name__ == "__main__":
    main()
