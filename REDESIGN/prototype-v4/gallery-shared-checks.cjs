'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'gallery-shared.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  const created = [], observers = [], registered = new Set(), streams = [], timers = new Map();
  let timerId = 0;
  function element() {
    const events = new Map();
    return { dataset: {}, children: [], events,
      append(v) { this.children.push(v); }, remove() { this.removed = true; }, setAttribute() {},
      addEventListener(k, f) { if (!events.has(k)) events.set(k, new Set()); events.get(k).add(f); },
      removeEventListener(k, f) { events.get(k)?.delete(f); },
      emit(k) { [...(events.get(k) || [])].forEach(f => f()); }
    };
  }
  function video(src = '') {
    const classes = new Set();
    return Object.assign(element(), { dataset: { src }, src, srcObject: null, isConnected: true, paused: true, requests: [], loadGeneration: 0,
      classList: { add: k => classes.add(k), remove: k => classes.delete(k) }, classes,
      getAttribute() { return this.src; }, removeAttribute() { this.src = ''; },
      pause() { this.paused = true; }, load() { this.loadGeneration++; },
      play() {
        const loadGeneration = this.loadGeneration;
        return new Promise((resolve, reject) => this.requests.push({ reject, resolve: () => {
          if (loadGeneration === this.loadGeneration) { this.paused = false; this.emit('playing'); }
          resolve();
        } }));
      },
      captureStream() {
        if (options.captureThrows) throw Error('Capture unsupported');
        const track = Object.assign(element(), { stopped: false, stop() { this.stopped = true; } });
        const stream = { getTracks: () => [track], getVideoTracks: () => options.noTrack ? [] : [track] };
        streams.push(stream); return stream;
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
  const tracks = [element(), element()];
  const gallery = Object.assign(element(), { querySelectorAll: () => clips.filter(v => v.isConnected) });
  const body = element(); body.dataset.motion = options.motion || 'on';
  const document = Object.assign(element(), { body, hidden: false,
    querySelector: () => options.noGallery ? null : gallery, querySelectorAll: () => tracks,
    createElement(tag) { const v = tag === 'video' ? video() : element(); v.tag = tag; created.push(v); return v; }
  });
  const media = Object.assign(element(), { matches: !!options.mobile });
  const context = { document, HTMLVideoElement: { prototype: { captureStream: options.unsupported ? undefined : () => {} } },
    window: { matchMedia(query) { assert.equal(query, '(max-width: 760px), (pointer: coarse)'); return media; }, ExomGallery: {
      register(v) { registered.add(v); }, unregister(v) { registered.delete(v); v.pause(); v.removeAttribute('src'); v.load(); }, sync() {}
    } }, IntersectionObserver: Observer, MutationObserver: Observer,
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
  return { created, observers, registered, streams, clips, gallery, body, document, media, tracks, video, sources, visible, resolve,
    mobile(v) { media.matches = v; media.emit('change'); },
    motion(v) { body.dataset.motion = v; fire(body); },
    hidden(v) { document.hidden = v; document.emit('visibilitychange'); },
    near(v) { fire(gallery, [{ target: gallery, isIntersecting: v }]); },
    warm() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    timers,
    inventory() { fire(tracks[0]); },
    ready() { sources().filter(v => v.src).forEach(v => v.emit('loadeddata')); },
    activeObservers: () => observers.filter(o => !o.disconnected).length
  };
}

module.exports = async function checkSharedGallery() {
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
  assert.ok(cold.clips.every(v => v.srcObject && !v.paused), 'Entering reuses the prepared streams');
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
  assert.equal(h.gallery.dataset.renderer, 'direct-pool');
  assert.equal(h.sources().length, 6); assert.equal(h.registered.size, 0);
  assert.ok(h.sources().every(v => !v.src), 'Offscreen pool does not load files');
  assert.equal(h.created.filter(v => v.tag === 'canvas').length, 0, 'C presents video without canvas');
  h.visible(true); h.visible(true);
  assert.ok(h.sources().every(v => v.requests.length === 1), 'Pending source plays are deduplicated');
  assert.ok(h.clips.every(v => !v.classes.has('is-playing')), 'Posters remain until captured playback starts');
  h.ready(); await h.resolve();
  assert.equal(new Set(h.clips.map(v => v.srcObject)).size, 6);
  assert.ok(h.clips.every(v => v.srcObject && !v.src && v.classes.has('is-playing')));
  h.ready(); assert.equal(h.streams.length, 6, 'Repeated loadeddata and loops do not recapture');
  h.motion('off'); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  assert.ok(h.clips.every(v => !v.classes.has('is-playing')));
  h.motion('on'); await h.resolve();
  h.hidden(true); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  h.hidden(false); await h.resolve();
  h.visible(false); assert.ok([...h.sources(), ...h.clips].every(v => v.paused));
  const clone = h.video('/clip-0.mp4'); h.clips.push(clone); h.registered.add(clone); h.inventory();
  h.visible(true); await h.resolve(); assert.equal(h.sources().length, 6); assert.equal(h.registered.size, 0);
  assert.equal(clone.srcObject, h.clips[0].srcObject, 'New copies reuse the existing stream');
  clone.isConnected = false; h.inventory(); assert.equal(clone.srcObject, null); assert.ok(clone.paused);
  assert.ok(h.observers.every(o => !o.targets.has(clone)), 'Removed clones release observers');
  const oldError = [...h.sources()[0].events.get('error')][0];
  h.mobile(true);
  assert.equal(h.gallery.dataset.renderer, 'native'); assert.equal(h.registered.size, 18);
  assert.equal(h.activeObservers(), 0); assert.ok(h.clips.every(v => !v.srcObject));
  assert.ok(h.streams.every(s => s.getTracks().every(t => t.stopped)));
  assert.ok(h.sources().every(v => !v.src && v.paused));
  h.mobile(false); oldError();
  assert.equal(h.gallery.dataset.renderer, 'direct-pool', 'Retired errors cannot disable a new pool');
  h.visible(true); h.ready(); await h.resolve();
  for (let i = 0; i < 3; i++) { h.mobile(true); h.mobile(false); }
  h.mobile(true); assert.equal(h.activeObservers(), 0); assert.equal(h.registered.size, 18);
  assert.ok(h.created.filter(v => v.tag === 'div').every(v => v.removed));

  const late = harness(); late.visible(true); late.ready();
  const cancelled = [...late.sources(), ...late.clips].flatMap(v => v.requests.splice(0));
  late.visible(false); late.visible(true);
  cancelled.forEach(r => r.reject(Error('Interrupted by pause'))); await settle();
  assert.equal(late.gallery.dataset.renderer, 'direct-pool', 'An obsolete rejection cannot poison resumed playback');
  await late.resolve(); assert.ok(late.clips.every(v => !v.paused));
  late.visible(false); late.visible(true);
  const retired = [...late.sources(), ...late.clips].flatMap(v => v.requests.splice(0));
  late.mobile(true); late.mobile(false); late.visible(true); late.ready(); await late.resolve();
  retired.forEach(r => r.resolve()); await settle();
  assert.ok(late.clips.every(v => !v.paused && v.srcObject), 'Late old display promises cannot pause their new owner');
  assert.ok(late.sources().slice(0, 6).every(v => v.paused && !v.src), 'Retired sources cannot restart');

  for (const options of [{ captureThrows: true }, { noTrack: true }]) {
    const f = harness(options); f.visible(true); f.ready(); await f.resolve();
    assert.equal(f.gallery.dataset.renderer, 'native'); assert.equal(f.registered.size, 18);
    assert.equal(f.activeObservers(), 0); assert.ok(f.clips.every(v => !v.srcObject));
  }
  for (const failure of ['source', 'display', 'track', 'play', 'assign']) {
    const f = harness(); f.visible(true);
    if (failure === 'assign') Object.defineProperty(f.clips[0], 'srcObject', { get: () => null, set(v) { if (v) throw Error('Rejected stream'); } });
    f.ready();
    if (failure === 'source') f.sources()[0].emit('error');
    if (failure === 'display') f.clips[0].emit('error');
    if (failure === 'track') f.streams[0].getVideoTracks()[0].emit('ended');
    if (failure === 'play') f.sources()[0].requests.shift().reject(Error('Denied'));
    await f.resolve();
    assert.equal(f.gallery.dataset.renderer, 'native', failure + ' restores native playback');
    assert.equal(f.registered.size, 18); assert.equal(f.activeObservers(), 0);
    const count = f.created.length; f.mobile(true); f.mobile(false); assert.equal(f.created.length, count, 'Failures stay on native fallback');
  }
  const paused = harness({ motion: 'off' }); paused.visible(true);
  assert.ok(paused.sources().every(v => !v.src));
  paused.motion('on'); paused.ready(); await paused.resolve(); assert.ok(paused.clips.every(v => !v.paused));
  assert.ok(!/currentTime|requestAnimationFrame|createElement\('canvas'\)|getUserMedia|MediaRecorder|RTCPeerConnection/.test(code), 'No seek clock, drawing, camera, encoding or transmission');
  console.log('PASS: C six-source native streams, mobile bypass, clones, repeated mode changes, pause/visibility, late ownership and safe fallback.');
};
if (require.main === module) module.exports().catch(error => { console.error(error); process.exitCode = 1; });
