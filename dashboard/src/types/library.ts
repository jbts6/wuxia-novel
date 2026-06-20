import type { Character, Faction, Item, Skill } from './novel';

export type LibraryEntityKind = 'skill' | 'character' | 'faction' | 'item';
export type LibraryMaterialType = 'all' | LibraryEntityKind;

export interface LibrarySource {
  author: string;
  bookName: string;
  bookPath: string;
}

export interface LibraryRecord<T> {
  key: string;
  kind: LibraryEntityKind;
  source: LibrarySource;
  entity: T;
}

export type LibrarySkillRecord = LibraryRecord<Skill>;
export type LibraryCharacterRecord = LibraryRecord<Character>;
export type LibraryFactionRecord = LibraryRecord<Faction>;
export type LibraryItemRecord = LibraryRecord<Item>;

export interface LibraryCollections {
  skills: LibrarySkillRecord[];
  characters: LibraryCharacterRecord[];
  factions: LibraryFactionRecord[];
  items: LibraryItemRecord[];
}

export interface LibraryLoadWarning {
  bookPath: string;
  bookName: string;
  file: string;
  message: string;
}

export interface LibraryDataState extends LibraryCollections {
  loading: boolean;
  error: string | null;
  warnings: LibraryLoadWarning[];
}

export interface LibraryFilters {
  keyword: string;
  materialType: LibraryMaterialType;
  masteryRank: string[];
  powerRank: string[];
  importance: string[];
  author: string[];
  bookPath: string[];
  type: string[];
  faction: string[];
  role: string[];
  archetype: string[];
  rarityTier: string[];
}

export interface LibraryAnnotation {
  key: string;
  gameTags: string[];
  strengthScore?: number;
  designNotes?: string;
  exportEnabled?: boolean;
  updatedAt: string;
}

export type LibraryAnnotationMap = Record<string, LibraryAnnotation>;

export interface AnnotatedLibraryRecord<T> extends LibraryRecord<T> {
  annotation: LibraryAnnotation | null;
}

export type LibrarySection = 'overview' | 'skills' | 'characters' | 'factions' | 'items' | 'export';
