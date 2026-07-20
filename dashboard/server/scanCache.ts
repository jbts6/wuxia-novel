import fs from 'node:fs';
import path from 'node:path';
import type { LibraryBookStatus } from '../src/types/library';

interface BookScanCache {
  status: LibraryBookStatus;
  mtimes: Map<string, number>;
  lastScan: number;
}

// Key by full directory path to avoid collisions between test roots
const cache = new Map<string, BookScanCache>();

const CACHE_TTL_MS = 15_000; // 15 seconds TTL for mtime checks

function getMaxMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function getDirectoryMtime(directory: string): number {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    let max = 0;
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(directory, entry.name);
        max = Math.max(max, getMaxMtime(fullPath));
      }
    }
    return max;
  } catch {
    return 0;
  }
}

function collectMtimes(bookDirectory: string): Map<string, number> {
  const mtimes = new Map<string, number>();

  // data/*.yaml
  const dataDir = path.join(bookDirectory, 'data');
  try {
    for (const file of fs.readdirSync(dataDir)) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        mtimes.set(`data/${file}`, getMaxMtime(path.join(dataDir, file)));
      }
    }
  } catch {
    // data directory may not exist
  }

  // reports/quality_report.json
  mtimes.set('reports/quality_report.json', getMaxMtime(path.join(bookDirectory, 'reports', 'quality_report.json')));

  // build/ files
  const buildDir = path.join(bookDirectory, 'build');
  for (const file of ['scan-manifest.json', 'source-index.json', 'candidates.jsonl', 'decisions.jsonl']) {
    mtimes.set(`build/${file}`, getMaxMtime(path.join(buildDir, file)));
  }

  // ch_split/ directory mtime
  mtimes.set('ch_split', getDirectoryMtime(path.join(bookDirectory, 'ch_split')));

  return mtimes;
}

function mtimesChanged(cached: BookScanCache, current: Map<string, number>): boolean {
  if (cached.mtimes.size !== current.size) return true;
  for (const [key, value] of current) {
    if (cached.mtimes.get(key) !== value) return true;
  }
  return false;
}

export function getCachedStatus(bookDirectory: string): LibraryBookStatus | null {
  const cacheKey = bookDirectory;
  const cached = cache.get(cacheKey);
  if (!cached) return null;

  // TTL check: skip mtime check if recent
  if (Date.now() - cached.lastScan < CACHE_TTL_MS) {
    return cached.status;
  }

  const currentMtimes = collectMtimes(bookDirectory);
  if (mtimesChanged(cached, currentMtimes)) {
    cache.delete(cacheKey);
    return null;
  }

  return cached.status;
}

export function setCachedStatus(bookDirectory: string, status: LibraryBookStatus): void {
  const cacheKey = bookDirectory;
  cache.set(cacheKey, {
    status,
    mtimes: collectMtimes(bookDirectory),
    lastScan: Date.now(),
  });
}

export function invalidateCache(bookPath: string, bookDirectory?: string): void {
  const cacheKey = bookDirectory ?? bookPath;
  cache.delete(cacheKey);
}

export function clearCache(): void {
  cache.clear();
}
