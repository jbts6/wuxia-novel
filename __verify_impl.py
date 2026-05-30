import json, os

checks = {
    "Framework templates": [
        "framework/templates/character-template.md",
        "framework/templates/skill-template.md",
        "framework/templates/technique-template.md",
        "framework/templates/faction-template.md",
        "framework/templates/location-template.md",
        "framework/templates/item-template.md",
        "framework/templates/archetypes.json",
        "framework/templates/factions.json",
    ],
    "Balance": ["framework/balance/combat-formula.json"],
    "Extraction tools": [
        "tools/extract/skeleton-prompt.md",
        "tools/extract/deep-prompt.md",
        "tools/extract/extract-skeleton.py",
        "tools/extract/extract-deep.py",
    ],
    "Merge tools": ["tools/merge/merge-chapters.py"],
    "Gamify tools": ["tools/gamify/assign-stats.py"],
    "RAG tools": ["tools/rag/chunk-text.py"],
}

all_ok = True
for category, files in checks.items():
    ok = sum(1 for f in files if os.path.exists(f))
    total = len(files)
    status = "OK" if ok == total else "MISSING"
    print(f"  {category:30s} {ok}/{total}  {status}")
    if ok < total:
        all_ok = False

deep_sample = [1, 8, 25, 50]
for i in deep_sample:
    if not os.path.exists(f"金庸/天龙八部/chapters/ch_{i:02d}_deep.json"):
        print(f"    MISSING: ch_{i:02d}_deep.json")
        all_ok = False
print(f"  Deep outputs (sample): {len([i for i in deep_sample if os.path.exists(f'金庸/天龙八部/chapters/ch_{i:02d}_deep.json')])}/{len(deep_sample)}")

merge_chars = "novels/tianlong-babu/characters"
merge_skills = "novels/tianlong-babu/skills"
char_files = [f for f in os.listdir(merge_chars) if f.endswith(".md")] if os.path.isdir(merge_chars) else []
skill_files = [f for f in os.listdir(merge_skills) if f.endswith(".md")] if os.path.isdir(merge_skills) else []
print(f"  Merged char cards:       {len(char_files)}")
print(f"  Merged skill cards:      {len(skill_files)}")

print(f"\nOverall: {'ALL PASS' if all_ok else 'ISSUES FOUND'}")
