import React from 'react';
import { Card, Tag, Typography, Space } from 'antd';
import { EnvironmentOutlined, UserOutlined, BookOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

interface EventCardProps {
  id: string;
}

const EventCard: React.FC<EventCardProps> = ({ id }) => {
  const { events, characters, locations, showDetail } = useNovelStore();

  const event = events.find((e) => e.id === id);
  if (!event) return null;

  const location = locations.find((l) => l.id === event.location);
  const participants = characters.filter((c) => event.participants.includes(c.id));

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <BookOutlined style={{ fontSize: 24, marginRight: 12, color: '#ff4d4f' }} />
          <div>
            <h3 style={{ margin: 0 }}>{event.name}</h3>
            <Tag color="blue">第{event.chapter}章</Tag>
          </div>
        </div>
        <Paragraph style={{ marginBottom: 0 }}>{event.description}</Paragraph>
      </Card>

      {participants.length > 0 && (
        <Card size="small" title={<span><UserOutlined /> 参与者</span>} style={{ marginBottom: 16 }}>
          <Space wrap>
            {participants.map((char) => (
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

      {location && (
        <Card size="small" title={<span><EnvironmentOutlined /> 地点</span>} style={{ marginBottom: 16 }}>
          <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => showDetail('location', location.id)}>
            {location.name}
          </Tag>
          <Text type="secondary" style={{ marginLeft: 8 }}>{location.region}</Text>
        </Card>
      )}

      {event.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {event.source_refs.slice(0, 3).map((ref, index) => (
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

export default EventCard;
