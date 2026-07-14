import type { LibraryStatusResponse, RawBookExtrasResponse, RawNovelData } from '../types/library';

async function readJsonResponse(response: Response): Promise<unknown> {
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
        ? value.error
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return value;
}

function isLibraryStatusResponse(value: unknown): value is LibraryStatusResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Partial<LibraryStatusResponse>;
  return typeof response.scannedAt === 'string' && Array.isArray(response.books) && typeof response.summary === 'object';
}

export async function fetchLibraryStatus(): Promise<LibraryStatusResponse> {
  const response = await fetch('/api/library/status', { cache: 'no-store' });
  const value = await readJsonResponse(response);
  if (!isLibraryStatusResponse(value)) throw new Error('知识库状态接口返回了无效数据');
  return value;
}

export async function fetchRawBookData(bookPath: string): Promise<RawNovelData> {
  const response = await fetch(`/api/library/book-data?path=${encodeURIComponent(bookPath)}`, { cache: 'no-store' });
  const value = await readJsonResponse(response);
  if (typeof value !== 'object' || value === null) throw new Error('单书数据接口返回了无效数据');
  return value as RawNovelData;
}

export async function fetchRawBookExtras(bookPath: string): Promise<RawBookExtrasResponse> {
  const response = await fetch(`/api/library/book-extras?path=${encodeURIComponent(bookPath)}`, { cache: 'no-store' });
  const value = await readJsonResponse(response);
  if (typeof value !== 'object' || value === null) throw new Error('单书扩展接口返回了无效数据');
  return value as RawBookExtrasResponse;
}
