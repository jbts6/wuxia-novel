import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DATA_FILE_NAMES, SCAN_PASS_NAMES } from '../src/types/library';
import { readBookData, scanLibrary } from './libraryScanner';

const temporaryDirectories: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-dashboard-'));
  temporaryDirectories.push(root);
  return root;
}

function writeJson(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value));
}

function createBook(root: string, relativePath = '金庸/测试书'): string {
  const directory = path.join(root, relativePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '测试书.txt'), '第一章\n正文');
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

function writeCompleteData(directory: string): void {
  const values: Record<keyof typeof DATA_FILE_NAMES, unknown[]> = {
    characters: [{ id: 'c1', name: '人物', role: '核心', one_line: '人物简介' }],
    factions: [{ id: 'f1', name: '势力', type: '门派', one_line: '势力简介' }],
    locations: [{ id: 'l1', name: '地点', region: '中原', one_line: '地点简介' }],
    skills: [{ id: 's1', name: '武功', type: '掌法', one_line: '武功简介' }],
    techniques: [],
    items: [{ id: 'i1', name: '物品', type: '兵器', one_line: '物品简介' }],
    dialogues: [{ id: 'd1', name: '人物：对白', source_refs: [{ text: '原文对白' }] }],
    chapter_summaries: [{ chapter: 1, summary: '章节摘要' }],
  };

  for (const [key, filename] of Object.entries(DATA_FILE_NAMES)) {
    writeJson(path.join(directory, 'data', filename), values[key as keyof typeof values]);
  }
}

function writeIndexOnlyData(directory: string): void {
  writeCompleteData(directory);
  const records = {
    characters: [{ id: 'c1', name: '人物', source_refs: [{ chapter: 1, text: '人物原文' }] }],
    factions: [{ id: 'f1', name: '势力', source_refs: [{ chapter: 1, text: '势力原文' }] }],
    locations: [{ id: 'l1', name: '地点', source_refs: [{ chapter: 1, text: '地点原文' }] }],
    skills: [{ id: 's1', name: '武功', source_refs: [{ chapter: 1, text: '武功原文' }] }],
    techniques: [],
    items: [{ id: 'i1', name: '物品', source_refs: [{ chapter: 1, text: '物品原文' }] }],
  };

  for (const [key, value] of Object.entries(records)) {
    writeJson(path.join(directory, 'data', DATA_FILE_NAMES[key as keyof typeof records]), value);
  }
}

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

  it('allows complete legacy data to be browsed without counting it as completed', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'reports', 'quality_report.json'), { overall_score: 92 });

    const result = scanLibrary(root);
    const [book] = result.books;

    expect(book).toMatchObject({
      generationStage: 'data-produced',
      validationStatus: 'legacy-unproven',
      browseable: true,
      completed: false,
      entityCounts: {
        characters: 1,
        factions: 1,
        locations: 1,
        skills: 1,
        techniques: 0,
        items: 1,
        dialogues: 1,
      },
    });
    expect(result.summary.browseable).toBe(1);
    expect(book?.contentCoverage).toMatchObject({ state: 'complete', detailed: 5, total: 5 });
    expect(result.summary.completed).toBe(0);
  });

  it('accepts legacy dialogues without ids when their display fields are complete', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    writeJson(path.join(directory, 'data', 'dialogues.json'), [
      { speaker: '袁承志', chapter: 1, line_start: 12, line_end: 12, text: '旧版对话正文' },
    ]);

    const [book] = scanLibrary(root).books;

    expect(book).toMatchObject({ browseable: true, dataCompleteness: { valid: 8, required: 8 } });
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
      contentCoverage: { state: 'index-only', detailed: 0, total: 5, indexOnly: 5 },
    });
    expect(book?.suggestedAction).toMatchObject({ label: '补全实体内容', command: null });
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

  it('isolates malformed book data and rejects unsafe book paths', () => {
    const root = createRoot();
    const directory = createBook(root);
    writeCompleteData(directory);
    fs.writeFileSync(path.join(directory, 'data', 'characters.json'), '{invalid');

    const [book] = scanLibrary(root).books;

    expect(book?.browseable).toBe(false);
    expect(book?.entityCounts.characters).toBeNull();
    expect(book?.errors.join(' ')).toContain('characters.json');
    expect(() => readBookData(root, '../dashboard')).toThrow('路径不合法');
  });
});
