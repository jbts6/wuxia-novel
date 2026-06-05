import React from 'react';
import { Card, Tag, Typography, Space } from 'antd';
import { EnvironmentOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

interface LocationCardProps {
  id: string;
}

const LocationCard: React.FC<LocationCardProps> = ({ id }) => {
  const { locations, characters, factions, showDetail } = useNovelStore();

  const location = locations.find((l) => l.id === id);
  if (!location) return null;

  const relatedFactions = factions.filter((f) => f.location === id);
  const relatedCharacters = characters.filter((c) => c.faction && relatedFactions.some(f => f.id === c.faction));

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <EnvironmentOutlined style={{ fontSize: 24, marginRight: 12, color: '#722ed1' }} />
          <div>
            <h3 style={{ margin: 0 }}>{location.name}</h3>
            <Text type="secondary">{location.region}</Text>
          </div>
        </div>
        <Paragraph style={{ marginBottom: 0 }}>{location.one_line}</Paragraph>
      </Card>

      {relatedFactions.length > 0 && (
        <Card size="small" title={<span><TeamOutlined /> 关联势力</span>} style={{ marginBottom: 16 }}>
          {relatedFactions.map((faction) => (
            <div key={faction.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }} onClick={() => showDetail('faction', faction.id)}>
              <div style={{ fontWeight: 500 }}>{faction.name}</div>
              <div style={{ color: '#999', fontSize: 12 }}>{faction.type}</div>
            </div>
          ))}
        </Card>
      )}

      {relatedCharacters.length > 0 && (
        <Card size="small" title={<span><UserOutlined /> 关联人物</span>} style={{ marginBottom: 16 }}>
          <Space wrap>
            {relatedCharacters.slice(0, 10).map((char) => (
              <Tag
                key={char.id}
                color={char.role === 'protagonist' ? 'blue' : char.role === 'villain' ? 'red' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => showDetail('character', char.id)}
              >
                {char.name}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {location.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {location.source_refs.slice(0, 3).map((ref, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontWeight: 500 }}>第{ref.chapter}章 (行 {ref.line_start}-{ref.line_end})</div>
              <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ marginBottom: 0, fontStyle: 'italic' }}>
                {ref.text}
              </Paragraph>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default LocationCard;
