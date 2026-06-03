const fs = require('fs');
const content = fs.readFileSync('金庸/连城诀/连城诀.txt', 'utf-8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Verify boundaries
console.log('Line 55:', JSON.stringify(lines[54].trim()));
console.log('Line 4493:', JSON.stringify(lines[4492].trim()));

// Extract: lines 55-4492 (ch1-12)
const cleanText = lines.slice(54, 4492).join('\n');
fs.writeFileSync('金庸/连城诀/连城诀_clean.txt', cleanText, 'utf-8');
console.log('Clean text written, lines:', cleanText.split('\n').length);

// Count chapter markers
const markers = cleanText.split('\n').filter(l => /^第[一二三四五六七八九十百]+回/.test(l.trim()));
console.log('Chapter markers:', markers.length);
markers.forEach(m => console.log('  ', m.trim()));
