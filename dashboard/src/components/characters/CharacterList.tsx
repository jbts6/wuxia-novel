import React, { useMemo, useState } from 'react';
import { Typography, Empty, Spin, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ReactWindow from 'react-window';
const VirtualList = ReactWindow.List;
import { useNovelStore } from '../../stores/useNovelStore';
import { ROLE_COLORS, RANK_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text } = Typography;

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 36;

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

const CharacterList: React.FC = () => {
  const { characters, factions, showDetail, loading } = useNovelStore();
  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedFactions, setSelectedFactions] = useState<string[]>([]);
  const [listHeight, setListHeight] = useState(600);

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

  const filtered = useMemo(() => {
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
    return result.sort((a, b) => {
      const ai = rankOrder.indexOf(a.power_rank ?? a.rank);
      const bi = rankOrder.indexOf(b.power_rank ?? b.rank);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [characters, search, selectedRoles, selectedRanks, selectedFactions]);

  React.useEffect(() => {
    const calcHeight = () => {
      const header = document.querySelector('[data-role="character-table"]')?.getBoundingClientRect();
      if (header) {
        setListHeight(Math.max(200, window.innerHeight - header.top - 40));
      }
    };
    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

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
          共 {filtered.length} 个角色
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <Empty description="无匹配角色" />
        ) : (
          <div data-role="character-table" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '100px 120px 80px 100px 1fr',
              gap: 0,
              padding: '0 12px',
              height: HEADER_HEIGHT,
              background: 'var(--paper-sunken)',
              borderBottom: '1px solid var(--ink-hairline)',
              fontWeight: 'bold',
              fontSize: 12,
              color: 'var(--ink-secondary)',
              fontFamily: 'var(--font-serif)',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>姓名</div>
              <div>别名</div>
              <div>身份</div>
              <div>境界</div>
              <div>门派 / 简介</div>
            </div>
            <VirtualList
              height={listHeight}
              width="100%"
              itemCount={filtered.length}
              itemSize={ROW_HEIGHT}
              overscanCount={20}
            >
              {({ index, style }) => {
                const char = filtered[index];
                const powerRank = char.power_rank ?? char.rank;
                const factionName = resolveFactionName(char.faction, factions);
                return (
                  <div
                    style={{ ...style, display: 'grid', gridTemplateColumns: '100px 120px 80px 100px 1fr', gap: 0, padding: '0 12px', borderBottom: '1px solid var(--ink-hairline)', fontSize: 13, alignItems: 'center' }}
                    onClick={() => showDetail('character', char.id)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-sunken)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{char.name}</Text>
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-secondary)' }}>
                      {char.alias?.slice(0, 2).join('、')}
                    </div>
                    <div>
                      <InkTag color={ROLE_COLORS[char.role] || 'default'} wash={false} style={{ fontSize: 11 }}>
                        {roleLabel[char.role] || char.role}
                      </InkTag>
                    </div>
                    <div>
                      {powerRank && (
                        <InkTag color={RANK_COLORS[powerRank] || 'default'} wash={false} style={{ fontSize: 11 }}>
                          {powerRank}
                        </InkTag>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {char.faction && (
                        <InkTag style={{ fontSize: 11, flexShrink: 0 }}>{factionName}</InkTag>
                      )}
                      <Text type="secondary" ellipsis style={{ fontSize: 12, marginBottom: 0 }}>
                        {char.identity || char.one_line}
                      </Text>
                    </div>
                  </div>
                );
              }}
            </VirtualList>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterList;
