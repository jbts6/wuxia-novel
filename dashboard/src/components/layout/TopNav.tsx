import { Link } from 'react-router-dom';
import { useBookData } from '../../hooks/useBookData';
import { ThemeToggle } from '../common/ThemeToggle';

export function TopNav() {
  const { currentBook } = useBookData();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-serif text-lg font-semibold text-foreground">
          武侠知识库
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
