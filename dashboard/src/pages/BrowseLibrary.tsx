import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, Building2, Gem, LoaderCircle, MapPin, Search, Swords, Users, X } from 'lucide-react';
import { PaginationControls } from '../components/common/PaginationControls';
import { GlobalEntityDetail } from '../components/library/GlobalEntityDetail';
import { WorkspaceHeader } from '../components/library/WorkspaceHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { Sheet } from '../components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { filterGlobalLibraryRecords, LIBRARY_KIND_LABELS } from '../lib/globalLibrary';
import { cn } from '../lib/utils';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { LibraryEntityKind } from '../types/library';

const PAGE_SIZE = 50;
const SCROLL_KEY_PREFIX = 'global-library-scroll:';

const kindItems = [
  { kind: 'character' as const, label: '人物', icon: Users },
  { kind: 'skill' as const, label: '武功', icon: Swords },
  { kind: 'item' as const, label: '物品', icon: Gem },
  { kind: 'faction' as const, label: '势力', icon: Building2 },
  { kind: 'location' as const, label: '地点', icon: MapPin },
];

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  const query = keyword.trim();
  if (!query) return text;
  const index = text.toLocaleLowerCase('zh-CN').indexOf(query.toLocaleLowerCase('zh-CN'));
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-200/70 text-inherit dark:bg-amber-700/50">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function GlobalSearchForm({ initialValue, onSubmit }: { initialValue: string; onSubmit: (value: string) => void }) {
  const [draft, setDraft] = useState(initialValue);
  const composition = useRef(false);

  return (
    <form
      role="search"
      aria-label="全库知识搜索"
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (composition.current) return;
        const value = draft.trim();
        setDraft(value);
        onSubmit(value);
      }}
    >
      <div className="relative w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionStart={() => { composition.current = true; }}
          onCompositionEnd={() => { composition.current = false; }}
          placeholder="搜索名称、别名、简介或原文证据"
          aria-label="搜索全库知识"
          className="pl-9"
        />
      </div>
      <Button type="submit">
        <Search className="h-4 w-4" />
        搜索
      </Button>
    </form>
  );
}

