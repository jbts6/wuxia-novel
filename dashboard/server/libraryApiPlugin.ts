import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import type { Connect, Plugin } from 'vite';
import { ACTION_CONFIGS } from './actionConfig';
import { readBookData, readBookExtras, scanLibrary } from './libraryScanner';

// 允许执行的 action types 白名单（只包含有脚本的 action）
const ALLOWED_ACTION_TYPES = ACTION_CONFIGS
  .filter((config) => config.script !== null)
  .map((config) => config.type);

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

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    request.on('error', reject);
  });
}

function executeAction(
  rootDirectory: string,
  bookPath: string,
  actionType: string,
): Promise<{ success: boolean; output: string; error?: string }> {
  const actionConfig = ACTION_CONFIGS.find((c) => c.type === actionType);
  if (!actionConfig || !actionConfig.script) {
    return Promise.resolve({ success: false, output: '', error: `未知的 action type: ${actionType}` });
  }

  const scriptPath = `${rootDirectory}/.agents/skills/generate-kb/scripts/${actionConfig.script}`;
  const args = [bookPath, ...(actionConfig.extraArgs ?? [])];

  return new Promise((resolve) => {
    execFile('node', [scriptPath, ...args], { cwd: rootDirectory, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || stdout, error: errorMessage(error) });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

export async function handleLibraryApiRequest(
  rootDirectory: string,
  method: string | undefined,
  requestUrl: string | undefined,
  request?: IncomingMessage,
): Promise<ApiResult | null> {
  const url = new URL(requestUrl ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/library/')) return null;

  // GET 请求处理
  if (method === 'GET') {
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

  // POST 请求处理
  if (method === 'POST') {
    if (url.pathname === '/api/library/execute-action') {
      if (!request) {
        return { status: 500, body: { error: '请求对象不可用' } };
      }

      try {
        const body = await readRequestBody(request);
        const { bookPath, actionType } = JSON.parse(body) as { bookPath?: string; actionType?: string };

        if (!bookPath || !actionType) {
          return { status: 400, body: { error: '缺少 bookPath 或 actionType 参数' } };
        }

        if (!ALLOWED_ACTION_TYPES.includes(actionType)) {
          return { status: 400, body: { error: `不允许的 action type: ${actionType}` } };
        }

        const result = await executeAction(rootDirectory, bookPath, actionType);
        return { status: 200, body: result };
      } catch (error) {
        return { status: 422, body: { error: errorMessage(error) } };
      }
    }

    return { status: 404, body: { error: '接口不存在' } };
  }

  return { status: 405, body: { error: '不支持的请求方法' } };
}

function sendJson(response: ServerResponse, result: ApiResult): void {
  response.statusCode = result.status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(result.body));
}

function createMiddleware(rootDirectory: string): Connect.NextHandleFunction {
  return (request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction) => {
    const resultPromise = handleLibraryApiRequest(rootDirectory, request.method, request.url, request);
    resultPromise.then((result) => {
      if (!result) {
        next();
        return;
      }
      sendJson(response, result);
    }).catch((error) => {
      sendJson(response, { status: 500, body: { error: errorMessage(error) } });
    });
  };
}

export function libraryApiPlugin(options: LibraryApiPluginOptions): Plugin {
  return {
    name: 'wuxia-library-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
  };
}
