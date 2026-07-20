import { Badge } from '../ui/badge';
import { GENERATION_STAGE_LABELS } from '../../lib/libraryStatusPresentation';
import type { LibraryBookStatus } from '../../types/library';
import { cn } from '../../lib/utils';

interface LibraryCardProps {
  book: LibraryBookStatus;
  onClick: (book: LibraryBookStatus) => void;
}

function generationBadge(book: LibraryBookStatus) {
  if (book.generationStage === 'not-started') return <Badge variant="outline">未生成</Badge>;
  if (book.generationStage === 'data-produced') return <Badge variant="secondary">数据已产出</Badge>;
  return <Badge>{GENERATION_STAGE_LABELS[book.generationStage]}</Badge>;
}

function contentCoverageBadge(book: LibraryBookStatus) {
  const coverage = book.contentCoverage;
  if (coverage.state === 'complete') return <Badge className="bg-emerald-600 text-white">内容完整</Badge>;
  if (coverage.state === 'index-only') return <Badge className="bg-amber-100 text-amber-900">仅有索引</Badge>;
  if (coverage.state === 'partial') return <Badge variant="secondary">{coverage.detailed}/{coverage.total}</Badge>;
  return <Badge variant="outline">无实体</Badge>;
}

export function LibraryCard({ book, onClick }: LibraryCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 cursor-pointer',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        'transition-colors'
      )}
      tabIndex={0}
      role="button"
      aria-label={`查看《${book.name}》状态详情`}
      onClick={() => onClick(book)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(book);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground truncate">{book.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{book.author}</div>
        </div>
        {generationBadge(book)}
      </div>
      <div className="flex items-center gap-2">
        {contentCoverageBadge(book)}
      </div>
    </div>
  );
}
