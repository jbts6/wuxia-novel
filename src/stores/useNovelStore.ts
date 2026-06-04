import { create } from 'zustand';
import type {
  Character,
  Skill,
  Technique,
  Item,
  Event,
  Location,
  Faction,
  Dialogue,
  CardType,
  DetailPanelState,
  GraphNode,
  GraphLink,
} from '../types/novel';

interface NovelStore {
  // 数据
  characters: Character[];
  skills: Skill[];
  techniques: Technique[];
  items: Item[];
  events: Event[];
  locations: Location[];
  factions: Faction[];
  dialogues: Dialogue[];

  // 书籍路径
  currentBookPath: string | null;

  // 状态
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedNodeType: CardType | null;
  selectedNodeId: string | null;
  detailPanel: DetailPanelState;

  // 图谱数据
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];

  // Actions
  setData: (data: {
    characters: Character[];
    skills: Skill[];
    techniques: Technique[];
    items: Item[];
    events: Event[];
    locations: Location[];
    factions: Faction[];
    dialogues: Dialogue[];
  }) => void;
  setBookPath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  showDetail: (type: CardType, id: string) => void;
  hideDetail: () => void;
  buildGraphData: () => void;
}

// 颜色映射
const NODE_COLORS: Record<CardType, string> = {
  character: '#1890ff',
  skill: '#52c41a',
  item: '#faad14',
  event: '#ff4d4f',
  location: '#722ed1',
  faction: '#13c2c2',
};

// 关系类型颜色
const RELATION_COLORS: Record<string, string> = {
  挚友: '#52c41a',
  恋人: '#ff4d4f',
  旧爱: '#ff7875',
  结义兄弟: '#1890ff',
  知己: '#9254de',
  主仆: '#8c8c8c',
  宿敌: '#ff4d4f',
  对手: '#faad14',
  朋友: '#69c0ff',
  合作者: '#b7eb8f',
};

export const useNovelStore = create<NovelStore>((set, get) => ({
  // 初始数据
  characters: [],
  skills: [],
  techniques: [],
  items: [],
  events: [],
  locations: [],
  factions: [],
  dialogues: [],

  // 书籍路径
  currentBookPath: null,

  // 初始状态
  loading: true,
  error: null,
  searchQuery: '',
  selectedNodeType: null,
  selectedNodeId: null,
  detailPanel: {
    visible: false,
    type: null,
    id: null,
  },

  // 图谱数据
  graphNodes: [],
  graphLinks: [],

  // 设置数据
  setData: (data) => {
    set(data);
    get().buildGraphData();
  },

  setBookPath: (path) => set({ currentBookPath: path }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // 显示详情
  showDetail: (type, id) => {
    set({
      detailPanel: {
        visible: true,
        type,
        id,
      },
    });
  },

  // 隐藏详情
  hideDetail: () => {
    set({
      detailPanel: {
        visible: false,
        type: null,
        id: null,
      },
    });
  },

  // 构建图谱数据
  buildGraphData: () => {
    const { characters, skills, items, locations, factions } = get();

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // 添加角色节点
    characters.forEach((char) => {
      nodes.push({
        id: char.id,
        name: char.name,
        type: 'character',
        val: char.relationships.length + 1,
        color: NODE_COLORS.character,
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
        val: skill.techniques.length + 1,
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
            strength: 0.8,
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
        val: 2,
        color: NODE_COLORS.item,
        data: item,
      });

      // 添加物品与持有者的关联
      if (item.owner) {
        links.push({
          source: item.owner,
          target: item.id,
          type: '持有',
          strength: 0.9,
          color: '#d9d9d9',
        });
      }
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
        val: 3,
        color: NODE_COLORS.faction,
        data: faction,
      });

      // 添加势力与地点的关联
      if (faction.location) {
        links.push({
          source: faction.id,
          target: faction.location,
          type: '总部',
          strength: 0.9,
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
            strength: 0.8,
            color: '#d9d9d9',
          });
        }
      });
    });

    set({ graphNodes: nodes, graphLinks: links });
  },
}));
