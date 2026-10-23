import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Also preview the GitHub Pages project subpath.
    if (path.startsWith('/maple-mvp/')) path = path.slice('/maple-mvp'.length);
    if (path === '/') path = '/index.html';
    const target = resolve(root, `.${path}`);
    if (!target.startsWith(resolve(root) + sep) || !['/index.html', '/favicon.svg'].includes(path) && !path.startsWith('/src/')) {
      res.writeHead(404).end('Not found'); return;
    }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}/maple-mvp/`));
