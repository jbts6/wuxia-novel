import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { readBookData, readBookExtras, scanLibrary } from './libraryScanner';

interface ApiResult {
  status: number;
  body: unknown;
}

interface LibraryApiPluginOptions {
  rootDirectory: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function handleLibraryApiRequest(
  rootDirectory: string,
  method: string | undefined,
  requestUrl: string | undefined,
): ApiResult | null {
  const url = new URL(requestUrl ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/library/')) return null;

  if (method !== 'GET') {
    return { status: 405, body: { error: '只支持只读 GET 请求' } };
  }

  try {
    if (url.pathname === '/api/library/status') {
      return { status: 200, body: scanLibrary(rootDirectory) };
    }

    if (url.pathname === '/api/library/book-data') {
      const bookPath = url.searchParams.get('path');
      if (!bookPath) return { status: 400, body: { error: '缺少书籍 path 参数' } };
      return { status: 200, body: readBookData(rootDirectory, bookPath) };
    }

    if (url.pathname === '/api/library/book-extras') {
      const bookPath = url.searchParams.get('path');
      if (!bookPath) return { status: 400, body: { error: '缺少书籍 path 参数' } };
      return { status: 200, body: readBookExtras(rootDirectory, bookPath) };
    }

    return { status: 404, body: { error: '接口不存在' } };
  } catch (error) {
    return { status: 422, body: { error: errorMessage(error) } };
  }
}

function sendJson(response: ServerResponse, result: ApiResult): void {
  response.statusCode = result.status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(result.body));
}

function createMiddleware(rootDirectory: string): Connect.NextHandleFunction {
  return (request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction) => {
    const result = handleLibraryApiRequest(rootDirectory, request.method, request.url);
    if (!result) {
      next();
      return;
    }
    sendJson(response, result);
  };
}

export function libraryApiPlugin(options: LibraryApiPluginOptions): Plugin {
  return {
    name: 'wuxia-library-read-only-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
  };
}
