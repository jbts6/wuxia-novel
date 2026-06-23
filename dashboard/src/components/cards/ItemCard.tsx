import React from 'react';
import { Card, Descriptions, Typography, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK, CINNABAR } from '../../theme/palette';
import { findById, getItemRelatedSkills } from '../../utils/entityLookup';
import InkTag from '../common/InkTag';
import SourceReferencesCard from './SourceReferencesCard';

const { Text, Paragraph } = Typography;



interface ItemCardProps {
  id: string;
}

const ItemCard: React.FC<ItemCardProps> = ({ id }) => {
  const items = useNovelStore((s) => s.items);
  const characters = useNovelStore((s) => s.characters);
  const skills = useNovelStore((s) => s.skills);
  const showDetail = useNovelStore((s) => s.showDetail);

  const item = findById(items, id);
  if (!item) return null;

  const owner = findById(characters, item.owner);
  const relatedSkills = getItemRelatedSkills(skills, item.related_skills);

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span className="ink-seal" style={{ marginRight: 12, background: ENTITY_COLORS.item }}>
            {item.name.charAt(0)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: INK.black }}>{item.name}</h3>
            <Text type="secondary">{item.type}</Text>
          </div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="稀有度"><InkTag color={item.rarity_tier}>{item.rarity_tier}</InkTag></Descriptions.Item>
          {owner && (
            <Descriptions.Item label="持有者">
              <InkTag color="indigo" style={{ cursor: 'pointer' }} onClick={() => showDetail('character', owner.id)}>
                {owner.name}
              </InkTag>
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

      {item.effects?.length > 0 && (
        <Card size="small" title="效果" style={{ marginBottom: 16 }}>
          <Space wrap>
            {item.effects.map((effect, index) => (
              <InkTag key={index} color={CINNABAR.soft} wash={false}>
                {typeof effect === 'string' ? effect : `${effect.type}: ${effect.description}`}
              </InkTag>
            ))}
          </Space>
        </Card>
      )}

      {relatedSkills.length > 0 && (
        <Card size="small" title={<span><ThunderboltOutlined /> 关联技能</span>} style={{ marginBottom: 16 }}>
          {relatedSkills.map((skill) => (
            <div key={skill.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }} onClick={() => showDetail('skill', skill.id)}>
              <div style={{ fontWeight: 500 }}>{skill.name}</div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{skill.one_line}</div>
            </div>
          ))}
        </Card>
      )}

      <SourceReferencesCard sourceRefs={item.source_refs} />
    </div>
  );
};

export default React.memo(ItemCard);
