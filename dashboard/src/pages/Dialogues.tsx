import { useState, useMemo } from 'react';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { PaginationControls } from '../components/common/PaginationControls';
import { resolveEntityName } from '../lib/resolveId';
import type { Dialogue } from '../types/novel';
import { displayTaxonomyValue } from '../lib/displayText';

const PAGE_SIZE = 100;

function resolveSpeakerName(dialogue: Dialogue, characterMap: Map<string, string>): string {
  return resolveEntityName(dialogue.speaker_name, characterMap)
    ?? resolveEntityName(dialogue.speaker, characterMap)
    ?? '未知人物';
}

export default function Dialogues() {
  const { dialogues, characterMap } = useNovelStore();
  const [search, setSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState<string[]>([]);
  const [toneFilter, setToneFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const chapterOptions = useMemo(() => {
    const set = new Set(dialogues.map((d) => d.chapter));
    return Array.from(set).sort((a, b) => a - b).map((c) => ({ value: String(c), label: `第${c}章` }));
  }, [dialogues]);

  const toneOptions = useMemo(() => {
    const set = new Set(dialogues.map((d) => d.tone).filter(Boolean));
    return Array.from(set).sort().map((t) => ({ value: t!, label: displayTaxonomyValue(t!) }));
  }, [dialogues]);

  const filteredDialogues = useMemo(() => {
    return dialogues.filter((d) => {
      const speakerName = resolveSpeakerName(d, characterMap);
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
  }, [characterMap, dialogues, search, chapterFilter, toneFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDialogues.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleDialogues = filteredDialogues.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chapterGroups = useMemo(() => {
    const groups = new Map<number, typeof visibleDialogues>();
    for (const d of visibleDialogues) {
      const existing = groups.get(d.chapter) || [];
      existing.push(d);
      groups.set(d.chapter, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [visibleDialogues]);

  return (
    <div>
      <PageHeader title="对话集" description={`共 ${filteredDialogues.length} 条对话，当前第 ${currentPage}/${totalPages} 页`}>
        <div className="flex gap-2">
          <Input
            placeholder="搜索说话者/内容..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-48"
          />
          <MultiSearchableSelect
            className="w-48"
            options={chapterOptions}
            value={chapterFilter}
            onChange={(value) => {
              setChapterFilter(value);
              setPage(1);
            }}
            placeholder="章节"
            searchPlaceholder="搜索章节..."
            maxDisplay={2}
          />
          <MultiSearchableSelect
            className="w-48"
            options={toneOptions}
            value={toneFilter}
            onChange={(value) => {
              setToneFilter(value);
              setPage(1);
            }}
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
                  <div key={`${dialogue.line_start}-${index}`} data-dialogue-row>
                    {index > 0 && <Separator className="mb-3" />}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{resolveSpeakerName(dialogue, characterMap)}</span>
                        {dialogue.tone && (
                          <Badge variant="outline" className="text-xs">
                            {displayTaxonomyValue(dialogue.tone)}
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

      <div className="mt-4 overflow-hidden rounded-md border bg-card">
        <PaginationControls
          page={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={filteredDialogues.length}
          itemLabel="条对话"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
