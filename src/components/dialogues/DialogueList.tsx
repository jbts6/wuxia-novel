import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Select, Space, Input, Row, Col, Pagination } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import DialogueCard from '../cards/DialogueCard';

const { Text } = Typography;
const { Search } = Input;

const PAGE_SIZE = 20;

const DialogueList: React.FC = () => {
  const { dialogues, loading } = useNovelStore();
  const [chapterFilter, setChapterFilter] = useState<number | null>(null);
  const [toneFilter, setToneFilter] = useState<string | null>(null);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const chapters = useMemo(() => {
    const uniqueChapters = [...new Set(dialogues.map((d) => d.chapter))];
    return uniqueChapters.sort((a, b) => a - b);
  }, [dialogues]);

  const tones = useMemo(() => {
    const uniqueTones = [...new Set(dialogues.map((d) => d.tone))];
    return uniqueTones.sort();
  }, [dialogues]);

  const speakers = useMemo(() => {
    const uniqueSpeakers = [...new Set(dialogues.map((d) => d.speaker_name))];
    return uniqueSpeakers.sort();
  }, [dialogues]);

  const filteredDialogues = useMemo(() => {
    let filtered = dialogues;

    if (chapterFilter !== null) {
      filtered = filtered.filter((d) => d.chapter === chapterFilter);
    }

    if (toneFilter !== null) {
      filtered = filtered.filter((d) => d.tone === toneFilter);
    }

    if (speakerFilter !== null) {
      filtered = filtered.filter((d) => d.speaker_name === speakerFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.text.toLowerCase().includes(query) ||
          d.speaker_name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [dialogues, chapterFilter, toneFilter, speakerFilter, searchQuery]);

  const pagedDialogues = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDialogues.slice(start, start + PAGE_SIZE);
  }, [filteredDialogues, currentPage]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (dialogues.length === 0) {
    return <Empty description="暂无对话数据" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text>按章节筛选</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择章节"
                  allowClear
                  onChange={(value) => {
                    setChapterFilter(value);
                    setCurrentPage(1);
                  }}
                  options={chapters.map((ch) => ({
                    label: `第${ch}章`,
                    value: ch,
                  }))}
                />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text>按语气筛选</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择语气"
                  allowClear
                  onChange={(value) => {
                    setToneFilter(value);
                    setCurrentPage(1);
                  }}
                  options={tones.map((tone) => ({
                    label: tone,
                    value: tone,
                  }))}
                />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text>按说话者筛选</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择说话者"
                  allowClear
                  onChange={(value) => {
                    setSpeakerFilter(value);
                    setCurrentPage(1);
                  }}
                  options={speakers.map((speaker) => ({
                    label: speaker,
                    value: speaker,
                  }))}
                />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text>搜索内容</Text>
                <Search
                  placeholder="搜索对话内容..."
                  allowClear
                  onSearch={(value) => {
                    setSearchQuery(value);
                    setCurrentPage(1);
                  }}
                />
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            共 {filteredDialogues.length} 条对话
            {chapterFilter !== null && ` · 第${chapterFilter}章`}
            {toneFilter && ` · ${toneFilter}`}
            {speakerFilter && ` · ${speakerFilter}`}
            {searchQuery && ` · 搜索"${searchQuery}"`}
          </Text>
        </div>

        {pagedDialogues.map((dialogue, index) => (
          <DialogueCard
            key={`${dialogue.speaker}-${dialogue.chapter}-${index}`}
            speaker={dialogue.speaker}
            speaker_name={dialogue.speaker_name}
            listener={dialogue.listener}
            text={dialogue.text}
            tone={dialogue.tone}
            chapter={dialogue.chapter}
          />
        ))}

        {filteredDialogues.length > PAGE_SIZE && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              total={filteredDialogues.length}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total) => `共 ${total} 条`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DialogueList;
