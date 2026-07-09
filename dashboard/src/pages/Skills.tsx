import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveId } from '../lib/resolveId';

export default function Skills() {
  const { skills, factionMap, characterMap, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const typeOptions = useMemo(() => {
    const set = new Set(skills.map((s) => s.type).filter(Boolean));
    return Array.from(set).sort().map((t) => ({ value: t, label: t }));
  }, [skills]);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchSearch = !search || s.name.includes(search);
      const matchType = typeFilter.length === 0 || typeFilter.includes(s.type);
      return matchSearch && matchType;
    });
  }, [skills, search, typeFilter]);

  const selected = useMemo(() => {
    if (detailPanel.type === 'skill' && detailPanel.id) {
      return skills.find((s) => s.id === detailPanel.id);
    }
    return null;
  }, [skills, detailPanel]);

  return (
    <div>
      <PageHeader title="武功阁" description={`共 ${filtered.length} 种武功`}>
        <div className="flex gap-2">
          <Input
            placeholder="搜索武功..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <MultiSearchableSelect
            className="w-48"
            options={typeOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="类型"
            searchPlaceholder="搜索类型..."
            maxDisplay={2}
          />
        </div>
      </PageHeader>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">名称</th>
              <th className="p-3 text-left font-medium">类型</th>
              <th className="p-3 text-left font-medium">门派</th>
              <th className="p-3 text-left font-medium">境界</th>
              <th className="p-3 text-left font-medium">简介</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((skill) => (
              <tr
                key={skill.id}
                className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                onClick={() => showDetail('skill', skill.id)}
              >
                <td className="p-3 font-medium">{skill.name}</td>
                <td className="p-3">
                  <Badge variant="outline">{skill.type}</Badge>
                </td>
                <td className="p-3 text-sm">{resolveId(skill.faction, factionMap)}</td>
                <td className="p-3 text-sm text-accent">{skill.mastery_rank || '-'}</td>
                <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                  {skill.one_line || skill.description?.slice(0, 50) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'skill'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selected && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>类型：{selected.type}</div>
                  <div>门派：{resolveId(selected.faction, factionMap)}</div>
                  <div>境界：{selected.mastery_rank || '-'}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selected.one_line || selected.description || '暂无简介'}</p>
                </div>
                {selected.moves && selected.moves.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">招式</h4>
                      <div className="flex flex-wrap gap-1">
                        {selected.moves.map((m) => (
                          <Badge key={m} variant="secondary">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {selected.holders && selected.holders.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">掌握人物</h4>
                      <div className="flex flex-wrap gap-1">
                        {selected.holders.map((h) => (
                          <Badge key={h} variant="outline">{resolveId(h, characterMap)}</Badge>
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
