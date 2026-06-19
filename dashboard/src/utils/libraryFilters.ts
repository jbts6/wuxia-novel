import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryFilters, LibraryRecord } from '../types/library';

export function createEmptyLibraryFilters(): LibraryFilters {
  return {
    keyword: '',
    rank: [],
    author: [],
    bookPath: [],
    type: [],
    faction: [],
    role: [],
    archetype: [],
    rarity: [],
  };
}

function normalizeFilterValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function getUniqueFilterValues(values: unknown[]): string[] {
  return Array.from(new Set(values.map(normalizeFilterValue).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  );
}

function includesFilter(value: unknown, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const normalized = normalizeFilterValue(value);
  return Boolean(normalized && selected.includes(normalized));
}

function textIncludesKeyword(values: Array<unknown>, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;

  return values.some((value) => {
    if (value == null) return false;
    if (Array.isArray(value)) return textIncludesKeyword(value, normalized);
    if (typeof value === 'object') return textIncludesKeyword(Object.values(value), normalized);
    return String(value).toLowerCase().includes(normalized);
  });
}

function matchesSource<T>(record: LibraryRecord<T>, filters: LibraryFilters): boolean {
  return (
    includesFilter(record.source.author, filters.author) &&
    includesFilter(record.source.bookPath, filters.bookPath)
  );
}

export function filterSkills(records: LibraryRecord<Skill>[], filters: LibraryFilters): LibraryRecord<Skill>[] {
  return records.filter(
    (record) =>
      matchesSource(record, filters) &&
      includesFilter(record.entity.rank, filters.rank) &&
      includesFilter(record.entity.type, filters.type) &&
      includesFilter(record.entity.faction, filters.faction) &&
      textIncludesKeyword(
        [
          record.entity.name,
          record.entity.one_line,
          record.entity.combat_style,
          record.entity.techniques,
          record.entity.effects,
          record.source.author,
          record.source.bookName,
        ],
        filters.keyword,
      ),
  );
}

export function filterCharacters(records: LibraryRecord<Character>[], filters: LibraryFilters): LibraryRecord<Character>[] {
  return records.filter(
    (record) =>
      matchesSource(record, filters) &&
      includesFilter(record.entity.rank, filters.rank) &&
      includesFilter(record.entity.faction, filters.faction) &&
      includesFilter(record.entity.role, filters.role) &&
      includesFilter(record.entity.archetype, filters.archetype) &&
      textIncludesKeyword(
        [
          record.entity.name,
          record.entity.alias,
          record.entity.identity,
          record.entity.one_line,
          record.entity.personality,
          record.source.author,
          record.source.bookName,
        ],
        filters.keyword,
      ),
  );
}

export function filterFactions(records: LibraryRecord<Faction>[], filters: LibraryFilters): LibraryRecord<Faction>[] {
  return records.filter(
    (record) =>
      matchesSource(record, filters) &&
      includesFilter(record.entity.type, filters.type) &&
      textIncludesKeyword(
        [
          record.entity.name,
          record.entity.one_line,
          record.entity.location,
          record.entity.sub_divisions,
          record.source.author,
          record.source.bookName,
        ],
        filters.keyword,
      ),
  );
}

export function filterItems(records: LibraryRecord<Item>[], filters: LibraryFilters): LibraryRecord<Item>[] {
  return records.filter(
    (record) =>
      matchesSource(record, filters) &&
      includesFilter(record.entity.type, filters.type) &&
      includesFilter(record.entity.rarity, filters.rarity) &&
      textIncludesKeyword(
        [
          record.entity.name,
          record.entity.one_line,
          record.entity.description,
          record.entity.origin,
          record.entity.effects,
          record.source.author,
          record.source.bookName,
        ],
        filters.keyword,
      ),
  );
}
