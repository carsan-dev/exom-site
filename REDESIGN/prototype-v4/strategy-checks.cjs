'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { gsap } = require('./assets/vendor/gsap.min.js');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert.match(fs.readFileSync(__dirname + '/styles.css', 'utf8'), /\.strategy-char\{display:inline-block\}/, 'Character spans must be transformable, not inline text');
const source = app.slice(app.indexOf('function createStrategyTimeline('), app.indexOf('function createCoachCopyTimeline('));
const context = vm.createContext({ gsap });
vm.runInContext(source, context);
const frame = { clipPath: '' };
const lines = [0, 0].map(xPercent => ({ xPercent, y: 0 }));
const rule = { scaleX: 1 };
const timeline = context.createStrategyTimeline(frame, rule);
try {
  assert.equal(timeline.duration(), 1, 'One continuous sequence, no empty hold');
  assert.equal(frame.clipPath, 'polygon(46% 0%,54% 0%,54% 100%,46% 100%)');
  for (let pass = 0; pass < 3; pass++) {
    timeline.progress(.5);
    assert.equal(frame.clipPath, 'polygon(23% 0%,77% 0%,77% 100%,23% 100%)', 'Both curtain edges open together');
    timeline.progress(1);
    assert.equal(frame.clipPath, 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)', 'The full exercise is visible at the end');
    assert.equal(rule.scaleX, 1);
    timeline.progress(0).invalidate().progress(0);
    assert.equal(frame.clipPath, 'polygon(46% 0%,54% 0%,54% 100%,46% 100%)', 'Reverse/refresh restores the curtain');
  }
} finally { timeline.kill(); gsap.ticker.sleep(); }
assert.ok(!/opacity|autoAlpha|textContent/.test(source), 'Entrance never hides content or edits the copy');
assert.ok(!/\b(scale|rotation)\s*:/.test(source), 'Curtain opens without zooming or tilting the video');
const letterSource = app.slice(app.indexOf('function setupStrategyLetters('), app.indexOf('function createStrategyTimeline('));
const splits = [];
let targetWidth = 100;
let widthReads = 0;
const targets = [true, true, false, false, false].map((objective, index) => ({
  classList: { contains: name => name === 'strategy-ink' && index === 4 },
  closest: () => ({ classList: { contains: () => objective } }),
  getBoundingClientRect: () => { widthReads++; return { left: 0, right: targetWidth, width: targetWidth }; }
}));
const linkedFrame = { clipPath: '' };
const linkedTimeline = context.createStrategyTimeline(linkedFrame, { scaleX: 1 });
const letterContext = vm.createContext({ revealFontsReady: false, innerWidth: 1280,
  window: { SplitText: true }, strategySplits: [], strategyTimeline: linkedTimeline, gsap,
  document: { querySelectorAll: () => targets },
  SplitText: { create(target, options) {
    const chars = Array.from({ length: 14 }, (_, index) => 10 + 20 * index).map(left => {
      const char = { x: 0, yPercent: 0 };
      char.getBoundingClientRect = () => ({ left: left + char.x, right: left + 10 + char.x });
      return char;
    });
    const split = { chars, options, revert() {} }; splits.push(split); return split;
  } }
});
vm.runInContext(letterSource, letterContext);
try {
  letterContext.setupStrategyLetters();
  assert.equal(splits.length, 0, 'No hidden letters while fonts are loading');
  linkedTimeline.progress(.5);
  letterContext.revealFontsReady = true;
  letterContext.setupStrategyLetters();
  assert.ok(widthReads <= 20, 'Measure each text group, not every animated character');
  assert.equal(linkedTimeline.progress(), .5, 'Late font readiness preserves curtain progress');
  assert.equal(linkedTimeline.duration(), 1, 'Letters never lengthen the curtain');
  assert.equal(splits.length, 5);
  assert.equal(splits[0].options.aria, 'none', 'Generic spans must not receive prohibited aria-label attributes');
  assert.ok(html.includes('<p class="sr-only">Cada objetivo necesita una estrategia.</p>'), 'Screen readers receive one complete unsplit sentence');
  assert.ok(html.includes('class="display strategy-objective strategy-line" aria-hidden="true"'));
  assert.ok(html.includes('class="display strategy-line" aria-hidden="true"'), 'Animated glyphs and color overlay are visual-only');
  assert.equal(splits[4].options.aria, 'none', 'Ink overlay is not read twice');
  const left = splits[0].chars[0], right = splits[2].chars[0];
  for (let pass = 0; pass < 3; pass++) {
    linkedTimeline.progress(0);
    assert.equal(left.x, 104); assert.equal(right.x, -104);
    linkedTimeline.progress(.5);
    assert.ok(left.x > 0 && left.x < 104, 'Half-open curtain still drags objective letters');
    assert.ok(right.x < 0 && right.x > -104, 'Resolution letters share the opening progress');
    for (const split of splits) {
      const [first, second] = split.chars.map(char => char.getBoundingClientRect());
      assert.equal(second.left - first.left, 20, 'Letters retain their spacing instead of collapsing like an accordion');
    }
    const half = left.x;
    gsap.ticker.tick();
    assert.equal(left.x, half, 'Elapsed time cannot finish letters without more scroll');
    linkedTimeline.invalidate().progress(.5);
    assert.equal(left.x, half, 'Refreshing midway does not compound the letter offset');
    assert.equal(linkedFrame.clipPath, 'polygon(23% 0%,77% 0%,77% 100%,23% 100%)');
    linkedTimeline.progress(1);
    splits.flatMap(split => split.chars).forEach(char => { assert.equal(char.x, 0); assert.equal(char.yPercent, 0); });
  }
  letterContext.innerWidth = 390;
  targetWidth = 70;
  linkedTimeline.progress(0).invalidate().progress(1).progress(0);
  assert.equal(left.x, 74); assert.equal(right.x, -74);
  linkedTimeline.progress(.5);
  assert.equal(left.x, 37); assert.equal(right.x, -37);
  assert.equal(splits[0].chars[1].x, left.x, 'Mobile also keeps letters apart as they cross the edge');
  linkedTimeline.progress(1);
  assert.equal(left.x, 0); assert.equal(right.x, 0);
  letterContext.setupStrategyLetters();
  assert.equal(splits.length, 5, 'Font callbacks cannot duplicate splits');
  assert.ok(!/scrollTrigger|once:|onComplete/.test(letterSource), 'No independent or one-shot letter animation');
} finally { linkedTimeline.kill(); gsap.ticker.sleep(); }
assert.ok(app.includes('strategySplits.forEach(split => split.revert())'), 'Pausing/reduced motion restores original text');
assert.ok(!/strategyTyping|createStrategyTyping|strategyPlaybackReady/.test(app), 'No delayed typing or mask-dependent playback remains');
assert.ok(html.includes('<p class="strategy-note">Saber qué hacer.<br>Construir una rutina propia.</p>'), 'Supporting copy is available without JS or successful video playback');
assert.ok(!html.includes('strategy-typed'));
const sceneMarkup = html.slice(html.indexOf('<div class="exercise-scene"'), html.indexOf('<section id="acompanamiento"'));
assert.ok(sceneMarkup.indexOf('strategy-objective') < sceneMarkup.indexOf('exercise-sequence'));
assert.ok(sceneMarkup.indexOf('exercise-sequence') < sceneMarkup.indexOf('immersive-copy'), 'Video sits between the two parts of the sentence');
assert.equal((sceneMarkup.match(/class="[^"]*strategy-line/g) || []).length, 2, 'Only two typographic groups converge');
assert.ok(html.includes('id="estrategia" role="region" aria-label="Cada objetivo necesita una estrategia"'));
assert.ok(html.includes('<span class="strategy-ink" aria-hidden="true">estrategia.</span>'));
assert.ok(!app.includes('exerciseCanvas'));
const strategyVideo = {}, coachVideo = {}, registered = [];
const registration = app.slice(app.indexOf('const strategyVideo ='), app.indexOf('function fitGallery('));
vm.runInNewContext(registration, { document: { querySelector: selector => selector === '.strategy-video' ? strategyVideo : coachVideo }, window: { ExomGallery: { register: (video, options) => registered.push([video, { ...options }]) } } });
assert.equal(strategyVideo.playbackRate, 1.15);
assert.equal(strategyVideo.defaultPlaybackRate, 1.15);
assert.deepEqual(registered, [[strategyVideo, { ready: true, preserveFrame: true }], [coachVideo, { ready: false, preserveFrame: true }]], 'Strategy uses visibility gating; coach still waits for its reveal');
const sceneTweens = [], colorTweens = [], triggers = [], gates = new Map();
let wordTop = 700;
const revealBounds = { start: 800, end: 1200 };
const viewportState = { scrollY: 1000, ExomGallery: { setReady: (video, ready) => gates.set(video, ready) } };
const strategyFrame = { style: { setProperty() {} }, getBoundingClientRect: () => ({ top: wordTop }) };
const fakeTimeline = { progress() { return this; }, invalidate() { return this; } };
vm.runInNewContext(app.slice(app.indexOf('    const strategyFrame ='), app.indexOf('  });\n  ScrollTrigger.refresh();')), {
  strategyVideo, coachVideo, innerHeight: 800, setupStrategyLetters() {},
  document: { querySelector: () => strategyFrame, querySelectorAll: () => lines },
  createStrategyTimeline: () => fakeTimeline, createCoachCopyTimeline: () => fakeTimeline,
  filmState: require('./motion.js').filmState, filmProgress: require('./motion.js').filmProgress,
  window: viewportState,
  gsap: { to: (state, options) => sceneTweens.push({ state, options }), fromTo: (target, from, options) => colorTweens.push({ target, from, options }) },
  ScrollTrigger: { create: options => { triggers.push(options); return revealBounds; } }
});
assert.equal(triggers.length, 1);
assert.equal(triggers[0].animation, fakeTimeline);
assert.equal(triggers[0].trigger, '.exercise-scene');
assert.equal(triggers[0].start, 'top 75%');
assert.equal(triggers[0].end, 'center center', 'The aperture finishes when the section is centered in the viewport');
assert.equal(triggers[0].scrub, .25);
assert.equal(typeof triggers[0].onRefresh, 'function', 'Refresh restores every letter at the curtain progress');
triggers[0].onRefresh({ progress: .5 });
assert.ok(!triggers[0].pin, 'Natural page flow, never pin the strategy section');
assert.equal(colorTweens.length, 1);
const color = colorTweens[0];
assert.equal(color.target, '.strategy-ink');
assert.equal(color.options.scrollTrigger.trigger, '.strategy-key', 'Paint follows the visible word, not the earlier video entrance');
assert.equal(color.options.scrollTrigger.start(), 1020, 'Paint starts at 55% of the opening, while letters are still emerging');
wordTop = 1000;
assert.equal(color.options.scrollTrigger.start(), 1296, 'If the word is below the viewport, wait until it is visible too');
wordTop = 700;
revealBounds.end = 1400;
assert.equal(color.options.scrollTrigger.start(), 1130, 'Refresh recalculates the overlap with the curtain');
viewportState.scrollY = 1100; wordTop = 600;
assert.equal(color.options.scrollTrigger.start(), 1130, 'Scrolling does not shift the document-space paint start');
assert.equal(color.options.scrollTrigger.end(), '+=128', 'Short paint sweep overlaps the opening without adding a long hold');
assert.equal(color.options.scrollTrigger.scrub, .25);
const ink = { clipPath: '' };
const paint = gsap.fromTo(ink, color.from, { ...color.options, scrollTrigger: undefined, paused: true });
try {
  for (let pass = 0; pass < 3; pass++) {
    paint.progress(0);
    assert.equal(ink.clipPath, 'inset(0 100% 0 0)');
    paint.progress(.5);
    assert.equal(ink.clipPath, 'inset(0 50% 0 0)');
    paint.progress(1);
    assert.equal(ink.clipPath, 'inset(0 0% 0 0)');
    paint.progress(0).invalidate().progress(0);
  }
} finally { paint.kill(); gsap.ticker.sleep(); }
assert.equal(sceneTweens.length, 1, 'Only the coach retains its progress-driven playback gate');
const { state, options } = sceneTweens[0];
for (const callback of [options.onUpdate, options.scrollTrigger.onRefresh]) {
  for (const progress of [0, .2, .3, .6, 1, .4, .2, 0, .3]) {
    state.progress = progress; callback();
    assert.equal(gates.get(coachVideo), progress >= .3, 'Coach playback remains correct on update, reverse and refresh');
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
const css = fs.readFileSync(__dirname + '/styles.css', 'utf8').replace(/calc\((\d+(?:\.\d+)?) \* var\(--home-(s?vh), 1\2\)\)/g, '$1$2');
assert.ok(css.includes("background:url('assets/strategy-training-poster.webp') center/cover;filter:blur(28px);opacity:.38"), 'Reuse the existing poster, not another playing video, for the X-style backdrop');
assert.match(css, /\.exercise-scene \.immersive-photo\{[^}]*background:transparent/, 'The inner stage must not cover the backdrop with its legacy black fill');
assert.equal((sceneMarkup.match(/<video /g) || []).length, 1);
assert.ok(!/\.exercise-scene\{height:\d+vh/.test(css), 'No old scroll runway remains at any breakpoint');
assert.ok(css.includes('.exercise-scene .immersive-photo{position:relative;top:auto;'), 'Strategy is not sticky');
assert.ok(!css.includes('.exercise-scene+#acompanamiento'), 'Strategy changes must not restyle the following section');
assert.ok(css.includes('body[data-motion="off"] .exercise-scene .strategy-line'));
assert.ok(css.includes('body[data-motion="off"] .exercise-scene .exercise-sequence,body[data-motion="off"] .strategy-ink{clip-path:none!important}'));
assert.ok(css.includes('  .exercise-scene .exercise-sequence,.strategy-ink{clip-path:none!important}'), 'Reduced motion shows the whole poster without an aperture');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce){\n  .exercise-scene .strategy-line'));
assert.ok(css.includes('.film-stage{height:370vh;min-height:0}'), 'Do not change the independent coaching sequence');
console.log('PASS: center-opening strategy curtain, poster backdrop, readable fallback, native playback and reverse/refresh.');
