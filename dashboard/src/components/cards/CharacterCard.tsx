import React from 'react';
import { Card, Descriptions, Typography, Divider, Space } from 'antd';
import {
  ThunderboltOutlined,
  TeamOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK, PIGMENT, CINNABAR, ROLE_COLORS, RELATION_COLORS } from '../../theme/palette';
import { getRankColor } from '../../utils/skillDisplay';
import InkTag from '../common/InkTag';

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
            <InkTag color={character.rank}>{character.rank}</InkTag>
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <InkTag color={character.role}>
              {roleLabels[character.role]}
            </InkTag>
          </Descriptions.Item>
          {faction && (
            <Descriptions.Item label="势力">
              <InkTag color="cyan" style={{ cursor: 'pointer' }} onClick={() => showDetail('faction', faction.id)}>
                {faction.name}
              </InkTag>
            </Descriptions.Item>
          )}
        </Descriptions>
        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>{character.one_line}</Paragraph>
      </Card>

      {/* 性格特征 */}
      <Card size="small" title="性格特征" style={{ marginBottom: 16 }}>
        <Space wrap>
          {character.personality.traits.map((trait, index) => (
            <InkTag key={index} color="indigo">{trait}</InkTag>
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
                  <Tag style={{ color: RELATION_COLORS[rel.type] || PIGMENT.indigo, borderColor: RELATION_COLORS[rel.type] || PIGMENT.indigo, background: 'transparent', marginInlineEnd: 0 }}>{rel.type}</Tag>
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
                <Tag key={skillId} style={{ color: ENTITY_COLORS.skill, borderColor: ENTITY_COLORS.skill, background: 'transparent', cursor: 'pointer' }} onClick={() => showDetail('skill', skillId)}>
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
                <Tag style={{ color: PIGMENT.violet, borderColor: PIGMENT.violet, background: 'transparent', marginInlineEnd: 0 }}>{dialogue.tone}</Tag>
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
