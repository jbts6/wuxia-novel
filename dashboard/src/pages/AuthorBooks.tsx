import { Link, useParams } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BookOpen, Users, Swords, Gem, Building2, MapPin, ArrowLeft } from 'lucide-react';

export default function AuthorBooks() {
  const { authorName } = useParams<{ authorName: string }>();
  const { books } = useLibraryStore();

  const decodedAuthor = authorName ? decodeURIComponent(authorName) : '';
  const authorBooks = books.filter((b) => b.author === decodedAuthor);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            返回书库
          </Link>
          <h1 className="font-serif text-3xl font-bold text-foreground">{decodedAuthor}</h1>
          <p className="mt-2 text-muted-foreground">共 {authorBooks.length} 部作品</p>
        </div>

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
    </div>
  );
}
