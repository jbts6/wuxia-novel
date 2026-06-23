import React from 'react';
import { Card, Typography, Space } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK } from '../../theme/palette';
import { findById, getLocationCharacters, getLocationFactions } from '../../utils/entityLookup';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

interface LocationCardProps {
  id: string;
}

const LocationCard: React.FC<LocationCardProps> = ({ id }) => {
  const locations = useNovelStore((s) => s.locations);
  const characters = useNovelStore((s) => s.characters);
  const factions = useNovelStore((s) => s.factions);
  const showDetail = useNovelStore((s) => s.showDetail);

  const location = findById(locations, id);
  if (!location) return null;

  const relatedFactions = getLocationFactions(factions, id);
  const relatedCharacters = getLocationCharacters(characters, factions, id);

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span className="ink-seal" style={{ marginRight: 12, background: ENTITY_COLORS.location }}>
            {location.name.charAt(0)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: INK.black }}>{location.name}</h3>
            <Text type="secondary">{location.region}</Text>
          </div>
        </div>
        <Paragraph style={{ marginBottom: 0 }}>{location.one_line}</Paragraph>
      </Card>

      {relatedFactions.length > 0 && (
        <Card size="small" title={<span><TeamOutlined /> 关联势力</span>} style={{ marginBottom: 16 }}>
          {relatedFactions.map((faction) => (
            <div key={faction.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }} onClick={() => showDetail('faction', faction.id)}>
              <div style={{ fontWeight: 500 }}>{faction.name}</div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{faction.type}</div>
            </div>
          ))}
        </Card>
      )}

      {relatedCharacters.length > 0 && (
        <Card size="small" title={<span><UserOutlined /> 关联人物</span>} style={{ marginBottom: 16 }}>
          <Space wrap>
            {relatedCharacters.slice(0, 10).map((char) => (
              <InkTag
                key={char.id}
                color={char.role === 'protagonist' ? 'indigo' : char.role === 'villain' ? 'attack' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => showDetail('character', char.id)}
              >
                {char.name}
              </InkTag>
            ))}
          </Space>
        </Card>
      )}

      {location.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {location.source_refs.slice(0, 3).map((ref, index) => (
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

export default React.memo(LocationCard);
