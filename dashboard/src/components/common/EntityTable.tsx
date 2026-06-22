/**
 * EntityTable — 列表页通用布局
 *
 * 统一「搜索栏 + 筛选器 + 统计 + 虚拟滚动表格」结构，
 * 供 CharacterList / ItemList / SkillTree 共用。
 */
import React from 'react';
import { Empty, Input, Select, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';

/* ── 筛选器配置 ── */
export interface FilterConfig {
  placeholder: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Array<{ label: React.ReactNode; value: string }>;
}

/* ── 组件 Props ── */
export interface EntityTableLayoutProps<T extends object> {
  /** 搜索框 */
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  /** 筛选器（最多 3 个，自动排入 grid） */
  filters?: FilterConfig[];
  /** 统计文案前缀，如 "共 " */
  count: number;
  countLabel: string;
  /** Table props（不包含 size/pagination/scroll，由本组件统一控制） */
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey: keyof T & string;
  scrollX?: number;
  onRow?: TableProps<T>['onRow'];
}

const Y_SCROLL = 'calc(100vh - 320px)';

function EntityTableLayoutInner<T extends object>({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filters = [],
  count,
  countLabel,
  columns,
  dataSource,
  rowKey,
  scrollX = 600,
  onRow,
}: EntityTableLayoutProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── 工具栏 ── */}
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--ink-hairline)', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder={searchPlaceholder}
            allowClear
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
          />
          {filters.map((f, i) => (
            <Select
              key={i}
              mode="multiple"
              placeholder={f.placeholder}
              allowClear
              value={f.value}
              onChange={f.onChange}
              style={{ width: '100%' }}
              maxTagCount="responsive"
              options={f.options}
            />
          ))}
        </div>
        <div style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>
          共 {count} {countLabel}
        </div>
      </div>

      {/* ── 表格 ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {dataSource.length === 0 ? (
          <Empty description="无匹配项" />
        ) : (
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey={rowKey}
            size="small"
            scroll={{ x: scrollX, y: Y_SCROLL }}
            pagination={false}
            onRow={onRow}
          />
        )}
      </div>
    </div>
  );
}

export const EntityTableLayout = React.memo(EntityTableLayoutInner) as typeof EntityTableLayoutInner;
