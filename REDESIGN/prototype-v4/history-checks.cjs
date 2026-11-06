'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { gsap } = require('./assets/vendor/gsap.min.js');
const { createJourneyTimeline, createPresentIntro, chapterAt, chapterProgress, duration, starts, archiveRange, archiveProgress, cameraAt, path: cameraPath } = require('./history.js');
const html = fs.readFileSync(path.join(__dirname, 'historia.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'history.css'), 'utf8');
assert.equal(duration, starts.at(-1) + .29, 'Journey ends with the final text reveal');
assert.ok(css.includes(`height:calc(100svh + 1450svh * ${duration} / 14.1)`), 'Scroll distance preserves the original animation pace');
assert.equal((html.match(/class="memory memory-/g) || []).length, 9);
assert.equal((html.match(/class="journey-stage"/g) || []).length, 1);
assert.equal((html.match(/role="progressbar"/g) || []).length, 1);
const tatamiMarkup = html.split('id="taekwondo"')[1].split('</section>')[0];
const schoolMarkup = html.split('id="escuela"')[1].split('</section>')[0];
const chapterIds = [...html.matchAll(/<section class="memory memory-[^"]+" id="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(chapterIds, ['presente', 'origen', 'escuela', 'taekwondo', 'lesion', 'reconstruir', 'entender', 'exom', 'tu-camino'], 'The actual chronology places school before tatami in animated and static reading order');
const stopsMarkup = html.split('class="journey-stops"')[1].split('</div>')[0];
assert.deepEqual([...stopsMarkup.matchAll(/href="#([^"]+)"/g)].map(match => match[1]), ['presente', 'origen', 'escuela', 'taekwondo', 'lesion', 'reconstruir', 'entender', 'recuerdos', 'exom', 'tu-camino'], 'Navigation follows the same chronology');
assert.equal((tatamiMarkup.match(/<figure /g) || []).length, 3);
assert.equal((schoolMarkup.match(/<figure /g) || []).length, 2);
const medalsTag = tatamiMarkup.match(/<figure[^>]+>\s*<img src="assets\/history\/medals.webp"/)[0];
assert.ok(medalsTag.includes('data-x="0.39"') && medalsTag.includes('data-mobile-x="0.34"'), 'Medals stay right on mobile without changing desktop placement');
assert.ok(css.includes('.memory-copy::before') && css.includes('inset:-24px -20px -16px'), 'Mobile contrast is bounded to the text area');
assert.ok(!css.includes('.memory-space::after'), 'No mobile-wide scrim over the photographs');
assert.ok(css.includes('.memory .journey-photo::after { background:none; }'), 'Mobile overrides the more specific desktop photograph gradients');
assert.ok(tatamiMarkup.includes('referee.webp') && !tatamiMarkup.includes('young-competition.webp'));
assert.ok(schoolMarkup.includes('young-competition.webp') && !schoolMarkup.includes('coaching.webp'));
assert.ok(css.includes('.photo-referee { width:28%; aspect-ratio:4 / 3; }'));
assert.ok(css.includes('.photo-school-competition { aspect-ratio:4 / 5; }'));
for (const markup of [tatamiMarkup, schoolMarkup]) {
  assert.match(markup, /class="journey-photo photo-small photo-[^"]+"[^>]*data-z="40"/, 'Supporting photos stay in front of the wide image on mobile');
}
assert.ok(!/history-chapter|chapter-scene|history-intro/.test(html + css), 'Old stacked layout is removed');
assert.ok(!html.includes('placeholder'));
assert.ok(html.includes('childhood-tkd.webp') && html.includes('early-school.webp') && html.includes('rehab-standing.webp') && html.includes('studying.webp'));
assert.equal((html.match(/class="archive-photo"/g)||[]).length,15);
const archiveSources = [...html.matchAll(/class="archive-photo"><img src="([^"]+)"/g)].map(match => match[1]);
assert.equal(archiveSources[0], 'assets/history/childhood-tkd.webp');
assert.equal(archiveSources.at(-1), 'assets/history-present/pose.webp', 'Present-day physique closes the memory archive');
assert.deepEqual(archiveSources.slice(3, 8), ['early-school', 'young-competition', 'referee', 'competition', 'medals'].map(name => `assets/history/${name}.webp`), 'School memories precede tatami memories; the approved referee photo replaces coaching in the same slot');
assert.ok(!css.includes('radial-gradient')); 
const presentMarkup = html.split('id="presente"')[1].split('</section>')[0];
assert.equal((presentMarkup.match(/<video /g)||[]).length,3);
const mainPoster = presentMarkup.match(/<video id="history-pose"[^>]*poster="([^"]+)"/)[1];
assert.ok(html.includes(`<link rel="preload" href="${mainPoster}" as="image" fetchpriority="high">`), 'Prioritize the existing main poster before video and archive downloads');
const historyImages = html.match(/<img\b[^>]*src="assets\/history[^>]*>/g);
assert.ok(historyImages.length > 0 && historyImages.every(tag => tag.includes('fetchpriority="low"')), 'Later chapter images must not compete with the present poster');
for(const i of [1,2,3]) assert.ok(presentMarkup.includes(`assets/history-present/pose-${i}.mp4`));
assert.ok(!html.includes('assets/history-present/pose.mp4'), 'Three simultaneous clips replace the sequential montage');
assert.ok([1,2,3].reduce((bytes,i)=>bytes+fs.statSync(path.join(__dirname,`assets/history-present/pose-${i}.mp4`)).size,0)<2100000,'Three clips retain the original download budget');
assert.ok(html.split('id="tu-camino"')[1].split('</section>')[0].includes('src="assets/history/planning.webp"'), 'Client-facing work closes the story');
const rebuildMarkup = html.split('id="reconstruir"')[1].split('</section>')[0];
const exomMarkup = html.split('id="exom"')[1].split('</section>')[0];
assert.ok(rebuildMarkup.includes('rehab-standing.webp') && rebuildMarkup.includes('rehab-floor.webp') && rebuildMarkup.includes('rehab-school.webp')); 
assert.ok(exomMarkup.includes('creating.webp') && exomMarkup.includes('call-jose.webp') && exomMarkup.includes('call-miguel-private.webp') && !exomMarkup.includes('planning.webp'));
assert.ok(!html.includes('../assets/media/images/'), 'Only reviewed derivatives, never original client screens, enter the page');
assert.ok(!/Llamada|Dieta|WhatsApp Image/.test(html));
assert.ok(!fs.readFileSync(path.join(__dirname, 'build-history-media.cjs'), 'utf8').includes("'-blur'"), 'Blank templates are not obscured');
assert.ok(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('href="historia.html"'));
assert.ok(html.includes('noindex, nofollow'));
for (const match of html.matchAll(/(?:src|href|srcset|poster)="([^"]+)"/g)) {
  if (/^https:/.test(match[1])) {
    assert.ok(['https://github.com/carsan-dev', 'https://csroman-dev.vercel.app/'].includes(match[1]), 'Only shared footer credits may be external');
    assert.ok(match[0].startsWith('href='), 'No external assets');
    continue;
  }
  const [file, anchor] = match[1].split('#');
  const target = file ? path.resolve(__dirname, file) : path.join(__dirname, 'historia.html');
  assert.ok(fs.existsSync(target), 'Local asset exists: ' + match[1]);
  if (anchor) assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${anchor}"`));
}
for (const tag of html.matchAll(/<img\b[^>]+>/g)) assert.ok(/alt="[^"]*"/.test(tag[0]));
const hashes = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/history/sources.json')));
for (const [name, hash] of Object.entries(hashes)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../assets/media/images', name))).digest('hex'), hash);
}
const videoSource = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/history-present/source.json')));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../assets/media/videos', videoSource.source))).digest('hex'), videoSource.sha256);
assert.deepEqual(videoSource.segments,[1,6,11]);
assert.equal(videoSource.duration,7.8);
assert.equal(videoSource.width, 720); assert.equal(videoSource.height, 1280);
assert.ok(fs.statSync(path.join(__dirname, 'assets/history-present/pose.mp4')).size < 6000000, 'High quality opening stays below 6MB');
const images = fs.readdirSync(path.join(__dirname, 'assets/history')).filter(name => name.endsWith('.webp'));
assert.ok(images.reduce((size, name) => size + fs.statSync(path.join(__dirname, 'assets/history', name)).size, 0) < 3500000);
for (const name of ['historia.html', 'history.css', 'history.js', 'history-checks.cjs']) assert.ok(!fs.readFileSync(path.join(__dirname, name)).includes(13));

const target = () => ({ x: 0, y: 0, z: 0, opacity: 1, autoAlpha: 1, scale: 1, xPercent: 0, yPercent: 0, force3D: true, clipPath: 'none' });
const opening = { lines: [target(), target()], note: target() }, openingLink = target();
let openingTimeline;
const openingContext = gsap.context(() => { openingTimeline = createPresentIntro(gsap, opening, openingLink); });
openingTimeline.time(.01);
assert.notEqual(opening.lines[0].clipPath, 'inset(0% 0% 0% 0%)');
openingTimeline.time(.3);
assert.notEqual(opening.lines[0].clipPath, opening.lines[1].clipPath, 'Opening lines reveal in sequence without scrolling');
openingTimeline.progress(1);
assert.ok(opening.lines.every(line => line.clipPath === 'inset(0% 0% 0% 0%)'));
assert.equal(opening.note.opacity, 1); assert.equal(openingLink.opacity, 1);
openingContext.revert();
for (const [width,height] of [[1440,900],[390,844]]) {
  const memories=cameraPath.map(()=>({space:target(),camera:target(),photos:[Object.assign(target(),{dataset:{x:'.12',y:'0',z:'0'}})],copy:target(),lines:[target(),target()],note:target()}));
  const archive=target(),tiles=Array.from({length:15},target),caption=target(),atmosphere=Array.from({length:3},target);
  let timeline;const context=gsap.context(()=>{timeline=createJourneyTimeline(gsap,memories,width,height,()=>{},{archive,tiles,caption,atmosphere});});
  assert.equal(timeline.duration(),duration);
  for(let pass=0;pass<3;pass++) {
    for(const [i,start]of starts.entries()) {
      timeline.time(start+.28);
      assert.equal(memories[i].copy.opacity,1,'Chapter text readable');
      assert.equal(memories[i].space.autoAlpha,1,'Photographs visible');
      assert.equal(chapterAt(chapterProgress(i)),i);
      const camera=cameraAt(start,width,height);
      assert.ok(Math.abs(camera.x+cameraPath[i][0]*width)<.001);
      assert.ok(Math.abs(camera.z-i*1200)<.001);
    }
    timeline.progress(archiveProgress);
    assert.equal(archive.autoAlpha,1);assert.equal(archive.scale,1);
    assert.ok(tiles.every(tile=>tile.opacity===1));assert.equal(caption.opacity,1);
    assert.equal(memories[6].copy.opacity,0);assert.equal(memories[7].copy.opacity,0,'Archive precedes EXOM');
    timeline.time(duration - .01);
    assert.ok(memories[8].note.opacity < 1, 'Closing text is still assembling just before the end');
    timeline.progress(1);assert.equal(memories[8].copy.opacity,1);assert.equal(archive.autoAlpha,0);
    assert.equal(memories[8].note.opacity,1);
    assert.ok(Math.abs(atmosphere[2].scale - (1.08 - .08 * (duration - 8.25) / (14.1 - 8.25))) < .00001, 'Backdrop is trimmed, not accelerated');
    assert.ok(memories[8].lines.every(line => line.clipPath === 'inset(0% 0% 0% 0%)'));
    timeline.progress(0);assert.equal(memories[0].copy.opacity,1);assert.equal(archive.autoAlpha,0);
    for(const memory of memories.slice(1))assert.equal(memory.space.autoAlpha,0,'Reverse leaves no future planes');
  }
  // Match left and right velocities at every waypoint, not just its position.
  for(const t of starts.slice(1,-1))for(const axis of ['x','y','z']) {
    const e=.0001,a=cameraAt(t-e,width,height)[axis],b=cameraAt(t,width,height)[axis],c=cameraAt(t+e,width,height)[axis];
    assert.ok(Math.abs((b-a)/e-(c-b)/e)<2,'Continuous velocity: '+axis);
  }
  context.revert();memories.forEach(m=>assert.equal(m.copy.opacity,1));
}
assert.equal(chapterAt(-1),0);assert.equal(chapterAt(1),8);
const vm = require('node:vm');
function browserHarness({ reduced = false, small = false, available = true, hash = '' } = {}) {
  const events = {}, media = [], triggers = [], plays = [], travels = [];
  let visibleIndex = 0;
  const node = () => Object.assign(target(), { style: {}, dataset: {}, addEventListener(name, fn) { this[name] = fn; }, setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; } });
  const sections = cameraPath.map((_, i) => {
    const space = node(), camera = node(), photos = [Object.assign(node(), { dataset: { x: '0', y: '0', z: '0' } })], copy = node(), lines = [node(), node()], note = node();
    return Object.assign(node(), { id: 'memory-' + i, dataset: { label: 'Stage ' + i }, camera, photos, copy, lines,
      querySelector: key => ({ '.memory-space': space, '.memory-camera': camera, '.memory-copy': copy, '.memory-copy > p': note })[key],
      querySelectorAll: key => key === '.journey-photo' ? photos : lines,
      getBoundingClientRect: () => ({ bottom: i < visibleIndex ? 108 : 500 }),
      scrollIntoView: () => { visibleIndex = i; events.staticIndex = i; }
    });
  });
  const links = sections.map((_, i) => Object.assign(node(), { getAttribute: () => '#memory-' + i }));
  links.splice(7, 0, Object.assign(node(), { getAttribute: () => '#recuerdos' }));
  const selectors = Object.fromEntries(['#history-motion', '.history-journey', '.journey-stage', '.journey-track', '.journey-progress', '#journey-current', '#journey-percent', '#history-pose', '#pose-retry', '.journey-start'].map(key => [key, node()]));
  Object.assign(selectors['.journey-stage'], { clientWidth: 1280, clientHeight: 800 });
  selectors['.memory-archive'] = Object.assign(node(), { scrollIntoView: () => { events.staticIndex = 'recuerdos'; } });
  selectors['.archive-caption'] = node();
  const videos = [selectors['#history-pose'],node(),node()], video = videos[0];
  videos.forEach(video => Object.assign(video, { paused: true, pause() { this.paused = true; }, play() { this.paused = false; return new Promise((resolve, reject) => plays.push({ resolve, reject })); } }));
  const document = { body: { dataset: {} }, hidden: false, fonts: { ready: { then() {} } },
    querySelector: key => selectors[key], querySelectorAll: key => key === '.memory' ? sections : key === '#presente video' ? videos : key.includes('journey-') ? links : key === '.archive-photo' ? Array.from({length:15},node) : [],
    addEventListener: (name, fn) => { events[name] = fn; }
  };
  const ScrollTrigger = { refresh() {}, create(spec) { const t = { ...spec, start: 0, end: 8000, kill() { spec.animation.progress(0); } }; triggers.push(t); spec.animation.progress(.01); return t; } };
  const motion = { ...gsap, to(...args) { const tween = gsap.to(...args); travels.push(tween); return tween; } };
  const window = { document, innerHeight: 800, scrollY: 0, gsap: available ? motion : undefined, ScrollTrigger: available ? ScrollTrigger : undefined,
    location: { hash, pathname: '/historia.html', search: '' }, scrollTo: value => { events.scroll = value; window.scrollY = value.top; },
    matchMedia: query => { const m = { matches: query.includes('reduced') ? reduced : small, addEventListener: (_, fn) => { m.change = fn; } }; media.push(m); return m; },
    addEventListener: (name, fn) => { events[name] = fn; }
  };
  const originalRegister = gsap.registerPlugin;
  gsap.registerPlugin = () => {};
  try {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'history.js'), 'utf8'), { window, document, history: { replaceState() {} }, setTimeout: fn => { events.resize = fn; }, clearTimeout() {} });
  } finally { gsap.registerPlugin = originalRegister; }
  return { events, media, triggers, plays, document, sections, selectors, video, videos, links, travels };
}
for (const options of [{ reduced: true }, { small: true }, { available: false }]) {
  const h = browserHarness(options);
  assert.equal(h.document.body.dataset.historyMotion, 'off');
  assert.equal(h.triggers.length, 0); assert.ok(h.videos.every(video => video.paused));
  assert.ok(h.sections.every(section => !section.inert && !section['aria-hidden']));
}
const navigation = browserHarness();
assert.equal(navigation.plays.length,3,'All poses start together');
navigation.links.forEach((link,index)=>assert.equal(link.style.left,(index===7?archiveProgress:chapterProgress(index>7?index-1:index))*100+'%','Stop aligns with its real destination'));
assert.ok(html.includes('<a href="#entender">Entender</a><a href="#recuerdos">Recuerdos</a><a href="#exom">EXOM</a>'));
assert.ok(html.indexOf('id="recuerdos"') < html.indexOf('id="exom"'), 'Static archive precedes EXOM too');
assert.ok(css.includes('.journey-stops a { position:absolute;'));
assert.ok(html.includes('photo-recognition') && css.includes('.photo-recognition { width:30%;'));

