import { describe, expect, it, beforeEach } from 'vitest';
import path from 'node:path';
import { getCachedStatus, setCachedStatus, invalidateCache, clearCache } from './scanCache';
import type { LibraryBookStatus } from '../src/types/library';

function makeStatus(overrides: Partial<LibraryBookStatus> = {}): LibraryBookStatus {
  return {
    path: 'author/book',
    author: 'author',
    name: 'book',
    generationStage: 'not-started',
    validationStatus: 'not-validated',
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
    },
    dataCompleteness: { present: 0, valid: 0, required: 4 },
    contentCoverage: { state: 'empty', total: 0, detailed: 0, indexOnly: 0, byEntity: { characters: { total: 0, detailed: 0, indexOnly: 0 }, factions: { total: 0, detailed: 0, indexOnly: 0 }, skills: { total: 0, detailed: 0, indexOnly: 0 }, items: { total: 0, detailed: 0, indexOnly: 0 } } },
    entityCounts: { characters: null, factions: null, skills: null, items: null },
    missingArtifacts: [],
    errors: [],
    gateFailures: [],
    suggestedAction: null,
    ...overrides,
  };
}

describe('scanCache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns null for cache miss', () => {
    const result = getCachedStatus('/tmp/nonexistent');
    expect(result).toBeNull();
  });

  it('returns cached status on cache hit', () => {
    const status = makeStatus({ path: 'test/book' });
    const testDir = path.join(process.cwd(), 'dashboard');
    setCachedStatus(testDir, status);

    const result = getCachedStatus(testDir);
    expect(result).toEqual(status);
  });

  it('invalidates cache for specific directory', () => {
    const status = makeStatus({ path: 'test/book' });
    const testDir = path.join(process.cwd(), 'dashboard');
    setCachedStatus(testDir, status);

    invalidateCache('test/book', testDir);
    const result = getCachedStatus(testDir);
    expect(result).toBeNull();
  });

  it('clears all cache', () => {
    const status1 = makeStatus({ path: 'test/book1' });
    const status2 = makeStatus({ path: 'test/book2' });
    const testDir1 = path.join(process.cwd(), 'dashboard', 'src');
    const testDir2 = path.join(process.cwd(), 'dashboard', 'server');
    setCachedStatus(testDir1, status1);
    setCachedStatus(testDir2, status2);

    clearCache();
    expect(getCachedStatus(testDir1)).toBeNull();
    expect(getCachedStatus(testDir2)).toBeNull();
  });
});
