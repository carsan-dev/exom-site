'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const origin = 'https://www.exommethod.com';
const pages = {
  'index.html': ['/', 'EXOM — Tu cambio. Con mi método.'],
  'historia.html': ['/historia/', 'Mi historia — Moisés Sánchez · EXOM'],
  'app.html': ['/app/', 'La app — EXOM'],
  'privacy.html': ['/privacy/', 'Política de privacidad — EXOM'],
  'support.html': ['/support/', 'Ayuda — EXOM'],
  'eliminar-datos.html': ['/eliminar-datos/', 'Eliminar datos — EXOM'],
  'aviso-legal.html': ['/aviso-legal/', 'Aviso legal — EXOM']
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');

function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, 'Release copy changed: review the source before building');
  return text.replace(before, after);
}

function publicCopy(html, name) {
  html = replaceOnce(html, '<span>EXOM · Prototipo local, no publicado</span>', '<span>EXOM</span>');
  if (name === 'index.html') {
    html = replaceOnce(html, '  <div class="preview-notice">Prototipo V4 · Formulario local · Sin correos reales</div>\n', '');
    html = replaceOnce(html, 'Prueba local: utiliza solo datos ficticios. Los envíos de correo están desactivados.', 'Solicitud gratuita, sin compra ni cobro. No incluyas información médica.');
    html = replaceOnce(html, 'La prueba local no comunica respuestas a proveedores externos. Este es el flujo preparado para cuando se habilite el envío real:', 'Así se tratan los datos de tu solicitud:');
    html = replaceOnce(html, 'action="api/solicitudes"', 'action="/api/solicitudes/"');
    html = replaceOnce(html, '</head>', '  <meta name="description" content="Entrenamiento y acompañamiento individualizado con Moisés Sánchez. Conoce el método EXOM y cuéntame tu objetivo.">\n</head>');
  }
  if (name === 'privacy.html') {
    assert.equal((html.match(/<p class="privacy-draft-note">/g) || []).length, 1);
    html = html.replace(/\s*<p class="privacy-draft-note">[\s\S]*?<\/p>/, '');
    html = replaceOnce(html, '<strong>Preparado el 4 de noviembre de 2026.</strong> El envío real aún no está habilitado. La prueba local no guarda respuestas ni contacta con Vercel, Resend, Gmail o WhatsApp.', '<strong>Actualizado el 5 de noviembre de 2026.</strong> Este apartado describe el tratamiento de las solicitudes enviadas mediante el formulario web.');
    html = replaceOnce(html, 'Proveedores y recorrido preparado', 'Proveedores y recorrido de la solicitud');
    html = replaceOnce(html, ' No se han enviado correos ni comprobado la entrega real del formulario.', '');
    html = replaceOnce(html, 'el receptor preparado envía directamente', 'el receptor envía directamente');
  }
  if (name === 'aviso-legal.html') {
    html = replaceOnce(html, 'Identificación del titular de EXOM. Borrador local pendiente de completar.', 'Identificación del titular de EXOM y condiciones de uso del sitio web.');
    html = replaceOnce(html, 'Versión local, no publicada. Datos identificativos facilitados por el propietario. El formulario local permite pruebas con datos ficticios, sin envío de correos.', 'Datos identificativos del titular de EXOM y condiciones de uso de este sitio web.');
    html = replaceOnce(html, 'El receptor local valida temporalmente las respuestas de prueba, sin guardarlas ni enviarlas por correo. El envío real permanece desactivado.', 'El formulario valida las respuestas y las remite por correo al responsable, sin guardarlas en una base de datos del sitio web.');
  }
  return html;
}

