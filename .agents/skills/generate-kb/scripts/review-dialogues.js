#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assertLegacyWriteAllowed } = require('./lib/managed-write');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: review-dialogues.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);
assertLegacyWriteAllowed(novelDir, { operation: 'review-dialogues' });

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

// Load all 8 JSON files (from data/)
const characters = loadJson('characters.json', 'data') || [];
const factions = loadJson('factions.json', 'data') || [];
const locations = loadJson('locations.json', 'data') || [];
const skills = loadJson('skills.json', 'data') || [];
const techniques = loadJson('techniques.json', 'data') || [];
const items = loadJson('items.json', 'data') || [];
const dialogues = loadJson('dialogues.json', 'data') || [];
const chapterSummaries = loadJson('chapter_summaries.json', 'data') || [];

// Load review prompt
const promptPath = path.join(__dirname, '..', 'prompts', 'review-all.md');
const promptTemplate = fs.readFileSync(promptPath, 'utf8');

// Build summaries for context
const charSummary = characters.map(c => ({
  id: c.id,
  name: c.name,
  role: c.role,
  identity: c.identity,
  faction: c.faction,
  personality: c.personality?.traits?.slice(0, 3) || [],
  one_line: c.one_line
}));

const factionSummary = factions.map(f => ({
  id: f.id,
  name: f.name,
  type: f.type,
  location: f.location,
  one_line: f.one_line
}));

const locationSummary = locations.map(l => ({
  id: l.id,
  name: l.name,
  region: l.region,
  one_line: l.one_line
}));

const skillSummary = skills.map(s => ({
  id: s.id,
  name: s.name,
  type: s.type,
  mastery_rank: s.mastery_rank,
  practitioners: s.practitioners || [],
  one_line: s.one_line
}));

const techniqueSummary = techniques.map(t => ({
  id: t.id,
  name: t.name,
  type: t.type,
  source_skill: t.source_skill,
  one_line: t.one_line
}));

const itemSummary = items.map(i => ({
  id: i.id,
  name: i.name,
  type: i.type,
  owner: i.owner,
  rarity_tier: i.rarity_tier,
  related_skills: i.related_skills || [],
  one_line: i.one_line
}));

// Sample dialogues for review (first 50 for now, can be adjusted)
const sampleSize = Math.min(50, dialogues.length);
const sampleDialogues = dialogues.slice(0, sampleSize).map((d, idx) => ({
  index: idx,
  speaker: d.speaker,
  speaker_name: d.speaker_name,
  listener: d.listener,
  text: d.text,
  tone: d.tone,
  chapter: d.chapter,
  line_start: d.line_start,
  line_end: d.line_end
}));

const summarySample = chapterSummaries.map(s => ({
  chapter: s.chapter,
  title: s.title,
  key_events: s.key_events,
  key_characters: s.key_characters
}));

// Generate review prompt
const reviewPrompt = `${promptTemplate}

## 数据

### characters.json (${characters.length} 条)
${JSON.stringify(charSummary, null, 2)}

### factions.json (${factions.length} 条)
${JSON.stringify(factionSummary, null, 2)}

### locations.json (${locations.length} 条)
${JSON.stringify(locationSummary, null, 2)}

### skills.json (${skills.length} 条)
${JSON.stringify(skillSummary, null, 2)}

### techniques.json (${techniques.length} 条)
${JSON.stringify(techniqueSummary, null, 2)}

### items.json (${items.length} 条)
${JSON.stringify(itemSummary, null, 2)}

### dialogues.json (前 ${sampleSize} 条 / 共 ${dialogues.length} 条)
${JSON.stringify(sampleDialogues, null, 2)}

### chapter_summaries.json (${chapterSummaries.length} 条)
${JSON.stringify(summarySample, null, 2)}

---

请审阅上述所有 JSON 文件，输出 JSON 数组（最多 80 条可疑条目）。
`;

// Write prompt to file
const outputDir = path.join(novelDir, 'review');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const promptOutputPath = path.join(outputDir, 'review-prompt.md');
fs.writeFileSync(promptOutputPath, reviewPrompt, 'utf8');

console.log(`Review prompt generated: ${promptOutputPath}`);
console.log(`\nJSON files loaded:`);
console.log(`  characters.json: ${characters.length} entries`);
console.log(`  factions.json: ${factions.length} entries`);
console.log(`  locations.json: ${locations.length} entries`);
console.log(`  skills.json: ${skills.length} entries`);
console.log(`  techniques.json: ${techniques.length} entries`);
console.log(`  items.json: ${items.length} entries`);
console.log(`  dialogues.json: ${dialogues.length} entries (sampled ${sampleSize})`);
console.log(`  chapter_summaries.json: ${chapterSummaries.length} entries`);
console.log(`\nTo run the review, use the generated prompt with an LLM.`);
console.log(`Output should be saved to: ${path.join(outputDir, 'review-result.json')}`);

// Also generate a simple script to check results
const checkScript = `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const novelDir = '${novelDir}';
const resultPath = path.join(novelDir, 'review', 'review-result.json');

if (!fs.existsSync(resultPath)) {
  console.error('Review result not found:', resultPath);
  process.exit(1);
}

const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

console.log('=== Review Results ===');
console.log('Total suspicious items:', result.length);

const bySeverity = {
  high: result.filter(r => r.severity === 'high'),
  medium: result.filter(r => r.severity === 'medium'),
  low: result.filter(r => r.severity === 'low')
};

console.log('\\nBy severity:');
console.log('  High:', bySeverity.high.length);
console.log('  Medium:', bySeverity.medium.length);
console.log('  Low:', bySeverity.low.length);

const byJson = {};
for (const r of result) {
  if (!byJson[r.json_file]) byJson[r.json_file] = 0;
  byJson[r.json_file]++;
}

console.log('\\nBy JSON file:');
for (const [file, count] of Object.entries(byJson)) {
  console.log('  ' + file + ':', count);
}

const byType = {};
for (const r of result) {
  if (!byType[r.issue_type]) byType[r.issue_type] = 0;
  byType[r.issue_type]++;
}

console.log('\\nBy issue type:');
for (const [type, count] of Object.entries(byType)) {
  console.log('  ' + type + ':', count);
}

console.log('\\n=== High Severity Issues ===');
for (const r of bySeverity.high) {
  console.log('\\n[' + r.json_file + '#' + r.index + '] ' + (r.id || r.name || ''));
  console.log('Issue:', r.issue_type);
  console.log('Reason:', r.reason);
  console.log('Suggestion:', r.suggestion);
}

// Extract indices of suspicious items for selective review
const suspiciousIndices = result
  .filter(r => r.severity === 'high' || r.severity === 'medium')
  .map(r => ({ json_file: r.json_file, index: r.index, id: r.id }));

console.log('\\n=== Suspicious items for review ===');
console.log(JSON.stringify(suspiciousIndices, null, 2));

// Save indices to file
const indicesPath = path.join(novelDir, 'review', 'suspicious-indices.json');
fs.writeFileSync(indicesPath, JSON.stringify(suspiciousIndices, null, 2), '\\nSuspicious indices saved to:', indicesPath);
`;

const checkScriptPath = path.join(outputDir, 'check-review.js');
fs.writeFileSync(checkScriptPath, checkScript, 'utf8');
console.log(`\nCheck script generated: ${checkScriptPath}`);
console.log('After running the review, use this script to analyze results.');
