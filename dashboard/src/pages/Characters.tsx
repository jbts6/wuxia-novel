import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';

export default function Characters() {
  const { characters, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [factionFilter, setFactionFilter] = useState<string>('all');

  const factions = useMemo(() => {
    const set = new Set(characters.map((c) => c.faction).filter(Boolean));
    return Array.from(set).sort();
  }, [characters]);

  const filtered = useMemo(() => {
    return characters.filter((c) => {
      const matchSearch =
        !search ||
        c.name.includes(search) ||
        c.aliases?.some((a) => a.includes(search)) ||
        c.identity?.includes(search);
      const matchRole = roleFilter === 'all' || c.role === roleFilter;
      const matchFaction = factionFilter === 'all' || c.faction === factionFilter;
      return matchSearch && matchRole && matchFaction;
    });
  }, [characters, search, roleFilter, factionFilter]);

  const selectedCharacter = useMemo(() => {
    if (detailPanel.type === 'character' && detailPanel.id) {
      return characters.find((c) => c.id === detailPanel.id);
    }
    return null;
  }, [characters, detailPanel]);

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
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="身份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部身份</SelectItem>
              <SelectItem value="核心">核心</SelectItem>
              <SelectItem value="重要">重要</SelectItem>
              <SelectItem value="次要">次要</SelectItem>
              <SelectItem value="龙套">龙套</SelectItem>
            </SelectContent>
          </Select>
          <Select value={factionFilter} onValueChange={(value) => setFactionFilter(value ?? 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="门派" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部门派</SelectItem>
              {factions.map((f) => (
                <SelectItem key={f} value={f!}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  {char.aliases?.join(', ') || '-'}
                </td>
                <td className="p-3">
                  <Badge variant="outline">{char.role}</Badge>
                </td>
                <td className="p-3 text-sm">{char.faction || '-'}</td>
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
                    <div>门派：{selectedCharacter.faction || '-'}</div>
                    <div>境界：{selectedCharacter.power_rank || '-'}</div>
                    <div>类型：{selectedCharacter.archetype || '-'}</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">性格特征</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCharacter.personality.traits.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                  {selectedCharacter.personality.temperament && (
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
                {selectedCharacter.relationships.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">人物关系</h4>
                      <div className="space-y-2">
                        {selectedCharacter.relationships.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{r.target}</span>
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
