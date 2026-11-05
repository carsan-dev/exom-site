'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'welcome.js'), 'utf8');
function testWelcome(options = {}) {
  const handlers = {}, classes = new Set(), events = [], stored = new Map();
  if (options.seen) stored.set('exom-welcome-seen', '1');
  let shown = 0, closed = 0, killed = 0, timer, timelineOptions;
  const steps = [];
  const dialog = { showModal() { shown++; }, close() { closed++; }, addEventListener(type, fn) { handlers[type] = fn; } };
  const preference = { matches: !!options.reduce, addEventListener(type, fn) { handlers.preference = fn; }, removeEventListener() {} };
  const gsap = { timeline(config) {
    timelineOptions = config;
    if (options.animationFailure) throw Error('unavailable');
    return { from() { return this; }, to() { return this; }, call(fn) { steps.push(fn); return this; }, kill() { killed++; } };
  } };
  const sandbox = {
    window: { gsap: options.noGsap ? null : gsap, matchMedia: () => preference, dispatchEvent: event => events.push(event.type) }, gsap,
    document: {
      hidden: !!options.hidden,
      querySelector: selector => selector === '#welcome' ? dialog : { addEventListener(type, fn) { handlers.skip = fn; } },
      documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
      addEventListener(type, fn) { handlers[type] = fn; }, removeEventListener() {}
    },
    location: { hash: options.hash || '' }, scrollY: options.scroll || 0,
    performance: { now: () => options.late ? 1500 : 100, getEntriesByType: () => [{ type: options.restored ? 'back_forward' : 'navigate' }] },
    sessionStorage: {
      getItem(key) { if (options.storageBlocked) throw Error('blocked'); return stored.get(key); },
      setItem(key, value) { stored.set(key, value); }
    },
    setTimeout(fn, ms) { assert.equal(ms, 2000); timer = fn; return 1; }, clearTimeout() {},
    Event: class { constructor(type) { this.type = type; } }
  };
  runInNewContext(source, sandbox);
  return { sandbox, classes, events, handlers, steps, stored, counts: () => ({ shown, closed, killed }), complete: () => timelineOptions.onComplete(), safety: () => timer() };
}
for (const options of [{ seen: true }, { reduce: true }, { hidden: true }, { hash: '#metodo' }, { scroll: 100 }, { late: true }, { restored: true }, { noGsap: true }, { storageBlocked: true }]) {
  const test = testWelcome(options);
  assert.equal(test.counts().shown, 0, `Direct access: ${JSON.stringify(options)}`);
  assert.equal(test.sandbox.window.ExomWelcome.active, false);
}
const normal = testWelcome();
assert.equal(normal.counts().shown, 1);
assert.equal(normal.stored.get('exom-welcome-seen'), '1');
assert.ok(normal.classes.has('welcome-open'));
normal.steps[0]();
assert.deepEqual(normal.events, ['exom:welcome-reveal'], 'Hero starts with curtain, not after another wait');
normal.complete(); normal.handlers.skip(); normal.safety();
assert.equal(normal.counts().closed, 1); assert.equal(normal.events.length, 1); assert.equal(normal.classes.size, 0);
for (const action of ['skip', 'cancel', 'preference', 'visibilitychange', 'safety']) {
  const test = testWelcome();
  test.sandbox.document.hidden = true;
  if (action === 'safety') test.safety();
  else test.handlers[action]({ preventDefault() {} });
  assert.equal(test.counts().closed, 1, action);
  assert.equal(test.sandbox.window.ExomWelcome.active, false);
  assert.equal(test.classes.size, 0); assert.equal(test.events.length, 1);
}
assert.equal(testWelcome({ animationFailure: true }).counts().closed, 1, 'Animation failure cannot trap the visitor');
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie|WebSocket/.test(source));
console.log('PASS: welcome once/session, direct links, reduced motion, skip/Escape, failure and hero coordination.');
