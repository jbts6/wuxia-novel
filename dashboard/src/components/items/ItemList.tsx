import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Input, Row, Col, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { RARITY_COLORS, INK } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

const rarityOrder = ['绝世神兵', '稀世珍品', '上乘佳品', '寻常凡品', '未分类'];

const ItemList: React.FC = () => {
  const { items, characters, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);

  const typeLabel: Record<string, string> = {
    weapon: '武器', armor: '护甲', pill: '丹药', poison: '毒药', hidden_weapon: '暗器', special: '特殊',
  };

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.type || '未分类'));
    return Array.from(set);
  }, [items]);

  const allRarities = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.rarity_tier || '未分类'));
    return rarityOrder.filter(r => set.has(r));
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.type?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      );
    }
    if (selectedRarities.length > 0) {
      result = result.filter(i => selectedRarities.includes(i.rarity_tier || '未分类'));
    }
    if (selectedTypes.length > 0) {
      result = result.filter(i => selectedTypes.includes(i.type || '未分类'));
    }
    return result.sort((a, b) => {
      const ai = rarityOrder.indexOf(a.rarity_tier || '未分类');
      const bi = rarityOrder.indexOf(b.rarity_tier || '未分类');
      return ai - bi;
    });
  }, [items, search, selectedRarities, selectedTypes]);

  if (loading) return <Spin size="large" />;
  if (items.length === 0) return <Empty description="暂无物品数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder="搜索物品名、类型..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
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
              {typeLabel[t] || t}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                ({items.filter(i => (i.type || '未分类') === t).length})
              </Text>
            </Checkbox>
          ))}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>品阶：</Text>
          <Checkbox
            checked={selectedRarities.length === 0}
            onChange={() => setSelectedRarities([])}
            style={{ marginRight: 4 }}
          >
            全部
          </Checkbox>
          {allRarities.map(r => (
            <Checkbox
              key={r}
              checked={selectedRarities.includes(r)}
              onChange={() => setSelectedRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
            >
              <InkTag color={RARITY_COLORS[r] || INK.faint} wash={false} style={{ margin: 0 }}>{r}</InkTag>
            </Checkbox>
          ))}
        </div>
        <div style={{ marginTop: 8, color: 'var(--ink-secondary)', fontSize: 12 }}>
          共 {filtered.length} 件物品
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty description="无匹配项" />
        ) : (
          <Row gutter={[12, 12]}>
            {filtered.map(item => {
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
                      <InkTag color={RARITY_COLORS[item.rarity_tier] || INK.faint} wash={false} style={{ marginLeft: 8 }}>
                        {typeLabel[item.type] || item.type}
                      </InkTag>
                    </div>
                    {owner && (
                      <div style={{ marginBottom: 4 }}>
                        <InkTag color={RARITY_COLORS[item.rarity_tier] || INK.faint} wash={false} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); showDetail('character', owner.id); }}>
                          {owner.name}
                        </InkTag>
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
        )}
      </div>
    </div>
  );
};

export default ItemList;
