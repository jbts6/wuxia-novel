import React, { useEffect } from 'react';
import { Empty, Segmented, Spin, Typography } from 'antd';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import type { LibrarySection } from '../../types/library';
import LibrarySummary from './LibrarySummary';

const { Paragraph, Title } = Typography;

const SECTION_OPTIONS: Array<{ label: string; value: LibrarySection }> = [
  { label: '总览', value: 'overview' },
  { label: '顶级武功', value: 'skills' },
  { label: '人物原型', value: 'characters' },
  { label: '门派资源', value: 'factions' },
  { label: '神兵物品', value: 'items' },
  { label: '导出', value: 'export' },
];

const GlobalLibraryDashboard: React.FC = () => {
  const books = useBookStore((state) => state.books);
  const data = useLibraryData(books);
  const { section, setSection, hydrateAnnotations } = useLibraryStore();

  useEffect(() => {
    hydrateAnnotations();
  }, [hydrateAnnotations]);

  if (data.loading) return <Spin size="large" />;
  if (data.error) return <Empty description={data.error} />;

  const collections = {
    skills: data.skills,
    characters: data.characters,
    factions: data.factions,
    items: data.items,
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>全库总览</Title>
        <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
          跨作品整理武功、人物原型、门派资源和神兵物品，为游戏设计提供可筛选素材。
        </Paragraph>
      </div>
      <Segmented
        options={SECTION_OPTIONS}
        value={section}
        onChange={(value) => setSection(value as LibrarySection)}
        style={{ marginBottom: 20 }}
      />
      <LibrarySummary collections={collections} warnings={data.warnings} />
      <div data-testid="library-section">{SECTION_OPTIONS.find((option) => option.value === section)?.label}</div>
    </div>
  );
};

export default GlobalLibraryDashboard;
