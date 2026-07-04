import React, { useMemo, useState } from 'react';
import { Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { RARITY_COLORS, INK } from '../../theme/palette';
import InkTag from '../common/InkTag';
import { EntityTableLayout, type FilterConfig } from '../common/EntityTable';
import { nameColumn, typeColumn, summaryColumn } from '../common/entityColumns';
import { buildItemRows, ITEM_RARITY_ORDER, ITEM_TYPE_ORDER, normalizeItemType, type ItemRow } from './itemRows';

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
      const t = normalizeItemType(i.type);
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return ITEM_TYPE_ORDER.filter(t => counts.has(t)).map(t => [t, counts.get(t)!] as [string, number]);
  }, [items]);

  const allRarities = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.rarity_tier || '未分类'));
    return ITEM_RARITY_ORDER.filter(r => set.has(r));
  }, [items]);

  const dataSource = useMemo<ItemRow[]>(() => {
    return buildItemRows(items, characters, {
      search,
      types: selectedTypes,
      rarities: selectedRarities,
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
      onRow={(record) => ({
        onClick: () => showDetail('item', record.id),
        style: { cursor: 'pointer' },
      })}
    />
  );
};

export default ItemList;
