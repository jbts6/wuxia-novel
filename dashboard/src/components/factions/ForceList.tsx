import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Input, Select, Tabs } from 'antd';
import { TeamOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';
import { VirtuosoGrid } from 'react-virtuoso';
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

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          defaultActiveKey="factions"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          items={[
            {
              key: 'factions',
              label: <span><TeamOutlined /> 门派</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Select
                      mode="multiple"
                      placeholder="类型筛选"
                      allowClear
                      value={selectedFactionTypes}
                      onChange={setSelectedFactionTypes}
                      style={{ width: '100%' }}
                      maxTagCount="responsive"
                      options={allFactionTypes.map(t => ({
                        label: <span>{t} <Text type="secondary" style={{ fontSize: 11 }}>({factions.filter(f => (f.type || '其他') === t).length})</Text></span>,
                        value: t,
                      }))}
                    />
                  </div>
                  {filteredFactions.length === 0 ? (
                    <Empty description="暂无门派数据" />
                  ) : (
                    <VirtuosoGrid
                      totalCount={filteredFactions.length}
                      overscan={200}
                      computeItemKey={(index) => filteredFactions[index].id}
                      components={{
                        Item: ({ children, ...props }) => (
                          <div {...props} style={{ ...props.style, padding: '6px', boxSizing: 'border-box' }}>
                            {children}
                          </div>
                        ),
                        List: React.forwardRef(({ style, children, ...props }, ref) => (
                          <div
                            ref={ref}
                            {...props}
                            style={{
                              ...style,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                              gap: 12,
                            }}
                          >
                            {children}
                          </div>
                        )),
                      }}
                      itemContent={(index) => {
                        const faction = filteredFactions[index];
                        const location = locations.find(l => l.id === faction.location);
                        const members = characters.filter(c => c.faction === faction.id);
                        return (
                          <Card
                            size="small"
                            hoverable
                            onClick={() => showDetail('faction', faction.id)}
                            style={{ height: 160 }}
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
                        );
                      }}
                      style={{ height: '100%' }}
                    />
                  )}
                </div>
              )
            },
            {
              key: 'locations',
              label: <span><EnvironmentOutlined /> 地点</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Select
                      mode="multiple"
                      placeholder="区域筛选"
                      allowClear
                      value={selectedRegions}
                      onChange={setSelectedRegions}
                      style={{ width: '100%' }}
                      maxTagCount="responsive"
                      options={allRegions.map(r => ({
                        label: <span>{r} <Text type="secondary" style={{ fontSize: 11 }}>({locations.filter(l => (l.region || '未分类') === r).length})</Text></span>,
                        value: r,
                      }))}
                    />
                  </div>
                  {filteredLocations.length === 0 ? (
                    <Empty description="暂无地点数据" />
                  ) : (
                    <VirtuosoGrid
                      totalCount={filteredLocations.length}
                      overscan={200}
                      computeItemKey={(index) => filteredLocations[index].id}
                      components={{
                        Item: ({ children, ...props }) => (
                          <div {...props} style={{ ...props.style, padding: '6px', boxSizing: 'border-box' }}>
                            {children}
                          </div>
                        ),
                        List: React.forwardRef(({ style, children, ...props }, ref) => (
                          <div
                            ref={ref}
                            {...props}
                            style={{
                              ...style,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                              gap: 12,
                            }}
                          >
                            {children}
                          </div>
                        )),
                      }}
                      itemContent={(index) => {
                        const location = filteredLocations[index];
                        const relatedFactions = factions.filter(f => f.location === location.id);
                        return (
                          <Card
                            size="small"
                            hoverable
                            onClick={() => showDetail('location', location.id)}
                            style={{ height: 160 }}
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
                        );
                      }}
                      style={{ height: '100%' }}
                    />
                  )}
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

export default ForceList;
