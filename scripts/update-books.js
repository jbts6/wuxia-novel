const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BOOKS_JSON = path.join(ROOT_DIR, 'dashboard', 'public', 'data', 'books.json');

const AUTHORS = ['古龙', '金庸', '黄易', '梁羽', '温瑞安'];

function scanBooks() {
  const books = [];

  for (const author of AUTHORS) {
    const authorDir = path.join(ROOT_DIR, author);
    if (!fs.existsSync(authorDir)) continue;

    const entries = fs.readdirSync(authorDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const bookDir = path.join(authorDir, entry.name);
      const charactersPath = path.join(bookDir, 'characters.json');

      if (!fs.existsSync(charactersPath)) continue;

      let characters = 0;
      try {
        const data = JSON.parse(fs.readFileSync(charactersPath, 'utf-8'));
        if (Array.isArray(data)) {
          characters = data.length;
        }
      } catch (e) {
        console.error(`Failed to parse ${charactersPath}: ${e.message}`);
      }

      books.push({
        path: `${author}/${entry.name}`,
        author,
        name: entry.name,
        characters,
      });
    }
  }

  return books;
}

function main() {
  const books = scanBooks();

  // Sort by author then name
  books.sort((a, b) => a.author.localeCompare(b.author) || a.name.localeCompare(b.name));

  fs.writeFileSync(BOOKS_JSON, JSON.stringify(books, null, 2) + '\n', 'utf-8');

  console.log(`Updated ${BOOKS_JSON} with ${books.length} books`);

  // Summary by author
  const byAuthor = {};
  for (const b of books) {
    byAuthor[b.author] = (byAuthor[b.author] || 0) + 1;
  }
  for (const [author, count] of Object.entries(byAuthor)) {
    console.log(`  ${author}: ${count} books`);
  }
}

main();
