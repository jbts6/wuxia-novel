import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveId } from '../lib/resolveId';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Locations() {
  const { locations, factionMap, characterMap, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  useEntityDetailParam('location', locations);

  const filtered = useMemo(() => {
    return locations.filter((l) => !search || l.name.includes(search));
  }, [locations, search]);

  const selected = useMemo(() => {
    if (detailPanel.type === 'location' && detailPanel.id) {
      return locations.find((l) => l.id === detailPanel.id);
    }
    return null;
  }, [locations, detailPanel]);

  return (
    <div>
      <PageHeader title="地点志" description={`共 ${filtered.length} 个地点`}>
        <Input
          placeholder="搜索地点..."
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
              <th className="p-3 text-left font-medium">区域</th>
              <th className="p-3 text-left font-medium">关联势力</th>
              <th className="p-3 text-left font-medium">简介</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((location) => (
              <tr
                key={location.id}
                className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                onClick={() => showDetail('location', location.id)}
              >
                <td className="p-3 font-medium">{location.name}</td>
                <td className="p-3 text-sm">{location.region || '-'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {location.factions?.slice(0, 2).map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">{resolveId(f, factionMap)}</Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                  {location.one_line || location.description?.slice(0, 50) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'location'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selected && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>区域：{selected.region || '-'}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selected.one_line || selected.description || '暂无简介'}</p>
                </div>
                {selected.factions && selected.factions.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">关联势力</h4>
                      <div className="flex flex-wrap gap-1">
                        {selected.factions.map((f) => (
                          <Badge key={f} variant="outline">{resolveId(f, factionMap)}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {selected.characters && selected.characters.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">关联人物</h4>
                      <div className="flex flex-wrap gap-1">
                        {selected.characters.map((c) => (
                          <Badge key={c} variant="secondary">{resolveId(c, characterMap)}</Badge>
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
