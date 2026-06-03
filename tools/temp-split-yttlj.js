const fs = require('fs');
const content = fs.readFileSync('金庸/倚天屠龙记/倚天屠龙记.txt', 'utf-8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Verify boundaries
console.log('Line 55:', JSON.stringify(lines[54].trim()));
console.log('Line 3976:', JSON.stringify(lines[3975].trim()));
console.log('Line 3994:', JSON.stringify(lines[3993].trim()));
console.log('Line 7949:', JSON.stringify(lines[7948].trim()));
console.log('Line 7967:', JSON.stringify(lines[7966].trim()));
console.log('Line 11934:', JSON.stringify(lines[11933].trim()));
console.log('Line 11954:', JSON.stringify(lines[11953].trim()));
console.log('Line 16128:', JSON.stringify(lines[16127].trim()));

// Extract: ch1-10 (55-3975) + ch11-20 (3994-7948) + ch21-30 (7967-11933) + ch31-40 (11954-16127)
const part1 = lines.slice(54, 3975);
const part2 = lines.slice(3993, 7948);
const part3 = lines.slice(7966, 11933);
const part4 = lines.slice(11953, 16127);
const cleanText = [...part1, '', '', ...part2, '', '', ...part3, '', '', ...part4].join('\n');

fs.writeFileSync('金庸/倚天屠龙记/倚天屠龙记_clean.txt', cleanText, 'utf-8');
console.log('Clean text written, lines:', cleanText.split('\n').length);

// Count chapter markers
const markers = cleanText.split('\n').filter(l => /^第[一二三四五六七八九十百]+回/.test(l.trim()) && !l.trim().includes(' '));
console.log('Chapter markers:', markers.length);
markers.forEach(m => console.log('  ', m.trim()));
