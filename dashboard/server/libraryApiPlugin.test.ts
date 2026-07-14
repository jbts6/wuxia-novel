import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DATA_FILE_NAMES } from '../src/types/library';
import { handleLibraryApiRequest } from './libraryApiPlugin';

const temporaryDirectories: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-api-'));
  temporaryDirectories.push(root);
  const bookDirectory = path.join(root, '古龙', '测试书');
  fs.mkdirSync(bookDirectory, { recursive: true });
  fs.writeFileSync(path.join(bookDirectory, '测试书.txt'), '正文');
  return root;
}

function writeBrowseableData(root: string): void {
  const bookDirectory = path.join(root, '古龙', '测试书');
  const values: Record<keyof typeof DATA_FILE_NAMES, unknown[]> = {
    characters: [{ id: 'c1', name: '人物' }],
    factions: [],
    locations: [],
    skills: [],
    techniques: [],
    items: [],
    dialogues: [],
    chapter_summaries: [{ chapter: 1, summary: '摘要' }],
  };

  fs.mkdirSync(path.join(bookDirectory, 'data'), { recursive: true });
  for (const [key, filename] of Object.entries(DATA_FILE_NAMES)) {
    fs.writeFileSync(path.join(bookDirectory, 'data', filename), JSON.stringify(values[key as keyof typeof values]));
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('handleLibraryApiRequest', () => {
  it('ignores non-library routes so Vite can continue handling them', () => {
    expect(handleLibraryApiRequest(createRoot(), 'GET', '/')).toBeNull();
  });

  it('returns a fresh read-only status response', () => {
    const result = handleLibraryApiRequest(createRoot(), 'GET', '/api/library/status');

    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({ summary: { total: 1 }, books: [{ path: '古龙/测试书' }] });
  });

  it('rejects write methods and unsafe book paths', () => {
    const root = createRoot();

    expect(handleLibraryApiRequest(root, 'POST', '/api/library/status')).toEqual({
      status: 405,
      body: { error: '只支持只读 GET 请求' },
    });
    expect(handleLibraryApiRequest(root, 'GET', '/api/library/book-data?path=../dashboard')).toMatchObject({ status: 422 });
  });

  it('returns optional book extras without changing the core book-data endpoint', () => {
    const root = createRoot();
    writeBrowseableData(root);

    expect(handleLibraryApiRequest(root, 'GET', '/api/library/book-extras?path=古龙%2F测试书')).toEqual({
      status: 200,
      body: {
        events: { status: 'missing', data: null },
        gameMaterials: { status: 'missing', data: null },
      },
    });
    expect(handleLibraryApiRequest(root, 'GET', '/api/library/book-extras')).toEqual({
      status: 400,
      body: { error: '缺少书籍 path 参数' },
    });
  });
});
