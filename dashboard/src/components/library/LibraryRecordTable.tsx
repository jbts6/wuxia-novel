import React from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AnnotatedLibraryRecord, LibraryRecord } from '../../types/library';

const { Text } = Typography;

type EntityPreview = {
  name?: string;
  rank?: string;
  type?: string;
  rarity?: string;
  role?: string;
  archetype?: string;
  faction?: string | null;
  one_line?: string;
};

interface LibraryRecordTableProps<T> {
  records: Array<LibraryRecord<T> | AnnotatedLibraryRecord<T>>;
  onOpen: (key: string) => void;
}

const LibraryRecordTable = <T,>({ records, onOpen }: LibraryRecordTableProps<T>) => {
  const columns: ColumnsType<LibraryRecord<T> | AnnotatedLibraryRecord<T>> = [
    {
      title: '名称',
      key: 'name',
      render: (_, record) => {
        const entity = record.entity as EntityPreview;
        return (
          <Space orientation="vertical" size={2}>
            <Text strong>{entity.name ?? record.key}</Text>
            {entity.one_line && <Text type="secondary">{entity.one_line}</Text>}
          </Space>
        );
      },
    },
    {
      title: '来源',
      key: 'source',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.source.bookName}</Text>
          <Text type="secondary">{record.source.author}</Text>
        </Space>
      ),
    },
    {
      title: '标签',
      key: 'meta',
      render: (_, record) => {
        const entity = record.entity as EntityPreview;
        return (
          <Space wrap size={4}>
            {entity.rank && <Tag color="red">{entity.rank}</Tag>}
            {entity.rarity && <Tag color="gold">{entity.rarity}</Tag>}
            {entity.type && <Tag>{entity.type}</Tag>}
            {entity.role && <Tag color="blue">{entity.role}</Tag>}
            {entity.archetype && <Tag color="green">{entity.archetype}</Tag>}
            {entity.faction && <Tag color="cyan">{entity.faction}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => <Button aria-label="查看" size="small" onClick={() => onOpen(record.key)}>查看</Button>,
    },
  ];

  return <Table rowKey="key" size="small" columns={columns} dataSource={records} pagination={{ pageSize: 20 }} />;
};

export default LibraryRecordTable;
