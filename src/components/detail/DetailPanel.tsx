import React from 'react';
import { Drawer, Empty } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import CharacterCard from '../cards/CharacterCard';
import SkillCard from '../cards/SkillCard';
import ItemCard from '../cards/ItemCard';
import EventCard from '../cards/EventCard';
import FactionCard from '../cards/FactionCard';
import LocationCard from '../cards/LocationCard';

const DetailPanel: React.FC = () => {
  const { detailPanel, hideDetail, characters, skills, items, events, factions, locations } =
    useNovelStore();

  const { visible, type, id } = detailPanel;

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
      case 'event': {
        const event = events.find((e) => e.id === id);
        return event ? `${event.name} - 事件详情` : '事件详情';
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
      case 'event':
        return <EventCard id={id} />;
      case 'faction':
        return <FactionCard id={id} />;
      case 'location':
        return <LocationCard id={id} />;
      default:
        return <Empty description="未知类型" />;
    }
  };

  return (
    <Drawer
      title={getTitle()}
      placement="right"
      onClose={hideDetail}
      open={visible}
      size="large"
      key={`${type}-${id}`}
      styles={{
        body: { padding: '16px', overflow: 'auto' },
      }}
    >
      {renderContent()}
    </Drawer>
  );
};

export default DetailPanel;
