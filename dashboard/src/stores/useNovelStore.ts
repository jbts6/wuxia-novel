import { create } from 'zustand';
import type {
  Character,
  Skill,
  Item,
  Faction,
  Location,
  Dialogue,
  Technique,
  ChapterSummary,
  CardType,
  DetailPanelState,
} from '../types/novel';
import { buildIdMaps } from '../lib/resolveId';

interface NovelStore {
  characters: Character[];
  skills: Skill[];
  items: Item[];
  factions: Faction[];
  locations: Location[];
  dialogues: Dialogue[];
  techniques: Technique[];
  chapterSummaries: ChapterSummary[];

  characterMap: Map<string, string>;
  factionMap: Map<string, string>;
  locationMap: Map<string, string>;
  skillMap: Map<string, string>;
  itemMap: Map<string, string>;

  detailPanel: DetailPanelState;
  showDetail: (type: CardType, id: string) => void;
  hideDetail: () => void;

  loadData: (data: {
    characters: Character[];
    skills: Skill[];
    items: Item[];
    factions: Faction[];
    locations: Location[];
    dialogues: Dialogue[];
    techniques: Technique[];
    chapter_summaries: ChapterSummary[];
  }) => void;
}

export const useNovelStore = create<NovelStore>((set) => ({
  characters: [],
  skills: [],
  items: [],
  factions: [],
  locations: [],
  dialogues: [],
  techniques: [],
  chapterSummaries: [],

  characterMap: new Map(),
  factionMap: new Map(),
  locationMap: new Map(),
  skillMap: new Map(),
  itemMap: new Map(),

  detailPanel: { open: false, type: null, id: null },
  showDetail: (type, id) =>
    set({ detailPanel: { open: true, type, id } }),
  hideDetail: () =>
    set({ detailPanel: { open: false, type: null, id: null } }),

  loadData: (data) => {
    const maps = buildIdMaps(data);
    set({
      characters: data.characters,
      skills: data.skills,
      items: data.items,
      factions: data.factions,
      locations: data.locations,
      dialogues: data.dialogues,
      techniques: data.techniques,
      chapterSummaries: data.chapter_summaries,
      ...maps,
    });
  },
}));
