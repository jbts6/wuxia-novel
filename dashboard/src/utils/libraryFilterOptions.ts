import type { BookMeta } from '../stores/useBookStore';
import type { LibraryCollections, LibraryFilters, LibrarySection } from '../types/library';
import { isLegendaryItem, isTopTierSkill } from './libraryAggregate';
import { getUniqueFilterValues } from './libraryFilters';

export interface LibraryFilterOptions {
  rank?: string[];
  author?: string[];
  bookPath?: Array<{ label: string; value: string }>;
  type?: string[];
  faction?: string[];
  role?: string[];
  archetype?: string[];
  rarity?: string[];
}

export const SECTION_FILTER_KEYS: Record<LibrarySection, Array<keyof LibraryFilters>> = {
  overview: [],
  skills: ['keyword', 'rank', 'author', 'bookPath', 'type', 'faction'],
  characters: ['keyword', 'author', 'bookPath', 'faction', 'role', 'archetype'],
  factions: ['keyword', 'author', 'bookPath', 'type'],
  items: ['keyword', 'author', 'bookPath', 'type', 'rarity'],
  export: [],
};

export function getLibraryFilterOptions(
  section: LibrarySection,
  collections: LibraryCollections,
  books: BookMeta[],
): LibraryFilterOptions {
  const commonOptions = {
    author: getUniqueFilterValues(books.map((book) => book.author)),
    bookPath: books.map((book) => ({ label: `${book.author} / ${book.name}`, value: book.path })),
  };

  switch (section) {
    case 'skills': {
      const topSkills = collections.skills.filter((record) => isTopTierSkill(record.entity));
      return {
        ...commonOptions,
        rank: getUniqueFilterValues(topSkills.map((record) => record.entity.rank)),
        type: getUniqueFilterValues(topSkills.map((record) => record.entity.type)),
        faction: getUniqueFilterValues(topSkills.map((record) => record.entity.faction)),
      };
    }
    case 'characters':
      return {
        ...commonOptions,
        faction: getUniqueFilterValues(collections.characters.map((record) => record.entity.faction)),
        role: getUniqueFilterValues(collections.characters.map((record) => record.entity.role)),
        archetype: getUniqueFilterValues(collections.characters.map((record) => record.entity.archetype)),
      };
    case 'factions':
      return {
        ...commonOptions,
        type: getUniqueFilterValues(collections.factions.map((record) => record.entity.type)),
      };
    case 'items': {
      const legendaryItems = collections.items.filter((record) => isLegendaryItem(record.entity));
      return {
        ...commonOptions,
        type: getUniqueFilterValues(legendaryItems.map((record) => record.entity.type)),
        rarity: getUniqueFilterValues(legendaryItems.map((record) => record.entity.rarity)),
      };
    }
    case 'overview':
    case 'export':
      return {};
  }
}

export function resetInactiveLibraryFilters(
  filters: LibraryFilters,
  section: LibrarySection,
): Partial<LibraryFilters> {
  const activeKeys = new Set<keyof LibraryFilters>(SECTION_FILTER_KEYS[section]);
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => {
      if (activeKeys.has(key as keyof LibraryFilters)) return false;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).map(([key, value]) => [key, Array.isArray(value) ? [] : '']),
  ) as Partial<LibraryFilters>;
}
