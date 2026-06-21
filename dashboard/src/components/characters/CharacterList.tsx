import React, { useMemo, useState } from 'react';
import { Card, Typography, Empty, Spin, Input, Row, Col, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ROLE_COLORS, RANK_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';

const { Text, Paragraph } = Typography;

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

  if (loading) return <Spin size="large" />;
  if (characters.length === 0) return <Empty description="暂无角色数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder="搜索角色名、别名、身份..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>身份：</Text>
          <Checkbox
            checked={selectedRoles.length === 0}
            onChange={() => setSelectedRoles([])}
            style={{ marginRight: 4 }}
          >
            全部
          </Checkbox>
          {allRoles.map(r => (
            <Checkbox
              key={r}
              checked={selectedRoles.includes(r)}
              onChange={() => setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
            >
              <InkTag color={ROLE_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>
                {roleLabel[r] || r}
              </InkTag>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                ({characters.filter(c => c.role === r).length})
              </Text>
            </Checkbox>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>境界：</Text>
          <Checkbox
            checked={selectedRanks.length === 0}
            onChange={() => setSelectedRanks([])}
            style={{ marginRight: 4 }}
          >
            全部
          </Checkbox>
          {allRanks.map(r => (
            <Checkbox
              key={r}
              checked={selectedRanks.includes(r)}
              onChange={() => setSelectedRanks(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
            >
              <InkTag color={RANK_COLORS[r] || 'default'} wash={false} style={{ margin: 0 }}>{r}</InkTag>
            </Checkbox>
          ))}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>门派：</Text>
          <Checkbox
            checked={selectedFactions.length === 0}
            onChange={() => setSelectedFactions([])}
            style={{ marginRight: 4 }}
          >
            全部
          </Checkbox>
          {allFactions.map(f => (
            <Checkbox
              key={f.key}
              checked={selectedFactions.includes(f.key)}
              onChange={() => setSelectedFactions(prev => prev.includes(f.key) ? prev.filter(x => x !== f.key) : [...prev, f.key])}
            >
              {f.name}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                ({f.count})
              </Text>
            </Checkbox>
          ))}
        </div>
        <div style={{ marginTop: 8, color: 'var(--ink-secondary)', fontSize: 12 }}>
          共 {filtered.length} 个角色
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty description="无匹配角色" />
        ) : (
          <Row gutter={[12, 12]}>
            {filtered.map(char => {
              const powerRank = char.power_rank ?? char.rank;
              const factionName = resolveFactionName(char.faction, factions);
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={char.id}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => showDetail('character', char.id)}
                    style={{ height: '100%' }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{char.name}</Text>
                      {powerRank && (
                        <InkTag color={RANK_COLORS[powerRank] || 'default'} wash={false} style={{ marginLeft: 8 }}>
                          {powerRank}
                        </InkTag>
                      )}
                    </div>
                    {char.alias?.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        {char.alias.slice(0, 2).map(a => <InkTag key={a} style={{ fontSize: 11 }}>{a}</InkTag>)}
                      </div>
                    )}
                    <div style={{ marginBottom: 4 }}>
                      {char.faction && (
                        <InkTag style={{ fontSize: 11 }}>{factionName}</InkTag>
                      )}
                      <InkTag color={ROLE_COLORS[char.role] || 'default'} wash={false} style={{ fontSize: 11 }}>
                        {roleLabel[char.role] || char.role}
                      </InkTag>
                    </div>
                    <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                      {char.identity || char.one_line}
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

export default CharacterList;
