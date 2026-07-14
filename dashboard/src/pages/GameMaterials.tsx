import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useCurrentBookExtras } from '../hooks/useCurrentBookExtras';
import { buildGameMaterialSourceIndex, resolveGameMaterialSource } from '../lib/gameMaterialSources';
import { getGameMaterialViewState } from '../lib/gameMaterialViewState';
import { useNovelStore } from '../stores/useNovelStore';
import { GAME_MATERIAL_TYPES, type GameMaterialType } from '../types/novel';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

type MaterialTypeFilter = 'all' | GameMaterialType;

export default function GameMaterials() {
  const { authorName, bookName } = useParams<{ authorName: string; bookName: string }>();
  const decodedAuthor = authorName ? decodeURIComponent(authorName) : '';
  const decodedBook = bookName ? decodeURIComponent(bookName) : '';
  const { extras, isLoading, error } = useCurrentBookExtras();
  const { characters, skills, techniques, items, factions, locations } = useNovelStore();
  const [materialType, setMaterialType] = useState<MaterialTypeFilter>('all');
  const [relevance, setRelevance] = useState('all');

  const materialsResource = extras?.gameMaterials;
  const entries = useMemo(
    () => (materialsResource?.status === 'available' ? materialsResource.data.entries : []),
    [materialsResource],
  );
  const eventsResource = extras?.events;
  const events = useMemo(
    () => (eventsResource?.status === 'available' ? eventsResource.data : []),
    [eventsResource],
  );
  const sourceIndex = useMemo(() => buildGameMaterialSourceIndex({
    authorName: decodedAuthor,
    bookName: decodedBook,
    characters,
    skills,
    techniques,
    items,
    factions,
    locations,
    events,
  }), [characters, decodedAuthor, decodedBook, events, factions, items, locations, skills, techniques]);

  const relevanceOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.relevance).filter(Boolean))].sort(),
    [entries],
  );
  const filteredEntries = useMemo(() => entries.filter((entry) => (
    (materialType === 'all' || entry.material_type === materialType)
    && (relevance === 'all' || entry.relevance === relevance)
  )), [entries, materialType, relevance]);

  const state = getGameMaterialViewState(extras, isLoading, error);
  const description = state === 'available'
    ? `${entries.length} 条游戏素材`
    : state === 'loading'
      ? '正在加载'
      : state === 'missing'
        ? '尚未生成'
        : '读取失败';

  return (
    <div>
      <PageHeader title="游戏素材" description={description} />

      {state === 'loading' && (
        <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">正在加载游戏素材</p>
      )}
      {state === 'unavailable' && (
        <p className="rounded-md border border-destructive/50 p-8 text-center text-sm text-destructive">
          游戏素材暂时不可用：{error}
        </p>
      )}
      {state === 'missing' && (
        <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">本书尚未生成游戏素材</p>
      )}
      {state === 'invalid' && materialsResource?.status === 'invalid' && (
        <p className="rounded-md border border-destructive/50 p-8 text-center text-sm text-destructive">
          游戏素材读取错误：{materialsResource.error}
        </p>
      )}

      {state === 'available' && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">素材类型</span>
              <select
                aria-label="素材类型"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={materialType}
                onChange={(event) => setMaterialType(event.target.value as MaterialTypeFilter)}
              >
                <option value="all">全部类型</option>
                {GAME_MATERIAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">重要度</span>
              <select
                aria-label="重要度"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={relevance}
                onChange={(event) => setRelevance(event.target.value)}
              >
                <option value="all">全部重要度</option>
                {relevanceOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <span className="pb-2 text-xs text-muted-foreground">
              显示 {filteredEntries.length} / {entries.length}
            </span>
          </div>

          {entries.length === 0 ? (
            <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">当前报告包含 0 条游戏素材</p>
          ) : filteredEntries.length === 0 ? (
            <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">没有符合当前筛选条件的素材</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredEntries.map((entry, index) => {
                const source = resolveGameMaterialSource(entry.source_id, sourceIndex);
                return (
                  <Card key={`${entry.material_type}-${entry.source_id}-${index}`} data-testid="game-material-card">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {source.status === 'resolved' ? source.name : '来源不可解析'}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{entry.material_type}</Badge>
                        <Badge variant="secondary">{entry.relevance}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">推荐用途</h3>
                        <p className="mt-1 text-sm leading-6">{entry.suggested_use}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">入选理由</h3>
                        <p className="mt-1 text-sm leading-6">{entry.reason}</p>
                      </div>
                      {source.status === 'resolved' ? (
                        <Link
                          to={source.href}
                          aria-label={`打开来源：${source.name}`}
                          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          打开来源
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground opacity-70"
                        >
                          来源不可解析
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
