const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];
const chapterNum = process.argv[3];

if (!novelDir || !chapterNum) {
  console.error('用法: node check-progress.js <小说目录路径> <章节号>');
  console.error('示例: node check-progress.js 金庸/天龙八部 1');
  process.exit(1);
}

const batchJsonDir = path.join(novelDir, 'batch_json');
const chapterJson = path.join(batchJsonDir, `ch_${chapterNum.padStart(3, '0')}.json`);
const progressJsonl = path.join(batchJsonDir, `ch_${chapterNum.padStart(3, '0')}_progress.jsonl`);

// 检查最终文件是否已存在
if (fs.existsSync(chapterJson)) {
  console.log(JSON.stringify({
    status: 'completed',
    completedSegments: 0,
    message: '本章已完成'
  }));
  process.exit(0);
}

// 检查进度文件
let completedSegments = 0;
if (fs.existsSync(progressJsonl)) {
  const lines = fs.readFileSync(progressJsonl, 'utf8').trim().split('\n').filter(Boolean);
  completedSegments = lines.length;
}

console.log(JSON.stringify({
  status: 'in_progress',
  completedSegments,
  message: `已处理 ${completedSegments} 段`
}));
