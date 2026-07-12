import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  FileQuestion,
  LoaderCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { WorkspaceHeader } from '../components/library/WorkspaceHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  GENERATION_STAGE_LABELS,
  formatDateTime,
  isGenerationInProgress,
} from '../lib/libraryStatusPresentation';
import { cn } from '../lib/utils';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { LibraryBookStatus } from '../types/library';

type StatusFilter = 'all' | 'not-started' | 'in-progress' | 'browseable' | 'completed';

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'not-started', label: '未生成' },
  { value: 'in-progress', label: '生成中' },
  { value: 'browseable', label: '可浏览' },
  { value: 'completed', label: '已完成' },
];

function generationBadge(book: LibraryBookStatus) {
  if (book.generationStage === 'not-started') return <Badge variant="outline">未生成</Badge>;
  if (book.generationStage === 'data-produced') return <Badge variant="secondary">数据已产出</Badge>;
  return <Badge>{GENERATION_STAGE_LABELS[book.generationStage]}</Badge>;
}

function validationBadge(book: LibraryBookStatus) {
  if (book.validationStatus === 'passed') return <Badge className="bg-emerald-600 text-white">G1-G5 通过</Badge>;
  if (book.validationStatus === 'failed') return <Badge variant="destructive">校验失败</Badge>;
  if (book.validationStatus === 'legacy-unproven') return <Badge className="bg-amber-100 text-amber-900">待新版验证</Badge>;
  return <Badge variant="outline">未校验</Badge>;
}

function formatEntityCount(value: number | null): string {
  return value === null ? '-' : String(value);
}

const entityCountItems = [
  { key: 'characters' as const, label: '人物' },
  { key: 'factions' as const, label: '势力' },
  { key: 'locations' as const, label: '地点' },
  { key: 'skills' as const, label: '武功' },
  { key: 'techniques' as const, label: '招式' },
  { key: 'items' as const, label: '物品' },
  { key: 'dialogues' as const, label: '对话' },
];

function SortHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onClick}>
      {label}
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const { status, books, statusLoading, statusError, refreshStatus } = useLibraryStore();
  const [selectedBook, setSelectedBook] = useState<LibraryBookStatus | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastUpdatedAt', desc: true }]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!status && !statusLoading) void refreshStatus();
  }, [refreshStatus, status, statusLoading]);

  const authors = useMemo(() => [...new Set(books.map((book) => book.author))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [books]);

  const filteredBooks = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('zh-CN');
    return books.filter((book) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'not-started' && book.generationStage === 'not-started') ||
        (statusFilter === 'in-progress' && isGenerationInProgress(book)) ||
        (statusFilter === 'browseable' && book.browseable) ||
        (statusFilter === 'completed' && book.completed);
      const authorMatch = authorFilter === 'all' || book.author === authorFilter;
      const keywordMatch = !keyword || `${book.author} ${book.name}`.toLocaleLowerCase('zh-CN').includes(keyword);
      return statusMatch && authorMatch && keywordMatch;
    });
  }, [authorFilter, books, search, statusFilter]);

  const columns = useMemo<ColumnDef<LibraryBookStatus>[]>(
    () => [
      {
        id: 'book',
        size: 220,
        accessorFn: (book) => `${book.author}/${book.name}`,
        header: ({ column }) => <SortHeader label="书籍" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />,
        cell: ({ row }) => (
          <div className="min-w-44">
            <div className="font-medium text-foreground">{row.original.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.author}</div>
          </div>
        ),
      },
      {
        accessorKey: 'generationStage',
        size: 140,
        header: ({ column }) => <SortHeader label="当前阶段" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />,
        cell: ({ row }) => generationBadge(row.original),
      },
      {
        id: 'entityCounts',
        size: 300,
        header: '知识条目',
        cell: ({ row }) => {
          const { characters, skills, items } = row.original.entityCounts;
          if (characters === null && skills === null && items === null) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }

          const summary = `角色 ${formatEntityCount(characters)} · 武功 ${formatEntityCount(skills)} · 物品 ${formatEntityCount(items)}`;
          return (
            <span
              className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground"
              title={summary}
            >
              {summary}
            </span>
          );
        },
      },
      {
        id: 'dataCompleteness',
        size: 88,
        accessorFn: (book) => book.dataCompleteness.valid,
        header: ({ column }) => <SortHeader label="数据" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />,
        cell: ({ row }) => (
          <span className={cn('font-mono text-xs tabular-nums', row.original.browseable ? 'text-emerald-700' : 'text-muted-foreground')}>
            {row.original.dataCompleteness.valid}/{row.original.dataCompleteness.required}
          </span>
        ),
      },
      {
        accessorKey: 'validationStatus',
        size: 140,
        header: '校验状态',
        cell: ({ row }) => validationBadge(row.original),
      },
      {
        id: 'browseable',
        size: 88,
        accessorFn: (book) => Number(book.browseable),
        header: '可浏览',
        cell: ({ row }) => (
          <span className={cn('inline-flex items-center gap-1 text-xs', row.original.browseable ? 'text-emerald-700' : 'text-muted-foreground')}>
            {row.original.browseable ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileQuestion className="h-3.5 w-3.5" />}
            {row.original.browseable ? '是' : '否'}
          </span>
        ),
      },
      {
        accessorKey: 'lastUpdatedAt',
        size: 150,
        header: ({ column }) => <SortHeader label="更新时间" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} />,
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.lastUpdatedAt)}</span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredBooks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectBook = (book: LibraryBookStatus) => {
    setCopied(false);
    setSelectedBook(book);
  };

  const copyCommand = async () => {
    const command = selectedBook?.suggestedAction?.command;
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
  };

  const openBook = () => {
    if (!selectedBook?.browseable) return;
    navigate(`/${encodeURIComponent(selectedBook.author)}/${encodeURIComponent(selectedBook.name)}/overview`);
  };

  const summaryItems = [
    { key: 'all' as const, label: '全部书目', value: status?.summary.total ?? 0, icon: Database },
    { key: 'not-started' as const, label: '未生成', value: status?.summary.notStarted ?? 0, icon: FileQuestion },
    { key: 'in-progress' as const, label: '生成中', value: status?.summary.inProgress ?? 0, icon: Clock3 },
    { key: 'browseable' as const, label: '可浏览', value: status?.summary.browseable ?? 0, icon: CheckCircle2 },
    { key: 'completed' as const, label: '已完成', value: status?.summary.completed ?? 0, icon: Check },
  ];

  return (
    <div className="flex min-h-screen min-w-[1180px] flex-col bg-background">
      <WorkspaceHeader
        active="manage"
        actions={
          <>
            <span className="text-xs text-muted-foreground">上次扫描 {formatDateTime(status?.scannedAt ?? null)}</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="刷新知识库状态"
                    disabled={statusLoading}
                    onClick={() => void refreshStatus()}
                  />
                }
              >
                <RefreshCw className={cn('h-4 w-4', statusLoading && 'animate-spin')} />
              </TooltipTrigger>
              <TooltipContent>重新扫描本地产物</TooltipContent>
            </Tooltip>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1480px] flex-1 px-8 py-7">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">全库生成状态总览</h1>
            <p className="mt-1 text-sm text-muted-foreground">根据本地产物判断书目阶段、扫描覆盖、校验结果和可浏览状态。</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>发现 {status?.summary.total ?? 0} 本原文书籍</div>
            <div className="mt-1">可浏览与已完成采用不同门槛</div>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-5 overflow-hidden rounded-lg border bg-card" aria-label="书籍状态统计">
          {summaryItems.map((item, index) => {
            const Icon = item.icon;
            const active = statusFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  'flex h-24 items-center gap-4 px-5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  index > 0 && 'border-l',
                  active && 'bg-muted',
                )}
                onClick={() => setStatusFilter(item.key)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-2xl font-semibold tabular-nums text-foreground">{item.value}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.label}</span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="mt-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索作者或书名"
                aria-label="搜索作者或书名"
                className="pl-9"
              />
            </div>
            <NativeSelect
              value={authorFilter}
              onChange={(event) => setAuthorFilter(event.target.value)}
              options={[{ value: 'all', label: '全部作者' }, ...authors.map((author) => ({ value: author, label: author }))]}
              aria-label="按作者筛选"
              className="w-40"
            />
            <NativeSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              options={statusOptions}
              aria-label="按状态筛选"
              className="w-40"
            />
            <span className="ml-auto text-xs text-muted-foreground">显示 {filteredBooks.length} 本</span>
          </div>

          {statusError ? (
            <div className="mt-5 flex items-start justify-between border-l-2 border-destructive bg-destructive/5 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  状态扫描失败
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{statusError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshStatus()}>重试</Button>
            </div>
          ) : statusLoading && !status ? (
            <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在扫描知识库产物
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border bg-card">
              <Table className="table-fixed">
                <TableHeader className="bg-muted/40">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="px-3" style={{ width: header.getSize() }}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        tabIndex={0}
                        aria-label={`查看《${row.original.name}》状态详情`}
                        className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => selectBook(row.original)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectBook(row.original);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="h-14 px-3" style={{ width: cell.column.getSize() }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                        没有符合当前条件的书籍
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>

      <Sheet open={selectedBook !== null} onOpenChange={(open) => !open && setSelectedBook(null)}>
        <SheetContent className="w-[520px] max-w-none sm:max-w-none">
          {selectedBook && (
            <>
              <SheetHeader className="border-b pb-4">
                <div className="pr-10">
                  <div className="text-xs text-muted-foreground">{selectedBook.author}</div>
                  <SheetTitle className="mt-1 font-serif text-xl">{selectedBook.name}</SheetTitle>
                  <SheetDescription className="mt-2">{selectedBook.path}</SheetDescription>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 scrollbar-thin">
                <section className="grid grid-cols-2 gap-x-6 gap-y-4 border-b pb-5">
                  <div>
                    <div className="text-xs text-muted-foreground">当前阶段</div>
                    <div className="mt-1">{generationBadge(selectedBook)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">校验状态</div>
                    <div className="mt-1">{validationBadge(selectedBook)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">数据完整度</div>
                    <div className="mt-1 font-mono text-sm">{selectedBook.dataCompleteness.valid}/{selectedBook.dataCompleteness.required}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Schema</div>
                    <div className="mt-1 text-sm">{selectedBook.schemaVersion ?? 'legacy / 未知'}</div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold">知识条目</h3>
                  <dl className="mt-3 grid grid-cols-4 gap-x-5 gap-y-4">
                    {entityCountItems.map((item) => (
                      <div key={item.key}>
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className="mt-1 font-mono text-base font-medium tabular-nums text-foreground">
                          {formatEntityCount(selectedBook.entityCounts[item.key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="border-t pt-5">
                  <h3 className="text-sm font-semibold">窗口覆盖</h3>
                  <div className="mt-3 space-y-2">
                    {(['named-inventory', 'event-dialogue', 'gap-audit'] as const).map((passName) => {
                      const progress = selectedBook.scanProgress[passName];
                      const labels = { 'named-inventory': '实体扫描', 'event-dialogue': '事件对话', 'gap-audit': '独立查漏' };
                      return (
                        <div key={passName} className="flex items-center justify-between border-b border-dashed py-2 text-sm">
                          <span className="text-muted-foreground">{labels[passName]}</span>
                          <span className="font-mono tabular-nums">{progress.completed}/{progress.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {(selectedBook.missingArtifacts.length > 0 || selectedBook.errors.length > 0 || selectedBook.gateFailures.length > 0) && (
                  <section>
                    <h3 className="text-sm font-semibold">待处理项</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {[...selectedBook.missingArtifacts, ...selectedBook.errors, ...selectedBook.gateFailures].map((item, index) => (
                        <li key={`${item}-${index}`} className="border-l-2 border-border pl-3">{item}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {selectedBook.suggestedAction && (
                  <section className="border-t pt-5">
                    <h3 className="text-sm font-semibold">建议下一步</h3>
                    <p className="mt-2 text-sm font-medium">{selectedBook.suggestedAction.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedBook.suggestedAction.reason}</p>
                    {selectedBook.suggestedAction.command && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/40 p-3">
                        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-xs leading-5">
                          {selectedBook.suggestedAction.command}
                        </code>
                        <Tooltip>
                          <TooltipTrigger
                            render={<Button variant="outline" size="icon-sm" aria-label="复制建议命令" onClick={() => void copyCommand()} />}
                          >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Clipboard className="h-3.5 w-3.5" />}
                          </TooltipTrigger>
                          <TooltipContent>{copied ? '已复制' : '复制命令'}</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </section>
                )}
              </div>

              <SheetFooter className="border-t bg-card">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs text-muted-foreground">更新 {formatDateTime(selectedBook.lastUpdatedAt)}</span>
                  <Button disabled={!selectedBook.browseable} onClick={openBook}>
                    {selectedBook.browseable ? '进入知识库' : '知识库尚不可浏览'}
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
