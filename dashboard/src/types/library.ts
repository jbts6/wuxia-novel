import type { Character, Faction, Item, Skill } from './novel';

export const DATA_FILE_NAMES = {
  characters: 'characters.yaml',
  factions: 'factions.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml',
} as const;

export type DataFileKey = keyof typeof DATA_FILE_NAMES;

export const KNOWLEDGE_ENTITY_KEYS = [
  'characters',
  'factions',
  'skills',
  'items',
] as const;
export type KnowledgeEntityKey = (typeof KNOWLEDGE_ENTITY_KEYS)[number];
export type KnowledgeEntityCounts = Record<KnowledgeEntityKey, number | null>;

export const CONTENT_ENTITY_KEYS = [
  'characters',
  'factions',
  'skills',
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

export type ReviewStatus = 'missing' | 'current' | 'stale' | 'invalid';

export interface ReviewSummary {
  status: ReviewStatus;
  warningCount: number;
  reportPath: string | null;
}

export interface ReviewReportEntry {
  code: string;
  severity: 'warning';
  category: string;
  name: string;
  chapter_numbers: number[];
  source_refs: Record<string, unknown>[];
  member_refs: string[];
  reason: string;
  resolution: string;
}

export interface ReviewReport {
  report_version: 1;
  source_hash: string | null;
  final_data_hash: string | null;
  summary: {
    warning_count: number;
    by_code: Record<string, number>;
    by_category: Record<string, number>;
  };
  entries: ReviewReportEntry[];
}

export interface ScanPassProgress {
  completed: number;
  total: number;
}

export interface SuggestedAction {
  label: string;
  reason: string;
  command: string | null;
  type?: string;
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
  review: ReviewSummary;
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

export type OptionalResourceResult<T> =
  | { status: 'available'; data: T }
  | { status: 'missing'; data: null }
  | { status: 'invalid'; data: null; error: string };

export interface RawBookExtrasResponse {
  events: OptionalResourceResult<unknown[]>;
  gameMaterials: OptionalResourceResult<unknown>;
}

export const LIBRARY_ENTITY_KINDS = ['character', 'skill', 'item', 'faction'] as const;
export type LibraryEntityKind = (typeof LIBRARY_ENTITY_KINDS)[number];
export type LibraryMaterialType = 'all' | LibraryEntityKind;
export type LibraryEntity = Character | Skill | Item | Faction;

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
}

export type LibrarySkillRecord = LibraryRecord<Skill, 'skill'>;
export type LibraryCharacterRecord = LibraryRecord<Character, 'character'>;
export type LibraryFactionRecord = LibraryRecord<Faction, 'faction'>;
export type LibraryItemRecord = LibraryRecord<Item, 'item'>;
export type AnyLibraryRecord =
  | LibrarySkillRecord
  | LibraryCharacterRecord
  | LibraryFactionRecord
  | LibraryItemRecord;

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

export interface AnnotatedLibraryRecord<
  T extends LibraryEntity,
  K extends LibraryEntityKind = LibraryEntityKind,
> extends LibraryRecord<T, K> {
  annotation: LibraryAnnotation | null;
}

export type LibrarySection = 'overview' | 'skills' | 'characters' | 'factions' | 'items';
