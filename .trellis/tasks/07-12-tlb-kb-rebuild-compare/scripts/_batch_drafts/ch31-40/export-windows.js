'use strict';
const fs = require('fs');
const path = require('path');

const INDEX = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部/build/source-index.json';
const DRAFT = '/Users/jbts6/Site/wuxia-novel/.trellis/tasks/07-12-tlb-kb-rebuild-compare/scripts/_batch_drafts/ch31-40';
const WINDIR = path.join(DRAFT, 'windows');
fs.mkdirSync(WINDIR, { recursive: true });

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const chapters = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
const wins = index.windows.filter(w => chapters.includes(w.chapter));

for (const w of wins) {
  const lines = w.text.split(/\n/);
  const numbered = lines.map((line, i) => String(w.line_start + i).padStart(4, ' ') + '|' + line);
  fs.writeFileSync(path.join(WINDIR, w.id + '.numbered.txt'), numbered.join('\n'));
  fs.writeFileSync(path.join(WINDIR, w.id + '.txt'), w.text);
  fs.writeFileSync(
    path.join(WINDIR, w.id + '.meta.json'),
    JSON.stringify(
      { id: w.id, chapter: w.chapter, line_start: w.line_start, line_end: w.line_end, chars: w.text.length },
      null,
      2
    )
  );
}

for (const f of ['named.jsonl', 'event.jsonl']) {
  const p = path.join(DRAFT, f);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

console.log(JSON.stringify({ exported: wins.length, ids: wins.map(w => w.id) }, null, 2));
