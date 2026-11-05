'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { gsap } = require('./assets/vendor/gsap.min.js');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const source = app.slice(app.indexOf('function createStrategyTimeline('), app.indexOf('function createCoachCopyTimeline('));
const context = vm.createContext({ gsap, clamp: require('./motion.js').clamp });
vm.runInContext(source, context);
const copy = 'Saber qué hacer.\nConstruir una rutina propia.';
const frame = { scale: 1, clipPath: '' }, key = { clipPath: '' }, ink = { clipPath: '' }, rule = { scaleX: 1 }, note = { dataset: { copy }, textContent: copy };
const timeline = context.createStrategyTimeline(frame, key, ink, rule, note);
try {
  assert.equal(timeline.duration(), 1);
  assert.equal(frame.clipPath, 'polygon(42% 0%,88% 0%,58% 100%,12% 100%)');
  assert.equal(note.textContent, copy);
  timeline.progress(0).invalidate().progress(0);
  assert.equal(note.textContent, copy, 'Scroll does not own the one-time text');
  for (let pass = 0; pass < 3; pass++) {
    timeline.progress(.225);
    assert.notEqual(key.clipPath, ink.clipPath, 'The white reveal leads the green');
    assert.equal(ink.clipPath, 'polygon(-30% 0%,0% 0%,-30% 100%,-60% 100%)');
    timeline.progress(.4);
    const edge = value => Number(value.match(/,([\d.]+)%/)[1]);
    assert.ok(edge(key.clipPath) > edge(ink.clipPath), 'Both diagonal sweeps move together with a short offset');
    timeline.progress(.55);
    assert.equal(key.clipPath, 'polygon(-30% 0%,130% 0%,100% 100%,-60% 100%)');
    assert.notEqual(key.clipPath, ink.clipPath);
    timeline.progress(.59);
    assert.equal(note.textContent, copy);
    timeline.progress(.6);
    assert.equal(ink.clipPath, 'polygon(-30% 0%,130% 0%,100% 100%,-60% 100%)');
    assert.equal(note.textContent, copy);
    timeline.progress(.75);
    assert.equal(note.textContent, copy);
    assert.ok(copy.startsWith(note.textContent));
    timeline.progress(.78);
    assert.equal(note.textContent, copy, 'Scroll does not replay typing');
    timeline.progress(1);
    assert.equal(frame.scale, 1); assert.equal(rule.scaleX, 1); assert.equal(note.textContent, copy);
    timeline.progress(.4);
    assert.equal(note.textContent, copy, 'Reverse preserves text already shown');
    timeline.progress(0).invalidate().progress(.75);
    assert.equal(note.textContent, copy);
    timeline.progress(0);
    assert.equal(frame.scale, 1); assert.equal(frame.clipPath, 'polygon(42% 0%,88% 0%,58% 100%,12% 100%)'); assert.equal(rule.scaleX, 0); assert.equal(note.textContent, copy); assert.equal(key.clipPath, ink.clipPath);
  }
} finally { timeline.kill(); gsap.ticker.sleep(); }
assert.ok(app.includes('strategyTyping.sync();'));
const typingDocument = { body: { dataset: { motion: 'on' } } };
const typingContext = vm.createContext({ document: typingDocument, clamp: require('./motion.js').clamp });
vm.runInContext(app.slice(app.indexOf('function createStrategyTyping('), app.indexOf('function configureMotion(')), typingContext);
function typingFixture() {
  const events = {}, video = { paused: true, classList: { contains: () => true }, addEventListener: (name, fn) => { events[name] = fn; } };
  const note = { dataset: { copy }, textContent: copy };
  return { video, note, events, typing: typingContext.createStrategyTyping(video, note) };
}
const typed = typingFixture();
typed.typing.sync(); typed.typing.progress(.9);
assert.equal(typed.note.textContent, '', 'Scroll cannot write before actual playback');
typed.events.playing(); assert.equal(typed.note.textContent, '', 'Ignore late playing events from a paused video');
typed.typing.progress(.6); typed.video.paused = false; typed.events.playing();
assert.equal(typed.note.textContent, '', 'Writing begins after the opening boundary');
typed.typing.progress(.8);
assert.ok(typed.note.textContent.length > 0 && typed.note.textContent.length < copy.length);
const partial = typed.note.textContent;
typed.video.paused = true; typed.typing.progress(.2); typed.typing.sync();
assert.equal(typed.note.textContent, '', 'Reversing before the writing interval hides the supporting copy');
typed.video.paused = false; typed.events.playing(); typed.typing.progress(.75);
assert.ok(typed.note.textContent.length > 0 && typed.note.textContent.length < partial.length, 'Letters follow the current scroll position in both directions');
typed.typing.progress(.99999);
assert.equal(typed.note.textContent.length, copy.length - 1, 'The last letter waits until the scene releases');
typed.typing.progress(1); assert.equal(typed.note.textContent, copy);
typed.typing.progress(0); typed.typing.sync(); typed.events.playing();
assert.equal(typed.note.textContent, '', 'Completed copy also hides on reverse and refresh');
typed.typing.progress(.8); assert.equal(typed.note.textContent, partial);
const delayed = typingFixture(); delayed.typing.sync(); delayed.typing.progress(1);
assert.equal(delayed.note.textContent, '');
delayed.video.paused = false; delayed.events.playing();
assert.equal(delayed.note.textContent, copy, 'Late playback catches up without adding a new scroll hold');
for (const failure of ['error', 'exom:playback-failed']) {
  const fallback = typingFixture(); fallback.typing.sync(); fallback.events[failure](); fallback.typing.progress(.7);
  assert.equal(fallback.note.textContent, copy, 'A failed video must not hide or erase the copy');
}
const reduced = typingFixture(); typingDocument.body.dataset.motion = 'off'; reduced.typing.sync();
assert.equal(reduced.note.textContent, copy, 'Reduced motion has complete static copy');
typingDocument.body.dataset.motion = 'on'; reduced.typing.sync(); reduced.typing.progress(.6);
assert.equal(reduced.note.textContent, '', 'Reactivation restores the current scroll position, not the static copy');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert.ok(html.includes('<span class="strategy-ink" aria-hidden="true">estrategia.</span>'));
assert.ok(html.includes('<span class="sr-only">Saber qué hacer. Construir una rutina propia.</span>'));
assert.ok(!app.includes('exerciseCanvas'), 'Strategy playback is no longer driven by scroll frames');
const strategyVideo = {}, coachVideo = {}, registered = [];
const registration = app.slice(app.indexOf('const strategyVideo ='), app.indexOf('function fitGallery('));
vm.runInNewContext(registration, { document: { querySelector: selector => selector === '.strategy-video' ? strategyVideo : coachVideo }, window: { ExomGallery: { register: (video, options) => registered.push([video, { ...options }]) } } });
assert.equal(strategyVideo.playbackRate, 1.15);
assert.equal(strategyVideo.defaultPlaybackRate, 1.15, 'Native load/retry retains the chosen speed');
assert.deepEqual(registered, [[strategyVideo, { ready: false, preserveFrame: true }], [coachVideo, { ready: false, preserveFrame: true }]], 'Both scenes wait for their reveal before playing');
vm.runInContext(app.slice(app.indexOf('function strategyPlaybackReady('), app.indexOf('function createStrategyTimeline(')), context);
const ready = context.strategyPlaybackReady;
assert.equal(typeof ready, 'function');
assert.equal(ready(.3, 384, 374), true, 'The phone video is already uncovered while the headline is still revealing');
assert.equal(ready(0, 384, 374), false);
assert.equal(ready(1, 0, 374), false, 'A hidden frame must not start playback');
const mask = { clipPath: '' };
const maskTimeline = context.createStrategyTimeline(mask, { clipPath: '' }, { clipPath: '' }, { scaleX: 0 });
try {
  for (const [width, height] of [[384, 374], [390, 441], [720, 1280], [820, 814], [1100, 400]]) {
    const mediaWidth = Math.min(width, height * 9 / 16);
    const x = (width - mediaWidth) * 50 / width;
    const top = (height - mediaWidth * 16 / 9) / (2 * height);
    let previous = false;
    for (let step = 0; step <= 1000; step++) {
      const progress = step / 1000;
      maskTimeline.progress(progress);
      const points = mask.clipPath.match(/-?[\d.]+/g).map(Number);
      const left = points[0] + (points[6] - points[0]) * top;
      const right = points[2] + (points[4] - points[2]) * (1 - top);
      const actual = left <= x && right >= 100 - x;
      assert.equal(ready(progress, width, height), actual, `Playback follows the real GSAP mask at ${width}x${height}, progress ${progress}, edges ${left}/${right}`);
      assert.ok(!previous || actual, 'Opening cannot close the playback gate');
      previous = actual;
    }
  }
} finally { maskTimeline.kill(); gsap.ticker.sleep(); }
const sceneTweens = [], gates = new Map();
const strategyFrame = { clientWidth: 384, clientHeight: 374, style: { setProperty() {} } };
let copyProgress;
const fakeTimeline = { progress() { return this; }, invalidate() { return this; } };
vm.runInNewContext(app.slice(app.indexOf('    const exerciseState ='), app.indexOf('  });\n  ScrollTrigger.refresh();')), {
  strategyVideo, coachVideo, strategyTyping: { progress: value => { copyProgress = value; } },
  document: { querySelector: () => strategyFrame }, strategyPlaybackReady: ready,
  createStrategyTimeline: () => fakeTimeline, createCoachCopyTimeline: () => fakeTimeline,
  filmState: require('./motion.js').filmState, filmProgress: require('./motion.js').filmProgress,
  window: { ExomGallery: { setReady: (video, ready) => gates.set(video, ready) } },
  gsap: { to: (state, options) => sceneTweens.push({ state, options }) }
});
for (const [index, video, threshold] of [[0, strategyVideo, .3], [1, coachVideo, .3]]) {
  const { state, options } = sceneTweens[index];
  for (const callback of [options.onUpdate, options.scrollTrigger.onRefresh]) {
    for (const progress of [0, .2, threshold, .6, 1, .4, .2, 0, threshold]) {
      state.progress = progress; callback();
      if (index === 0) assert.equal(copyProgress, progress, 'Copy and release share the same update/refresh progress');
      assert.equal(gates.get(video), index === 0 ? ready(progress, strategyFrame.clientWidth, strategyFrame.clientHeight) : progress >= threshold, 'Playback follows the visible image on update, reverse and refresh');
    }
    if (index === 0) {
      strategyFrame.clientWidth = 720; strategyFrame.clientHeight = 1280; state.progress = .4; callback();
      assert.equal(gates.get(video), false, 'Refresh uses the new image geometry after rotation or resize');
      strategyFrame.clientWidth = 384; strategyFrame.clientHeight = 374;
    }
  }
}
assert.ok(html.includes('<video class="strategy-video" data-src="assets/strategy-training.mp4" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>'));
assert.ok(!html.includes('data-sequence="training"'), 'Training sheets are preserved but not loaded by this scene');
assert.ok(fs.statSync(__dirname + '/assets/strategy-training.mp4').size > 1000);
const exportCalls = [];
vm.runInNewContext(fs.readFileSync(__dirname + '/build-strategy-video.cjs', 'utf8'), { __dirname, process: { argv: ['node', 'build-strategy-video.cjs'] }, console: { log() {} }, require: name => name === 'node:child_process' ? { spawnSync(command, args) { exportCalls.push(args); return { status: 0 }; } } : require(name) });
assert.equal(exportCalls.length, 2, 'Export the clip and its matching first-frame poster together');
const exportArgs = exportCalls[0];
assert.equal(exportArgs[exportArgs.indexOf('-ss') + 1], '25.8', 'Trim setup without dropping the first repetition');
assert.equal(exportArgs[exportArgs.indexOf('-t') + 1], '9.2', 'Keep two consecutive complete repetitions');
assert.deepEqual(require('./media-config.cjs').scenes.find(([key]) => key === 'training').slice(2), [25.5, 9.5], 'Historical frame sequences keep their original interval');
assert.ok(exportArgs.includes('-an') && exportArgs.includes('+faststart'));
assert.ok(exportArgs[exportArgs.indexOf('-vf') + 1].includes('fps=30'));
const posterArgs = exportCalls[1];
assert.equal(posterArgs[posterArgs.indexOf('-i') + 1], exportArgs.at(-1), 'Poster is decoded from the final clip, not the uncut original');
assert.equal(posterArgs[posterArgs.indexOf('-frames:v') + 1], '1');
assert.equal(posterArgs[posterArgs.indexOf('-lossless') + 1], '1');
assert.equal(posterArgs[posterArgs.indexOf('-vf') + 1], 'format=rgb24', 'Use the same decoded RGB conversion as the video first frame');
assert.ok(!posterArgs.includes('-ss'), 'The waiting image must be time zero');
assert.ok(posterArgs.at(-1).endsWith('strategy-training-poster.webp'));
assert.ok(html.includes('src="assets/strategy-training-poster.webp"'));
assert.ok(!html.includes('src="assets/scenes-client-v1/training/poster.webp"'), 'Do not show the historical pose before the trimmed clip');
assert.ok(fs.statSync(__dirname + '/assets/strategy-training-poster.webp').size > 1000);
let exportAttempt = 0;
assert.throws(() => vm.runInNewContext(fs.readFileSync(__dirname + '/build-strategy-video.cjs', 'utf8'), { __dirname, process: { argv: ['node', 'build-strategy-video.cjs'] }, console: { log() {} }, require: name => name === 'node:child_process' ? { spawnSync() { return ++exportAttempt === 1 ? { status: 0 } : { status: 1, stderr: 'poster export failed' }; } } : require(name) }), /poster export failed/, 'Do not report success with an out-of-date waiting image');
assert.ok(app.includes('strategyTimeline.progress(0).invalidate().progress(exerciseState.progress)'));
assert.ok(source.includes('gsap.set(frame,') && !source.includes('.fromTo('), 'Initial states do not depend on deferred fromTo rendering');
const css = fs.readFileSync(__dirname + '/styles.css', 'utf8');
assert.ok(!css.includes('230vh'), 'No shorter desktop or mobile override remains');
assert.equal((css.match(/\.exercise-scene\{height:310vh\}/g) || []).length, 3, 'Desktop and mobile use the extended strategy runway');
assert.ok(css.includes('.film-stage{height:370vh;min-height:0}'), 'Coaching uses the extended viewing runway');
assert.ok(css.includes('body[data-motion="off"] .exercise-sequence{clip-path:none!important}'));
console.log('PASS: strategy visible-image gate, reversible writing, resize/reverse/refresh with actual GSAP and static fallback.');
