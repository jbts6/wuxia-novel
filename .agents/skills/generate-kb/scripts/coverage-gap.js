#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: coverage-gap.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Load JSON file helper with subdirectory support
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

// Load JSON files (from appropriate subdirectories)
const mentionSummaryData = loadJson('mention_summary.json', 'build');
const mentionTerms = mentionSummaryData?.terms || [];

const characters = loadJson('characters.json', 'data') || [];
const factions = loadJson('factions.json', 'data') || [];
const locations = loadJson('locations.json', 'data') || [];
const skills = loadJson('skills.json', 'data') || [];
const items = loadJson('items.json', 'data') || [];

// Build covered terms set (names + aliases)
const coveredTerms = new Set();

function addCovered(name, aliases) {
  if (name) coveredTerms.add(name);
  if (Array.isArray(aliases)) {
    for (const a of aliases) coveredTerms.add(a);
  }
}

for (const c of characters) addCovered(c.name, c.alias);
for (const f of factions) addCovered(f.name, f.alias);
for (const l of locations) addCovered(l.name, l.alias);
for (const s of skills) addCovered(s.name, s.alias);
for (const t of techniques) addCovered(t.name, t.alias);
for (const i of items) addCovered(i.name, i.alias);

// Find gaps
const gaps = [];
for (const term of mentionTerms) {
  const name = term.term;
  const total = term.total || 0;
  
  if (!coveredTerms.has(name)) {
    gaps.push({
      term: name,
      total_mentions: total,
      chapter_count: term.chapter_count || 0,
      likely_type: guessType(name)
    });
  }
}

// Sort by total mentions (descending)
gaps.sort((a, b) => b.total_mentions - a.total_mentions);

// Guess type based on naming patterns
function guessType(name) {
  // Character names (2-3 Chinese characters)
  if (/^[\u4e00-\u9fa5]{2,3}$/.test(name)) {
    // Check if it looks like a person name
    if (/[峰誉竹峰清灵淳春秋]/.test(name)) return 'character';
  }
  
  // Faction names
  if (/[帮派门教宗]/.test(name)) return 'faction';
  
  // Location names
  if (/[山寺庄宫峰关湖林洞谷城]/.test(name)) return 'location';
  
  // Skill names
  if (/[掌剑指功步刀法拳经谱诀]/.test(name)) return 'skill';
  
  // Default
  return 'unknown';
}

// Generate report
console.log('=== Coverage Gap Analysis ===\n');
console.log(`Total mention terms: ${mentionTerms.length}`);
console.log(`Covered by KB: ${coveredTerms.size}`);
console.log(`Gaps found: ${gaps.length}`);

const highFreq = gaps.filter(g => g.total_mentions >= 100);
const mediumFreq = gaps.filter(g => g.total_mentions >= 20 && g.total_mentions < 100);
const lowFreq = gaps.filter(g => g.total_mentions < 20);

console.log('\nBy frequency:');
console.log(`  High (>=100 mentions): ${highFreq.length}`);
console.log(`  Medium (20-99 mentions): ${mediumFreq.length}`);
console.log(`  Low (<20 mentions): ${lowFreq.length}`);

if (highFreq.length > 0) {
  console.log('\n=== High Frequency Gaps (should add to KB) ===');
  for (const g of highFreq) {
    console.log(`  ${g.term} (${g.total_mentions} mentions, ~${g.likely_type})`);
  }
}

if (mediumFreq.length > 0) {
  console.log('\n=== Medium Frequency Gaps (review recommended) ===');
  for (const g of mediumFreq.slice(0, 20)) {
    console.log(`  ${g.term} (${g.total_mentions} mentions, ~${g.likely_type})`);
  }
  if (mediumFreq.length > 20) {
    console.log(`  ... and ${mediumFreq.length - 20} more`);
  }
}

// Generate Pass 3 patch prompt if there are high-freq gaps
if (highFreq.length > 0) {
  console.log('\n=== Pass 3 Patch Prompt ===');
  console.log('Run generate-kb Pass 3 with these missing entities:');
  for (const g of highFreq) {
    console.log(`  - ${g.term} (${g.total_mentions} mentions)`);
  }
}

// Write full report to file
const report = {
  generated_at: new Date().toISOString(),
  summary: {
    total_mention_terms: mentionTerms.length,
    covered_by_kb: coveredTerms.size,
    gaps_count: gaps.length,
    high_freq_gaps: highFreq.length,
    medium_freq_gaps: mediumFreq.length,
    low_freq_gaps: lowFreq.length
  },
  gaps: gaps,
  high_freq_gaps: highFreq,
  medium_freq_gaps: mediumFreq,
  low_freq_gaps: lowFreq
};

const reportPath = path.join(novelDir, 'reports', 'coverage_gap_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\nFull report written to ${reportPath}`);

// Write Pass 3 patch input if needed
if (highFreq.length > 0) {
  const patchInput = {
    missing_entities: highFreq.map(g => ({
      term: g.term,
      total_mentions: g.total_mentions,
      likely_type: g.likely_type,
      instruction: `Add this entity to the appropriate JSON file (characters/factions/locations/skills/items)`
    }))
  };
  
  const patchPath = path.join(novelDir, 'reports', 'pass3_patch_input.json');
  fs.writeFileSync(patchPath, JSON.stringify(patchInput, null, 2), 'utf8');
  console.log(`Pass 3 patch input written to ${patchPath}`);
}
