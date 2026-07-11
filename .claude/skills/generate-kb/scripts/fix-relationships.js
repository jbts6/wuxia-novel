#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: fix-relationships.js <novelDir> [--dry-run]');
  console.error('  --dry-run: Show what would be changed without modifying files');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
const dryRun = args.includes('--dry-run');

// Load JSON file helper
function loadJson(filename, subdir) {
  const dirs = subdir ? [path.join(novelDir, subdir), novelDir] : [novelDir];
  for (const dir of dirs) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      } catch (e) {
        console.error(`Error parsing ${filename}: ${e.message}`);
        return null;
      }
    }
  }
  return null;
}

// Load characters
const characters = loadJson('characters.json', 'data') || [];
if (characters.length === 0) {
  console.error('No characters found');
  process.exit(1);
}

console.log(`Loaded ${characters.length} characters`);

// Build character lookup
const charById = new Map(characters.map(c => [c.id, c]));

// Collect all relationships
const relationships = [];
for (const char of characters) {
  if (!Array.isArray(char.relationships)) continue;
  for (const rel of char.relationships) {
    relationships.push({
      source: char.id,
      target: rel.target,
      type: rel.type,
      intensity: rel.intensity,
      bond_level: rel.bond_level,
      dynamic: rel.dynamic
    });
  }
}

console.log(`Found ${relationships.length} relationships`);

// Find missing reverse relationships
const missingReverse = [];
for (const rel of relationships) {
  const targetChar = charById.get(rel.target);
  if (!targetChar) continue;
  
  const hasReverse = targetChar.relationships && 
    targetChar.relationships.some(r => r.target === rel.source);
  
  if (!hasReverse) {
    missingReverse.push(rel);
  }
}

console.log(`Found ${missingReverse.length} missing reverse relationships`);

if (missingReverse.length === 0) {
  console.log('All relationships have reverse counterparts');
  process.exit(0);
}

// Add reverse relationships
let addedCount = 0;
for (const rel of missingReverse) {
  const targetChar = charById.get(rel.target);
  if (!targetChar) continue;
  
  if (!targetChar.relationships) {
    targetChar.relationships = [];
  }
  
  // Create reverse relationship
  const reverseRel = {
    target: rel.source,
    type: rel.type,
    intensity: rel.intensity,
    bond_level: rel.bond_level,
    dynamic: rel.dynamic ? rel.dynamic.split('→').reverse().join('→') : ''
  };
  
  if (dryRun) {
    console.log(`[DRY RUN] Would add: ${targetChar.name} -> ${charById.get(rel.source)?.name} (${rel.type})`);
  } else {
    targetChar.relationships.push(reverseRel);
    addedCount++;
  }
}

if (dryRun) {
  console.log(`\n[DRY RUN] Would add ${missingReverse.length} reverse relationships`);
} else {
  // Save modified characters
  const dataDir = path.join(novelDir, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const outputPath = path.join(dataDir, 'characters.json');
  fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2), 'utf8');
  console.log(`\nAdded ${addedCount} reverse relationships`);
  console.log(`Saved to ${outputPath}`);
}

// Verify result
if (!dryRun) {
  const remaining = [];
  for (const char of characters) {
    if (!Array.isArray(char.relationships)) continue;
    for (const rel of char.relationships) {
      const targetChar = charById.get(rel.target);
      if (!targetChar) continue;
      
      const hasReverse = targetChar.relationships && 
        targetChar.relationships.some(r => r.target === char.id);
      
      if (!hasReverse) {
        remaining.push(`${char.name} -> ${targetChar.name} (${rel.type})`);
      }
    }
  }
  
  if (remaining.length > 0) {
    console.log(`\nWarning: ${remaining.length} relationships still missing reverse:`);
    for (const r of remaining.slice(0, 10)) {
      console.log(`  - ${r}`);
    }
  } else {
    console.log('\nAll relationships now have reverse counterparts');
  }
}
