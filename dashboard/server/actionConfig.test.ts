import { describe, expect, it } from 'vitest';
import { buildSuggestedAction, findAction } from './actionConfig';
import type { LibraryBookStatus } from '../src/types/library';

function makeStatus(overrides: Partial<LibraryBookStatus> = {}): LibraryBookStatus {
  return {
    path: 'author/book',
    author: 'author',
    name: 'book',
    generationStage: 'not-started',
    validationStatus: 'not-validated',

    validationContract: 'none',
    validationWarnings: [],
    validationRunId: null,
    browseable: false,
    completed: false,
    schemaVersion: null,
    lastUpdatedAt: null,
    scanProgress: {
      'named-inventory': { completed: 0, total: 0 },
      'event-dialogue': { completed: 0, total: 0 },
      'gap-audit': { completed: 0, total: 0 },
    },
    artifacts: {
      sourceText: true,
      chapterSplit: false,
      sourceIndex: false,
      scanManifest: false,
      candidates: false,
      decisions: false,
      qualityReport: false,

    v7InstallReceipt: false,
    v7VerificationReport: false,
    v7ReviewReport: false,
    },
    dataCompleteness: { present: 0, valid: 0, required: 4 },
    contentCoverage: { state: 'empty', total: 0, detailed: 0, indexOnly: 0, byEntity: { characters: { total: 0, detailed: 0, indexOnly: 0 }, factions: { total: 0, detailed: 0, indexOnly: 0 }, skills: { total: 0, detailed: 0, indexOnly: 0 }, items: { total: 0, detailed: 0, indexOnly: 0 } } },
    entityCounts: { characters: null, factions: null, skills: null, items: null },
    review: { status: 'missing', warningCount: 0, reportPath: null },
    missingArtifacts: [],
    errors: [],
    gateFailures: [],
    suggestedAction: null,
    ...overrides,
  };
}

describe('findAction', () => {
  it('returns split-chapters for not-started', () => {
    const status = makeStatus({ generationStage: 'not-started' });
    const action = findAction(status);
    expect(action?.type).toBe('split-chapters');
  });

  it('returns prepare-source for prepared without scanManifest', () => {
    const status = makeStatus({
      generationStage: 'prepared',
      artifacts: { sourceText: true, chapterSplit: true, sourceIndex: false, scanManifest: false, candidates: false, decisions: false, qualityReport: false, v7InstallReceipt: false, v7VerificationReport: false, v7ReviewReport: false },
    });
    const action = findAction(status);
    expect(action?.type).toBe('prepare-source');
  });

  it('returns validate-inventory for scanning', () => {
    const status = makeStatus({ generationStage: 'scanning' });
    const action = findAction(status);
    expect(action?.type).toBe('validate-inventory');
  });

  it('returns audit-recall for pending-gap', () => {
    const status = makeStatus({ generationStage: 'pending-gap' });
    const action = findAction(status);
    expect(action?.type).toBe('audit-recall');
  });

  it('returns audit-recall-legacy for legacy-unproven', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'legacy-unproven',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      contentCoverage: { state: 'complete', total: 10, detailed: 10, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 5, indexOnly: 0 }, factions: { total: 2, detailed: 2, indexOnly: 0 }, skills: { total: 2, detailed: 2, indexOnly: 0 }, items: { total: 1, detailed: 1, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action?.type).toBe('audit-recall-legacy');
  });

  it('returns assess-quality for non-passed validation', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'failed',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      contentCoverage: { state: 'complete', total: 10, detailed: 10, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 5, indexOnly: 0 }, factions: { total: 2, detailed: 2, indexOnly: 0 }, skills: { total: 2, detailed: 2, indexOnly: 0 }, items: { total: 1, detailed: 1, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action?.type).toBe('assess-quality');
  });

  it('returns fill-content for index-only coverage', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'passed',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      contentCoverage: { state: 'index-only', total: 10, detailed: 0, indexOnly: 10, byEntity: { characters: { total: 5, detailed: 0, indexOnly: 5 }, factions: { total: 2, detailed: 0, indexOnly: 2 }, skills: { total: 2, detailed: 0, indexOnly: 2 }, items: { total: 1, detailed: 0, indexOnly: 1 } } },
    });
    const action = findAction(status);
    expect(action?.type).toBe('fill-content');
  });

  it('returns null for completed books', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'passed',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      completed: true,
      contentCoverage: { state: 'complete', total: 10, detailed: 10, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 5, indexOnly: 0 }, factions: { total: 2, detailed: 2, indexOnly: 0 }, skills: { total: 2, detailed: 2, indexOnly: 0 }, items: { total: 1, detailed: 1, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action).toBeNull();
  });

  it('returns game-kb-status for v7 failed', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-game-kb-v7',
      validationStatus: 'failed',
      validationRunId: 'run-v7-test',
      browseable: true,
      contentCoverage: { state: 'partial', total: 10, detailed: 3, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 2, indexOnly: 0 }, factions: { total: 2, detailed: 0, indexOnly: 0 }, skills: { total: 2, detailed: 1, indexOnly: 0 }, items: { total: 1, detailed: 0, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action?.type).toBe('game-kb-status');
  });

  it('returns null for v7 passed with partial coverage (no fill-content)', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-game-kb-v7',
      validationStatus: 'passed',
      browseable: true,
      contentCoverage: { state: 'partial', total: 10, detailed: 3, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 2, indexOnly: 0 }, factions: { total: 2, detailed: 0, indexOnly: 0 }, skills: { total: 2, detailed: 1, indexOnly: 0 }, items: { total: 1, detailed: 0, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action).toBeNull();
  });

  it('legacy failed still returns assess-quality', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-kb-gates',
      validationStatus: 'failed',
      browseable: true,
      contentCoverage: { state: 'complete', total: 10, detailed: 10, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 5, indexOnly: 0 }, factions: { total: 2, detailed: 2, indexOnly: 0 }, skills: { total: 2, detailed: 2, indexOnly: 0 }, items: { total: 1, detailed: 1, indexOnly: 0 } } },
    });
    const action = findAction(status);
    expect(action?.type).toBe('assess-quality');
  });
});

