import React, { useMemo, useState } from 'react';
import { Typography, Empty, Spin, Input, Select, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { ROLE_COLORS, RANK_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text } = Typography;

const rankOrder = [
  '返璞归真', '登峰造极', '出神入化', '炉火纯青',
  '登堂入室', '略有小成', '初窥门径', '平平无奇',
];

const roleLabel: Record<string, string> = {
  protagonist: '主角', companion: '同伴', npc: '配角', villain: '反派',
};

const resolveFactionName = (factionValue: string | null, factions: { id: string; name: string }[]): string => {
  if (!factionValue) return '无门派';
  const byId = factions.find(f => f.id === factionValue);
  if (byId) return byId.name;
  const byName = factions.find(f => f.name === factionValue);
  if (byName) return byName.name;
  return factionValue;
};

interface CharacterRow {
  id: string;
  name: string;
  alias: string[];
  role: string;
  powerRank: string;
  faction: string;
  factionName: string;
  identity: string;
}

const CharacterList: React.FC = () => {
  const { characters, factions, showDetail, loading } = useNovelStore();
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
    let result = characters;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.alias?.some(a => a.toLowerCase().includes(q)) ||
        c.identity?.toLowerCase().includes(q)
      );
    }
    if (selectedRoles.length > 0) {
      result = result.filter(c => selectedRoles.includes(c.role));
    }
    if (selectedRanks.length > 0) {
      result = result.filter(c => selectedRanks.includes(c.power_rank ?? c.rank));
    }
    if (selectedFactions.length > 0) {
      result = result.filter(c => selectedFactions.includes(c.faction || '_none'));
    }
    return result
      .sort((a, b) => {
        const ai = rankOrder.indexOf(a.power_rank ?? a.rank);
        const bi = rankOrder.indexOf(b.power_rank ?? b.rank);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(c => ({
        id: c.id,
        name: c.name,
        alias: c.alias || [],
        role: c.role,
        powerRank: c.power_rank ?? c.rank ?? '',
        faction: c.faction || '_none',
        factionName: resolveFactionName(c.faction, factions),
        identity: c.identity || c.one_line || '',
      }));
  }, [characters, search, selectedRoles, selectedRanks, selectedFactions, factions]);

  const columns: ColumnsType<CharacterRow> = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      fixed: 'left' as const,
      render: (name: string) => <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{name}</Text>,
    },
    {
      title: '别名',
      dataIndex: 'alias',
      width: 120,
      render: (alias: string[]) => (
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {alias?.slice(0, 2).join('、')}
        </Text>
      ),
    },
    {
      title: '身份',
      dataIndex: 'role',
      width: 80,
      render: (role: string) => (
        <InkTag color={ROLE_COLORS[role] || 'default'} wash={false} style={{ fontSize: 11 }}>
          {roleLabel[role] || role}
        </InkTag>
      ),
    },
    {
      title: '境界',
      dataIndex: 'powerRank',
      width: 100,
      render: (rank: string) => rank ? (
        <InkTag color={RANK_COLORS[rank] || 'default'} wash={false} style={{ fontSize: 11 }}>
          {rank}
        </InkTag>
      ) : null,
    },
    {
      title: '门派 / 简介',
      key: 'factionIdentity',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {row.faction !== '_none' && (
            <InkTag style={{ fontSize: 11, flexShrink: 0 }}>{row.factionName}</InkTag>
          )}
          <Text type="secondary" ellipsis style={{ fontSize: 12, marginBottom: 0 }}>
            {row.identity}
          </Text>
        </div>
      ),
    },
  ];

  if (loading) return <Spin size="large" />;
  if (characters.length === 0) return <Empty description="暂无角色数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder="搜索角色名、别名、身份..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Select
            mode="multiple"
            placeholder="身份筛选"
            allowClear
            value={selectedRoles}
            onChange={setSelectedRoles}
            style={{ width: '100%' }}
            maxTagCount="responsive"
            options={allRoles.map(r => ({
              label: <span><InkTag color={ROLE_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>{roleLabel[r] || r}</InkTag> <Text type="secondary" style={{ fontSize: 11 }}>({characters.filter(c => c.role === r).length})</Text></span>,
              value: r,
            }))}
          />
          <Select
            mode="multiple"
            placeholder="境界筛选"
            allowClear
            value={selectedRanks}
            onChange={setSelectedRanks}
            style={{ width: '100%' }}
            maxTagCount="responsive"
            options={allRanks.map(r => ({
              label: <span><InkTag color={RANK_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>{r}</InkTag></span>,
              value: r,
            }))}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <Select
            mode="multiple"
            placeholder="门派筛选"
            allowClear
            value={selectedFactions}
            onChange={setSelectedFactions}
            style={{ width: '100%' }}
            maxTagCount="responsive"
            options={allFactions.map(f => ({
              label: <span>{f.name} <Text type="secondary" style={{ fontSize: 11 }}>({f.count})</Text></span>,
              value: f.key,
            }))}
          />
        </div>
        <div style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>
          共 {dataSource.length} 个角色
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 500, y: 'calc(100vh - 280px)' }}
          pagination={false}
          onRow={(record) => ({
            onClick: () => showDetail('character', record.id),
            style: { cursor: 'pointer' },
          })}
        />
      </div>
    </div>
  );
};

export default CharacterList;
