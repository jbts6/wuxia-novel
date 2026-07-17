import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { resolveIds } from '../lib/resolveId';
import { useNovelStore } from '../stores/useNovelStore';

export default function ChapterSummaries() {
  const { chapterSummaries, characterMap } = useNovelStore();

  return (
    <div>
      <PageHeader
        title="章回录"
        description={`共 ${chapterSummaries.length} 章`}
      />

      <div className="mt-3 space-y-4">
        {chapterSummaries.map((chapter) => {
          const keyCharacterNames = resolveIds(chapter.key_characters, characterMap);
          return <Card key={chapter.chapter}>
            <CardHeader>
              <CardTitle className="font-serif">
                {chapter.title || `第${chapter.chapter}章`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">{chapter.summary}</p>
              {chapter.key_events.length > 0 && (
                <div className="mb-3">
                  <h4 className="mb-1 text-sm font-medium">关键事件</h4>
                  <div className="flex flex-wrap gap-1">
                    {chapter.key_events.map((event, index) => (
                      <Badge key={index} variant="secondary">{event}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {keyCharacterNames.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">关键人物</h4>
                  <div className="flex flex-wrap gap-1">
                    {keyCharacterNames.map((name) => (
                      <Badge key={name} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>;
        })}
      </div>
    </div>
  );
}
