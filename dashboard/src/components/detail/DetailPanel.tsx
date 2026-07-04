import React, { useMemo } from 'react';
import { Button, Empty, Space, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import CharacterCard from '../cards/CharacterCard';
import SkillCard from '../cards/SkillCard';
import ItemCard from '../cards/ItemCard';
import FactionCard from '../cards/FactionCard';
import LocationCard from '../cards/LocationCard';
import ErrorBoundary from '../common/ErrorBoundary';
import type { CardType } from '../../types/novel';
import { getEntityDetailTitle, getEntityName } from '../../utils/entityLookup';
import { getRelationshipChain } from '../../utils/graphHelper';
import InkTag from '../common/InkTag';
import { ScrollDrawer, SealStamp } from '../../shared/components';

const { Text } = Typography;

const TYPE_LABELS: Record<CardType, string> = {
  character: '人物',
  skill: '武功',
  item: '物品',
  faction: '势力',
  location: '地点',
};

const TYPE_SEALS: Record<CardType, { text: string; shape: 'square' | 'circle' | 'tall' }> = {
  character: { text: '人', shape: 'circle' },
  skill: { text: '武', shape: 'tall' },
  item: { text: '器', shape: 'circle' },
  faction: { text: '门', shape: 'tall' },
  location: { text: '地', shape: 'circle' },
};

const DetailPanel: React.FC = () => {
  const visible = useNovelStore(s => s.detailPanel.visible);
  const type = useNovelStore(s => s.detailPanel.type);
  const id = useNovelStore(s => s.detailPanel.id);
  const detailTrail = useNovelStore(s => s.detailTrail);
  const showDetail = useNovelStore(s => s.showDetail);
  const hideDetail = useNovelStore(s => s.hideDetail);
  const graphNodes = useNovelStore(s => s.graphNodes);
  const graphLinks = useNovelStore(s => s.graphLinks);
  const characters = useNovelStore(s => s.characters);
  const skills = useNovelStore(s => s.skills);
  const items = useNovelStore(s => s.items);
  const factions = useNovelStore(s => s.factions);
  const locations = useNovelStore(s => s.locations);

  const entityCollections = useMemo(
    () => ({ characters, skills, items, factions, locations }),
    [characters, factions, items, locations, skills],
  );

  const title = useMemo(
    () => getEntityDetailTitle(entityCollections, type, id),
    [entityCollections, type, id],
  );

  const renderContent = () => {
    if (!type || !id) return <Empty description="请选择一个实体" />;
    switch (type) {
      case 'character': return <CharacterCard id={id} />;
      case 'skill': return <SkillCard id={id} />;
      case 'item': return <ItemCard id={id} />;
      case 'faction': return <FactionCard id={id} />;
      case 'location': return <LocationCard id={id} />;
      default: return <Empty description="未知类型" />;
    }
  };

  const relationshipChain = useMemo(() => {
    if (!id) return [];
    const previous = detailTrail.length > 1 ? detailTrail[detailTrail.length - 2] : null;
    return getRelationshipChain(id, graphNodes, graphLinks, {
      excludeIds: previous ? [previous.id] : [],
    }).slice(0, 12);
  }, [detailTrail, graphLinks, graphNodes, id]);

  const seal = type ? TYPE_SEALS[type] : { text: '详', shape: 'square' as const };

  const breadcrumb = detailTrail.length > 1 && (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--ink-secondary)',
        marginBottom: 14,
        fontFamily: 'var(--font-serif)',
      }}
    >
      {detailTrail.map((entry, index) => {
        const name = getEntityName(entityCollections, entry.type, entry.id);
        const isLast = index === detailTrail.length - 1;
        return (
          <React.Fragment key={`${entry.type}-${entry.id}-${index}`}>
            {index > 0 && (
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
            )}
            {isLast ? (
              <span style={{ color: 'var(--ink-black)', fontWeight: 600 }}>{name}</span>
            ) : (
              <button
                type="button"
                onClick={() => showDetail(entry.type, entry.id)}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  color: 'var(--cinnabar)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 12,
                }}
              >
                {name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <ScrollDrawer
      open={visible}
      onClose={hideDetail}
      title={title || '详 情'}
      seal={seal.text}
      sealShape={seal.shape}
      subtitle={type ? TYPE_LABELS[type] : undefined}
    >
      {breadcrumb}
      <ErrorBoundary resetKey={`${type}-${id}`}>{renderContent()}</ErrorBoundary>
      {type && id && (
        <section style={{ marginTop: 24 }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <SealStamp text="系" shape="sm" />
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 15,
                letterSpacing: '0.15em',
                color: 'var(--ink-black)',
              }}
            >
              关 系 链
            </span>
          </header>
          {relationshipChain.length === 0 ? (
            <p
              style={{
                color: 'var(--ink-faint)',
                fontFamily: 'var(--font-serif)',
                padding: '12px 0',
              }}
            >
              暂无直接关系。
            </p>
          ) : (
            <div className="scroll-list">
              {relationshipChain.map((item, idx) => (
                <div
                  key={idx}
                  className="scroll-list__item"
                  onClick={() => showDetail(item.targetType, item.targetId)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Space wrap size={6}>
                      <InkTag>{TYPE_LABELS[item.targetType]}</InkTag>
                      <Text strong style={{ fontFamily: 'var(--font-serif)' }}>
                        {item.targetName}
                      </Text>
                      <ArrowRightOutlined style={{ color: 'var(--ink-faint)' }} />
                      <InkTag>{item.relation}</InkTag>
                    </Space>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-secondary)',
                        marginTop: 4,
                      }}
                    >
                      关系强度 {Math.round(item.strength * 100)}%
                    </div>
                  </div>
                  <Button type="link" size="small" onClick={e => e.stopPropagation()}>
                    查看
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </ScrollDrawer>
  );
};

export default DetailPanel;
