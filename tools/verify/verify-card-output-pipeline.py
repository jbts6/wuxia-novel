#!/usr/bin/env python3
"""Verify generated card output artifacts for the card-output-pipeline change."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NOVEL_DIR = ROOT / "金庸" / "天龙八部"
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


def main() -> None:
    verify_techniques()
    verify_markdown_cards()
    verify_item_card_count()
    print("card-output-pipeline verification passed")


if __name__ == "__main__":
    main()
