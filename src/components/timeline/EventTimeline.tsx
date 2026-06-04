import React, { useMemo } from 'react';
import { Card, Timeline, Tag, Typography, Empty, Spin, Select, Space } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

const EventTimeline: React.FC = () => {
  const { events, characters, locations, showDetail, loading } = useNovelStore();
  const [chapterFilter, setChapterFilter] = React.useState<number | null>(null);

  const groupedEvents = useMemo(() => {
    let filtered = events;
    if (chapterFilter !== null) {
      filtered = events.filter((e) => e.chapter === chapterFilter);
    }

    const groups: Record<number, typeof events> = {};
    filtered.forEach((event) => {
      if (!groups[event.chapter]) {
        groups[event.chapter] = [];
      }
      groups[event.chapter].push(event);
    });

    return Object.entries(groups)
      .map(([chapter, events]) => ({
        chapter: parseInt(chapter),
        events,
      }))
      .sort((a, b) => a.chapter - b.chapter);
  }, [events, chapterFilter]);

  const chapters = useMemo(() => {
    const uniqueChapters = [...new Set(events.map((e) => e.chapter))];
    return uniqueChapters.sort((a, b) => a - b);
  }, [events]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (events.length === 0) {
    return <Empty description="暂无事件数据" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <Space>
          <Text>按章节筛选：</Text>
          <Select
            style={{ width: 200 }}
            placeholder="选择章节"
            allowClear
            onChange={(value) => setChapterFilter(value)}
            options={chapters.map((ch) => ({
              label: `第${ch}章`,
              value: ch,
            }))}
          />
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groupedEvents.map(({ chapter, events: chapterEvents }) => (
          <div key={chapter} style={{ marginBottom: 24 }}>
            <Card
              size="small"
              title={
                <span>
                  <BookOutlined style={{ marginRight: 8 }} />
                  第{chapter}章
                  <Tag style={{ marginLeft: 8 }}>{chapterEvents.length}个事件</Tag>
                </span>
              }
              style={{ marginBottom: 12 }}
            >
              <Timeline
                items={chapterEvents.map((event) => ({
                  content: (
                    <Card
                      size="small"
                      hoverable
                      onClick={() => showDetail('event', event.id)}
                      style={{ marginBottom: 8 }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>{event.name}</Text>
                      </div>
                      <Paragraph
                        ellipsis={{ rows: 2, expandable: true }}
                        style={{ marginBottom: 8 }}
                      >
                        {event.description}
                      </Paragraph>
                      <div>
                        {event.participants.map((p) => {
                          const char = characters.find((c) => c.id === p);
                          return char ? (
                            <Tag
                              key={p}
                              color={
                                char.role === 'protagonist'
                                  ? 'blue'
                                  : char.role === 'villain'
                                  ? 'red'
                                  : 'default'
                              }
                              style={{ cursor: 'pointer', marginBottom: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                showDetail('character', p);
                              }}
                            >
                              {char.name}
                            </Tag>
                          ) : null;
                        })}
                        {event.location && (() => {
                          const loc = locations.find((l) => l.id === event.location);
                          return loc ? (
                            <Tag
                              color="purple"
                              style={{ cursor: 'pointer', marginBottom: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                showDetail('location', event.location!);
                              }}
                            >
                              {loc.name}
                            </Tag>
                          ) : null;
                        })()}
                      </div>
                    </Card>
                  ),
                }))}
              />
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventTimeline;
