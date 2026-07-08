import { Link } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BookOpen, Users, Swords, Gem, Building2, MapPin } from 'lucide-react';
import { useMemo } from 'react';

export default function Library() {
  const { books } = useLibraryStore();

  // 按作者分组
  const groupedByAuthor = useMemo(() => {
    const groups = new Map<string, typeof books>();
    books.forEach((book) => {
      const existing = groups.get(book.author) || [];
      groups.set(book.author, [...existing, book]);
    });
    return groups;
  }, [books]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">武侠知识库</h1>
          <p className="mt-2 text-muted-foreground">探索经典武侠小说的世界</p>
        </div>

        {Array.from(groupedByAuthor.entries()).map(([author, authorBooks]) => (
          <div key={author} className="mb-10">
            <Link to={`/${author}`} className="inline-block mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground hover:text-accent transition-colors">
                {author}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({authorBooks.length} 部)
                </span>
              </h2>
            </Link>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {authorBooks.map((book) => {
                const stats = {
                  characters: book.data.characters.length,
                  skills: book.data.skills.length,
                  items: book.data.items.length,
                  factions: book.data.factions.length,
                  locations: book.data.locations.length,
                };

                return (
                  <Link key={book.path} to={`/${book.path}/overview`}>
                    <Card className="transition-shadow hover:shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-serif">
                          <BookOpen className="h-5 w-5 text-accent" />
                          {book.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.characters}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Swords className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.skills}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Gem className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.items}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.factions}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.locations}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
