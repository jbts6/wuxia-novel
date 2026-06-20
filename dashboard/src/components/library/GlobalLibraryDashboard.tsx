import React, { useEffect, useMemo } from 'react';
import { Empty, Segmented, Spin, Typography } from 'antd';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import type { LibraryRecord, LibrarySection } from '../../types/library';
import { annotateRecords } from '../../utils/libraryAnnotations';
import { filterCharacters, filterFactions, filterItems, filterSkills, getUniqueFilterValues } from '../../utils/libraryFilters';
import { isLegendaryItem, isTopTierSkill } from '../../utils/libraryAggregate';
import LibraryDetailDrawer from './LibraryDetailDrawer';
import LibraryExportPanel from './LibraryExportPanel';
import LibraryFiltersPanel from './LibraryFilters';
import LibraryRecordTable from './LibraryRecordTable';
import LibrarySummary from './LibrarySummary';

const { Paragraph, Title } = Typography;

const SECTION_OPTIONS: Array<{ label: string; value: LibrarySection }> = [
  { label: '总览', value: 'overview' },
  { label: '顶级武功', value: 'skills' },
  { label: '人物原型', value: 'characters' },
  { label: '门派资源', value: 'factions' },
  { label: '神兵物品', value: 'items' },
  { label: '导出', value: 'export' },
];

const GlobalLibraryDashboard: React.FC = () => {
  const books = useBookStore((state) => state.books);
  const data = useLibraryData(books);
  const {
    section,
    setSection,
    filters,
    setFilters,
    resetFilters,
    selectRecord,
    annotations,
    hydrateAnnotations,
  } = useLibraryStore();

  useEffect(() => {
    hydrateAnnotations();
  }, [hydrateAnnotations]);

  const collections = useMemo(() => ({
    skills: data.skills,
    characters: data.characters,
    factions: data.factions,
    items: data.items,
  }), [data.characters, data.factions, data.items, data.skills]);

  const filterOptions = useMemo(() => ({
    masteryRank: getUniqueFilterValues(data.skills.map((record) => record.entity.mastery_rank ?? record.entity.rank)),
    powerRank: getUniqueFilterValues(data.characters.map((record) => record.entity.power_rank ?? record.entity.rank)),
    importance: getUniqueFilterValues(data.characters.map((record) => record.entity.importance)),
    author: getUniqueFilterValues(books.map((book) => book.author)),
    bookPath: books.map((book) => ({ label: `${book.author} / ${book.name}`, value: book.path })),
    type: getUniqueFilterValues([
      ...data.skills.map((record) => record.entity.type),
      ...data.factions.map((record) => record.entity.type),
      ...data.items.map((record) => record.entity.type),
    ]),
    faction: getUniqueFilterValues([
      ...data.skills.map((record) => record.entity.faction),
      ...data.characters.map((record) => record.entity.faction),
    ]),
    role: getUniqueFilterValues(data.characters.map((record) => record.entity.role)),
    archetype: getUniqueFilterValues(data.characters.map((record) => record.entity.archetype)),
    rarityTier: getUniqueFilterValues(data.items.map((record) => record.entity.rarity_tier ?? record.entity.rarity)),
  }), [books, data.characters, data.factions, data.items, data.skills]);

  const topSkills = useMemo(
    () => filterSkills(data.skills.filter((record) => isTopTierSkill(record.entity)), filters),
    [data.skills, filters],
  );
  const characters = useMemo(() => filterCharacters(data.characters, filters), [data.characters, filters]);
  const factions = useMemo(() => filterFactions(data.factions, filters), [data.factions, filters]);
  const legendaryItems = useMemo(
    () => filterItems(data.items.filter((record) => isLegendaryItem(record.entity)), filters),
    [data.items, filters],
  );
  const exportRecords = useMemo(
    () => annotateRecords(
      [...topSkills, ...characters, ...factions, ...legendaryItems] as LibraryRecord<unknown>[],
      annotations,
    ),
    [annotations, characters, factions, legendaryItems, topSkills],
  );

  if (data.loading) return <Spin size="large" />;
  if (data.error) return <Empty description={data.error} />;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>全库总览</Title>
        <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
          跨作品整理武功、人物原型、门派资源和神兵物品，为游戏设计提供可筛选素材。
        </Paragraph>
      </div>
      <Segmented
        options={SECTION_OPTIONS}
        value={section}
        onChange={(value) => setSection(value as LibrarySection)}
        style={{ marginBottom: 20 }}
      />
      <LibrarySummary collections={collections} warnings={data.warnings} />
      {section !== 'overview' && section !== 'export' && (
        <LibraryFiltersPanel
          filters={filters}
          options={filterOptions}
          onChange={setFilters}
          onReset={resetFilters}
        />
      )}
      {section === 'skills' && <LibraryRecordTable records={annotateRecords(topSkills, annotations)} onOpen={selectRecord} />}
      {section === 'characters' && <LibraryRecordTable records={annotateRecords(characters, annotations)} onOpen={selectRecord} />}
      {section === 'factions' && <LibraryRecordTable records={annotateRecords(factions, annotations)} onOpen={selectRecord} />}
      {section === 'items' && <LibraryRecordTable records={annotateRecords(legendaryItems, annotations)} onOpen={selectRecord} />}
      {section === 'export' && <LibraryExportPanel records={exportRecords} />}
      {section === 'overview' && <LibraryRecordTable records={annotateRecords(topSkills.slice(0, 20), annotations)} onOpen={selectRecord} />}
      <LibraryDetailDrawer collections={collections} />
    </div>
  );
};

export default GlobalLibraryDashboard;
