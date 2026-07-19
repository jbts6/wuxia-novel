import { useMemo, useState } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { displayTaxonomyValue } from '../lib/displayText';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Items() {
  const { items, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  useEntityDetailParam('item', items);
  const typeOptions = useMemo(() => [...new Set(items.flatMap((entry) => entry.type ? [entry.type] : []))]
    .map((value) => ({ value, label: displayTaxonomyValue(value) })), [items]);
  const filtered = useMemo(() => items.filter((entry) => {
    const searchable = [entry.name, ...entry.aliases, entry.description ?? ''].join('\n');
    return (!search || searchable.includes(search))
      && (typeFilter.length === 0 || (entry.type !== null && typeFilter.includes(entry.type)));
  }), [items, search, typeFilter]);
  const selected = useMemo(() => detailPanel.type === 'item'
    ? items.find((entry) => entry.id === detailPanel.id) ?? null
    : null, [detailPanel, items]);

  return <div>
    <PageHeader title="百宝录" description={`共 ${filtered.length} 件物品`}>
      <div className="flex gap-2">
        <Input placeholder="搜索物品/别名..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-48" />
        <MultiSearchableSelect className="w-44" options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="类型" searchPlaceholder="搜索类型..." maxDisplay={2} />
      </div>
    </PageHeader>
    <div className="rounded-md border"><table className="w-full">
      <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left font-medium">名称</th><th className="p-3 text-left font-medium">别名</th><th className="p-3 text-left font-medium">类型</th><th className="p-3 text-left font-medium">简介</th></tr></thead>
      <tbody>{filtered.map((entry) => <tr key={entry.id} className="cursor-pointer border-b transition-colors hover:bg-muted/50" onClick={() => showDetail('item', entry.id)}>
        <td className="p-3 font-medium">{entry.name}</td><td className="p-3 text-sm text-muted-foreground">{entry.aliases.join('、')}</td>
        <td className="p-3">{entry.type && <Badge variant="outline">{displayTaxonomyValue(entry.type)}</Badge>}</td>
        <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">{entry.description ?? ''}</td>
      </tr>)}</tbody>
    </table></div>
    <Sheet open={detailPanel.open && detailPanel.type === 'item'} onOpenChange={(open) => !open && hideDetail()}>
      <SheetContent className="w-[400px] overflow-y-auto p-6 sm:w-[540px]">{selected && <>
        <SheetHeader className="px-0"><SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          {selected.type && <div className="text-sm">类型：{displayTaxonomyValue(selected.type)}</div>}
          {selected.aliases.length > 0 && <div className="flex flex-wrap gap-1">{selected.aliases.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div>}
          {selected.description && <><Separator /><div><h4 className="mb-2 font-medium">简介</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p></div></>}
        </div>
      </>}</SheetContent>
    </Sheet>
  </div>;
}
