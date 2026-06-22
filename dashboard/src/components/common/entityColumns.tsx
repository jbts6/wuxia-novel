/**
 * entityColumns — 列表页公用列工厂
 *
 * 返回 antd ColumnsType 元素，各列表页组合拼装即可。
 * 所有列宽度统一，「简介」列始终放最后。
 */
import React from 'react';
import { Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import InkTag from './InkTag';

const { Text } = Typography;

/* ── 公共列宽常量 ── */
export const COL = {
  name: 160,
  type: 120,
  rank: 120,
  summary: 0,   // 0 = flex，不设 width，放在最后自动填满
} as const;

/* ── 名称列（fixed left + 宋体加粗） ── */
export function nameColumn<T extends { name: string }>(): ColumnType<T> {
  return {
    title: '名称',
    dataIndex: 'name',
    width: COL.name,
    fixed: 'left' as const,
    render: (name: string) => <Text strong style={{ fontFamily: 'var(--font-serif)' }}>{name}</Text>,
  };
}

/* ── 类型列（InkTag） ── */
export function typeColumn<T extends { type: string }>(): ColumnType<T> {
  return {
    title: '类型',
    dataIndex: 'type',
    width: COL.type,
    render: (type: string) => <InkTag wash={false} style={{ fontSize: 11 }}>{type}</InkTag>,
  };
}

/* ── 境界/品阶列（InkTag + 颜色映射） ── */
export function rankColumn<T extends { rank: string }>(
  title: string,
  colorMap: Record<string, string>,
): ColumnType<T> {
  return {
    title,
    dataIndex: 'rank',
    width: COL.rank,
    render: (rank: string) => (
      <InkTag color={colorMap[rank] || 'default'} wash={false} style={{ fontSize: 11 }}>
        {rank}
      </InkTag>
    ),
  };
}

/* ── 简介列（flex 填满，始终放最后） ── */
export function summaryColumn<T extends { summary: string }>(): ColumnType<T> {
  return {
    title: '简介',
    dataIndex: 'summary',
    render: (summary: string) => (
      <Text type="secondary" ellipsis style={{ fontSize: 12, marginBottom: 0 }}>
        {summary}
      </Text>
    ),
  };
}
