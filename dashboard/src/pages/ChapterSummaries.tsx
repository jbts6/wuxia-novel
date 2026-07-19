import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useNovelStore } from '../stores/useNovelStore';

export default function ChapterSummaries() {
  const { chapterSummaries } = useNovelStore();

  return (
    <div>
      <PageHeader
        title="章回录"
        description={`共 ${chapterSummaries.length} 章`}
      />

      <div className="mt-3 space-y-4">
        {chapterSummaries.map((chapter) => <Card key={chapter.chapter}>
            <CardHeader>
              <CardTitle className="font-serif">
                {chapter.title || `第${chapter.chapter}章`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">{chapter.summary}</p>
            </CardContent>
          </Card>)}
      </div>
    </div>
  );
}
