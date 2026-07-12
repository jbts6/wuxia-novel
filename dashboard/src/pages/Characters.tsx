import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { resolveId } from '../lib/resolveId';

export default function Characters() {
  const { characters, factionMap, characterMap, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [factionFilter, setFactionFilter] = useState<string[]>([]);
  const [rankFilter, setRankFilter] = useState<string[]>([]);

  const roleOptions = useMemo(() => [
    { value: '核心', label: '核心' },
    { value: '重要', label: '重要' },
    { value: '次要', label: '次要' },
    { value: '龙套', label: '龙套' },
  ], []);

  const factionOptions = useMemo(() => {
    const set = new Set(characters.map((c) => c.faction).filter(Boolean));
    return Array.from(set).sort().map((id) => ({ value: id!, label: factionMap.get(id!) || id! }));
  }, [characters, factionMap]);

  const rankOptions = useMemo(() => {
    const set = new Set(characters.map((c) => c.power_rank).filter(Boolean));
    return Array.from(set).sort().map((r) => ({ value: r!, label: r! }));
  }, [characters]);

  const filtered = useMemo(() => {
    return characters.filter((c) => {
      const matchSearch =
        !search ||
        c.name.includes(search) ||
        c.alias?.some((a) => a.includes(search)) ||
        c.identity?.includes(search);
      const matchRole = roleFilter.length === 0 || roleFilter.includes(c.role);
      const matchFaction = factionFilter.length === 0 || (c.faction && factionFilter.includes(c.faction));
      const matchRank = rankFilter.length === 0 || (c.power_rank && rankFilter.includes(c.power_rank));
      return matchSearch && matchRole && matchFaction && matchRank;
    });
  }, [characters, search, roleFilter, factionFilter, rankFilter]);

  const selectedCharacter = useMemo(() => {
    if (detailPanel.type === 'character' && detailPanel.id) {
      return characters.find((c) => c.id === detailPanel.id);
    }
    return null;
  }, [characters, detailPanel]);
  const personalityTraits = selectedCharacter?.personality?.traits ?? [];
  const relationships = selectedCharacter?.relationships ?? [];

  return (
    <div>
      <PageHeader title="人物志" description={`共 ${filtered.length} 人`}>
        <div className="flex gap-2">
          <Input
            placeholder="搜索姓名/别名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <MultiSearchableSelect
            className="w-48"
            options={roleOptions}
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="身份"
            searchPlaceholder="搜索身份..."
            maxDisplay={2}
          />
          <MultiSearchableSelect
            className="w-48"
            options={factionOptions}
            value={factionFilter}
            onChange={setFactionFilter}
            placeholder="门派"
            searchPlaceholder="搜索门派..."
            maxDisplay={2}
          />
          <MultiSearchableSelect
            className="w-48"
            options={rankOptions}
            value={rankFilter}
            onChange={setRankFilter}
            placeholder="境界"
            searchPlaceholder="搜索境界..."
            maxDisplay={2}
          />
        </div>
      </PageHeader>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">姓名</th>
              <th className="p-3 text-left font-medium">别名</th>
              <th className="p-3 text-left font-medium">身份</th>
              <th className="p-3 text-left font-medium">门派</th>
              <th className="p-3 text-left font-medium">境界</th>
              <th className="p-3 text-left font-medium">简介</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((char) => (
              <tr
                key={char.id}
                className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                onClick={() => showDetail('character', char.id)}
              >
                <td className="p-3 font-medium">{char.name}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {char.alias?.join(', ') || '-'}
                </td>
                <td className="p-3">
                  <Badge variant="outline">{char.role}</Badge>
                </td>
                <td className="p-3 text-sm">{resolveId(char.faction, factionMap)}</td>
                <td className="p-3 text-sm text-accent">{char.power_rank || '-'}</td>
                <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                  {char.one_line || char.identity || char.bio?.slice(0, 50) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'character'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selectedCharacter && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selectedCharacter.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="mb-2 font-medium">基本信息</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>身份：{selectedCharacter.identity || '-'}</div>
                    <div>门派：{resolveId(selectedCharacter.faction, factionMap)}</div>
                    <div>境界：{selectedCharacter.power_rank || '-'}</div>
                    <div>类型：{selectedCharacter.archetype || '-'}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">性格特征</h4>
                  <div className="flex flex-wrap gap-1">
                    {personalityTraits.length > 0 ? (
                      personalityTraits.map((trait) => (
                        <Badge key={trait} variant="secondary">{trait}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">暂无性格标注</span>
                    )}
                  </div>
                  {selectedCharacter.personality?.temperament && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      气质：{selectedCharacter.personality.temperament}
                    </p>
                  )}
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selectedCharacter.one_line || selectedCharacter.bio || '暂无简介'}</p>
                </div>
                {relationships.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">人物关系</h4>
                      <div className="space-y-2">
                        {relationships.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{resolveId(r.target, characterMap)}</span>
                            <Badge variant="outline">{r.type}</Badge>
                          </div>
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
