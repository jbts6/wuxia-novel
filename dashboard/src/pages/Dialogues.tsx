import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';

export default function Dialogues() {
  const { dialogues } = useNovelStore();
  const [search, setSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState<string>('all');

  const chapters = useMemo(() => {
    const set = new Set(dialogues.map((d) => d.chapter));
    return Array.from(set).sort((a, b) => a - b);
  }, [dialogues]);

  const filtered = useMemo(() => {
    return dialogues.filter((d) => {
      const matchSearch =
        !search ||
        d.speaker.includes(search) ||
        d.text.includes(search);
      const matchChapter =
        chapterFilter === 'all' || d.chapter === Number(chapterFilter);
      return matchSearch && matchChapter;
    });
  }, [dialogues, search, chapterFilter]);

  return (
    <div>
      <PageHeader title="对话集" description={`共 ${filtered.length} 条对话`}>
        <div className="flex gap-2">
          <Input
            placeholder="搜索说话者/内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={chapterFilter} onValueChange={(value) => setChapterFilter(value ?? 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="章节" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部章节</SelectItem>
              {chapters.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  第{c}章
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="space-y-3">
        {filtered.map((dialogue, index) => (
          <Card key={`${dialogue.chapter}-${dialogue.line_start}-${index}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-medium">
                  {(dialogue.speaker_name || dialogue.speaker)[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{dialogue.speaker_name || dialogue.speaker}</span>
                    <Badge variant="outline" className="text-xs">
                      第{dialogue.chapter}章
                    </Badge>
                    {dialogue.tone && (
                      <Badge variant="secondary" className="text-xs">
                        {dialogue.tone}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{dialogue.text}</p>
                  {dialogue.context && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      {dialogue.context}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
