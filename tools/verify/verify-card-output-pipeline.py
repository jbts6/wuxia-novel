#!/usr/bin/env python3
"""Verify generated card output artifacts for the card-output-pipeline change.

用法:
    python verify-card-output-pipeline.py <小说目录>
    
示例:
    python verify-card-output-pipeline.py 金庸/天龙八部
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# 从命令行参数获取路径
if len(sys.argv) < 2:
    print("❌ 错误: 请提供小说目录路径")
    print("用法: python verify-card-output-pipeline.py <小说目录>")
    sys.exit(1)

NOVEL_DIR = Path(sys.argv[1])
CHAPTERS_DIR = NOVEL_DIR / "chapters"
CARD_DIRS = ("characters", "skills", "factions", "locations", "events", "items")

# 获取项目根目录（用于显示相对路径）
ROOT = Path.cwd()


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def fail(message: str) -> None:
    print(f"❌ FAIL: {message}")
    raise SystemExit(1)


def success(message: str) -> None:
    print(f"✅ PASS: {message}")


def get_frontmatter(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    return text[4:end]


def verify_techniques() -> None:
    skills_path = NOVEL_DIR / "skills.json"
    techniques_path = NOVEL_DIR / "techniques.json"
    
    if not skills_path.exists():
        fail("skills.json 不存在")
    if not techniques_path.exists():
        fail("techniques.json 不存在")
    
    skills = load_json(skills_path)
    techniques = load_json(techniques_path)

    expected = {}
    for skill in skills:
        for technique in skill.get("techniques", []):
            technique_id = technique.get("id")
            if technique_id:
                expected.setdefault(technique_id, technique)

    actual = {technique.get("id") for technique in techniques if technique.get("id")}

    if not expected:
        fail("skills.json does not contain embedded techniques to extract")
    if not actual:
        fail("techniques.json is empty")

    missing = sorted(set(expected) - actual)
    if missing:
        sample = ", ".join(missing[:10])
        fail(f"techniques.json is missing {len(missing)} embedded techniques: {sample}")
    
    success(f"techniques.json 包含 {len(actual)} 个招式")


def verify_markdown_cards() -> None:
    total = 0
    missing_frontmatter = []
    missing_fields = []

    for dirname in CARD_DIRS:
        card_dir = NOVEL_DIR / dirname
        if not card_dir.exists():
            fail(f"{dirname}/ 目录不存在")
        
        files = sorted(card_dir.glob("*.md"))
        if not files:
            fail(f"{dirname}/ has no generated markdown cards")

        for path in files:
            total += 1
            text = path.read_text(encoding="utf-8")
            frontmatter = get_frontmatter(text)
            rel = path.relative_to(NOVEL_DIR).as_posix()
            if frontmatter is None:
                missing_frontmatter.append(rel)
                continue

            required = ["type:", "tags:"]
            if dirname == "items":
                required.append("owner:")
            absent = [field for field in required if field not in frontmatter]
            if absent:
                missing_fields.append(f"{rel} missing {', '.join(absent)}")

    if missing_frontmatter:
        sample = ", ".join(missing_frontmatter[:10])
        fail(f"{len(missing_frontmatter)}/{total} cards do not start with YAML frontmatter: {sample}")

    if missing_fields:
        sample = "; ".join(missing_fields[:10])
        fail(f"{len(missing_fields)} cards have incomplete frontmatter: {sample}")
    
    success(f"验证通过 {total} 个 Markdown 卡片")


def verify_item_card_count() -> None:
    items_path = NOVEL_DIR / "items.json"
    if not items_path.exists():
        fail("items.json 不存在")
    
    items = load_json(items_path)
    items_dir = NOVEL_DIR / "items"
    if not items_dir.exists():
        fail("items/ 目录不存在")
    
    item_cards = sorted(items_dir.glob("*.md"))
    if len(item_cards) != len(items):
        fail(f"item card count mismatch: {len(item_cards)} markdown files for {len(items)} items")

    expected_ids = {item.get("id") for item in items if item.get("id")}
    found_ids = set()
    for path in item_cards:
        frontmatter = get_frontmatter(path.read_text(encoding="utf-8"))
        if frontmatter is None:
            continue
        for line in frontmatter.splitlines():
            if line.startswith("id:"):
                found_ids.add(line.split(":", 1)[1].strip())
                break

    missing = sorted(expected_ids - found_ids)
    if missing:
        sample = ", ".join(missing[:10])
        fail(f"item cards missing frontmatter ids for {len(missing)} items: {sample}")
    
    success(f"物品卡片数量匹配: {len(items)} 个")


def frontmatter_id(path: Path) -> str | None:
    frontmatter = get_frontmatter(path.read_text(encoding="utf-8"))
    if frontmatter is None:
        return None
    for line in frontmatter.splitlines():
        if line.startswith("id:"):
            return line.split(":", 1)[1].strip()
    return None


def skill_quality_score(skill: dict) -> tuple[int, str]:
    score = 0
    if skill.get("name") and not str(skill.get("name")).startswith("skill_"):
        score += 100
    if skill.get("faction"):
        score += 30
    score += len(skill.get("techniques") or []) * 10
    score += len(skill.get("progression") or []) * 4
    score += len(skill.get("effects") or []) * 4
    score += len(skill.get("rag_refs") or [])
    if skill.get("combat_style"):
        score += 5
    if skill.get("game_stats"):
        score += 3
    return score, str(skill.get("id") or "")


def expected_skill_cards(skills: list[dict]) -> dict[str, dict]:
    # 构建招式->父功法映射，排除属于其他功法的招式
    tech_to_parent: dict[str, list[str]] = {}
    for skill in skills:
        for tech in (skill.get("techniques") or []):
            tname = tech.get("name")
            if tname:
                tech_to_parent.setdefault(tname, []).append(skill.get("id", ""))

    by_name: dict[str, dict] = {}
    for skill in skills:
        name = skill.get("name")
        if not name or str(name).startswith("skill_"):
            continue
        # 排除名称是其他功法招式的条目
        parents = tech_to_parent.get(name, [])
        if any(pid != skill.get("id") for pid in parents):
            continue
        # 排除 功法·招式 模式
        if '·' in name:
            prefix = name.split('·')[0]
            parent_skill = next((s for s in skills if s.get('name') == prefix and (s.get('techniques') or [])), None)
            if parent_skill and parent_skill.get('id') != skill.get('id'):
                continue
        current = by_name.get(name)
        if current is None or skill_quality_score(skill) > skill_quality_score(current):
            by_name[name] = skill
    return by_name


def verify_skill_cards() -> None:
    skills_path = NOVEL_DIR / "skills.json"
    if not skills_path.exists():
        fail("skills.json 不存在")
    
    skills = load_json(skills_path)
    expected = expected_skill_cards(skills)
    
    skills_dir = NOVEL_DIR / "skills"
    if not skills_dir.exists():
        fail("skills/ 目录不存在")
    
    skill_cards = sorted(skills_dir.glob("*.md"))
    found = {path.stem: frontmatter_id(path) for path in skill_cards}

    missing = sorted(set(expected) - set(found))
    extra = sorted(set(found) - set(expected))
    wrong_ids = []
    for name, skill in expected.items():
        card_id = found.get(name)
        expected_id = skill.get("id")
        if card_id and card_id != expected_id:
            wrong_ids.append(f"{name}: {card_id} != {expected_id}")

    if missing:
        sample = ", ".join(missing[:10])
        fail(f"missing skill cards for {len(missing)} skills: {sample}")
    if extra:
        sample = ", ".join(extra[:10])
        fail(f"stale or placeholder skill cards found: {sample}")
    if wrong_ids:
        sample = "; ".join(wrong_ids[:10])
        fail(f"skill cards do not use the deepest canonical records: {sample}")
    
    success(f"技能卡片数量匹配: {len(expected)} 个")


def verify_item_related_skill_ids() -> None:
    skills_path = NOVEL_DIR / "skills.json"
    items_path = NOVEL_DIR / "items.json"
    
    if not skills_path.exists() or not items_path.exists():
        fail("skills.json 或 items.json 不存在")
    
    skills = load_json(skills_path)
    skill_ids = {skill.get("id") for skill in skills if skill.get("id")}
    
    missing = []
    for item in load_json(items_path):
        for skill_id in item.get("related_skills") or []:
            if skill_id not in skill_ids:
                missing.append(f"{item.get('id')}: {skill_id}")

    if missing:
        sample = "; ".join(missing[:10])
        fail(f"items reference unknown skill ids: {sample}")
    
    success("物品引用的技能ID全部有效")


def item_ids_from_skeleton(chapter_num: int) -> set[str]:
    skeleton_path = CHAPTERS_DIR / f"ch_{chapter_num:02d}_skeleton.json"
    if not skeleton_path.exists():
        return set()
    skeleton = load_json(skeleton_path)
    return {item.get("id") for item in skeleton.get("items", []) if item.get("id")}


def item_detail_ids(chapter_num: int) -> set[str]:
    detail_path = CHAPTERS_DIR / f"ch_{chapter_num:02d}_items_detail.json"
    if detail_path.exists():
        detail = load_json(detail_path)
        return {item.get("id") for item in detail.get("items_detail", []) if item.get("id")}

    deep_path = CHAPTERS_DIR / f"ch_{chapter_num:02d}_deep.json"
    if deep_path.exists():
        deep = load_json(deep_path)
        return {item.get("id") for item in deep.get("items_detail", []) if item.get("id")}

    return set()


def verify_items_detail_outputs() -> None:
    if not CHAPTERS_DIR.exists():
        fail("chapters/ 目录不存在")
    
    missing_outputs = []
    missing_ids = []

    # 自动检测章节数量
    import glob
    chapter_files = glob.glob(str(CHAPTERS_DIR / "ch_*_skeleton.json"))
    max_chapter = 0
    for f in chapter_files:
        basename = Path(f).name
        try:
            num = int(basename.split('_')[1])
            max_chapter = max(max_chapter, num)
        except:
            pass
    
    if max_chapter == 0:
        fail("未找到骨架文件")

    for chapter_num in range(1, max_chapter + 1):
        expected = item_ids_from_skeleton(chapter_num)
        if not expected:
            continue

        actual = item_detail_ids(chapter_num)
        if not actual:
            missing_outputs.append(chapter_num)
            continue

        missing = sorted(expected - actual)
        if missing:
            missing_ids.append(f"ch_{chapter_num:02d}: {', '.join(missing[:8])}")

    if missing_outputs:
        sample = ", ".join(f"ch_{n:02d}" for n in missing_outputs[:10])
        fail(f"missing items_detail outputs for {len(missing_outputs)} chapters with items: {sample}")

    if missing_ids:
        sample = "; ".join(missing_ids[:6])
        fail(f"items_detail outputs do not cover skeleton item ids: {sample}")
    
    success(f"物品详情覆盖全部 {max_chapter} 章")


def main() -> None:
    print(f"📂 验证目录: {NOVEL_DIR}")
    print("=" * 50)
    
    try:
        verify_techniques()
        verify_markdown_cards()
        verify_item_card_count()
        verify_skill_cards()
        verify_item_related_skill_ids()
        verify_items_detail_outputs()
        
        print("=" * 50)
        print("🎉 所有验证通过！")
    except SystemExit:
        print("=" * 50)
        print("💥 验证失败，请检查上述错误")
        sys.exit(1)


if __name__ == "__main__":
    main()
