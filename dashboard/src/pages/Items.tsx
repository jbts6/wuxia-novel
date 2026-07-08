import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';

export default function Items() {
  const { items, detailPanel, showDetail, hideDetail } = useNovelStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return items.filter((i) => !search || i.name.includes(search));
  }, [items, search]);

  const selected = useMemo(() => {
    if (detailPanel.type === 'item' && detailPanel.id) {
      return items.find((i) => i.id === detailPanel.id);
    }
    return null;
  }, [items, detailPanel]);

  return (
    <div>
      <PageHeader title="兵器谱" description={`共 ${filtered.length} 件物品`}>
        <Input
          placeholder="搜索物品..."
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
              <th className="p-3 text-left font-medium">标签</th>
              <th className="p-3 text-left font-medium">稀有度</th>
              <th className="p-3 text-left font-medium">简介</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                onClick={() => showDetail('item', item.id)}
              >
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3">
                  <Badge variant="outline">{item.type}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {item.tags?.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-sm text-accent">{item.rarity_tier || '-'}</td>
                <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                  {item.one_line || item.description?.slice(0, 50) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={detailPanel.open && detailPanel.type === 'item'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selected && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>类型：{selected.type}</div>
                  <div>稀有度：{selected.rarity_tier || '-'}</div>
                  <div>重要性：{selected.importance || '-'}</div>
                </div>
                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                )}
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selected.one_line || selected.description || '暂无简介'}</p>
                </div>
                {selected.effects && selected.effects.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">效果</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {selected.effects.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
                {selected.related_characters && selected.related_characters.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">关联人物</h4>
                      <div className="flex flex-wrap gap-1">
                        {selected.related_characters.map((c) => (
                          <Badge key={c} variant="outline">{c}</Badge>
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
