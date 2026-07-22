import { useMemo } from 'react';
import { ArrowUpRight, BookOpenText, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnyLibraryRecord } from '../../types/library';
import type { NovelData } from '../../types/novel';
import { LIBRARY_KIND_LABELS, LIBRARY_KIND_ROUTES } from '../../lib/globalLibrary';
import { buildIdMaps, resolveIds } from '../../lib/resolveId';
import { displayTaxonomyValue } from '../../lib/displayText';
import { hasLibraryEntityContent } from '../../lib/entityContent';
import { buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

interface GlobalEntityDetailProps {
  record: AnyLibraryRecord;
  data?: NovelData;
  returnTo: string;
  onNavigate: () => void;
}

type IdMaps = ReturnType<typeof buildIdMaps>;
const EMPTY_DATA: NovelData = { characters: [], skills: [], items: [], factions: [], chapter_summaries: [] };

function detailRows(record: AnyLibraryRecord): Array<{ label: string; value: string }> {
  switch (record.kind) {
    case 'character':
      return [
        { label: '身份', value: record.entity.identities.join('、') },
        { label: '层级', value: record.entity.level ? displayTaxonomyValue(record.entity.level) : '' },
        { label: '境界', value: record.entity.rank ? displayTaxonomyValue(record.entity.rank) : '' },
      ].filter((row) => row.value);
    case 'skill':
      return [
        { label: '类型', value: record.entity.types.map((value) => displayTaxonomyValue(value)).join('、') },
        { label: '境界', value: record.entity.rank ? displayTaxonomyValue(record.entity.rank) : '' },
      ].filter((row) => row.value);
    case 'item':
      return record.entity.types.length > 0
        ? [{ label: '类型', value: record.entity.types.map((value) => displayTaxonomyValue(value)).join('、') }]
        : [];
    case 'faction':
      return record.entity.types.length > 0
        ? [{ label: '类型', value: record.entity.types.map((value) => displayTaxonomyValue(value)).join('、') }]
        : [];
  }
}

function relatedValues(record: AnyLibraryRecord, maps: IdMaps): string[] {
  switch (record.kind) {
    case 'character':
      return [...record.entity.aliases, ...resolveIds(record.entity.factions, maps.factionMap), ...resolveIds(record.entity.skills, maps.skillMap)];
    case 'skill':
      return [
        ...record.entity.aliases,
        ...resolveIds(record.entity.factions, maps.factionMap),
        ...resolveIds(maps.skillUsers.get(record.entity.id), maps.characterMap),
        ...record.entity.techniques.map((technique) => technique.name),
      ];
    case 'item':
      return record.entity.aliases;
    case 'faction':
      return [...record.entity.aliases, ...resolveIds(maps.factionMembers.get(record.entity.id), maps.characterMap)];
  }
}

export function GlobalEntityDetail({ record, data, returnTo, onNavigate }: GlobalEntityDetailProps) {
  const route = `/${encodeURIComponent(record.source.author)}/${encodeURIComponent(record.source.bookName)}/${LIBRARY_KIND_ROUTES[record.kind]}?detail=${encodeURIComponent(record.entity.id)}`;
  const maps = useMemo(() => buildIdMaps(data ?? EMPTY_DATA), [data]);
  const rows = detailRows(record);
  const related = [...new Set(relatedValues(record, maps))].slice(0, 24);
  const hasContent = hasLibraryEntityContent(record.kind, record.entity);
  const hasSummary = record.summary.trim().length > 0;

  return <SheetContent className="!w-[560px] !max-w-none overflow-y-auto p-0">
    <SheetHeader className="border-b px-6 py-5">
      <div className="flex items-center gap-2"><Badge variant="outline">{LIBRARY_KIND_LABELS[record.kind]}</Badge><span className="text-xs text-muted-foreground">{record.source.author} / {record.source.bookName}</span></div>
      <SheetTitle className="mt-2 font-serif text-2xl">{record.name}</SheetTitle>
    </SheetHeader>
    <div className="space-y-6 px-6 py-5">
      {!hasContent && <section className="border-l-2 border-amber-500 bg-amber-50/70 px-4 py-3 text-amber-950">
        <div className="flex items-center gap-2 text-sm font-medium"><FileQuestion className="h-4 w-4" />仅有索引记录</div>
      </section>}
      {rows.length > 0 && <section><h3 className="text-sm font-medium">基础信息</h3><div className="mt-3 grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-4">{rows.map((row) => <div key={row.label}><div className="text-xs text-muted-foreground">{row.label}</div><div className="mt-1 text-sm">{row.value}</div></div>)}</div></section>}
      {hasSummary && <section><h3 className="text-sm font-medium">简介</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.summary}</p></section>}
      {record.kind === 'skill' && record.entity.techniques.length > 0 && <section><h3 className="text-sm font-medium">招式</h3><div className="mt-2 space-y-2">{record.entity.techniques.map((technique) => <div key={technique.name} className="rounded-md border p-3"><div className="text-sm font-medium">{technique.name}</div>{technique.description && <p className="mt-1 text-sm text-muted-foreground">{technique.description}</p>}</div>)}</div></section>}
      {related.length > 0 && <section><h3 className="text-sm font-medium">相关信息</h3><div className="mt-2 flex flex-wrap gap-1.5">{related.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div></section>}
    </div>
    <div className="sticky bottom-0 flex items-center justify-between border-t bg-popover px-6 py-4"><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><BookOpenText className="h-4 w-4" />打开单书视图查看当前数据</span><Link to={route} state={{ libraryReturnTo: returnTo }} onClick={onNavigate} className={cn(buttonVariants(), 'gap-2')}>打开单书详情<ArrowUpRight className="h-4 w-4" /></Link></div>
  </SheetContent>;
}
