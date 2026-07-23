import { describe, expect, it } from 'vitest';
import type { LibraryBookStatus } from '../types/library';
import { contentCoverageText, validationStatusText } from './libraryStatusPresentation';

function makeBook(overrides: Partial<LibraryBookStatus> = {}): LibraryBookStatus {
  return {
    path: 'a/b',
    author: 'a',
    name: 'b',
    generationStage: 'data-produced',
    validationStatus: 'passed',
    validationContract: 'none',
    validationWarnings: [],
    validationRunId: null,
    browseable: true,
    completed: true,
    schemaVersion: null,
    lastUpdatedAt: null,
    scanProgress: {
      'named-inventory': { completed: 0, total: 0 },
      'event-dialogue': { completed: 0, total: 0 },
      'gap-audit': { completed: 0, total: 0 },
    },
    artifacts: {
      sourceText: true, chapterSplit: false, sourceIndex: false,
      scanManifest: false, candidates: false, decisions: false, qualityReport: false,
      v7InstallReceipt: false, v7VerificationReport: false, v7ReviewReport: false,
    },
    dataCompleteness: { present: 0, valid: 0, required: 4 },
    contentCoverage: {
      state: 'complete', total: 10, detailed: 10, indexOnly: 0,
      byEntity: {
        characters: { total: 5, detailed: 5, indexOnly: 0 },
        factions: { total: 2, detailed: 2, indexOnly: 0 },
        skills: { total: 2, detailed: 2, indexOnly: 0 },
        items: { total: 1, detailed: 1, indexOnly: 0 },
      },
    },
    entityCounts: { characters: null, factions: null, skills: null, items: null },
    review: { status: 'missing', warningCount: 0, reportPath: null },
    missingArtifacts: [],
    errors: [],
    gateFailures: [],
    suggestedAction: null,
    ...overrides,
  };
}

describe('validationStatusText', () => {
  it('v7 passed shows v7 安装验证通过', () => {
    const book = makeBook({ validationContract: 'generate-game-kb-v7', validationStatus: 'passed' });
    expect(validationStatusText(book)).toBe('v7 安装验证通过');
  });

  it('legacy passed shows G1-G5 通过', () => {
    const book = makeBook({ validationContract: 'generate-kb-gates', validationStatus: 'passed' });
    expect(validationStatusText(book)).toBe('G1-G5 通过');
  });

  it('non-v7 generate-game-kb shows its unsupported installed contract version', () => {
    const book = makeBook({
      validationContract: 'generate-game-kb-legacy',
      validationStatus: 'legacy-unproven',
      schemaVersion: '6',
    });
    expect(validationStatusText(book)).toBe('v6 安装合同待迁移');
  });

  it('failed shows 校验失败 regardless of contract', () => {
    const v7 = makeBook({ validationContract: 'generate-game-kb-v7', validationStatus: 'failed' });
    const legacy = makeBook({ validationContract: 'generate-kb-gates', validationStatus: 'failed' });
    expect(validationStatusText(v7)).toBe('校验失败');
    expect(validationStatusText(legacy)).toBe('校验失败');
  });

  it('not-validated shows 未校验', () => {
    const book = makeBook({ validationStatus: 'not-validated' });
    expect(validationStatusText(book)).toBe('未校验');
  });

  it('legacy-unproven shows 待新版验证', () => {
    const book = makeBook({ validationStatus: 'legacy-unproven' });
    expect(validationStatusText(book)).toBe('待新版验证');
  });
});

describe('contentCoverageText', () => {
  it('partial shows 详情覆盖 with counts', () => {
    const book = makeBook({
      contentCoverage: {
        state: 'partial', total: 10, detailed: 3, indexOnly: 0,
        byEntity: {
          characters: { total: 5, detailed: 2, indexOnly: 0 },
          factions: { total: 2, detailed: 0, indexOnly: 0 },
          skills: { total: 2, detailed: 1, indexOnly: 0 },
          items: { total: 1, detailed: 0, indexOnly: 0 },
        },
      },
    });
    expect(contentCoverageText(book.contentCoverage)).toBe('详情覆盖 3/10');
  });

  it('complete shows 详情覆盖 with full counts', () => {
    const book = makeBook();
    expect(contentCoverageText(book.contentCoverage)).toBe('详情覆盖 10/10');
  });

  it('index-only shows 详情覆盖 0/N', () => {
    const book = makeBook({
      contentCoverage: {
        state: 'index-only', total: 10, detailed: 0, indexOnly: 10,
        byEntity: {
          characters: { total: 5, detailed: 0, indexOnly: 5 },
          factions: { total: 2, detailed: 0, indexOnly: 2 },
          skills: { total: 2, detailed: 0, indexOnly: 2 },
          items: { total: 1, detailed: 0, indexOnly: 1 },
        },
      },
    });
    expect(contentCoverageText(book.contentCoverage)).toBe('详情覆盖 0/10');
  });
});
