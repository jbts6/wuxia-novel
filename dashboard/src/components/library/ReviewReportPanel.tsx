import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { fetchReviewReport } from '../../lib/libraryApi';
import type { ReviewReport, ReviewReportEntry, ReviewSummary } from '../../types/library';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface ReviewReportPanelProps {
  bookPath: string;
  status: ReviewSummary;
}

const CATEGORY_LABELS: Record<string, string> = {
  characters: '人物',
  skills: '武功',
  items: '物品',
  factions: '势力',
};

interface ReviewGroup {
  category: string;
  codes: Array<{ code: string; entries: ReviewReportEntry[] }>;
}

function groupEntries(entries: ReviewReportEntry[]): ReviewGroup[] {
  const categories = new Map<string, Map<string, ReviewReportEntry[]>>();
  for (const entry of entries) {
    const codes = categories.get(entry.category) ?? new Map<string, ReviewReportEntry[]>();
    codes.set(entry.code, [...(codes.get(entry.code) ?? []), entry]);
    categories.set(entry.category, codes);
  }
  return [...categories.entries()].map(([category, codes]) => ({
    category,
    codes: [...codes.entries()].map(([code, groupedEntries]) => ({ code, entries: groupedEntries })),
  }));
}

function chapterLabel(chapters: number[]): string {
  return `第 ${chapters.join('、')} 章`;
}

function sourceRefChapter(sourceRef: Record<string, unknown>): number | null {
  return Number.isInteger(sourceRef.chapter) ? sourceRef.chapter as number : null;
}

function sourceRefText(sourceRef: Record<string, unknown>): string {
  return typeof sourceRef.text === 'string' ? sourceRef.text : JSON.stringify(sourceRef);
}

function reportStateMessage(status: ReviewSummary): string | null {
  if (status.status === 'missing') return '未安装审查报告';
  if (status.status === 'invalid') return '审查报告无效';
  if (status.status === 'stale') return '审查报告已过期';
  if (status.warningCount === 0) return '未发现审查警告';
  return null;
}

export function ReviewReportPanel({ bookPath, status }: ReviewReportPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupEntries(report?.entries ?? []), [report]);
  const canLoad = status.warningCount > 0 && (status.status === 'current' || status.status === 'stale');
  const stateMessage = reportStateMessage(status);

  async function loadReport(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchReviewReport(bookPath));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  function toggleDetails(): void {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!report && !loading) void loadReport();
  }

  return (
    <section className="min-w-0 border-t pt-5" aria-labelledby="review-report-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id="review-report-heading" className="text-sm font-semibold">审查警告</h3>
          {status.warningCount > 0 && <p className="mt-1 text-sm text-amber-800">{status.warningCount} 条审查警告</p>}
        </div>
        {canLoad && <Button
          type="button"
          variant="outline"
          size="sm"
          aria-controls="review-report-details"
          aria-expanded={expanded}
          aria-label={expanded ? '收起审查警告' : '查看审查警告'}
          onClick={toggleDetails}
          className="shrink-0 gap-1.5"
        >
          {expanded ? '收起' : '查看详情'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </Button>}
      </div>

      {stateMessage && <div className={cn(
        'mt-3 flex items-center gap-2 text-sm',
        status.status === 'missing' || status.warningCount === 0 ? 'text-muted-foreground' : 'text-amber-800',
      )}>
        {(status.status === 'stale' || status.status === 'invalid') && <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>{stateMessage}</span>
      </div>}

      {expanded && <div id="review-report-details" data-testid="review-report-details" className="mt-4 min-w-0 space-y-5">
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />正在加载审查报告
        </div>}
        {error && <div className="border-l-2 border-destructive pl-3">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2 gap-1.5" onClick={() => void loadReport()}>
            <RefreshCw className="h-4 w-4" />重试
          </Button>
        </div>}
        {!loading && !error && report && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">报告中没有可显示的警告</p>
        )}
        {!loading && !error && groups.map((group) => <section key={group.category} className="min-w-0">
          <h4 className="text-sm font-semibold">{CATEGORY_LABELS[group.category] ?? group.category}</h4>
          <div className="mt-3 space-y-5">
            {group.codes.map((codeGroup) => <div key={codeGroup.code} className="min-w-0">
              <Badge variant="outline" className="max-w-full font-mono text-[11px]">
                <span className="truncate">{codeGroup.code}</span>
              </Badge>
              <div className="mt-3 space-y-4">
                {codeGroup.entries.map((entry, index) => <article
                  key={`${entry.name}-${entry.member_refs.join('-')}-${index}`}
                  className="min-w-0 border-l-2 border-amber-400 pl-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h5 className="text-sm font-medium">{entry.name}</h5>
                    <span className="text-xs text-muted-foreground">{chapterLabel(entry.chapter_numbers)}</span>
                  </div>
                  <dl className="mt-2 grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">原因</dt>
                    <dd className="min-w-0 break-words">{entry.reason}</dd>
                    <dt className="text-muted-foreground">处理</dt>
                    <dd className="min-w-0 break-words">{entry.resolution}</dd>
                  </dl>
                  {entry.source_refs.length > 0 && <div className="mt-3 space-y-2">
                    {entry.source_refs.map((sourceRef, sourceIndex) => <blockquote
                      key={`${sourceRefChapter(sourceRef) ?? 'source'}-${sourceIndex}`}
                      className="min-w-0 border-l border-border pl-3 text-xs leading-5 text-muted-foreground"
                    >
                      {sourceRefChapter(sourceRef) !== null && <div className="font-mono text-[11px]">第 {sourceRefChapter(sourceRef)} 章</div>}
                      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{sourceRefText(sourceRef)}</div>
                    </blockquote>)}
                  </div>}
                </article>)}
              </div>
            </div>)}
          </div>
        </section>)}
      </div>}
    </section>
  );
}
