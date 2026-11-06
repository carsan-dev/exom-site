'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const source = app.slice(app.indexOf('async function prepareTextAfterFonts('), app.indexOf('function setupFormationMotion('));

module.exports = async function checkTextPreparation() {
  function fixture(nativeYield) {
    const queue = [], calls = [], headings = [-100, 100, 1200, 1800].map(top => ({ getBoundingClientRect: () => ({ top }) }));
    const state = {
      innerHeight: 800, revealFontsReady: false,
      motionContext: { add(callback) { callback(); } },
      document: { body: { dataset: { motion: 'on' } }, querySelectorAll: () => [{ id: 'hero-title' }, ...headings] },
      setupHeadingReveals: targets => calls.push(...targets),
      setupStrategyLetters: () => calls.push('strategy'),
      window: { ScrollTrigger: { refresh: () => calls.push('refresh') } },
      setTimeout(resolve, delay) { assert.equal(delay, 0, 'No artificial loading delay'); queue.push(resolve); }
    };
    if (nativeYield) state.window.scheduler = { yield: () => new Promise(resolve => queue.push(resolve)) };
    const context = vm.createContext(state);
    vm.runInContext(source, context);
    return { context, calls, queue, headings };
  }
  for (const nativeYield of [true, false]) {
    const f = fixture(nativeYield);
    const preparation = f.context.prepareTextAfterFonts();
    assert.ok(f.context.revealFontsReady);
    assert.deepEqual(f.calls, [f.headings[0], f.headings[1], 'strategy'], 'Visible/passed headings and the curtain are prepared without a frame of plain text');
    assert.equal(f.queue.length, 1);
    f.queue.shift()(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, [f.headings[0], f.headings[1], 'strategy', f.headings[2]], 'One below-fold heading per continuation');
    assert.equal(f.queue.length, 1);
    f.queue.shift()(); await preparation;
    assert.deepEqual(f.calls, [f.headings[0], f.headings[1], 'strategy', f.headings[2], f.headings[3], 'refresh']);
  }
  for (const change of ['pause', 'reconfigure']) {
    const f = fixture(true);
    const preparation = f.context.prepareTextAfterFonts();
    if (change === 'pause') f.context.document.body.dataset.motion = 'off';
    else f.context.motionContext = { add() { throw Error('Stale preparation reached the new animation context'); } };
    f.queue.shift()(); await preparation;
    assert.equal(f.calls.length, 3, 'Pending work cannot recreate reverted text after ' + change);
    assert.equal(f.queue.length, 0);
  }
  const paused = fixture(true);
  paused.context.document.body.dataset.motion = 'off';
  await paused.context.prepareTextAfterFonts();
  assert.ok(paused.context.revealFontsReady, 'Resume still knows fonts are ready');
  assert.deepEqual(paused.calls, ['refresh']);
  assert.equal(paused.queue.length, 0);
  assert.ok(app.includes('document.fonts.ready.then(prepareTextAfterFonts)'));
  console.log('PASS: responsive font preparation, unchanged visible motion, scheduler fallback and cancellation.');
};
