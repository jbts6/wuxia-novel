import React, { useMemo, useState } from 'react';
import { Card, Tag, Typography, Empty, Spin, Input, Row, Col } from 'antd';
import { ToolOutlined, SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

const ItemList: React.FC = () => {
  const { items, characters, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.type?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const groupedByRarity = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(i => {
      const r = i.rarity || '未分类';
      if (!groups[r]) groups[r] = [];
      groups[r].push(i);
    });
    const order = ['绝世神兵', '稀世珍品', '上乘佳品', '寻常凡品', '未分类'];
    return order.filter(k => groups[k]?.length > 0).map(k => ({ rarity: k, items: groups[k] }));
  }, [filtered]);

  const rarityColor: Record<string, string> = {
    '绝世神兵': 'red', '稀世珍品': 'orange', '上乘佳品': 'blue', '寻常凡品': 'default',
  };

  const typeLabel: Record<string, string> = {
    weapon: '武器', armor: '护甲', pill: '丹药', poison: '毒药', hidden_weapon: '暗器', special: '特殊',
  };

  if (loading) return <Spin size="large" />;
  if (items.length === 0) return <Empty description="暂无物品数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
          placeholder="搜索物品名、类型..."
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <div style={{ marginTop: 8, color: 'var(--ink-secondary)' }}>共 {filtered.length} 件物品</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groupedByRarity.map(({ rarity, items: rarityItems }) => (
          <Card
            key={rarity}
            size="small"
            title={<span><ToolOutlined style={{ marginRight: 8 }} />{rarity}<Tag style={{ marginLeft: 8 }}>{rarityItems.length}件</Tag></span>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[12, 12]}>
              {rarityItems.map(item => {
                const owner = characters.find(c => c.id === item.owner);
                return (
                  <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => showDetail('item', item.id)}
                      style={{ height: '100%' }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <Text strong>{item.name}</Text>
                        <Tag color={rarityColor[item.rarity] || 'default'} style={{ marginLeft: 8 }}>
                          {typeLabel[item.type] || item.type}
                        </Tag>
                      </div>
                      {owner && (
                        <div style={{ marginBottom: 4 }}>
                          <Tag color="blue" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); showDetail('character', owner.id); }}>
                            {owner.name}
                          </Tag>
                        </div>
                      )}
                      <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                        {item.one_line || item.description}
                      </Paragraph>
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

export default ItemList;
