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

export default function Characters() {
  const { characters, factionMap, skillMap, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [factionFilter, setFactionFilter] = useState<string[]>([]);
  const [rankFilter, setRankFilter] = useState<string[]>([]);
  useEntityDetailParam('character', characters);

  const levelOptions = useMemo(() => [...new Set(characters.flatMap((entry) => entry.level ? [entry.level] : []))]
    .map((value) => ({ value, label: displayTaxonomyValue(value) })), [characters]);
  const rankOptions = useMemo(() => [...new Set(characters.flatMap((entry) => entry.rank ? [entry.rank] : []))]
    .map((value) => ({ value, label: displayTaxonomyValue(value) })), [characters]);
  const factionOptions = useMemo(() => [...new Set(characters.flatMap((entry) => entry.factions))]
    .map((id) => ({ value: id, label: resolveEntityName(id, factionMap)! }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN')), [characters, factionMap]);

  const filtered = useMemo(() => characters.filter((entry) => {
    const searchable = [entry.name, ...entry.aliases, ...entry.identities, entry.description ?? ''].join('\n');
    return (!search || searchable.includes(search))
      && (levelFilter.length === 0 || (entry.level !== null && levelFilter.includes(entry.level)))
      && (rankFilter.length === 0 || (entry.rank !== null && rankFilter.includes(entry.rank)))
      && (factionFilter.length === 0 || entry.factions.some((id) => factionFilter.includes(id)));
  }), [characters, factionFilter, levelFilter, rankFilter, search]);

  const selected = useMemo(() => detailPanel.type === 'character'
    ? characters.find((entry) => entry.id === detailPanel.id) ?? null
    : null, [characters, detailPanel]);
  const selectedFactions = selected ? resolveIds(selected.factions, factionMap) : [];
  const selectedSkills = selected ? resolveIds(selected.skills, skillMap) : [];

  return (
    <div>
      <PageHeader title="人物志" description={`共 ${filtered.length} 人`}>
        <div className="flex gap-2">
          <Input placeholder="搜索姓名/别名/身份..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-48" />
          <MultiSearchableSelect className="w-40" options={levelOptions} value={levelFilter} onChange={setLevelFilter} placeholder="层级" searchPlaceholder="搜索层级..." maxDisplay={2} />
          <MultiSearchableSelect className="w-40" options={factionOptions} value={factionFilter} onChange={setFactionFilter} placeholder="势力" searchPlaceholder="搜索势力..." maxDisplay={2} />
          <MultiSearchableSelect className="w-40" options={rankOptions} value={rankFilter} onChange={setRankFilter} placeholder="境界" searchPlaceholder="搜索境界..." maxDisplay={2} />
        </div>
      </PageHeader>

      <div className="rounded-md border">
        <table className="w-full">
          <thead><tr className="border-b bg-muted/50">
            <th className="p-3 text-left font-medium">姓名</th><th className="p-3 text-left font-medium">别名</th>
            <th className="p-3 text-left font-medium">身份</th><th className="p-3 text-left font-medium">势力</th>
            <th className="p-3 text-left font-medium">境界</th><th className="p-3 text-left font-medium">简介</th>
          </tr></thead>
          <tbody>{filtered.map((entry) => (
            <tr key={entry.id} className="cursor-pointer border-b transition-colors hover:bg-muted/50" onClick={() => showDetail('character', entry.id)}>
              <td className="p-3 font-medium">{entry.name}</td>
              <td className="p-3 text-sm text-muted-foreground">{entry.aliases.join('、')}</td>
              <td className="p-3 text-sm">{entry.identities.join('、')}</td>
              <td className="p-3 text-sm">{resolveIds(entry.factions, factionMap).join('、')}</td>
              <td className="p-3 text-sm text-accent">{entry.rank ? displayTaxonomyValue(entry.rank) : ''}</td>
              <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">{entry.description ?? ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'character'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] overflow-y-auto p-6 sm:w-[540px]">
          {selected && <>
            <SheetHeader className="px-0"><SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-4">
              {(selected.level || selected.rank) && <div className="grid grid-cols-2 gap-2 text-sm">
                {selected.level && <div>层级：{displayTaxonomyValue(selected.level)}</div>}
                {selected.rank && <div>境界：{displayTaxonomyValue(selected.rank)}</div>}
              </div>}
              {selected.aliases.length > 0 && <div><h4 className="mb-2 font-medium">别名</h4><div className="flex flex-wrap gap-1">{selected.aliases.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div></div>}
              {selected.identities.length > 0 && <div><h4 className="mb-2 font-medium">身份</h4><div className="flex flex-wrap gap-1">{selected.identities.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div></div>}
              {selected.description && <><Separator /><div><h4 className="mb-2 font-medium">简介</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p></div></>}
              {selectedFactions.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">势力</h4><div className="flex flex-wrap gap-1">{selectedFactions.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div></div></>}
              {selectedSkills.length > 0 && <><Separator /><div><h4 className="mb-2 font-medium">武功</h4><div className="flex flex-wrap gap-1">{selectedSkills.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}</div></div></>}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
