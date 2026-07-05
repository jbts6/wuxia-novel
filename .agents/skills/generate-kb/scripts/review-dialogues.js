#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: review-dialogues.js <novelDir>');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Load JSON files
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

const dialogues = loadJson('dialogues.json') || [];
const characters = loadJson('characters.json') || [];

// Load review prompt
const promptPath = path.join(__dirname, '..', 'prompts', 'review-dialogues.md');
const promptTemplate = fs.readFileSync(promptPath, 'utf8');

// Build character summary for context
const charSummary = characters.map(c => ({
  id: c.id,
  name: c.name,
  role: c.role,
  personality: c.personality?.traits?.slice(0, 3) || [],
  one_line: c.one_line
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

// Generate review prompt
const reviewPrompt = `${promptTemplate}

## 数据

### characters.json (摘要)
${JSON.stringify(charSummary, null, 2)}

### dialogues.json (前 ${sampleSize} 条)
${JSON.stringify(sampleDialogues, null, 2)}

---

请审阅上述 dialogues，输出 JSON 数组（最多 50 条可疑条目）。
`;

// Write prompt to file
const outputDir = path.join(novelDir, 'review');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const promptOutputPath = path.join(outputDir, 'review-prompt.md');
fs.writeFileSync(promptOutputPath, reviewPrompt, 'utf8');

console.log(`Review prompt generated: ${promptOutputPath}`);
console.log(`Total dialogues: ${dialogues.length}`);
console.log(`Sample size: ${sampleSize}`);
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
  console.log('\\n#' + r.index + ' [' + r.issue_type + '] ' + r.speaker);
  console.log('Text:', r.text.substring(0, 80) + '...');
  console.log('Reason:', r.reason);
  console.log('Suggestion:', r.suggestion);
}

// Extract indices of suspicious dialogues for selective re-read
const suspiciousIndices = result
  .filter(r => r.severity === 'high' || r.severity === 'medium')
  .map(r => r.index);

console.log('\\n=== Suspicious dialogue indices for re-read ===');
console.log(JSON.stringify(suspiciousIndices));

// Save indices to file
const indicesPath = path.join(novelDir, 'review', 'suspicious-indices.json');
fs.writeFileSync(indicesPath, JSON.stringify(suspiciousIndices, null, 2), 'utf8');
console.log('\\nSuspicious indices saved to:', indicesPath);
`;

const checkScriptPath = path.join(outputDir, 'check-review.js');
fs.writeFileSync(checkScriptPath, checkScript, 'utf8');
console.log(`\nCheck script generated: ${checkScriptPath}`);
console.log('After running the review, use this script to analyze results.');
