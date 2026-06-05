const fs = require('fs');
const path = require('path');

const novelDir = process.argv[2];
const batchSize = parseInt(process.argv[3]) || 3;

if (!novelDir) {
  console.error('用法: node prepare.js <小说目录路径> [批次大小]');
  console.error('示例: node prepare.js 金庸/天龙八部');
  console.error('      node prepare.js 金庸/天龙八部 5');
  process.exit(1);
}

const chFormattedDir = path.join(novelDir, 'ch_formatted');
const batchJsonDir = path.join(novelDir, 'batch_json');
const registryPath = path.join(novelDir, 'entity_registry.json');
const batchConfigPath = path.join(novelDir, 'batch_config.json');

// 1. 检查 ch_formatted 目录
if (!fs.existsSync(chFormattedDir)) {
  console.error(`错误: ${chFormattedDir} 目录不存在`);
  console.error('请先运行 batch-format-novel 排版小说');
  process.exit(1);
}

// 2. 列出所有章节文件
const chapterFiles = fs.readdirSync(chFormattedDir)
  .filter(f => f.startsWith('ch_') && f.endsWith('.md'))
  .sort();

if (chapterFiles.length === 0) {
  console.error(`错误: ${chFormattedDir} 中没有找到 ch_*.md 文件`);
  process.exit(1);
}

console.log(`[准备] 小说目录: ${novelDir}`);
console.log(`[章节] 共 ${chapterFiles.length} 章`);

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

// 5. 生成批次配置
const batches = [];
for (let i = 0; i < chapterFiles.length; i += batchSize) {
  const batchChapters = chapterFiles.slice(i, i + batchSize);
  const batchNum = Math.floor(i / batchSize) + 1;
  batches.push({
    batch: batchNum,
    chapters: batchChapters,
    registry副本: `batch_json/batch_${batchNum}_registry.json`
  });
}

const batchConfig = {
  novelDir: novelDir,
  totalChapters: chapterFiles.length,
  batchSize: batchSize,
  totalBatches: batches.length,
  batches: batches
};

fs.writeFileSync(batchConfigPath, JSON.stringify(batchConfig, null, 2), 'utf-8');
console.log(`\n[批次] 批次大小: ${batchSize} 章`);
console.log(`[批次] 共 ${batches.length} 批`);
batches.forEach(b => {
  console.log(`  批次 ${b.batch}: ${b.chapters.join(', ')}`);
});

console.log('\n[完成] 准备工作完成！');
console.log(`下一步:`);
console.log(`  1. 为每个批次启动 Sub Agent（批间可并行）`);
console.log(`  2. 每批完成后运行 merge-registries.js 合并注册表`);
