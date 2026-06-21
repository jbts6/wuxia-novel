import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Row, Col, Checkbox } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import { getRankColor, getSkillRank, getSkillSummary, getSkillTechniques, getSkillType } from '../../utils/skillDisplay';
import { ENTITY_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

const rankOrder = [
  '返璞归真', '登峰造极', '出神入化', '炉火纯青',
  '登堂入室', '略有小成', '初窥门径', '平平无奇',
];

const SkillTree: React.FC = () => {
  const { skills, characters, showDetail, loading } = useNovelStore();

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    skills.forEach(s => set.add(getSkillType(s)));
    return Array.from(set);
  }, [skills]);

  const allRanks = useMemo(() => {
    const set = new Set<string>();
    skills.forEach(s => set.add(getSkillRank(s)));
    return rankOrder.filter(r => set.has(r));
  }, [skills]);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return skills
      .filter(s => selectedTypes.length === 0 || selectedTypes.includes(getSkillType(s)))
      .filter(s => selectedRanks.length === 0 || selectedRanks.includes(getSkillRank(s)))
      .sort((a, b) => {
        const ai = rankOrder.indexOf(getSkillRank(a));
        const bi = rankOrder.indexOf(getSkillRank(b));
        return ai - bi;
      });
  }, [skills, selectedTypes, selectedRanks]);

  if (loading) return <Spin size="large" />;
  if (skills.length === 0) return <Empty description="暂无技能数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>类型：</Text>
          <Checkbox
            checked={selectedTypes.length === 0}
            onChange={() => setSelectedTypes([])}
            style={{ marginRight: 4 }}
          >
            全部
          </Checkbox>
          {allTypes.map(t => (
            <Checkbox
              key={t}
              checked={selectedTypes.includes(t)}
              onChange={() => setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
            >
              {t}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                ({skills.filter(s => getSkillType(s) === t).length})
              </Text>
            </Checkbox>
          ))}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>境界：</Text>
          {allRanks.map(r => (
            <Checkbox
              key={r}
              checked={selectedRanks.includes(r)}
              onChange={() => setSelectedRanks(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
            >
              <InkTag color={getRankColor(r)} wash={false} style={{ margin: 0 }}>{r}</InkTag>
            </Checkbox>
          ))}
        </div>
        <div style={{ marginTop: 8, color: 'var(--ink-secondary)', fontSize: 12 }}>
          共 {filtered.length} 项武功
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty description="无匹配项" />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map(skill => {
              const relatedChars = characters.filter(c =>
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
        )}
      </div>
    </div>
  );
};

export default SkillTree;
