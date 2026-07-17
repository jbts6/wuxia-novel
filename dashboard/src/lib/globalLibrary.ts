import type {
  AnyLibraryRecord,
  LibraryBookStatus,
  LibraryEntityKind,
  LibraryLoadWarning,
  LibraryRecord,
} from '../types/library';
import type { Character, Faction, Item, NovelData, Skill, SourceRef } from '../types/novel';
import { buildLibraryKey } from '../utils/libraryKeys';
import { displayTaxonomyValue } from './displayText';

export const LIBRARY_KIND_LABELS: Record<LibraryEntityKind, string> = {
  character: '人物',
  skill: '武功',
  item: '物品',
  faction: '势力',
};

export const LIBRARY_KIND_ROUTES: Record<LibraryEntityKind, string> = {
  character: 'characters',
  skill: 'skills',
  item: 'items',
  faction: 'factions',
};

interface LibrarySearchFilters {
  keyword: string;
  author: string;
  bookPath: string;
  kind: 'all' | LibraryEntityKind;
  facet: string;
  sort: 'relevance' | 'name' | 'book' | 'type';
}

interface LoadGlobalLibraryOptions {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface GlobalLibraryLoadResult {
  records: AnyLibraryRecord[];
  warnings: LibraryLoadWarning[];
  loadedBookPaths: string[];
}

function uniqueSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.chapter}:${ref.line_start ?? ''}:${ref.line_end ?? ''}:${ref.text ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createRecord<
  T extends Character | Skill | Item | Faction,
  K extends LibraryEntityKind,
>(
  book: LibraryBookStatus,
  kind: K,
  entity: T,
  summary: string,
  facet: string,
  fields: Array<string | null | undefined | string[]>,
  refs: SourceRef[],
): LibraryRecord<T, K> {
  const flattenedFields = fields.flatMap((field) => (Array.isArray(field) ? field : [field])).filter(Boolean);
  const evidence = uniqueSourceRefs(refs);
  const searchText = [entity.name, summary, facet, ...flattenedFields, ...evidence.map((ref) => ref.text ?? '')]
    .join('\n')
    .toLocaleLowerCase('zh-CN');

  return {
    key: buildLibraryKey(kind, book.path, entity.id),
    kind,
    source: { author: book.author, bookName: book.name, bookPath: book.path },
    entity,
    name: entity.name,
    summary,
    facet,
    searchText,
    evidence,
  };
}

export function buildGlobalLibraryRecords(book: LibraryBookStatus, data: NovelData): AnyLibraryRecord[] {
  const characters = data.characters.map((entity) =>
    createRecord(
      book,
      'character',
      entity,
      entity.one_line || entity.identity || entity.bio || '暂无简介',
      displayTaxonomyValue(entity.role || entity.archetype, '未分类'),
      [entity.alias, entity.identity, entity.archetype, entity.power_rank, entity.faction, entity.personality.traits],
      [...(entity.bio_source_refs ?? []), ...(entity.source_refs ?? [])],
    ),
  );
  const skills = data.skills.map((entity) =>
    createRecord(
      book,
      'skill',
      entity,
      entity.one_line || entity.description || '暂无简介',
      displayTaxonomyValue(entity.type, '未分类'),
      [entity.faction, entity.power_rank, entity.moves, entity.holders],
      [...(entity.description_source_refs ?? []), ...(entity.source_refs ?? [])],
    ),
  );
  const items = data.items.map((entity) =>
    createRecord(
      book,
      'item',
      entity,
      entity.one_line || entity.description || '暂无简介',
      displayTaxonomyValue(entity.type, '未分类'),
      [entity.tags, entity.importance, entity.owner, entity.related_characters, entity.related_skills],
      [...(entity.description_source_refs ?? []), ...(entity.source_refs ?? [])],
    ),
  );
  const factions = data.factions.map((entity) =>
    createRecord(
      book,
      'faction',
      entity,
      entity.one_line || entity.description || '暂无简介',
      displayTaxonomyValue(entity.type, '未分类'),
      [entity.location, entity.leader, entity.members, entity.sub_organizations, entity.sub_divisions],
      [...(entity.description_source_refs ?? []), ...(entity.source_refs ?? [])],
    ),
  );
  return [...characters, ...skills, ...items, ...factions];
}

function relevanceScore(record: AnyLibraryRecord, keyword: string): number {
  if (!keyword) return 0;
  const name = record.name.toLocaleLowerCase('zh-CN');
  if (name === keyword) return 4;
  if (name.startsWith(keyword)) return 3;
  if (name.includes(keyword)) return 2;
  return 1;
}

export function filterGlobalLibraryRecords(records: AnyLibraryRecord[], filters: LibrarySearchFilters): AnyLibraryRecord[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase('zh-CN');
  const filtered = records.filter((record) => {
    return (
      (!keyword || record.searchText.includes(keyword)) &&
      (filters.author === 'all' || record.source.author === filters.author) &&
      (filters.bookPath === 'all' || record.source.bookPath === filters.bookPath) &&
      (filters.kind === 'all' || record.kind === filters.kind) &&
      (filters.facet === 'all' || `${record.kind}:${record.facet}` === filters.facet)
    );
  });

  return filtered.sort((left, right) => {
    if (filters.sort === 'relevance' && keyword) {
      const score = relevanceScore(right, keyword) - relevanceScore(left, keyword);
      if (score !== 0) return score;
    }
    if (filters.sort === 'book') {
      const source = `${left.source.author}/${left.source.bookName}`.localeCompare(
        `${right.source.author}/${right.source.bookName}`,
        'zh-CN',
      );
      if (source !== 0) return source;
    }
    if (filters.sort === 'type') {
      const type = LIBRARY_KIND_LABELS[left.kind].localeCompare(LIBRARY_KIND_LABELS[right.kind], 'zh-CN');
      if (type !== 0) return type;
    }
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

export async function loadGlobalLibraryRecords(
  books: LibraryBookStatus[],
  loadBook: (bookPath: string) => Promise<NovelData>,
  options: LoadGlobalLibraryOptions = {},
): Promise<GlobalLibraryLoadResult> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, books.length || 1));
  const recordsByBook = new Map<string, AnyLibraryRecord[]>();
  const warnings: LibraryLoadWarning[] = [];
  const loadedBookPaths: string[] = [];
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < books.length) {
      const book = books[cursor];
      cursor += 1;
      try {
        const data = await loadBook(book.path);
        recordsByBook.set(book.path, buildGlobalLibraryRecords(book, data));
        loadedBookPaths.push(book.path);
      } catch (error) {
        warnings.push({
          bookPath: book.path,
          bookName: book.name,
          file: '/api/library/book-data',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        completed += 1;
        options.onProgress?.(completed, books.length);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    records: books.flatMap((book) => recordsByBook.get(book.path) ?? []),
    warnings,
    loadedBookPaths,
  };
}
