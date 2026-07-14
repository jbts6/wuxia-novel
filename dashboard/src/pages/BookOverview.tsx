import { Link } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import { useCurrentBookExtras } from '../hooks/useCurrentBookExtras';
import { StatCard } from '../components/common/StatCard';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Swords, Gem, Building2, MapPin, BookMarked, MessageSquare, ArrowUpRight } from 'lucide-react';
import { resolveId } from '../lib/resolveId';
import { displayTaxonomyValue } from '../lib/displayText';
import { getGameMaterialViewState } from '../lib/gameMaterialViewState';
import { GAME_MATERIAL_TYPES } from '../types/novel';

export default function BookOverview() {
  const currentBookPath = useLibraryStore((state) => state.currentBook);
  const currentBook = useLibraryStore((state) =>
    state.books.find((book) => book.path === currentBookPath),
  );
  const { characters, skills, items, factions, locations, chapterSummaries, dialogues, factionMap, locationMap } =
    useNovelStore();
  const { extras, isLoading: extrasLoading, error: extrasError } = useCurrentBookExtras();

  if (!currentBook) {
    return <div>书籍未找到</div>;
  }

  const topCharacters = characters.filter((c) => c.role === '核心').slice(0, 10);
  const gameMaterialsResource = extras?.gameMaterials;
  const gameMaterialsState = getGameMaterialViewState(extras, extrasLoading, extrasError);
  const gameMaterials = gameMaterialsResource?.status === 'available' ? gameMaterialsResource.data.entries : [];
  const gameMaterialCounts = new Map(
    GAME_MATERIAL_TYPES.map((type) => [
      type,
      gameMaterials.filter((entry) => entry.material_type === type).length,
    ]),
  );
  const gameMaterialsHref = `/${encodeURIComponent(currentBook.author)}/${encodeURIComponent(currentBook.name)}/game-materials`;

  return (
    <div>
      <PageHeader title={currentBook.name} description={currentBook.author} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="人物" value={characters.length} icon={<Users className="h-4 w-4" />} />
        <StatCard title="武功" value={skills.length} icon={<Swords className="h-4 w-4" />} />
        <StatCard title="物品" value={items.length} icon={<Gem className="h-4 w-4" />} />
        <StatCard title="势力" value={factions.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="地点" value={locations.length} icon={<MapPin className="h-4 w-4" />} />
        <StatCard title="章节" value={chapterSummaries.length} icon={<BookMarked className="h-4 w-4" />} />
        <StatCard title="对话" value={dialogues.length} icon={<MessageSquare className="h-4 w-4" />} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif">
            <h2>游戏素材</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gameMaterialsState === 'loading' && (
            <p className="text-sm text-muted-foreground">正在加载游戏素材</p>
          )}
          {gameMaterialsState === 'unavailable' && (
            <p className="text-sm text-destructive">游戏素材暂时不可用：{extrasError}</p>
          )}
          {gameMaterialsState === 'missing' && (
            <p className="text-sm text-muted-foreground">本书尚未生成游戏素材</p>
          )}
          {gameMaterialsState === 'invalid' && gameMaterialsResource?.status === 'invalid' && (
            <p className="text-sm text-destructive">游戏素材读取错误：{gameMaterialsResource.error}</p>
          )}
          {gameMaterialsState === 'available' && (
            <>
              <p className="text-sm font-medium">{gameMaterials.length} 条游戏素材</p>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {GAME_MATERIAL_TYPES.map((type) => (
                  <div key={type} className="border-l-2 border-border pl-3">
                    <dt className="text-xs text-muted-foreground">{type}</dt>
                    <dd className="mt-1 text-lg font-semibold">{gameMaterialCounts.get(type)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <Link
            to={gameMaterialsHref}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            查看全部游戏素材
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">核心人物</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCharacters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                >
                  <div>
                    <span className="font-medium">{char.name}</span>
                    {char.faction && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {resolveId(char.faction, factionMap, '未注明势力')}
                      </span>
                    )}
                  </div>
                  {char.power_rank && (
                    <span className="text-sm text-accent">{displayTaxonomyValue(char.power_rank)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">重要势力</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {factions.slice(0, 10).map((faction) => (
                <div
                  key={faction.id}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                >
                  <div>
                    <span className="font-medium">{faction.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {displayTaxonomyValue(faction.type)}
                    </span>
                  </div>
                  {faction.location && (
                    <span className="text-sm text-muted-foreground">
                      {resolveId(faction.location, locationMap, '未注明地点')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
