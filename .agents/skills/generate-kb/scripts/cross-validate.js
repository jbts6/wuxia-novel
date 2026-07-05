#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: cross-validate.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Load all JSON files
function loadJson(filename) {
  const fp = path.join(novelDir, filename);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error(`Error parsing ${filename}: ${e.message}`);
    return null;
  }
}

const characters = loadJson('characters.json') || [];
const factions = loadJson('factions.json') || [];
const locations = loadJson('locations.json') || [];
const skills = loadJson('skills.json') || [];
const techniques = loadJson('techniques.json') || [];
const items = loadJson('items.json') || [];
const dialogues = loadJson('dialogues.json') || [];
const mentionSummaryData = loadJson('mention_summary.json');
const mentionSummary = mentionSummaryData?.terms || [];

// Build ID sets
const charIds = new Set(characters.map(c => c.id));
const factionIds = new Set(factions.map(f => f.id));
const locationIds = new Set(locations.map(l => l.id));
const skillIds = new Set(skills.map(s => s.id));
const techIds = new Set(techniques.map(t => t.id));
const itemIds = new Set(items.map(i => i.id));

// Build name/alias sets for hallucination detection
const allNames = new Map(); // name -> { type, id }
for (const c of characters) {
  allNames.set(c.name, { type: 'character', id: c.id });
  if (Array.isArray(c.alias)) {
    for (const a of c.alias) allNames.set(a, { type: 'character', id: c.id });
  }
}
for (const f of factions) {
  allNames.set(f.name, { type: 'faction', id: f.id });
}
for (const l of locations) {
  allNames.set(l.name, { type: 'location', id: l.id });
}
for (const s of skills) {
  allNames.set(s.name, { type: 'skill', id: s.id });
}
for (const i of items) {
  allNames.set(i.name, { type: 'item', id: i.id });
}

// Build mention set from mention_summary
const mentionedTerms = new Set();
for (const item of mentionSummary) {
  if (item.term) mentionedTerms.add(item.term);
}

const issues = [];

// 1. Relationship symmetry check
console.log('Checking relationship symmetry...');
const relMap = new Map(); // id -> Set of targets
for (const c of characters) {
  if (!Array.isArray(c.relationships)) continue;
  for (const rel of c.relationships) {
    const key = `${c.id}->${rel.target}`;
    if (!relMap.has(c.id)) relMap.set(c.id, new Map());
    relMap.get(c.id).set(rel.target, rel.type);
  }
}

for (const c of characters) {
  if (!Array.isArray(c.relationships)) continue;
  for (const rel of c.relationships) {
    const reverse = relMap.get(rel.target);
    if (!reverse || !reverse.has(c.id)) {
      issues.push({
        type: 'relationship_asymmetric',
        severity: 'warning',
        source: c.id,
        target: rel.target,
        rel_type: rel.type,
        message: `${c.name}(${c.id}) -> ${rel.target} (${rel.type}) exists, but reverse not found`
      });
    }
  }
}

// 2. ID reference integrity check
console.log('Checking ID reference integrity...');

// characters.known_skills
for (const c of characters) {
  if (Array.isArray(c.known_skills)) {
    for (const skillId of c.known_skills) {
      if (!skillIds.has(skillId)) {
        issues.push({
          type: 'dangling_reference',
          severity: 'error',
          source: c.id,
          field: 'known_skills',
          ref: skillId,
          message: `${c.name}.known_skills references non-existent ${skillId}`
        });
      }
    }
  }
  if (Array.isArray(c.related_skills)) {
    for (const skillId of c.related_skills) {
      if (!skillIds.has(skillId)) {
        issues.push({
          type: 'dangling_reference',
          severity: 'error',
          source: c.id,
          field: 'related_skills',
          ref: skillId,
          message: `${c.name}.related_skills references non-existent ${skillId}`
        });
      }
    }
  }
  // characters.faction
  if (c.faction && !factionIds.has(c.faction)) {
    // Check if faction name matches instead of ID
    const factionByName = factions.find(f => f.name === c.faction);
    if (!factionByName) {
      issues.push({
        type: 'dangling_reference',
        severity: 'error',
        source: c.id,
        field: 'faction',
        ref: c.faction,
        message: `${c.name}.faction "${c.faction}" not found in factions.json`
      });
    }
  }
}

