'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { build, collectRelease, writeRelease, listFiles, pages, origin, root, digest } = require('./build-release.cjs');
const { createServer } = require('./serve-release.cjs');

async function check() {
  const output = build();
  const second = collectRelease();
  const originals = collectRelease({});
  assert.ok(![...output.keys()].some(name => name.endsWith('.webm')), 'No WebM in the public output');
  const videos = [...output].filter(([name]) => name.endsWith('.mp4'));
  assert.equal(videos.length, 21);
  for (const [name, bytes] of videos) assert.ok(bytes.length <= 5000000, 'Video exceeds 5 MB: ' + name);
  const optimized = require('./optimized-resources.json');
  const evidence = require('./resource-optimization.evidence.json');
  const archivedOnly = 'assets/history/coaching.webp';
  assert.ok(!originals.has(archivedOnly) && !output.has(optimized[archivedOnly].file), 'Replaced coaching photo stays out of the release');
  assert.equal(evidence.length, Object.keys(optimized).length);
  for (const record of evidence) {
    assert.equal(record.sha256, optimized[record.name].sourceSha256);
    assert.equal(record.candidateSha256, optimized[record.name].sha256);
    if (record.name.endsWith('.ttf')) assert.equal(record.exactTables, true, 'Lossless font tables');
    else {
      assert.equal(record.quality, 80);
      assert.equal(record.maxBytes, 500000);
      assert.ok(record.sameIcc && record.sameAlpha && record.preservedAspect, 'Photo verification: ' + record.name);
      const bytes = record.name === archivedOnly ? fs.readFileSync(path.join(__dirname, optimized[record.name].file)) : output.get(optimized[record.name].file);
      assert.equal(bytes.length, record.candidateBytes);
      assert.ok(bytes.length <= 500000);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(record.dimensions.every((value, index) => value > 0 && value <= record.originalDimensions[index]));
    }
  }
  const testimonialMedia = require('./assets/testimonials-v1/sources.json');
  for (const record of testimonialMedia) {
    assert.equal(digest(fs.readFileSync(path.join(root, record.original))), record.originalSha256, 'Testimonial original preserved');
    for (const kind of ['video', 'poster']) {
      const media = record[kind];
      const bytes = output.get(media.file);
      assert.equal(digest(bytes), media.sha256);
      assert.equal(bytes.length, media.bytes);
      assert.ok(bytes.length <= (kind === 'video' ? 5000000 : 500000));
    }
    assert.equal(record.poster.quality, 80);
  }
  assert.equal(testimonialMedia.length, 3);
  assert.ok(![...output.keys()].some(name => /testimonio_/.test(name)), 'Original testimonials never ship');
  const photos = [...originals.keys()].filter(name => !name.startsWith('assets/testimonials-v1/') && /\.(png|jpe?g|webp)$/i.test(name) && !['apple-touch-icon.png', 'email-logo.png'].includes(name));
  assert.equal(photos.length, 53);
  for (const name of photos) assert.ok(optimized[name]?.file.endsWith('.webp'), 'Every photo uses WebP: ' + name);
  assert.ok(Object.keys(optimized).length > 0);
  let saved = 0;
  for (const [name, replacement] of Object.entries(optimized)) {
    if (name === archivedOnly) {
      assert.equal(digest(fs.readFileSync(path.join(__dirname, name))), replacement.sourceSha256, 'Unused source is still preserved');
      assert.equal(digest(fs.readFileSync(path.join(__dirname, replacement.file))), replacement.sha256, 'Unused derivative is still preserved');
      continue;
    }
    assert.equal(digest(originals.get(name)), replacement.sourceSha256, 'Original preserved: ' + name);
    assert.equal(digest(output.get(replacement.file)), replacement.sha256);
    assert.ok(!output.has(name), 'Do not ship both copies: ' + name);
    saved += originals.get(name).length - output.get(replacement.file).length;
  }
  const first = Object.keys(optimized)[0];
  assert.throws(() => collectRelease({ ...optimized, [first]: { ...optimized[first], sourceSha256: 'stale' } }), /Optimized source changed/);
  assert.throws(() => collectRelease({ ...optimized, [first]: { ...optimized[first], sha256: 'changed' } }), /Optimized bytes changed/);
  assert.throws(() => collectRelease({ ...optimized, [first]: { ...optimized[first], file: '../outside.webp' } }), /Invalid optimized path/);
  for (const [name, bytes] of originals) {
    if (!optimized[name] && !/\.(html|css)$/.test(name)) assert.ok(bytes.equals(output.get(name)), 'Unchanged media/code: ' + name);
  }
  assert.match(output.get('styles.css').toString(), /\.woff'\) format\('woff'\)/);
  assert.ok(!output.get('styles.css').toString().includes("format('truetype')"));
  assert.match(output.get('index.html').toString(), /rel="preload" href="[^"]+\.woff" as="font" type="font\/woff" crossorigin/);
  console.log(`PASS: ${photos.length} published WebP quality-80 photos <=500 KB and lossless fonts save ${saved} asset bytes; unused coaching and originals preserved; stale/corrupt/escaping replacements rejected.`);
  assert.ok(output.get('favicon.svg').equals(fs.readFileSync(path.join(__dirname, 'assets/exom-balance.svg'))), 'Favicon matches the approved white/lime site symbol');
  assert.equal(output.size, second.size);
  for (const [name, bytes] of output) {
    assert.ok(bytes.equals(second.get(name)), 'Reproducible output: ' + name);
    assert.ok(bytes.equals(fs.readFileSync(path.join(root, 'dist', name))), 'Generated bytes: ' + name);
    assert.ok(!/REDESIGN|prototype|fixtures|checks|sources\.json|\.cjs$|\.mjs$|\.md$|\.env|\.git|\.map$/.test(name), 'Internal file in release: ' + name);
  }
  assert.deepEqual(listFiles(path.join(root, 'dist')).sort(), [...output.keys()].sort());
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.buildCommand, 'node REDESIGN/prototype-v4/build-release.cjs');
  assert.equal(config.cleanUrls, true); assert.equal(config.trailingSlash, true);
  assert.ok(config.headers[0].headers.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff'));
  assert.ok(config.headers[0].headers.some(h => h.key === 'Referrer-Policy' && h.value === 'strict-origin-when-cross-origin'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).engines.node, '24.x');
  const targetFor = pathname => pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
  function checkRef(ref, route) {
    if (/^(mailto:|tel:)/.test(ref)) return;
    const url = new URL(ref.replaceAll('&amp;', '&'), origin + route);
    if (url.origin !== origin) return;
    if (url.pathname === '/api/solicitudes/') return;
    const target = targetFor(decodeURIComponent(url.pathname));
    assert.ok(output.has(target), 'Broken public link or resource: ' + ref);
    if (url.hash) assert.ok(output.get(target).toString().includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), 'Broken anchor: ' + ref);
  }
  for (const [name, [route, title]] of Object.entries(pages)) {
    const html = output.get(targetFor(route)).toString();
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.match(html, /<div class="footer-bottom">\s*<nav class="footer-links"/, 'Every public footer omits the redundant small brand label');
    assert.match(html, /<div class="footer-top"><a class="wordmark brand-lockup"/, 'Keep the main footer logo');
    assert.ok(html.includes(`<title>${title}</title>`));
    assert.ok(html.includes(`rel="canonical" href="${origin}${route}"`));
    assert.ok(html.includes('rel="icon" href="/favicon.svg?v=balance" type="image/svg+xml"'), 'Every public route uses the updated favicon');
    assert.ok(html.includes('name="robots" content="index, follow"'));
    assert.ok(html.includes('Content-Security-Policy') && html.includes("object-src 'none'; base-uri 'none'"));
    const policy = text => text.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.equal(policy(html), name === 'index.html' ? policy(source) : policy(source).replace("connect-src 'none'", `connect-src ${origin}/robots.txt`), 'Only the exact public robots URL is allowed; all other security directives stay unchanged');
    assert.ok(!/Propuesta V4|Prototipo V4|Prototipo local|Preparación local|noindex|Borrador local/.test(html));
    assert.ok(!html.includes('\r'));
    for (const match of html.matchAll(/\b(?:href|src|poster|data-src|action)="([^"]+)"/g)) checkRef(match[1], route);
    for (const match of html.matchAll(/\bsrcset="([^"]+)"/g)) for (const item of match[1].split(',')) checkRef(item.trim().split(/\s+/)[0], route);
    if (name === 'aviso-legal.html') {
      assert.ok(source.match(/<ul>[\s\S]*?<\/ul>/)[0] === html.match(/<ul>[\s\S]*?<\/ul>/)[0], 'Owner identification preserved without copying it into test output');
    }
  }
  for (const [name, bytes] of output) if (name.endsWith('.css')) {
    for (const match of bytes.toString().matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) checkRef(match[1], '/' + name);
  }
  const landing = output.get('index.html').toString();
  const responsiveEntries = Object.values(optimized).filter(entry => entry.responsive);
  assert.equal(responsiveEntries.length, 5, 'Only the five oversized landing images get variants');
  for (const entry of responsiveEntries) {
    for (const variant of entry.responsive.variants) {
      const bytes = output.get(variant.file);
      assert.equal(digest(bytes), variant.sha256);
      assert.ok(bytes.length < output.get(entry.file).length);
      let width;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const kind = bytes.toString('ascii', offset, offset + 4);
        const size = bytes.readUInt32LE(offset + 4), data = offset + 8;
        if (kind === 'VP8X') width = bytes.readUIntLE(data + 4, 3) + 1;
        if (kind === 'VP8 ') width = bytes.readUInt16LE(data + 6) & 0x3fff;
        if (kind === 'VP8L') width = (bytes.readUInt32LE(data + 1) & 0x3fff) + 1;
        offset = data + size + (size % 2);
      }
      assert.equal(width, variant.width, 'srcset width matches the encoded pixels');
      assert.ok(landing.includes(`/${variant.file} ${variant.width}w`));
    }
    assert.ok(landing.includes(`/${entry.file} ${entry.responsive.originalWidth}w`), 'Full-size fallback remains available for high-density screens');
  }
  assert.equal((landing.match(/ sizes="\(max-width: 760px\) calc\(\(100vw - 64px\) \/ 3\), 165px"/g) || []).length, 3);
  const responsiveSource = Object.keys(optimized).find(name => optimized[name].responsive);
  const invalidVariant = (field, value) => {
    const changed = structuredClone(optimized);
    changed[responsiveSource].responsive.variants[0][field] = value;
    return changed;
  };
  assert.throws(() => collectRelease(invalidVariant('sha256', 'changed')), /Responsive bytes changed/);
  assert.throws(() => collectRelease(invalidVariant('file', '../outside.webp')), /Invalid responsive path/);
  assert.throws(() => collectRelease(invalidVariant('width', 0)), /Invalid responsive width/);
  assert.ok(landing.indexOf('src="/gallery-shared.js"') > landing.indexOf('src="/app.js"'));
  assert.ok(output.get('gallery-shared.js').equals(fs.readFileSync(path.join(__dirname, 'gallery-shared.js'))));
  assert.ok(!/gpu-mode-|diagnostic-result|manualGalleryMode/.test(landing + output.get('gallery-shared.js').toString()), 'No comparison panel in the release');
  const sourceLanding = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const pattern of [/<label\b[^>]*>[\s\S]*?<\/label>/g, /<option\b[^>]*>[\s\S]*?<\/option>/g, /<legend\b[^>]*>[\s\S]*?<\/legend>/g]) {
    assert.deepEqual(landing.match(pattern), sourceLanding.match(pattern), 'Approved questions and options are unchanged');
  }
  assert.ok(landing.includes('action="/api/solicitudes/" method="post"'));
  assert.ok(landing.includes('disabled'));
  for (const name of ['form-client.js', 'form-rules.js', 'history.js', 'history.css']) assert.ok(output.get(name).equals(fs.readFileSync(path.join(__dirname, name))), 'Tested client code is shipped unchanged');
  const privacy = output.get('privacy/index.html').toString();
  for (const text of ['Vercel Hobby', 'Resend Free', 'Gmail gratuito', 'WhatsApp normal', 'EE. UU.', '90 días', '6.1.b', 'Agencia Española de Protección de Datos']) assert.ok(privacy.includes(text), 'Required disclosure retained: ' + text);
  assert.ok(output.get('historia/index.html').toString().includes('/' + optimized['assets/history/referee.webp'].file));
  const historyHtml = output.get('historia/index.html').toString();
  const poster = '/' + optimized['assets/history-present/pose.webp'].file;
  assert.ok(historyHtml.includes(`<link rel="preload" href="${poster}" as="image" fetchpriority="high">`));
  assert.ok(historyHtml.includes(`poster="${poster}"`), 'Preload and video reuse the same optimized image');
  assert.equal((output.get('sitemap.xml').toString().match(/<loc>/g) || []).length, 7);
  assert.deepEqual([...output.get('sitemap.xml').toString().matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), Object.values(pages).map(([route]) => origin + route), 'Sitemap contains every canonical public route exactly once');
  assert.ok(output.get('robots.txt').toString().includes(origin + '/sitemap.xml'));
  console.log('PASS: seven public routes, assets/anchors, canonical www URLs, sitemap/robots, security headers, approved copy and source isolation.');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'exom-release-check-'));
  try {
    const files = new Map([['one.txt', Buffer.from('one')], ['old.txt', Buffer.from('owned')]]);
    writeRelease(files, temporary); writeRelease(files, temporary);
    fs.writeFileSync(path.join(temporary, 'dist', 'foreign.txt'), 'keep');
    assert.throws(() => writeRelease(files, temporary), /Unowned or modified/);
    assert.equal(fs.readFileSync(path.join(temporary, 'dist', 'foreign.txt'), 'utf8'), 'keep');
    fs.unlinkSync(path.join(temporary, 'dist', 'foreign.txt'));
    fs.writeFileSync(path.join(temporary, 'dist', 'one.txt'), 'manual edit');
    assert.throws(() => writeRelease(files, temporary), /Unowned or modified/);
    assert.equal(fs.readFileSync(path.join(temporary, 'dist', 'one.txt'), 'utf8'), 'manual edit');
    fs.writeFileSync(path.join(temporary, 'dist', 'one.txt'), 'one');
    writeRelease(new Map([['one.txt', Buffer.from('updated')]]), temporary);
    assert.ok(!fs.existsSync(path.join(temporary, 'dist', 'old.txt')));
    assert.throws(() => writeRelease(new Map([['../escape.txt', Buffer.from('no')]]), temporary));
    assert.ok(!fs.existsSync(path.join(temporary, 'escape.txt')));
  } finally {
    // This test owns these exact temporary files; no recursive deletion or wildcard cleanup.
    for (const name of ['one.txt', 'old.txt', 'foreign.txt']) {
      const file = path.join(temporary, 'dist', name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(path.join(temporary, 'dist'));
    fs.unlinkSync(path.join(temporary, '.release-manifest.json'));
    fs.rmdirSync(temporary);
  }
  console.log('PASS: deterministic rebuild, modified/unowned output protection, stale owned-file cleanup and path containment.');

  const server = createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [name, bytes] of output) {
      const route = '/' + name.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(base + route, { method: 'HEAD' });
      assert.equal(response.status, 200, 'Release resource serves: ' + name);
      assert.equal(Number(response.headers.get('content-length')), bytes.length);
    }
    for (const [route] of Object.values(pages)) assert.equal((await fetch(base + route)).status, 200);
    for (const route of ['/REDESIGN/prototype-v4/application-server.cjs', '/api/solicitudes.mjs', '/.env', '/.git/config', '/package.json', '/.release-manifest.json', '/%5c..%5cvercel.json']) assert.equal((await fetch(base + route)).status, 404);
    for (const method of ['GET', 'POST']) assert.equal((await fetch(base + '/api/solicitudes/', { method })).status, 503, 'Preview never enables real mail');
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
    const video = [...output.keys()].find(name => name.endsWith('.mp4'));
    const range = await fetch(base + '/' + video, { headers: { Range: 'bytes=0-15' } });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 16);
    assert.equal((await fetch(base + '/' + video, { headers: { Range: 'bytes=9999999999-' } })).status, 416);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
  require('./application-entry-checks.cjs')();
  console.log('PASS: release HTTP routes/media/ranges, internal paths hidden, preview mail closed, root API with isolated mock only.');
  console.log('PASS: release checksum ' + digest(Buffer.from([...output].map(([name, bytes]) => name + ':' + digest(bytes)).join('\n'))));
}
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = check;
