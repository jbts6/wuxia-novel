import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryCollections, LibrarySource } from '../types/library';
import { buildLibraryKey } from './libraryKeys';

export interface RawBookLibraryData {
  source: LibrarySource;
  skills: Skill[];
  characters: Character[];
  factions: Faction[];
  items: Item[];
}

export interface LibrarySummary {
  authors: number;
  books: number;
  skills: number;
  topTierSkills: number;
  characters: number;
  factions: number;
  items: number;
  legendaryItems: number;
}

export function isTopTierSkill(skill: Pick<Skill, 'mastery_rank' | 'rank'>): boolean {
  const rank = skill.mastery_rank ?? skill.rank;
  return rank === '返璞归真' || rank === '登峰造极';
}

export function isLegendaryItem(item: Pick<Item, 'rarity_tier' | 'rarity'>): boolean {
  return (item.rarity_tier ?? item.rarity) === '绝世神兵';
}

export function aggregateLibraryCollections(books: RawBookLibraryData[]): LibraryCollections {
  return books.reduce<LibraryCollections>(
    (collections, book) => {
      book.skills.forEach((skill) => {
        collections.skills.push({
          key: buildLibraryKey('skill', book.source.bookPath, skill.id),
          kind: 'skill',
          source: book.source,
          entity: skill,
        });
      });

      book.characters.forEach((character) => {
        collections.characters.push({
          key: buildLibraryKey('character', book.source.bookPath, character.id),
          kind: 'character',
          source: book.source,
          entity: character,
        });
      });

      book.factions.forEach((faction) => {
        collections.factions.push({
          key: buildLibraryKey('faction', book.source.bookPath, faction.id),
          kind: 'faction',
          source: book.source,
          entity: faction,
        });
      });

      book.items.forEach((item) => {
        collections.items.push({
          key: buildLibraryKey('item', book.source.bookPath, item.id),
          kind: 'item',
          source: book.source,
          entity: item,
        });
      });

      return collections;
    },
    { skills: [], characters: [], factions: [], items: [] },
  );
}

export function summarizeLibrary(collections: LibraryCollections): LibrarySummary {
  const sourceRecords = [
    ...collections.skills,
    ...collections.characters,
    ...collections.factions,
    ...collections.items,
  ];

  return {
    authors: new Set(sourceRecords.map((record) => record.source.author)).size,
    books: new Set(sourceRecords.map((record) => record.source.bookPath)).size,
    skills: collections.skills.length,
    topTierSkills: collections.skills.filter((record) => isTopTierSkill(record.entity)).length,
    characters: collections.characters.length,
    factions: collections.factions.length,
    items: collections.items.length,
    legendaryItems: collections.items.filter((record) => isLegendaryItem(record.entity)).length,
  };
}
