import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveId, resolveIds } from '../lib/resolveId';
import { displayChineseValues, displayTaxonomyValue } from '../lib/displayText';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Factions() {
  const { factions, locationMap, characterMap, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  useEntityDetailParam('faction', factions);

  const filtered = useMemo(() => {
    return factions.filter((f) => !search || f.name.includes(search));
  }, [factions, search]);

  const selected = useMemo(() => {
    if (detailPanel.type === 'faction' && detailPanel.id) {
      return factions.find((f) => f.id === detailPanel.id);
    }
    return null;
  }, [factions, detailPanel]);
  const memberNames = useMemo(() => resolveIds(selected?.members, characterMap), [characterMap, selected]);
  const subOrganizationNames = displayChineseValues(selected?.sub_organizations);

  return (
    <div>
      <PageHeader title="势力录" description={`共 ${filtered.length} 个势力`}>
        <Input
          placeholder="搜索势力..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
      </PageHeader>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">名称</th>
              <th className="p-3 text-left font-medium">类型</th>
              <th className="p-3 text-left font-medium">地点</th>
              <th className="p-3 text-left font-medium">领袖</th>
              <th className="p-3 text-left font-medium">简介</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((faction) => (
              <tr
                key={faction.id}
                className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                onClick={() => showDetail('faction', faction.id)}
              >
                <td className="p-3 font-medium">{faction.name}</td>
                <td className="p-3">
                  <Badge variant="outline">{displayTaxonomyValue(faction.type)}</Badge>
                </td>
                <td className="p-3 text-sm">{resolveId(faction.location, locationMap, '未注明地点')}</td>
                <td className="p-3 text-sm">{resolveId(faction.leader, characterMap, '未注明领袖')}</td>
                <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                  {faction.one_line || faction.description?.slice(0, 50) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'faction'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selected && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>类型：{displayTaxonomyValue(selected.type)}</div>
                  <div>地点：{resolveId(selected.location, locationMap, '未注明地点')}</div>
                  <div>领袖：{resolveId(selected.leader, characterMap, '未注明领袖')}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selected.one_line || selected.description || '暂无简介'}</p>
                </div>
                {memberNames.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">成员</h4>
                      <div className="flex flex-wrap gap-1">
                        {memberNames.map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {subOrganizationNames.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">下属机构</h4>
                      <div className="flex flex-wrap gap-1">
                        {subOrganizationNames.map((o) => (
                          <Badge key={o} variant="secondary">{o}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
