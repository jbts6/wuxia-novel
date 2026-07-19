import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import { StatCard } from '../components/common/StatCard';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Swords, Gem, Building2, BookMarked } from 'lucide-react';
import { resolveIds } from '../lib/resolveId';
import { displayTaxonomyValue } from '../lib/displayText';

export default function BookOverview() {
  const currentBookPath = useLibraryStore((state) => state.currentBook);
  const currentBook = useLibraryStore((state) =>
    state.books.find((book) => book.path === currentBookPath),
  );
  const { characters, skills, items, factions, chapterSummaries, factionMap } = useNovelStore();

  if (!currentBook) {
    return <div>书籍未找到</div>;
  }

  const topCharacters = characters.filter((character) => character.level === '核心').slice(0, 10);
  return (
    <div>
      <PageHeader title={currentBook.name} description={currentBook.author} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="人物" value={characters.length} icon={<Users className="h-4 w-4" />} />
        <StatCard title="武功" value={skills.length} icon={<Swords className="h-4 w-4" />} />
        <StatCard title="物品" value={items.length} icon={<Gem className="h-4 w-4" />} />
        <StatCard title="势力" value={factions.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="章节" value={chapterSummaries.length} icon={<BookMarked className="h-4 w-4" />} />
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
                    {char.factions.length > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {resolveIds(char.factions, factionMap).join('、')}
                      </span>
                    )}
                  </div>
                  {char.rank && (
                    <span className="text-sm text-accent">{displayTaxonomyValue(char.rank)}</span>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
