import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';

export default function Dialogues() {
  const { dialogues } = useNovelStore();
  const [search, setSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState<string[]>([]);
  const [toneFilter, setToneFilter] = useState<string[]>([]);

  const chapterOptions = useMemo(() => {
    const set = new Set(dialogues.map((d) => d.chapter));
    return Array.from(set).sort((a, b) => a - b).map((c) => ({ value: String(c), label: `第${c}章` }));
  }, [dialogues]);

  const toneOptions = useMemo(() => {
    const set = new Set(dialogues.map((d) => d.tone).filter(Boolean));
    return Array.from(set).sort().map((t) => ({ value: t!, label: t! }));
  }, [dialogues]);

  const filteredDialogues = useMemo(() => {
    return dialogues.filter((d) => {
      const speakerName = d.speaker_name || d.speaker;
      const matchSearch =
        !search ||
        speakerName.includes(search) ||
        d.text.includes(search);
      const matchChapter =
        chapterFilter.length === 0 || chapterFilter.includes(String(d.chapter));
      const matchTone =
        toneFilter.length === 0 || (d.tone && toneFilter.includes(d.tone));
      return matchSearch && matchChapter && matchTone;
    });
  }, [dialogues, search, chapterFilter, toneFilter]);

  const chapterGroups = useMemo(() => {
    const groups = new Map<number, typeof filteredDialogues>();
    for (const d of filteredDialogues) {
      const existing = groups.get(d.chapter) || [];
      existing.push(d);
      groups.set(d.chapter, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [filteredDialogues]);

  return (
    <div>
      <PageHeader title="对话集" description={`共 ${filteredDialogues.length} 条对话，${chapterGroups.length} 章`}>
        <div className="flex gap-2">
          <Input
            placeholder="搜索说话者/内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <MultiSearchableSelect
            className="w-48"
            options={chapterOptions}
            value={chapterFilter}
            onChange={setChapterFilter}
            placeholder="章节"
            searchPlaceholder="搜索章节..."
            maxDisplay={2}
          />
          <MultiSearchableSelect
            className="w-48"
            options={toneOptions}
            value={toneFilter}
            onChange={setToneFilter}
            placeholder="语气"
            searchPlaceholder="搜索语气..."
            maxDisplay={2}
          />
        </div>
      </PageHeader>

      <div className="space-y-4">
        {chapterGroups.map(([chapter, dialogues]) => (
          <Card key={chapter}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span>第{chapter}章</span>
                <Badge variant="secondary" className="text-xs">
                  {dialogues.length} 条对话
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {dialogues.map((dialogue, index) => (
                  <div key={`${dialogue.line_start}-${index}`}>
                    {index > 0 && <Separator className="mb-3" />}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{dialogue.speaker_name || dialogue.speaker}</span>
                        {dialogue.tone && (
                          <Badge variant="outline" className="text-xs">
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
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
