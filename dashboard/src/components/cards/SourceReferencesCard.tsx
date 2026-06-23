import React from 'react';
import { Card, Typography } from 'antd';
import type { SourceRef } from '../../types/novel';

const { Paragraph } = Typography;

interface SourceReferencesCardProps {
  sourceRefs?: SourceRef[];
}

const SourceReferencesCard: React.FC<SourceReferencesCardProps> = ({ sourceRefs }) => {
  if (!sourceRefs?.length) return null;

  return (
    <Card size="small" title="原文引用">
      {sourceRefs.slice(0, 3).map((ref, index) => (
        <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            第{ref.chapter}章 (行 {ref.line_start}-{ref.line_end})
          </div>
          <Paragraph ellipsis={{ rows: 3, expandable: true }} className="ink-quote" style={{ marginBottom: 0 }}>
            {ref.text}
          </Paragraph>
        </div>
      ))}
    </Card>
  );
};

export default SourceReferencesCard;
