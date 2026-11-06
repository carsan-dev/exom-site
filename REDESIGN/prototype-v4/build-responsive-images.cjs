'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { digest } = require('./build-release.cjs');
const manifestPath = path.join(__dirname, 'optimized-resources.json');
const optimized = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const specs = [
  ['foto-portada-moi-transparent.png', 'derived/foto-portada-moi-transparent.png', [360, 720], '(max-width: 760px) 65vw, 42vw'],
  ['Moi trabajando escuela.jpg', 'Moi trabajando escuela.jpg', [480, 960, 1440], '(max-width: 760px) calc(100vw - 48px), 38vw'],
  ...['Entreno', 'Comida', 'Progreso'].map(name => [`Captura App ${name}.jpeg`, `Captura App ${name}.jpeg`, [240, 480], '280px'])
];
for (const [name, original, widths, sizes] of specs) {
  const source = path.resolve(__dirname, '../assets/media/images', original);
  const entry = optimized['assets/media/images/' + name];
  assert.equal(digest(fs.readFileSync(source)), entry.sourceSha256, 'Original changed: ' + name);
  const originalWidth = Number(execFileSync('magick', [source, '-auto-orient', '-format', '%w', 'info:'], { encoding: 'utf8' }));
  const variants = widths.map(width => {
    assert.ok(width < originalWidth, 'Never upscale a source');
    const bytes = execFileSync('magick', [source, '-auto-orient', '-resize', `${width}x`, '-quality', '80', '-define', 'webp:method=6', '-define', 'webp:alpha-quality=100', 'webp:-'], { maxBuffer: 5000000 });
    const sha256 = digest(bytes);
    const file = `assets/optimized/${sha256.slice(0, 16)}.webp`;
    fs.writeFileSync(path.join(__dirname, file), bytes);
    return { file, width, sha256 };
  });
  entry.responsive = { originalWidth, sizes, variants };
  console.log(`${name}: ${variants.map(v => `${v.width}px`).join(', ')}`);
}
fs.writeFileSync(manifestPath, JSON.stringify(optimized, null, 2) + '\n');
