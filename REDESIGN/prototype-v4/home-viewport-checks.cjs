'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/home-viewport.js', 'utf8');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
function browser(userAgent, small = 760, large = 844) {
  const properties = {}, events = {}, timers = new Map();
  let probes = 0, refreshes = 0, id = 0;
  const window = { innerWidth: 390, ScrollTrigger: { refresh() { refreshes++; } }, addEventListener(name, callback) { events[name] = callback; } };
  const context = { window, navigator: { userAgent },
    document: { documentElement: { style: { setProperty(name, value) { properties[name] = value; } } }, body: { append() {} },
      createElement() { probes++; return { style: {}, getBoundingClientRect() { return { height: this.style.height === '100vh' ? large : small }; }, remove() {} }; } },
    setTimeout(callback) { timers.set(++id, callback); return id; }, clearTimeout(key) { timers.delete(key); }
  };
  vm.runInNewContext(source, context);
  return { properties, events, window, get probes() { return probes; }, get refreshes() { return refreshes; },
    resize(width, nextSmall, nextLarge = nextSmall) { window.innerWidth = width; small = nextSmall; large = nextLarge; events.resize?.(); },
    settle() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); } };
}
for (const ua of [iphone + ' Version/18.0 Mobile Safari/604.1', iphone + ' CriOS/130.0 Mobile Safari/604.1', 'Mozilla/5.0 (Linux; Android 15) GSA/1.2', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', iphone + ' FakeGSA/1.2']) {
  const page = browser(ua);
  assert.equal(page.probes, 0, 'Other browsers retain native viewport units without a resize listener');
  assert.equal(page.events.resize, undefined);
}
const page = browser(iphone + ' GSA/444.2 Mobile Safari/604.1');
assert.deepEqual(page.properties, { '--home-svh': '7.6px', '--home-vh': '8.44px' }, 'Preserve separate small and large viewport sizes');
for (const height of [844, 764, 500, 844, 760]) { page.resize(390, height); page.settle(); }
assert.equal(page.probes, 1, 'Toolbar and keyboard height changes never remeasure layout');
assert.equal(page.refreshes, 0);
assert.deepEqual(page.properties, { '--home-svh': '7.6px', '--home-vh': '8.44px' });
page.resize(700, 350); page.resize(844, 390); page.settle();
assert.equal(page.probes, 2, 'Orientation uses the settled width, not intermediate measurements');
assert.equal(page.refreshes, 1);
assert.deepEqual(page.properties, { '--home-svh': '3.9px', '--home-vh': '3.9px' });
page.resize(390, 760, 844); page.settle();
assert.equal(page.refreshes, 2, 'Returning to portrait recalibrates');
assert.deepEqual(page.properties, { '--home-svh': '7.6px', '--home-vh': '8.44px' });
const unavailable = browser(iphone + ' GSA/444.2', 0, 0);
assert.deepEqual(unavailable.properties, {}, 'Invalid measurements leave native CSS fallback intact');
const noMotion = browser(iphone + ' GSA/444.2');
delete noMotion.window.ScrollTrigger;
noMotion.resize(844, 390); assert.doesNotThrow(() => noMotion.settle());
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert.ok(html.indexOf('home-viewport.js') < html.indexOf('src="app.js"'), 'Capture dimensions before animation setup');
const css = fs.readFileSync(__dirname + '/styles.css', 'utf8');
assert.ok(css.includes('.film-stage{height:calc(370 * var(--home-vh, 1vh));min-height:0}'));
assert.ok(css.includes('height:calc(calc(100 * var(--home-svh, 1svh)) - 97px)'));
assert.ok(css.includes('calc(27 * var(--home-svh, 1svh))'));
assert.ok(css.includes('height:100dvh'), 'The full-screen welcome overlay remains dynamic');
assert.ok(css.includes('body[data-motion="off"] .film-stage{height:auto;min-height:0}'), 'Reduced motion keeps its natural flow');
for (const name of ['home-viewport.js', 'home-viewport-checks.cjs']) assert.ok(!fs.readFileSync(__dirname + '/' + name).includes(13), name + ' uses LF');
console.log('PASS: Google iPhone viewport stability, keyboard, rotation, native browser fallbacks and motion-off layout.');
