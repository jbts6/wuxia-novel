import React, { useCallback, useEffect, useMemo } from 'react';
import { Empty, Segmented, Spin, Typography } from 'antd';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import type { LibraryMaterialType, LibraryRecord, LibrarySection } from '../../types/library';
import { annotateRecords } from '../../utils/libraryAnnotations';
import { filterCharacters, filterFactions, filterItems, filterSkills, getUniqueFilterValues, sortByRank } from '../../utils/libraryFilters';
import { isLegendaryItem, isTopTierSkill } from '../../utils/libraryAggregate';
import { mergeCharacterRecords } from '../../utils/libraryMerge';
import LibraryDetailDrawer from './LibraryDetailDrawer';
import LibraryFiltersPanel from './LibraryFilters';
import LibraryRecordTable from './LibraryRecordTable';
import LibrarySummary from './LibrarySummary';
import MergedCharacterTable from './MergedCharacterTable';

const SECTION_MATERIAL_MAP: Record<LibrarySection, LibraryMaterialType> = {
  overview: 'all',
  skills: 'skill',
  characters: 'character',
  factions: 'faction',
  items: 'item',
};

const { Paragraph, Title } = Typography;

const SECTION_OPTIONS: Array<{ label: string; value: LibrarySection }> = [
  { label: '总览', value: 'overview' },
  { label: '顶级武功', value: 'skills' },
  { label: '人物原型', value: 'characters' },
  { label: '门派资源', value: 'factions' },
  { label: '神兵物品', value: 'items' },
];

const GlobalLibraryDashboard: React.FC = () => {
  const books = useBookStore((state) => state.books);
  const data = useLibraryData(books);
  const section = useLibraryStore((s) => s.section);
  const setSection = useLibraryStore((s) => s.setSection);
  const filters = useLibraryStore((s) => s.filters);
  const setFilters = useLibraryStore((s) => s.setFilters);
  const resetFilters = useLibraryStore((s) => s.resetFilters);
  const selectRecord = useLibraryStore((s) => s.selectRecord);
  const annotations = useLibraryStore((s) => s.annotations);
  const hydrateAnnotations = useLibraryStore((s) => s.hydrateAnnotations);

  const handleOpen = useCallback((key: string) => selectRecord(key), [selectRecord]);

  useEffect(() => {
    hydrateAnnotations();
  }, [hydrateAnnotations]);

  useEffect(() => {
    const materialType = SECTION_MATERIAL_MAP[section];
    if (filters.materialType !== materialType) {
      setFilters({ materialType, masteryRank: [], powerRank: [], importance: [], rarityTier: [], type: [] });
    }
  }, [filters.materialType, section, setFilters]);

  const collections = useMemo(() => ({
    skills: data.skills,
    characters: data.characters,
    factions: data.factions,
    items: data.items,
  }), [data.characters, data.factions, data.items, data.skills]);

  const filterOptions = useMemo(() => ({
    masteryRank: sortByRank(getUniqueFilterValues(data.skills.map((record) => record.entity.mastery_rank ?? record.entity.rank))),
    powerRank: sortByRank(getUniqueFilterValues(data.characters.map((record) => record.entity.power_rank ?? record.entity.rank))),
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
  const mergedCharacters = useMemo(() => mergeCharacterRecords(characters), [characters]);
  const factions = useMemo(() => filterFactions(data.factions, filters), [data.factions, filters]);
  const legendaryItems = useMemo(
    () => filterItems(data.items.filter((record) => isLegendaryItem(record.entity)), filters),
    [data.items, filters],
  );
  const annotatedSkills = useMemo(() => annotateRecords(topSkills, annotations), [topSkills, annotations]);
  const annotatedFactions = useMemo(() => annotateRecords(factions, annotations), [factions, annotations]);
  const annotatedItems = useMemo(() => annotateRecords(legendaryItems, annotations), [legendaryItems, annotations]);

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
      <LibrarySummary collections={collections} warnings={data.warnings} exportRecords={exportRecords} />
      {section !== 'overview' && (
        <LibraryFiltersPanel
          filters={filters}
          section={section}
          options={filterOptions}
          onChange={setFilters}
          onReset={resetFilters}
        />
      )}
      {section === 'skills' && <LibraryRecordTable records={annotatedSkills} onOpen={handleOpen} />}
      {section === 'characters' && <MergedCharacterTable records={mergedCharacters} onOpen={handleOpen} />}
      {section === 'factions' && <LibraryRecordTable records={annotatedFactions} onOpen={handleOpen} />}
      {section === 'items' && <LibraryRecordTable records={annotatedItems} onOpen={handleOpen} />}
      {section === 'overview' && <LibraryRecordTable records={annotatedSkills.slice(0, 20)} onOpen={handleOpen} />}
      <LibraryDetailDrawer collections={collections} />
    </div>
  );
};

export default GlobalLibraryDashboard;
