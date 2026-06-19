import React from 'react';
import { Button, Input, Select, Space } from 'antd';
import type { LibraryFilters } from '../../types/library';

interface LibraryFiltersProps {
  filters: LibraryFilters;
  options: {
    rank?: string[];
    author?: string[];
    bookPath?: Array<{ label: string; value: string }>;
    type?: string[];
    faction?: string[];
    role?: string[];
    archetype?: string[];
    rarity?: string[];
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
    {options.rank && <Select mode="multiple" allowClear placeholder="等级" value={filters.rank} options={options.rank.map((value) => ({ value, label: value }))} onChange={(rank) => onChange({ rank })} style={{ minWidth: 160 }} />}
    {options.author && <Select mode="multiple" allowClear placeholder="作者" value={filters.author} options={options.author.map((value) => ({ value, label: value }))} onChange={(author) => onChange({ author })} style={{ minWidth: 150 }} />}
    {options.bookPath && <Select mode="multiple" allowClear placeholder="作品" value={filters.bookPath} options={options.bookPath} onChange={(bookPath) => onChange({ bookPath })} style={{ minWidth: 190 }} />}
    {options.type && <Select mode="multiple" allowClear placeholder="类型" value={filters.type} options={options.type.map((value) => ({ value, label: value }))} onChange={(type) => onChange({ type })} style={{ minWidth: 150 }} />}
    {options.faction && <Select mode="multiple" allowClear placeholder="门派" value={filters.faction} options={options.faction.map((value) => ({ value, label: value }))} onChange={(faction) => onChange({ faction })} style={{ minWidth: 150 }} />}
    {options.role && <Select mode="multiple" allowClear placeholder="角色定位" value={filters.role} options={options.role.map((value) => ({ value, label: value }))} onChange={(role) => onChange({ role })} style={{ minWidth: 150 }} />}
    {options.archetype && <Select mode="multiple" allowClear placeholder="原型" value={filters.archetype} options={options.archetype.map((value) => ({ value, label: value }))} onChange={(archetype) => onChange({ archetype })} style={{ minWidth: 150 }} />}
    {options.rarity && <Select mode="multiple" allowClear placeholder="稀有度" value={filters.rarity} options={options.rarity.map((value) => ({ value, label: value }))} onChange={(rarity) => onChange({ rarity })} style={{ minWidth: 150 }} />}
    <Button onClick={onReset}>重置</Button>
  </Space>
);

export default LibraryFiltersPanel;
