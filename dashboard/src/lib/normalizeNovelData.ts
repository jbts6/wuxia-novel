import type {
  ChapterSummary,
  Character,
  CharacterLevel,
  Faction,
  Item,
  NovelData,
  PowerRank,
  Skill,
  SkillTechnique,
  SourceRef,
} from '../types/novel';

const TOP_LEVEL_FIELDS = ['characters', 'skills', 'items', 'factions', 'chapter_summaries'] as const;
const CHARACTER_FIELDS = ['id', 'name', 'aliases', 'identities', 'level', 'rank', 'description', 'factions', 'skills'] as const;
const SKILL_FIELDS = ['id', 'name', 'aliases', 'factions', 'rank', 'description', 'techniques'] as const;
const ITEM_FIELDS = ['id', 'name', 'aliases', 'description'] as const;
const FACTION_FIELDS = ['id', 'name', 'aliases', 'description'] as const;
const TECHNIQUE_FIELDS = ['name', 'description'] as const;
const SUMMARY_FIELDS = ['chapter', 'title', 'summary'] as const;

const CHARACTER_LEVELS = new Set<CharacterLevel>(['核心', '重要', '次要', '龙套', '背景']);
const POWER_RANKS = new Set<PowerRank>([
  '平平无奇', '初窥门径', '略有小成', '登堂入室',
  '炉火纯青', '出神入化', '登峰造极', '返璞归真',
]);
const PLACEHOLDERS = new Set(['', 'unknown', '未知', '未分类', '未标注', '未注明', '暂无', '暂无简介']);

export class DataContractError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(
    code: string,
    path: string,
    detail = '',
  ) {
    super(`${code} at ${path}${detail ? `: ${detail}` : ''}`);
    this.name = 'DataContractError';
    this.code = code;
    this.path = path;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === 'string');
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeSourceRef(value: unknown): SourceRef | null {
  const record = asRecord(value);
  const chapter = asNumber(record.chapter, Number.NaN);
  if (!Number.isFinite(chapter)) return null;
  const alternatives = asArray(record.alternatives).map(normalizeSourceRef).filter((entry): entry is SourceRef => entry !== null);
  return {
    chapter,
    anchor: optionalString(record.anchor),
    event_type: optionalString(record.event_type),
    line_start: record.line_start === undefined ? undefined : asNumber(record.line_start),
    line_end: record.line_end === undefined ? undefined : asNumber(record.line_end),
    text: optionalString(record.text),
    anchors_hit: asStringArray(record.anchors_hit),
    locate_status: optionalString(record.locate_status),
    locate_score: record.locate_score === undefined ? undefined : asNumber(record.locate_score),
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  };
}

export function normalizeSourceRefs(value: unknown): SourceRef[] {
  return asArray(value).map(normalizeSourceRef).filter((entry): entry is SourceRef => entry !== null);
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new DataContractError('OBJECT_REQUIRED', path);
  return value;
}

function exactFields(record: Record<string, unknown>, fields: readonly string[], path: string): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) throw new DataContractError('FIELD_FORBIDDEN', `${path}.${field}`);
  }
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) throw new DataContractError('FIELD_REQUIRED', `${path}.${field}`);
  }
}

function exactFieldsWithTypes(record: Record<string, unknown>, fields: readonly string[], path: string): void {
  const allowed = new Set([...fields, 'type', 'types']);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) throw new DataContractError('FIELD_FORBIDDEN', `${path}.${field}`);
  }
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) throw new DataContractError('FIELD_REQUIRED', `${path}.${field}`);
  }
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DataContractError('ARRAY_REQUIRED', path);
  return value;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new DataContractError('STRING_REQUIRED', path);
  const normalized = value.trim();
  if (PLACEHOLDERS.has(normalized.toLocaleLowerCase('en-US'))) {
    throw new DataContractError('PLACEHOLDER_FORBIDDEN', path);
  }
  return normalized;
}

function nullableStringAt(value: unknown, path: string): string | null {
  return value === null ? null : stringAt(value, path);
}

function stringArrayAt(value: unknown, path: string): string[] {
  const result = arrayAt(value, path).map((entry, index) => stringAt(entry, `${path}[${index}]`));
  if (new Set(result).size !== result.length) throw new DataContractError('ARRAY_DUPLICATE', path);
  return result;
}

function normalizedTypes(record: Record<string, unknown>, path: string): string[] {
  const hasType = Object.hasOwn(record, 'type');
  const hasTypes = Object.hasOwn(record, 'types');
  if (hasType && hasTypes) throw new DataContractError('LEGACY_TYPE_AND_TYPES_CONFLICT', path);
  if (hasTypes) return stringArrayAt(record.types, `${path}.types`);
  if (!hasType || record.type === null) return [];
  return [stringAt(record.type, `${path}.type`)];
}

function nullableEnumAt<T extends string>(value: unknown, allowed: Set<T>, path: string): T | null {
  if (value === null) return null;
  const result = stringAt(value, path) as T;
  if (!allowed.has(result)) throw new DataContractError('ENUM_INVALID', path, result);
  return result;
}

function normalizeCharacter(value: unknown, index: number): Character {
  const path = `$.characters[${index}]`;
  const record = recordAt(value, path);
  exactFields(record, CHARACTER_FIELDS, path);
  const name = stringAt(record.name, `${path}.name`);
  const aliases = stringArrayAt(record.aliases, `${path}.aliases`);
  if (aliases.includes(name)) throw new DataContractError('ALIAS_EQUALS_NAME', `${path}.aliases`);
  return {
    id: stringAt(record.id, `${path}.id`),
    name,
    aliases,
    identities: stringArrayAt(record.identities, `${path}.identities`),
    level: nullableEnumAt(record.level, CHARACTER_LEVELS, `${path}.level`),
    rank: nullableEnumAt(record.rank, POWER_RANKS, `${path}.rank`),
    description: nullableStringAt(record.description, `${path}.description`),
    factions: stringArrayAt(record.factions, `${path}.factions`),
    skills: stringArrayAt(record.skills, `${path}.skills`),
  };
}

