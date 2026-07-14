import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNovelStore } from '../stores/useNovelStore';
import { useCurrentBookExtras } from '../hooks/useCurrentBookExtras';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { resolveIds } from '../lib/resolveId';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function ChapterSummaries() {
  const {
    chapterSummaries,
    characterMap,
    locationMap,
    detailPanel,
    showDetail,
    hideDetail,
  } = useNovelStore();
  const { extras, isLoading, error } = useCurrentBookExtras();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'events' ? 'events' : 'summaries';
  const eventsResource = extras?.events;
  const events = useMemo(
    () => (eventsResource?.status === 'available' ? eventsResource.data : []),
    [eventsResource],
  );

  useEntityDetailParam('event', events);

  const selectedEvent = useMemo(() => {
    if (detailPanel.type === 'event' && detailPanel.id) {
      return events.find((event) => event.id === detailPanel.id);
    }
    return null;
  }, [detailPanel, events]);

  const handleViewChange = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    if (value === 'events') {
      next.set('view', 'events');
    } else {
      next.delete('view');
    }
    hideDetail();
    setSearchParams(next);
  };

  const eventState = isLoading
    ? 'loading'
    : error
      ? 'unavailable'
      : !extras
        ? 'loading'
        : eventsResource?.status ?? 'missing';

  return (
    <div>
      <PageHeader
        title="章回录"
        description={activeView === 'events' ? `共 ${events.length} 个关键事件` : `共 ${chapterSummaries.length} 章`}
      />

      <Tabs value={activeView} onValueChange={handleViewChange}>
        <TabsList aria-label="章回视图">
          <TabsTrigger value="summaries">章节摘要</TabsTrigger>
          <TabsTrigger value="events">关键事件</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeView === 'events' ? (
        <div className="mt-3 space-y-4">
          {eventState === 'loading' && (
            <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">正在加载关键事件</p>
          )}
          {eventState === 'unavailable' && (
            <p className="rounded-md border border-destructive/50 p-8 text-center text-sm text-destructive">
              关键事件暂时不可用：{error}
            </p>
          )}
          {eventState === 'missing' && (
            <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">本书尚未生成关键事件</p>
          )}
          {eventState === 'invalid' && eventsResource?.status === 'invalid' && (
            <p className="rounded-md border border-destructive/50 p-8 text-center text-sm text-destructive">
              关键事件读取错误：{eventsResource.error}
            </p>
          )}
          {eventState === 'available' && events.length === 0 && (
            <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">暂无关键事件</p>
          )}
          {eventState === 'available' && events.map((event) => {
            const participantNames = resolveIds(event.participants, characterMap);
            const locationNames = resolveIds(event.locations, locationMap);
            return (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-serif">
                      <button
                        type="button"
                        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => showDetail('event', event.id)}
                      >
                        {event.name}
                      </button>
                    </CardTitle>
                    {event.importance && <Badge variant="outline">{event.importance}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{event.process || event.cause || '暂无过程摘要'}</p>
                  {participantNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">参与者</span>
                      {participantNames.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                    </div>
                  )}
                  {locationNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">地点</span>
                      {locationNames.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                    </div>
                  )}
                  {event.source_refs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">章节证据</span>
                      {event.source_refs.map((ref, index) => (
                        <Badge key={`${ref.chapter}-${index}`} variant="outline">第 {ref.chapter} 章</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
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
                      {chapter.key_events.map((e, i) => (
                        <Badge key={i} variant="secondary">{e}</Badge>
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
      )}

      <Sheet open={detailPanel.open && detailPanel.type === 'event'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selectedEvent && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selectedEvent.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>重要性：{selectedEvent.importance || '未注明'}</div>
                  <div>结果：{selectedEvent.result || '未注明'}</div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">起因</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.cause || '暂无起因'}</p>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">过程</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.process || '暂无过程'}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">参与者</span>
                  {resolveIds(selectedEvent.participants, characterMap).map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">地点</span>
                  {resolveIds(selectedEvent.locations, locationMap).map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">章节证据</h4>
                  <div className="space-y-3">
                    {selectedEvent.source_refs.map((ref, index) => (
                      <div key={`${ref.chapter}-${index}`} className="border-l-2 border-border pl-3">
                        <div className="text-xs text-muted-foreground">第 {ref.chapter} 章</div>
                        <p className="mt-1 text-sm leading-6 text-foreground">
                          {ref.text || ref.anchor || '来源已定位，暂无摘录文本'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
