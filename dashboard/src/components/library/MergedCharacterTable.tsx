import { Badge, Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MergedCharacterRecord } from '../../types/library';
import { displayArchetype, displayImportance, displayRole } from '../../utils/displayLabels';

const { Text } = Typography;

interface MergedCharacterTableProps {
  records: MergedCharacterRecord[];
  onOpen: (key: string) => void;
}

const MergedCharacterTable: React.FC<MergedCharacterTableProps> = ({ records, onOpen }) => {
  const columns: ColumnsType<MergedCharacterRecord> = [
    {
      title: '名称',
      key: 'name',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{record.name}</Text>
          {record.one_line && <Text type="secondary">{record.one_line}</Text>}
        </Space>
      ),
    },
    {
      title: '来源',
      key: 'source',
      render: (_, record) => {
        const books = record.appearances.map((a) => `${a.source.author} / ${a.source.bookName}`);
        return (
          <Space orientation="vertical" size={0}>
            <Text>{books[0]}</Text>
            {books.length > 1 && <Text type="secondary">+{books.length - 1} 本</Text>}
          </Space>
        );
      },
    },
    {
      title: '标签',
      key: 'meta',
      render: (_, record) => {
        const p = record.primary;
        const roleLabel = displayRole(p.role);
        const archLabel = displayArchetype(record.archetype);
        const impLabel = displayImportance(p.importance);
        return (
          <Space wrap size={4}>
            {p.power_rank && <Tag color="red">{p.power_rank}</Tag>}
            {impLabel && <Tag color="blue">{impLabel}</Tag>}
            {roleLabel && <Tag color="blue">{roleLabel}</Tag>}
            {archLabel && <Tag color="green">{archLabel}</Tag>}
            {p.faction && <Tag color="cyan">{p.faction}</Tag>}
            {record.appearances.length > 1 && (
              <Badge count={record.appearances.length} size="small" color="blue">
                <Tag style={{ marginRight: 0 }}>出处</Tag>
              </Badge>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button aria-label="查看" size="small" onClick={() => onOpen(record.key)}>查看</Button>
      ),
    },
  ];

  return <Table rowKey="key" size="small" columns={columns} dataSource={records} pagination={{ pageSize: 20 }} />;
};

export default MergedCharacterTable;
