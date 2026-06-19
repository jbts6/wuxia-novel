import React, { useMemo } from 'react';
import { Card, Tag, Typography, Empty, Spin, Space, Row, Col } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { getRankColor, getSkillRank, getSkillSummary, getSkillTechniques, getSkillType } from '../../utils/skillDisplay';

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
              <Tag key={rank} style={{ color, borderColor: color, background: 'transparent' }}>
                {rank}
              </Tag>
            );
          })}
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groupedSkills.map(({ type, skills: typeSkills }) => (
          <Card
            key={type}
            size="small"
            title={
              <span>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                {type}
                <Tag style={{ marginLeft: 8 }}>{typeSkills.length}个</Tag>
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]}>
              {typeSkills
                .sort((a, b) => {
                  const aIndex = rankOrder.indexOf(a.rank);
                  const bIndex = rankOrder.indexOf(b.rank);
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
                          <Tag
                            style={{ marginLeft: 8, color: skillRankColor, borderColor: skillRankColor, background: 'transparent' }}
                          >
                            {skillRank}
                          </Tag>
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
                            <Tag key={tech.id} style={{ marginBottom: 4 }}>
                              {tech.name}
                            </Tag>
                          ))}
                          {techniques.length > 3 && (
                            <Tag>+{techniques.length - 3}</Tag>
                          )}
                        </div>
                        {relatedChars.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              掌握者：
                            </Text>
                            {relatedChars.slice(0, 2).map((char) => (
                              <Tag
                                key={char.id}
                                color="blue"
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showDetail('character', char.id);
                                }}
                              >
                                {char.name}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </Card>
                    </Col>
                  );
                })}
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SkillTree;
