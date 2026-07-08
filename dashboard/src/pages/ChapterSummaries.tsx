import { useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function ChapterSummaries() {
  const { chapterSummaries, characters } = useNovelStore();

  // 创建人物ID到名称的映射
  const characterMap = useMemo(() => {
    const map = new Map<string, string>();
    characters.forEach((c) => {
      map.set(c.id, c.name);
    });
    return map;
  }, [characters]);

  return (
    <div>
      <PageHeader title="章回录" description={`共 ${chapterSummaries.length} 章`} />

      <div className="space-y-4">
        {chapterSummaries.map((chapter) => (
          <Card key={chapter.chapter}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Badge variant="outline">第{chapter.chapter}章</Badge>
                {chapter.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{chapter.summary}</p>
              {chapter.key_events.length > 0 && (
                <div className="mb-3">
                  <h4 className="mb-1 text-sm font-medium">关键事件</h4>
                  <div className="flex flex-wrap gap-1">
                    {chapter.key_events.map((e, i) => (
                      <Badge key={i} variant="secondary">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {chapter.key_characters.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">关键人物</h4>
                  <div className="flex flex-wrap gap-1">
                    {chapter.key_characters.map((c) => (
                      <Badge key={c} variant="outline">
                        {characterMap.get(c) || c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
