const fs = require('fs');
const path = require('path');

const novelDir = '/Users/jbts6/Site/wuxia-novel/金庸/天龙八部';
const chSplitDir = path.join(novelDir, 'ch_split');

// 读取所有章节原文
const chapters = {};
for (let ch = 1; ch <= 50; ch++) {
  const chFile = `ch_${ch.toString().padStart(3, '0')}.txt`;
  const filePath = path.join(chSplitDir, chFile);
  if (fs.existsSync(filePath)) {
    chapters[ch] = fs.readFileSync(filePath, 'utf8');
  }
}

function verifyDialogue(chNum, speaker, text) {
  const content = chapters[chNum];
  if (!content) return { status: 'missing_chapter', matchRatio: 0 };

  // 取对话的核心片段（去掉首尾引号和空白）
  const cleanText = text.replace(/^[""「『\s]+/, '').replace(/[""」』\s]+$/, '').trim();
  if (cleanText.length < 5) return { status: 'too_short', matchRatio: 0 };

  // 方法1：精确子串匹配
  if (content.includes(cleanText)) {
    return { status: 'exact_match', matchRatio: 1.0 };
  }

  // 方法2：取中间 20 字做子串匹配
  if (cleanText.length > 20) {
    const mid = Math.floor(cleanText.length / 2);
    const fragment = cleanText.substring(mid - 10, mid + 10);
    if (content.includes(fragment)) {
      return { status: 'fragment_match', matchRatio: 0.7 };
    }
  }

  // 方法3：取前 15 字匹配
  const prefix = cleanText.substring(0, 15);
  if (content.includes(prefix)) {
    return { status: 'prefix_match', matchRatio: 0.5 };
  }

  // 方法4：按句号分割，匹配第一句
  const firstSentence = cleanText.split(/[。，！？]/)[0];
  if (firstSentence.length >= 8 && content.includes(firstSentence)) {
    return { status: 'first_sentence_match', matchRatio: 0.6 };
  }

  return { status: 'not_found', matchRatio: 0 };
}

// 从 stdin 或文件读取 LLM 输出的 dialogues JSON
const inputFile = process.argv[2];
if (!inputFile) {
  console.log('用法: node verify_dialogues.js <dialogues_json_file>');
  console.log('文件格式: [{chapter, speaker, text, event}, ...]');
  process.exit(1);
}

const dialogues = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

let exact = 0, fragment = 0, prefix = 0, firstSent = 0, notFound = 0;

console.log('章节 | 说话者 | 状态 | 匹配度 | 对话片段');
console.log('-----|--------|------|--------|--------');

for (const d of dialogues) {
  const result = verifyDialogue(d.chapter, d.speaker, d.text);
  const preview = d.text.length > 40 ? d.text.substring(0, 40) + '...' : d.text;

  if (result.status === 'exact_match') exact++;
  else if (result.status === 'fragment_match') fragment++;
  else if (result.status === 'prefix_match') prefix++;
  else if (result.status === 'first_sentence_match') firstSent++;
  else notFound++;

  const icon = result.status === 'exact_match' ? '✓' :
               result.status === 'fragment_match' ? '~' :
               result.status === 'prefix_match' ? '?' :
               result.status === 'first_sentence_match' ? '△' : '✗';

  console.log(`${d.chapter.toString().padStart(4)} | ${(d.speaker || '').padEnd(6)} | ${icon} ${result.status.padEnd(20)} | ${(result.matchRatio * 100).toFixed(0)}% | ${preview}`);
}

const total = dialogues.length;
console.log(`\n汇总: ${total} 条对话`);
console.log(`  ✓ 精确匹配: ${exact} (${(exact/total*100).toFixed(0)}%)`);
console.log(`  ~ 片段匹配: ${fragment} (${(fragment/total*100).toFixed(0)}%)`);
console.log(`  ? 前缀匹配: ${prefix} (${(prefix/total*100).toFixed(0)}%)`);
console.log(`  △ 首句匹配: ${firstSent} (${(firstSent/total*100).toFixed(0)}%)`);
console.log(`  ✗ 未找到: ${notFound} (${(notFound/total*100).toFixed(0)}%)`);
console.log(`\n真实率(精确+片段): ${((exact+fragment)/total*100).toFixed(0)}%`);
