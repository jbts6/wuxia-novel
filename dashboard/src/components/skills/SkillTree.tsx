import React, { useMemo, useState } from 'react';
import { Empty, Spin, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { getRankColor, getSkillRank, getSkillType } from '../../utils/skillDisplay';
import { ENTITY_COLORS } from '../../theme/palette';
import InkTag from '../common/InkTag';
import { EntityTableLayout, type FilterConfig } from '../common/EntityTable';
import { nameColumn, typeColumn, rankColumn, summaryColumn } from '../common/entityColumns';
import { buildSkillRows, SKILL_RANK_ORDER, type SkillRow } from './skillRows';

const { Text } = Typography;

const SkillTree: React.FC = () => {
  const skills = useNovelStore((s) => s.skills);
  const characters = useNovelStore((s) => s.characters);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);

  const allTypes = useMemo(() => {
    const counts = new Map<string, number>();
    skills.forEach(s => {
      const t = getSkillType(s);
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [skills]);

  const allRanks = useMemo(() => {
    const set = new Set<string>();
    skills.forEach(s => set.add(getSkillRank(s)));
    return SKILL_RANK_ORDER.filter(r => set.has(r));
  }, [skills]);

  const dataSource = useMemo<SkillRow[]>(() => {
    return buildSkillRows(skills, characters, {
      search,
      types: selectedTypes,
      ranks: selectedRanks,
    });
  }, [skills, search, selectedTypes, selectedRanks, characters]);

  const columns: ColumnsType<SkillRow> = useMemo(() => [
    nameColumn<SkillRow>(),
    typeColumn<SkillRow>(),
    rankColumn<SkillRow>('境界', {
      '返璞归真': 'red', '登峰造极': 'red', '出神入化': 'gold',
      '炉火纯青': 'green', '登堂入室': 'purple', '略有小成': 'cyan',
      '初窥门径': 'default', '平平无奇': 'default',
    }),
    {
      title: '招式',
      dataIndex: 'techniqueNames',
      width: 200,
      render: (names: string, row) => (
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {row.techniqueCount > 0 ? `${names}（${row.techniqueCount}）` : '—'}
        </Text>
      ),
    },
    {
      title: '掌握者',
      dataIndex: 'holderNames',
      width: 240,
      render: (_: string, row) => {
        if (!row.holderNames) return null;
        const display = row.holderIds.slice(0, 2);
        const rest = row.holderIds.length - display.length;
        return (
          <span>
            {display.map(id => {
              const char = characters.find(c => c.id === id);
              return char ? (
                <InkTag
                  key={id}
                  color={ENTITY_COLORS.character}
                  wash={false}
                  style={{ fontSize: 11, cursor: 'pointer', marginRight: 4 }}
                  onClick={(e) => { e.stopPropagation(); showDetail('character', id); }}
                >
                  {char.name}
                </InkTag>
              ) : null;
            })}
            {rest > 0 && <Text type="secondary" style={{ fontSize: 11 }}>+{rest}</Text>}
          </span>
        );
      },
    },
    summaryColumn<SkillRow>(),
  ], [characters, showDetail]);

  if (loading) return <Spin size="large" />;
  if (skills.length === 0) return <Empty description="暂无技能数据" />;

  const rankColorMap: Record<string, string> = {};
  SKILL_RANK_ORDER.forEach(r => { rankColorMap[r] = getRankColor(r); });

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
      placeholder: '境界筛选',
      value: selectedRanks,
      onChange: setSelectedRanks,
      options: allRanks.map(r => ({
        label: <InkTag color={getRankColor(r)} wash={false} style={{ margin: 0 }}>{r}</InkTag>,
        value: r,
      })),
    },
  ];

  return (
    <EntityTableLayout<SkillRow>
      searchPlaceholder="搜索武功名、简介..."
      searchValue={search}
      onSearchChange={setSearch}
      filters={filters}
      count={dataSource.length}
      countLabel="项武功"
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      onRow={(record) => ({
        onClick: () => showDetail('skill', record.id),
        style: { cursor: 'pointer' },
      })}
    />
  );
};

export default SkillTree;
