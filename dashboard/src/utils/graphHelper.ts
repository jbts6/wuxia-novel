import type { Character, Skill, Item, Location, Faction, GraphNode, GraphLink } from '../types/novel';
import {
  ENTITY_COLORS,
  RELATION_COLORS as INK_RELATION_COLORS,
  RANK_COLORS as INK_RANK_COLORS,
  RARITY_COLORS as INK_RARITY_COLORS,
  ROLE_COLORS as INK_ROLE_COLORS,
  CINNABAR,
} from '../theme/palette';

// 颜色映射（水墨颜料）
export const NODE_COLORS = {
  character: ENTITY_COLORS.character,
  skill: ENTITY_COLORS.skill,
  item: ENTITY_COLORS.item,
  event: CINNABAR.soft,
  location: ENTITY_COLORS.location,
  faction: ENTITY_COLORS.faction,
};

// 关系类型颜色
export const RELATION_COLORS: Record<string, string> = INK_RELATION_COLORS;

// 等级颜色
export const RANK_COLORS: Record<string, string> = INK_RANK_COLORS;

// 稀有度颜色
export const RARITY_COLORS: Record<string, string> = INK_RARITY_COLORS;

// 角色类型颜色
export const ROLE_COLORS: Record<string, string> = INK_ROLE_COLORS;

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

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
  const knownSkillsByCharacter = new Map<string, string[]>();

  // 添加角色节点
  characters.forEach((char) => {
    const relationships = asArray(char.relationships);
    const knownSkills = asArray(char.known_skills);
    knownSkillsByCharacter.set(char.id, knownSkills);

    nodes.push({
      id: char.id,
      name: char.name,
      type: 'character',
      val: relationships.length + 2,
      color: ROLE_COLORS[char.role] || NODE_COLORS.character,
      data: char,
    });

    // 添加关系边
    relationships.forEach((rel) => {
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
    const techniques = asArray(skill.techniques);

    nodes.push({
      id: skill.id,
      name: skill.name,
      type: 'skill',
      val: techniques.length + 2,
      color: NODE_COLORS.skill,
      data: skill,
    });

    // 添加角色与技能的关联
    characters.forEach((char) => {
      if (asArray(knownSkillsByCharacter.get(char.id)).includes(skill.id)) {
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
    const relatedSkills = asArray(item.related_skills);

    nodes.push({
      id: item.id,
      name: item.name,
      type: 'item',
      val: 3,
      color: RARITY_COLORS[item.rarity_tier ?? item.rarity] || NODE_COLORS.item,
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
    relatedSkills.forEach((skillId) => {
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
    const subDivisions = asArray(faction.sub_divisions);

    nodes.push({
      id: faction.id,
      name: faction.name,
      type: 'faction',
      val: subDivisions.length + 3,
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

export interface RelationshipChainItem {
  targetId: string;
  targetName: string;
  targetType: GraphNode['type'];
  relation: string;
  direction: 'incoming' | 'outgoing';
  strength: number;
  color: string;
}

export interface RelationshipChainOptions {
  excludeIds?: string[];
}

/**
 * 获取某个节点的一跳关系链条，供详情面板直接展示上下文。
 */
export function getRelationshipChain(
  id: string,
  nodes: GraphNode[],
  links: GraphLink[],
  options: RelationshipChainOptions = {}
): RelationshipChainItem[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const excludedIds = new Set(options.excludeIds || []);
  const chain: RelationshipChainItem[] = [];

  links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (sourceId !== id && targetId !== id) return;

    const relatedId = sourceId === id ? targetId : sourceId;
    if (excludedIds.has(relatedId)) return;

    const relatedNode = nodeById.get(relatedId);
    if (!relatedNode) return;

    const direction = sourceId === id ? 'outgoing' : 'incoming';
    chain.push({
      targetId: relatedId,
      targetName: relatedNode.name,
      targetType: relatedNode.type,
      relation: link.type,
      direction,
      strength: link.strength,
      color: link.color,
    });
  });

  return chain.sort((a, b) => b.strength - a.strength || a.targetName.localeCompare(b.targetName));
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
