import {
  CONTENT_ENTITY_KEYS,
  type ContentCoverage,
  type ContentEntityKey,
  type DataFileKey,
  type EntityContentCount,
  type LibraryEntityKind,
} from '../types/library';

const CONTENT_FIELDS: Record<ContentEntityKey, readonly string[]> = {
  characters: [
    'alias',
    'aliases',
    'role',
    'archetype',
    'power_rank',
    'faction',
    'identity',
    'importance',
    'one_line',
    'bio',
    'biography',
    'description',
    'personality',
    'relationships',
    'skills',
    'known_skills',
    'related_skills',
    'items',
    'classic_lines',
  ],
  factions: [
    'type',
    'location',
    'headquarters',
    'leader',
    'description',
    'one_line',
    'history',
    'significance',
    'members',
    'notable_members',
    'sub_organizations',
    'sub_divisions',
    'power_rank',
    'power_level',
  ],
  locations: [
    'type',
    'region',
    'description',
    'one_line',
    'significance',
    'factions',
    'related_factions',
    'characters',
    'related_characters',
  ],
  skills: [
    'alias',
    'type',
    'faction',
    'mastery_rank',
    'rank',
    'description',
    'one_line',
    'moves',
    'combat_style',
    'holders',
    'practitioners',
    'techniques',
    'effects',
    'mechanism',
    'progression',
  ],
  techniques: [
    'type',
    'skill',
    'source_skill',
    'parent_skill',
    'description',
    'one_line',
    'effects',
    'holders',
    'used_by',
    'practitioners',
  ],
  items: [
    'type',
    'rarity_tier',
    'rarity',
    'tags',
    'importance',
    'owner',
    'description',
    'one_line',
    'function',
    'significance',
    'origin',
    'effects',
    'related_skills',
    'related_characters',
  ],
};

const EMPTY_DISPLAY_VALUES = new Set([
  '',
  'unknown',
  '未知',
  '未分类',
  '未标注',
  '未注明',
  '暂无',
  '暂无简介',
]);

const LIBRARY_KIND_CONTENT_KEYS: Record<LibraryEntityKind, ContentEntityKey> = {
  character: 'characters',
  skill: 'skills',
  item: 'items',
  faction: 'factions',
  location: 'locations',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') return !EMPTY_DISPLAY_VALUES.has(value.trim().toLocaleLowerCase('en-US'));
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) return Object.values(value).some(hasMeaningfulValue);
  return false;
}

function emptyCount(): EntityContentCount {
  return { total: 0, detailed: 0, indexOnly: 0 };
}

export function isContentEntityKey(key: DataFileKey): key is ContentEntityKey {
  return (CONTENT_ENTITY_KEYS as readonly string[]).includes(key);
}

export function hasEntityContent(key: ContentEntityKey, value: unknown): boolean {
  if (!isRecord(value)) return false;
  return CONTENT_FIELDS[key].some((field) => hasMeaningfulValue(value[field]));
}

export function hasLibraryEntityContent(kind: LibraryEntityKind, value: unknown): boolean {
  return hasEntityContent(LIBRARY_KIND_CONTENT_KEYS[kind], value);
}

export function createEmptyContentCoverage(): ContentCoverage {
  return {
    state: 'empty',
    total: 0,
    detailed: 0,
    indexOnly: 0,
    byEntity: Object.fromEntries(CONTENT_ENTITY_KEYS.map((key) => [key, emptyCount()])) as ContentCoverage['byEntity'],
  };
}

export function summarizeContentCoverage(byEntity: ContentCoverage['byEntity']): ContentCoverage {
  const totals = CONTENT_ENTITY_KEYS.reduce<EntityContentCount>(
    (result, key) => ({
      total: result.total + byEntity[key].total,
      detailed: result.detailed + byEntity[key].detailed,
      indexOnly: result.indexOnly + byEntity[key].indexOnly,
    }),
    emptyCount(),
  );

  const state = totals.total === 0
    ? 'empty'
    : totals.detailed === 0
      ? 'index-only'
      : totals.detailed === totals.total
        ? 'complete'
        : 'partial';

  return { state, ...totals, byEntity };
}
