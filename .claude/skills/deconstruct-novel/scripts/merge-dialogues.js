const fs = require('fs');
const path = require('path');
const { validateChapterData } = require('./validators');
const CHAPTER_JSON_RE = /^ch_\d{3}\.json$/;

const novelDir = process.argv[2];

if (!novelDir) {
  console.error('用法: node merge-dialogues.js <小说目录路径>');
  console.error('示例: node merge-dialogues.js 金庸/天龙八部');
  process.exit(1);
}

const batchJsonDir = path.join(novelDir, 'batch_json');

if (!fs.existsSync(batchJsonDir)) {
  console.error(`错误: ${batchJsonDir} 不存在`);
  process.exit(1);
}

// 列出所有 ch_NNN.json 文件
const files = fs.readdirSync(batchJsonDir)
  .filter(f => CHAPTER_JSON_RE.test(f))
  .sort();

if (files.length === 0) {
  console.error(`错误: ${batchJsonDir} 中没有找到 ch_*.json 文件`);
  process.exit(1);
}

console.log(`[合并] 小说目录: ${novelDir}`);
console.log(`[合并] 找到 ${files.length} 个章节文件`);

let allDialogues = [];
let allSummaries = [];

for (const f of files) {
  const chapterPath = path.join(batchJsonDir, f);
  try {
    const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
    const validationErrors = validateChapterData(chapter, f);
    if (validationErrors.length > 0) {
      console.error(`[错误] ${f} 校验失败，停止合并:`);
      for (const err of validationErrors.slice(0, 30)) console.error(`  - ${err}`);
      if (validationErrors.length > 30) console.error(`  ... 还有 ${validationErrors.length - 30} 个错误`);
      process.exit(1);
    }
    allDialogues = allDialogues.concat(chapter.dialogues || []);
    if (chapter.chapter_summary) {
      allSummaries.push({ chapter: chapter.chapter, summary: chapter.chapter_summary });
    }
  } catch (err) {
    console.error(`[错误] 无法解析 ${f}: ${err.message}`);
    process.exit(1);
  }
}

// 按章节排序
allDialogues.sort((a, b) => a.chapter - b.chapter);
allSummaries.sort((a, b) => a.chapter - b.chapter);

// 写入文件
fs.writeFileSync(path.join(novelDir, 'dialogues.json'), JSON.stringify(allDialogues, null, 2), 'utf8');
fs.writeFileSync(path.join(novelDir, 'chapter_summaries.json'), JSON.stringify(allSummaries, null, 2), 'utf8');

console.log(`\n[完成] 合并完成！`);
console.log(`  dialogues.json: ${allDialogues.length} 条对话`);
console.log(`  chapter_summaries.json: ${allSummaries.length} 章摘要`);
