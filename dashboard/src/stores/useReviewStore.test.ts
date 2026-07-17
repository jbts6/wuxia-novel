import yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewStore } from './useReviewStore';

interface TransportRequest {
  url: string;
  init?: RequestInit;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  useReviewStore.getState().clearData();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useReviewStore YAML review flow', () => {
  it('retains only the five canonical review files and gives chapter summaries chapter identities', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/review/list?')) {
        return jsonResponse({
          files: [
            { name: 'characters.yaml', path: '古龙/神雕侠侣/data/characters.yaml', type: 'characters' },
            { name: 'factions.yaml', path: '古龙/神雕侠侣/data/factions.yaml', type: 'factions' },
            { name: 'skills.yaml', path: '古龙/神雕侠侣/data/skills.yaml', type: 'skills' },
            { name: 'items.yaml', path: '古龙/神雕侠侣/data/items.yaml', type: 'items' },
            { name: 'chapter_summaries.yaml', path: '古龙/神雕侠侣/data/chapter_summaries.yaml', type: 'chapter_summaries' },
            { name: 'notes.yaml', path: '古龙/神雕侠侣/data/notes.yaml', type: 'notes' },
          ],
        });
      }
      return jsonResponse({
        content: yaml.dump([
          { chapter: 7, title: '第七回 重逢', summary: '杨过与小龙女重逢。' },
          { chapter: 8, summary: '二人离开古墓。' },
        ], { lineWidth: -1 }),
      });
    });

    await useReviewStore.getState().loadFiles('古龙/神雕侠侣');
    expect(useReviewStore.getState().files.map((file) => file.type)).toEqual([
      'characters',
      'factions',
      'skills',
      'items',
      'chapter_summaries',
    ]);

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'chapter_summaries');

    expect(useReviewStore.getState().entities).toEqual([
      {
        key: 'chapter_summaries:7',
        chapter: 7,
        name: '第七回 重逢',
        type: 'chapter_summaries',
        summary: '杨过与小龙女重逢。',
        marked: false,
        data: { chapter: 7, title: '第七回 重逢', summary: '杨过与小龙女重逢。' },
      },
      {
        key: 'chapter_summaries:8',
        chapter: 8,
        name: '第8章',
        type: 'chapter_summaries',
        summary: '二人离开古墓。',
        marked: false,
        data: { chapter: 8, summary: '二人离开古墓。' },
      },
    ]);
  });

  it('loads YAML entities with one direct .yaml read request', async () => {
    const requests: TransportRequest[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return jsonResponse({
        content: yaml.dump(
          [{ id: 'character-1', name: '小龙女', identity: '古墓派弟子' }],
          { lineWidth: -1 },
        ),
      });
    });

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'characters');

    expect(requests).toEqual([
      {
        url: '/api/review/read?path=%E5%8F%A4%E9%BE%99%2F%E7%A5%9E%E9%9B%95%E4%BE%A0%E4%BE%A3%2Fdata%2Fcharacters.yaml',
        init: undefined,
      },
    ]);
    expect(useReviewStore.getState()).toMatchObject({
      entities: [
        {
          id: 'character-1',
          name: '小龙女',
          type: 'characters',
          summary: '古墓派弟子',
          marked: false,
          data: { id: 'character-1', name: '小龙女', identity: '古墓派弟子' },
        },
      ],
      error: null,
      isLoading: false,
    });
  });

  it('surfaces a failed YAML read without issuing a JSON fallback request', async () => {
    const requests: TransportRequest[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return jsonResponse({ error: '文件不存在' }, 404);
    });

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'characters');

    expect(requests).toEqual([
      {
        url: '/api/review/read?path=%E5%8F%A4%E9%BE%99%2F%E7%A5%9E%E9%9B%95%E4%BE%A0%E4%BE%A3%2Fdata%2Fcharacters.yaml',
        init: undefined,
      },
    ]);
    expect(useReviewStore.getState()).toMatchObject({
      entities: [],
      error: '加载数据失败',
      isLoading: false,
    });
  });

  it('backs up and writes deletions as YAML while preserving the .yaml extension', async () => {
    const requests: TransportRequest[] = [];
    let storedYaml = yaml.dump(
      [
        { id: 'character-1', name: '小龙女', identity: '古墓派弟子' },
        { id: 'character-2', name: '杨过', one_line: '神雕大侠' },
      ],
      { lineWidth: -1 },
    );

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });

      if (url.startsWith('/api/review/read?')) {
        return jsonResponse({ content: storedYaml });
      }
      if (url.startsWith('/api/review/list?')) {
        return jsonResponse({
          files: [
            {
                name: 'characters.yaml',
                path: '古龙/神雕侠侣/data/characters.yaml',
                type: 'characters',
            },
          ],
        });
      }
      if (url === '/api/review/backup') {
        return jsonResponse({ success: true });
      }
      if (url === '/api/review/write') {
        const body = JSON.parse(String(init?.body)) as { path: string; content: string };
        storedYaml = body.content;
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: '接口不存在' }, 404);
    });

    const store = useReviewStore.getState();
    await store.loadFiles('古龙/神雕侠侣');
    await store.loadEntities('古龙/神雕侠侣', 'characters');
    useReviewStore.getState().toggleMark('characters:character-1');
    useReviewStore.getState().setFilter({ type: 'characters' });
    await useReviewStore.getState().deleteMarked();

    const backupRequest = requests.find((request) => request.url === '/api/review/backup');
    const backupBody = JSON.parse(String(backupRequest?.init?.body)) as { source: string; target: string };
    expect(backupBody.source).toBe('古龙/神雕侠侣/data/characters.yaml');
    expect(backupBody.target).toMatch(
      /^古龙\/神雕侠侣\/data\/backups\/characters\.backup\.\d{4}-\d{2}-\d{2}T.*\.yaml$/,
    );

    const writeRequest = requests.find((request) => request.url === '/api/review/write');
    const writeBody = JSON.parse(String(writeRequest?.init?.body)) as { path: string; content: string };
    expect(writeBody.path).toBe('古龙/神雕侠侣/data/characters.yaml');
    expect(writeBody.content).toContain('- id: character-2');
    expect(yaml.load(writeBody.content)).toEqual([
      { id: 'character-2', name: '杨过', one_line: '神雕大侠' },
    ]);
    expect(() => JSON.parse(writeBody.content)).toThrow();

    const readRequests = requests.filter((request) => request.url.startsWith('/api/review/read?'));
    expect(readRequests).toHaveLength(3);
    expect(readRequests.every((request) => request.url.endsWith('characters.yaml'))).toBe(true);
    expect(requests.some((request) => /\.(json|yml)(?:$|%)/.test(request.url))).toBe(false);
    expect(useReviewStore.getState()).toMatchObject({
      entities: [
        {
          id: 'character-2',
          name: '杨过',
          type: 'characters',
          summary: '神雕大侠',
          marked: false,
        },
      ],
      error: null,
      isLoading: false,
    });
  });

  it('deletes only the marked chapter summary by its chapter identity', async () => {
    let storedYaml = yaml.dump([
      { chapter: 1, title: '第一回', summary: '开场。' },
      { chapter: 2, title: '第二回', summary: '续篇。' },
    ], { lineWidth: -1 });

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/review/read?')) return jsonResponse({ content: storedYaml });
      if (url === '/api/review/backup') return jsonResponse({ success: true });
      if (url === '/api/review/write') {
        storedYaml = JSON.parse(String(init?.body)).content;
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: '接口不存在' }, 404);
    });

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'chapter_summaries');
    useReviewStore.setState((state) => ({
      bookPath: '古龙/神雕侠侣',
      filter: { ...state.filter, type: 'chapter_summaries' },
      entities: state.entities.map((entity) => ({
        ...entity,
        marked: entity.data.chapter === 1,
      })),
    }));

    await expect(useReviewStore.getState().deleteMarked()).resolves.toBe(true);
    expect(yaml.load(storedYaml)).toEqual([
      { chapter: 2, title: '第二回', summary: '续篇。' },
    ]);
  });

  it('aborts deletion before writing when the YAML backup fails', async () => {
    const requests: TransportRequest[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.startsWith('/api/review/read?')) {
        return jsonResponse({ content: '- id: character-1\n  name: 小龙女\n' });
      }
      if (url === '/api/review/backup') return jsonResponse({ error: '备份失败' }, 500);
      return jsonResponse({ success: true });
    });

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'characters');
    useReviewStore.setState((state) => ({
      bookPath: '古龙/神雕侠侣',
      filter: { ...state.filter, type: 'characters' },
      entities: state.entities.map((entity) => ({ ...entity, marked: true })),
    }));
    const deletionStart = requests.length;

    await expect(useReviewStore.getState().deleteMarked()).resolves.toBe(false);

    expect(requests.slice(deletionStart).map((request) => request.url)).toEqual([
      expect.stringContaining('/api/review/read?'),
      '/api/review/backup',
    ]);
    expect(useReviewStore.getState()).toMatchObject({
      error: '备份文件失败',
      isLoading: false,
    });
  });

  it('surfaces a YAML write failure as a failed deletion result', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/review/read?')) {
        return jsonResponse({ content: '- id: character-1\n  name: 小龙女\n' });
      }
      if (url === '/api/review/backup') return jsonResponse({ success: true });
      if (url === '/api/review/write') return jsonResponse({ error: '写入失败' }, 500);
      return jsonResponse({ error: '接口不存在' }, 404);
    });

    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'characters');
    useReviewStore.setState((state) => ({
      bookPath: '古龙/神雕侠侣',
      filter: { ...state.filter, type: 'characters' },
      entities: state.entities.map((entity) => ({ ...entity, marked: true })),
    }));

    await expect(useReviewStore.getState().deleteMarked()).resolves.toBe(false);
    expect(useReviewStore.getState()).toMatchObject({
      error: '写入文件失败',
      isLoading: false,
    });
  });

  it('stops deletion after one failed .yaml read without probing JSON', async () => {
    let failReads = false;
    const requests: TransportRequest[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.startsWith('/api/review/list?')) {
        return jsonResponse({ files: [] });
      }
      if (url.startsWith('/api/review/read?')) {
        if (failReads) return jsonResponse({ error: '文件不存在' }, 404);
        return jsonResponse({ content: '- id: character-1\n  name: 小龙女\n' });
      }
      return jsonResponse({ error: '不应调用该接口' }, 500);
    });

    await useReviewStore.getState().loadFiles('古龙/神雕侠侣');
    await useReviewStore.getState().loadEntities('古龙/神雕侠侣', 'characters');
    useReviewStore.getState().toggleMark('characters:character-1');
    useReviewStore.getState().setFilter({ type: 'characters' });
    failReads = true;
    const deletionStart = requests.length;

    await useReviewStore.getState().deleteMarked();

    expect(requests.slice(deletionStart)).toEqual([
      {
        url: '/api/review/read?path=%E5%8F%A4%E9%BE%99%2F%E7%A5%9E%E9%9B%95%E4%BE%A0%E4%BE%A3%2Fdata%2Fcharacters.yaml',
        init: undefined,
      },
    ]);
    expect(useReviewStore.getState()).toMatchObject({
      entities: [{ id: 'character-1', marked: true }],
      error: '读取文件失败',
      isLoading: false,
    });
  });
});