function collectRelease(optimized = require('./optimized-resources.json')) {
  const output = new Map();
  const seen = new Map();
  const add = (name, bytes) => {
    assert.ok(!name.startsWith('/') && !name.split('/').includes('..'));
    const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (output.has(name)) assert.ok(output.get(name).equals(value), 'Public resource collision: ' + name);
    output.set(name, value);
  };
  const asset = file => {
    if (seen.has(file)) return seen.get(file);
    const real = fs.realpathSync(file);
    assert.equal(real.toLowerCase(), path.resolve(file).toLowerCase(), 'No linked release sources');
    let name;
    if (file.startsWith(__dirname + path.sep)) name = path.relative(__dirname, file);
    else if (file.startsWith(path.join(root, 'REDESIGN/assets/media/images') + path.sep)) name = path.join('assets/media/images', path.basename(file));
    else if (file.startsWith(path.join(root, 'assets') + path.sep)) name = path.relative(root, file);
    else throw Error('Unapproved public source');
    name = name.split(path.sep).join('/');
    assert.ok(/\.(css|js|svg|png|jpe?g|webp|mp4|ttf|woff2?|ico)$/i.test(name), 'Not a public asset: ' + name);
    let bytes = fs.readFileSync(file);
    if (name.endsWith('.mp4')) assert.ok(bytes.length <= 5000000, 'Video exceeds 5 MB: ' + name);
    const replacement = optimized[name];
    if (replacement) {
      // Reject stale derivatives rather than silently shipping an older approved photo.
      assert.equal(digest(bytes), replacement.sourceSha256, 'Optimized source changed: ' + name);
      assert.ok(/^assets\/optimized\/[a-f0-9]{16}\.(webp|woff)$/.test(replacement.file), 'Invalid optimized path');
      const derivative = path.join(__dirname, replacement.file);
      assert.equal(fs.realpathSync(derivative).toLowerCase(), derivative.toLowerCase(), 'No linked optimized sources');
      const smaller = fs.readFileSync(derivative);
      assert.equal(digest(smaller), replacement.sha256, 'Optimized bytes changed: ' + name);
      assert.ok(smaller.length < bytes.length, 'Optimized asset must be smaller');
      if (replacement.file.endsWith('.webp')) assert.ok(smaller.length <= 500000, 'Photo exceeds 500 KB');
      name = replacement.file;
      bytes = smaller;
    }
    const url = '/' + name.split('/').map(encodeURIComponent).join('/');
    seen.set(file, url);
    if (name.endsWith('.css')) bytes = bytes.toString('utf8')
      .replace(/url\(['"]?([^)'"\s]+)['"]?\)/g, (_, ref) => `url('${reference(ref, file)}')`)
      .replace(/(url\('[^']+\.woff'\)\s*)format\(['"]truetype['"]\)/g, "$1format('woff')");
    add(name, bytes);
    return url;
  };
  function reference(ref, source) {
    if (/^(#|https?:|mailto:|tel:)/.test(ref)) return ref;
    const match = /^([^?#]+)(.*)$/.exec(ref);
    assert.ok(match, 'Invalid release reference');
    const [file, suffix] = [decodeURIComponent(match[1]), match[2]];
    if (pages[file]) return pages[file][0] + suffix;
    if (file === '/api/solicitudes/') return ref;
    assert.ok(!file.startsWith('/') && !file.includes('\\'), 'Unexpected absolute resource');
    return asset(path.resolve(path.dirname(source), file)) + suffix;
  }
  for (const [name, [route, title]] of Object.entries(pages)) {
    const source = path.join(__dirname, name);
    let html = publicCopy(read(source), name);
    assert.ok(!/<canvas\b/i.test(html), 'Active canvas assets need an explicit release inventory');
    assert.equal((html.match(/<meta name="robots"[^>]*>/g) || []).length, 1);
    html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="index, follow">');
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    html = html.replace(/\b(href|src|poster|data-src)="([^"]+)"/g, (_, attr, ref) => `${attr}="${reference(ref, source)}"`);
    html = html.replace(/<link\b[^>]*href="[^"]+\.woff"[^>]*>/g, tag => tag.replace('type="font/ttf"', 'type="font/woff"'));
    html = html.replace(/\bsrcset="([^"]+)"/g, (_, refs) => 'srcset="' + refs.split(',').map(item => {
      const [ref, ...descriptor] = item.trim().split(/\s+/);
      return [reference(ref, source), ...descriptor].join(' ');
    }).join(', ') + '"');
    html = html.replace('</head>', `  <link rel="canonical" href="${origin}${route}">\n  <link rel="icon" href="/favicon.svg?v=balance" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/apple-touch-icon.png">\n</head>`);
    assert.ok(!/Propuesta V4|Prototipo local|noindex|Preparación local|Prueba local:|Versión local, no publicada/.test(html), 'Preview copy leaked into the release');
    add(route.slice(1) + 'index.html', html);
  }
  // Preserve already-public URLs used outside the redesigned pages (including email assets).
  for (const name of ['favicon.svg', 'apple-touch-icon.png', 'email-logo.png']) add(name, fs.readFileSync(path.join(root, name)));
  for (const name of ['site.css', 'site.js']) asset(path.join(root, 'assets', name));
  add('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
  add('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + Object.values(pages).map(([route]) => `  <url><loc>${origin}${route}</loc></url>`).join('\n') + '\n</urlset>\n');
  return output;
}

function listFiles(directory, prefix = '') {
  if (!fs.existsSync(directory)) return [];
  assert.ok(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(), 'Output must be a real directory');
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), 'Linked output is not owned by this build');
    const name = prefix + entry.name;
    if (entry.isDirectory()) return listFiles(path.join(directory, entry.name), name + '/');
    assert.ok(entry.isFile(), 'Unexpected output entry');
    return [name];
  });
}

function writeRelease(output, workspace = root) {
  const directory = path.join(workspace, 'dist');
  const manifestFile = path.join(workspace, '.release-manifest.json');
  const existing = listFiles(directory);
  let previous = {};
  if (fs.existsSync(manifestFile)) {
    assert.ok(!fs.lstatSync(manifestFile).isSymbolicLink());
    const manifest = JSON.parse(read(manifestFile));
    assert.equal(manifest.generator, 'exom-static-release-v1');
    previous = manifest.files;
  }
  // Never erase or overwrite edits or unowned files, even inside the generated directory.
  for (const name of existing) assert.equal(digest(fs.readFileSync(path.join(directory, name))), previous[name], 'Unowned or modified output: ' + name);
  const next = {};
  for (const [name, bytes] of output) {
    assert.ok(!path.isAbsolute(name) && !name.includes('\\') && !name.split('/').some(part => !part || part === '..' || part === '.'));
    const file = path.resolve(directory, name);
    assert.ok(file.startsWith(directory + path.sep));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    next[name] = digest(bytes);
  }
  for (const name of existing) if (!output.has(name)) fs.unlinkSync(path.join(directory, name));
  fs.writeFileSync(manifestFile, JSON.stringify({ generator: 'exom-static-release-v1', files: next }, null, 2) + '\n');
}

function build() {
  const output = collectRelease();
  writeRelease(output);
  console.log(`PASS: local release built — ${Object.keys(pages).length} pages, ${output.size} public files, ${[...output.values()].reduce((total, bytes) => total + bytes.length, 0)} bytes. No deployment or email.`);
  return output;
}
module.exports = { build, collectRelease, writeRelease, listFiles, pages, origin, root, digest };
if (require.main === module) build();