// items.owner and items.related_characters
for (const i of items) {
  if (i.owner && !charIds.has(i.owner)) {
    issues.push({
      type: 'dangling_reference',
      severity: 'error',
      source: i.id,
      field: 'owner',
      ref: i.owner,
      message: `${i.name}.owner references non-existent ${i.owner}`
    });
  }
  if (Array.isArray(i.related_characters)) {
    for (const charId of i.related_characters) {
      if (!charIds.has(charId)) {
        issues.push({
          type: 'dangling_reference',
          severity: 'error',
          source: i.id,
          field: 'related_characters',
          ref: charId,
          message: `${i.name}.related_characters references non-existent ${charId}`
        });
      }
    }
  }
  if (Array.isArray(i.related_skills)) {
    for (const skillId of i.related_skills) {
      if (!skillIds.has(skillId)) {
        issues.push({
          type: 'dangling_reference',
          severity: 'error',
          source: i.id,
          field: 'related_skills',
          ref: skillId,
          message: `${i.name}.related_skills references non-existent ${skillId}`
        });
      }
    }
  }
}

// dialogues.speaker and dialogues.listener
for (let idx = 0; idx < dialogues.length; idx++) {
  const d = dialogues[idx];
  if (d.speaker && !charIds.has(d.speaker)) {
    issues.push({
      type: 'dangling_reference',
      severity: 'warning',
      source: `dialogue[${idx}]`,
      field: 'speaker',
      ref: d.speaker,
      message: `Dialogue speaker "${d.speaker}" not found in characters.json`
    });
  }
  if (d.listener && !charIds.has(d.listener)) {
    issues.push({
      type: 'dangling_reference',
      severity: 'warning',
      source: `dialogue[${idx}]`,
      field: 'listener',
      ref: d.listener,
      message: `Dialogue listener "${d.listener}" not found in characters.json`
    });
  }
}

// skills.faction
for (const s of skills) {
  if (s.faction && !factionIds.has(s.faction)) {
    const factionByName = factions.find(f => f.name === s.faction);
    if (!factionByName) {
      issues.push({
        type: 'dangling_reference',
        severity: 'warning',
        source: s.id,
        field: 'faction',
        ref: s.faction,
        message: `${s.name}.faction "${s.faction}" not found in factions.json`
      });
    }
  }
}

// techniques.source_skill
for (const t of techniques) {
  if (t.source_skill && !skillIds.has(t.source_skill)) {
    issues.push({
      type: 'dangling_reference',
      severity: 'warning',
      source: t.id,
      field: 'source_skill',
      ref: t.source_skill,
      message: `${t.name}.source_skill references non-existent ${t.source_skill}`
    });
  }
}

// 3. Enum consistency check (power_rank/mastery_rank)
console.log('Checking enum consistency...');

const RANK_ORDER = ['平平无奇', '初窥门径', '略有小成', '登堂入室', '炉火纯青', '出神入化', '登峰造极', '返璞归真'];

const charRanks = new Map();
for (const c of characters) {
  if (c.power_rank) charRanks.set(c.id, { name: c.name, rank: c.power_rank });
}

const skillRanks = new Map();
for (const s of skills) {
  if (s.mastery_rank) skillRanks.set(s.id, { name: s.name, rank: s.mastery_rank });
}

// Check if character's power_rank matches their skills' mastery_rank
for (const c of characters) {
  if (!Array.isArray(c.known_skills)) continue;
  const charRankIdx = RANK_ORDER.indexOf(c.power_rank);
  if (charRankIdx < 0) continue;
  
  for (const skillId of c.known_skills) {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) continue;
    const skillRankIdx = RANK_ORDER.indexOf(skill.mastery_rank);
    if (skillRankIdx < 0) continue;
    
    // If character's rank is significantly lower than skill's rank, flag it
    if (skillRankIdx - charRankIdx > 2) {
      issues.push({
        type: 'rank_inconsistency',
        severity: 'info',
        source: c.id,
        skill: skillId,
        char_rank: c.power_rank,
        skill_rank: skill.mastery_rank,
        message: `${c.name}(${c.power_rank}) has ${skill.name}(${skill.mastery_rank}) - rank gap > 2`
      });
    }
  }
}

// 4. Alias deduplication check
console.log('Checking alias deduplication...');

