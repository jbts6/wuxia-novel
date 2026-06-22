import fs from 'fs';
import path from 'path';
import { build } from 'vite';
import { NOVEL_DATA_FILES } from '../src/data/novelData.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_ROOT = path.resolve(ROOT, '..');
const OUT_DIR = path.join(ROOT, 'dist-static');
const BUILD_DIR = path.join(ROOT, 'dist-static-build');

async function main() {
  console.log('Building static entry...');
  await build({
    configFile: path.join(ROOT, 'vite.config.ts'),
    build: {
      outDir: 'dist-static-build',
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(ROOT, 'src', 'main-static.tsx'),
        output: {
          format: 'iife',
          name: 'NovelApp',
        },
      },
    },
  });

  console.log('Reading built assets...');

  const assetsDir = path.join(BUILD_DIR, 'assets');
  const assetFiles = fs.readdirSync(assetsDir);
  const jsFiles = assetFiles.filter(f => f.endsWith('.js'));
  const cssFiles = assetFiles.filter(f => f.endsWith('.css'));

  const jsContents = jsFiles.map(f => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n');
  const cssContents = cssFiles.map(f => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n');

  const booksPath = path.join(ROOT, 'public', 'data', 'books.json');
  const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

  console.log(`Generating static HTML for ${books.length} books...`);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  for (const book of books) {
    const bookDir = path.join(DATA_ROOT, book.path);
    const data = {};

    for (const fileName of NOVEL_DATA_FILES) {
      try {
        const raw = fs.readFileSync(path.join(bookDir, fileName), 'utf8');
        data[path.basename(fileName, '.json')] = JSON.parse(raw);
      } catch {
        data[path.basename(fileName, '.json')] = [];
      }
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${book.name} - 武侠图志</title>
<style>${cssContents}</style>
</head>
<body>
<div id="root"></div>
<script>window.__NOVEL_DATA__ = ${JSON.stringify(data)};</script>
<script>window.__BOOK_META__ = ${JSON.stringify(book)};</script>
<script>${jsContents}</script>
</body>
</html>`;

    const outPath = path.join(OUT_DIR, book.author, `${book.name}.html`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
  }

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });

  const totalSize = fs.readdirSync(OUT_DIR, { recursive: true })
    .filter(f => f.endsWith('.html'))
    .reduce((sum, f) => {
      const authorDir = fs.readdirSync(OUT_DIR).find(d => fs.existsSync(path.join(OUT_DIR, d, f)));
      return sum + (authorDir ? fs.statSync(path.join(OUT_DIR, authorDir, f)).size : 0);
    }, 0);

  console.log(`\nDone! Generated ${books.length} static HTML files in ${OUT_DIR}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

  const byAuthor = {};
  for (const b of books) {
    byAuthor[b.author] = (byAuthor[b.author] || 0) + 1;
  }
  for (const [author, count] of Object.entries(byAuthor)) {
    console.log(`  ${author}: ${count} books`);
  }
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
