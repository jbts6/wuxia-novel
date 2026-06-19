import React from 'react';
import { Alert, Col, Row, Statistic } from 'antd';
import type { LibraryCollections, LibraryLoadWarning } from '../../types/library';
import { summarizeLibrary } from '../../utils/libraryAggregate';

interface LibrarySummaryProps {
  collections: LibraryCollections;
  warnings: LibraryLoadWarning[];
}

const LibrarySummary: React.FC<LibrarySummaryProps> = ({ collections, warnings }) => {
  const summary = summarizeLibrary(collections);

  return (
    <div style={{ marginBottom: 20 }}>
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`有 ${warnings.length} 个数据文件未加载，当前展示可用的部分数据。`}
        />
      )}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Statistic title="作品" value={summary.books} /></Col>
        <Col xs={12} md={6}><Statistic title="作者" value={summary.authors} /></Col>
        <Col xs={12} md={6}><Statistic title="武功" value={summary.skills} /></Col>
        <Col xs={12} md={6}><Statistic title="顶级武功" value={summary.topTierSkills} /></Col>
        <Col xs={12} md={6}><Statistic title="人物" value={summary.characters} /></Col>
        <Col xs={12} md={6}><Statistic title="门派" value={summary.factions} /></Col>
        <Col xs={12} md={6}><Statistic title="物品" value={summary.items} /></Col>
        <Col xs={12} md={6}><Statistic title="神兵" value={summary.legendaryItems} /></Col>
      </Row>
    </div>
  );
};

export default LibrarySummary;
