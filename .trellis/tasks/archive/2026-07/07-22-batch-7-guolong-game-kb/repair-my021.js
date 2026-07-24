const fs = require('fs');
const path = require('path');

const draftPath =
  '梁羽生/牧野流星/.game-kb-work/runs/run-2026-07-23T16-29-50-099Z-42404-71f437a9/drafts/chapter_021/cycle_01/attempt_01.yaml';
const outPath =
  '梁羽生/牧野流星/.game-kb-work/runs/run-2026-07-23T16-29-50-099Z-42404-71f437a9/staging/chapter_021/cycle_01/attempt_02.yaml';

const draft = fs.readFileSync(draftPath, 'utf8');
const lines = draft.split(/\r?\n/);

// Mechanical repair: rewrite double-quoted `text:` scalars as single-quoted YAML,
// so embedded " do not break the parser (YAML_INDENTATION from unescaped quotes).
const fixed = lines.map((line) => {
  const m = line.match(/^(\s*-\s*text:\s*)"(.*)"\s*$/);
  if (!m) return line;
  let body = m[2];
  // unescape any already-escaped quotes inside the double-quoted form
  body = body.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const single = body.replace(/'/g, "''");
  return `${m[1]}'${single}'`;
});

const result = fixed.join('\n') + (draft.endsWith('\n') ? '' : '\n');

let ok = false;
let err = null;
const tryParse = (mod) => {
  const yaml = require(mod);
  if (yaml.parse) yaml.parse(result);
  else if (yaml.load) yaml.load(result);
  ok = true;
};

for (const mod of ['yaml', 'js-yaml']) {
  try {
    const resolved = require.resolve(mod, {
      paths: [path.join('.agents', 'skills', 'generate-game-kb'), 'node_modules', process.cwd()],
    });
    tryParse(resolved);
    break;
  } catch (e) {
    err = e.message;
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, result, 'utf8');
console.log(
  JSON.stringify(
    {
      outPath,
      bytes: Buffer.byteLength(result),
      ok,
      err: ok ? null : String(err).slice(0, 300),
      line351: fixed[350],
    },
    null,
    2
  )
);
