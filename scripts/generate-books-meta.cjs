const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const results = [];

const excludeDirs = ['node_modules', 'dist', 'src', 'tools', 'docs', 'framework', 'openspec', 'scripts', '.agents', '.claude', '.codegraph', '.obsidian', '.opencode', 'public'];

const authors = fs.readdirSync(baseDir).filter(d => {
  try {
    return fs.statSync(path.join(baseDir, d)).isDirectory() &&
           !d.startsWith('.') &&
           !excludeDirs.includes(d);
  } catch { return false; }
});

authors.forEach(author => {
  const authorPath = path.join(baseDir, author);
  const books = fs.readdirSync(authorPath).filter(d => {
    try { return fs.statSync(path.join(authorPath, d)).isDirectory(); }
    catch { return false; }
  });

  books.forEach(book => {
    const bookPath = path.join(authorPath, book);
    const charsFile = path.join(bookPath, 'characters.json');

    if (fs.existsSync(charsFile)) {
      try {
        const chars = JSON.parse(fs.readFileSync(charsFile, 'utf-8'));
        const charCount = Array.isArray(chars) ? chars.length : 0;

        if (charCount > 0) {
          results.push({
            path: `${author}/${book}`,
            author,
            name: book,
            characters: charCount
          });
        }
      } catch (e) {}
    }
  });
});

results.sort((a, b) => {
  if (a.author !== b.author) return a.author.localeCompare(b.author);
  return a.name.localeCompare(b.name);
});

const outputPath = path.join(__dirname, '..', 'public', 'data', 'books.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

console.log(`生成书籍元数据完成，共 ${results.length} 本：`);
results.forEach(r => console.log(`  ${r.author} / ${r.name} (${r.characters}角色)`));
