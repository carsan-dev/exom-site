'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createApplicationHandler } = require('./application-server.cjs');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

function resolveFile(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  if (pathname.includes('\0') || pathname.includes('\\')) throw Error('Invalid path');
  if (/\/(?:api|fixtures)(?:\/|$)/.test(pathname)) throw Error('Not a public asset');
  const relative = pathname === '/' ? 'prototype-v4/index.html' : /^\/prototype-v[234]\/$/.test(pathname) ? pathname.slice(1) + 'index.html' : pathname.slice(1);
  if (!relative.startsWith('prototype-v4/') && !relative.startsWith('prototype-v2/') && !relative.startsWith('prototype-v3/') && !relative.startsWith('assets/media/images/')) throw Error('Outside preview');
  const file = fs.realpathSync(path.resolve(root, relative));
  if (!file.startsWith(root + path.sep) || !types[path.extname(file).toLowerCase()] || !fs.statSync(file).isFile()) throw Error('Not a public asset');
  return file;
}

function createServer() {
  let application, applicationOrigin;
  return http.createServer(async (req, res) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) {
      res.writeHead(403, headers).end('Local preview only'); return;
    }
    let url;
    try { url = new URL(req.url, `http://${req.headers.host}`); }
    catch { res.writeHead(400, headers).end('Invalid URL'); return; }
    if (url.origin !== `http://${req.headers.host}`) { res.writeHead(403, headers).end('Local preview only'); return; }
    if (['/prototype-v4/api/solicitudes', '/prototype-v4/api/solicitudes/', '/api/solicitudes', '/api/solicitudes/'].includes(url.pathname)) {
      if (!['GET', 'POST'].includes(req.method)) { res.writeHead(405, { ...headers, Allow: 'GET, POST' }).end(); return; }
      try {
        if (!application || applicationOrigin !== url.origin) {
          applicationOrigin = url.origin;
          application = createApplicationHandler({ origin: applicationOrigin, simulated: true, send: async () => {} });
        }
        // Local preview has no real transport and never reads account credentials.
        const request = new Request(url, { method: req.method, headers: req.headers,
          ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
        const response = await application(request, req.socket.remoteAddress);
        res.writeHead(response.status, { ...headers, ...Object.fromEntries(response.headers) });
        res.end(await response.text());
      } catch { res.writeHead(503, headers).end('Local form unavailable'); }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return;
    }
    let file;
    try { file = resolveFile(req.url); }
    catch { res.writeHead(404, headers).end('Not found'); return; }
    const size = fs.statSync(file).size;
    let start = 0, end = size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (!Number.isSafeInteger(start) || start > end || start >= size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end(); return; }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    res.writeHead(status, { ...headers, 'Content-Type': types[path.extname(file).toLowerCase()], 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}
if (require.main === module) {
  const server = createServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4176, '127.0.0.1', () => console.log('EXOM V4 local preview: http://127.0.0.1:4176/prototype-v4/ (PID ' + process.pid + ')'));
}
module.exports = { createServer, resolveFile };
