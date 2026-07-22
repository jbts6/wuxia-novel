import type { DataFileKey } from './library';

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

export type CharacterLevel = '核心' | '重要' | '次要' | '龙套' | '背景';

export type PowerRank =
  | '平平无奇'
  | '初窥门径'
  | '略有小成'
  | '登堂入室'
  | '炉火纯青'
  | '出神入化'
  | '登峰造极'
  | '返璞归真';

export interface SkillTechnique {
  name: string;
  description: string | null;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  identities: string[];
  level: CharacterLevel | null;
  rank: PowerRank | null;
  description: string | null;
  factions: string[];
  skills: string[];
}

export interface Skill {
  id: string;
  name: string;
  aliases: string[];
  types: string[];
  factions: string[];
  rank: PowerRank | null;
  description: string | null;
  techniques: SkillTechnique[];
}

export interface Item {
  id: string;
  name: string;
  aliases: string[];
  types: string[];
  description: string | null;
}

export interface Faction {
  id: string;
  name: string;
  aliases: string[];
  types: string[];
  description: string | null;
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
}

export interface NovelData {
  characters: Character[];
  skills: Skill[];
  items: Item[];
  factions: Faction[];
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
export type ReviewEntity = {
  key: string;
  id: string;
  name: string;
  type: Exclude<DataFileKey, 'chapter_summaries'>;
  summary: string; // one_line 或 identity 或 description
  marked: boolean; // 是否标记为删除
  data: Record<string, unknown>; // 原始数据
} | {
  key: string;
  chapter: number;
  name: string;
  type: 'chapter_summaries';
  summary: string;
  marked: boolean;
  data: Record<string, unknown>;
};

export interface ReviewFilter {
  type: 'all' | DataFileKey;
  status: 'all' | 'unmarked' | 'marked';
  search: string;
}

export interface ReviewFile {
  name: string;
  path: string;
  type: DataFileKey;
}
