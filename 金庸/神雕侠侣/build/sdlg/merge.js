const fs = require('fs');
const path = require('path');
const dir = '/Users/jbts6/Site/wuxia-novel/金庸/神雕侠侣/build/sdlg';
const outPath = '/Users/jbts6/Site/wuxia-novel/金庸/神雕侠侣/data/dialogues.json';

let all = [];
for (let i = 1; i <= 8; i++) {
  const filePath = path.join(dir, `batch${i}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  all = all.concat(data);
}

// Sort by chapter
all.sort((a, b) => a.chapter - b.chapter);

// Remove duplicates by text
const seen = new Set();
const deduped = [];
for (const item of all) {
  const key = item.text + '|' + item.chapter;
  if (!seen.has(key)) {
    seen.add(key);
    deduped.push(item);
  }
}

fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf8');
console.log(`Total dialogues: ${deduped.length}`);
console.log(`Chapters covered: ${[...new Set(deduped.map(d => d.chapter))].sort((a,b) => a-b).join(', ')}`);
