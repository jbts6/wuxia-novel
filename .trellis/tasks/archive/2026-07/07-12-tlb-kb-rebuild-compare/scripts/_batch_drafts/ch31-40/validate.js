'use strict';
const fs = require('fs');
const path = require('path');

const INDEX = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部/build/source-index.json';
const DRAFT = '/Users/jbts6/Site/wuxia-novel/.trellis/tasks/07-12-tlb-kb-rebuild-compare/scripts/_batch_drafts/ch31-40';
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const byId = new Map(index.windows.map(w => [w.id, w]));

function validateLine(obj) {
  const issues = [];
  const w = byId.get(obj.window_id);
  if (!w) return ['unknown window_id ' + obj.window_id];
  if (!obj.source_ref || !obj.source_ref.text) return ['missing source_ref.text'];
  if (!w.text.includes(obj.source_ref.text)) issues.push('source_ref.text not substring of window');
  if (obj.source_ref.line_start < w.line_start || obj.source_ref.line_end > w.line_end) {
    issues.push('line range outside window ' + w.line_start + '-' + w.line_end);
  }
  if (obj.context_source_ref) {
    if (!w.text.includes(obj.context_source_ref.text)) issues.push('context not substring');
  }
  if (obj.chapter !== w.chapter) issues.push('chapter mismatch');
  return issues;
}

function validateFile(file) {
  if (!fs.existsSync(file)) return { file, total: 0, ok: 0, bad: 0, samples: [] };
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  let ok = 0;
  const bad = [];
  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      bad.push({ line: line.slice(0, 80), issues: ['json parse'] });
      continue;
    }
    const issues = validateLine(obj);
    if (issues.length) bad.push({ id: obj.candidate_id, issues });
    else ok += 1;
  }
  return { file, total: lines.length, ok, bad: bad.length, samples: bad.slice(0, 20) };
}

const res = {
  named: validateFile(path.join(DRAFT, 'named.jsonl')),
  event: validateFile(path.join(DRAFT, 'event.jsonl'))
};
console.log(JSON.stringify(res, null, 2));
