import React from 'react';
import { Alert, Button, Collapse, Col, Row, Space, Statistic, Typography } from 'antd';
import type { AnnotatedLibraryRecord, LibraryCollections, LibraryLoadWarning } from '../../types/library';
import { summarizeLibrary } from '../../utils/libraryAggregate';
import { serializeLibraryCsv, serializeLibraryJson } from '../../utils/libraryExport';

const { Text } = Typography;

interface LibrarySummaryProps {
  collections: LibraryCollections;
  warnings: LibraryLoadWarning[];
  exportRecords?: AnnotatedLibraryRecord<unknown>[];
}

function downloadText(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const LibrarySummary: React.FC<LibrarySummaryProps> = ({ collections, warnings, exportRecords }) => {
  const summary = summarizeLibrary(collections);
  const exportableCount = exportRecords?.filter((r) => r.annotation?.exportEnabled !== false).length ?? 0;

  return (
    <Collapse
      size="small"
      style={{ marginBottom: 16 }}
      items={[{
        key: 'summary',
        label: '数据统计',
        children: (
          <>
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
            {exportRecords && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <Space>
                  <Text type="secondary">可导出 {exportableCount} 条</Text>
                  <Button
                    size="small"
                    disabled={exportableCount === 0}
                    onClick={() => downloadText('wuxia-library-export.json', 'application/json;charset=utf-8', serializeLibraryJson(exportRecords.filter((r) => r.annotation?.exportEnabled !== false)))}
                  >
                    JSON
                  </Button>
                  <Button
                    size="small"
                    disabled={exportableCount === 0}
                    onClick={() => downloadText('wuxia-library-export.csv', 'text/csv;charset=utf-8', serializeLibraryCsv(exportRecords.filter((r) => r.annotation?.exportEnabled !== false)))}
                  >
                    CSV
                  </Button>
                </Space>
              </div>
            )}
          </>
        ),
      }]}
    />
  );
};

export default LibrarySummary;
