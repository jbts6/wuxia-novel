/**
 * 排版进度追踪脚本
 * 记录每章每组的完成状态，支持恢复中断的批量排版
 *
 * 用法:
 *   node scripts/progress.js --status          查看全部进度
 *   node scripts/progress.js --status <chapter> 查看单章进度
 *   node scripts/progress.js --done <group-file> 标记一组完成
 *   node scripts/progress.js --check <chapter>  检查一章是否全部完成
 *   node scripts/progress.js --reset <chapter>  重置一章所有组为 pending
 */

const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join('.ch_groups', 'progress.json');

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('读取进度文件失败: ' + err.message);
  }
  return {};
}

function saveProgress(data) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 初始化一章的进度（split-chapter.js 调用）
 */
function initChapter(basename, totalLines, groupFiles, groupSize) {
  const progress = loadProgress();
  const status = {};
  for (const f of groupFiles) {
    status[path.basename(f, '.md')] = 'pending';
  }
  progress[basename] = { totalLines, groups: groupFiles.length, groupSize, status };
  saveProgress(progress);
}

/**
 * 标记一组为 done
 * @param {string} groupFilePath - 分组文件的完整路径
 */
function markDone(groupFilePath) {
  const gName = path.basename(groupFilePath, '.md');
  const parts = gName.split('_g');
  if (parts.length < 2) {
    console.error('错误: 无法从文件名解析章节名: ' + gName);
    return false;
  }
  const basename = parts[0];

  const progress = loadProgress();
  if (!progress[basename]) {
    console.error('错误: 章节 ' + basename + ' 不在进度记录中');
    return false;
  }
  if (!progress[basename].status[gName]) {
    console.error('错误: 分组 ' + gName + ' 不在进度记录中');
    return false;
  }
  progress[basename].status[gName] = 'done';
  saveProgress(progress);
  return true;
}

/**
 * 检查一章是否全部完成
 */
function isChapterComplete(basename) {
  const progress = loadProgress();
  const ch = progress[basename];
  if (!ch) return false;
  return Object.values(ch.status).every(s => s === 'done');
}

/**
 * 获取未完成的分组列表
 */
function getIncompleteGroups(basename) {
  const progress = loadProgress();
  const ch = progress[basename];
  if (!ch) return [];
  return Object.entries(ch.status)
    .filter(([, s]) => s !== 'done')
    .map(([g]) => g);
}

/**
 * 重置一章所有组为 pending
 */
function resetChapter(basename) {
  const progress = loadProgress();
  const ch = progress[basename];
  if (!ch) {
    console.error('错误: 章节 ' + basename + ' 不在进度记录中');
    return false;
  }
  for (const g of Object.keys(ch.status)) {
    ch.status[g] = 'pending';
  }
  saveProgress(progress);
  return true;
}

/**
 * 显示进度报告
 */
function showProgress(chapterFilter) {
  const progress = loadProgress();
  const chapters = Object.keys(progress).sort();
  if (chapters.length === 0) {
    console.log('进度文件为空或不存在。请先运行 split-chapter.js。');
    return;
  }

  let totalDone = 0;
  let totalAll = 0;

  for (const ch of chapters) {
    if (chapterFilter && ch !== chapterFilter) continue;
    const data = progress[ch];
    const done = Object.values(data.status).filter(s => s === 'done').length;
    const total = data.groups;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const check = done === total ? ' ✓' : '';
    const prefix = chapterFilter ? '' : '';
    console.log(`${prefix}${ch}:  ${done}/${total} 组 (${pct}%)${check}`);
    totalDone += done;
    totalAll += total;
  }

  if (!chapterFilter && totalAll > 0) {
    const pct = Math.round((totalDone / totalAll) * 100);
    console.log(`---\n总计: ${totalDone}/${totalAll} 组 (${pct}%)`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('排版进度追踪脚本');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/progress.js --status [chapter]');
    console.log('  node scripts/progress.js --done <group-file>');
    console.log('  node scripts/progress.js --check <chapter>');
    console.log('  node scripts/progress.js --reset <chapter>');
    process.exit(1);
  }

  if (args[0] === '--status') {
    showProgress(args[1] || null);
  } else if (args[0] === '--done') {
    if (!args[1]) {
      console.error('错误: --done 需要分组文件路径');
      process.exit(1);
    }
    if (markDone(args[1])) {
      console.log('标记完成: ' + path.basename(args[1]));
    } else {
      process.exit(1);
    }
  } else if (args[0] === '--check') {
    if (!args[1]) {
      console.error('错误: --check 需要章节名');
      process.exit(1);
    }
    if (isChapterComplete(args[1])) {
      console.log(args[1] + ': 全部完成');
    } else {
      const incomplete = getIncompleteGroups(args[1]);
      console.log(args[1] + ': 未完成 ' + incomplete.length + ' 组');
      incomplete.forEach(g => console.log('  ' + g));
      process.exit(1);
    }
  } else if (args[0] === '--reset') {
    if (!args[1]) {
      console.error('错误: --reset 需要章节名');
      process.exit(1);
    }
    if (resetChapter(args[1])) {
      console.log('重置完成: ' + args[1]);
    } else {
      process.exit(1);
    }
  } else {
    console.error('未知命令: ' + args[0]);
    process.exit(1);
  }
}

module.exports = { initChapter, markDone, isChapterComplete, getIncompleteGroups, resetChapter, showProgress };
