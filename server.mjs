import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const archive = 'https://www.ramakrishnavivekananda.info';
const root = new URL('./', import.meta.url);
const types = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  woff2: 'font/woff2',
};
const assets = new Set([
  '/',
  '/index.html',
  '/style.css',
  '/editor.js',
  '/workspace.js',
  '/vendor/avro/avro-lib.js',
  '/vendor/pierre/archive-tree.js',
  '/vendor/diff.js',
  '/vendor/highlight.js',
  '/fonts/NotoSerifBengali.woff2',
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method !== 'GET') {
      response.writeHead(405).end();
      return;
    }
    if (url.pathname === '/api/archive') {
      const target = new URL(url.searchParams.get('url') || '/', archive);
      if (target.origin !== archive || target.username || target.password) {
        response.writeHead(400).end('Choose a page on the archive website.');
        return;
      }
      const remote = await fetch(target, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (
        !remote.ok ||
        !/^text\/html\b/i.test(remote.headers.get('content-type') || '')
      ) {
        response.writeHead(422).end('The archive did not return an HTML page.');
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of remote.body) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) throw Error('Page exceeds size limit');
        chunks.push(chunk);
      }
      response
        .writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .end(Buffer.concat(chunks));
      return;
    }
    if (!assets.has(url.pathname)) {
      response.writeHead(404).end();
      return;
    }
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const bytes = await readFile(fileURLToPath(new URL(name, root)));
    response
      .writeHead(200, {
        'Content-Type':
          types[name.split('.').pop()] || 'application/octet-stream',
      })
      .end(bytes);
  } catch {
    response.writeHead(502).end('Could not load the archive page.');
  }
});
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
server.once('error', (error) => {
  if (error.code === 'EADDRINUSE' && !process.env.PORT) {
    server.listen(0, host);
    return;
  }
  console.error('Could not start the editor:', error.message);
  process.exitCode = 1;
});
server.once('listening', () => {
  console.log('Listening at http://127.0.0.1:' + server.address().port);
});
server.listen(port, host);
