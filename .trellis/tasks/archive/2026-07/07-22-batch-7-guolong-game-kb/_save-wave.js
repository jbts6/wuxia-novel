const fs = require('fs');
const path = require('path');
const ids = {
  "dq026": "019f8f01-03f3-7fa0-96ed-9d0da0fdd7db",
  "dq027": "019f8f01-03f6-7580-8855-b72482a92685",
  "dq028": "019f8f01-03f8-7240-b3b1-f03cf189536e",
  "dq029": "019f8f01-03fb-7941-b650-231849774855",
  "dq030": "019f8f01-03fe-7871-ac60-fc85849466c8",
  "lx031": "019f8f01-0401-75b2-a94e-a6945001d9e4",
  "lx032": "019f8f01-0403-79a3-8303-eac4db0ddda4",
  "lx033": "019f8f01-0406-7a20-84aa-c4c024e75b4c",
  "lx034": "019f8f01-0408-77a1-a574-3ec6dc8f8845",
  "lx035": "019f8f01-040a-7fc0-858e-3db8f742e4fc",
  "jd041": "019f8f01-040c-7771-8066-e75322a3ea20",
  "jd042": "019f8f01-040f-7da1-83cb-cd63e4cc3869",
  "jd043": "019f8f01-0412-7553-a19a-f19b804f5603",
  "jd044": "019f8f01-0414-7542-b800-dccafd75b2dd",
  "jd045": "019f8f01-0417-7602-a4d1-1d8be0421e57"
};
const outs = [
  "古龙/多情剑客无情剑/.game-kb-work/runs/run-2026-07-23T11-16-12-172Z-37452-aef76d15/staging/chapter_026/cycle_01/attempt_01.yaml",
  "古龙/多情剑客无情剑/.game-kb-work/runs/run-2026-07-23T11-16-12-172Z-37452-aef76d15/staging/chapter_027/cycle_01/attempt_01.yaml",
  "古龙/多情剑客无情剑/.game-kb-work/runs/run-2026-07-23T11-16-12-172Z-37452-aef76d15/staging/chapter_028/cycle_01/attempt_01.yaml",
  "古龙/多情剑客无情剑/.game-kb-work/runs/run-2026-07-23T11-16-12-172Z-37452-aef76d15/staging/chapter_029/cycle_01/attempt_01.yaml",
  "古龙/多情剑客无情剑/.game-kb-work/runs/run-2026-07-23T11-16-12-172Z-37452-aef76d15/staging/chapter_030/cycle_01/attempt_01.yaml",
  "古龙/陆小凤传奇/.game-kb-work/runs/run-2026-07-23T11-16-13-296Z-37604-e262c2ab/staging/chapter_031/cycle_01/attempt_02.yaml",
  "古龙/陆小凤传奇/.game-kb-work/runs/run-2026-07-23T11-16-13-296Z-37604-e262c2ab/staging/chapter_032/cycle_01/attempt_01.yaml",
  "古龙/陆小凤传奇/.game-kb-work/runs/run-2026-07-23T11-16-13-296Z-37604-e262c2ab/staging/chapter_033/cycle_01/attempt_01.yaml",
  "古龙/陆小凤传奇/.game-kb-work/runs/run-2026-07-23T11-16-13-296Z-37604-e262c2ab/staging/chapter_034/cycle_01/attempt_01.yaml",
  "古龙/陆小凤传奇/.game-kb-work/runs/run-2026-07-23T11-16-13-296Z-37604-e262c2ab/staging/chapter_035/cycle_01/attempt_01.yaml",
  "古龙/绝代双骄/.game-kb-work/runs/run-2026-07-23T11-16-14-397Z-39924-541d9cbd/staging/chapter_041/cycle_01/attempt_01.yaml",
  "古龙/绝代双骄/.game-kb-work/runs/run-2026-07-23T11-16-14-397Z-39924-541d9cbd/staging/chapter_042/cycle_01/attempt_01.yaml",
  "古龙/绝代双骄/.game-kb-work/runs/run-2026-07-23T11-16-14-397Z-39924-541d9cbd/staging/chapter_043/cycle_01/attempt_01.yaml",
  "古龙/绝代双骄/.game-kb-work/runs/run-2026-07-23T11-16-14-397Z-39924-541d9cbd/staging/chapter_044/cycle_01/attempt_01.yaml",
  "古龙/绝代双骄/.game-kb-work/runs/run-2026-07-23T11-16-14-397Z-39924-541d9cbd/staging/chapter_045/cycle_01/attempt_01.yaml"
];
fs.writeFileSync('.trellis/tasks/07-22-batch-7-guolong-game-kb/dispatch-wave-ids.json', JSON.stringify({ids, outs, startedAt: new Date().toISOString()}, null, 2));
console.log('saved dispatch-wave-ids.json', Object.keys(ids).length, 'workers');
