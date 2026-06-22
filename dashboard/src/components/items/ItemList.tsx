import React, { useMemo, useState } from 'react';
import { Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { RARITY_COLORS, INK } from '../../theme/palette';
import InkTag from '../common/InkTag';
import { EntityTableLayout, type FilterConfig } from '../common/EntityTable';
import { nameColumn, typeColumn, summaryColumn } from '../common/entityColumns';

const rarityOrder = ['绝世神兵', '稀世珍品', '上乘佳品', '寻常凡品', '未分类'];

const TYPE_MAP: Record<string, string> = {
  weapon: '兵器', '兵器': '兵器', '随身利器': '兵器', siege_weapon: '兵器',
  hidden_weapon: '暗器', '暗器': '暗器', '兵器暗器': '暗器',
  pill: '丹药', medicine: '丹药', '丹药': '丹药', '药瓶': '丹药', '毒草兼解药': '丹药',
  poison: '毒药', '毒药': '毒药', '毒物': '毒药',
  armor: '防具', clothing: '防具', '防具': '防具', '衣饰': '防具',
  '饰物': '饰品', accessory: '饰品', '首饰': '饰品', '剑饰': '饰品',
  '食物': '食物',
  tool: '工具', training_tool: '工具', trap: '工具', formation: '工具', '临时工具': '工具',
  '场景物': '场景', '建筑构件': '场景', '碑刻': '场景', '墓碑': '场景',
  '花木': '场景', '花架藤蔓': '场景', '树木': '场景', '包扎物': '场景', '旧事物件': '场景',
  message: '信物', '书信': '信物', '图卷': '信物', '经书': '信物',
  mount: '坐骑', '灵禽': '坐骑',
  special: '特殊', '特殊': '特殊', '随身器物': '特殊', '随身物': '特殊',
  '军旗': '特殊', '威胁标记': '特殊',
};

const typeOrder = ['兵器', '暗器', '防具', '饰品', '丹药', '毒药', '工具', '坐骑', '信物', '食物', '场景', '特殊', '未分类'];

const normalizeType = (raw: string) => TYPE_MAP[raw] || raw || '未分类';

interface ItemRow {
  id: string;
  name: string;
  type: string;
  rank: string;
  ownerName: string;
  ownerId: string | null;
  summary: string;
}

const ItemList: React.FC = () => {
  const items = useNovelStore((s) => s.items);
  const characters = useNovelStore((s) => s.characters);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);

  const allTypes = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(i => {
      const t = normalizeType(i.type);
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return typeOrder.filter(t => counts.has(t)).map(t => [t, counts.get(t)!] as [string, number]);
  }, [items]);

  const allRarities = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.rarity_tier || '未分类'));
    return rarityOrder.filter(r => set.has(r));
  }, [items]);

  const dataSource = useMemo<ItemRow[]>(() => {
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
      result = result.filter(i => selectedTypes.includes(normalizeType(i.type)));
    }
    return [...result]
      .sort((a, b) => {
        const ai = rarityOrder.indexOf(a.rarity_tier || '未分类');
        const bi = rarityOrder.indexOf(b.rarity_tier || '未分类');
        return ai - bi;
      })
      .map(i => {
        const owner = characters.find(c => c.id === i.owner);
        return {
          id: i.id,
          name: i.name,
          type: normalizeType(i.type),
          rank: i.rarity_tier || '未分类',
          ownerName: owner?.name ?? '',
          ownerId: owner?.id ?? null,
          summary: i.one_line || i.description || '',
        };
      });
  }, [items, search, selectedRarities, selectedTypes, characters]);

  const columns: ColumnsType<ItemRow> = useMemo(() => [
    nameColumn<ItemRow>(),
    typeColumn<ItemRow>(),
    {
      title: '品阶',
      dataIndex: 'rank',
      width: 100,
      render: (rank: string) => (
        <InkTag color={RARITY_COLORS[rank] || INK.faint} wash={false} style={{ fontSize: 11 }}>
          {rank}
        </InkTag>
      ),
    },
    {
      title: '持有者',
      dataIndex: 'ownerName',
      width: 140,
      render: (name: string, row) => name ? (
        <InkTag
          color="cyan"
          wash={false}
          style={{ fontSize: 11, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); if (row.ownerId) showDetail('character', row.ownerId); }}
        >
          {name}
        </InkTag>
      ) : null,
    },
    summaryColumn<ItemRow>(),
  ], [showDetail]);

  if (loading) return <Spin size="large" />;
  if (items.length === 0) return <Empty description="暂无物品数据" />;

  const filters: FilterConfig[] = [
    {
      placeholder: '类型筛选',
      value: selectedTypes,
      onChange: setSelectedTypes,
      options: allTypes.map(([t, count]) => ({
        label: <span>{t} <span style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>({count})</span></span>,
        value: t,
      })),
    },
    {
      placeholder: '品阶筛选',
      value: selectedRarities,
      onChange: setSelectedRarities,
      options: allRarities.map(r => ({
        label: <InkTag color={RARITY_COLORS[r] || INK.faint} wash={false} style={{ margin: 0 }}>{r}</InkTag>,
        value: r,
      })),
    },
  ];

  return (
    <EntityTableLayout<ItemRow>
      searchPlaceholder="搜索物品名、类型..."
      searchValue={search}
      onSearchChange={setSearch}
      filters={filters}
      count={dataSource.length}
      countLabel="件物品"
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      scrollX={600}
      onRow={(record) => ({
        onClick: () => showDetail('item', record.id),
        style: { cursor: 'pointer' },
      })}
    />
  );
};

export default ItemList;
