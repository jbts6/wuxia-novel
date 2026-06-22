import type { Character, Dialogue, Faction, Item, Location, Skill, Technique } from '../types/novel';

export interface BookMeta {
  path: string;
  author: string;
  name: string;
  characters: number;
  skills: number;
  factions: number;
}

export interface NovelData {
  characters: Character[];
  skills: Skill[];
  techniques: Technique[];
  items: Item[];
  locations: Location[];
  factions: Faction[];
  dialogues: Dialogue[];
}

export const NOVEL_DATA_FILES = [
  'characters.json',
  'skills.json',
  'techniques.json',
  'items.json',
  'locations.json',
  'factions.json',
  'dialogues.json',
] as const;

export type NovelDataFile = (typeof NOVEL_DATA_FILES)[number];

type EntityByFile = {
  'characters.json': Character[];
  'skills.json': Skill[];
  'techniques.json': Technique[];
  'items.json': Item[];
  'locations.json': Location[];
  'factions.json': Faction[];
  'dialogues.json': Dialogue[];
};

type StaticWindow = Window & {
  __BOOK_META__?: BookMeta;
  __NOVEL_DATA__?: Partial<NovelData>;
};

export type NovelDataFileFetcher = <TFile extends NovelDataFile>(
  file: TFile,
  bookPath: string,
) => Promise<EntityByFile[TFile]>;

export function emptyNovelData(): NovelData {
  return {
    characters: [],
    skills: [],
    techniques: [],
    items: [],
    locations: [],
    factions: [],
    dialogues: [],
  };
}

export function normalizeNovelData(data: Partial<NovelData> | undefined): NovelData {
  return {
    ...emptyNovelData(),
    ...data,
  };
}

export function buildNovelFileUrl(file: NovelDataFile, bookPath: string): string {
  return `/api/novel/${file}?book=${encodeURIComponent(bookPath)}`;
}

export async function defaultNovelDataFileFetcher<TFile extends NovelDataFile>(
  file: TFile,
  bookPath: string,
): Promise<EntityByFile[TFile]> {
  const response = await fetch(buildNovelFileUrl(file, bookPath));
  if (!response.ok) throw new Error(`Failed to load ${file}`);
  return response.json();
}

export function getStaticBookMeta(): BookMeta | undefined {
  return (window as StaticWindow).__BOOK_META__;
}

export function getStaticNovelData(): NovelData | undefined {
  const staticData = (window as StaticWindow).__NOVEL_DATA__;
  return staticData ? normalizeNovelData(staticData) : undefined;
}

export async function loadNovelData(
  bookPath: string,
  fetcher: NovelDataFileFetcher = defaultNovelDataFileFetcher,
): Promise<NovelData> {
  const [
    characters,
    skills,
    techniques,
    items,
    locations,
    factions,
    dialogues,
  ] = await Promise.all([
    fetcher('characters.json', bookPath),
    fetcher('skills.json', bookPath),
    fetcher('techniques.json', bookPath),
    fetcher('items.json', bookPath),
    fetcher('locations.json', bookPath),
    fetcher('factions.json', bookPath),
    fetcher('dialogues.json', bookPath),
  ]);

  return {
    characters,
    skills,
    techniques,
    items,
    locations,
    factions,
    dialogues,
  };
}
