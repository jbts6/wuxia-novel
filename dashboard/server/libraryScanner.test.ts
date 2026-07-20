import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONTENT_ENTITY_KEYS,
  DATA_FILE_NAMES,
  KNOWLEDGE_ENTITY_KEYS,
  SCAN_PASS_NAMES,
} from '../src/types/library';
import { readBookData, readBookExtras, scanLibrary } from './libraryScanner';
import { clearCache } from './scanCache';

const temporaryDirectories: string[] = [];
const YAML_DATA_FILE_NAMES = {
  characters: 'characters.yaml',
  factions: 'factions.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml',
} as const;

type YamlDataKey = keyof typeof YAML_DATA_FILE_NAMES;

const COMPLETE_YAML_DATA: Record<YamlDataKey, unknown[]> = {
  characters: [{
    id: 'c1',
    name: '人物',
    aliases: [],
    identities: ['侠客'],
    level: '核心',
    rank: null,
    description: '人物简介',
    factions: ['f1'],
    skills: ['s1'],
  }],
  factions: [{ id: 'f1', name: '势力', aliases: [], type: '门派', description: '势力简介' }],
  skills: [{
    id: 's1',
    name: '武功',
    aliases: [],
    types: ['掌法'],
    factions: ['f1'],
    rank: null,
    description: '武功简介',
    techniques: [],
  }],
  items: [{ id: 'i1', name: '物品', aliases: [], type: '兵器', description: '物品简介' }],
  chapter_summaries: [{ chapter: 1, title: '第一章', summary: '章节摘要' }],
};

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-dashboard-'));
  temporaryDirectories.push(root);
  return root;
}

function writeJson(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value));
}

function writeYaml(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, yaml.dump(value, { lineWidth: -1, noRefs: true }));
}

