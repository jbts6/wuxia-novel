import React from 'react';
import { Button, Space, Typography } from 'antd';
import type { AnnotatedLibraryRecord } from '../../types/library';
import { serializeLibraryCsv, serializeLibraryJson } from '../../utils/libraryExport';

const { Paragraph, Text } = Typography;

interface LibraryExportPanelProps {
  records: AnnotatedLibraryRecord<unknown>[];
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

const LibraryExportPanel: React.FC<LibraryExportPanelProps> = ({ records }) => {
  const exportableRecords = records.filter((record) => record.annotation?.exportEnabled !== false);

  return (
    <div>
      <Paragraph>
        <Text strong>可导出素材 {exportableRecords.length} 条</Text>
      </Paragraph>
      <Space>
        <Button
          type="primary"
          disabled={exportableRecords.length === 0}
          onClick={() => downloadText('wuxia-library-export.json', 'application/json;charset=utf-8', serializeLibraryJson(exportableRecords))}
        >
          导出 JSON
        </Button>
        <Button
          disabled={exportableRecords.length === 0}
          onClick={() => downloadText('wuxia-library-export.csv', 'text/csv;charset=utf-8', serializeLibraryCsv(exportableRecords))}
        >
          导出 CSV
        </Button>
      </Space>
    </div>
  );
};

export default LibraryExportPanel;
