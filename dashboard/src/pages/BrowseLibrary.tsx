import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenText, LoaderCircle, Search } from 'lucide-react';
import { WorkspaceHeader } from '../components/library/WorkspaceHeader';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { formatDateTime, VALIDATION_STATUS_LABELS } from '../lib/libraryStatusPresentation';
import { useLibraryStore } from '../stores/useLibraryStore';

export default function BrowseLibrary() {
  const { status, books, statusLoading, statusError, ensureStatus } = useLibraryStore();
  const [author, setAuthor] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!status && !statusLoading) void ensureStatus();
  }, [ensureStatus, status, statusLoading]);

  const authors = useMemo(() => [...new Set(books.map((book) => book.author))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [books]);
  const browseableBooks = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('zh-CN');
    return books.filter(
      (book) =>
        book.browseable &&
        (author === 'all' || book.author === author) &&
        (!keyword || `${book.author} ${book.name}`.toLocaleLowerCase('zh-CN').includes(keyword)),
    );
  }, [author, books, search]);

  return (
    <div className="flex min-h-screen min-w-[1180px] flex-col bg-background">
      <WorkspaceHeader active="browse" />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-8 py-7">
        <div>
          <h1 className="font-serif text-2xl font-semibold">知识浏览</h1>
          <p className="mt-1 text-sm text-muted-foreground">仅展示满足 Dashboard 消费契约的知识库。</p>
        </div>

        <div className="mt-6 flex items-center gap-3 border-b pb-4">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索作者或书名" className="pl-9" />
          </div>
          <NativeSelect
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            options={[{ value: 'all', label: '全部作者' }, ...authors.map((name) => ({ value: name, label: name }))]}
            className="w-40"
          />
          <span className="ml-auto text-xs text-muted-foreground">{browseableBooks.length} 本可浏览</span>
        </div>

        {statusError ? (
          <div className="mt-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{statusError}</div>
        ) : statusLoading && !status ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在读取书目
          </div>
        ) : (
          <div className="mt-4 divide-y overflow-hidden rounded-lg border bg-card">
            {browseableBooks.map((book) => (
              <Link
                key={book.path}
                to={`/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}/overview`}
                className="flex h-20 items-center px-5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="mr-4 flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  <BookOpenText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{book.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{book.author} · 更新 {formatDateTime(book.lastUpdatedAt)}</span>
                </span>
                <Badge variant={book.validationStatus === 'passed' ? 'secondary' : 'outline'} className="mr-5">
                  {VALIDATION_STATUS_LABELS[book.validationStatus]}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
