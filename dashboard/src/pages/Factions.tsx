import { useMemo, useState } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveIds } from '../lib/resolveId';
import { displayTaxonomyValue } from '../lib/displayText';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Factions() {
  const { factions, characterMap, factionMembers, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  useEntityDetailParam('faction', factions);
  const filtered = useMemo(() => factions.filter((entry) => {
    const searchable = [entry.name, ...entry.aliases, ...entry.types, entry.description ?? ''].join('\n');
    return !search || searchable.includes(search);
  }), [factions, search]);
  const selected = useMemo(() => detailPanel.type === 'faction'
    ? factions.find((entry) => entry.id === detailPanel.id) ?? null
    : null, [detailPanel, factions]);
  const selectedMembers = selected ? resolveIds(factionMembers.get(selected.id) ?? [], characterMap) : [];

  return <div>
    <PageHeader title="势力录" description={`共 ${filtered.length} 个势力`}>
      <Input placeholder="搜索势力/别名..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-48" />
    </PageHeader>
    <div className="rounded-md border"><table className="w-full">
      <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left font-medium">名称</th><th className="p-3 text-left font-medium">别名</th><th className="p-3 text-left font-medium">类型</th><th className="p-3 text-left font-medium">简介</th></tr></thead>
      <tbody>{filtered.map((entry) => <tr key={entry.id} className="cursor-pointer border-b transition-colors hover:bg-muted/50" onClick={() => showDetail('faction', entry.id)}>
        <td className="p-3 font-medium">{entry.name}</td><td className="p-3 text-sm text-muted-foreground">{entry.aliases.join('、')}</td>
        <td className="p-3"><div className="flex flex-wrap gap-1">{entry.types.map((value) => <Badge key={value} variant="outline">{displayTaxonomyValue(value)}</Badge>)}</div></td>
        <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">{entry.description ?? ''}</td>
      </tr>)}</tbody>
    </table></div>
    <Sheet open={detailPanel.open && detailPanel.type === 'faction'} onOpenChange={(open) => !open && hideDetail()}>
      <SheetContent className="w-[400px] overflow-y-auto p-6 sm:w-[540px]">{selected && <>
        <SheetHeader className="px-0"><SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          {selected.types.length > 0 && <div className="text-sm">类型：{selected.types.map((value) => displayTaxonomyValue(value)).join('、')}</div>}
          {selected.aliases.length > 0 && <div className="flex flex-wrap gap-1">{selected.aliases.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div>}
          {selected.description && <><Separator /><div><h4 className="mb-2 font-medium">简介</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p></div></>}
          {selectedMembers.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">人物</h4><div className="flex flex-wrap gap-1">{selectedMembers.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div></div></>}
        </div>
      </>}</SheetContent>
    </Sheet>
  </div>;
}
