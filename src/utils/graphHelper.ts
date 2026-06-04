import type { Character, Skill, Item, Location, Faction, GraphNode, GraphLink } from '../types/novel';

// 颜色映射
export const NODE_COLORS = {
  character: '#1890ff',
  skill: '#52c41a',
  item: '#faad14',
  event: '#ff4d4f',
  location: '#722ed1',
  faction: '#13c2c2',
};

// 关系类型颜色
export const RELATION_COLORS: Record<string, string> = {
  '挚友': '#52c41a',
  '恋人': '#ff4d4f',
  '旧爱': '#ff7875',
  '结义兄弟': '#1890ff',
  '知己': '#9254de',
  '主仆': '#8c8c8c',
  '宿敌': '#ff4d4f',
  '对手': '#faad14',
  '朋友': '#69c0ff',
  '合作者': '#b7eb8f',
};

// 等级颜色
export const RANK_COLORS: Record<string, string> = {
  '返璞归真': '#ff4d4f',
  '登峰造极': '#faad14',
  '出神入化': '#1890ff',
  '炉火纯青': '#52c41a',
  '登堂入室': '#722ed1',
  '略有小成': '#13c2c2',
  '初窥门径': '#8c8c8c',
  '平平无奇': '#d9d9d9',
};

// 稀有度颜色
export const RARITY_COLORS: Record<string, string> = {
  '绝世神兵': '#ff4d4f',
  '稀世珍品': '#faad14',
  '上乘佳品': '#1890ff',
  '寻常凡品': '#8c8c8c',
};

// 角色类型颜色
export const ROLE_COLORS: Record<string, string> = {
  'protagonist': '#1890ff',
  'companion': '#52c41a',
  'npc': '#8c8c8c',
  'villain': '#ff4d4f',
};

/**
 * 构建图谱数据
 */
export function buildGraphData(
  characters: Character[],
  skills: Skill[],
  items: Item[],
  locations: Location[],
  factions: Faction[]
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // 添加角色节点
  characters.forEach((char) => {
    nodes.push({
      id: char.id,
      name: char.name,
      type: 'character',
      val: char.relationships.length + 2,
      color: ROLE_COLORS[char.role] || NODE_COLORS.character,
      data: char,
    });

    // 添加关系边
    char.relationships.forEach((rel) => {
      const relColor = RELATION_COLORS[rel.type] || '#d9d9d9';
      links.push({
        source: char.id,
        target: rel.target,
        type: rel.type,
        strength: rel.intensity / 100,
        color: relColor,
      });
    });
  });

  // 添加技能节点
  skills.forEach((skill) => {
    nodes.push({
      id: skill.id,
      name: skill.name,
      type: 'skill',
      val: skill.techniques.length + 2,
      color: NODE_COLORS.skill,
      data: skill,
    });

    // 添加角色与技能的关联
    characters.forEach((char) => {
      if (char.known_skills.includes(skill.id)) {
        links.push({
          source: char.id,
          target: skill.id,
          type: '掌握',
          strength: 0.6,
          color: '#d9d9d9',
        });
      }
    });
  });

  // 添加物品节点
  items.forEach((item) => {
    nodes.push({
      id: item.id,
      name: item.name,
      type: 'item',
      val: 3,
      color: RARITY_COLORS[item.rarity] || NODE_COLORS.item,
      data: item,
    });

    // 添加物品与持有者的关联
    if (item.owner) {
      links.push({
        source: item.owner,
        target: item.id,
        type: '持有',
        strength: 0.7,
        color: '#d9d9d9',
      });
    }

    // 添加物品与技能的关联
    item.related_skills.forEach((skillId) => {
      links.push({
        source: item.id,
        target: skillId,
        type: '关联',
        strength: 0.5,
        color: '#d9d9d9',
      });
    });
  });

  // 添加地点节点
  locations.forEach((loc) => {
    nodes.push({
      id: loc.id,
      name: loc.name,
      type: 'location',
      val: 2,
      color: NODE_COLORS.location,
      data: loc,
    });
  });

  // 添加势力节点
  factions.forEach((faction) => {
    nodes.push({
      id: faction.id,
      name: faction.name,
      type: 'faction',
      val: 4,
      color: NODE_COLORS.faction,
      data: faction,
    });

    // 添加势力与地点的关联
    if (faction.location) {
      links.push({
        source: faction.id,
        target: faction.location,
        type: '总部',
        strength: 0.8,
        color: '#d9d9d9',
      });
    }

    // 添加角色与势力的关联
    characters.forEach((char) => {
      if (char.faction === faction.id) {
        links.push({
          source: char.id,
          target: faction.id,
          type: '所属',
          strength: 0.7,
          color: '#d9d9d9',
        });
      }
    });
  });

  return { nodes, links };
}

/**
 * 获取节点的关联实体ID列表
 */
export function getRelatedIds(
  id: string,
  links: GraphLink[]
): string[] {
  const related: string[] = [];
  links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (sourceId === id) {
      related.push(targetId);
    } else if (targetId === id) {
      related.push(sourceId);
    }
  });
  return [...new Set(related)];
}

/**
 * 根据ID查找实体名称
 */
export function getEntityName(
  id: string,
  characters: Character[],
  skills: Skill[],
  items: Item[],
  locations: Location[],
  factions: Faction[]
): string {
  const char = characters.find((c) => c.id === id);
  if (char) return char.name;

  const skill = skills.find((s) => s.id === id);
  if (skill) return skill.name;

  const item = items.find((i) => i.id === id);
  if (item) return item.name;

  const loc = locations.find((l) => l.id === id);
  if (loc) return loc.name;

  const faction = factions.find((f) => f.id === id);
  if (faction) return faction.name;

  return id;
}
