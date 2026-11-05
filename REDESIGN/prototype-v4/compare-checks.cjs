'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/compare.js', 'utf8');

function harness(protocol, denied = false, observerAvailable = true) {
  const nodes = Object.fromEntries(['run', 'status', 'preview', 'results', 'raw', 'local-server'].map(id => [id, {
    disabled: false, hidden: true, textContent: '', addEventListener(_, callback) { this.click = callback; },
    replaceChildren(frame) { if (frame) queueMicrotask(() => frame.onload()); }, scrollIntoView() {}
  }]));
  let created = 0, removed = 0, y = 0, now = 0;
  const gallery = { offsetHeight: 500, getBoundingClientRect: () => ({ top: 1000-y }) };
  const d = { fonts: { ready: Promise.resolve() }, body: { dataset: { motion: 'on' } },
    documentElement: { style: {} }, querySelector: () => gallery,
    querySelectorAll: selector => selector.includes('canvas') ? [{ dataset: { frame: '20' } }] : [] };
  const w = { innerWidth: 1200, innerHeight: 700, get scrollY() { return y; }, scrollTo({top}) { y = top; },
    requestAnimationFrame(callback) { queueMicrotask(() => callback(now += 1000)); },
    performance: { setResourceTimingBufferSize() {}, getEntriesByType: () => [] } };
  if (observerAvailable) w.PerformanceObserver = class {
    static supportedEntryTypes = ['longtask']; observe() {} disconnect() {}
  };
  Object.defineProperty(w, 'document', { get() { if (denied) throw Error('Permission denied to access property "document"'); return d; } });
  const context = vm.createContext({ location: { protocol }, navigator: { userAgent: 'test' },
    setTimeout: (callback, ms) => ms === 500 ? setTimeout(callback, 0) : setTimeout(callback, ms), clearTimeout,
    document: { hidden: false, querySelector: selector => nodes[selector.slice(1)],
      createElement(tag) { assert.equal(tag, 'iframe'); created++; return { contentWindow: w, scrollIntoView() {}, remove() { removed++; } }; } }
  });
  vm.runInContext(source, context);
  return { nodes, sample: () => vm.runInContext('sample(2)', context), counts: () => ({ created, removed }) };
}

(async () => {
  const file = harness('file:');
  assert.equal(file.nodes.run.disabled, true);
  assert.equal(file.nodes['local-server'].hidden, false);
  await file.nodes.run.click();
  await assert.rejects(file.sample(), /servidor local/);
  assert.deepEqual(file.counts(), { created: 0, removed: 0 });

  const denied = harness('http:', true);
  assert.equal(denied.nodes.run.disabled, false);
  await denied.nodes.run.click();
  assert.match(denied.nodes.status.textContent, /servidor local/);
  assert.doesNotMatch(denied.nodes.status.textContent, /Permission denied/);
  assert.equal(denied.nodes['local-server'].hidden, false);
  assert.equal(denied.nodes.run.disabled, false);
  assert.deepEqual(denied.counts(), { created: 1, removed: 1 });

  for (const available of [true, false]) {
    const http = harness('http:', false, available);
    const result = await http.sample();
    assert.equal(result.phases.length, 2);
    assert.equal(result.longTasks, available ? 0 : null);
    assert.equal(result.longTaskMs, available ? 0 : null);
    assert.deepEqual(http.counts(), { created: 1, removed: 1 });
  }
  console.log('PASS: file launch blocked before iframe, denied origin explained/cleaned up, HTTP sampling and unavailable metrics.');
})().catch(error => { console.error(error); process.exitCode = 1; });
