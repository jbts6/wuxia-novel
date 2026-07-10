#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const novelDir = '/Users/jbts6/Site/wuxia-novel/金庸/倚天屠龙记';
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

console.log('\nBy severity:');
console.log('  High:', bySeverity.high.length);
console.log('  Medium:', bySeverity.medium.length);
console.log('  Low:', bySeverity.low.length);

const byJson = {};
for (const r of result) {
  if (!byJson[r.json_file]) byJson[r.json_file] = 0;
  byJson[r.json_file]++;
}

console.log('\nBy JSON file:');
for (const [file, count] of Object.entries(byJson)) {
  console.log('  ' + file + ':', count);
}

const byType = {};
for (const r of result) {
  if (!byType[r.issue_type]) byType[r.issue_type] = 0;
  byType[r.issue_type]++;
}

console.log('\nBy issue type:');
for (const [type, count] of Object.entries(byType)) {
  console.log('  ' + type + ':', count);
}

console.log('\n=== High Severity Issues ===');
for (const r of bySeverity.high) {
  console.log('\n[' + r.json_file + '#' + r.index + '] ' + (r.id || r.name || ''));
  console.log('Issue:', r.issue_type);
  console.log('Reason:', r.reason);
  console.log('Suggestion:', r.suggestion);
}

// Extract indices of suspicious items for selective review
const suspiciousIndices = result
  .filter(r => r.severity === 'high' || r.severity === 'medium')
  .map(r => ({ json_file: r.json_file, index: r.index, id: r.id }));

console.log('\n=== Suspicious items for review ===');
console.log(JSON.stringify(suspiciousIndices, null, 2));

// Save indices to file
const indicesPath = path.join(novelDir, 'review', 'suspicious-indices.json');
fs.writeFileSync(indicesPath, JSON.stringify(suspiciousIndices, null, 2), '\nSuspicious indices saved to:', indicesPath);
