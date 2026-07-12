import { ArrowUpRight, BookOpenText, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnyLibraryRecord } from '../../types/library';
import { LIBRARY_KIND_LABELS, LIBRARY_KIND_ROUTES } from '../../lib/globalLibrary';
import { buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

interface GlobalEntityDetailProps {
  record: AnyLibraryRecord;
  returnTo: string;
  onNavigate: () => void;
}

function detailRows(record: AnyLibraryRecord): Array<{ label: string; value: string }> {
  switch (record.kind) {
    case 'character':
      return [
        { label: '身份', value: record.entity.identity || record.entity.role || '-' },
        { label: '势力', value: record.entity.faction || '-' },
        { label: '境界', value: record.entity.power_rank || '-' },
        { label: '类型', value: record.entity.archetype || '-' },
      ];
    case 'skill':
      return [
        { label: '类型', value: record.entity.type || '-' },
        { label: '势力', value: record.entity.faction || '-' },
        { label: '境界', value: record.entity.mastery_rank || record.entity.rank || '-' },
      ];
    case 'item':
      return [
        { label: '类型', value: record.entity.type || '-' },
        { label: '稀有度', value: record.entity.rarity_tier || record.entity.rarity || '-' },
        { label: '持有者', value: record.entity.owner || '-' },
        { label: '重要性', value: record.entity.importance || '-' },
      ];
    case 'faction':
      return [
        { label: '类型', value: record.entity.type || '-' },
        { label: '地点', value: record.entity.location || '-' },
        { label: '领袖', value: record.entity.leader || '-' },
      ];
    case 'location':
      return [{ label: '区域', value: record.entity.region || '-' }];
  }
}

function relatedValues(record: AnyLibraryRecord): string[] {
  switch (record.kind) {
    case 'character':
      return [...record.entity.alias, ...(record.entity.skills ?? []), ...(record.entity.items ?? [])];
    case 'skill':
      return [...(record.entity.moves ?? []), ...(record.entity.holders ?? [])];
    case 'item':
      return [...(record.entity.tags ?? []), ...(record.entity.related_characters ?? []), ...(record.entity.related_skills ?? [])];
    case 'faction':
      return [...(record.entity.members ?? []), ...(record.entity.sub_organizations ?? []), ...(record.entity.sub_divisions ?? [])];
    case 'location':
      return [...(record.entity.factions ?? []), ...(record.entity.characters ?? [])];
  }
}

export function GlobalEntityDetail({ record, returnTo, onNavigate }: GlobalEntityDetailProps) {
  const route = `/${encodeURIComponent(record.source.author)}/${encodeURIComponent(record.source.bookName)}/${LIBRARY_KIND_ROUTES[record.kind]}?detail=${encodeURIComponent(record.entity.id)}`;
  const related = [...new Set(relatedValues(record).filter(Boolean))].slice(0, 24);

  return (
    <SheetContent className="!w-[560px] !max-w-none overflow-y-auto p-0">
      <SheetHeader className="border-b px-6 py-5">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{LIBRARY_KIND_LABELS[record.kind]}</Badge>
          <span className="text-xs text-muted-foreground">{record.source.author} / {record.source.bookName}</span>
        </div>
        <SheetTitle className="mt-2 font-serif text-2xl">{record.name}</SheetTitle>
      </SheetHeader>

      <div className="space-y-6 px-6 py-5">
        <section>
          <h3 className="text-sm font-medium text-foreground">基础信息</h3>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 rounded-md border bg-muted/20 p-4">
            {detailRows(record).map((row) => (
              <div key={row.label} className="min-w-0">
                <div className="text-xs text-muted-foreground">{row.label}</div>
                <div className="mt-1 break-words text-sm text-foreground">{row.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground">简介</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.summary}</p>
        </section>

        {related.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-foreground">相关信息</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {related.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}
            </div>
          </section>
        )}

        <Separator />

        <section>
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">原文证据</h3>
          </div>
          {record.evidence.length > 0 ? (
            <div className="mt-3 space-y-3">
              {record.evidence.slice(0, 6).map((ref, index) => (
                <div key={`${ref.chapter}-${ref.line_start ?? index}`} className="border-l-2 border-border pl-3">
                  <div className="text-xs text-muted-foreground">
                    第 {ref.chapter} 章
                    {ref.line_start !== undefined ? ` · 行 ${ref.line_start}${ref.line_end !== undefined ? `-${ref.line_end}` : ''}` : ''}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-foreground">{ref.text || ref.anchor || '来源已定位，暂无摘录文本'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">当前记录没有可展示的原文摘录。</p>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center justify-between border-t bg-popover px-6 py-4">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenText className="h-4 w-4" />
          可在单书视图查看关系与完整字段
        </span>
        <Link
          to={route}
          state={{ libraryReturnTo: returnTo }}
          onClick={onNavigate}
          className={cn(buttonVariants(), 'gap-2')}
        >
          打开单书详情
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </SheetContent>
  );
}
