import React, { useMemo, useState } from 'react';
import { Card, Tag, Typography, Empty, Spin, Input, Row, Col, Tabs } from 'antd';
import { TeamOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

const ForceList: React.FC = () => {
  const { factions, locations, characters, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');

  const filteredFactions = useMemo(() => {
    if (!search) return factions;
    const q = search.toLowerCase();
    return factions.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.type?.toLowerCase().includes(q) ||
      f.one_line?.toLowerCase().includes(q)
    );
  }, [factions, search]);

  const filteredLocations = useMemo(() => {
    if (!search) return locations;
    const q = search.toLowerCase();
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.region?.toLowerCase().includes(q) ||
      l.one_line?.toLowerCase().includes(q)
    );
  }, [locations, search]);

  const groupedFactions = useMemo(() => {
    const groups: Record<string, typeof filteredFactions> = {};
    filteredFactions.forEach(f => {
      const type = f.type || '其他';
      if (!groups[type]) groups[type] = [];
      groups[type].push(f);
    });
    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }, [filteredFactions]);

  const groupedLocations = useMemo(() => {
    const groups: Record<string, typeof filteredLocations> = {};
    filteredLocations.forEach(l => {
      const region = l.region || '未分类';
      if (!groups[region]) groups[region] = [];
      groups[region].push(l);
    });
    return Object.entries(groups).map(([region, items]) => ({ region, items }));
  }, [filteredLocations]);

  if (loading) return <Spin size="large" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          placeholder="搜索门派、地点..."
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <div style={{ marginTop: 8, color: '#999' }}>
          共 {filteredFactions.length} 个门派 · {filteredLocations.length} 个地点
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tabs
          defaultActiveKey="factions"
          items={[
            {
              key: 'factions',
              label: <span><TeamOutlined /> 门派</span>,
              children: (
                <>
                  {groupedFactions.length === 0 && <Empty description="暂无门派数据" />}
                  {groupedFactions.map(({ type, items }) => (
                    <Card
                      key={type}
                      size="small"
                      title={<span><TeamOutlined style={{ marginRight: 8 }} />{type}<Tag style={{ marginLeft: 8 }}>{items.length}个</Tag></span>}
                      style={{ marginBottom: 16 }}
                    >
                      <Row gutter={[12, 12]}>
                        {items.map(faction => {
                          const location = locations.find(l => l.id === faction.location);
                          const members = characters.filter(c => c.faction === faction.id);
                          return (
                            <Col xs={24} sm={12} md={8} lg={6} key={faction.id}>
                              <Card
                                size="small"
                                hoverable
                                onClick={() => showDetail('faction', faction.id)}
                                style={{ height: '100%' }}
                              >
                                <div style={{ marginBottom: 4 }}>
                                  <Text strong>{faction.name}</Text>
                                </div>
                                {location && (
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag
                                      color="purple"
                                      style={{ cursor: 'pointer' }}
                                      onClick={e => { e.stopPropagation(); showDetail('location', location.id); }}
                                    >
                                      {location.name}
                                    </Tag>
                                  </div>
                                )}
                                {members.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      成员：{members.slice(0, 3).map(m => m.name).join('、')}
                                      {members.length > 3 && ` 等${members.length}人`}
                                    </Text>
                                  </div>
                                )}
                                <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                                  {faction.one_line}
                                </Paragraph>
                              </Card>
                            </Col>
                          );
                        })}
                      </Row>
                    </Card>
                  ))}
                </>
              )
            },
            {
              key: 'locations',
              label: <span><EnvironmentOutlined /> 地点</span>,
              children: (
                <>
                  {groupedLocations.length === 0 && <Empty description="暂无地点数据" />}
                  {groupedLocations.map(({ region, items }) => (
                    <Card
                      key={region}
                      size="small"
                      title={<span><EnvironmentOutlined style={{ marginRight: 8 }} />{region}<Tag style={{ marginLeft: 8 }}>{items.length}个</Tag></span>}
                      style={{ marginBottom: 16 }}
                    >
                      <Row gutter={[12, 12]}>
                        {items.map(location => {
                          const relatedFactions = factions.filter(f => f.location === location.id);
                          return (
                            <Col xs={24} sm={12} md={8} lg={6} key={location.id}>
                              <Card
                                size="small"
                                hoverable
                                onClick={() => showDetail('location', location.id)}
                                style={{ height: '100%' }}
                              >
                                <div style={{ marginBottom: 4 }}>
                                  <Text strong>{location.name}</Text>
                                </div>
                                {relatedFactions.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    {relatedFactions.map(f => (
                                      <Tag
                                        key={f.id}
                                        color="cyan"
                                        style={{ cursor: 'pointer', marginBottom: 2 }}
                                        onClick={e => { e.stopPropagation(); showDetail('faction', f.id); }}
                                      >
                                        {f.name}
                                      </Tag>
                                    ))}
                                  </div>
                                )}
                                <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                                  {location.one_line}
                                </Paragraph>
                              </Card>
                            </Col>
                          );
                        })}
                      </Row>
                    </Card>
                  ))}
                </>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

export default ForceList;
