// serve.ts — tiny static server for local dev.
//   node serve.ts   →  http://localhost:8080/
// app/ is served at the root (so ./style.css, ./src/main.js resolve),
// the repo root is kept for tools/ and vendor/.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // app/ lives at the root; other repo files stay under /<path>
    const underApp = !pathname.slice(1).startsWith('app/');
    const rel = underApp && pathname !== '/robots.txt' ? join('app', pathname) : pathname.slice(1);
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cover Forge dev server → http://127.0.0.1:${PORT}/  (serving app/; Ctrl+C to stop)`);
});