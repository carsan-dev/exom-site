'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/styles.css', 'utf8');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const progress = html.slice(html.indexOf('<section class="section progress"'), html.indexOf('<section class="section client-practice"'));
const progressPhotos = progress.match(/<img\b[^>]*>/g) || [];
assert.equal(progressPhotos.length, 6);
assert.ok(progressPhotos.every(tag => tag.includes('loading="lazy"') && tag.includes('decoding="async"')), 'Progress photos decode without holding up unrelated paints; keep lazy loading');
assert.ok(!html.includes('<figcaption>Entrenamientos reales · EXOM</figcaption>'), 'Omit the redundant training caption');
assert.ok(html.includes('<button id="practice-toggle" type="button" aria-pressed="false">Pausar vídeos</button>'), 'Keep the accessible playback control');
const titles = [
  'Técnico Superior en Acondicionamiento Físico',
  'Técnico en Guía en el Medio Natural y de Tiempo Libre',
  'Curso Europeo de Entrenador Personal',
  'Técnico en Fisiología Deportiva',
  'Técnico Especialista en Entrenamiento Funcional',
  'Asesor en Nutrición Deportiva',
  'Cinturón negro 3.º DAN', 'Entrenador nacional de taekwondo'
];
const items = [...html.matchAll(/<li class="qualification-item"><span>(.*?)<\/span><\/li>/g)];
assert.deepEqual(items.map(m => m[1].replace(/ <small>.*?<\/small>/g, '')), titles);
assert.ok(!/WhatsApp Image|DNI:|Nº de registro/.test(html), 'Certificate photographs and personal identifiers are not published');
assert.equal((html.match(/class="qualification-group"/g) || []).length, 3);
assert.equal((html.match(/label-before">Antes<\/span><span class="photo-label label-after">Después/g) || []).length, 3);
assert.ok(css.includes('.comparison .after-image{clip-path:inset(0 0 0 var(--reveal))}'));
assert.ok(css.includes('.comparison .label-before{left:16px;right:auto}'));
assert.ok(css.includes('.comparison .label-after{left:auto;right:16px}'));
assert.ok(css.includes('mask-composite:intersect'));
assert.ok(css.includes('body[data-motion="off"] .qualification-item>span{transform:none!important}'));

let update, reveal, spoken;
const slider = { value: 50, closest: () => ({ style: { setProperty: (name, value) => { reveal = value; } } }),
  setAttribute: (name, value) => { spoken = value; }, addEventListener: (name, callback) => { update = callback; } };
const comparison = app.slice(app.indexOf("document.querySelectorAll('.comparison input')"), app.indexOf('// Demo-only navigation'));
vm.runInNewContext(comparison, { document: { querySelectorAll: () => [slider] }, clamp: require('./motion.js').clamp });
for (const value of [0, 50, 100, 0]) {
  slider.value = value; update();
  assert.equal(reveal, value + '%');
  assert.equal(spoken, `${value} % antes, ${100 - value} % después`);
}

const group = { getBoundingClientRect: () => ({ bottom: 400 }), querySelectorAll: () => ['row'] };
const completed = new WeakSet(); const calls = [];
const source = app.slice(app.indexOf('function setupFormationMotion()'), app.indexOf('function setupHeroMotion()'));
const context = vm.createContext({ revealedQualifications: completed, document: { querySelectorAll: () => [group] },
  gsap: { from: (targets, options) => { calls.push(options); } } });
vm.runInContext(source + '\nsetupFormationMotion();', context);
assert.equal(calls.length, 1); assert.equal(calls[0].scrollTrigger.once, true);
assert.equal(calls[0].yPercent, 110); assert.equal(calls[0].duration, .65);
calls[0].onComplete(); vm.runInContext('setupFormationMotion();', context);
assert.equal(calls.length, 1, 'Completed groups do not replay after re-enabling effects');
completed.delete(group); group.getBoundingClientRect = () => ({ bottom: -1 });
vm.runInContext('setupFormationMotion();', context);
assert.equal(calls.length, 1, 'Past groups are not hidden when entering at a deep link');
console.log('PASS: before/after orientation and accessible endpoints, eight qualifications, one-shot formation motion and static fallback.');
