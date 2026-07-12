import type { Character, Faction, Item, Location, Skill, SourceRef } from './novel';

export const DATA_FILE_NAMES = {
  characters: 'characters.json',
  factions: 'factions.json',
  locations: 'locations.json',
  skills: 'skills.json',
  techniques: 'techniques.json',
  items: 'items.json',
  dialogues: 'dialogues.json',
  chapter_summaries: 'chapter_summaries.json',
} as const;

export type DataFileKey = keyof typeof DATA_FILE_NAMES;

export const KNOWLEDGE_ENTITY_KEYS = [
  'characters',
  'factions',
  'locations',
  'skills',
  'techniques',
  'items',
  'dialogues',
] as const;
export type KnowledgeEntityKey = (typeof KNOWLEDGE_ENTITY_KEYS)[number];
export type KnowledgeEntityCounts = Record<KnowledgeEntityKey, number | null>;

export const CONTENT_ENTITY_KEYS = [
  'characters',
  'factions',
  'locations',
  'skills',
  'techniques',
  'items',
] as const;
export type ContentEntityKey = (typeof CONTENT_ENTITY_KEYS)[number];
export type EntityContentState = 'empty' | 'index-only' | 'partial' | 'complete';

export interface EntityContentCount {
  total: number;
  detailed: number;
  indexOnly: number;
}

export interface ContentCoverage extends EntityContentCount {
  state: EntityContentState;
  byEntity: Record<ContentEntityKey, EntityContentCount>;
}

export const SCAN_PASS_NAMES = ['named-inventory', 'event-dialogue', 'gap-audit'] as const;
export type ScanPassName = (typeof SCAN_PASS_NAMES)[number];

export type GenerationStage =
  | 'not-started'
  | 'prepared'
  | 'scanning'
  | 'pending-merge'
  | 'pending-gap'
  | 'data-produced';

export type ValidationStatus = 'not-validated' | 'legacy-unproven' | 'failed' | 'passed';

export interface ScanPassProgress {
  completed: number;
  total: number;
}

export interface SuggestedAction {
  label: string;
  reason: string;
  command: string | null;
}

export interface ArtifactState {
  sourceText: boolean;
  chapterSplit: boolean;
  sourceIndex: boolean;
  scanManifest: boolean;
  candidates: boolean;
  decisions: boolean;
  qualityReport: boolean;
}

export interface DataCompleteness {
  present: number;
  valid: number;
  required: number;
}

export interface LibraryBookStatus {
  path: string;
  author: string;
  name: string;
  generationStage: GenerationStage;
  validationStatus: ValidationStatus;
  browseable: boolean;
  completed: boolean;
  schemaVersion: string | null;
  lastUpdatedAt: string | null;
  scanProgress: Record<ScanPassName, ScanPassProgress>;
  artifacts: ArtifactState;
  dataCompleteness: DataCompleteness;
  contentCoverage: ContentCoverage;
  entityCounts: KnowledgeEntityCounts;
  missingArtifacts: string[];
  errors: string[];
  gateFailures: string[];
  suggestedAction: SuggestedAction | null;
}

export interface ScanWarning {
  path: string;
  message: string;
}

export interface LibraryStatusResponse {
  scannedAt: string;
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    browseable: number;
    contentIncomplete: number;
    completed: number;
  };
  books: LibraryBookStatus[];
  warnings: ScanWarning[];
}

export type RawNovelData = Record<DataFileKey, unknown[]>;

export const LIBRARY_ENTITY_KINDS = ['character', 'skill', 'item', 'faction', 'location'] as const;
export type LibraryEntityKind = (typeof LIBRARY_ENTITY_KINDS)[number];
export type LibraryMaterialType = 'all' | LibraryEntityKind;
export type LibraryEntity = Character | Skill | Item | Faction | Location;

export interface LibrarySource {
  author: string;
  bookName: string;
  bookPath: string;
}

export interface LibraryRecord<
  T extends LibraryEntity = LibraryEntity,
  K extends LibraryEntityKind = LibraryEntityKind,
> {
  key: string;
  kind: K;
  source: LibrarySource;
  entity: T;
  name: string;
  summary: string;
  facet: string;
  searchText: string;
  evidence: SourceRef[];
}

export type LibrarySkillRecord = LibraryRecord<Skill, 'skill'>;
export type LibraryCharacterRecord = LibraryRecord<Character, 'character'>;
export type LibraryFactionRecord = LibraryRecord<Faction, 'faction'>;
export type LibraryItemRecord = LibraryRecord<Item, 'item'>;
export type LibraryLocationRecord = LibraryRecord<Location, 'location'>;
export type AnyLibraryRecord =
  | LibrarySkillRecord
  | LibraryCharacterRecord
  | LibraryFactionRecord
  | LibraryItemRecord
  | LibraryLocationRecord;

export interface LibraryCollections {
  skills: LibrarySkillRecord[];
  characters: LibraryCharacterRecord[];
  factions: LibraryFactionRecord[];
  items: LibraryItemRecord[];
  locations: LibraryLocationRecord[];
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

export interface AnnotatedLibraryRecord<
  T extends LibraryEntity,
  K extends LibraryEntityKind = LibraryEntityKind,
> extends LibraryRecord<T, K> {
  annotation: LibraryAnnotation | null;
}

export type LibrarySection = 'overview' | 'skills' | 'characters' | 'factions' | 'items' | 'locations';

export interface CharacterAppearance {
  source: LibrarySource;
  role: string;
  power_rank: string;
  importance: string;
  faction: string | null;
  relationships: Character['relationships'];
  known_skills: string[];
}

export interface MergedCharacterRecord {
  key: string;
  entityId: string;
  name: string;
  alias: string[];
  identity: string;
  one_line: string;
  personality: Character['personality'];
  archetype: string;
  appearances: CharacterAppearance[];
  primary: CharacterAppearance;
}
