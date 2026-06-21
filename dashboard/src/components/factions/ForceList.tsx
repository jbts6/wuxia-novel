import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Input, Row, Col, Checkbox, Tabs } from 'antd';
import { TeamOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { PIGMENT } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

const ForceList: React.FC = () => {
  const { factions, locations, characters, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');
  const [selectedFactionTypes, setSelectedFactionTypes] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const allFactionTypes = useMemo(() => {
    const set = new Set<string>();
    factions.forEach(f => set.add(f.type || '其他'));
    return Array.from(set);
  }, [factions]);

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    locations.forEach(l => set.add(l.region || '未分类'));
    return Array.from(set);
  }, [locations]);

  const filteredFactions = useMemo(() => {
    let result = factions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q) ||
        f.one_line?.toLowerCase().includes(q)
      );
    }
    if (selectedFactionTypes.length > 0) {
      result = result.filter(f => selectedFactionTypes.includes(f.type || '其他'));
    }
    return result;
  }, [factions, search, selectedFactionTypes]);

  const filteredLocations = useMemo(() => {
    let result = locations;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.region?.toLowerCase().includes(q) ||
        l.one_line?.toLowerCase().includes(q)
      );
    }
    if (selectedRegions.length > 0) {
      result = result.filter(l => selectedRegions.includes(l.region || '未分类'));
    }
    return result;
  }, [locations, search, selectedRegions]);

  if (loading) return <Spin size="large" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder="搜索门派、地点..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <div style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>
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
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>类型：</Text>
                    <Checkbox
                      checked={selectedFactionTypes.length === 0}
                      onChange={() => setSelectedFactionTypes([])}
                      style={{ marginRight: 4 }}
                    >
                      全部
                    </Checkbox>
                    {allFactionTypes.map(t => (
                      <Checkbox
                        key={t}
                        checked={selectedFactionTypes.includes(t)}
                        onChange={() => setSelectedFactionTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      >
                        {t}
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                          ({factions.filter(f => (f.type || '其他') === t).length})
                        </Text>
                      </Checkbox>
                    ))}
                  </div>
                  {filteredFactions.length === 0 ? (
                    <Empty description="暂无门派数据" />
                  ) : (
                    <Row gutter={[12, 12]}>
                      {filteredFactions.map(faction => {
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
                                  <InkTag
                                    color={PIGMENT.violet}
                                    wash={false}
                                    style={{ cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); showDetail('location', location.id); }}
                                  >
                                    {location.name}
                                  </InkTag>
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
                  )}
                </>
              )
            },
            {
              key: 'locations',
              label: <span><EnvironmentOutlined /> 地点</span>,
              children: (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>区域：</Text>
                    <Checkbox
                      checked={selectedRegions.length === 0}
                      onChange={() => setSelectedRegions([])}
                      style={{ marginRight: 4 }}
                    >
                      全部
                    </Checkbox>
                    {allRegions.map(r => (
                      <Checkbox
                        key={r}
                        checked={selectedRegions.includes(r)}
                        onChange={() => setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                      >
                        {r}
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                          ({locations.filter(l => (l.region || '未分类') === r).length})
                        </Text>
                      </Checkbox>
                    ))}
                  </div>
                  {filteredLocations.length === 0 ? (
                    <Empty description="暂无地点数据" />
                  ) : (
                    <Row gutter={[12, 12]}>
                      {filteredLocations.map(location => {
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
                                    <InkTag
                                      key={f.id}
                                      color={PIGMENT.cyan}
                                      wash={false}
                                      style={{ cursor: 'pointer', marginBottom: 2 }}
                                      onClick={e => { e.stopPropagation(); showDetail('faction', f.id); }}
                                    >
                                      {f.name}
                                    </InkTag>
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
                  )}
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
