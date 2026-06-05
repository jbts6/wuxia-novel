import React from 'react';
import { Card, Tag, Descriptions, Typography, Space } from 'antd';
import { ToolOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

const rarityColors: Record<string, string> = {
  '绝世神兵': 'red',
  '稀世珍品': 'orange',
  '上乘佳品': 'blue',
  '寻常凡品': 'default',
};

interface ItemCardProps {
  id: string;
}

const ItemCard: React.FC<ItemCardProps> = ({ id }) => {
  const { items, characters, skills, showDetail } = useNovelStore();

  const item = items.find((i) => i.id === id);
  if (!item) return null;

  const owner = characters.find((c) => c.id === item.owner);
  const relatedSkills = skills.filter((s) => item.related_skills.includes(s.id));

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <ToolOutlined style={{ fontSize: 24, marginRight: 12, color: '#faad14' }} />
          <div>
            <h3 style={{ margin: 0 }}>{item.name}</h3>
            <Text type="secondary">{item.type}</Text>
          </div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="稀有度"><Tag color={rarityColors[item.rarity] || 'default'}>{item.rarity}</Tag></Descriptions.Item>
          {owner && (
            <Descriptions.Item label="持有者">
              <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => showDetail('character', owner.id)}>
                {owner.name}
              </Tag>
            </Descriptions.Item>
          )}
          {item.origin && <Descriptions.Item label="来源">{item.origin}</Descriptions.Item>}
        </Descriptions>
        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>{item.one_line}</Paragraph>
      </Card>

      {item.description && (
        <Card size="small" title="描述" style={{ marginBottom: 16 }}>
          <Paragraph>{item.description}</Paragraph>
        </Card>
      )}

      {item.effects.length > 0 && (
        <Card size="small" title="效果" style={{ marginBottom: 16 }}>
          <Space wrap>
            {item.effects.map((effect, index) => (
              <Tag key={index} color="volcano">
                {typeof effect === 'string' ? effect : `${effect.type}: ${effect.description}`}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {relatedSkills.length > 0 && (
        <Card size="small" title={<span><ThunderboltOutlined /> 关联技能</span>} style={{ marginBottom: 16 }}>
          {relatedSkills.map((skill) => (
            <div key={skill.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }} onClick={() => showDetail('skill', skill.id)}>
              <div style={{ fontWeight: 500 }}>{skill.name}</div>
              <div style={{ color: '#999', fontSize: 12 }}>{skill.one_line}</div>
            </div>
          ))}
        </Card>
      )}

      {item.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {item.source_refs.slice(0, 3).map((ref, index) => (
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

export default ItemCard;
