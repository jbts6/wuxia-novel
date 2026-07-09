import { useBookData } from '../hooks/useBookData';
import { useNovelStore } from '../stores/useNovelStore';
import { StatCard } from '../components/common/StatCard';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Swords, Gem, Building2, MapPin, BookMarked, MessageSquare } from 'lucide-react';
import { resolveId } from '../lib/resolveId';

export default function BookOverview() {
  const { currentBook } = useBookData();
  const { characters, skills, items, factions, locations, chapterSummaries, dialogues, factionMap, locationMap } =
    useNovelStore();

  if (!currentBook) {
    return <div>书籍未找到</div>;
  }

  const topCharacters = characters.filter((c) => c.role === '核心').slice(0, 10);

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
                        {resolveId(char.faction, factionMap)}
                      </span>
                    )}
                  </div>
                  {char.power_rank && (
                    <span className="text-sm text-accent">{char.power_rank}</span>
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
                      {faction.type}
                    </span>
                  </div>
                  {faction.location && (
                    <span className="text-sm text-muted-foreground">
                      {resolveId(faction.location, locationMap)}
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
