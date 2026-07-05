#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const novelDir = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部';
const resultPath = path.join(novelDir, 'review', 'review-result.json');

if (!fs.existsSync(resultPath)) {
  console.error('Review result not found:', resultPath);
  process.exit(1);
}

const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const reviewResult = result.review_result || result;

console.log('=== Review Results ===');
console.log('Total items:', reviewResult.length);

// Extract suspicious items (those with issues)
const suspiciousItems = reviewResult.filter(r => r.suspicious === true);
console.log('Total suspicious items:', suspiciousItems.length);

const bySeverity = {
  high: [],
  medium: [],
  low: []
};

for (const item of suspiciousItems) {
  if (item.issues) {
    for (const issue of item.issues) {
      if (issue.severity === 'high') bySeverity.high.push({...item, issue});
      else if (issue.severity === 'medium') bySeverity.medium.push({...item, issue});
      else if (issue.severity === 'low') bySeverity.low.push({...item, issue});
    }
  }
}

console.log('\nBy severity:');
console.log('  High:', bySeverity.high.length);
console.log('  Medium:', bySeverity.medium.length);
console.log('  Low:', bySeverity.low.length);

const byType = {};
for (const item of suspiciousItems) {
  if (item.issues) {
    for (const issue of item.issues) {
      if (!byType[issue.type]) byType[issue.type] = 0;
      byType[issue.type]++;
    }
  }
}

console.log('\nBy issue type:');
for (const [type, count] of Object.entries(byType)) {
  console.log('  ' + type + ':', count);
}

console.log('\n=== High Severity Issues ===');
for (const item of bySeverity.high) {
  console.log('\n#' + item.index + ' ch' + item.chapter + ' [' + item.issue.type + '] ' + item.speaker);
  console.log('Text:', item.text.substring(0, 80) + '...');
  console.log('Description:', item.issue.description);
}

// Extract indices of suspicious dialogues for selective re-read
const suspiciousIndices = suspiciousItems.map(r => r.index);

console.log('\n=== Suspicious dialogue indices for re-read ===');
console.log(JSON.stringify(suspiciousIndices));

// Save indices to file
const indicesPath = path.join(novelDir, 'review', 'suspicious-indices.json');
fs.writeFileSync(indicesPath, JSON.stringify(suspiciousIndices, null, 2), 'utf8');
console.log('\nSuspicious indices saved to:', indicesPath);
