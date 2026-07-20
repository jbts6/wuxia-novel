import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { handleLibraryApiRequest } from './libraryApiPlugin';

const temporaryDirectories: string[] = [];
const YAML_DATA_FILE_NAMES = {
  characters: 'characters.yaml',
  factions: 'factions.yaml',
  skills: 'skills.yaml',
  items: 'items.yaml',
  chapter_summaries: 'chapter_summaries.yaml',
} as const;

type YamlDataKey = keyof typeof YAML_DATA_FILE_NAMES;

const BROWSEABLE_DATA: Record<YamlDataKey, unknown[]> = {
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
  factions: [{ id: 'f1', name: '门派', aliases: [], type: '门派', description: '势力简介' }],
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
  chapter_summaries: [{ chapter: 1, title: '第一章', summary: '摘要' }],
};

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
  fs.mkdirSync(path.join(bookDirectory, 'data'), { recursive: true });
  for (const [key, filename] of Object.entries(YAML_DATA_FILE_NAMES)) {
    fs.writeFileSync(
      path.join(bookDirectory, 'data', filename),
      yaml.dump(BROWSEABLE_DATA[key as YamlDataKey], { lineWidth: -1, noRefs: true }),
    );
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('handleLibraryApiRequest', () => {
  it('ignores non-library routes so Vite can continue handling them', async () => {
    expect(await handleLibraryApiRequest(createRoot(), 'GET', '/')).toBeNull();
  });

  it('returns a fresh read-only status response', async () => {
    const result = await handleLibraryApiRequest(createRoot(), 'GET', '/api/library/status');

    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({ summary: { total: 1 }, books: [{ path: '古龙/测试书' }] });
  });

  it('rejects write methods for GET-only endpoints', async () => {
    const root = createRoot();

    expect(await handleLibraryApiRequest(root, 'POST', '/api/library/status')).toEqual({
      status: 404,
      body: { error: '接口不存在' },
    });
    expect(await handleLibraryApiRequest(root, 'GET', '/api/library/book-data?path=../dashboard')).toMatchObject({ status: 422 });
  });

  it('returns exactly the five parsed YAML arrays from book-data', async () => {
    const root = createRoot();
    writeBrowseableData(root);

    expect(await handleLibraryApiRequest(root, 'GET', '/api/library/book-data?path=古龙%2F测试书')).toEqual({
      status: 200,
      body: BROWSEABLE_DATA,
    });
  });

  it('returns optional book extras without changing the core book-data endpoint', async () => {
    const root = createRoot();
    writeBrowseableData(root);

    expect(await handleLibraryApiRequest(root, 'GET', '/api/library/book-extras?path=古龙%2F测试书')).toEqual({
      status: 200,
      body: {
        events: { status: 'missing', data: null },
        gameMaterials: { status: 'missing', data: null },
      },
    });
    expect(await handleLibraryApiRequest(root, 'GET', '/api/library/book-extras')).toEqual({
      status: 400,
      body: { error: '缺少书籍 path 参数' },
    });
  });

  describe('POST /api/library/execute-action', () => {
    function createMockRequest(body: object): IncomingMessage {
      const stream = new PassThrough();
      stream.end(JSON.stringify(body));
      return stream as unknown as IncomingMessage;
    }

    it('rejects invalid action types', async () => {
      const root = createRoot();
      const request = createMockRequest({ bookPath: '古龙/测试书', actionType: 'invalid-type' });

      const result = await handleLibraryApiRequest(root, 'POST', '/api/library/execute-action', request);

      expect(result?.status).toBe(400);
      expect(result?.body).toMatchObject({ error: expect.stringContaining('不允许的 action type') });
    });

    it('rejects missing parameters', async () => {
      const root = createRoot();
      const request = createMockRequest({ bookPath: '古龙/测试书' });

      const result = await handleLibraryApiRequest(root, 'POST', '/api/library/execute-action', request);

      expect(result?.status).toBe(400);
      expect(result?.body).toMatchObject({ error: expect.stringContaining('缺少 bookPath 或 actionType') });
    });

    it('accepts valid action type from whitelist', async () => {
      const root = createRoot();
      const request = createMockRequest({ bookPath: '古龙/测试书', actionType: 'split-chapters' });

      const result = await handleLibraryApiRequest(root, 'POST', '/api/library/execute-action', request);

      // 脚本不存在，应该返回失败
      expect(result?.status).toBe(200);
      expect(result?.body).toMatchObject({ success: false });
    });

    it('returns 404 for unknown POST routes', async () => {
      const root = createRoot();
      const request = createMockRequest({});

      const result = await handleLibraryApiRequest(root, 'POST', '/api/library/unknown', request);

      expect(result?.status).toBe(404);
    });
  });
});
