import { LIBRARY_KIND_ROUTES } from './globalLibrary';

export type GameMaterialSourceKind =
  | 'character'
  | 'skill'
  | 'technique'
  | 'item'
  | 'faction'
  | 'location'
  | 'event';

interface NamedSource {
  id: string;
  name: string;
}

interface GameMaterialSourceCollections {
  authorName: string;
  bookName: string;
  characters: NamedSource[];
  skills: NamedSource[];
  techniques: NamedSource[];
  items: NamedSource[];
  factions: NamedSource[];
  locations: NamedSource[];
  events: NamedSource[];
}

export interface ResolvedGameMaterialSource {
  status: 'resolved';
  id: string;
  kind: GameMaterialSourceKind;
  name: string;
  href: string;
}

export interface UnresolvedGameMaterialSource {
  status: 'unresolved';
  id: string;
}

export type GameMaterialSource = ResolvedGameMaterialSource | UnresolvedGameMaterialSource;
export type GameMaterialSourceIndex = Map<string, ResolvedGameMaterialSource>;

function sourceHref(authorName: string, bookName: string, kind: GameMaterialSourceKind, id: string): string {
  const base = `/${encodeURIComponent(authorName)}/${encodeURIComponent(bookName)}`;
  const detail = encodeURIComponent(id);
  if (kind === 'technique') return `${base}/skills?view=techniques&detail=${detail}`;
  if (kind === 'event') return `${base}/chapter-summaries?view=events&detail=${detail}`;
  if (kind === 'location') return `${base}/locations?detail=${detail}`;
  return `${base}/${LIBRARY_KIND_ROUTES[kind]}?detail=${detail}`;
}

export function buildGameMaterialSourceIndex(collections: GameMaterialSourceCollections): GameMaterialSourceIndex {
  const index: GameMaterialSourceIndex = new Map();
  const groups: Array<[GameMaterialSourceKind, NamedSource[]]> = [
    ['character', collections.characters],
    ['skill', collections.skills],
    ['technique', collections.techniques],
    ['item', collections.items],
    ['faction', collections.factions],
    ['location', collections.locations],
    ['event', collections.events],
  ];

  for (const [kind, sources] of groups) {
    for (const source of sources) {
      index.set(source.id, {
        status: 'resolved',
        id: source.id,
        kind,
        name: source.name,
        href: sourceHref(collections.authorName, collections.bookName, kind, source.id),
      });
    }
  }
  return index;
}

export function resolveGameMaterialSource(sourceId: string, index: GameMaterialSourceIndex): GameMaterialSource {
  return index.get(sourceId) ?? { status: 'unresolved', id: sourceId };
}