function createBook(root: string, relativePath = '金庸/测试书'): string {
  const directory = path.join(root, relativePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${path.basename(directory)}.txt`), '第一章\n正文');
  return directory;
}

function writeManifest(directory: string, total: number, progress: Partial<Record<(typeof SCAN_PASS_NAMES)[number], number>>): void {
  writeJson(path.join(directory, 'build', 'scan-manifest.json'), {
    schema_version: '2',
    required_window_ids: Array.from({ length: total }, (_, index) => `w${index + 1}`),
    passes: Object.fromEntries(
      SCAN_PASS_NAMES.map((passName) => [
        passName,
        { completed_window_ids: Array.from({ length: progress[passName] ?? 0 }, (_, index) => `w${index + 1}`) },
      ]),
    ),
  });
}

function writeCompleteData(directory: string, overrides: Partial<Record<YamlDataKey, unknown>> = {}): void {
  for (const [key, filename] of Object.entries(YAML_DATA_FILE_NAMES)) {
    writeYaml(path.join(directory, 'data', filename), overrides[key as YamlDataKey] ?? COMPLETE_YAML_DATA[key as YamlDataKey]);
  }
}

function writeIndexOnlyData(directory: string): void {
  writeCompleteData(directory);
  const records = {
    characters: [{
      id: 'c1',
      name: '人物',
      aliases: [],
      identities: [],
      level: null,
      rank: null,
      description: null,
      factions: [],
      skills: [],
    }],
    factions: [{ id: 'f1', name: '势力', aliases: [], type: null, description: null }],
    skills: [{
      id: 's1',
      name: '武功',
      aliases: [],
      types: [],
      factions: [],
      rank: null,
      description: null,
      techniques: [],
    }],
    items: [{ id: 'i1', name: '物品', aliases: [], type: null, description: null }],
  };

  for (const [key, value] of Object.entries(records)) {
    writeYaml(path.join(directory, 'data', YAML_DATA_FILE_NAMES[key as keyof typeof records]), value);
  }
}

beforeEach(() => {
  clearCache();
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('scanLibrary', () => {
  it('discovers source books that have no generated artifacts', () => {
    const root = createRoot();
    createBook(root);

    const result = scanLibrary(root);

    expect(result.summary.total).toBe(1);
    expect(result.summary.notStarted).toBe(1);
    expect(result.books[0]).toMatchObject({ generationStage: 'not-started', browseable: false, completed: false });
    expect(result.books[0]?.suggestedAction?.command).toContain('split-chapters.js');
  });

  it('uses manifest window counts without inventing an aggregate percentage', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeManifest(directory, 4, { 'named-inventory': 4, 'event-dialogue': 2, 'gap-audit': 0 });

    const [book] = scanLibrary(root).books;

    expect(book?.generationStage).toBe('scanning');
    expect(book?.scanProgress['named-inventory']).toEqual({ completed: 4, total: 4 });
    expect(book?.scanProgress['event-dialogue']).toEqual({ completed: 2, total: 4 });
  });

  it('separates pending gap audit from the initial scan', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeManifest(directory, 3, { 'named-inventory': 3, 'event-dialogue': 3, 'gap-audit': 0 });

    const [book] = scanLibrary(root).books;

    expect(book?.generationStage).toBe('pending-gap');
    expect(book?.suggestedAction?.command).toContain('audit-recall.js');
  });

  it('uses exactly five YAML files and four entity collections', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'reports', 'quality_report.json'), { overall_score: 92 });

    const result = scanLibrary(root);
    const [book] = result.books;

    expect(DATA_FILE_NAMES).toEqual(YAML_DATA_FILE_NAMES);
    expect(KNOWLEDGE_ENTITY_KEYS).toEqual(['characters', 'factions', 'skills', 'items']);
    expect(CONTENT_ENTITY_KEYS).toEqual(['characters', 'factions', 'skills', 'items']);
    expect(book).toMatchObject({
      generationStage: 'data-produced',
      validationStatus: 'legacy-unproven',
      browseable: true,
      completed: false,
      dataCompleteness: { present: 5, valid: 5, required: 5 },
    });
    expect(book?.entityCounts).toEqual({ characters: 1, factions: 1, skills: 1, items: 1 });
    expect(result.summary.browseable).toBe(1);
    expect(book?.contentCoverage).toMatchObject({ state: 'complete', detailed: 4, total: 4 });
    expect(result.summary.completed).toBe(0);
    expect(readBookData(root, '金庸/测试书')).toEqual(COMPLETE_YAML_DATA);
  });

  it('keeps optional extras outside the five-file browseability gate', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({ browseable: true, dataCompleteness: { valid: 5, required: 5 } });
    expect(readBookExtras(root, '金庸/测试书')).toEqual({
      events: { status: 'missing', data: null },
      gameMaterials: { status: 'missing', data: null },
    });
  });

  it('distinguishes valid empty extras from missing files', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'data', 'events.json'), []);
    writeJson(path.join(directory, 'reports', 'game_materials.json'), { schema_version: 1, entries: [] });

    expect(readBookExtras(root, '金庸/测试书')).toEqual({
      events: { status: 'available', data: [] },
      gameMaterials: { status: 'available', data: { schema_version: 1, entries: [] } },
    });
  });

  it('returns valid extras and isolates a malformed optional resource', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    fs.mkdirSync(path.join(directory, 'data'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'data', 'events.json'), '{invalid');
    writeJson(path.join(directory, 'reports', 'game_materials.json'), {
      schema_version: 1,
      entries: [
        {
          material_type: '战斗系统原型',
          source_id: 's1',
          relevance: '高',
          suggested_use: '武学原型',
          reason: '具有代表性',
        },
      ],
    });

    const extras = readBookExtras(root, '金庸/测试书');

    expect(extras.events).toMatchObject({ status: 'invalid', data: null });
    expect(extras.events).toHaveProperty('error');
    expect(extras.gameMaterials).toMatchObject({
      status: 'available',
      data: { schema_version: 1, entries: [{ source_id: 's1' }] },
    });
    expect(scanLibrary(root).books[0]).toMatchObject({ browseable: true, dataCompleteness: { required: 5 } });
  });

  it('requires completion_gate_passed and every G1-G5 gate for completion', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'reports', 'quality_report.json'), {
      completion_gate_passed: true,
      gates: Object.fromEntries(['G1', 'G2', 'G3', 'G4', 'G5'].map((gate) => [gate, { passed: true, reasons: [] }])),
    });

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({ validationStatus: 'passed', browseable: true, completed: true });
  });

  it('keeps index-only entity files browseable but excludes them from completed books', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeIndexOnlyData(directory);
    writeJson(path.join(directory, 'reports', 'quality_report.json'), {
      completion_gate_passed: true,
      gates: Object.fromEntries(['G1', 'G2', 'G3', 'G4', 'G5'].map((gate) => [gate, { passed: true, reasons: [] }])),
    });

    const result = scanLibrary(root);
    const [book] = result.books;

    expect(book).toMatchObject({
      browseable: true,
      completed: false,
      contentCoverage: { state: 'index-only', detailed: 0, total: 4, indexOnly: 4 },
    });
    // fill-content has no script, so suggestedAction is null
    expect(book?.suggestedAction).toBeNull();
    expect(result.summary.contentIncomplete).toBe(1);
    expect(result.summary.completed).toBe(0);
  });

  it('summarizes long gate failure lists for the workbench detail panel', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'reports', 'quality_report.json'), {
      completion_gate_passed: false,
      gates: {
        G1: { passed: true, reasons: [] },
        G2: { passed: true, reasons: [] },
        G3: { passed: false, reasons: ['问题 1', '问题 2', '问题 3', '问题 4', '问题 5'] },
        G4: { passed: true, reasons: [] },
        G5: { passed: true, reasons: [] },
      },
    });

    const [book] = scanLibrary(root).books;

    expect(book?.gateFailures).toEqual([
      'G3 未通过（5 项）',
      'G3: 问题 1',
      'G3: 问题 2',
      'G3: 问题 3',
      'G3 另有 2 项，请查看 reports/quality_report.json',
    ]);
  });

  it('reports malformed YAML even when a stale JSON file is valid', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    fs.writeFileSync(path.join(directory, 'data', YAML_DATA_FILE_NAMES.characters), 'characters: [');
    writeJson(path.join(directory, 'data', 'characters.json'), COMPLETE_YAML_DATA.characters);

    const [book] = scanLibrary(root).books;

    expect(book?.browseable).toBe(false);
    expect(book?.entityCounts.characters).toBeNull();
    expect(book?.errors.join(' ')).toContain('characters.yaml');
    expect(book?.errors.join(' ')).not.toContain('characters.json');
  });

  it('rejects a YAML document whose top-level value is not an array', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory, { characters: { id: 'c1', name: '人物' } });

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({
      browseable: false,
      dataCompleteness: { present: 5, valid: 4, required: 5 },
      entityCounts: { characters: null },
    });
    expect(book?.errors.join(' ')).toContain('characters.yaml 不满足最低数据契约');
  });

  it('rejects contract-invalid records from otherwise valid YAML', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory, { skills: [{ id: 's1' }] });

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({ browseable: false, entityCounts: { skills: null } });
    expect(book?.errors.join(' ')).toContain('skills.yaml 不满足最低数据契约');
  });

  it('rejects legacy entity fields before marking a book browseable', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory, {
      characters: [{ id: 'c1', name: '旧人物', alias: ['旧别名'] }],
    });

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({ browseable: false, dataCompleteness: { valid: 4, required: 5 } });
    expect(book?.errors.join(' ')).toContain('characters.yaml 不满足 V6 数据契约');
    expect(() => readBookData(root, '金庸/测试书')).toThrow('书籍数据不满足 Dashboard 可浏览契约');
  });

  it.each([
    {
      name: 'missing',
      damage: (directory: string) => fs.rmSync(
        path.join(directory, 'data', YAML_DATA_FILE_NAMES.chapter_summaries),
      ),
    },
    {
      name: 'malformed',
      damage: (directory: string) => fs.writeFileSync(
        path.join(directory, 'data', YAML_DATA_FILE_NAMES.chapter_summaries),
        'summaries: [',
      ),
    },
    {
      name: 'non-array',
      damage: (directory: string) => writeYaml(
        path.join(directory, 'data', YAML_DATA_FILE_NAMES.chapter_summaries),
        { chapter: 1, summary: '不是数组' },
      ),
    },
    {
      name: 'contract-invalid',
      damage: (directory: string) => writeYaml(
        path.join(directory, 'data', YAML_DATA_FILE_NAMES.chapter_summaries),
        [{ chapter: 1 }],
      ),
    },
  ])('isolates a $name chapter_summaries.yaml failure without changing entity counts', ({ damage }) => {
    const root = createRoot();
    const validDirectory = createBook(root, '古龙/有效书');
    const invalidDirectory = createBook(root, '金庸/摘要损坏书');
    writeCompleteData(validDirectory);
    writeCompleteData(invalidDirectory);
    damage(invalidDirectory);

    const result = scanLibrary(root);
    const validBook = result.books.find((book) => book.path === '古龙/有效书');
    const invalidBook = result.books.find((book) => book.path === '金庸/摘要损坏书');

    expect(result.summary).toMatchObject({ total: 2, browseable: 1 });
    expect(validBook).toMatchObject({ browseable: true, dataCompleteness: { valid: 5, required: 5 } });
    expect(invalidBook).toMatchObject({
      browseable: false,
      completed: false,
      dataCompleteness: { valid: 4, required: 5 },
      entityCounts: { characters: 1, factions: 1, skills: 1, items: 1 },
    });
    expect([...(invalidBook?.missingArtifacts ?? []), ...(invalidBook?.errors ?? [])].join(' '))
      .toContain('chapter_summaries.yaml');
  });

  it('keeps one malformed book isolated from a valid book', () => {
    const root = createRoot();
    const validDirectory = createBook(root, '古龙/有效书');
    const invalidDirectory = createBook(root, '金庸/损坏书');
    writeCompleteData(validDirectory);
    writeCompleteData(invalidDirectory);
    fs.writeFileSync(path.join(invalidDirectory, 'data', YAML_DATA_FILE_NAMES.items), 'items: [');

    const result = scanLibrary(root);
    const validBook = result.books.find((book) => book.path === '古龙/有效书');
    const invalidBook = result.books.find((book) => book.path === '金庸/损坏书');

    expect(result.summary).toMatchObject({ total: 2, browseable: 1 });
    expect(validBook).toMatchObject({ browseable: true, dataCompleteness: { valid: 5, required: 5 } });
    expect(invalidBook).toMatchObject({ browseable: false, entityCounts: { items: null } });
    expect(invalidBook?.errors.join(' ')).toContain('items.yaml');
  });

  it('does not let stale JSON satisfy a missing YAML file', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    fs.rmSync(path.join(directory, 'data', YAML_DATA_FILE_NAMES.characters));
    writeJson(path.join(directory, 'data', 'characters.json'), COMPLETE_YAML_DATA.characters);

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({
      browseable: false,
      dataCompleteness: { present: 4, valid: 4, required: 5 },
      entityCounts: { characters: null },
    });
    expect(book?.missingArtifacts).toContain('data/characters.yaml');
  });

  it('does not let stale JSON replace a valid YAML payload', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'data', 'characters.json'), [
      { id: 'stale-1', name: '旧人物一' },
      { id: 'stale-2', name: '旧人物二' },
    ]);

    const [book] = scanLibrary(root).books;
    const data = readBookData(root, '金庸/测试书');

    expect(book?.entityCounts.characters).toBe(1);
    expect(data.characters).toEqual(COMPLETE_YAML_DATA.characters);
  });

  it('rejects unsafe book paths', () => {
    const root = createRoot();

    expect(() => readBookData(root, '../dashboard')).toThrow('路径不合法');
    expect(() => readBookExtras(root, '../dashboard')).toThrow('路径不合法');
  });
});
