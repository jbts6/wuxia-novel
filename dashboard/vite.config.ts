import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'novel-data-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url!, `http://${req.headers.host}`);

          if (url.pathname.startsWith('/api/novel/')) {
            const bookParam = url.searchParams.get('book');
            const filePath = url.pathname.replace('/api/novel/', '');

            if (bookParam && filePath) {
              try {
                const fullPath = path.resolve(__dirname, '..', bookParam, filePath);
                const resolvedBase = path.resolve(__dirname, '..');
                if (!fullPath.startsWith(resolvedBase)) {
                  res.statusCode = 403;
                  res.end('Forbidden');
                  return;
                }

                const data = fs.readFileSync(fullPath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(data);
              } catch {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'File not found' }));
              }
              return;
            }
          }

          next();
        });
      }
    }
  ],
})
