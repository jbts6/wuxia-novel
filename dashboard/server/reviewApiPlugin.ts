import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ApiResult {
  status: number;
  body: unknown;
}

interface ReviewApiPluginOptions {
  rootDirectory: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function validateFilePath(rootDirectory: string, filePath: string): string | null {
  const resolved = path.resolve(rootDirectory, filePath);
  if (!resolved.startsWith(path.resolve(rootDirectory))) {
    return null; // 路径遍历攻击
  }
  return resolved;
}

export function handleReviewApiRequest(
  rootDirectory: string,
  method: string | undefined,
  requestUrl: string | undefined,
  requestBody?: string,
): Promise<ApiResult> | ApiResult | null {
  const url = new URL(requestUrl ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/review/')) return null;

  try {
    // GET /api/review/read?path=<path>
    if (method === 'GET' && url.pathname === '/api/review/read') {
      const filePath = url.searchParams.get('path');
      if (!filePath) return { status: 400, body: { error: '缺少 path 参数' } };

      const fullPath = validateFilePath(rootDirectory, filePath);
      if (!fullPath) return { status: 400, body: { error: '无效的文件路径' } };

      if (!fs.existsSync(fullPath)) return { status: 404, body: { error: '文件不存在' } };

      const content = fs.readFileSync(fullPath, 'utf-8');
      return { status: 200, body: { content } };
    }

    // POST /api/review/write
    if (method === 'POST' && url.pathname === '/api/review/write') {
      if (!requestBody) return { status: 400, body: { error: '缺少请求体' } };

      const { path: filePath, content } = JSON.parse(requestBody);
      if (!filePath || content === undefined) {
        return { status: 400, body: { error: '缺少 path 或 content 参数' } };
      }

      const fullPath = validateFilePath(rootDirectory, filePath);
      if (!fullPath) return { status: 400, body: { error: '无效的文件路径' } };

      fs.writeFileSync(fullPath, content, 'utf-8');
      return { status: 200, body: { success: true } };
    }

    // POST /api/review/backup
    if (method === 'POST' && url.pathname === '/api/review/backup') {
      if (!requestBody) return { status: 400, body: { error: '缺少请求体' } };

      const { source, target } = JSON.parse(requestBody);
      if (!source || !target) {
        return { status: 400, body: { error: '缺少 source 或 target 参数' } };
      }

      const fullSource = validateFilePath(rootDirectory, source);
      const fullTarget = validateFilePath(rootDirectory, target);
      if (!fullSource || !fullTarget) {
        return { status: 400, body: { error: '无效的文件路径' } };
      }

      if (!fs.existsSync(fullSource)) {
        return { status: 404, body: { error: '源文件不存在' } };
      }

      // 确保目标目录存在
      const targetDir = path.dirname(fullTarget);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.copyFileSync(fullSource, fullTarget);
      return { status: 200, body: { success: true, backupPath: target } };
    }

    // GET /api/review/list?bookPath=<path>
    if (method === 'GET' && url.pathname === '/api/review/list') {
      const bookPath = url.searchParams.get('bookPath');
      if (!bookPath) return { status: 400, body: { error: '缺少 bookPath 参数' } };

      const fullBookPath = validateFilePath(rootDirectory, bookPath);
      if (!fullBookPath) return { status: 400, body: { error: '无效的书籍路径' } };

      const dataDir = path.join(fullBookPath, 'data');
      if (!fs.existsSync(dataDir)) {
        return { status: 200, body: { files: [] } };
      }

      const files = fs.readdirSync(dataDir)
        .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json'))
        .map((file) => ({
          name: file,
          path: path.join(bookPath, 'data', file),
          type: file.replace(/\.(yaml|yml|json)$/, ''),
        }));

      return { status: 200, body: { files } };
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
  return async (request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction) => {
    let requestBody: string | undefined;
    if (request.method === 'POST') {
      requestBody = await readRequestBody(request);
    }
    const result = await handleReviewApiRequest(rootDirectory, request.method, request.url, requestBody);
    if (!result) {
      next();
      return;
    }
    sendJson(response, result);
  };
}

export function reviewApiPlugin(options: ReviewApiPluginOptions): Plugin {
  return {
    name: 'wuxia-review-api',
    configureServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware(options.rootDirectory));
    },
  };
}