navigation.links[1].click({ preventDefault() {} });
const trip = navigation.travels[0];
assert.equal(trip.duration(), 1.8);
assert.ok(!navigation.events.scroll || navigation.events.scroll.top < 1, 'Click does not jump to the destination');
trip.progress(.5);
assert.ok(navigation.events.scroll.top > 0 && navigation.events.scroll.top < chapterProgress(1) * 8000, 'Journey passes through intermediate scroll positions');
trip.progress(1);
assert.ok(Math.abs(navigation.events.scroll.top - chapterProgress(1) * 8000) < .001);
for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
  navigation.links[0].click({ preventDefault() {} });
  const interrupted = navigation.travels.at(-1);
  navigation.events[event]();
  assert.equal(interrupted.parent, null, event + ' yields control back to the visitor');
}
navigation.links[1].click({ preventDefault() {} });
navigation.selectors['#history-motion'].click();
assert.equal(navigation.travels.at(-1).parent, null, 'Pause cancels navigation');
assert.equal(navigation.sections[0].lines[0].clipPath, 'none', 'Static fallback never leaves the opening masked');
const resized = browserHarness();
resized.triggers[0].animation.progress(chapterProgress(5));
resized.selectors['.journey-stage'].clientWidth = 390;
resized.triggers[0].animation.progress(.2);
resized.events.resize(); resized.events.resize();
assert.equal(resized.events.scroll.top, chapterProgress(5)*8000, 'Resize retains the previous chapter despite refresh progress');
assert.equal(chapterProgress(8),1,'Last navigation target reaches the actual end');
const runtime = browserHarness();
runtime.triggers[0].animation.progress(chapterProgress(3));
assert.equal(runtime.selectors['.journey-track']['aria-valuenow'], String(Math.round(chapterProgress(3) * 100)));
assert.equal(runtime.sections[3].inert, false);
assert.ok(runtime.sections.filter((_, i) => i !== 3).every(section => section.inert));
assert.ok(runtime.videos.every(video => video.paused), 'All poses pause outside their memory');
runtime.selectors['#history-motion'].click();
assert.equal(runtime.events.staticIndex, 3, 'Pause retains the active memory');
assert.ok(runtime.sections.every(section => !section.inert && !section['aria-hidden']));
runtime.selectors['#history-motion'].click();
assert.equal(runtime.events.scroll.top, chapterProgress(3) * 8000, 'Resume survives refresh callbacks resetting progress');
runtime.media[0].matches = true; runtime.media[0].change();
assert.equal(runtime.document.body.dataset.historyMotion, 'off');
assert.ok(runtime.video.paused);
const archiveNavigation = browserHarness();
const archiveDeepLink = browserHarness({hash:'#recuerdos'});
archiveDeepLink.events.load();
assert.equal(archiveDeepLink.events.scroll.top, archiveProgress * 8000, 'Direct archive link lands on the complete mosaic');
archiveNavigation.links[7].click({ preventDefault() {} });
archiveNavigation.travels.at(-1).progress(1);
assert.ok(Math.abs(archiveNavigation.events.scroll.top - archiveProgress * 8000) < .001);
archiveNavigation.triggers[0].animation.progress(archiveProgress);
assert.equal(archiveNavigation.links[7]['aria-current'], 'step');
assert.equal(archiveNavigation.selectors['.memory-archive']['aria-hidden'], 'false');
assert.ok(archiveNavigation.sections.every(section => section.inert));
archiveNavigation.selectors['#history-motion'].click();
assert.equal(archiveNavigation.events.staticIndex, 'recuerdos');
archiveNavigation.selectors['#history-motion'].click();
assert.equal(archiveNavigation.events.scroll.top, archiveProgress * 8000);
archiveNavigation.triggers.at(-1).animation.progress(chapterProgress(7));
assert.equal(archiveNavigation.links[8]['aria-current'], 'step', 'EXOM destination remains unchanged');
assert.equal(archiveNavigation.links[7]['aria-current'], undefined);
assert.equal(archiveNavigation.selectors['.memory-archive']['aria-hidden'], 'true');
// A late accepted play cannot restart video after reducing motion.
runtime.plays[0].resolve();
Promise.resolve().then(() => assert.ok(runtime.video.paused));
(async () => {
  const h = browserHarness();
  h.plays[1].reject(new Error('Playback blocked'));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.videos.every(video => video.paused));
  assert.equal(h.selectors['#pose-retry'].hidden,false);
  h.selectors['#pose-retry'].click();
  assert.equal(h.plays.length,6,'Retry restarts all three poses');
  h.document.hidden=true; h.events.visibilitychange();
  h.plays.forEach(play=>play.resolve());
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.videos.every(video => video.paused),'Late play promises cannot resume any hidden video');
  console.log('PASS: three-pose playback, group failure/retry, hidden tab and late promises.');
})().catch(error=>{console.error(error);process.exitCode=1;});
console.log('PASS: single fullscreen journey, posing opening, assets/originals, 3D camera path, text reveal, overlap, reversal, ending and static restoration.');
