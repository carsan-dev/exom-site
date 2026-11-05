'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { root, listFiles } = require('./build-release.cjs');
const directory = path.join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

function createServer() {
  const files = new Set(listFiles(directory));
  if (!files.has('index.html')) throw Error('Build the release before previewing it');
  return http.createServer((req, res) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { res.writeHead(403, headers).end(); return; }
    let pathname;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.origin !== `http://${req.headers.host}`) throw Error();
      pathname = decodeURIComponent(url.pathname);
    } catch { res.writeHead(400, headers).end(); return; }
    if (/^\/api\/solicitudes\/?$/.test(pathname)) {
      // This preview never imports a mail transport or reads any account credentials.
      res.writeHead(503, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'El formulario no está disponible para envíos reales.' }));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return; }
    let name = pathname.slice(1);
    if (!name || name.endsWith('/')) name += 'index.html';
    if (!files.has(name) || !types[path.extname(name)]) { res.writeHead(404, headers).end('Not found'); return; }
    const file = path.join(directory, name);
    try {
      if (fs.realpathSync(file) !== file) throw Error('Linked asset');
      const size = fs.statSync(file).size;
      let start = 0, end = size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!match) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
        start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (!Number.isSafeInteger(start) || start > end || start >= size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
      res.writeHead(status, { ...headers, 'Content-Type': types[path.extname(name)], 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch { res.writeHead(404, headers).end('Not found'); }
  });
}
module.exports = { createServer };
if (require.main === module) createServer().listen(4177, '127.0.0.1', () => console.log('EXOM release preview: http://127.0.0.1:4177/ — real mail disabled'));
