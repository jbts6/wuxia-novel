import React, { useCallback, useMemo } from 'react';
import { Breadcrumb, Button, Card, Drawer, Empty, Space, Typography } from 'antd';
import { ArrowRightOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import CharacterCard from '../cards/CharacterCard';
import SkillCard from '../cards/SkillCard';
import ItemCard from '../cards/ItemCard';
import FactionCard from '../cards/FactionCard';
import LocationCard from '../cards/LocationCard';
import ErrorBoundary from '../common/ErrorBoundary';
import type { CardType } from '../../types/novel';
import { getRelationshipChain } from '../../utils/graphHelper';
import InkTag from '../common/InkTag';

const { Text } = Typography;

const TYPE_LABELS: Record<CardType, string> = {
  character: '人物',
  skill: '武功',
  item: '物品',
  faction: '势力',
  location: '地点',
};

const DetailPanel: React.FC = () => {
  const visible = useNovelStore((s) => s.detailPanel.visible);
  const type = useNovelStore((s) => s.detailPanel.type);
  const id = useNovelStore((s) => s.detailPanel.id);
  const detailTrail = useNovelStore((s) => s.detailTrail);
  const showDetail = useNovelStore((s) => s.showDetail);
  const hideDetail = useNovelStore((s) => s.hideDetail);
  const graphNodes = useNovelStore((s) => s.graphNodes);
  const graphLinks = useNovelStore((s) => s.graphLinks);
  const characters = useNovelStore((s) => s.characters);
  const skills = useNovelStore((s) => s.skills);
  const items = useNovelStore((s) => s.items);
  const factions = useNovelStore((s) => s.factions);
  const locations = useNovelStore((s) => s.locations);

  const getEntityName = useCallback((entityType: CardType, entityId: string) => {
    switch (entityType) {
      case 'character':
        return characters.find((c) => c.id === entityId)?.name || entityId;
      case 'skill':
        return skills.find((s) => s.id === entityId)?.name || entityId;
      case 'item':
        return items.find((i) => i.id === entityId)?.name || entityId;
      case 'faction':
        return factions.find((f) => f.id === entityId)?.name || entityId;
      case 'location':
        return locations.find((l) => l.id === entityId)?.name || entityId;
      default:
        return entityId;
    }
  }, [characters, factions, items, locations, skills]);

  const title = useMemo(() => {
    if (!type || !id) return '';
    switch (type) {
      case 'character': {
        const char = characters.find((c) => c.id === id);
        return char ? `${char.name} - 角色详情` : '角色详情';
      }
      case 'skill': {
        const skill = skills.find((s) => s.id === id);
        return skill ? `${skill.name} - 技能详情` : '技能详情';
      }
      case 'item': {
        const item = items.find((i) => i.id === id);
        return item ? `${item.name} - 物品详情` : '物品详情';
      }
      case 'faction': {
        const faction = factions.find((f) => f.id === id);
        return faction ? `${faction.name} - 势力详情` : '势力详情';
      }
      case 'location': {
        const loc = locations.find((l) => l.id === id);
        return loc ? `${loc.name} - 地点详情` : '地点详情';
      }
      default:
        return '详情';
    }
  }, [type, id, characters, skills, items, factions, locations]);

  const renderContent = () => {
    if (!type || !id) return <Empty description="请选择一个实体" />;

    switch (type) {
      case 'character':
        return <CharacterCard id={id} />;
      case 'skill':
        return <SkillCard id={id} />;
      case 'item':
        return <ItemCard id={id} />;
      case 'faction':
        return <FactionCard id={id} />;
      case 'location':
        return <LocationCard id={id} />;
      default:
        return <Empty description="未知类型" />;
    }
  };

  const navigateDetail = (nextType: CardType, nextId: string) => {
    showDetail(nextType, nextId);
  };

  const closeDetail = () => {
    hideDetail();
  };

  const relationshipChain = useMemo(() => {
    if (!id) return [];
    const previous = detailTrail.length > 1 ? detailTrail[detailTrail.length - 2] : null;
    return getRelationshipChain(id, graphNodes, graphLinks, {
      excludeIds: previous ? [previous.id] : [],
    }).slice(0, 12);
  }, [detailTrail, graphLinks, graphNodes, id]);

  return (
    <Drawer
      title={title}
      placement="right"
      onClose={closeDetail}
      open={visible}
      size="large"
      styles={{
        body: { padding: '16px', overflow: 'auto' },
      }}
    >
      {detailTrail.length > 1 && (
        <Breadcrumb
          style={{ marginBottom: 12 }}
          items={detailTrail.map((entry, index) => ({
            title:
              index === detailTrail.length - 1 ? (
                <Text>{getEntityName(entry.type, entry.id)}</Text>
              ) : (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => navigateDetail(entry.type, entry.id)}
                >
                  {getEntityName(entry.type, entry.id)}
                </Button>
              ),
          }))}
        />
      )}
      <ErrorBoundary resetKey={`${type}-${id}`}>{renderContent()}</ErrorBoundary>
      {type && id && (
        <Card
          size="small"
          title={
            <Space>
              <NodeIndexOutlined />
              关系链
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          {relationshipChain.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无直接关系" />
          ) : (
            <div>
              {relationshipChain.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < relationshipChain.length - 1 ? '1px solid var(--ink-hairline)' : undefined }}>
                  <div>
                    <Space wrap size={6}>
                      <InkTag>{TYPE_LABELS[item.targetType]}</InkTag>
                      <Text strong>{item.targetName}</Text>
                      <ArrowRightOutlined style={{ color: 'var(--ink-faint)' }} />
                      <InkTag>{item.relation}</InkTag>
                    </Space>
                    <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>关系强度 {Math.round(item.strength * 100)}%</div>
                  </div>
                  <Button type="link" size="small" onClick={() => navigateDetail(item.targetType, item.targetId)}>查看</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </Drawer>
  );
};

export default DetailPanel;
