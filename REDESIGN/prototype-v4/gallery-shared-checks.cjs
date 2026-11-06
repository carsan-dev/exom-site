'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'gallery-shared.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  const created = [], observers = [], registered = new Set(), timers = new Map(), ticks = new Set(), resolutions = [];
  let timerId = 0;
  function element() {
    const events = new Map();
    return { dataset: {}, children: [], events, attributes: {}, offsetLeft: 0, offsetTop: 0,
      append(v) { this.children.push(v); v.parentElement = this; }, remove() { this.removed = true; }, setAttribute(k, v) { this.attributes[k] = v; },
      addEventListener(k, f) { if (!events.has(k)) events.set(k, new Set()); events.get(k).add(f); },
      removeEventListener(k, f) { events.get(k)?.delete(f); },
      emit(k) { [...(events.get(k) || [])].forEach(f => f()); }
    };
  }
  function video(src = '') {
    const classes = new Set();
    return Object.assign(element(), { dataset: { src }, src, srcObject: null, isConnected: true, paused: true, requests: [], loadGeneration: 0,
      readyState: 0, videoWidth: 180, videoHeight: 320, frames: new Map(), frameId: 0,
      requestVideoFrameCallback: options.noFrames ? undefined : function (fn) { this.frames.set(++this.frameId, fn); return this.frameId; },
      cancelVideoFrameCallback(id) { this.frames.delete(id); },
      classList: { add: k => classes.add(k), remove: k => classes.delete(k) }, classes,
      getAttribute() { return this.src; }, removeAttribute() { this.src = ''; },
      pause() { this.paused = true; }, load() { this.loadGeneration++; },
      play() {
        const loadGeneration = this.loadGeneration;
        return new Promise((resolve, reject) => this.requests.push({ reject, resolve: () => {
          if (loadGeneration === this.loadGeneration) { this.paused = false; this.emit('playing'); }
          resolve();
        } }));
      }
    });
  }
  class Observer {
    constructor(cb, options) { this.cb = cb; this.options = options; this.targets = new Set(); observers.push(this); }
    observe(v) { this.targets.add(v); } unobserve(v) { this.targets.delete(v); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  }
  const clips = Array.from({ length: 18 }, (_, i) => video('/clip-' + i % 6 + '.mp4'));
  clips.forEach(v => registered.add(v));
  const ribbons = [element(), element()].map(r => Object.assign(r, { clientWidth: 1600, clientHeight: 320 }));
  const tracks = ribbons.map(r => Object.assign(element(), { parentElement: r, offsetParent: r, offsetLeft: -120, x: 0 }));
  function attach(v, index) {
    const track = tracks[index % 2];
    v.parentElement = Object.assign(element(), { offsetParent: track, offsetLeft: Math.floor(index / 2) * 190, offsetWidth: 180, offsetHeight: 320 });
    v.track = track;
  }
  clips.forEach(attach);
  tracks.forEach(track => { track.querySelectorAll = () => clips.filter(v => v.isConnected && v.track === track); });
  const gallery = Object.assign(element(), { querySelectorAll: () => clips.filter(v => v.isConnected) });
  const body = element(); body.dataset.motion = options.motion || 'on';
  const document = Object.assign(element(), { body, hidden: false,
    querySelector: () => options.noGallery ? null : gallery, querySelectorAll: () => tracks,
    createElement(tag) {
      const v = tag === 'video' ? video() : element(); v.tag = tag; created.push(v);
      if (tag === 'canvas') {
        v.ctx = { draws: [], clears: 0, setTransform(...args) { this.transform = args; }, clearRect() { this.clears++; },
          drawImage(...args) { if (options.drawThrows) throw Error('Draw failed'); this.draws.push(args); } };
        v.getContext = () => options.noContext || (options.secondContextFails && created.filter(e => e.tag === 'canvas').length === 2) ? null : v.ctx;
      }
      return v;
    }
  });
  const media = Object.assign(element(), { matches: !!options.mobile });
  const reduced = Object.assign(element(), { matches: !!options.reduced });
  const context = { document, navigator: { userAgent: options.userAgent || 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36' },
    window: { devicePixelRatio: 1, gsap: options.unsupported ? undefined : { ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) }, getProperty: track => track.x },
      matchMedia(query) {
        if (query === '(max-width: 760px), (pointer: coarse)') return media;
        if (query === '(prefers-reduced-motion: reduce)') return reduced;
        assert.match(query, /^\(resolution: /);
        const r = element(); resolutions.push(r); return r;
      }, ExomGallery: {
      register(v) { registered.add(v); }, unregister(v) { registered.delete(v); v.pause(); v.removeAttribute('src'); v.load(); }, sync() {}
    } }, IntersectionObserver: Observer, MutationObserver: Observer, ResizeObserver: Observer,
    setTimeout(fn, delay) { assert.equal(delay, 120); timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  runInNewContext(options.code || code, context);
  const fire = (target, entries = []) => observers.filter(o => !o.disconnected && o.targets.has(target)).forEach(o => o.cb(entries));
  const sources = () => created.filter(v => v.tag === 'video' && v.src !== undefined);
  function visible(value, subset = clips.filter(v => v.isConnected)) {
    observers.filter(o => !o.disconnected && subset.some(v => o.targets.has(v))).forEach(o => o.cb(subset.map(target => ({ target, isIntersecting: value, intersectionRatio: value ? 1 : 0 }))));
  }
  async function resolve(videos = [...sources(), ...clips]) {
    for (const v of videos) { const pending = v.requests.splice(0); pending.forEach(r => r.resolve()); }
    await settle();
  }
  const canvases = () => created.filter(v => v.tag === 'canvas' && !v.removed && v.parentElement);
  return { created, observers, registered, clips, gallery, body, document, media, tracks, ribbons, video, attach, sources, visible, resolve, ticks, canvases, controller: context.window.ExomGallery,
    tick() { [...ticks].forEach(fn => fn()); },
    frame() { sources().forEach(v => { const callbacks = [...v.frames.values()]; v.frames.clear(); callbacks.forEach(fn => fn()); }); },
    reduced(v) { reduced.matches = v; reduced.emit('change'); },
    dpr(v) { context.window.devicePixelRatio = v; resolutions.at(-1).emit('change'); },
    resize() { fire(ribbons[0]); },
    listeners() { return [...resolutions, reduced, document].reduce((n, el) => n + [...el.events.values()].reduce((s, fs) => s + fs.size, 0), 0); },
    mobile(v) { media.matches = v; media.emit('change'); },
    motion(v) { body.dataset.motion = v; fire(body); },
    hidden(v) { document.hidden = v; document.emit('visibilitychange'); },
    near(v) { fire(gallery, [{ target: gallery, isIntersecting: v }]); },
    warm() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    timers,
    inventory() { fire(tracks[0]); },
    ready() { sources().filter(v => v.src).forEach(v => { v.readyState = 4; v.emit('loadeddata'); }); },
    activeObservers: () => observers.filter(o => !o.disconnected).length
  };
}

module.exports = async function checkSharedGallery() {
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0'
  ]) {
    const h = harness({ userAgent });
    assert.equal(h.gallery.dataset.renderer, 'native', 'Gecko keeps the existing native controller');
    h.visible(true); h.near(true); h.mobile(true); h.mobile(false);
    assert.equal(h.created.length, 0, 'Gecko never creates a source pool or canvas, even after resizing');
    assert.equal(h.registered.size, 18);
    assert.equal(h.activeObservers(), 0); assert.equal(h.ticks.size, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.controller.draw, undefined);
    assert.ok(h.clips.every(v => v.src === v.dataset.src && !v.srcObject), 'Native registrations and media are untouched');
  }
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
  ]) {
    const h = harness({ userAgent });
    assert.equal(h.gallery.dataset.renderer, 'canvas-2d', 'The like Gecko compatibility token must not change other engines');
    assert.equal(h.canvases().length, 2); assert.equal(h.sources().length, 6);
    h.mobile(true); assert.equal(h.gallery.dataset.renderer, 'native'); assert.equal(h.canvases().length, 0);
    h.mobile(false); assert.equal(h.gallery.dataset.renderer, 'canvas-2d');
  }
  for (const options of [{ mobile: true }, { unsupported: true }, { noGallery: true }]) {
    const h = harness(options); assert.equal(h.created.length, 0); assert.equal(h.registered.size, 18);
  }
  const cold = harness(); cold.near(true);
  assert.ok(cold.sources().every(v => !v.src), 'The proximity callback does not start six decoders together');
  for (let i = 1; i <= 6; i++) {
    cold.warm(); cold.ready(); cold.near(true);
    assert.equal(cold.sources().filter(v => v.src).length, i, 'One preparation per scheduled turn, even after ready/observer events');
  }
  assert.ok(cold.sources().every(v => v.src && v.preload === 'auto' && v.loadGeneration === 1), 'Prepare six sources before entering the viewport');
  assert.ok(cold.sources().every(v => v.paused && v.requests.length === 0), 'Preload must not play offscreen sources');
  assert.equal(cold.observers.find(o => o.targets.has(cold.gallery)).options.rootMargin, '1200px 0px');
  cold.ready(); cold.near(true); cold.near(false);
  assert.ok(cold.sources().every(v => v.loadGeneration === 1), 'Near-boundary changes never reload media');
  assert.ok(cold.clips.every(v => !v.srcObject && v.paused));
  cold.visible(true); await cold.resolve();
  assert.ok(cold.clips.every(v => !v.srcObject && v.paused), 'Only the six sources play; copies are never video surfaces');
  cold.mobile(true); assert.equal(cold.activeObservers(), 0); assert.equal(cold.timers.size, 0);
  const pausedNear = harness({ motion: 'off' }); pausedNear.near(true);
  assert.ok(pausedNear.sources().every(v => !v.src));
  pausedNear.hidden(true); pausedNear.motion('on');
  assert.ok(pausedNear.sources().every(v => !v.src), 'Hidden tabs do not begin preloading');
  pausedNear.hidden(false);
  pausedNear.warm();
  assert.equal(pausedNear.sources().filter(v => v.src).length, 1);
  assert.ok(pausedNear.sources().every(v => v.paused));
  pausedNear.motion('off'); assert.equal(pausedNear.timers.size, 0);
  pausedNear.motion('on'); pausedNear.near(false); assert.equal(pausedNear.timers.size, 0);
  pausedNear.near(true); pausedNear.hidden(true); assert.equal(pausedNear.timers.size, 0);
  pausedNear.hidden(false); pausedNear.mobile(true); assert.equal(pausedNear.timers.size, 0);
  const rushed = harness(); rushed.near(true); rushed.warm(); rushed.visible(true);
  assert.ok(rushed.sources().every(v => v.src), 'Visible sources never wait for the speculative preparation queue');
  assert.equal(rushed.timers.size, 0);
  const h = harness();
  assert.equal(h.gallery.dataset.renderer, 'canvas-2d');
  assert.equal(h.sources().length, 6); assert.equal(h.registered.size, 0);
  assert.ok(h.sources().every(v => !v.src), 'Offscreen pool does not load files');
  assert.equal(h.canvases().length, 2, 'One canvas per ribbon');
  assert.ok(h.canvases().every(c => c.attributes['aria-hidden'] === 'true'));
  assert.equal(h.ticks.size, 0, 'No offscreen drawing loop');
  h.visible(true); h.visible(true);
  assert.ok(h.sources().every(v => v.requests.length === 1), 'Pending source plays are deduplicated');
  h.tick();
  assert.ok(h.canvases().every(c => c.ctx.draws.length === 0), 'Posters remain until a source has a frame');
  h.ready(); await h.resolve();
  h.tick();
  assert.ok(h.canvases().every(c => c.ctx.draws.length > 0));
  assert.ok(h.clips.every(v => !v.srcObject && !v.src && v.paused && !v.classes.has('is-playing')));
  const draws = () => h.canvases().reduce((sum, c) => sum + c.ctx.draws.length, 0);
  const originalDraws = draws(); h.tick(); assert.equal(draws(), originalDraws, 'No new x or video frame means no redraw');
  h.frame(); h.tick(); assert.ok(draws() > originalDraws);
  const canvas = h.canvases()[0], firstX = canvas.ctx.draws[0][1];
  h.tracks[0].x = 17; h.tick();
  assert.equal(canvas.ctx.draws.at(-9)[1], firstX + 17, 'Drawing uses the current GSAP transform in this tick');
  h.dpr(1.25); h.tick(); assert.equal(canvas.width, 2000); assert.equal(canvas.height, 400);
  h.dpr(1.5); h.tick(); assert.equal(canvas.width, 2400); assert.equal(canvas.height, 480);
  assert.equal(canvas.ctx.imageSmoothingQuality, 'high');
  h.ribbons[0].clientWidth = 1500; h.resize(); h.tick(); assert.equal(canvas.width, 2250);
  assert.ok(h.sources().every(v => v.frames.size === 1), 'Exactly one frame callback per source');
  const cancelledFrame = [...h.sources()[0].frames.values()][0];
  h.ready(); assert.equal(h.sources().length, 6);
  h.motion('off'); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  assert.ok(h.clips.every(v => !v.classes.has('is-playing')));
  assert.equal(h.ticks.size, 0); assert.ok(h.sources().every(v => v.frames.size === 0));
  cancelledFrame(); assert.ok(h.sources().every(v => v.frames.size === 0), 'A cancelled callback cannot restart the frame loop');
  const cleared = canvas.ctx.clears; h.tick(); assert.equal(canvas.ctx.clears, cleared);
  h.motion('on'); await h.resolve();
  h.hidden(true); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  assert.equal(h.ticks.size, 0);
  h.hidden(false); await h.resolve();
  h.reduced(true); assert.equal(h.ticks.size, 0); assert.ok(h.sources().every(v => v.paused));
  h.reduced(false); await h.resolve();
  h.visible(false); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  const clone = h.video('/clip-0.mp4'); h.attach(clone, 18); h.clips.push(clone); h.registered.add(clone); h.inventory();
  h.visible(true); await h.resolve(); assert.equal(h.sources().length, 6); assert.equal(h.registered.size, 0);
  assert.equal(clone.srcObject, null, 'New copies also remain native-free');
  clone.isConnected = false; h.inventory(); assert.equal(clone.srcObject, null); assert.ok(clone.paused);
  assert.ok(h.observers.every(o => !o.targets.has(clone)), 'Removed clones release observers');
  const oldError = [...h.sources()[0].events.get('error')][0];
  h.mobile(true);
  assert.equal(h.gallery.dataset.renderer, 'native'); assert.equal(h.registered.size, 18);
  assert.equal(h.activeObservers(), 0); assert.ok(h.clips.every(v => !v.srcObject));
  assert.equal(h.canvases().length, 0); assert.equal(h.ticks.size, 0); assert.equal(h.listeners(), 0);
  assert.equal(h.controller.draw, undefined, 'Native mode releases the timeline drawing hook');
  assert.ok(h.sources().every(v => !v.src && v.paused));
  h.mobile(false); oldError();
  assert.equal(h.gallery.dataset.renderer, 'canvas-2d', 'Retired errors cannot disable a new pool');
  h.visible(true); h.ready(); await h.resolve();
  for (let i = 0; i < 3; i++) { h.mobile(true); h.mobile(false); }
  h.mobile(true); assert.equal(h.activeObservers(), 0); assert.equal(h.registered.size, 18);
  assert.ok(h.created.filter(v => v.tag === 'div').every(v => v.removed));
  assert.equal(h.canvases().length, 0); assert.equal(h.ticks.size, 0); assert.equal(h.listeners(), 0);
  assert.ok(h.sources().every(v => v.frames.size === 0));

  const late = harness(); late.visible(true); late.ready();
  const cancelled = [...late.sources(), ...late.clips].flatMap(v => v.requests.splice(0));
  late.visible(false); late.visible(true);
  cancelled.forEach(r => r.reject(Error('Interrupted by pause'))); await settle();
  assert.equal(late.gallery.dataset.renderer, 'canvas-2d', 'An obsolete rejection cannot poison resumed playback');
  await late.resolve(); assert.ok(late.sources().every(v => !v.paused));
  late.visible(false); late.visible(true);
  const retired = [...late.sources(), ...late.clips].flatMap(v => v.requests.splice(0));
  late.mobile(true); late.mobile(false); late.visible(true); late.ready(); await late.resolve();
  retired.forEach(r => r.resolve()); await settle();
  assert.ok(late.sources().slice(6).every(v => !v.paused), 'Retired promises do not pause the new pool');
  assert.ok(late.sources().slice(0, 6).every(v => v.paused && !v.src), 'Retired sources cannot restart');

  // Stream-specific failure checks are replaced by the new canvas failure boundary.
  for (const options of [{ noContext: true }, { secondContextFails: true }, { drawThrows: true }]) {
    const f = harness(options); f.visible(true); f.ready(); await f.resolve();
    f.tick();
    assert.equal(f.gallery.dataset.renderer, 'native'); assert.equal(f.registered.size, 18);
    assert.equal(f.activeObservers(), 0); assert.ok(f.clips.every(v => !v.srcObject));
    assert.equal(f.canvases().length, 0); assert.equal(f.listeners(), 0);
  }
  for (const failure of ['source', 'play']) {
    const f = harness(); f.visible(true);
    f.ready();
    if (failure === 'source') f.sources()[0].emit('error');
    if (failure === 'play') f.sources()[0].requests.shift().reject(Error('Denied'));
    await f.resolve();
    assert.equal(f.gallery.dataset.renderer, 'native', failure + ' restores native playback');
    assert.equal(f.registered.size, 18); assert.equal(f.activeObservers(), 0);
    assert.equal(f.canvases().length, 0); assert.equal(f.ticks.size, 0);
    const count = f.created.length; f.mobile(true); f.mobile(false); assert.equal(f.created.length, count, 'Failures stay on native fallback');
  }
  const paused = harness({ motion: 'off' }); paused.visible(true);
  assert.ok(paused.sources().every(v => !v.src));
  paused.motion('on'); paused.ready(); await paused.resolve(); assert.ok(paused.sources().every(v => !v.paused));
  const fallback = harness({ noFrames: true }); fallback.visible(true); fallback.ready(); await fallback.resolve();
  fallback.tick(); const count = fallback.canvases()[0].ctx.draws.length; fallback.tick();
  assert.ok(fallback.canvases()[0].ctx.draws.length > count, 'Without rVFC, playing sources redraw on GSAP ticks');
  const reduced = harness({ reduced: true }); reduced.visible(true); assert.equal(reduced.ticks.size, 0);
  const contain = harness(); contain.clips[0].parentElement.offsetWidth = 360;
  contain.visible(true, [contain.clips[0]]); contain.ready(); await contain.resolve(); contain.tick();
  const fit = contain.canvases()[0].ctx.draws.at(-1);
  assert.deepEqual(fit.slice(1), [-30, 0, 180, 320], 'Contain centers narrow source footage without cropping');
  contain.tracks[0].x = 2000; contain.controller.draw();
  assert.equal(contain.canvases()[0].ctx.draws.at(-1), fit, 'Off-band tiles are skipped on timeline updates');
  assert.match(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), /onUpdate: \(\) => window\.ExomGallery\.draw\?\.\(\)/, 'Timeline updates paint after ScrollTrigger moves both tracks');
  assert.ok(!/currentTime|requestAnimationFrame|captureStream|srcObject\s*=|getUserMedia|MediaRecorder|RTCPeerConnection/.test(code), 'No seek clock, captured surfaces, camera, encoding or transmission');
  console.log('PASS: six-source canvas bands, native mobile, DPR/resize, clones, dirty frames, pause/reduced motion/visibility, lifecycle and safe fallback.');
};
if (require.main === module) module.exports().catch(error => { console.error(error); process.exitCode = 1; });
