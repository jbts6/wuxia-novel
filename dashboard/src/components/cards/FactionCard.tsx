import React from 'react';
import { Card, Tag, Descriptions, Typography, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK } from '../../theme/palette';

const { Text, Paragraph } = Typography;

interface FactionCardProps {
  id: string;
}

const FactionCard: React.FC<FactionCardProps> = ({ id }) => {
  const { factions, characters, locations, showDetail } = useNovelStore();

  const faction = factions.find((f) => f.id === id);
  if (!faction) return null;

  const location = locations.find((l) => l.id === faction.location);
  const members = characters.filter((c) => c.faction === id);

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span className="ink-seal" style={{ marginRight: 12, background: ENTITY_COLORS.faction }}>
            {faction.name.charAt(0)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: INK.black }}>{faction.name}</h3>
            <Text type="secondary">{faction.type}</Text>
          </div>
        </div>
        <Descriptions column={1} size="small">
          {location && (
            <Descriptions.Item label="总部">
              <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => showDetail('location', location.id)}>
                {location.name}
              </Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>{faction.one_line}</Paragraph>
      </Card>

      {faction.sub_divisions.length > 0 && (
        <Card size="small" title="下属机构" style={{ marginBottom: 16 }}>
          <Space wrap>
            {faction.sub_divisions.map((div, index) => (
              <Tag key={index} color="cyan">{div}</Tag>
            ))}
          </Space>
        </Card>
      )}

      {members.length > 0 && (
        <Card size="small" title={<span><UserOutlined /> 成员 ({members.length})</span>} style={{ marginBottom: 16 }}>
          {members.map((char) => (
            <div key={char.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }} onClick={() => showDetail('character', char.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{char.name}</span>
                <Tag color={char.role === 'protagonist' ? 'blue' : char.role === 'villain' ? 'red' : 'default'}>
                  {char.role === 'protagonist' ? '主角' : char.role === 'villain' ? '反派' : 'NPC'}
                </Tag>
              </div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{char.identity}</div>
            </div>
          ))}
        </Card>
      )}

      {faction.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {faction.source_refs.slice(0, 3).map((ref, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}>
              <div style={{ fontWeight: 500 }}>第{ref.chapter}章 (行 {ref.line_start}-{ref.line_end})</div>
              <Paragraph ellipsis={{ rows: 3, expandable: true }} className="ink-quote" style={{ marginBottom: 0 }}>
                {ref.text}
              </Paragraph>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default FactionCard;