function normalizeTechnique(value: unknown, path: string): SkillTechnique {
  const record = recordAt(value, path);
  exactFields(record, TECHNIQUE_FIELDS, path);
  return {
    name: stringAt(record.name, `${path}.name`),
    description: nullableStringAt(record.description, `${path}.description`),
  };
}

function normalizeSkill(value: unknown, index: number): Skill {
  const path = `$.skills[${index}]`;
  const record = recordAt(value, path);
  exactFieldsWithTypes(record, SKILL_FIELDS, path);
  const name = stringAt(record.name, `${path}.name`);
  const aliases = stringArrayAt(record.aliases, `${path}.aliases`);
  if (aliases.includes(name)) throw new DataContractError('ALIAS_EQUALS_NAME', `${path}.aliases`);
  const techniques = arrayAt(record.techniques, `${path}.techniques`)
    .map((entry, techniqueIndex) => normalizeTechnique(entry, `${path}.techniques[${techniqueIndex}]`));
  if (new Set(techniques.map((entry) => entry.name)).size !== techniques.length) {
    throw new DataContractError('TECHNIQUE_DUPLICATE', `${path}.techniques`);
  }
  return {
    id: stringAt(record.id, `${path}.id`),
    name,
    aliases,
    types: normalizedTypes(record, path),
    factions: stringArrayAt(record.factions, `${path}.factions`),
    rank: nullableEnumAt(record.rank, POWER_RANKS, `${path}.rank`),
    description: nullableStringAt(record.description, `${path}.description`),
    techniques,
  };
}

function normalizeItem(value: unknown, index: number): Item {
  const path = `$.items[${index}]`;
  const record = recordAt(value, path);
  exactFieldsWithTypes(record, ITEM_FIELDS, path);
  const name = stringAt(record.name, `${path}.name`);
  const aliases = stringArrayAt(record.aliases, `${path}.aliases`);
  if (aliases.includes(name)) throw new DataContractError('ALIAS_EQUALS_NAME', `${path}.aliases`);
  return {
    id: stringAt(record.id, `${path}.id`),
    name,
    aliases,
    types: normalizedTypes(record, path),
    description: nullableStringAt(record.description, `${path}.description`),
  };
}

function normalizeFaction(value: unknown, index: number): Faction {
  const path = `$.factions[${index}]`;
  const record = recordAt(value, path);
  exactFieldsWithTypes(record, FACTION_FIELDS, path);
  const name = stringAt(record.name, `${path}.name`);
  const aliases = stringArrayAt(record.aliases, `${path}.aliases`);
  if (aliases.includes(name)) throw new DataContractError('ALIAS_EQUALS_NAME', `${path}.aliases`);
  return {
    id: stringAt(record.id, `${path}.id`),
    name,
    aliases,
    types: normalizedTypes(record, path),
    description: nullableStringAt(record.description, `${path}.description`),
  };
}

function normalizeSummary(value: unknown, index: number): ChapterSummary {
  const path = `$.chapter_summaries[${index}]`;
  const record = recordAt(value, path);
  exactFields(record, SUMMARY_FIELDS, path);
  if (!Number.isInteger(record.chapter) || (record.chapter as number) < 1) {
    throw new DataContractError('CHAPTER_INVALID', `${path}.chapter`);
  }
  return {
    chapter: record.chapter as number,
    title: stringAt(record.title, `${path}.title`),
    summary: stringAt(record.summary, `${path}.summary`),
  };
}

function assertUniqueIds(data: NovelData): void {
  const seen = new Set<string>();
  for (const category of ['characters', 'skills', 'items', 'factions'] as const) {
    data[category].forEach((entry, index) => {
      if (seen.has(entry.id)) throw new DataContractError('DUPLICATE_ID', `$.${category}[${index}].id`, entry.id);
      seen.add(entry.id);
    });
  }
}

function assertReferences(data: NovelData): void {
  const factionIds = new Set(data.factions.map((entry) => entry.id));
  const skillIds = new Set(data.skills.map((entry) => entry.id));
  const check = (ids: string[], allowed: Set<string>, path: string) => ids.forEach((id, index) => {
    if (!allowed.has(id)) throw new DataContractError('DANGLING_REFERENCE', `${path}[${index}]`, id);
  });
  data.characters.forEach((entry, index) => {
    check(entry.factions, factionIds, `$.characters[${index}].factions`);
    check(entry.skills, skillIds, `$.characters[${index}].skills`);
  });
  data.skills.forEach((entry, index) => check(entry.factions, factionIds, `$.skills[${index}].factions`));
}

export function normalizeNovelData(value: unknown): NovelData {
  const record = recordAt(value, '$');
  exactFields(record, TOP_LEVEL_FIELDS, '$');
  const data: NovelData = {
    characters: arrayAt(record.characters, '$.characters').map(normalizeCharacter),
    skills: arrayAt(record.skills, '$.skills').map(normalizeSkill),
    items: arrayAt(record.items, '$.items').map(normalizeItem),
    factions: arrayAt(record.factions, '$.factions').map(normalizeFaction),
    chapter_summaries: arrayAt(record.chapter_summaries, '$.chapter_summaries').map(normalizeSummary),
  };
  assertUniqueIds(data);
  assertReferences(data);
  return data;
}
