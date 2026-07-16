// 基于 generate-kb 新 schema 的类型定义

export interface SourceRef {
  chapter: number;
  anchor?: string;
  event_type?: string;
  line_start?: number;
  line_end?: number;
  text?: string;
  anchors_hit?: string[];
  locate_status?: string;
  locate_score?: number;
  alternatives?: SourceRef[];
}

export const GAME_MATERIAL_TYPES = [
  '战斗系统原型',
  '经典剧情桥段',
  '角色原型/彩蛋',
  '标志性物品',
  '门派与世界观素材',
] as const;

export type GameMaterialType = (typeof GAME_MATERIAL_TYPES)[number];

export interface Event {
  id: string;
  name: string;
  importance: string;
  cause: string;
  process: string;
  result: string;
  participants: string[];
  locations: string[];
  source_refs: SourceRef[];
}

export interface GameMaterial {
  material_type: GameMaterialType;
  source_id: string;
  relevance: string;
  suggested_use: string;
  reason: string;
}

export interface GameMaterialsReport {
  schema_version: string | number;
  entries: GameMaterial[];
}

export type BookExtraResource<T> =
  | { status: 'available'; data: T }
  | { status: 'missing'; data: null }
  | { status: 'invalid'; data: null; error: string };

export interface BookExtrasData {
  events: BookExtraResource<Event[]>;
  gameMaterials: BookExtraResource<GameMaterialsReport>;
}

export interface Character {
  id: string;
  name: string;
  alias: string[];  // JSON 中是 alias，不是 aliases
  role: string;
  archetype?: string;
  power_rank?: string;
  faction?: string | null;
  identity?: string;
  importance?: string;
  one_line?: string;  // JSON 中是 one_line，不是 bio
  bio?: string;  // 兼容
  bio_source_refs?: SourceRef[];
  aliases?: string[];  // 兼容
  personality: {
    traits: string[];
    speech_style: string;
    temperament?: string;
  };
  relationships: {
    target: string;
    type: string;
    intensity?: number;
    bond_level?: number;
    dynamic: string;
  }[];
  skills?: string[];
  items?: string[];
  classic_lines?: string[];
  source_refs?: SourceRef[];
}

export interface Skill {
  id: string;
  name: string;
  type: string;
  faction?: string | null;
  power_rank?: string;
  description: string;
  one_line?: string;
  description_source_refs?: SourceRef[];
  moves?: string[];
  combat_style?: string[];
  holders?: string[];
  techniques?: string[];
  source_refs?: SourceRef[];
}

export interface Item {
  id: string;
  name: string;
  type: string;
  tags?: string[];
  importance?: string;
  owner?: string;
  description: string;
  one_line?: string;
  description_source_refs?: SourceRef[];
  effects?: (string | { type: string; description: string })[];
  related_skills?: string[];
  related_characters?: string[];
  source_refs?: SourceRef[];
}

export interface Faction {
  id: string;
  name: string;
  type: string;
  location?: string;
  leader?: string;
  description: string;
  one_line?: string;
  description_source_refs?: SourceRef[];
  members?: string[];
  sub_organizations?: string[];
  sub_divisions?: string[];  // 兼容
  source_refs?: SourceRef[];
}

export interface Location {
  id: string;
  name: string;
  region?: string;
  description: string;
  one_line?: string;
  description_source_refs?: SourceRef[];
  factions?: string[];
  characters?: string[];
  source_refs?: SourceRef[];
}

export interface Dialogue {
  id: string;
  speaker: string;
  speaker_name?: string;  // 兼容
  chapter: number;
  line_start?: number;
  line_end?: number;
  text: string;
  tone?: string;
  context?: string;
  source_refs?: SourceRef[];
}

export interface Technique {
  id: string;
  name: string;
  skill: string;
  source_skill?: string;  // 兼容
  type?: string;
  description: string;
  source_refs?: SourceRef[];
}

export interface ChapterSummary {
  chapter: number;
  title: string;
  summary: string;
  key_events: string[];
  key_characters: string[];
}

export interface NovelData {
  characters: Character[];
  skills: Skill[];
  items: Item[];
  factions: Faction[];
  locations: Location[];
  dialogues: Dialogue[];
  techniques: Technique[];
  chapter_summaries: ChapterSummary[];
}

// 兼容仍需要携带完整数据的调用方
export interface BookMeta {
  path: string;
  name: string;
  author: string;
  data: NovelData;
}

// 详情面板状态
export type CardType = 'character' | 'skill' | 'technique' | 'item' | 'faction' | 'location' | 'event';

export interface DetailPanelState {
  open: boolean;
  type: CardType | null;
  id: string | null;
}

// 审核相关类型
export interface ReviewEntity {
  id: string;
  name: string;
  type: 'character' | 'skill' | 'item';
  summary: string; // one_line 或 identity 或 description
  marked: boolean; // 是否标记为删除
  data: Record<string, unknown>; // 原始数据
}

export interface ReviewFilter {
  type: 'all' | 'character' | 'skill' | 'item';
  status: 'all' | 'unmarked' | 'marked';
  search: string;
}

export interface ReviewFile {
  name: string;
  path: string;
  type: string;
}
