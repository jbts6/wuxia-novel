#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DASHBOARD_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(DASHBOARD_DIR, '..');
const AUTHORS = ['金庸', '古龙', '梁羽生', '黄易'];

interface BookInfo {
  author: string;
  name: string;
  bookPath: string;
}

// 扫描所有已提取的书籍
function scanExtractedBooks(): BookInfo[] {
  const books: BookInfo[] = [];
  
  for (const author of AUTHORS) {
    const authorDir = path.join(ROOT, author);
    if (!fs.existsSync(authorDir)) continue;
    
    const entries = fs.readdirSync(authorDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const dataDir = path.join(authorDir, entry.name, 'data');
      if (!fs.existsSync(dataDir)) continue;
      
      // 检查是否有必要的 JSON 文件
      const requiredFiles = ['characters.json', 'skills.json', 'items.json', 'factions.json', 'locations.json'];
      const hasAllFiles = requiredFiles.every(f => fs.existsSync(path.join(dataDir, f)));
      
      if (hasAllFiles) {
        books.push({
          author,
          name: entry.name,
          bookPath: `${author}/${entry.name}`,
        });
      }
    }
  }
  
  return books;
}

// 读取当前 dashboard 中已配置的书籍
function getConfiguredBooks(): Set<string> {
  const booksTsPath = path.join(DASHBOARD_DIR, 'src/data/books.ts');
  const content = fs.readFileSync(booksTsPath, 'utf-8');
  
  const bookPaths = new Set<string>();
  const regex = /path:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    bookPaths.add(match[1]);
  }
  
  return bookPaths;
}

// 为书籍创建 data/index.ts
function createDataIndex(book: BookInfo): void {
  const dataDir = path.join(ROOT, book.bookPath, 'data');
  const indexPath = path.join(dataDir, 'index.ts');
  
  if (fs.existsSync(indexPath)) return;
  
  const jsonFiles = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  
  const content = jsonFiles
    .map(name => `export { default as ${name} } from './${name}.json';`)
    .join('\n') + '\n';
  
  fs.writeFileSync(indexPath, content);
  console.log(`  ✓ 创建 ${book.bookPath}/data/index.ts`);
}

// 更新 vite.config.ts
function updateViteConfig(books: BookInfo[]): void {
  const configPath = path.join(DASHBOARD_DIR, 'vite.config.ts');
  let content = fs.readFileSync(configPath, 'utf-8');
  
  for (const book of books) {
    const alias = `@data/${book.name}`;
    if (content.includes(alias)) continue;
    
    // 在 resolve.alias 块的最后一个条目后添加
    const insertPoint = content.lastIndexOf(`'@data/`);
    if (insertPoint === -1) continue;
    
    const lineEnd = content.indexOf('\n', insertPoint);
    const newLine = `      '${alias}': path.resolve(__dirname, '../${book.bookPath}/data'),`;
    content = content.slice(0, lineEnd + 1) + newLine + '\n' + content.slice(lineEnd + 1);
    
    console.log(`  ✓ 更新 vite.config.ts: ${alias}`);
  }
  
  fs.writeFileSync(configPath, content);
}

// 更新 tsconfig.app.json
function updateTsConfig(books: BookInfo[]): void {
  const configPath = path.join(DASHBOARD_DIR, 'tsconfig.app.json');
  let content = fs.readFileSync(configPath, 'utf-8');
  
  for (const book of books) {
    const alias = `@data/${book.name}`;
    if (content.includes(`"${alias}"`)) continue;
    
    // 在 paths 对象的最后一个条目后添加
    const lastPathEntry = content.lastIndexOf('"@data/');
    if (lastPathEntry === -1) continue;
    
    const lineEnd = content.indexOf('\n', lastPathEntry);
    
    // 确保前一个条目有逗号
    const beforeLine = content.slice(0, lineEnd);
    if (!beforeLine.endsWith(',')) {
      content = content.slice(0, lineEnd) + ',' + content.slice(lineEnd);
    }
    
    const newLine = `\n      "${alias}": ["../${book.bookPath}/data"]`;
    const insertPos = content.indexOf('\n', lastPathEntry);
    content = content.slice(0, insertPos) + newLine + content.slice(insertPos);
    
    console.log(`  ✓ 更新 tsconfig.app.json: ${alias}`);
  }
  
  fs.writeFileSync(configPath, content);
}

// 更新 books.ts
function updateBooksTs(books: BookInfo[]): void {
  const booksPath = path.join(DASHBOARD_DIR, 'src/data/books.ts');
  let content = fs.readFileSync(booksPath, 'utf-8');
  
  // 添加 import 语句
  for (const book of books) {
    const importStatement = `import * as ${book.name} from '@data/${book.name}';`;
    if (content.includes(importStatement)) continue;
    
    // 在最后一个 import 语句后添加
    const lastImportIndex = content.lastIndexOf('import ');
    const lineEnd = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, lineEnd + 1) + importStatement + '\n' + content.slice(lineEnd + 1);
    
    console.log(`  ✓ 添加 import: ${book.name}`);
  }
  
  // 添加书籍条目
  for (const book of books) {
    const bookEntry = `  {
    path: '${book.bookPath}',
    name: '${book.name}',
    author: '${book.author}',
    data: ${book.name} as unknown as BookMeta['data'],
  },`;
    
    if (content.includes(`path: '${book.bookPath}'`)) continue;
    
    // 在 books 数组的最后一个条目后添加
    const lastBracket = content.lastIndexOf('];');
    content = content.slice(0, lastBracket) + bookEntry + '\n' + content.slice(lastBracket);
    
    console.log(`  ✓ 添加书籍: ${book.name}`);
  }
  
  fs.writeFileSync(booksPath, content);
}

// 主函数
function main() {
  console.log('🔍 扫描已提取的书籍...\n');
  
  const extractedBooks = scanExtractedBooks();
  const configuredBooks = getConfiguredBooks();
  
  const newBooks = extractedBooks.filter(b => !configuredBooks.has(b.bookPath));
  
  if (newBooks.length === 0) {
    console.log('✅ 所有已提取的书籍都已配置到 dashboard 中');
    return;
  }
  
  console.log(`📚 发现 ${newBooks.length} 本新书需要添加:\n`);
  newBooks.forEach(b => console.log(`  - ${b.bookPath}`));
  console.log('');
  
  // 1. 创建 data/index.ts
  console.log('📝 创建 data/index.ts 文件...');
  for (const book of newBooks) {
    createDataIndex(book);
  }
  
  // 2. 更新配置文件
  console.log('\n📝 更新配置文件...');
  updateViteConfig(newBooks);
  updateTsConfig(newBooks);
  
  // 3. 更新 books.ts
  console.log('\n📝 更新 books.ts...');
  updateBooksTs(newBooks);
  
  console.log('\n✅ 完成！请重启 dashboard 开发服务器以应用更改');
  console.log('   npm run dev');
}

main();
