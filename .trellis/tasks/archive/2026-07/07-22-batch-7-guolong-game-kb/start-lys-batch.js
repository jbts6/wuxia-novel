const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const books = [
  '游剑江湖',
  '牧野流星',
  '风雷震九州',
  '武当一剑',
  '剑网尘丝',
  '侠骨丹心',
  '弹指惊雷',
  '绝塞传烽录',
  '幻剑灵旗',
];

const flow = path.join('.agents', 'skills', 'generate-game-kb', 'scripts', 'flow.js');
const results = [];

for (const b of books) {
  const novel = path.join('梁羽生', b);
  try {
    const out = execFileSync(process.execPath, [flow, 'run', novel, '--json'], {
      encoding: 'utf8',
      maxBuffer: 30 * 1024 * 1024,
    });
    const line = out
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.startsWith('{'))
      .pop();
    const j = JSON.parse(line);
    results.push({
      book: b,
      novel,
      status: j.status,
      run_id: j.run_id,
      jobs: (j.jobs || []).map((job) => ({
        unit: job.unit,
        cycle: job.cycle,
        attempt: job.attempt,
        producer: job.producer,
        input_file: job.input_file,
        output_file: job.output_file,
      })),
      progress: j.progress,
      active_units: j.active_units,
    });
    console.log(
      JSON.stringify({
        book: b,
        status: j.status,
        run: j.run_id,
        jobs: (j.jobs || []).length,
        progress: j.progress,
      })
    );
  } catch (e) {
    const msg = (e.stdout || e.stderr || e.message || String(e)).toString().slice(0, 800);
    results.push({ book: b, novel, error: msg });
    console.log(JSON.stringify({ book: b, error: msg }));
  }
}

const outPath = path.join(
  '.trellis',
  'tasks',
  '07-22-batch-7-guolong-game-kb',
  'liangyusheng-batch-start.json'
);
fs.writeFileSync(
  outPath,
  JSON.stringify({ at: new Date().toISOString(), cross_book_worker_cap: 20, results }, null, 2),
  'utf8'
);
console.log('wrote', outPath);
