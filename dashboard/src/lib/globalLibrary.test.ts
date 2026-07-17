import { describe, expect, it } from 'vitest';
import type { LibraryBookStatus } from '../types/library';
import type { NovelData } from '../types/novel';
import { buildGlobalLibraryRecords, filterGlobalLibraryRecords, loadGlobalLibraryRecords } from './globalLibrary';

function createBook(name: string, author = '金庸'): LibraryBookStatus {
  return {
    path: `${author}/${name}`,
    author,
    name,
    generationStage: 'data-produced',
    validationStatus: 'passed',
    browseable: true,
    completed: true,
    schemaVersion: '2.0',
    lastUpdatedAt: null,
    scanProgress: {
      'named-inventory': { completed: 1, total: 1 },
      'event-dialogue': { completed: 1, total: 1 },
      'gap-audit': { completed: 1, total: 1 },
    },
    artifacts: {
      sourceText: true,
      chapterSplit: true,
      sourceIndex: true,
      scanManifest: true,
      candidates: true,
      decisions: true,
      qualityReport: true,
    },
    dataCompleteness: { present: 8, valid: 8, required: 8 },
    contentCoverage: {
      state: 'complete',
      total: 4,
      detailed: 4,
      indexOnly: 0,
      byEntity: {
        characters: { total: 1, detailed: 1, indexOnly: 0 },
        factions: { total: 1, detailed: 1, indexOnly: 0 },
        skills: { total: 1, detailed: 1, indexOnly: 0 },
        items: { total: 1, detailed: 1, indexOnly: 0 },
      },
    },
    entityCounts: { characters: 1, factions: 1, skills: 1, items: 1 },
    missingArtifacts: [],
    errors: [],
    gateFailures: [],
    suggestedAction: null,
  };
}

function createData(seed: string): NovelData {
  return {
    characters: [{
      id: `${seed}-character`,
      name: `${seed}人物`,
      alias: ['大侠'],
      role: '核心',
      identity: '江湖侠客',
      personality: { traits: ['沉稳'], speech_style: '' },
      relationships: [],
      source_refs: [{ chapter: 1, line_start: 10, text: '他在风雪中缓缓拔剑。' }],
    }],
    skills: [{ id: `${seed}-skill`, name: `${seed}剑法`, type: '剑法', description: '凌厉剑招', source_refs: [] }],
    items: [{ id: `${seed}-item`, name: `${seed}宝剑`, type: '兵器', description: '随身佩剑', source_refs: [] }],
    factions: [{ id: `${seed}-faction`, name: `${seed}门`, type: '门派', description: '江湖势力', source_refs: [] }],
    locations: [{ id: `${seed}-location`, name: `${seed}山`, region: '中原', description: '群山深处', source_refs: [] }],
    dialogues: [],
    techniques: [],
    chapter_summaries: [],
  };
}

describe('global library index', () => {
  it('builds four entity kinds with searchable source evidence', () => {
    const records = buildGlobalLibraryRecords(createBook('测试书'), createData('青锋'));

    expect(records.map((record) => record.kind)).toEqual(['character', 'skill', 'item', 'faction']);
    expect(records[0].source.bookPath).toBe('金庸/测试书');
    expect(records[0].evidence[0].text).toContain('风雪');

    const evidenceMatches = filterGlobalLibraryRecords(records, {
      keyword: '风雪',
      author: 'all',
      bookPath: 'all',
      kind: 'all',
      facet: 'all',
      sort: 'relevance',
    });
    expect(evidenceMatches).toHaveLength(1);
    expect(evidenceMatches[0].name).toBe('青锋人物');
  });

  it('loads books with bounded concurrency and isolates one book failure', async () => {
    const books = Array.from({ length: 6 }, (_, index) => createBook(`书${index + 1}`));
    let active = 0;
    let maxActive = 0;

    const result = await loadGlobalLibraryRecords(
      books,
      async (bookPath) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        if (bookPath.endsWith('书3')) throw new Error('损坏的 JSON');
        return createData(bookPath.split('/')[1]);
      },
      { concurrency: 2 },
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(result.loadedBookPaths).toHaveLength(5);
    expect(result.records).toHaveLength(20);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        bookName: '书3',
        file: '/api/library/book-data',
        message: '损坏的 JSON',
      }),
    ]);
  });
});
