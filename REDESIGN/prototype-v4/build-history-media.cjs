'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const source = path.join(__dirname, '../assets/media/images');
const output = path.join(__dirname, 'assets/history');
const files = [
  ['Moi trabajando.JPEG', 'work', 1600],
  ['Moi chico.jpg', 'childhood', 1200],
  ['Moi chico tkd.jpg', 'childhood-tkd', 1400],
  ['Moi chico surf.jpg', 'childhood-surf', 1000],
  ['Moi chico competicion.jpg', 'young-competition', 1400],
  ['Moi arbitro.jpg', 'referee', 1200],
  ['Moi chico inicios escuela tkd.jpg', 'early-school', 1600],
  ['Moi rehabilitacion 1.jpg', 'rehab-standing', 1500],
  ['Moi rehabilitacion 2.jpg', 'rehab-floor', 1400],
  ['Moi rehabilitacion 3.jpg', 'rehab-school', 1400],
  ['Moi creando EXOM 1.jpg', 'studying', 1600],
  ['Moi creando EXOM 2.jpg', 'creating', 1600],
  ['Moi competicion.JPG', 'competition', 1400],
  ['Medallas moi.DNG', 'medals', 960],
  ['Foto hospital.jpg', 'hospital', 1600],
  ['Hospital vertical.png', 'hospital-portrait', 1200],
  ['Foto operación.png', 'recovery', 810],
  ['Reconocimiento moi.JPEG', 'recognition', 1400],
  ['Moi trabajando 2.JPG', 'planning', 960],
  ['Moi trabajando escuela.jpg', 'coaching', 1600],
  ['Moi explicando escuela.jpg', 'explaining', 1200, ['-crop', '4525x4500+0+1550', '+repage']],
  ['Llamada Jose ignacio.PNG', 'call-jose', 1000, ['-crop', '1206x1280+0+1100', '+repage']],
  ['Llamada miguel.JPG', 'call-miguel-private', 1200, ['-crop', '4536x1500+0+3850', '+repage']]
];
fs.mkdirSync(output, { recursive: true });
const hashes = {};
for (const [name, target, size, preparation = []] of files) {
  const original = path.join(source, name);
  const bytes = fs.readFileSync(original);
  hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  // The supplied medal file has a .DNG name but its signature is JPEG.
  const input = name.endsWith('.DNG') && bytes[0] === 255 && bytes[1] === 216 ? 'jpeg:' + original : original;
  // Crop and optimize derivatives without changing the supplied originals.
  execFileSync('magick', [input, '-auto-orient', ...preparation, '-resize', `${size}x${size}>`, '-strip', '-quality', '82', path.join(output, target + '.webp')]);
  if (crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex') !== hashes[name]) throw Error('Original changed: ' + name);
}
fs.writeFileSync(path.join(output, 'sources.json'), JSON.stringify(hashes, null, 2) + '\n');
console.log('PASS: 23 optimized images; original hashes preserved; metadata removed.');
