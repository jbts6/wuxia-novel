import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Input, Row, Col } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

const CharacterList: React.FC = () => {
  const { characters, factions, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return characters;
    const q = search.toLowerCase();
    return characters.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.alias?.some(a => a.toLowerCase().includes(q)) ||
      c.identity?.toLowerCase().includes(q)
    );
  }, [characters, search]);

  const groupedByFaction = useMemo(() => {
    const groups: Record<string, typeof filtered> = { '无门派': [] };
    filtered.forEach(c => {
      const key = c.faction || '无门派';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups)
      .filter(([, chars]) => chars.length > 0)
      .map(([factionId, chars]) => {
        const faction = factions.find(f => f.id === factionId);
        return { factionName: faction?.name || factionId, chars };
      });
  }, [filtered, factions]);

  const rankColor: Record<string, string> = {
    '返璞归真': 'red', '登峰造极': 'orange', '出神入化': 'blue',
    '炉火纯青': 'green', '登堂入室': 'purple', '略有小成': 'cyan',
    '初窥门径': 'default', '平平无奇': 'default',
  };

  if (loading) return <Spin size="large" />;
  if (characters.length === 0) return <Empty description="暂无角色数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
          placeholder="搜索角色名、别名、身份..."
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <div style={{ marginTop: 8, color: 'var(--ink-secondary)' }}>共 {filtered.length} 个角色</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groupedByFaction.map(({ factionName, chars }) => (
          <Card
            key={factionName}
            size="small"
            title={<span><UserOutlined style={{ marginRight: 8 }} />{factionName}<InkTag style={{ marginLeft: 8 }}>{chars.length}人</InkTag></span>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[12, 12]}>
              {chars.map(char => (
                <Col xs={24} sm={12} md={8} lg={6} key={char.id}>
                  {(() => {
                    const powerRank = char.power_rank ?? char.rank;
                    return (
                  <Card
                    size="small"
                    hoverable
                    onClick={() => showDetail('character', char.id)}
                    style={{ height: '100%' }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{char.name}</Text>
                      {powerRank && (
                        <InkTag color={rankColor[powerRank] || 'default'} style={{ marginLeft: 8 }}>{powerRank}</InkTag>
                      )}
                    </div>
                    {char.alias?.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        {char.alias.slice(0, 2).map(a => <InkTag key={a} style={{ fontSize: 11 }}>{a}</InkTag>)}
                      </div>
                    )}
                    <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                      {char.identity || char.one_line}
                    </Paragraph>
                  </Card>
                    );
                  })()}
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CharacterList;