describe('buildSuggestedAction', () => {
  it('builds command for split-chapters', () => {
    const status = makeStatus({ generationStage: 'not-started' });
    const action = buildSuggestedAction('金庸/射雕英雄传', status);
    expect(action).toEqual({
      label: '切分章节',
      reason: '尚未发现有效的 ch_split 产物。',
      command: expect.stringContaining('split-chapters.js'),
      type: 'split-chapters',
    });
    expect(action?.command).toContain('金庸/射雕英雄传');
  });

  it('returns null for fill-content (no script)', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'passed',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      contentCoverage: { state: 'index-only', total: 10, detailed: 0, indexOnly: 10, byEntity: { characters: { total: 5, detailed: 0, indexOnly: 5 }, factions: { total: 2, detailed: 0, indexOnly: 2 }, skills: { total: 2, detailed: 0, indexOnly: 2 }, items: { total: 1, detailed: 0, indexOnly: 1 } } },
    });
    const action = buildSuggestedAction('金庸/射雕英雄传', status);
    expect(action).toBeNull();
  });

  it('includes extra args for audit-recall-legacy', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationStatus: 'legacy-unproven',

    validationContract: 'none',
    validationWarnings: [],
      browseable: true,
      contentCoverage: { state: 'complete', total: 10, detailed: 10, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 5, indexOnly: 0 }, factions: { total: 2, detailed: 2, indexOnly: 0 }, skills: { total: 2, detailed: 2, indexOnly: 0 }, items: { total: 1, detailed: 1, indexOnly: 0 } } },
    });
    const action = buildSuggestedAction('金庸/射雕英雄传', status);
    expect(action?.command).toContain('--legacy');
  });

  it('builds v7 game-kb-status command with flow.js status prefix', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-game-kb-v7',
      validationStatus: 'failed',
      validationRunId: 'run-v7-test',
      browseable: true,
      contentCoverage: { state: 'partial', total: 10, detailed: 3, indexOnly: 0, byEntity: { characters: { total: 5, detailed: 2, indexOnly: 0 }, factions: { total: 2, detailed: 0, indexOnly: 0 }, skills: { total: 2, detailed: 1, indexOnly: 0 }, items: { total: 1, detailed: 0, indexOnly: 0 } } },
    });
    const action = buildSuggestedAction('金庸/射雕英雄传', status);
    expect(action?.type).toBe('game-kb-status');
    expect(action?.command).toContain('flow.js');
    expect(action?.command).toContain('status');
    expect(action?.command).toContain('generate-game-kb/scripts');
    expect(action?.command).toContain("'--run' 'run-v7-test'");
  });

  it('does not route a non-v7 generate-game-kb install through legacy G1-G5 actions', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-game-kb-legacy',
      validationStatus: 'legacy-unproven',
      schemaVersion: '6',
      browseable: true,
    });

    expect(findAction(status)).toBeNull();
  });

  it('does not suggest an ambiguous v7 status command without an installed run id', () => {
    const status = makeStatus({
      generationStage: 'data-produced',
      validationContract: 'generate-game-kb-v7',
      validationStatus: 'failed',
      validationRunId: null,
      browseable: true,
    });

    expect(findAction(status)).toBeNull();
    expect(buildSuggestedAction('古龙/测试书', status)).toBeNull();
  });
});
