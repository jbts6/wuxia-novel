// 角色类型
export interface Character {
  id: string;
  name: string;
  alias: string[];
  identity: string;
  faction: string | null;
  role: 'protagonist' | 'companion' | 'npc' | 'villain';
  archetype: 'scholar' | 'warrior' | 'monk' | 'assassin' | 'healer';
  power_rank: string;
  importance: string;
  rank: string;
  legacy_rank?: string;
  migration_notes?: string[];
  one_line: string;
  personality: {
    traits: string[];
    speech_style: string;
    temperament: string;
  };
  relationships: Relationship[];
  known_skills: string[];
  related_skills: string[];
  rag_refs?: number[];
  source_refs: SourceRef[];
}

// 关系类型
export interface Relationship {
  target: string;
  type: string;
  intensity: number;
  bond_level: number;
  dynamic: string;
}

// 效果类型
export interface Effect {
  type: string;
  condition?: string;
  value?: string;
  description: string;
}

// 技能类型
export interface Skill {
  id: string;
  name: string;
  type: string;
  faction: string | null;
  mastery_rank: string;
  rank: string;
  legacy_rank?: string;
  migration_notes?: string[];
  one_line: string;
  rag_refs?: number[];
  techniques: Technique[];
  progression: Progression[];
  effects: Effect[];
  combat_style: string;
  source_refs: SourceRef[];
}

// 招式类型
export interface Technique {
  id: string;
  name: string;
  type: string;
  description: string;
  source_skill?: string;
}

// 进阶类型
export interface Progression {
  level: number;
  unlock: string;
}

// 物品类型
export interface Item {
  id: string;
  name: string;
  type: string;
  owner: string | null;
  one_line: string;
  description: string;
  effects: Effect[];
  origin: string;
  rarity_tier: string;
  rarity: string;
  legacy_rarity?: string;
  migration_notes?: string[];
  related_skills: string[];
  rag_refs?: number[];
  source_refs: SourceRef[];
}

// 地点类型
export interface Location {
  id: string;
  name: string;
  region: string;
  one_line: string;
  source_refs: SourceRef[];
}

// 势力类型
export interface Faction {
  id: string;
  name: string;
  type: string;
  location: string | null;
  sub_divisions: string[];
  one_line: string;
  source_refs: SourceRef[];
}

// 对话类型
export interface Dialogue {
  speaker: string;
  speaker_name: string;
  listener: string | null;
  text: string;
  tone: string;
  chapter: number;
}

// 原文引用类型
export interface SourceRef {
  chapter: number;
  line_start: number;
  line_end: number;
  text: string;
}

// 图谱节点类型
export interface GraphNode {
  id: string;
  name: string;
  type: 'character' | 'skill' | 'item' | 'location' | 'faction';
  val: number; // 节点大小
  color: string;
  data: Character | Skill | Item | Location | Faction;
}

// 图谱边类型
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  strength: number;
  color: string;
}

// 卡片类型枚举
export type CardType = 'character' | 'skill' | 'item' | 'faction' | 'location';

// 详情面板状态
export interface DetailPanelState {
  visible: boolean;
  type: CardType | null;
  id: string | null;
}

export interface DetailTrailItem {
  type: CardType;
  id: string;
}
