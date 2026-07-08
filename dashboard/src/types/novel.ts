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
  mastery_rank?: string;
  rank?: string;  // 兼容
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
  rarity_tier?: string;
  rarity?: string;  // 兼容
  tags?: string[];
  importance?: string;
  owner?: string;
  description: string;
  one_line?: string;
  description_source_refs?: SourceRef[];
  effects?: string[];
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

// 书籍元数据
export interface BookMeta {
  path: string;
  name: string;
  author: string;
  data: {
    characters: Character[];
    skills: Skill[];
    items: Item[];
    factions: Faction[];
    locations: Location[];
    dialogues: Dialogue[];
    techniques: Technique[];
    chapter_summaries: ChapterSummary[];
  };
}

// 详情面板状态
export type CardType = 'character' | 'skill' | 'item' | 'faction' | 'location';

export interface DetailPanelState {
  open: boolean;
  type: CardType | null;
  id: string | null;
}
