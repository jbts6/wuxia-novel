import React, { useMemo, useState } from 'react';
import { Button, Drawer, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/useBookStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import type { LibraryCollections, LibraryRecord } from '../../types/library';
import { parseLibraryKey } from '../../utils/libraryKeys';

const { Paragraph, Text, Title } = Typography;

interface LibraryDetailDrawerProps {
  collections: LibraryCollections;
}

const LibraryDetailDrawer: React.FC<LibraryDetailDrawerProps> = ({ collections }) => {
  const navigate = useNavigate();
  const selectBook = useBookStore((state) => state.selectBook);
  const { selectedKey, selectRecord, annotations, updateAnnotation } = useLibraryStore();
  const [tagInput, setTagInput] = useState('');

  const record = useMemo<LibraryRecord<unknown> | null>(() => {
    if (!selectedKey) return null;
    return ([...collections.skills, ...collections.characters, ...collections.factions, ...collections.items] as LibraryRecord<unknown>[])
      .find((item) => item.key === selectedKey) ?? null;
  }, [collections, selectedKey]);

  const annotation = selectedKey ? annotations[selectedKey] : null;
  const entity = (record?.entity ?? {}) as {
    id?: string;
    name?: string;
    one_line?: string;
    rank?: string;
    type?: string;
    rarity?: string;
    role?: string;
    archetype?: string;
    faction?: string | null;
  };

  const openSourceBook = () => {
    if (!selectedKey || !record) return;
    const parsed = parseLibraryKey(selectedKey);
    if (!parsed) return;
    selectBook(parsed.bookPath);
    const routeByKind = {
      skill: 'skills',
      character: 'characters',
      faction: 'forces',
      item: 'items',
    };
    navigate(`/${routeByKind[parsed.kind]}?detail=${parsed.kind}:${parsed.entityId}`);
  };

  const addTag = () => {
    if (!selectedKey) return;
    const tag = tagInput.trim();
    if (!tag) return;
    const tags = Array.from(new Set([...(annotation?.gameTags ?? []), tag]));
    updateAnnotation(selectedKey, { gameTags: tags });
    setTagInput('');
  };

  return (
    <Drawer
      title={entity.name ?? '素材详情'}
      placement="right"
      size="large"
      open={Boolean(selectedKey)}
      onClose={() => selectRecord(null)}
    >
      {record && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={4}>{entity.name}</Title>
            <Text type="secondary">{record.source.author} / {record.source.bookName}</Text>
            <Paragraph style={{ marginTop: 12 }}>{entity.one_line}</Paragraph>
            <Space wrap>
              {entity.rank && <Tag color="red">{entity.rank}</Tag>}
              {entity.rarity && <Tag color="gold">{entity.rarity}</Tag>}
              {entity.type && <Tag>{entity.type}</Tag>}
              {entity.role && <Tag color="blue">{entity.role}</Tag>}
              {entity.archetype && <Tag color="green">{entity.archetype}</Tag>}
              {entity.faction && <Tag color="cyan">{entity.faction}</Tag>}
            </Space>
          </div>

          <Button type="primary" onClick={openSourceBook}>打开原书</Button>

          <div>
            <Text strong>游戏标签</Text>
            <Space wrap style={{ display: 'flex', marginTop: 8 }}>
              {(annotation?.gameTags ?? []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
              <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onPressEnter={addTag} placeholder="新增标签" style={{ width: 140 }} />
              <Button onClick={addTag}>添加</Button>
            </Space>
          </div>

          <div>
            <Text strong>强度评分</Text>
            <InputNumber min={1} max={10} value={annotation?.strengthScore} onChange={(value) => selectedKey && updateAnnotation(selectedKey, { strengthScore: value ?? undefined })} style={{ display: 'block', marginTop: 8 }} />
          </div>

          <div>
            <Text strong>设计备注</Text>
            <Input.TextArea value={annotation?.designNotes} onChange={(event) => selectedKey && updateAnnotation(selectedKey, { designNotes: event.target.value })} rows={4} style={{ marginTop: 8 }} />
          </div>

          <div>
            <Text strong>导出状态</Text>
            <Select
              value={annotation?.exportEnabled ?? true}
              onChange={(exportEnabled) => selectedKey && updateAnnotation(selectedKey, { exportEnabled })}
              options={[
                { value: true, label: '参与导出' },
                { value: false, label: '不参与导出' },
              ]}
              style={{ display: 'block', width: 160, marginTop: 8 }}
            />
          </div>
        </Space>
      )}
    </Drawer>
  );
};

export default LibraryDetailDrawer;
