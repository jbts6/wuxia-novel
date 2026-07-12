#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '_win_ch048-056_num');
const out = '/tmp/lxf-ch048-056-all-scan.txt';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
let buf = '';
for (const f of files) {
  buf += `===== ${f} =====\n`;
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const line of text.split('\n')) {
    if (!/\|$/.test(line) && line.includes('|')) buf += line + '\n';
  }
}
fs.writeFileSync(out, buf);
console.log('wrote', out, 'bytes', buf.length, 'files', files.length);