const aliasMap = new Map(); // alias -> [char_id, ...]
for (const c of characters) {
  if (!Array.isArray(c.alias)) continue;
  for (const a of c.alias) {
    // Skip generic aliases
    if (/^(公子|姑娘|先生|师父|帮主|大王|王爷|夫人|大师|长老|掌门|大哥|兄弟|贤弟|贤妹|师妹|师弟|师兄|师姐)$/.test(a)) continue;
    if (!aliasMap.has(a)) aliasMap.set(a, []);
    aliasMap.get(a).push(c.id);
  }
}

for (const [alias, charIds] of aliasMap) {
  if (charIds.length > 1) {
    const names = charIds.map(id => characters.find(c => c.id === id)?.name || id).join(', ');
    issues.push({
      type: 'alias_duplicate',
      severity: 'warning',
      alias: alias,
      characters: charIds,
      message: `Alias "${alias}" appears in multiple characters: ${names}`
    });
  }
}

// 5. Hallucination detection (cross-book contamination)
console.log('Checking for hallucinations...');

// Terms that are suspicious if not in mention_summary
const SUSPICIOUS_PATTERNS = [
  // Other Jin Yong novels' characters
  /郭靖|黄蓉|杨过|小龙女|张无忌|赵敏|令狐冲|韦小宝|康熙|萧峰|段誉|虚竹/,
  // Other novels' items
  /玄铁令|屠龙刀|倚天剑|辟邪剑谱|葵花宝典/,
  // Other novels' locations
  /桃花岛|终南山|古墓|光明顶|黑木崖/,
];

// Check characters not mentioned in source text
for (const c of characters) {
  const name = c.name;
  // Check if name or any alias appears in mention_summary
  const found = mentionedTerms.has(name) || 
                (Array.isArray(c.alias) && c.alias.some(a => mentionedTerms.has(a)));
  
  if (!found && c.importance !== '背景') {
    issues.push({
      type: 'possible_hallucination',
      severity: 'warning',
      source: c.id,
      name: name,
      message: `Character "${name}" not found in mention_summary.json - possible hallucination`
    });
  }
}

// Check items not mentioned
for (const i of items) {
  const name = i.name;
  const found = mentionedTerms.has(name);
  
  if (!found) {
    issues.push({
      type: 'possible_hallucination',
      severity: 'warning',
      source: i.id,
      name: name,
      message: `Item "${name}" not found in mention_summary.json - possible hallucination`
    });
  }
}

// Check skills not mentioned
for (const s of skills) {
  const name = s.name;
  const found = mentionedTerms.has(name);
  
  if (!found) {
    issues.push({
      type: 'possible_hallucination',
      severity: 'info',
      source: s.id,
      name: name,
      message: `Skill "${name}" not found in mention_summary.json - possible hallucination`
    });
  }
}

// Check factions not mentioned
for (const f of factions) {
  const name = f.name;
  const found = mentionedTerms.has(name) || mentionedTerms.has(name.replace('寺', '').replace('派', ''));
  
  if (!found) {
    issues.push({
      type: 'possible_hallucination',
      severity: 'info',
      source: f.id,
      name: name,
      message: `Faction "${name}" not found in mention_summary.json - possible hallucination`
    });
  }
}

// Generate report
console.log('\n=== Cross Validation Report ===\n');

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

console.log(`Total issues: ${issues.length}`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Warnings: ${warnings.length}`);
console.log(`  Info: ${infos.length}`);

if (errors.length > 0) {
  console.log('\n--- ERRORS (must fix) ---');
  for (const e of errors) {
    console.log(`  [${e.type}] ${e.message}`);
  }
}

if (warnings.length > 0) {
  console.log('\n--- WARNINGS (should fix) ---');
  for (const w of warnings) {
    console.log(`  [${w.type}] ${w.message}`);
  }
}

if (infos.length > 0) {
  console.log('\n--- INFO (review) ---');
  for (const i of infos.slice(0, 20)) {
    console.log(`  [${i.type}] ${i.message}`);
  }
  if (infos.length > 20) {
    console.log(`  ... and ${infos.length - 20} more`);
  }
}

// Write full report to file
const report = {
  generated_at: new Date().toISOString(),
  summary: {
    total: issues.length,
    errors: errors.length,
    warnings: warnings.length,
    info: infos.length
  },
  issues: issues
};

const reportPath = path.join(novelDir, 'cross_validation_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\nFull report written to ${reportPath}`);

// Exit with error if there are errors
if (errors.length > 0) {
  process.exit(1);
}
