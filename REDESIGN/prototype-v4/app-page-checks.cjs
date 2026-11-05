'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gsap } = require('./assets/vendor/gsap.min.js');
const { createScreenTimeline } = require('./app-page.js');
const { createServer } = require('./serve.cjs');
const html = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'app-page.css'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'app-page.js'), 'utf8');

async function check() {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/class="app-feature"/g) || []).length, 4);
  assert.ok(!html.includes('Próximamente'));
  assert.ok(html.includes('<section class="app-film" id="pelicula" aria-labelledby="film-title" data-reading>'), 'Real app film is visible and tracked');
  assert.ok(html.includes('href="#pelicula">EXOM por dentro'), 'Hero link reaches the real film');
  assert.ok(!/autoplay|<form|<input|\.webm/.test(html), 'Manual MP4 playback only, without data collection');
  const films = [...html.matchAll(/<video\b[^>]+>/g)];
  assert.equal(films.length, 2);
  for (const [tag] of films) for (const attribute of ['controls', 'playsinline', 'muted', 'preload="none"', 'poster=', 'aria-label=', 'aria-describedby="film-description"']) assert.ok(tag.includes(attribute), attribute);
  assert.ok(html.includes('width="1920" height="1080"') && html.includes('width="1080" height="1920"'));
  assert.ok(css.includes('object-fit:contain') && css.includes('aspect-ratio:9/16'));
  assert.ok(css.includes('.app-film-portrait { display:none; }') && css.includes('.app-film-landscape { display:none; }'));
  assert.ok(css.includes('@media(min-width:901px) {\n  .app-film { padding-bottom:45px; }\n  .app-daily { padding-top:70px; }\n}'), '115px film-to-features spacing only on desktop, including short windows');
  assert.ok(css.includes('.app-film { padding:75px var(--space) 35px; }') && css.includes('.app-daily { padding:65px var(--space) 70px; }'), 'Mobile spacing remains 100px');
  assert.ok(html.includes("connect-src 'none'; form-action 'none'"));
  assert.ok(html.includes('noindex, nofollow'));
  assert.ok(html.includes('La app no tiene registro libre'));
  assert.ok(html.includes('Datos de demostración'));
  assert.ok(html.match(/class="app-phone-position app-phone-main"[^\n]+/)[0].includes('Captura App Portada.jpeg'));
  assert.ok(html.match(/class="app-phone-position app-phone-left"[^\n]+/)[0].includes('Captura App Entreno.jpeg'));
  assert.ok(html.match(/class="app-screen-stack">[\s\S]*?<\/div>/)[0].includes('Captura App Ejercicio.jpeg'));
  assert.ok(html.match(/id="entrenamiento"[\s\S]*?<\/article>/)[0].includes('Captura App Ejercicio.jpeg'));
  assert.equal(new Set([...html.matchAll(/Captura App ([^"/]+)\.jpeg/g)].map(m => m[1])).size, 7, 'Seven distinct screen types');
  assert.ok(html.match(/class="app-phone-position app-phone-right"[^\n]+/)[0].includes('Captura App Logros.jpeg'));
  assert.ok(html.match(/id="evolucion"[\s\S]*?<\/article>/)[0].includes('Captura App Progreso.jpeg'));
  assert.ok(html.match(/id="seguimiento"[\s\S]*?<\/article>/)[0].includes('Captura App Recap.jpeg'));
  assert.ok(!html.includes('Captura App Fotos Progreso.jpeg'), 'Rejected photo grid remains unused');
  assert.equal((html.match(/Captura App Recap.jpeg/g) || []).length, 2, 'Same recap in desktop and static/mobile reading');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/.test(source));
  assert.ok(!/pin:|wheel|touchmove|requestAnimationFrame|setInterval/.test(source), 'No scroll hijack, pin or permanent animation loop');
  assert.ok(css.includes('prefers-reduced-motion') && source.includes('context?.revert()'));
  const external = new Set(['https://apps.apple.com/app/6763056692', 'https://play.google.com/apps/testing/com.exommethod.exom', 'https://github.com/carsan-dev', 'https://csroman-dev.vercel.app/']);
  assert.ok(html.includes('href="support.html">¿Necesitas ayuda para entrar?'), 'Help stays inside V4');
  for (const match of html.matchAll(/(?:src|href|poster)="([^"]+)"/g)) {
    if (/^https:/.test(match[1])) {
      assert.ok(external.has(match[1])); assert.ok(match[0].startsWith('href=')); continue;
    }
    const [file, anchor] = match[1].split('#');
    const target = path.resolve(__dirname, file || 'app.html');
    assert.ok(fs.existsSync(target), match[1]);
    if (anchor) assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${anchor}"`), match[1]);
  }
  for (const tag of html.matchAll(/<img\b[^>]+>/g)) assert.ok(/alt="[^"]*"/.test(tag[0]) && /width="\d+"/.test(tag[0]) && /height="\d+"/.test(tag[0]));
  for (const name of ['app.html', 'app-page.css', 'app-page.js', 'app-page-checks.cjs']) assert.ok(!fs.readFileSync(path.join(__dirname, name)).includes(13), 'LF: ' + name);

  assert.equal((html.match(/class="app-device"/g) || []).length, 5, 'One fixed desktop phone and four static/mobile phones');
  assert.equal((html.match(/class="app-device-island" aria-hidden="true"/g) || []).length, 5, 'Decorative Dynamic Island in every demonstration phone');
  assert.equal((html.match(/class="app-device-buttons" aria-hidden="true"/g) || []).length, 5, 'Decorative side controls in every demonstration phone');
  assert.ok(css.includes('aspect-ratio:945/1958; overflow:hidden'), 'Screens stay clipped inside the phone');
  const target = () => ({ autoAlpha: 0, xPercent: 0 });
  for (const count of [3, 4]) for (let run = 0; run < 3; run++) {
    const screens = Array.from({ length: count }, target), track = { scaleX: 0 };
    const a = screens[0], last = screens.at(-1);
    a.autoAlpha = 1;
    let timeline;
    const context = gsap.context(() => { timeline = createScreenTimeline(gsap, screens, track); });
    assert.equal(Object.keys(timeline.labels).length, count - 1);
    Object.values(timeline.labels).forEach((time, i) => {
      assert.ok(Math.abs(time / timeline.duration() - (i + 1) / count) < .0001, 'Every screen owns an equal share of the progress bar');
    });
    screens.forEach((screen, i) => {
      timeline.progress((i + .5) / count);
      assert.equal(screen.autoAlpha, 1, 'Every screen has a fully visible reading interval, including the last');
      assert.equal(screen.xPercent, 0, 'The active screen fills the fixed phone');
    });
    const samples = Array.from({ length: 101 }, (_, i) => i * timeline.duration() / 100);
    for (const time of [...samples, ...samples.toReversed()]) {
      timeline.time(time);
      assert.ok(Math.abs(track.scaleX - time / timeline.duration()) < .0001, "Bar uses exactly the screen timeline progress, forward and reverse");
      const coverage = screens.reduce((sum, screen) => sum + screen.autoAlpha * Math.max(0, 1 - Math.abs(screen.xPercent) / 100), 0);
      assert.ok(Math.abs(coverage - 1) < .0001, 'Sliding screens cover the phone without gaps or overlap, forward and reverse');
      if (time === timeline.duration()) { assert.equal(last.autoAlpha, 1); assert.equal(last.xPercent, 0); assert.equal(a.xPercent, -100); }
      if (time === 0) { assert.equal(a.autoAlpha, 1); assert.equal(a.xPercent, 0); }
    }
    timeline.progress(1).invalidate().progress(0);
    assert.equal(a.autoAlpha, 1, 'Refresh/reverse uses explicit start values');
    assert.equal(a.xPercent, 0, 'Refresh restores the first screen inside the phone');
    assert.equal(track.scaleX, 0, 'Bar rewinds to zero after refresh');
    context.revert();
  }

  function harness({ reduced = false, desktop = true, missing = false, hash = '' } = {}) {
    const events = {}, prefs = {}, body = { dataset: {} }, button = { disabled: true, textContent: 'Sin efectos', attrs: {}, setAttribute(k,v) { this.attrs[k] = v; }, addEventListener(k,v) { events[k] = v; } };
    const element = { getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [{}, {}, {}, {}] };
    const counter = {}, triggers = [], state = { builds: 0, reverted: 0, intros: 0 };
    const chain = { labels: {}, addLabel(name, time) { this.labels[name] = time; return this; }, duration() { return 4; }, set() { return this; }, to() { return this; }, from() { return this; }, fromTo() { return this; } };
    const fakeGsap = { registerPlugin() {}, set() {}, from() {}, to() {}, timeline(config) { if (config?.defaults) state.intros++; return chain; }, context(fn) { state.builds++; fn(); return { revert() { state.reverted++; } }; } };
    const films = [false, true].map(portrait => ({ paused: false, pauses: 0, classList: { contains: () => portrait }, pause() { this.paused = true; this.pauses++; } }));
    const document = { body, hidden: false, addEventListener: (event, callback) => { events[event] = callback; }, getElementById: () => button, querySelector: s => s === '.app-screen-count' ? counter : element, querySelectorAll: s => s === '.app-feature' ? [element, element, element] : s === '[data-reading]' ? [element] : s === '.app-film-video' ? films : [], fonts: { ready: Promise.resolve() } };
    const window = { document, gsap: missing ? undefined : fakeGsap, ScrollTrigger: { create(v) { triggers.push(v); }, refresh() {} }, matchMedia(q) { const key = q.includes('reduced') ? 'reduced' : q === '(max-width: 600px)' ? 'film' : 'desktop'; return prefs[key] = { matches: key === 'reduced' ? reduced : key === 'film' ? !desktop : desktop, addEventListener(k,v) { this.change = v; } }; }, scrollY: 0, location: { hash }, scrollBy() {}, addEventListener() {} };
    vm.runInNewContext(source, { window, globalThis: window });
    return { events, prefs, body, button, state, triggers, counter, document, films };
  }
  const h = harness();
  assert.equal(h.triggers.length, 1, 'Only one ScrollTrigger owns both screens and bar');
  assert.equal(h.triggers[0].start, 'top 20%');
  assert.equal(h.triggers[0].end, 'bottom bottom');
  for (const [progress, current] of [[0,'01'],[.2499,'01'],[.25,'02'],[.4999,'02'],[.5,'03'],[.7499,'03'],[.75,'04'],[1,'04'],[.7499,'03'],[.4999,'02'],[.2499,'01'],[0,'01']]) {
    h.triggers[0].onUpdate({ progress });
    assert.equal(h.counter.textContent, current + ' — 04', 'Counter follows the actual screen transition labels');
  }
  assert.ok(css.includes('transform:scaleX(0)') && !css.includes('scaleX(.3333)'));
  const access = html.match(/<section class="app-access"[\s\S]*?<\/section>/)[0];
  assert.equal((access.match(/<svg/g) || []).length, 2, 'Only store icons remain in access section');
  assert.ok(access.includes('store-icon-appstore') && access.includes('store-icon-googleplay'));
  const appFooter = html.match(/<footer>[\s\S]*?<\/footer>/)[0]
    .replace('href="index.html#inicio" aria-label="EXOM, volver al inicio"', 'href="#inicio" aria-label="EXOM, volver al inicio"');
  assert.equal(appFooter, fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<footer>[\s\S]*?<\/footer>/)[0], 'Shared footer markup, with only contextual home link adapted');
  assert.equal(h.body.dataset.appMotion, 'on'); assert.equal(h.button.disabled, false); assert.equal(h.state.intros, 1);
  h.events.click(); assert.equal(h.body.dataset.appMotion, 'off'); assert.equal(h.state.reverted, 1); assert.equal(h.button.attrs['aria-pressed'], 'true');
  h.events.click(); assert.equal(h.body.dataset.appMotion, 'on'); assert.equal(h.state.intros, 1, 'No replay after pause');
  h.prefs.reduced.matches = true; h.prefs.reduced.change();
  assert.equal(h.body.dataset.appMotion, 'off'); assert.equal(h.button.disabled, true);
  h.prefs.reduced.matches = false; h.prefs.reduced.change();
  assert.equal(h.body.dataset.appMotion, 'on');
  h.prefs.desktop.matches = false; h.prefs.desktop.change();
  assert.equal(h.state.intros, 1, 'No replay after breakpoint change');
  assert.equal(harness({ reduced: true }).state.builds, 0);
  assert.equal(harness({ missing: true }).button.disabled, true, 'Readable static fallback when GSAP is missing');
  assert.equal(harness({ hash: '#evolucion' }).state.intros, 0, 'Direct links bypass opening');
  assert.equal(harness({ desktop: false }).triggers.length, 0, 'Mobile uses native stacked reading, no sticky screen-switcher');
  for (const missing of [false, true]) {
    const video = harness({ missing });
    assert.ok(video.films.every(film => film.pauses === 0), 'Manual playback is untouched on load');
    video.prefs.film.matches = true; video.prefs.film.change();
    assert.equal(video.films[0].pauses, 1); assert.equal(video.films[1].pauses, 0);
    video.prefs.film.matches = false; video.prefs.film.change();
    assert.equal(video.films[1].pauses, 1, 'Hidden portrait playback stops on layout changes');
    video.document.hidden = true; video.events.visibilitychange();
    assert.ok(video.films.every(film => film.pauses === 2));
    video.document.hidden = false; video.events.visibilitychange();
    assert.ok(video.films.every(film => film.pauses === 2), 'Returning to the tab never autoplays');
  }

  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/prototype-v4/`;
    for (const file of ['app.html', 'app-page.css', 'app-page.js']) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200); assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
    const image = await fetch(new URL('../assets/media/images/Captura%20App%20Entreno.jpeg', base));
    assert.equal(image.status, 200);
    assert.equal((await fetch(base + 'app.html', { method: 'POST' })).status, 405);
    for (const shape of ['16x9', '9x16']) {
      const response = await fetch(base + 'assets/app-film/exom-launch-' + shape + '.mp4', { headers: { Range: 'bytes=0-31' } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-type'), 'video/mp4');
      assert.equal((await response.arrayBuffer()).byteLength, 32);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: app assets/anchors, responsive manual MP4 film, background pause, isolation, LF, GSAP reverse/refresh, reduced motion and HTTP ranges.');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
