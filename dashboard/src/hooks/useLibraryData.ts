import { useEffect, useState } from 'react';
import type { Character, Faction, Item, Skill } from '../types/novel';
import type { LibraryCollections, LibraryDataState, LibraryLoadWarning } from '../types/library';
import type { BookMeta } from '../stores/useBookStore';
import {
  buildNovelFileUrl,
  type NovelDataFile,
} from '../data/novelData';
import { aggregateLibraryCollections, type RawBookLibraryData } from '../utils/libraryAggregate';

const LIBRARY_FILES = ['skills.json', 'characters.json', 'factions.json', 'items.json'] as const;
type LibraryFile = Extract<NovelDataFile, (typeof LIBRARY_FILES)[number]>;

type EntityByFile = {
  'skills.json': Skill[];
  'characters.json': Character[];
  'factions.json': Faction[];
  'items.json': Item[];
};

export type LibraryFileFetcher = <TFile extends LibraryFile>(
  file: TFile,
  book: BookMeta,
) => Promise<EntityByFile[TFile]>;

const EMPTY_COLLECTIONS: LibraryCollections = { skills: [], characters: [], factions: [], items: [] };
const EMPTY_LIBRARY_STATE: LibraryDataState = {
  ...EMPTY_COLLECTIONS,
  loading: false,
  error: null,
  warnings: [],
};

export async function defaultLibraryFileFetcher<TFile extends LibraryFile>(
  file: TFile,
  book: BookMeta,
): Promise<EntityByFile[TFile]> {
  const response = await fetch(buildNovelFileUrl(file, book.path));
  if (!response.ok) throw new Error(`Failed to load ${file}`);
  return response.json();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function resolveFaction(value: string | null, map: Map<string, string>): string | null {
  if (!value || value === 'faction_none') return null;
  return map.get(value) ?? value;
}

export async function loadLibraryData(
  books: BookMeta[],
  fetcher: LibraryFileFetcher = defaultLibraryFileFetcher,
  concurrency = 4,
): Promise<LibraryCollections & { warnings: LibraryLoadWarning[] }> {
  const warnings: LibraryLoadWarning[] = [];
  const safeConcurrency = Math.max(1, concurrency);

  const rawBooks = await mapWithConcurrency(books, safeConcurrency, async (book): Promise<RawBookLibraryData> => {
    const data: RawBookLibraryData = {
      source: { author: book.author, bookName: book.name, bookPath: book.path },
      skills: [],
      characters: [],
      factions: [],
      items: [],
    };

    await Promise.all(
      LIBRARY_FILES.map(async (file) => {
        try {
          const loaded = await fetcher(file, book);
          if (file === 'skills.json') data.skills = loaded as Skill[];
          if (file === 'characters.json') data.characters = loaded as Character[];
          if (file === 'factions.json') data.factions = loaded as Faction[];
          if (file === 'items.json') data.items = loaded as Item[];
        } catch (error) {
          warnings.push({
            bookPath: book.path,
            bookName: book.name,
            file,
            message: error instanceof Error ? error.message : '加载失败',
          });
        }
      }),
    );

    return data;
  });

  const factionNameMap = new Map<string, string>();
  for (const book of rawBooks) {
    for (const faction of book.factions) {
      factionNameMap.set(faction.id, faction.name);
    }
  }

  const resolvedBooks = rawBooks.map((book) => ({
    ...book,
    skills: book.skills.map((skill) => ({
      ...skill,
      faction: resolveFaction(skill.faction, factionNameMap),
    })),
    characters: book.characters.map((character) => ({
      ...character,
      faction: resolveFaction(character.faction, factionNameMap),
    })),
  }));

  return { ...aggregateLibraryCollections(resolvedBooks), warnings };
}

export function useLibraryData(books: BookMeta[]): LibraryDataState {
  const [state, setState] = useState<LibraryDataState>(EMPTY_LIBRARY_STATE);

  useEffect(() => {
    if (books.length === 0) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const data = await loadLibraryData(books);
        if (!cancelled) setState({ ...data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setState({
            ...EMPTY_COLLECTIONS,
            loading: false,
            error: error instanceof Error ? error.message : '加载全库数据失败',
            warnings: [],
          });
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [books]);

  return books.length === 0 ? EMPTY_LIBRARY_STATE : state;
}
