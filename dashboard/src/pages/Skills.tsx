import { useMemo, useState } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveEntityName, resolveIds } from '../lib/resolveId';
import { displayTaxonomyValue } from '../lib/displayText';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Skills() {
  const { skills, factionMap, characterMap, skillUsers, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [factionFilter, setFactionFilter] = useState<string[]>([]);
  useEntityDetailParam('skill', skills);

  const typeOptions = useMemo(() => [...new Set(skills.flatMap((entry) => entry.types))]
    .map((value) => ({ value, label: displayTaxonomyValue(value) })), [skills]);
  const factionOptions = useMemo(() => [...new Set(skills.flatMap((entry) => entry.factions))]
    .map((id) => ({ value: id, label: resolveEntityName(id, factionMap)! })), [factionMap, skills]);
  const filtered = useMemo(() => skills.filter((entry) => {
    const techniqueText = entry.techniques.flatMap((technique) => [technique.name, technique.description ?? '']);
    const searchable = [entry.name, ...entry.aliases, ...entry.types, entry.description ?? '', ...techniqueText].join('\n');
    return (!search || searchable.includes(search))
      && (typeFilter.length === 0 || entry.types.some((value) => typeFilter.includes(value)))
      && (factionFilter.length === 0 || entry.factions.some((id) => factionFilter.includes(id)));
  }), [factionFilter, search, skills, typeFilter]);
  const selected = useMemo(() => detailPanel.type === 'skill'
    ? skills.find((entry) => entry.id === detailPanel.id) ?? null
    : null, [detailPanel, skills]);
  const selectedFactions = selected ? resolveIds(selected.factions, factionMap) : [];
  const selectedUsers = selected ? resolveIds(skillUsers.get(selected.id) ?? [], characterMap) : [];

  return (
    <div>
      <PageHeader title="武功阁" description={`共 ${filtered.length} 种武功`}>
        <div className="flex gap-2">
          <Input placeholder="搜索武功/招式..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-48" />
          <MultiSearchableSelect className="w-44" options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="类型" searchPlaceholder="搜索类型..." maxDisplay={2} />
          <MultiSearchableSelect className="w-44" options={factionOptions} value={factionFilter} onChange={setFactionFilter} placeholder="势力" searchPlaceholder="搜索势力..." maxDisplay={2} />
        </div>
      </PageHeader>
      <div className="rounded-md border">
        <table className="w-full">
          <thead><tr className="border-b bg-muted/50">
            <th className="p-3 text-left font-medium">名称</th><th className="p-3 text-left font-medium">类型</th>
            <th className="p-3 text-left font-medium">势力</th><th className="p-3 text-left font-medium">境界</th>
            <th className="p-3 text-left font-medium">简介</th>
          </tr></thead>
          <tbody>{filtered.map((entry) => (
            <tr key={entry.id} className="cursor-pointer border-b transition-colors hover:bg-muted/50" onClick={() => showDetail('skill', entry.id)}>
              <td className="p-3 font-medium">{entry.name}</td>
              <td className="p-3 text-sm">{entry.types.map((value) => displayTaxonomyValue(value)).join('、')}</td>
              <td className="p-3 text-sm">{resolveIds(entry.factions, factionMap).join('、')}</td>
              <td className="p-3 text-sm text-accent">{entry.rank ? displayTaxonomyValue(entry.rank) : ''}</td>
              <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">{entry.description ?? ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'skill'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] overflow-y-auto p-6 sm:w-[540px]">
          {selected && <>
            <SheetHeader className="px-0"><SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-4">
              {selected.rank && <div className="text-sm">境界：{displayTaxonomyValue(selected.rank)}</div>}
              {selected.types.length > 0 && <div><h4 className="mb-2 font-medium">类型</h4><div className="flex flex-wrap gap-1">{selected.types.map((value) => <Badge key={value} variant="outline">{displayTaxonomyValue(value)}</Badge>)}</div></div>}
              {selected.description && <><Separator /><div><h4 className="mb-2 font-medium">简介</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p></div></>}
              {selected.techniques.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">招式</h4><div className="space-y-3">{selected.techniques.map((technique) => <div key={technique.name} className="rounded-md border p-3"><div className="font-medium">{technique.name}</div>{technique.description && <p className="mt-1 text-sm text-muted-foreground">{technique.description}</p>}</div>)}</div></div></>}
              {selectedFactions.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">势力</h4><div className="flex flex-wrap gap-1">{selectedFactions.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div></div></>}
              {selectedUsers.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">使用人物</h4><div className="flex flex-wrap gap-1">{selectedUsers.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div></div></>}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
