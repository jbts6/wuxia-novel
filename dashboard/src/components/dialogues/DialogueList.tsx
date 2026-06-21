import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Card, Typography, Empty, Spin, Select, Space, Input, Row, Col, Pagination, FloatButton } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import DialogueCard from '../cards/DialogueCard';
import { CINNABAR, PIGMENT } from '../../theme/palette';

const { Text } = Typography;
const { Search } = Input;

// 非「我方」说话者的头像配色（赭石/竹青/黛蓝/黛紫/青/石灰循环）
const OTHER_AVATAR_COLORS = [
  PIGMENT.indigo,
  PIGMENT.celadon,
  PIGMENT.ochre,
  PIGMENT.violet,
  PIGMENT.cyan,
  PIGMENT.stone,
];

function colorForSpeaker(id: string): string {
  if (!id) return PIGMENT.stone;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return OTHER_AVATAR_COLORS[hash % OTHER_AVATAR_COLORS.length];
}

const DialogueList: React.FC = () => {
  const { dialogues, characters, loading } = useNovelStore();
  const [chapterFilter, setChapterFilter] = useState<number | null>(null);
  const [toneFilter, setToneFilter] = useState<string | null>(null);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    setShowTopBtn(el ? el.scrollTop > 300 : false);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const chapters = useMemo(() => {
    const uniqueChapters = [...new Set(dialogues.map((d) => d.chapter))];
    return uniqueChapters.sort((a, b) => a - b);
  }, [dialogues]);

  const tones = useMemo(() => {
    const uniqueTones = [...new Set(dialogues.map((d) => d.tone))];
    return uniqueTones.sort();
  }, [dialogues]);

  const speakers = useMemo(() => {
    const uniqueSpeakers = [...new Set(dialogues.map((d) => d.speaker_name))].filter(Boolean) as string[];
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
          (d.text?.toLowerCase().includes(query) ||
          d.speaker_name?.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [dialogues, chapterFilter, toneFilter, speakerFilter, searchQuery]);

  // 每章一页：分页项即章节
  const filteredChapters = useMemo(
    () => [...new Set(filteredDialogues.map((d) => d.chapter))].sort((a, b) => a - b),
    [filteredDialogues],
  );

  const currentChapter = filteredChapters[currentPage - 1];

  const pagedDialogues = useMemo(() => {
    if (currentChapter === undefined) return [];
    return filteredDialogues.filter((d) => d.chapter === currentChapter);
  }, [filteredDialogues, currentChapter]);

  // 「我方」气泡（靠右）：优先主角，其次出场最多的说话者，作为聊天视角锚点。
  const selfId = useMemo(() => {
    const protagonist = characters.find((c) => c.role === 'protagonist');
    if (protagonist) return protagonist.id;
    const counts = new Map<string, number>();
    dialogues.forEach((d) => counts.set(d.speaker, (counts.get(d.speaker) ?? 0) + 1));
    let best: string | null = null;
    let bestCount = -1;
    counts.forEach((count, id) => {
      if (count > bestCount) {
        bestCount = count;
        best = id;
      }
    });
    return best;
  }, [characters, dialogues]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (dialogues.length === 0) {
    return <Empty description="暂无对话数据" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 16 }}>
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: '1px solid var(--ink-hairline)',
        }}
      >
        <Text type="secondary">
          共 {filteredDialogues.length} 条对话
          {toneFilter && ` · ${toneFilter}`}
          {speakerFilter && ` · ${speakerFilter}`}
          {searchQuery && ` · 搜索"${searchQuery}"`}
        </Text>
        {filteredChapters.length > 1 && (
          <Pagination
            current={currentPage}
            total={filteredChapters.length}
            pageSize={1}
            onChange={setCurrentPage}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total) => `共 ${total} 章`}
            size="small"
          />
        )}
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto' }}>
        <div className="chat-thread">
          {pagedDialogues.map((dialogue, index) => {
            const prev = index > 0 ? pagedDialogues[index - 1] : null;
            const newChapter = !prev || prev.chapter !== dialogue.chapter;
            const isSelf = dialogue.speaker === selfId;
            // 同章节、同说话者的连续气泡合并：不重复显示头像与名字
            const showHeader = newChapter || !prev || prev.speaker !== dialogue.speaker;
            return (
              <React.Fragment key={`${dialogue.speaker}-${dialogue.chapter}-${index}`}>
                {newChapter && (
                  <div className="chat-divider">
                    <span>第 {dialogue.chapter} 章</span>
                  </div>
                )}
                <DialogueCard
                  speaker={dialogue.speaker}
                  speaker_name={dialogue.speaker_name}
                  text={dialogue.text}
                  tone={dialogue.tone}
                  isSelf={isSelf}
                  showHeader={showHeader}
                  avatarColor={isSelf ? CINNABAR.base : colorForSpeaker(dialogue.speaker)}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {showTopBtn && (
        <FloatButton onClick={scrollToTop} style={{ position: 'absolute', bottom: 24, right: 24 }} tooltip="回到顶部" />
      )}
    </div>
  );
};

export default DialogueList;
