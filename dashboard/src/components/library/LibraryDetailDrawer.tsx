import React, { useMemo, useState } from 'react';
import { Button, Collapse, Drawer, Input, InputNumber, Select, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../../stores/useLibraryStore';
import type { LibraryCollections, LibraryRecord } from '../../types/library';
import { displayArchetype, displayImportance, displayRole } from '../../utils/displayLabels';
import { parseLibraryKey } from '../../utils/libraryKeys';
import InkTag from '../common/InkTag';

const { Paragraph, Text, Title } = Typography;

interface LibraryDetailDrawerProps {
  collections: LibraryCollections;
}

const LibraryDetailDrawer: React.FC<LibraryDetailDrawerProps> = ({ collections }) => {
  const navigate = useNavigate();
  const { selectedKey, selectRecord, annotations, updateAnnotation } = useLibraryStore();
  const [tagInput, setTagInput] = useState('');

  const allRecords = useMemo(
    () => [...collections.skills, ...collections.characters, ...collections.factions, ...collections.items] as LibraryRecord<unknown>[],
    [collections],
  );

  const isMergedCharacter = selectedKey?.startsWith('character:') && !selectedKey.includes('%');

  const record = useMemo<LibraryRecord<unknown> | null>(() => {
    if (!selectedKey || isMergedCharacter) return null;
    return allRecords.find((item) => item.key === selectedKey) ?? null;
  }, [allRecords, selectedKey, isMergedCharacter]);

  const mergedCharacterRecords = useMemo<LibraryRecord<unknown>[]>(() => {
    if (!selectedKey || !isMergedCharacter) return [];
    const entityId = selectedKey.replace('character:', '');
    return (collections.characters as LibraryRecord<unknown>[]).filter(
      (r) => (r.entity as { id?: string }).id === entityId,
    );
  }, [collections.characters, selectedKey, isMergedCharacter]);

  const annotation = selectedKey ? annotations[selectedKey] : null;

  const entity = (record?.entity ?? {}) as {
    id?: string;
    name?: string;
    alias?: string[];
    identity?: string;
    one_line?: string;
    personality?: { traits: string[]; speech_style: string; temperament: string };
    mastery_rank?: string;
    power_rank?: string;
    importance?: string;
    rank?: string;
    legacy_rank?: string;
    type?: string;
    rarity_tier?: string;
    rarity?: string;
    legacy_rarity?: string;
    role?: string;
    archetype?: string;
    faction?: string | null;
  };

  const mergedEntity = isMergedCharacter && mergedCharacterRecords.length > 0
    ? (mergedCharacterRecords[0].entity as typeof entity)
    : null;

  const displayEntity = mergedEntity ?? entity;
  const displayRank = displayEntity.mastery_rank ?? displayEntity.power_rank ?? displayEntity.rank;
  const displayRarity = displayEntity.rarity_tier ?? displayEntity.rarity;

  const openSourceBook = (bookPath?: string) => {
    const targetKey = selectedKey;
    if (!targetKey) return;
    const routeByKind = { skill: 'skills', character: 'characters', faction: 'forces', item: 'items' };

    if (bookPath) {
      const [author, ...nameParts] = bookPath.split('/');
      const name = nameParts.join('/');
      navigate(`/book/${encodeURIComponent(author)}/${encodeURIComponent(name)}/characters?detail=character:${(displayEntity as { id?: string }).id}`);
      return;
    }
    if (!record) return;
    const parsed = parseLibraryKey(targetKey);
    if (!parsed) return;
    const [author, ...nameParts] = parsed.bookPath.split('/');
    const name = nameParts.join('/');
    const route = routeByKind[parsed.kind];
    navigate(`/book/${encodeURIComponent(author)}/${encodeURIComponent(name)}/${route}?detail=${parsed.kind}:${parsed.entityId}`);
  };

  const addTag = () => {
    if (!selectedKey) return;
    const tag = tagInput.trim();
    if (!tag) return;
    const tags = Array.from(new Set([...(annotation?.gameTags ?? []), tag]));
    updateAnnotation(selectedKey, { gameTags: tags });
    setTagInput('');
  };

  const renderMergedCharacter = () => {
    if (!mergedEntity) return null;
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={4}>{mergedEntity.name}</Title>
          {mergedEntity.alias && mergedEntity.alias.length > 0 && (
            <Text type="secondary">{mergedEntity.alias.join('、')}</Text>
          )}
          {mergedEntity.identity && <Paragraph style={{ marginTop: 4 }}>{mergedEntity.identity}</Paragraph>}
          <Paragraph style={{ marginTop: 8 }}>{mergedEntity.one_line}</Paragraph>
          <Space wrap>
            {mergedEntity.archetype && <InkTag color="green">{mergedEntity.archetype}</InkTag>}
          </Space>
        </div>

        <Collapse
          size="small"
          defaultActiveKey={mergedCharacterRecords.map((_, i) => String(i))}
          items={mergedCharacterRecords.map((r, i) => {
            const e = r.entity as typeof entity;
            const rank = e.mastery_rank ?? e.power_rank ?? e.rank;
            const rarity = e.rarity_tier ?? e.rarity;
            return {
              key: String(i),
              label: `${r.source.author} / ${r.source.bookName}`,
              children: (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap>
                    {rank && <InkTag color="red">{rank}</InkTag>}
                    {displayImportance(e.importance) && <InkTag color="blue">{displayImportance(e.importance)}</InkTag>}
                    {rarity && <InkTag color="gold">{rarity}</InkTag>}
                    {e.type && <InkTag>{e.type}</InkTag>}
                    {displayRole(e.role) && <InkTag color="blue">{displayRole(e.role)}</InkTag>}
                    {e.faction && <InkTag color="cyan">{e.faction}</InkTag>}
                    {e.legacy_rank && <InkTag>legacy: {e.legacy_rank}</InkTag>}
                  </Space>
                  <Button size="small" onClick={() => openSourceBook(r.source.bookPath)}>打开原书</Button>
                </Space>
              ),
            };
          })}
        />

        <div>
          <Text strong>游戏标签</Text>
          <Space wrap style={{ display: 'flex', marginTop: 8 }}>
            {(annotation?.gameTags ?? []).map((tag) => <InkTag key={tag}>{tag}</InkTag>)}
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
    );
  };

  const renderSingleRecord = () => {
    if (!record) return null;
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={4}>{entity.name}</Title>
          <Text type="secondary">{record.source.author} / {record.source.bookName}</Text>
          <Paragraph style={{ marginTop: 12 }}>{entity.one_line}</Paragraph>
          <Space wrap>
            {displayRank && <InkTag color="red">{displayRank}</InkTag>}
            {displayImportance(entity.importance) && <InkTag color="blue">{displayImportance(entity.importance)}</InkTag>}
            {displayRarity && <InkTag color="gold">{displayRarity}</InkTag>}
            {entity.type && <InkTag>{entity.type}</InkTag>}
            {displayRole(entity.role) && <InkTag color="blue">{displayRole(entity.role)}</InkTag>}
            {displayArchetype(entity.archetype) && <InkTag color="green">{displayArchetype(entity.archetype)}</InkTag>}
            {entity.faction && <InkTag color="cyan">{entity.faction}</InkTag>}
            {entity.legacy_rank && <InkTag color="default">legacy: {entity.legacy_rank}</InkTag>}
            {entity.legacy_rarity && <InkTag color="default">legacy: {entity.legacy_rarity}</InkTag>}
          </Space>
        </div>

        <Button type="primary" onClick={() => openSourceBook()}>打开原书</Button>

        <div>
          <Text strong>游戏标签</Text>
          <Space wrap style={{ display: 'flex', marginTop: 8 }}>
            {(annotation?.gameTags ?? []).map((tag) => <InkTag key={tag}>{tag}</InkTag>)}
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
    );
  };

  return (
    <Drawer
      title={displayEntity.name ?? '素材详情'}
      placement="right"
      size="large"
      open={Boolean(selectedKey)}
      onClose={() => selectRecord(null)}
    >
      {isMergedCharacter ? renderMergedCharacter() : renderSingleRecord()}
    </Drawer>
  );
};

export default LibraryDetailDrawer;
