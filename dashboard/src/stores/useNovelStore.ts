import { create } from 'zustand';
import type {
  Character,
  Skill,
  Technique,
  Item,
  Location,
  Faction,
  Dialogue,
  CardType,
  DetailPanelState,
  DetailTrailItem,
  GraphNode,
  GraphLink,
} from '../types/novel';
import { buildGraphData as buildNovelGraphData } from '../utils/graphHelper';
import { appendDetailTrail } from '../utils/detailNavigation';

interface NovelStore {
  // 数据
  characters: Character[];
  skills: Skill[];
  techniques: Technique[];
  items: Item[];
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
  detailTrail: DetailTrailItem[];

  // 图谱数据
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];

  // Actions
  setData: (data: {
    characters: Character[];
    skills: Skill[];
    techniques: Technique[];
    items: Item[];
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

export const useNovelStore = create<NovelStore>((set, get) => ({
  // 初始数据
  characters: [],
  skills: [],
  techniques: [],
  items: [],
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
  detailTrail: [],

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
    const currentTrail = get().detailTrail;
    set({
      detailPanel: {
        visible: true,
        type,
        id,
      },
      detailTrail: appendDetailTrail(currentTrail, { type, id }),
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
      detailTrail: [],
    });
  },

  // 构建图谱数据
  buildGraphData: () => {
    const { characters, skills, items, locations, factions } = get();
    const { nodes, links } = buildNovelGraphData(characters, skills, items, locations, factions);

    set({ graphNodes: nodes, graphLinks: links });
  },
}));
