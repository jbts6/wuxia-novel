import React, { useMemo } from 'react';
import { Card, Typography, Empty, Spin, Space, Row, Col, Collapse } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { getRankColor, getSkillRank, getSkillSummary, getSkillTechniques, getSkillType } from '../../utils/skillDisplay';
import { ENTITY_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

const SkillTree: React.FC = () => {
  const { skills, characters, showDetail, loading } = useNovelStore();

  const groupedSkills = useMemo(() => {
    const groups: Record<string, typeof skills> = {};
    skills.forEach((skill) => {
      const type = getSkillType(skill);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(skill);
    });
    return Object.entries(groups).map(([type, skills]) => ({
      type,
      skills,
    }));
  }, [skills]);

  const rankOrder = [
    '返璞归真',
    '登峰造极',
    '出神入化',
    '炉火纯青',
    '登堂入室',
    '略有小成',
    '初窥门径',
    '平平无奇',
  ];

  if (loading) {
    return <Spin size="large" />;
  }

  if (skills.length === 0) {
    return <Empty description="暂无技能数据" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 16 }}>
        <Space wrap>
          {rankOrder.map((rank) => {
            const color = getRankColor(rank);
            return (
              <InkTag key={rank} color={color} wash={false}>
                {rank}
              </InkTag>
            );
          })}
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Collapse
          defaultActiveKey={[groupedSkills[0]?.type]}
          items={groupedSkills.map(({ type, skills: typeSkills }) => ({
            key: type,
            label: (
              <span>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                {type}
                <InkTag style={{ marginLeft: 8 }}>{typeSkills.length}个</InkTag>
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {typeSkills
                  .sort((a, b) => {
                    const aIndex = rankOrder.indexOf(a.mastery_rank);
                    const bIndex = rankOrder.indexOf(b.mastery_rank);
                    return aIndex - bIndex;
                  })
                  .map((skill) => {
                    const relatedChars = characters.filter((c) =>
                      Array.isArray(c.known_skills) && c.known_skills.includes(skill.id)
                    );
                    const skillRank = getSkillRank(skill);
                    const skillRankColor = getRankColor(skillRank);
                    const techniques = getSkillTechniques(skill);

                    return (
                      <Col xs={24} sm={12} md={8} lg={6} key={skill.id}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => showDetail('skill', skill.id)}
                          style={{ height: '100%' }}
                        >
                          <div style={{ marginBottom: 8 }}>
                            <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{skill.name}</Text>
                            <InkTag color={skillRankColor} wash={false} style={{ marginLeft: 8 }}>
                              {skillRank}
                            </InkTag>
                          </div>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            type="secondary"
                            style={{ marginBottom: 8, fontSize: 12 }}
                          >
                            {getSkillSummary(skill)}
                          </Paragraph>
                          <div>
                            {techniques.slice(0, 3).map((tech) => (
                              <InkTag key={tech.id} style={{ marginBottom: 4 }}>
                                {tech.name}
                              </InkTag>
                            ))}
                            {techniques.length > 3 && (
                              <InkTag>+{techniques.length - 3}</InkTag>
                            )}
                          </div>
                          {relatedChars.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                掌握者：
                              </Text>
                              {relatedChars.slice(0, 2).map((char) => (
                                <InkTag
                                  key={char.id}
                                  color={ENTITY_COLORS.character}
                                  wash={false}
                                  style={{ cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showDetail('character', char.id);
                                  }}
                                >
                                  {char.name}
                                </InkTag>
                              ))}
                            </div>
                          )}
                        </Card>
                      </Col>
                    );
                  })}
              </Row>
            ),
          }))}
        />
      </div>
    </div>
  );
};

export default SkillTree;
