'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/' + name, 'utf8');
for (const [page, active] of [['index.html', 'El método'], ['historia.html', 'Mi historia'], ['app.html', 'La app']]) {
  const html = read(page), nav = html.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['index.html#metodo', 'historia.html', 'app.html', 'index.html#solicitud']);
  assert.ok(nav.includes(`aria-current="page">${active}</a>`));
  assert.equal((html.match(/id="menu-toggle"/g) || []).length, 1);
  assert.ok(html.includes('src="navigation.js"'));
  for (const [, target] of nav.matchAll(/href="([^"]+)"/g)) {
    const [file, anchor] = target.split('#');
    assert.ok(fs.existsSync(__dirname + '/' + file));
    if (anchor) assert.ok(read(file).includes(`id="${anchor}"`));
  }
  if (page !== 'historia.html') {
    const captures = html.match(/<img\b[^>]*Captura App [^>]*>/g) || [];
    assert.equal(captures.length, page === 'index.html' ? 3 : 11, 'App film replaces its three placeholder screenshots');
    captures.forEach(tag => assert.ok(html.includes(`<span class="app-capture">${tag}</span>`)));
  }
}
assert.ok(read('styles.css').includes('aspect-ratio:945/1958'));
assert.ok(read('styles.css').includes('margin-top:-9.52381%'));
assert.ok(read('app-page.js').includes("stage.querySelectorAll('.app-screen-stack .app-capture')"));
assert.ok(!read('app.js').includes("const menuButton ="), 'One shared menu owner');
const events = {}, attrs = { 'aria-expanded': 'false' }, links = Array.from({ length: 4 }, () => ({ addEventListener(type, fn) { this[type] = fn; } }));
const nav = { dataset: {}, querySelectorAll: () => links };
const button = { addEventListener(type, fn) { this[type] = fn; }, setAttribute(k, v) { attrs[k] = v; }, getAttribute: k => attrs[k], focus() { this.focused = true; } };
vm.runInNewContext(read('navigation.js'), { document: { querySelector: s => s === '#navigation' ? nav : button, addEventListener: (type, fn) => { events[type] = fn; } } });
button.click(); assert.equal(nav.dataset.open, 'true'); assert.equal(attrs['aria-label'], 'Cerrar menú');
events.keydown({ key: 'Escape' }); assert.equal(nav.dataset.open, 'false'); assert.equal(button.focused, true);
for (const link of links) { button.click(); link.click(); assert.equal(attrs['aria-expanded'], 'false'); }
for (const file of ['navigation.js', 'navigation-checks.cjs', 'index.html', 'historia.html', 'app.html', 'styles.css', 'app.js', 'app-page.css', 'app-page.js']) assert.ok(!read(file).includes('\r'), file + ' uses LF');
console.log('PASS: common navigation, active page, destinations, menu close/Escape/focus and all 14 cropped screenshots.');
