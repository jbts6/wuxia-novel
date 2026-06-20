import React, { useCallback, useMemo } from 'react';
import { Breadcrumb, Button, Card, Drawer, Empty, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNovelStore } from '../../stores/useNovelStore';
import CharacterCard from '../cards/CharacterCard';
import SkillCard from '../cards/SkillCard';
import ItemCard from '../cards/ItemCard';
import FactionCard from '../cards/FactionCard';
import LocationCard from '../cards/LocationCard';
import ErrorBoundary from '../common/ErrorBoundary';
import type { CardType } from '../../types/novel';
import { formatDetailParam } from '../../utils/detailNavigation';
import { getRelationshipChain } from '../../utils/graphHelper';

const { Text } = Typography;

const TYPE_LABELS: Record<CardType, string> = {
  character: '人物',
  skill: '武功',
  item: '物品',
  faction: '势力',
  location: '地点',
};

const DetailPanel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { detailPanel, detailTrail, hideDetail, characters, skills, items, factions, locations, graphNodes, graphLinks } =
    useNovelStore();

  const { visible, type, id } = detailPanel;

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

  const getTitle = () => {
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
        const location = locations.find((l) => l.id === id);
        return location ? `${location.name} - 地点详情` : '地点详情';
      }
      default:
        return '详情';
    }
  };

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

  const navigateDetail = (nextType: CardType, nextId: string, replace = false) => {
    const params = new URLSearchParams(location.search);
    params.set('detail', formatDetailParam({ type: nextType, id: nextId }));
    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace },
    );
  };

  const closeDetail = () => {
    const params = new URLSearchParams(location.search);
    params.delete('detail');
    hideDetail();
    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true },
    );
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
      title={getTitle()}
      placement="right"
      onClose={closeDetail}
      open={visible}
      size="large"
      key={`${type}-${id}`}
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
                      <Tag>{TYPE_LABELS[item.targetType]}</Tag>
                      <Text strong>{item.targetName}</Text>
                      <ArrowRightOutlined style={{ color: 'var(--ink-faint)' }} />
                      <Tag>{item.relation}</Tag>
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
