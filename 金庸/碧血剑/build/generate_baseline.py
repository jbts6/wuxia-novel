#!/usr/bin/env python3
"""
Generate baseline.json for 碧血剑 from existing knowledge base JSONs.
"""
import json
import os
from datetime import datetime, timezone

# Paths
DATA_DIR = "金庸/碧血剑/data"
OUTPUT_DIR = "金庸/碧血剑/build"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "baseline.json")

def load_json(filename):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    # Load data
    characters = load_json("characters.json")
    skills = load_json("skills.json")
    items = load_json("items.json")
    dialogues = load_json("dialogues.json")
    chapter_summaries = load_json("chapter_summaries.json")
    factions = load_json("factions.json")
    locations = load_json("locations.json")
    
    # User-defined character importance overrides
    # Based on user's requirements
    char_importance_overrides = {
        # Core
        "char_yuan_cheng_zhi": "核心",
        "char_xia_qing_qing": "核心",
        # Important
        "char_a_jiu": "重要",
        "char_li_zi_cheng": "重要",
        "char_chong_zhen_huang_di": "重要",
        "char_gui_xin_shu": "重要",
        "char_mu_sang_dao_ren": "重要",
        "char_he_ti_shou": "重要",
        "char_yuan_chong_huan": "重要",
        # Secondary
        "char_an_da_niang": "次要",
        "char_ya_ba": "次要",
        "char_sun_zhong_jun": "次要",
        "char_jiao_wan_er": "次要",
        "char_hong_sheng_hai": "次要",
        "char_cui_qiu_shan": "次要",
        "char_li_yan": "次要",
        "char_gui_er_niang": "次要",
        "char_liu_pei_sheng": "次要",
        "char_mei_jian_he": "次要",
        "char_feng_nan_di": "次要",
    }
    
    # 1. Characters - group by importance
    char_by_importance = {"core": [], "important": [], "secondary": [], "minor": []}
    
    for char in characters:
        char_id = char["id"]
        
        # Use override if available, otherwise use original importance
        if char_id in char_importance_overrides:
            importance = char_importance_overrides[char_id]
        else:
            importance = char.get("importance", "")
            role = char.get("role", "")
            if not importance:
                importance = role
        
        # Map to baseline categories
        if importance == "核心":
            category = "core"
        elif importance == "重要":
            category = "important"
        elif importance == "次要":
            category = "secondary"
        else:
            category = "minor"
        
        # Extract traits from personality
        traits = []
        personality = char.get("personality", {})
        if isinstance(personality, dict):
            traits = personality.get("traits", [])
        
        char_entry = {
            "id": char_id,
            "name": char["name"],
            "importance": importance,
            "reason": char.get("one_line", ""),
            "expected_identity": char.get("identity", ""),
            "expected_traits": traits
        }
        
        char_by_importance[category].append(char_entry)
    
    # 2. Relationships - extract from characters
    relationships = []
    
    # Build character lookup
    char_lookup = {c["id"]: c for c in characters}
    
    # Add known relationships from user's list
    known_relationships = [
        ("char_yuan_cheng_zhi", "char_xia_qing_qing", "恋人"),
        ("char_yuan_cheng_zhi", "char_gui_xin_shu", "师兄弟"),
        ("char_yuan_cheng_zhi", "char_mu_sang_dao_ren", "师徒"),
        ("char_yuan_cheng_zhi", "char_a_jiu", "暧昧"),
        ("char_yuan_chong_huan", "char_yuan_cheng_zhi", "父子"),
        ("char_li_zi_cheng", "char_li_yan", "君臣"),
        ("char_chong_zhen_huang_di", "char_yuan_chong_huan", "君臣（杀害）"),
    ]
    
    for char1_id, char2_id, rel_type in known_relationships:
        if char1_id in char_lookup and char2_id in char_lookup:
            char1 = char_lookup[char1_id]
            char2 = char_lookup[char2_id]
            relationships.append({
                "char1": char1_id,
                "char1_name": char1["name"],
                "char2": char2_id,
                "char2_name": char2["name"],
                "type": rel_type,
                "description": f"{char1['name']}与{char2['name']}的关系：{rel_type}"
            })
    
    # Extract relationships from character data
    for char in characters:
        char_rels = char.get("relationships", [])
        if isinstance(char_rels, list):
            for rel in char_rels:
                if isinstance(rel, dict):
                    target_id = rel.get("target")
                    rel_type = rel.get("type", "")
                    if target_id and target_id in char_lookup:
                        # Avoid duplicates
                        existing = any(
                            (r["char1"] == char["id"] and r["char2"] == target_id) or
                            (r["char1"] == target_id and r["char2"] == char["id"])
                            for r in relationships
                        )
                        if not existing:
                            relationships.append({
                                "char1": char["id"],
                                "char1_name": char["name"],
                                "char2": target_id,
                                "char2_name": char_lookup[target_id]["name"],
                                "type": rel_type,
                                "description": f"{char['name']}与{char_lookup[target_id]['name']}的关系：{rel_type}"
                            })
    
    # 3. Events - extract from character source_refs
    events_by_chapter = {}
    
    # Collect events from character source_refs
    for char in characters:
        source_refs = char.get("source_refs", [])
        for ref in source_refs:
            chapter = ref.get("chapter")
            anchor = ref.get("anchor", "")
            event_type = ref.get("event_type", "")
            
            if chapter and anchor:
                if chapter not in events_by_chapter:
                    events_by_chapter[chapter] = []
                
                # Avoid duplicates
                event_desc = f"{char['name']}: {anchor}"
                if event_desc not in events_by_chapter[chapter]:
                    events_by_chapter[chapter].append(event_desc)
    
    # Collect events from skills source_refs
    for skill in skills:
        source_refs = skill.get("source_refs", [])
        for ref in source_refs:
            chapter = ref.get("chapter")
            anchor = ref.get("anchor", "")
            
            if chapter and anchor:
                if chapter not in events_by_chapter:
                    events_by_chapter[chapter] = []
                
                event_desc = f"{skill['name']}: {anchor}"
                if event_desc not in events_by_chapter[chapter]:
                    events_by_chapter[chapter].append(event_desc)
    
    # Collect events from items source_refs
    for item in items:
        source_refs = item.get("source_refs", [])
        for ref in source_refs:
            chapter = ref.get("chapter")
            anchor = ref.get("anchor", "")
            
            if chapter and anchor:
                if chapter not in events_by_chapter:
                    events_by_chapter[chapter] = []
                
                event_desc = f"{item['name']}: {anchor}"
                if event_desc not in events_by_chapter[chapter]:
                    events_by_chapter[chapter].append(event_desc)
    
    # Build events list
    events = []
    for chapter_num in sorted(events_by_chapter.keys()):
        events.append({
            "chapter": chapter_num,
            "title": f"第{chapter_num}回",
            "events": events_by_chapter[chapter_num]
        })
    
    # 4. Skills - extract important skills
    skills_baseline = []
    for skill in skills:
        # Include all skills for now, but mark importance
        importance = "重要"  # Default
        if "金蛇" in skill.get("name", ""):
            importance = "核心"
        elif "华山" in skill.get("name", ""):
            importance = "核心"
        
        skills_baseline.append({
            "id": skill["id"],
            "name": skill["name"],
            "type": skill.get("type", ""),
            "importance": importance,
            "description": skill.get("one_line", "")
        })
    
    # 5. Items - extract important items
    items_baseline = []
    for item in items:
        importance = "重要"  # Default
        if "金蛇" in item.get("name", ""):
            importance = "核心"
        
        items_baseline.append({
            "id": item["id"],
            "name": item["name"],
            "type": item.get("type", ""),
            "importance": importance,
            "description": item.get("one_line", "")
        })
    
    # 6. Dialogues - select 5-10 representative dialogues
    # Filter for meaningful dialogues (not just narration)
    meaningful_dialogues = []
    for dlg in dialogues:
        text = dlg.get("text", "")
        # Accept dialogues with or without speaker, prefer longer ones
        if len(text) > 20 and len(text) < 200:
            meaningful_dialogues.append(dlg)
    
    # Sort by length (prefer longer, more meaningful dialogues)
    meaningful_dialogues.sort(key=lambda x: len(x.get("text", "")), reverse=True)
    
    # Select up to 10 dialogues
    selected_dialogues = meaningful_dialogues[:10]
    
    dialogues_baseline = []
    for dlg in selected_dialogues:
        dialogues_baseline.append({
            "id": dlg["id"],
            "speaker": dlg.get("speaker_name") or dlg.get("speaker") or "未知",
            "text": dlg["text"],
            "chapter": dlg.get("chapter"),
            "tone": dlg.get("tone", "")
        })
    
    # 7. Factions - extract from factions.json
    factions_baseline = []
    for faction in factions:
        importance = "重要"  # Default
        if "华山" in faction.get("name", ""):
            importance = "核心"
        
        factions_baseline.append({
            "id": faction["id"],
            "name": faction["name"],
            "type": faction.get("type", ""),
            "importance": importance,
            "reason": faction.get("one_line", "")
        })
    
    # 8. Locations - extract from locations.json
    locations_baseline = []
    for location in locations:
        importance = "重要"  # Default
        if "华山" in location.get("name", ""):
            importance = "核心"
        
        locations_baseline.append({
            "id": location["id"],
            "name": location["name"],
            "importance": importance,
            "reason": location.get("one_line", "")
        })
    
    # Build baseline.json
    baseline = {
        "novel": "碧血剑",
        "author": "金庸",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "characters": {
            "core": char_by_importance["core"],
            "important": char_by_importance["important"],
            "secondary": char_by_importance["secondary"],
            "minor": char_by_importance["minor"]
        },
        "relationships": relationships,
        "events": events,
        "skills": skills_baseline,
        "items": items_baseline,
        "dialogues": dialogues_baseline,
        "factions": factions_baseline,
        "locations": locations_baseline
    }
    
    # Write output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(baseline, f, ensure_ascii=False, indent=2)
    
    print(f"Generated {OUTPUT_FILE}")
    print(f"Characters: core={len(char_by_importance['core'])}, important={len(char_by_importance['important'])}, secondary={len(char_by_importance['secondary'])}, minor={len(char_by_importance['minor'])}")
    print(f"Relationships: {len(relationships)}")
    print(f"Events: {len(events)}")
    print(f"Skills: {len(skills_baseline)}")
    print(f"Items: {len(items_baseline)}")
    print(f"Dialogues: {len(dialogues_baseline)}")

if __name__ == "__main__":
    main()