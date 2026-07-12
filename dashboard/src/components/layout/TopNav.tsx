import { Link } from 'react-router-dom';
import { BookOpenText, LibraryBig } from 'lucide-react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { ThemeToggle } from '../common/ThemeToggle';

export function TopNav() {
  const currentBookPath = useLibraryStore((state) => state.currentBook);
  const currentBook = useLibraryStore((state) =>
    state.books.find((book) => book.path === currentBookPath),
  );

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-serif text-lg font-semibold text-foreground">
          武侠知识库工作台
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <LibraryBig className="h-4 w-4" />
          知识管理
        </Link>
        <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <BookOpenText className="h-4 w-4" />
          知识浏览
        </Link>
        {currentBook && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="font-serif text-foreground">{currentBook.name}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
