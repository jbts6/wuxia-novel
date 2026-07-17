import { useMemo } from 'react';
import { ArrowUpRight, BookOpenText, FileQuestion, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnyLibraryRecord } from '../../types/library';
import type { NovelData } from '../../types/novel';
import { LIBRARY_KIND_LABELS, LIBRARY_KIND_ROUTES } from '../../lib/globalLibrary';
import { buildIdMaps, resolveId, resolveIds } from '../../lib/resolveId';
import { displayChineseValues, displayTaxonomyValue } from '../../lib/displayText';
import { hasLibraryEntityContent } from '../../lib/entityContent';
import { buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

interface GlobalEntityDetailProps {
  record: AnyLibraryRecord;
  data?: NovelData;
  returnTo: string;
  onNavigate: () => void;
}

type IdMaps = ReturnType<typeof buildIdMaps>;

const EMPTY_RELATION_DATA = { characters: [], factions: [], locations: [], skills: [], techniques: [], items: [] };

function detailRows(record: AnyLibraryRecord, maps: IdMaps): Array<{ label: string; value: string }> {
  switch (record.kind) {
    case 'character':
      return [
        { label: '身份', value: record.entity.identity || displayTaxonomyValue(record.entity.role) },
        { label: '势力', value: resolveId(record.entity.faction, maps.factionMap, '未注明势力') },
        { label: '境界', value: displayTaxonomyValue(record.entity.power_rank) },
        { label: '类型', value: displayTaxonomyValue(record.entity.archetype) },
      ];
    case 'skill':
      return [
        { label: '类型', value: displayTaxonomyValue(record.entity.type) },
        { label: '势力', value: resolveId(record.entity.faction, maps.factionMap, '未注明势力') },
        { label: '境界', value: displayTaxonomyValue(record.entity.power_rank) },
      ];
    case 'item':
      return [
        { label: '类型', value: displayTaxonomyValue(record.entity.type) },
        { label: '持有者', value: resolveId(record.entity.owner, maps.characterMap, '未注明持有者') },
        { label: '重要性', value: displayTaxonomyValue(record.entity.importance) },
      ];
    case 'faction':
      return [
        { label: '类型', value: displayTaxonomyValue(record.entity.type) },
        { label: '领袖', value: resolveId(record.entity.leader, maps.characterMap, '未注明领袖') },
      ];
  }
}

function visibleChineseValues(values: string[] | null | undefined): string[] {
  return displayChineseValues(values);
}

function relatedValues(record: AnyLibraryRecord, maps: IdMaps): string[] {
  switch (record.kind) {
    case 'character':
      return [
        ...visibleChineseValues(record.entity.alias),
        ...resolveIds(record.entity.skills, maps.skillMap),
        ...resolveIds(record.entity.items, maps.itemMap),
      ];
    case 'skill':
      return [
        ...visibleChineseValues(record.entity.moves),
        ...resolveIds(record.entity.holders, maps.characterMap),
      ];
    case 'item':
      return [
        ...visibleChineseValues(record.entity.tags),
        ...resolveIds(record.entity.related_characters, maps.characterMap),
        ...resolveIds(record.entity.related_skills, maps.skillMap),
      ];
    case 'faction':
      return [
        ...resolveIds(record.entity.members, maps.characterMap),
        ...visibleChineseValues(record.entity.sub_organizations),
        ...visibleChineseValues(record.entity.sub_divisions),
      ];
  }
}

export function GlobalEntityDetail({ record, data, returnTo, onNavigate }: GlobalEntityDetailProps) {
  const route = `/${encodeURIComponent(record.source.author)}/${encodeURIComponent(record.source.bookName)}/${LIBRARY_KIND_ROUTES[record.kind]}?detail=${encodeURIComponent(record.entity.id)}`;
  const maps = useMemo(() => buildIdMaps(data ?? EMPTY_RELATION_DATA), [data]);
  const related = [...new Set(relatedValues(record, maps))].slice(0, 24);
  const hasContent = hasLibraryEntityContent(record.kind, record.entity);
  const hasSummary = record.summary.trim().length > 0 && record.summary !== '暂无简介';

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
        {!hasContent && (
          <section className="border-l-2 border-amber-500 bg-amber-50/70 px-4 py-3 text-amber-950">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileQuestion className="h-4 w-4" />
              仅有索引记录
            </div>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              当前产物只包含名称和原文定位，分类、简介与关系等结构化内容尚未生成。
            </p>
          </section>
        )}

        {hasContent && (
          <section>
            <h3 className="text-sm font-medium text-foreground">基础信息</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 rounded-md border bg-muted/20 p-4">
              {detailRows(record, maps).map((row) => (
                <div key={row.label} className="min-w-0">
                  <div className="text-xs text-muted-foreground">{row.label}</div>
                  <div className="mt-1 break-words text-sm text-foreground">{row.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSummary && (
          <section>
            <h3 className="text-sm font-medium text-foreground">简介</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.summary}</p>
          </section>
        )}

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
          {hasContent ? '可在单书视图查看关系与完整字段' : '可在单书视图核对原文定位'}
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
