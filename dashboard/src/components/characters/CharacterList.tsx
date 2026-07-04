import React, { useMemo, useState } from 'react';
import { Empty, Spin, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { ROLE_COLORS, RANK_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';
import { EntityTableLayout, type FilterConfig } from '../common/EntityTable';
import { nameColumn, rankColumn, summaryColumn } from '../common/entityColumns';
import { buildCharacterRows, resolveFactionName, type CharacterRow } from './characterRows';

const { Text } = Typography;

const rankOrder = [
  '返璞归真', '登峰造极', '出神入化', '炉火纯青',
  '登堂入室', '略有小成', '初窥门径', '平平无奇',
];

const roleLabel: Record<string, string> = {
  protagonist: '主角', companion: '同伴', npc: '配角', villain: '反派',
};

const CharacterList: React.FC = () => {
  const characters = useNovelStore((s) => s.characters);
  const factions = useNovelStore((s) => s.factions);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedFactions, setSelectedFactions] = useState<string[]>([]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    characters.forEach(c => set.add(c.role));
    return Array.from(set);
  }, [characters]);

  const allRanks = useMemo(() => {
    const set = new Set<string>();
    characters.forEach(c => {
      const r = c.power_rank ?? c.rank;
      if (r) set.add(r);
    });
    return rankOrder.filter(r => set.has(r));
  }, [characters]);

  const allFactions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    characters.forEach(c => {
      const key = c.faction || '_none';
      const name = resolveFactionName(c.faction, factions);
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { key, name, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [characters, factions]);

  const dataSource = useMemo<CharacterRow[]>(() => {
    return buildCharacterRows(characters, factions, {
      search,
      roles: selectedRoles,
      ranks: selectedRanks,
      factions: selectedFactions,
    });
  }, [characters, search, selectedRoles, selectedRanks, selectedFactions, factions]);

  const columns: ColumnsType<CharacterRow> = useMemo(() => [
    nameColumn<CharacterRow>(),
    {
      title: '别名',
      dataIndex: 'alias',
      width: 200,
      render: (alias: string[]) => (
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {alias?.slice(0, 2).join('、')}
        </Text>
      ),
    },
    {
      title: '身份',
      dataIndex: 'role',
      width: 120,
      render: (role: string) => (
        <InkTag color={ROLE_COLORS[role] || 'default'} wash={false} style={{ fontSize: 11 }}>
          {roleLabel[role] || role}
        </InkTag>
      ),
    },
    rankColumn<CharacterRow>('境界', RANK_COLORS),
    {
      title: '门派',
      dataIndex: 'factionName',
      width: 140,
      render: (name: string, row) => row.faction !== '_none' ? (
        <InkTag wash={false} style={{ fontSize: 11 }}>{name}</InkTag>
      ) : null,
    },
    summaryColumn<CharacterRow>(),
  ], []);

  if (loading) return <Spin size="large" />;
  if (characters.length === 0) return <Empty description="暂无角色数据" />;

  const filters: FilterConfig[] = [
    {
      placeholder: '身份筛选',
      value: selectedRoles,
      onChange: setSelectedRoles,
      options: allRoles.map(r => ({
        label: <span><InkTag color={ROLE_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>{roleLabel[r] || r}</InkTag> <Text type="secondary" style={{ fontSize: 11 }}>({characters.filter(c => c.role === r).length})</Text></span>,
        value: r,
      })),
    },
    {
      placeholder: '境界筛选',
      value: selectedRanks,
      onChange: setSelectedRanks,
      options: allRanks.map(r => ({
        label: <span><InkTag color={RANK_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>{r}</InkTag></span>,
        value: r,
      })),
    },
    {
      placeholder: '门派筛选',
      value: selectedFactions,
      onChange: setSelectedFactions,
      options: allFactions.map(f => ({
        label: <span>{f.name} <Text type="secondary" style={{ fontSize: 11 }}>({f.count})</Text></span>,
        value: f.key,
      })),
    },
  ];

  return (
    <EntityTableLayout<CharacterRow>
      searchPlaceholder="搜索角色名、别名、身份..."
      searchValue={search}
      onSearchChange={setSearch}
      filters={filters}
      count={dataSource.length}
      countLabel="个角色"
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      onRow={(record) => ({
        onClick: () => showDetail('character', record.id),
        style: { cursor: 'pointer' },
      })}
    />
  );
};

export default CharacterList;
