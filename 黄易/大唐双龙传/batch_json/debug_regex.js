const fs = require('fs');
const file = '/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/ch_formatted/ch_353.md';
const content = fs.readFileSync(file, 'utf8');
const lineArr = content.split('\n');

// Test with a simple sample
var sample = lineArr.slice(0, 5).join('\n');
console.log('Sample text:');
console.log(sample);
console.log('---');

// Find lines with quotes
for (var li = 0; li < Math.min(30, lineArr.length); li++) {
  var line = lineArr[li];
  if (line.indexOf('"') !== -1) {
    console.log('Line ' + (li+1) + ': ' + line.substring(0, 120));
  }
}

// Try simple regex
var testLine = lineArr[0];
console.log('\nTest line 1: ' + testLine);

// Simple test: find "word道："pattern
var simpleRegex = /([\u4e00-\u9fff]+)道[""](.+?)[""]/g;
var m;
while ((m = simpleRegex.exec(content)) !== null) {
  console.log('MATCH: speaker="' + m[1] + '" marker="道" text="' + m[2].substring(0, 40) + '"');
  if (m.index > 500) break;
}
