import React from 'react';
import { Card, Tag, Descriptions, Typography, Divider, Space } from 'antd';
import {
  ThunderboltOutlined,
  TeamOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK } from '../../theme/palette';

const { Text, Paragraph } = Typography;

interface CharacterCardProps {
  id: string;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ id }) => {
  const {
    characters,
    skills,
    items,
    factions,
    dialogues,
    showDetail,
  } = useNovelStore();

  const character = characters.find((c) => c.id === id);
  if (!character) return null;

  const faction = factions.find((f) => f.id === character.faction);
  const charItems = items.filter((i) => i.owner === id);
  const charDialogues = dialogues
    .filter((d) => d.speaker === id || d.speaker_name === character.name)
    .slice(0, 5);

  const roleColors: Record<string, string> = {
    protagonist: 'blue',
    companion: 'green',
    npc: 'default',
    villain: 'red',
  };

  const roleLabels: Record<string, string> = {
    protagonist: '主角',
    companion: '同伴',
    npc: 'NPC',
    villain: '反派',
  };

  return (
    <div>
      {/* 基础信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span className="ink-seal" style={{ marginRight: 12, background: ENTITY_COLORS.character }}>
            {character.name.charAt(0)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: INK.black }}>{character.name}</h3>
            {character.alias.length > 0 && (
              <Text type="secondary">{character.alias.join(' · ')}</Text>
            )}
          </div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="身份">{character.identity}</Descriptions.Item>
          <Descriptions.Item label="等级">
            <Tag color="orange">{character.rank}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={roleColors[character.role]}>
              {roleLabels[character.role]}
            </Tag>
          </Descriptions.Item>
          {faction && (
            <Descriptions.Item label="势力">
              <Tag color="cyan" style={{ cursor: 'pointer' }} onClick={() => showDetail('faction', faction.id)}>
                {faction.name}
              </Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>{character.one_line}</Paragraph>
      </Card>

      {/* 性格特征 */}
      <Card size="small" title="性格特征" style={{ marginBottom: 16 }}>
        <Space wrap>
          {character.personality.traits.map((trait, index) => (
            <Tag key={index} color="blue">{trait}</Tag>
          ))}
        </Space>
        <Divider style={{ margin: '12px 0' }} />
        <Descriptions column={1} size="small">
          <Descriptions.Item label="说话风格">{character.personality.speech_style}</Descriptions.Item>
          <Descriptions.Item label="气质">{character.personality.temperament}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 关系网络 */}
      {character.relationships.length > 0 && (
        <Card size="small" title={<span><TeamOutlined /> 关系网络</span>} style={{ marginBottom: 16 }}>
          {character.relationships.map((rel) => {
            const target = characters.find((c) => c.id === rel.target);
            return (
              <div
                key={rel.target}
                style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}
                onClick={() => showDetail('character', rel.target)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{target?.name || rel.target}</span>
                  <Tag color="blue">{rel.type}</Tag>
                </div>
                <div style={{ color: INK.secondary, fontSize: 12 }}>
                  强度: {rel.intensity} · {rel.dynamic}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* 武功技能 */}
      {character.known_skills.length > 0 && (
        <Card size="small" title={<span><ThunderboltOutlined /> 武功技能</span>} style={{ marginBottom: 16 }}>
          <Space wrap>
            {character.known_skills.map((skillId) => {
              const skill = skills.find((s) => s.id === skillId);
              return skill ? (
                <Tag key={skillId} color="green" style={{ cursor: 'pointer' }} onClick={() => showDetail('skill', skillId)}>
                  {skill.name}
                </Tag>
              ) : null;
            })}
          </Space>
        </Card>
      )}

      {/* 持有物品 */}
      {charItems.length > 0 && (
        <Card size="small" title={<span><FireOutlined /> 持有物品</span>} style={{ marginBottom: 16 }}>
          {charItems.map((item) => (
            <div
              key={item.id}
              style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}
              onClick={() => showDetail('item', item.id)}
            >
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{item.one_line}</div>
            </div>
          ))}
        </Card>
      )}

      {/* 经典台词 */}
      {charDialogues.length > 0 && (
        <Card size="small" title="经典台词" style={{ marginBottom: 16 }}>
          {charDialogues.map((dialogue, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Tag color="purple">{dialogue.tone}</Tag>
                <span style={{ color: INK.secondary, fontSize: 12 }}>第{dialogue.chapter}章</span>
              </div>
              <Paragraph ellipsis={{ rows: 2, expandable: true }} className="ink-quote" style={{ marginBottom: 0 }}>
                {dialogue.text}
              </Paragraph>
            </div>
          ))}
        </Card>
      )}

      {/* 原文引用 */}
      {character.source_refs?.length > 0 && (
        <Card size="small" title="原文引用">
          {character.source_refs.slice(0, 3).map((ref, index) => (
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
      )}
    </div>
  );
};

export default CharacterCard;
