const fs = require('fs');
const path = require('path');
const { validateRegistry } = require('./validators');

const novelDir = process.argv[2];

if (!novelDir) {
  console.error('用法: node split-registry.js <小说目录路径>');
  console.error('示例: node split-registry.js 金庸/天龙八部');
  process.exit(1);
}

const registryPath = path.join(novelDir, 'entity_registry.json');

if (!fs.existsSync(registryPath)) {
  console.error(`错误: ${registryPath} 不存在`);
  console.error('请先运行 merge-entities.js 合并实体');
  process.exit(1);
}

console.log(`[拆分] 小说目录: ${novelDir}`);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const validationErrors = validateRegistry(registry);
if (validationErrors.length > 0) {
  console.error(`[错误] entity_registry.json 校验失败，停止拆分:`);
  for (const err of validationErrors.slice(0, 30)) console.error(`  - ${err}`);
  if (validationErrors.length > 30) console.error(`  ... 还有 ${validationErrors.length - 30} 个错误`);
  process.exit(1);
}

// 拆分为 6 个文件
const types = ['characters', 'skills', 'techniques', 'factions', 'locations', 'items'];

for (const type of types) {
  const data = registry[type] || [];
  const outputPath = path.join(novelDir, `${type}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ${type}.json: ${data.length} 个实体`);
}

console.log(`\n[完成] 最终输出文件已生成！`);
