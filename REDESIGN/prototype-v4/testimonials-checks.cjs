'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'testimonials.js'), 'utf8');
function eventTarget() {
  const events = new Map();
  return {
    addEventListener(name, fn) { (events.get(name) || events.set(name, []).get(name)).push(fn); },
    emit(name, event = {}) { return Promise.all((events.get(name) || []).map(fn => fn(event))); },
    attributes: {}, dataset: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    focus() { this.focused = true; }
  };
}
async function check() {
  const players = Array.from({ length: 3 }, () => {
    const video = Object.assign(eventTarget(), {
      paused: true, ended: false, muted: false, currentTime: 12, pending: [],
      play() { this.paused = false; this.emit('play'); return new Promise((resolve, reject) => this.pending.push({ resolve: () => { if (!this.paused) this.emit('playing'); resolve(); }, reject })); },
      pause() { this.paused = true; this.emit('pause'); },
      load() { this.error = null; this.reloaded = true; },
      getBoundingClientRect() { return { left: 0, right: 300, bottom: 600 }; },
      focus() { this.focused = true; }
    });
    const button = Object.assign(eventTarget(), {
      attributes: { 'aria-label': 'Reproducir testimonio' },
      getAttribute(key) { return this.attributes[key]; },
      setAttribute(key, value) { this.attributes[key] = value; }
    });
    const message = { hidden: true };
    return { ...eventTarget(), video, button, message, querySelector(selector) { return ({ video, '.testimonial-play': button, '.testimonial-error': message })[selector]; } };
  });
  const tabs = players.map((_, i) => Object.assign(eventTarget(), { id: 'testimonial-tab-' + i }));
  const stage = eventTarget(), position = {}, navigation = {}, pagination = {};
  const arrows = [-1, 1].map(step => Object.assign(eventTarget(), { dataset: { testimonialStep: String(step) } }));
  const section = {
    classList: { add(value) { assert.equal(value, 'is-carousel'); } },
    querySelectorAll(selector) { return ({ '[data-testimonial-slot]': players, '[role="tab"]': tabs, '[data-testimonial-step]': arrows })[selector]; },
    querySelector(selector) { return ({ '.testimonial-grid': stage, '.testimonial-position': position, '.testimonial-navigation': navigation, '.testimonial-pagination': pagination })[selector]; }
  };
  const document = Object.assign(eventTarget(), {
    hidden: false,
    getElementById(id) { assert.equal(id, 'testimonios'); return section; }
  });
  vm.runInNewContext(code, { document });
  assert.ok(players.every(p => p.video.paused && !p.video.pending.length && !p.button.hidden));
  assert.ok(players.every(p => !p.video.controls), 'Custom Play must not overlap native controls before playback');
  const [a, b, c] = players;
  document.activeElement = a.button;
  a.video.muted = true;
  const first = a.button.emit('click');
  assert.equal(a.video.muted, false);
  assert.equal(a.video.focused, true);
  assert.equal(a.button.disabled, true);
  assert.equal(a.button.hidden, false, 'Loading retains the branded Play');
  assert.equal(a.video.controls, false);
  await tabs[1].emit('click');
  assert.ok(players.every(p => p.video.paused), 'Navigation pauses without autoplay');
  const second = b.button.emit('click');
  assert.equal(a.video.paused, true, 'Switch pauses the earlier testimonial immediately');
  a.video.paused = false;
  await a.video.emit('play');
  assert.equal(a.video.paused, true, 'Stale play event cannot steal the new selection');
  await a.video.emit('playing');
  assert.equal(a.video.controls, false, 'Stale playing event cannot reveal controls');
  a.video.pending.shift().resolve(); b.video.pending.shift().resolve();
  await Promise.all([first, second]);
  assert.equal(a.video.paused, true);
  assert.equal(b.video.paused, false);
  assert.equal(a.video.currentTime, 12, 'Switch preserves position');
  assert.equal(b.video.controls, true);
  assert.equal(b.button.hidden, true);
  b.video.pause();
  assert.equal(b.button.hidden, true, 'Pause keeps native controls without a second Play');
  assert.equal(b.video.controls, true, 'Paused video remains seekable');
  b.video.paused = false; await b.video.emit('play');
  await b.video.emit('playing');
  b.video.paused = true; b.video.ended = true; await b.video.emit('ended');
  assert.ok(b.video.controls && b.button.hidden, 'Native replay remains available at the end');
  b.video.ended = false;
  await tabs[0].emit('click');
  assert.equal(b.video.controls, false, 'Inactive cards have no native controls');
  await tabs[1].emit('click');
  assert.ok(b.video.controls && b.button.hidden, 'Returning preserves native controls without overlap');
  b.video.paused = false; await b.video.emit('play');
  await tabs[2].emit('click');
  const third = c.button.emit('click');
  c.video.pending.shift().resolve(); await third;
  assert.ok(a.video.paused && b.video.paused && !c.video.paused, 'Native controls also select only one');
  document.hidden = true; await document.emit('visibilitychange');
  assert.ok(players.every(p => p.video.paused));
  document.hidden = false; await document.emit('visibilitychange');
  assert.ok(players.every(p => p.video.paused), 'Returning never autoplays');
  await c.video.emit('error');
  assert.ok(!c.video.controls && !c.button.hidden, 'Playback failure restores only the branded retry');
  await tabs[0].emit('click');
  const failed = a.button.emit('click');
  a.video.paused = true; a.video.pending.shift().reject(Error('offline')); await failed;
  assert.equal(a.message.hidden, false); assert.equal(a.button.disabled, false);
  assert.ok(!a.video.controls && !a.button.hidden, 'Rejected playback does not expose native controls');
  a.video.error = {}; const retry = a.button.emit('click');
  assert.equal(a.video.reloaded, true);
  document.hidden = true; await document.emit('visibilitychange');
  a.video.pending.shift().resolve(); await retry;
  assert.equal(a.video.paused, true, 'Late start after hiding remains paused');
  document.hidden = false;
  await arrows[0].emit('click');
  assert.equal(position.textContent, '3 de 3', 'Previous wraps to last');
  assert.ok(players[0].inert && players[1].inert && !players[2].inert);
  await tabs[2].emit('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(position.textContent, '1 de 3');
  assert.equal(tabs[0].focused, true);
  assert.equal(players[0].dataset.position, 'active');
  assert.equal(players[1].dataset.position, 'next');
  assert.equal(players[2].dataset.position, 'previous');
  await tabs[0].emit('keydown', { key: 'End', preventDefault() {} });
  assert.equal(position.textContent, '3 de 3');
  await tabs[2].emit('keydown', { key: 'Home', preventDefault() {} });
  await stage.emit('touchstart', { touches: [{ clientX: 220, clientY: 200 }] });
  await stage.emit('touchend', { changedTouches: [{ clientX: 80, clientY: 205 }] });
  assert.equal(position.textContent, '2 de 3', 'Horizontal swipe selects without playback');
  assert.ok(players.every(p => p.video.paused));
  await stage.emit('touchstart', { touches: [{ clientX: 220, clientY: 580 }] });
  await stage.emit('touchend', { changedTouches: [{ clientX: 80, clientY: 580 }] });
  assert.equal(position.textContent, '2 de 3', 'Native seek area does not navigate');
  await stage.emit('touchstart', { touches: [{ clientX: 220, clientY: 200 }] });
  await stage.emit('touchend', { changedTouches: [{ clientX: 210, clientY: 400 }] });
  assert.equal(position.textContent, '2 de 3', 'Vertical scroll does not navigate');
  assert.ok(players.every(p => !p.video.pending.length));
  console.log('PASS: exclusive branded/native controls through initial load, playing, pause, replay, navigation and errors; carousel depth selection, wrap, keyboard, inert panels, swipe, native seek protection; testimonial controls simulated: manual sound, native controls, switching, delayed starts, retry, tab visibility and isolated selectors.');
}
module.exports = check;
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
