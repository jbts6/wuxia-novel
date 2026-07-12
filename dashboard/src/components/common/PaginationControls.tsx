import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel = '条',
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex h-12 items-center justify-between border-t px-4 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {start}-{end} / {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="上一页"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="w-20 text-center tabular-nums text-foreground">
          第 {currentPage} / {totalPages} 页
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="下一页"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
