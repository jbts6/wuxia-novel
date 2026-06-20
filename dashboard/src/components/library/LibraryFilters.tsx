import React from 'react';
import { Button, Input, Select, Space } from 'antd';
import type { LibraryFilters, LibraryMaterialType } from '../../types/library';

const MATERIAL_TYPE_OPTIONS: Array<{ label: string; value: LibraryMaterialType }> = [
  { label: '全部', value: 'all' },
  { label: '功法', value: 'skill' },
  { label: '角色', value: 'character' },
  { label: '门派', value: 'faction' },
  { label: '物品', value: 'item' },
];

interface LibraryFiltersProps {
  filters: LibraryFilters;
  options: {
    masteryRank?: string[];
    powerRank?: string[];
    importance?: string[];
    author?: string[];
    bookPath?: Array<{ label: string; value: string }>;
    type?: string[];
    faction?: string[];
    role?: string[];
    archetype?: string[];
    rarityTier?: string[];
  };
  onChange: (filters: Partial<LibraryFilters>) => void;
  onReset: () => void;
}

const LibraryFiltersPanel: React.FC<LibraryFiltersProps> = ({ filters, options, onChange, onReset }) => (
  <Space wrap style={{ marginBottom: 16 }}>
    <Input.Search
      allowClear
      placeholder="搜索名称、简介、招式、效果..."
      value={filters.keyword}
      onChange={(event) => onChange({ keyword: event.target.value })}
      style={{ width: 260 }}
    />
    <Select
      aria-label="素材类型"
      placeholder="素材类型"
      value={filters.materialType}
      options={MATERIAL_TYPE_OPTIONS}
      onChange={(materialType) => onChange({
        materialType,
        masteryRank: [],
        powerRank: [],
        importance: [],
        rarityTier: [],
        type: [],
      })}
      style={{ minWidth: 130 }}
    />
    {options.author && <Select mode="multiple" allowClear placeholder="作者" value={filters.author} options={options.author.map((value) => ({ value, label: value }))} onChange={(author) => onChange({ author })} style={{ minWidth: 150 }} />}
    {options.bookPath && <Select mode="multiple" allowClear placeholder="作品" value={filters.bookPath} options={options.bookPath} onChange={(bookPath) => onChange({ bookPath })} style={{ minWidth: 190 }} />}
    {filters.materialType === 'skill' && options.masteryRank && <Select mode="multiple" allowClear placeholder="境界/强度" value={filters.masteryRank} options={options.masteryRank.map((value) => ({ value, label: value }))} onChange={(masteryRank) => onChange({ masteryRank })} style={{ minWidth: 160 }} />}
    {filters.materialType === 'character' && options.powerRank && <Select mode="multiple" allowClear placeholder="强度" value={filters.powerRank} options={options.powerRank.map((value) => ({ value, label: value }))} onChange={(powerRank) => onChange({ powerRank })} style={{ minWidth: 150 }} />}
    {filters.materialType === 'character' && options.importance && <Select mode="multiple" allowClear placeholder="角色重要性" value={filters.importance} options={options.importance.map((value) => ({ value, label: value }))} onChange={(importance) => onChange({ importance })} style={{ minWidth: 150 }} />}
    {filters.materialType !== 'all' && filters.materialType !== 'character' && options.type && <Select mode="multiple" allowClear placeholder={filters.materialType === 'item' ? '物品类型' : '类型'} value={filters.type} options={options.type.map((value) => ({ value, label: value }))} onChange={(type) => onChange({ type })} style={{ minWidth: 150 }} />}
    {(filters.materialType === 'skill' || filters.materialType === 'character') && options.faction && <Select mode="multiple" allowClear placeholder="门派" value={filters.faction} options={options.faction.map((value) => ({ value, label: value }))} onChange={(faction) => onChange({ faction })} style={{ minWidth: 150 }} />}
    {filters.materialType === 'character' && options.role && <Select mode="multiple" allowClear placeholder="角色定位" value={filters.role} options={options.role.map((value) => ({ value, label: value }))} onChange={(role) => onChange({ role })} style={{ minWidth: 150 }} />}
    {filters.materialType === 'character' && options.archetype && <Select mode="multiple" allowClear placeholder="原型" value={filters.archetype} options={options.archetype.map((value) => ({ value, label: value }))} onChange={(archetype) => onChange({ archetype })} style={{ minWidth: 150 }} />}
    {filters.materialType === 'item' && options.rarityTier && <Select mode="multiple" allowClear placeholder="稀有度" value={filters.rarityTier} options={options.rarityTier.map((value) => ({ value, label: value }))} onChange={(rarityTier) => onChange({ rarityTier })} style={{ minWidth: 150 }} />}
    <Button onClick={onReset}>重置</Button>
  </Space>
);

export default LibraryFiltersPanel;
