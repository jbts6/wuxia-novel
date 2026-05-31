#!/usr/bin/env python3
"""Verify generated card output artifacts for the card-output-pipeline change."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NOVEL_DIR = ROOT / "金庸" / "天龙八部"
CHAPTERS_DIR = NOVEL_DIR / "chapters"
CARD_DIRS = ("characters", "skills", "factions", "locations", "events", "items")


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def get_frontmatter(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    return text[4:end]


def verify_techniques() -> None:
    skills = load_json(NOVEL_DIR / "skills.json")
    techniques = load_json(NOVEL_DIR / "techniques.json")

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


def verify_markdown_cards() -> None:
    total = 0
    missing_frontmatter = []
    missing_fields = []

    for dirname in CARD_DIRS:
        card_dir = NOVEL_DIR / dirname
        files = sorted(card_dir.glob("*.md"))
        if not files:
            fail(f"{dirname}/ has no generated markdown cards")

        for path in files:
            total += 1
            text = path.read_text(encoding="utf-8")
            frontmatter = get_frontmatter(text)
            rel = path.relative_to(ROOT).as_posix()
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


def verify_item_card_count() -> None:
    items = load_json(NOVEL_DIR / "items.json")
    item_cards = sorted((NOVEL_DIR / "items").glob("*.md"))
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
    missing_outputs = []
    missing_ids = []

    for chapter_num in range(1, 51):
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


def main() -> None:
    verify_techniques()
    verify_markdown_cards()
    verify_item_card_count()
    verify_items_detail_outputs()
    print("card-output-pipeline verification passed")


if __name__ == "__main__":
    main()
