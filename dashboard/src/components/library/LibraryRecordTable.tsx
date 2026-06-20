import { Button, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AnnotatedLibraryRecord, LibraryRecord } from '../../types/library';
import { displayArchetype, displayImportance, displayRole } from '../../utils/displayLabels';
import InkTag from '../common/InkTag';

const { Text } = Typography;

type EntityPreview = {
  name?: string;
  mastery_rank?: string;
  power_rank?: string;
  importance?: string;
  rank?: string;
  type?: string;
  rarity_tier?: string;
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
        const rank = entity.mastery_rank ?? entity.power_rank ?? entity.rank;
        const rarity = entity.rarity_tier ?? entity.rarity;
        const roleLabel = displayRole(entity.role);
        const archLabel = displayArchetype(entity.archetype);
        const impLabel = displayImportance(entity.importance);
        return (
          <Space wrap size={4}>
            {rank && <InkTag color="red">{rank}</InkTag>}
            {impLabel && <InkTag color="blue">{impLabel}</InkTag>}
            {rarity && <InkTag color="gold">{rarity}</InkTag>}
            {entity.type && <InkTag>{entity.type}</InkTag>}
            {roleLabel && <InkTag color="blue">{roleLabel}</InkTag>}
            {archLabel && <InkTag color="green">{archLabel}</InkTag>}
            {entity.faction && <InkTag color="cyan">{entity.faction}</InkTag>}
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
