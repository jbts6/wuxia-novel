const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];

if (!novelDir) {
  console.error('用法: node prepare.js <小说目录路径>');
  console.error('示例: node prepare.js 金庸/天龙八部');
  process.exit(1);
}

const chFormattedDir = path.join(novelDir, 'ch_formatted');
const batchJsonDir = path.join(novelDir, 'batch_json');
const registryPath = path.join(novelDir, 'entity_registry.json');
const chapterListPath = path.join(novelDir, 'chapter_list.json');
const excludePath = path.join(novelDir, 'deconstruct-exclude.json');

// 1. 检查 ch_formatted 目录
if (!fs.existsSync(chFormattedDir)) {
  console.error(`错误: ${chFormattedDir} 目录不存在`);
  console.error('请先运行 batch-format-novel 排版小说');
  process.exit(1);
}

// 2. 列出所有章节文件
const allChapterFiles = fs.readdirSync(chFormattedDir)
  .filter(f => /^ch_\d+\.md$/.test(f))
  .sort();

let skippedChapters = [];
let excludedFiles = new Set();

if (fs.existsSync(excludePath)) {
  try {
    const excludeConfig = JSON.parse(fs.readFileSync(excludePath, 'utf-8'));
    const excludes = Array.isArray(excludeConfig.chapters) ? excludeConfig.chapters : [];
    skippedChapters = excludes
      .filter(item => item && typeof item.file === 'string')
      .map(item => ({ file: item.file, reason: item.reason || 'excluded' }));
    excludedFiles = new Set(skippedChapters.map(item => item.file));
  } catch (error) {
    console.error(`错误: ${excludePath} 解析失败: ${error.message}`);
    process.exit(1);
  }
}

const chapterFiles = allChapterFiles.filter(file => !excludedFiles.has(file));

if (chapterFiles.length === 0) {
  console.error(`错误: ${chFormattedDir} 中没有找到 ch_*.md 文件`);
  process.exit(1);
}

console.log(`[准备] 小说目录: ${novelDir}`);
console.log(`[章节] 共 ${chapterFiles.length} 章`);
if (skippedChapters.length > 0) {
  console.log(`[跳过] ${skippedChapters.map(item => `${item.file} (${item.reason})`).join(', ')}`);
}

// 3. 创建 batch_json 目录
if (!fs.existsSync(batchJsonDir)) {
  fs.mkdirSync(batchJsonDir, { recursive: true });
  console.log(`[目录] 创建 ${batchJsonDir}`);
} else {
  console.log(`[目录] ${batchJsonDir} 已存在`);
}

// 4. 初始化 entity_registry.json（如果不存在）
if (!fs.existsSync(registryPath)) {
  const emptyRegistry = {
    characters: [],
    skills: [],
    techniques: [],
    factions: [],
    locations: [],
    items: []
  };
  fs.writeFileSync(registryPath, JSON.stringify(emptyRegistry, null, 2), 'utf-8');
  console.log(`[注册表] 初始化 ${registryPath}`);
} else {
  console.log(`[注册表] ${registryPath} 已存在，跳过初始化`);
}

// 5. 生成章节列表
const chapterList = {
  novelDir: novelDir,
  totalChapters: chapterFiles.length,
  chapters: chapterFiles,
  skippedChapters: skippedChapters
};

fs.writeFileSync(chapterListPath, JSON.stringify(chapterList, null, 2), 'utf-8');
console.log(`\n[章节列表] 已生成 ${chapterListPath}`);

// 检测已有提取结果（用于恢复场景）
const existingChapterJsons = fs.readdirSync(batchJsonDir)
  .filter(f => /^ch_\d{3}\.json$/.test(f));

if (existingChapterJsons.length > 0) {
  console.log(`\n[检测] 已有 ${existingChapterJsons.length} 个章节的提取结果`);
  console.log(`  已完成: ${existingChapterJsons.sort().join(', ')}`);
  const pendingChapters = chapterFiles.filter(f => {
    const num = f.replace('ch_', '').replace('.md', '').padStart(3, '0');
    return !existingChapterJsons.includes(`ch_${num}.json`);
  });
  if (pendingChapters.length > 0) {
    console.log(`  待处理: ${pendingChapters.join(', ')}`);
  } else {
    console.log(`  ✅ 所有章节已完成提取`);
  }
} else {
  console.log(`\n[检测] 未检测到已有提取结果`);
}

console.log('\n[完成] 准备工作完成！');
console.log(`下一步:`);
console.log(`  1. 根据 chapter_list.json 中的章节列表，启动 Sub Agent 处理`);
console.log(`  2. Agent 自主决定并行度（RPM < 100）`);
console.log(`  3. 所有章节完成后，运行 merge-entities.js 合并实体`);
