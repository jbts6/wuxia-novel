import React, { useMemo, useState } from 'react';
import { Empty, Spin, Tabs, Typography } from 'antd';
import { TeamOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNovelStore } from '../../stores/useNovelStore';
import { PIGMENT } from '../../theme/palette';
import InkTag from '../common/InkTag';
import { EntityTableLayout, type FilterConfig } from '../common/EntityTable';
import { nameColumn, typeColumn, summaryColumn } from '../common/entityColumns';

const { Text } = Typography;

/* ── 门派 ── */
interface FactionRow {
  id: string;
  name: string;
  type: string;
  locationName: string;
  locationId: string | null;
  memberNames: string;
  memberCount: number;
  summary: string;
}

/* ── 地点 ── */
interface LocationRow {
  id: string;
  name: string;
  region: string;
  factionNames: string;
  factionIds: string[];
  summary: string;
}

const ForceList: React.FC = () => {
  const factions = useNovelStore((s) => s.factions);
  const locations = useNovelStore((s) => s.locations);
  const characters = useNovelStore((s) => s.characters);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [search, setSearch] = useState('');
  const [selectedFactionTypes, setSelectedFactionTypes] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  /* ── 选项 ── */
  const allFactionTypes = useMemo(() => {
    const counts = new Map<string, number>();
    factions.forEach(f => {
      const t = f.type || '其他';
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [factions]);

  const allRegions = useMemo(() => {
    const counts = new Map<string, number>();
    locations.forEach(l => {
      const r = l.region || '未分类';
      counts.set(r, (counts.get(r) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [locations]);

  /* ── 门派数据 ── */
  const factionData = useMemo<FactionRow[]>(() => {
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
    return result.map(f => {
      const loc = locations.find(l => l.id === f.location);
      const members = characters.filter(c => c.faction === f.id);
      return {
        id: f.id,
        name: f.name,
        type: f.type || '其他',
        locationName: loc?.name ?? '',
        locationId: loc?.id ?? null,
        memberNames: members.map(m => m.name).join('、'),
        memberCount: members.length,
        summary: f.one_line || '',
      };
    });
  }, [factions, search, selectedFactionTypes, locations, characters]);

  /* ── 地点数据 ── */
  const locationData = useMemo<LocationRow[]>(() => {
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
    return result.map(l => {
      const related = factions.filter(f => f.location === l.id);
      return {
        id: l.id,
        name: l.name,
        region: l.region || '未分类',
        factionNames: related.map(f => f.name).join('、'),
        factionIds: related.map(f => f.id),
        summary: l.one_line || '',
      };
    });
  }, [locations, search, selectedRegions, factions]);

  /* ── 门派列 ── */
  const factionColumns: ColumnsType<FactionRow> = useMemo(() => [
    nameColumn<FactionRow>(),
    typeColumn<FactionRow>(),
    {
      title: '所在地',
      dataIndex: 'locationName',
      width: 140,
      render: (name: string, row) => name ? (
        <InkTag
          color="purple"
          wash={false}
          style={{ fontSize: 11, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); if (row.locationId) showDetail('location', row.locationId); }}
        >
          {name}
        </InkTag>
      ) : null,
    },
    {
      title: '成员',
      dataIndex: 'memberNames',
      width: 200,
      render: (names: string, row) => names ? (
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {row.memberCount > 3 ? `${names.slice(0, 20)}… 等${row.memberCount}人` : names}
        </Text>
      ) : null,
    },
    summaryColumn<FactionRow>(),
  ], [showDetail]);

  /* ── 地点列 ── */
  const locationColumns: ColumnsType<LocationRow> = useMemo(() => [
    nameColumn<LocationRow>(),
    {
      title: '区域',
      dataIndex: 'region',
      width: 120,
      render: (region: string) => <InkTag wash={false} style={{ fontSize: 11 }}>{region}</InkTag>,
    },
    {
      title: '关联门派',
      dataIndex: 'factionNames',
      width: 220,
      render: (_: string, row) => {
        if (!row.factionNames) return null;
        const display = row.factionIds.slice(0, 3);
        const rest = row.factionIds.length - display.length;
        return (
          <span>
            {display.map(id => {
              const f = factions.find(f => f.id === id);
              return f ? (
                <InkTag
                  key={id}
                  color="cyan"
                  wash={false}
                  style={{ fontSize: 11, cursor: 'pointer', marginRight: 4 }}
                  onClick={(e) => { e.stopPropagation(); showDetail('faction', id); }}
                >
                  {f.name}
                </InkTag>
              ) : null;
            })}
            {rest > 0 && <Text type="secondary" style={{ fontSize: 11 }}>+{rest}</Text>}
          </span>
        );
      },
    },
    summaryColumn<LocationRow>(),
  ], [factions, showDetail]);

  if (loading) return <Spin size="large" />;

  const factionFilters: FilterConfig[] = [
    {
      placeholder: '类型筛选',
      value: selectedFactionTypes,
      onChange: setSelectedFactionTypes,
      options: allFactionTypes.map(([t, count]) => ({
        label: <span>{t} <Text type="secondary" style={{ fontSize: 11 }}>({count})</Text></span>,
        value: t,
      })),
    },
  ];

  const locationFilters: FilterConfig[] = [
    {
      placeholder: '区域筛选',
      value: selectedRegions,
      onChange: setSelectedRegions,
      options: allRegions.map(([r, count]) => ({
        label: <span>{r} <Text type="secondary" style={{ fontSize: 11 }}>({count})</Text></span>,
        value: r,
      })),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        defaultActiveKey="factions"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        items={[
          {
            key: 'factions',
            label: <span><TeamOutlined /> 门派</span>,
            children: (
              <EntityTableLayout<FactionRow>
                searchPlaceholder="搜索门派名、类型..."
                searchValue={search}
                onSearchChange={setSearch}
                filters={factionFilters}
                count={factionData.length}
                countLabel="个门派"
                columns={factionColumns}
                dataSource={factionData}
                rowKey="id"
                scrollX={700}
                onRow={(record) => ({
                  onClick: () => showDetail('faction', record.id),
                  style: { cursor: 'pointer' },
                })}
              />
            ),
          },
          {
            key: 'locations',
            label: <span><EnvironmentOutlined /> 地点</span>,
            children: (
              <EntityTableLayout<LocationRow>
                searchPlaceholder="搜索地点名、区域..."
                searchValue={search}
                onSearchChange={setSearch}
                filters={locationFilters}
                count={locationData.length}
                countLabel="个地点"
                columns={locationColumns}
                dataSource={locationData}
                rowKey="id"
                scrollX={600}
                onRow={(record) => ({
                  onClick: () => showDetail('location', record.id),
                  style: { cursor: 'pointer' },
                })}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default ForceList;
