import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenText, LoaderCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { useLibraryStore } from '../stores/useLibraryStore';
import { VALIDATION_STATUS_LABELS } from '../lib/libraryStatusPresentation';

export default function AuthorBooks() {
  const { authorName } = useParams<{ authorName: string }>();
  const { status, books, statusLoading, ensureStatus } = useLibraryStore();
  const decodedAuthor = authorName ? decodeURIComponent(authorName) : '';

  useEffect(() => {
    if (!status && !statusLoading) void ensureStatus();
  }, [ensureStatus, status, statusLoading]);

  const authorBooks = books.filter((book) => book.author === decodedAuthor && book.browseable);

  return (
    <div className="min-h-screen min-w-[1180px] bg-background px-8 py-7">
      <div className="mx-auto max-w-[1200px]">
        <Link to="/browse" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          返回知识浏览
        </Link>
        <h1 className="mt-5 font-serif text-2xl font-semibold">{decodedAuthor}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{authorBooks.length} 本可浏览知识库</p>

        {statusLoading && !status ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在读取书目
          </div>
        ) : (
          <div className="mt-6 divide-y overflow-hidden rounded-lg border bg-card">
            {authorBooks.map((book) => (
              <Link
                key={book.path}
                to={`/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}/overview`}
                className="flex h-20 items-center px-5 transition-colors hover:bg-muted/50"
              >
                <BookOpenText className="mr-4 h-5 w-5 text-muted-foreground" />
                <span className="flex-1 font-medium">{book.name}</span>
                <Badge variant="outline" className="mr-5">{VALIDATION_STATUS_LABELS[book.validationStatus]}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