export default function BrowseLibrary() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    status,
    books,
    statusLoading,
    bookCache,
    globalRecords,
    globalLoading,
    globalError,
    globalWarnings,
    globalLoadProgress,
    loadGlobalLibrary,
  } = useLibraryStore();
  const initialScrollKey = useRef(`${SCROLL_KEY_PREFIX}${location.search}`);
  const restoredScroll = useRef(false);
  const [searchResetVersion, setSearchResetVersion] = useState(0);

  const keyword = searchParams.get('q') ?? '';
  const author = searchParams.get('author') ?? 'all';
  const bookPath = searchParams.get('book') ?? 'all';
  const kind = (searchParams.get('type') ?? 'all') as 'all' | LibraryEntityKind;
  const facet = searchParams.get('facet') ?? 'all';
  const sort = (searchParams.get('sort') ?? 'relevance') as 'relevance' | 'name' | 'book' | 'type';
  const page = parsePage(searchParams.get('page'));
  const detailKey = searchParams.get('detail');

  useEffect(() => {
    void loadGlobalLibrary();
  }, [loadGlobalLibrary]);

  useEffect(() => {
    const scrollKey = `${SCROLL_KEY_PREFIX}${location.search}`;
    return () => sessionStorage.setItem(scrollKey, String(window.scrollY));
  }, [location.search]);

  useEffect(() => {
    if (restoredScroll.current || globalLoading) return;
    restoredScroll.current = true;
    const saved = Number(sessionStorage.getItem(initialScrollKey.current));
    if (Number.isFinite(saved) && saved > 0) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    }
  }, [globalLoading]);

  const browseableBooks = useMemo(() => books.filter((book) => book.browseable), [books]);
  const authors = useMemo(
    () => [...new Set(browseableBooks.map((book) => book.author))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [browseableBooks],
  );
  const bookOptions = useMemo(
    () => browseableBooks
      .filter((book) => author === 'all' || book.author === author)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [author, browseableBooks],
  );
  const facetOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const record of globalRecords) {
      if (kind !== 'all' && record.kind !== kind) continue;
      values.set(`${record.kind}:${record.facet}`, `${LIBRARY_KIND_LABELS[record.kind]} · ${record.facet}`);
    }
    return [...values.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'))
      .map(([value, label]) => ({ value, label }));
  }, [globalRecords, kind]);

  const filteredRecords = useMemo(
    () => filterGlobalLibraryRecords(globalRecords, { keyword, author, bookPath, kind, facet, sort }),
    [author, bookPath, facet, globalRecords, keyword, kind, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRecord = detailKey ? globalRecords.find((record) => record.key === detailKey) ?? null : null;

  useEffect(() => {
    if (page <= totalPages) return;
    const next = new URLSearchParams(searchParams);
    if (totalPages === 1) next.delete('page');
    else next.set('page', String(totalPages));
    setSearchParams(next, { replace: true });
  }, [page, searchParams, setSearchParams, totalPages]);

  const kindCounts = useMemo(() => {
    return kindItems.reduce<Record<LibraryEntityKind, number>>((counts, item) => {
      counts[item.kind] = globalRecords.filter((record) => record.kind === item.kind).length;
      return counts;
    }, { character: 0, skill: 0, item: 0, faction: 0, location: 0 });
  }, [globalRecords]);

  const setParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || (key === 'sort' && value === 'relevance')) next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete('page');
    if (key !== 'detail') next.delete('detail');
    if (key === 'author' && value !== author) next.delete('book');
    if (key === 'type') next.delete('facet');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchResetVersion((version) => version + 1);
    setSearchParams({}, { replace: true });
  };
  const hasFilters = Boolean(keyword || author !== 'all' || bookPath !== 'all' || kind !== 'all' || facet !== 'all');
  const returnParams = new URLSearchParams(searchParams);
  returnParams.delete('detail');
  const returnTo = `/browse${returnParams.size > 0 ? `?${returnParams.toString()}` : ''}`;
  const saveCurrentScroll = () => sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${location.search}`, String(window.scrollY));

  return (
    <div className="flex min-h-screen min-w-[1180px] flex-col bg-background">
      <WorkspaceHeader
        active="browse"
        actions={globalLoading ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            正在载入 {globalLoadProgress.completed}/{globalLoadProgress.total} 本
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">已索引 {browseableBooks.length} 本可浏览知识库</span>
        )}
      />

      <main className="mx-auto w-full max-w-[1480px] flex-1 px-8 py-7">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">全库知识搜索</h1>
            <p className="mt-1 text-sm text-muted-foreground">跨书检索人物、武功、物品、势力和地点，并查看来源证据。</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{globalRecords.length.toLocaleString('zh-CN')} 条知识记录</div>
            <div className="mt-1">每页最多展示 {PAGE_SIZE} 条</div>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-5 overflow-hidden rounded-lg border bg-card" aria-label="知识类型统计">
          {kindItems.map((item, index) => {
            const Icon = item.icon;
            const active = kind === item.kind;
            return (
              <button
                key={item.kind}
                type="button"
                className={cn(
                  'flex h-20 items-center gap-3 px-5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  index > 0 && 'border-l',
                  active && 'bg-muted',
                )}
                aria-pressed={active}
                onClick={() => setParam('type', active ? 'all' : item.kind)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xl font-semibold tabular-nums text-foreground">{kindCounts[item.kind]}</span>
                  <span className="block text-xs text-muted-foreground">{item.label}</span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="mt-5">
          <div className="border-b pb-4">
            <div className="flex items-center gap-3">
              <GlobalSearchForm
                key={`${keyword}:${searchResetVersion}`}
                initialValue={keyword}
                onSubmit={(value) => setParam('q', value)}
              />
              <NativeSelect
                value={author}
                onChange={(event) => setParam('author', event.target.value)}
                options={[{ value: 'all', label: '全部作者' }, ...authors.map((name) => ({ value: name, label: name }))]}
                aria-label="按作者筛选"
                className="w-36"
              />
              <NativeSelect
                value={bookPath}
                onChange={(event) => setParam('book', event.target.value)}
                options={[{ value: 'all', label: '全部书籍' }, ...bookOptions.map((book) => ({ value: book.path, label: book.name }))]}
                aria-label="按书籍筛选"
                className="w-48"
              />
              <NativeSelect
                value={kind}
                onChange={(event) => setParam('type', event.target.value)}
                options={[{ value: 'all', label: '全部类型' }, ...kindItems.map((item) => ({ value: item.kind, label: item.label }))]}
                aria-label="按实体类型筛选"
                className="w-36"
              />
              <NativeSelect
                value={facet}
                onChange={(event) => setParam('facet', event.target.value)}
                options={[{ value: 'all', label: '全部分类' }, ...facetOptions]}
                aria-label="按实体特有字段筛选"
                className="w-44"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <NativeSelect
                value={sort}
                onChange={(event) => setParam('sort', event.target.value)}
                options={[
                  { value: 'relevance', label: '相关度优先' },
                  { value: 'name', label: '名称排序' },
                  { value: 'book', label: '来源书籍排序' },
                  { value: 'type', label: '实体类型排序' },
                ]}
                aria-label="结果排序"
                className="w-40"
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" />
                  清空筛选
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">找到 {filteredRecords.length.toLocaleString('zh-CN')} 条</span>
            </div>
          </div>

          {globalWarnings.length > 0 && (
            <details className="mt-4 border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3 text-sm dark:bg-amber-950/20">
              <summary className="cursor-pointer font-medium text-foreground">{globalWarnings.length} 本知识库载入失败，其他结果不受影响</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {globalWarnings.map((warning) => <li key={warning.bookPath}>{warning.bookName}：{warning.message}</li>)}
              </ul>
            </details>
          )}

          {globalError ? (
            <div className="mt-5 flex items-start justify-between border-l-2 border-destructive bg-destructive/5 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  全库索引载入失败
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{globalError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadGlobalLibrary()}>重试</Button>
            </div>
          ) : (statusLoading && !status) || (globalLoading && globalRecords.length === 0) ? (
            <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在建立全库索引（{globalLoadProgress.completed}/{globalLoadProgress.total} 本）
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border bg-card">
              <Table className="table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[250px] px-4">名称</TableHead>
                    <TableHead className="w-[90px] px-3">类型</TableHead>
                    <TableHead className="w-[210px] px-3">来源</TableHead>
                    <TableHead className="w-[150px] px-3">分类</TableHead>
                    <TableHead className="px-3">命中内容 / 证据</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.length > 0 ? visibleRecords.map((record) => {
                    const excerpt = record.evidence.find((ref) => ref.text)?.text || record.summary;
                    return (
                      <TableRow
                        key={record.key}
                        tabIndex={0}
                        aria-label={`查看${LIBRARY_KIND_LABELS[record.kind]}“${record.name}”详情`}
                        className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => setParam('detail', record.key, false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setParam('detail', record.key, false);
                          }
                        }}
                      >
                        <TableCell className="h-16 px-4 font-medium text-foreground">
                          <HighlightedText text={record.name} keyword={keyword} />
                        </TableCell>
                        <TableCell className="px-3"><Badge variant="outline">{LIBRARY_KIND_LABELS[record.kind]}</Badge></TableCell>
                        <TableCell className="px-3">
                          <div className="truncate text-sm text-foreground">{record.source.bookName}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{record.source.author}</div>
                        </TableCell>
                        <TableCell className="px-3 text-sm text-muted-foreground"><span className="line-clamp-2">{record.facet}</span></TableCell>
                        <TableCell className="px-3 text-sm leading-5 text-muted-foreground">
                          <span className="line-clamp-2"><HighlightedText text={excerpt} keyword={keyword} /></span>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-36 text-center text-muted-foreground">没有符合当前条件的知识记录</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={filteredRecords.length}
                itemLabel="条记录"
                onPageChange={(nextPage) => setParam('page', String(nextPage), false)}
              />
            </div>
          )}
        </section>
      </main>

      <Sheet open={selectedRecord !== null} onOpenChange={(open) => !open && setParam('detail', '', false)}>
        {selectedRecord && (
          <GlobalEntityDetail
            record={selectedRecord}
            data={bookCache[selectedRecord.source.bookPath]}
            returnTo={returnTo}
            onNavigate={saveCurrentScroll}
          />
        )}
      </Sheet>
    </div>
  );
}
