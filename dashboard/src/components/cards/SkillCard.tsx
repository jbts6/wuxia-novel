import React from 'react';
import { Card, Tag, Descriptions, Typography, Space } from 'antd';
import { UserOutlined, FireOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS, INK } from '../../theme/palette';
import { getSkillEffects, getSkillProgression, getRankColor } from '../../utils/skillDisplay';

const { Text, Paragraph } = Typography;

interface SkillCardProps {
  id: string;
}

const SkillCard: React.FC<SkillCardProps> = ({ id }) => {
  const { skills, characters, items, techniques, showDetail } = useNovelStore();

  const skill = skills.find((s) => s.id === id);
  if (!skill) return null;

  const skillTechniques = techniques.filter((t) => t.source_skill === id);
  const relatedCharacters = characters.filter((c) => Array.isArray(c.known_skills) && c.known_skills.includes(id));
  const relatedItems = items.filter((i) => Array.isArray(i.related_skills) && i.related_skills.includes(id));

  const effects = getSkillEffects(skill);
  const progression = getSkillProgression(skill);
  const rankColor = getRankColor(skill.rank);

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span className="ink-seal" style={{ marginRight: 12, background: ENTITY_COLORS.skill }}>
            {skill.name.charAt(0)}
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: INK.black }}>{skill.name}</h3>
            <Text type="secondary">{skill.type}</Text>
          </div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="等级"><Tag style={{ color: rankColor, borderColor: rankColor, background: 'transparent' }}>{skill.rank}</Tag></Descriptions.Item>
          {skill.faction && <Descriptions.Item label="所属势力"><Tag color="cyan">{skill.faction}</Tag></Descriptions.Item>}
        </Descriptions>
        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>{skill.one_line}</Paragraph>
      </Card>

      {skillTechniques.length > 0 && (
        <Card size="small" title="招式" style={{ marginBottom: 16 }}>
          {skillTechniques.map((tech) => (
            <div key={tech.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{tech.name}</span>
                <Tag color={tech.type === 'attack' ? 'red' : tech.type === 'defense' ? 'blue' : 'default'}>
                  {tech.type === 'attack' ? '攻击' : tech.type === 'defense' ? '防御' : tech.type}
                </Tag>
              </div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{tech.description}</div>
            </div>
          ))}
        </Card>
      )}

      {skill.combat_style && (
        <Card size="small" title="战斗风格" style={{ marginBottom: 16 }}>
          <Paragraph style={{ marginBottom: 0 }}>{skill.combat_style}</Paragraph>
        </Card>
      )}

      {effects.length > 0 && (
        <Card size="small" title={<span><FireOutlined /> 效果</span>} style={{ marginBottom: 16 }}>
          <Space wrap>
            {effects.map((effect, index) => (
              <Tag key={index} color="volcano">
                {effect}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {relatedCharacters.length > 0 && (
        <Card size="small" title={<span><UserOutlined /> 掌握此技能的人物</span>} style={{ marginBottom: 16 }}>
          {relatedCharacters.map((char) => (
            <div key={char.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }} onClick={() => showDetail('character', char.id)}>
              <div style={{ fontWeight: 500 }}>{char.name}</div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{char.identity}</div>
            </div>
          ))}
        </Card>
      )}

      {relatedItems.length > 0 && (
        <Card size="small" title="关联物品" style={{ marginBottom: 16 }}>
          {relatedItems.map((item) => (
            <div key={item.id} style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }} onClick={() => showDetail('item', item.id)}>
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              <div style={{ color: INK.secondary, fontSize: 12 }}>{item.one_line}</div>
            </div>
          ))}
        </Card>
      )}

      {progression.length > 0 && (
        <Card size="small" title="进阶路径">
          {progression.map((prog, index) => (
            <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid var(--ink-hairline)' }}>
              {prog.level !== undefined && <div style={{ fontWeight: 500 }}>等级 {prog.level}</div>}
              <div style={{ color: INK.secondary, fontSize: 12 }}>{prog.text}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default SkillCard;
