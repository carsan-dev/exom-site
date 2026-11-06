'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { clamp, filmState, sequenceFrame, filmProgress, sequenceCounts, sceneSpecs, galleryCounts, gallerySpec, galleryProgress, galleryTravel, galleryTileCount, galleryTile, sceneTile, createSheetCache } = require('./motion.js');
const { createServer, resolveFile } = require('./serve.cjs');
require('./welcome-checks.cjs');
require('./navigation-checks.cjs');
require('./coach-copy-checks.cjs');
require('./story-checks.cjs');
require('./strategy-checks.cjs');
require('./home-viewport-checks.cjs');
require('./history-checks.cjs');

async function check() {
  await require('./utility-pages-checks.cjs')();
  await require('./form-checks.cjs')();
  await require('./application-checks.cjs')();
  await require('./form-client-checks.cjs')();
  await require('./application-http-checks.cjs')();
  await require('./gallery-shared-checks.cjs')();
  for (const viewport of [320, 390, 760, 1024, 1440, 2048, 2560, 3840, 7680]) {
    const mobile = viewport <= 760;
    const width = viewport * (mobile ? 2.5 : 1.6);
    const tile = mobile ? 118 : 180;
    const gap = mobile ? 6 : 10;
    const count = galleryTileCount(width, tile, gap);
    const trackWidth = count * (tile + gap) - gap;
    for (const x of [-galleryTravel, 0, galleryTravel]) {
      assert.ok(-galleryTravel + x <= 0, 'No exposed leading edge');
      assert.ok(-galleryTravel + x + trackWidth >= width, 'No exposed trailing edge');
    }
    assert.ok(count >= 12);
    assert.ok(count === 12 || (count - 1) * (tile + gap) - gap < width + 2 * galleryTravel, 'Only necessary copies');
  }
  if (process.argv[2]) {
    const { execFileSync } = require('node:child_process');
    // Keep the historical color regression against the unchanged D47 reference.
    const poster = path.join(__dirname, 'assets/scenes-v7/curl/poster.webp');
    const average = crop => {
      const pixels = execFileSync(process.argv[2], ['-v', 'error', '-i', poster, '-vf', 'scale=432:768:flags=area,crop=' + crop, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
      const rgb = [0, 0, 0];
      for (let i = 0; i < pixels.length; i++) rgb[i % 3] += pixels[i] / (pixels.length / 3);
      return rgb;
    };
    // Fixed source-frame regions catch the former highlight-to-white regression.
    const towel = average('20:20:330:465');
    const skin = average('20:20:231:468');
    const locker = average('12:12:284:280');
    assert.ok(towel[0] - towel[1] > 60 && towel[2] - towel[1] > 15, 'Pink towel retains chroma');
    assert.ok(skin[0] - skin[1] > 35 && skin[0] < 250, 'Skin is not bleached white');
    assert.ok(locker[0] - locker[2] > 80, 'Yellow locker retains chroma');
    console.log('PASS: decoded poster color regression (pink towel, skin, yellow locker).');
  }
  const requests = [];
  const waiting = new Map();
  const cache = createSheetCache(id => {
    requests.push(id);
    return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  assert.equal(cache.get('a'), null); cache.get('a'); cache.get('b'); cache.get('c');
  assert.deepEqual(requests, ['a', 'b'], 'Deduplicate and cap pending decodes at two');
  waiting.get('a').resolve('image-a'); waiting.get('b').resolve('image-b'); await settle();
  assert.equal(cache.get('a'), 'image-a');
  cache.get('c'); waiting.get('c').resolve('image-c'); await settle();
  cache.get('a'); cache.get('d'); waiting.get('d').resolve('image-d'); await settle();
  assert.equal(cache.get('b'), null, 'Evict least-recently-used sheet beyond three entries');
  const oldLoad = waiting.get('b'); cache.clear(); oldLoad.resolve('stale-image'); await settle();
  assert.equal(cache.get('b'), null, 'Late load after clear must not repopulate cache');
  waiting.get('b').resolve('new-image'); await settle();
  assert.equal(cache.get('b'), 'new-image');
  cache.get('broken'); waiting.get('broken').reject(Error('offline')); await settle();
  const requestCount = requests.length;
  for (let i = 0; i < 10; i++) assert.equal(cache.get('broken'), null);
  assert.equal(requests.length, requestCount, 'Failure keeps poster without a retry storm');
  cache.clear();
  assert.deepEqual(sceneTile(15, 'coach'), { page: 4, x: 720, y: 1280 });
  assert.deepEqual(sceneTile(16, 'coach'), { page: 5, x: 0, y: 0 });
  assert.deepEqual(sceneTile(3, 'training'), { page: 1, x: 720, y: 1280 });
  assert.deepEqual(sceneTile(4, 'training'), { page: 2, x: 0, y: 0 });
  assert.deepEqual(sceneTile(143, 'training'), { page: 36, x: 720, y: 1280 });
  assert.deepEqual(sceneSpecs.coach, { width: 720, height: 1280, columns: 2, directory: 'scenes-client-v1', quality: 82 });
  assert.equal(sceneSpecs.training.width, 720);
  assert.equal(sceneSpecs.training.height, 1280);
  let sceneBytes = 0;
  for (const [key, count] of Object.entries(sequenceCounts)) {
    const { width, height, columns, directory } = sceneSpecs[key];
    const sheets = Math.ceil(count / columns ** 2);
    assert.ok(width * height * columns ** 2 * 4 <= 432 * 768 * 16 * 4, 'A decoded RGBA sheet stays within the previous memory footprint');
    for (let page = 1; page <= sheets; page++) sceneBytes += fs.statSync(path.join(__dirname, 'assets', directory, key, 'sheet-' + String(page).padStart(2, '0') + '.webp')).size;
    for (let frame = 0; frame < count; frame++) {
      const tile = sceneTile(frame, key);
      assert.ok(tile.page >= 1 && tile.page <= sheets && tile.x + width <= columns * width && tile.y + height <= columns * height);
    }
  }
  assert.ok(sceneBytes < 18000000, 'Two higher-detail scenes under 18 MB');
  assert.deepEqual(galleryTile(0), { page: 1, x: 0, y: 0 });
  assert.deepEqual(galleryTile(3), { page: 1, x: 360, y: 640 });
  assert.deepEqual(galleryTile(4), { page: 2, x: 0, y: 0 });
  assert.deepEqual(galleryTile(76), { page: 20, x: 0, y: 0 });
  const galleryCapacity = Object.keys(galleryCounts).length * 4;
  assert.ok(gallerySpec.width * gallerySpec.height * gallerySpec.columns ** 2 * 4 * galleryCapacity < 180 * 320 * (80 + 7 * 60) * 4, 'Higher-resolution gallery retains less atlas RGBA than v6');
  const largeCache = createSheetCache(id => Promise.resolve(id), galleryCapacity);
  for (let i = 0; i < galleryCapacity; i++) { largeCache.get(String(i)); await settle(); }
  for (let i = 0; i < galleryCapacity; i++) assert.equal(largeCache.get(String(i)), String(i));
  largeCache.get('overflow'); await settle();
  assert.equal(largeCache.get('0'), null, 'Gallery cache is bounded at 24 sheets');
  largeCache.clear();
  async function coldGallery(capacity, concurrency, ahead) {
    let now = 0, missed = 0, peak = 0;
    const pending = [];
    const sheets = createSheetCache(id => new Promise(resolve => pending.push({ id, resolve, at: now + 48 })), capacity, concurrency);
    for (now = -500; now <= 2400; now += 16) {
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].at <= now) {
        pending[i].resolve(pending[i].id); pending.splice(i, 1);
      }
      await settle();
      const page = Math.floor(Math.round(Math.max(0, now) / 2400 * 95) / 4) + 1;
      if (now >= 0) for (let key = 0; key < 6; key++) if (!sheets.get(`${key}/${page}`)) missed++;
      for (let offset = 0; offset <= ahead; offset++) for (let key = 0; key < 6; key++) {
        if (page + offset <= 24) sheets.get(`${key}/${page + offset}`);
      }
      peak = Math.max(peak, pending.length);
    }
    return { missed, peak };
  }
  const oldCold = await coldGallery(18, 2, 2);
  const newCold = await coldGallery(galleryCapacity, 4, 3);
  assert.ok(oldCold.missed > 0 && newCold.missed < oldCold.missed / 4, 'Six cold sequences no longer starve behind two requests');
  assert.equal(newCold.peak, 4, 'Gallery parallelism is bounded; scenes retain the default two');
  console.log(`PASS: controlled cold-gallery simulation, missing samples ${oldCold.missed} -> ${newCold.missed} (48 ms/load, not a hardware benchmark).`);
  let galleryBytes = 0;
  for (const [key, count] of Object.entries(galleryCounts)) {
    const pages = Math.ceil(count / gallerySpec.columns ** 2);
    for (let page = 1; page <= pages; page++) galleryBytes += fs.statSync(path.join(__dirname, 'assets', gallerySpec.directory, key, 'sheet-' + String(page).padStart(2, '0') + '.webp')).size;
    assert.equal(sequenceFrame(1, count), count - 1);
    for (let i = 0; i < count; i++) {
      const tile = galleryTile(i);
      assert.ok(tile.page >= 1 && tile.page <= pages && tile.x >= 0 && tile.x + 360 <= 720 && tile.y >= 0 && tile.y + 640 <= 1280);
    }
  }
  assert.ok(galleryBytes < 14500000, 'Brighter complete-action gallery under 14.5 MB');
  assert.equal(clamp(-3), 0); assert.equal(clamp(4), 1); assert.equal(clamp(0.5), 0.5);
  assert.equal(filmState(0).scale, 0.76); assert.equal(filmState(1).scale, 1);
  assert.deepEqual(filmState(-1), filmState(0)); assert.deepEqual(filmState(2), filmState(1));
  assert.ok(filmState(0).clip.includes('50% 30%')); assert.ok(filmState(1).clip.includes('50% 0%'));
  assert.equal(sequenceFrame(-1,96),0); assert.equal(sequenceFrame(2,96),95);
  assert.equal(filmProgress(0.12).caption,1);
  assert.equal(filmProgress(0.3).reveal,1); assert.equal(filmProgress(0.3).caption,0);
  assert.equal(filmProgress(0.3).repetition,0);
  assert.ok(filmProgress(0.21).caption > 0 && filmProgress(0.21).caption < 1);
  assert.ok(filmProgress(0.31).repetition > 0, 'Coaching start immediately after the X opens');
  for (const progress of [-1,0,0.12,0.29,0.3,0.31,0.75,1,2]) {
    const phase = filmProgress(progress);
    assert.ok(phase.repetition === 0 || (phase.reveal === 1 && phase.caption === 0), 'No caption during repetitions, forward or backward');
  }
  assert.equal(filmProgress(1).repetition,1);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8').replace(/calc\((\d+(?:\.\d+)?) \* var\(--home-(s?vh), 1\2\)\)/g, '$1$2');
  assert.ok(css.includes('@media(min-width:761px){\n  .hero-media{display:flex;justify-content:center;align-items:flex-end;gap:0}\n  .hero-portrait{width:min(42%,75cqh);flex:0 1 auto;margin-inline:clamp(12px,3cqh,24px)}\n  .hero-client{flex:0 1 auto;min-width:0}\n}'), 'Only desktop groups the clips around the height-scaled portrait; mobile keeps its grid');
  assert.ok(css.includes('.hero-portrait{position:absolute;top:auto;bottom:0;left:5%;width:90%;height:90%;z-index:3}'), 'Mobile portrait stays larger, bottom anchored and in front of the clips');
  assert.ok(css.includes('.hero-client{width:auto;height:45%;max-width:100%;margin-bottom:20px;z-index:2;grid-column:1;grid-row:1;justify-self:start}') && css.includes('.hero-client:last-child{grid-column:2;margin-bottom:0;justify-self:end}'), 'Mobile clips are 25% smaller, offset and aligned to the outside edges');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert.ok(html.includes('<dialog class="welcome"') && !html.includes('<dialog open'), 'Welcome is hidden without JavaScript');
  assert.ok(html.indexOf('src="welcome.js"') < html.indexOf('src="app.js"'), 'Hero observes the welcome state before entering');
  assert.ok(html.includes('assets/vendor/SplitText.min.js'));
  assert.ok(fs.readFileSync(path.join(__dirname, 'assets/vendor/SplitText.min.js'), 'utf8').includes('SplitText 3.15.0'));
  const heading = { innerText: 'De deportista\na entrenador.', getAttribute: () => null, setAttribute(name, value) { this[name] = value; }, getBoundingClientRect: () => ({ bottom: 500 }) };
  const passedHeading = { getBoundingClientRect: () => ({ bottom: -10 }) };
  const revealOptions = [];
  const tweens = [];
  const harness = {
    revealFontsReady: false, window: { SplitText: {} }, revealedHeadings: new WeakSet(), headingSplits: [],
    document: { querySelectorAll: () => [heading, passedHeading, { id: 'hero-title' }] },
    gsap: { registerPlugin() {}, from(lines, options) { tweens.push(options); return options; } },
    SplitText: { create(element, options) { revealOptions.push(options); return { revert() {} }; } }
  };
  const { runInNewContext } = require('node:vm');
  const buildSource = fs.readFileSync(path.join(__dirname, 'build-media.cjs'), 'utf8');
  const buildCalls = [];
  const mediaConfig = require('./media-config.cjs');
  const buildRequire = name => name === 'node:fs' ? { mkdirSync() {} } : name === 'node:child_process' ? { spawnSync(command, args) { buildCalls.push(args); return { status: 0 }; } } : require(name);
  assert.deepEqual(mediaConfig.scenes[0], ['training', 'Entreno moi pierna.MOV', 25.5, 9.5]);
  assert.deepEqual(mediaConfig.scenes[1], ['coach', 'Acompañamiento entreno Moi Jose franciso.mov', 0, 3]);
  for (const [mode, expected] of [['--coach-only', 2], ['--gallery-only', 12], ['--scenes-only', 4], ['--training-only', 2], ['--clips-only', 10]]) {
    buildCalls.length = 0;
    runInNewContext(buildSource, { require: buildRequire, __dirname, console: { log() {} }, process: { argv: ['node', 'build-media.cjs', 'ffmpeg', mode] } });
    assert.equal(buildCalls.length, expected, 'Scoped export only writes its selected media');
    for (const args of buildCalls) {
      const destination = args.at(-1);
      assert.ok(!destination.endsWith('.webm'), 'Do not regenerate retired WebM alternatives');
      assert.ok(destination.startsWith(path.join(__dirname, 'assets') + path.sep), 'Exports stay inside V3');
      const filter = args[args.indexOf('-vf') + 1];
      const legSource = args[args.indexOf('-i') + 1].endsWith('Entreno moi pierna.MOV');
      assert.equal(filter.includes('curves='), legSource, 'Exposure correction applies only to the requested leg source, including its poster');
      if (legSource) {
        assert.ok(filter.includes("curves=all='0/0 .04/.10 .1/.24 .2/.43 .4/.65 .65/.84 .85/.94 1/1'"));
        assert.ok(filter.indexOf('curves=') > filter.indexOf('tonemapping=bt.2446a'), 'Lift shadows after SDR conversion');
        assert.equal(args[args.indexOf('-ss') + 1], '25.5');
      }
      if (mode === '--coach-only') {
        assert.ok(destination.includes(path.join(sceneSpecs.coach.directory, 'coach')));
        assert.equal(args[args.indexOf('-ss') + 1], '0');
      }
      if (mode === '--training-only') assert.ok(destination.includes(path.join(sceneSpecs.training.directory, 'training')));
      if (mode === '--gallery-only') assert.ok(destination.includes(gallerySpec.directory));
      if (mode === '--scenes-only') assert.ok(destination.includes(sceneSpecs.coach.directory));
      if (mode === '--clips-only') assert.ok(destination.includes('clients-v1'));
    }
  }
  assert.throws(() => runInNewContext(buildSource, { require: buildRequire, __dirname, process: { argv: ['node', 'build-media.cjs', 'ffmpeg', '--hinge-only'] } }), /Unknown media scope/);
  const primaryFiles = [...mediaConfig.clips, ...mediaConfig.scenes.filter(([key]) => key !== 'coach')].map(([, file]) => file);
  assert.equal(primaryFiles.length, 6);
  assert.equal(new Set(primaryFiles).size, 6, 'Each prominent position uses different source footage');
  const allClientFiles = new Set([...mediaConfig.gallery.map(([, file]) => file), ...mediaConfig.clips.map(([, file]) => file)]);
  assert.equal(allClientFiles.size, 8, 'All eight supplied client workouts are represented');
  const videoKeys = [...html.matchAll(/<source src="assets\/clients-v1\/([^".]+)\.mp4"/g)].map(match => match[1]);
  assert.equal(videoKeys.length, 5);
  assert.equal(new Set(videoKeys).size, 5, 'No duplicated MP4 between hero and triptych');
  assert.deepEqual([...videoKeys].sort(), mediaConfig.clips.map(([key]) => key).sort());
  assert.ok(html.includes('class="strategy-video"') && !html.includes('data-sequence="training"'));
  assert.equal(mediaConfig.clips.find(([key]) => key === 'carlos')[1], 'Entreno Carlos.mov', 'Hero restores the biceps curl');
  assert.equal(mediaConfig.gallery.find(([key]) => key === 'carlos')[1], 'Entreno carlos.mp4', 'Gallery replaces that curl with deadlift');
  assert.ok(html.slice(0, html.indexOf('<section id="metodo"')).includes('assets/clients-v1/carlos.mp4'));
  const approvedIntervals = { carlos: [18, 4], cristina: [5, 4], jesus: [0, 4], jose: [3, 3], lucia: [3, 4], miguel: [7, 4] };
  for (const [key, , start, duration] of mediaConfig.gallery) {
    assert.equal(galleryCounts[key], Math.round(duration * 24));
    assert.deepEqual([start, duration], approvedIntervals[key], 'Use the inspected client action, not preparation');
    for (const progress of [0, 0.2, 0.35, 0.6, 0.85, 1]) assert.equal(galleryProgress(progress), clamp((progress - 0.35) / 0.5));
    assert.equal(sequenceFrame(galleryProgress(0.85), galleryCounts[key]), galleryCounts[key] - 1);
  }
  for (const [key, , , duration] of mediaConfig.scenes) assert.equal(sequenceCounts[key], Math.round(duration * 24));
  const warmSource = app.slice(app.indexOf('function warmScenes()'), app.indexOf('const sceneProximity'));
  const warmDocument = { hidden: false, body: { dataset: { motion: 'on' } } };
  function warmedPages(key, current, direction) {
    const canvas = { dataset: { sequence: key } };
    const pages = [];
    runInNewContext(warmSource + '\nwarmScenes();', {
      document: warmDocument, nearbyScenes: new Set([canvas]), visibleCanvases: new Set([canvas]),
      motionFrames: new Map([[canvas, { current, direction }]]),
      sceneTile, sequenceCounts, sceneSpecs, sceneSheet: (name, page) => pages.push([name, page])
    });
    return pages;
  }
  assert.deepEqual(warmedPages('training', 0, 1), [['training', 1], ['training', 2], ['training', 3]]);
  assert.deepEqual(warmedPages('training', 227, -1), [['training', 57], ['training', 56], ['training', 55]]);
  assert.deepEqual(warmedPages('training', 227, 1), [['training', 57]]);
  assert.deepEqual(warmedPages('training', 0, -1), [['training', 1]]);
  assert.deepEqual(warmedPages('coach', 16, 1), [['coach', 5], ['coach', 6], ['coach', 7]], 'Coaching anticipate two sheets too');
  assert.deepEqual(warmedPages('coach', 71, -1), [['coach', 18], ['coach', 17], ['coach', 16]]);
  assert.deepEqual(warmedPages('coach', 71, 1), [['coach', 18]]);
  warmDocument.hidden = true;
  assert.deepEqual(warmedPages('training', 0, 1), [], 'No hidden-tab work');
  warmDocument.hidden = false; warmDocument.body.dataset.motion = 'off';
  assert.deepEqual(warmedPages('training', 0, 1), [], 'No paused prefetch');
  warmDocument.body.dataset.motion = 'on';
  const nearCurl = { dataset: { sequence: 'training' } }, nearPush = { dataset: { sequence: 'coach' } };
  const priorityRequests = [];
  const priorityHarness = { document: warmDocument, nearbyScenes: new Set([nearCurl, nearPush]), visibleCanvases: new Set([nearPush]), motionFrames: new Map([[nearCurl, { current: 227, direction: 1 }], [nearPush, { current: 6, direction: 1 }]]), sceneTile, sequenceCounts, sceneSpecs, sceneSheet: (key, page) => priorityRequests.push([key, page]) };
  runInNewContext(warmSource + '\nwarmScenes();', priorityHarness);
  assert.deepEqual(priorityRequests, [['coach', 2], ['coach', 3], ['coach', 4]], 'Offscreen curl cannot churn the visible coaching cache');
  priorityRequests.length = 0; priorityHarness.visibleCanvases.clear();
  runInNewContext(warmSource + '\nwarmScenes();', priorityHarness);
  assert.deepEqual(priorityRequests, [['training', 57]], 'Prepare one nearby scene at a time');
  assert.deepEqual(sequenceCounts, { training: 228, coach: 72 });
  assert.equal(Object.keys(galleryCounts).length, 6, 'The gallery features six client clips');
  assert.equal((css.match(/\.film-stage\{height:370vh;min-height:0\}/g) || []).length, 2, 'Extended X scene on desktop and mobile');
  const pushCanvas = { dataset: { sequence: 'coach' } };
  const pushState = { current: 0, target: 0, direction: 1 };
  const paintSource = app.slice(app.indexOf('function paintSequence('), app.indexOf('function renderSequences('));
  for (const [progress, expected, direction] of [[0,0,1],[1,71,1],[0.5,36,-1],[0,0,-1]]) {
    runInNewContext(paintSource + '\npaintSequence(canvas, progress);', { motionFrames: new Map([[pushCanvas, pushState]]), sequenceFrame, sequenceCounts, canvas: pushCanvas, progress });
    assert.equal(pushState.target, expected);
    assert.equal(pushState.direction, direction);
  }
  assert.equal(sceneTile(71, 'coach').page, 18, 'The complete inspected coaching interval is exported');
  const revealSource = app.slice(app.indexOf('function setupHeadingReveals()'), app.indexOf('function configureMotion()'));
  const setup = () => runInNewContext(revealSource + '\nsetupHeadingReveals();', harness);
  setup(); assert.equal(revealOptions.length, 0, 'Wait for fonts without hiding content');
  harness.revealFontsReady = true; harness.window.SplitText = null;
  setup(); assert.equal(revealOptions.length, 0, 'Missing plugin leaves text untouched');
  harness.window.SplitText = {};
  setup(); assert.equal(revealOptions.length, 1, 'Do not re-hide headings above the viewport');
  assert.equal(revealOptions[0].mask, 'lines'); assert.equal(revealOptions[0].autoSplit, true);
  assert.equal(revealOptions[0].aria, 'auto');
  let restored = false;
  const tween = revealOptions[0].onSplit({ lines: [], revert() { restored = true; } });
  assert.equal(heading['aria-label'], 'De deportista a entrenador.', 'Line breaks remain word boundaries for assistive technology');
  assert.equal(tween, tweens[0], 'Return tween for automatic resize cleanup');
  assert.equal(tween.scrollTrigger.once, true); assert.equal(tween.ease, 'power3.out');
  tween.onComplete(); assert.ok(restored && harness.revealedHeadings.has(heading));
  setup(); assert.equal(revealOptions.length, 1, 'Completed headings do not replay on resume');
  assert.ok(app.includes('headingSplits.forEach(split => split.revert())'), 'Pause restores unsplit accessible text');
  const practiceSource = app.slice(app.indexOf('function practiceAllowed('), app.indexOf("practiceButton.addEventListener('click'"));
  let playCalls = 0, completePlay, rejectPlay;
  const practiceVideo = {
    paused: true,
    play() {
      playCalls++;
      return new Promise((resolve, reject) => { completePlay = () => { this.paused = false; resolve(); }; rejectPlay = reject; });
    },
    pause() { this.paused = true; }
  };
  const practiceState = { visible: true, pending: false, failed: false, generation: 0 };
  const practiceHarness = {
    document: { hidden: false, body: { dataset: { motion: 'on' } } },
    practiceStates: new Map([[practiceVideo, practiceState]]), practicePaused: false,
    practiceButton: { setAttribute() {} }
  };
  const sync = () => runInNewContext(practiceSource + '\nsyncPractice();', practiceHarness);
  sync(); sync(); assert.equal(playCalls, 1, 'One pending play attempt per video');
  practiceState.visible = false; sync(); completePlay(); await settle();
  assert.equal(practiceVideo.paused, true, 'Late play resolution cannot restart an offscreen video');
  practiceState.visible = true; sync(); rejectPlay(Error('autoplay denied')); await settle();
  assert.equal(practiceState.failed, true);
  const failedPlayCalls = playCalls; sync(); sync();
  assert.equal(playCalls, failedPlayCalls, 'Playback errors do not cause retry storms');
  assert.equal(practiceHarness.practiceButton.textContent, 'Reintentar vídeos');
  practiceState.failed = false; sync(); completePlay(); await settle();
  assert.equal(practiceVideo.paused, false, 'Explicit retry can resume playback');
  practiceHarness.document.hidden = true; sync(); assert.equal(practiceVideo.paused, true);
  practiceHarness.document.hidden = false; practiceHarness.document.body.dataset.motion = 'off'; sync();
  assert.equal(practiceHarness.practiceButton.disabled, true, 'Reduced motion and global pause also disable clips');
  practiceHarness.document.body.dataset.motion = 'on'; practiceHarness.practicePaused = true; sync();
  assert.equal(practiceVideo.paused, true, 'Manual video pause is preserved');
  console.log('PASS: V3 existing video visibility, pause, late promises and explicit retry.');
  assert.equal((html.match(/class="form-step"/g) || []).length, 3);
  assert.equal((html.match(/<fieldset disabled>/g) || []).length, 3);
  assert.ok(html.includes('<label for="demo-residence-country">País de residencia habitual *</label><input id="demo-residence-country" name="country" maxlength="80" type="text" placeholder="País donde vives" autocomplete="off" required>'), 'D94 asks for residence, with a matching label and required input');
  assert.ok(!/demo-nationality|nacionalidad/i.test(html), 'The landing no longer asks for nationality');
  const application = html.slice(html.indexOf('<section class="section application"'), html.indexOf('</section>', html.indexOf('<section class="section application"')));
  assert.deepEqual(application.split('<div class="form-step"').slice(1).map(step => (step.match(/ \*<\/(?:label|legend)>/g) || []).length), [5, 3, 3], 'Keep all eleven questions in the approved three steps');
  assert.ok(application.includes("<fieldset class=\"choice-group\" id=\"demo-food\" aria-describedby=\"demo-food-help demo-food-medical\"><legend>¿Qué te cuesta más de la alimentación a la hora de alcanzar tu objetivo? *</legend><p class=\"small field-help\" id=\"demo-food-help\">Elige la opción que mejor describe tu principal dificultad.</p><p class=\"small field-help\" id=\"demo-food-medical\">No incluyas diagnósticos, medicación ni otra información médica.</p><label><input type=\"radio\" name=\"food\" value=\"quantities\" required> Las cantidades</label><label><input type=\"radio\" name=\"food\" value=\"schedules\" required> Los horarios</label><label><input type=\"radio\" name=\"food\" value=\"preparation\" required> Preparar las comidas</label><label><input type=\"radio\" name=\"food\" value=\"consistency\" required> Mantener la constancia</label><label><input type=\"radio\" name=\"food\" value=\"other\" required> Otra dificultad</label><label><input type=\"radio\" name=\"food\" value=\"none\" required> Ninguna dificultad</label></fieldset>"), 'D102 keeps Q7 required with exactly six closed choices and associated help');
  assert.match(css, /\.method-steps>li\{[^}]*align-items:baseline/, 'Method numbers share the first heading baseline, not the top of its box');
  assert.ok(css.includes('.choice-group input{accent-color:var(--lime);font:inherit;margin:calc((1.5em - 17px) / 2) 0 0;width:17px;height:17px;flex-shrink:0}'), 'Checkboxes and radios align to the first text line at both font sizes');
  assert.equal((html.match(/class="comparison"/g) || []).length, 3);
  assert.ok(html.includes('class="jose-after after-image"><img src="assets/jose-after-embedded.jpg"'), 'Clip the wrapper, not the enlarged photograph');
  assert.ok(css.includes('.jose-after img{width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(1.25)}'), 'Uniform after-photo zoom preserves proportions');
  assert.equal((html.match(/class="disclosure-icon"/g) || []).length, 5);
  assert.equal((html.match(/<form\b/g) || []).length, 1);
  assert.ok(html.includes('id="application-form"') && html.includes('method="post"'));
  assert.ok(html.includes('id="carlos-comparison"') && html.includes('carlos-personas-eliminadas-propuesta.png') && html.includes('Carlos ahora.jpg'));
  assert.ok(!html.includes('Pendiente identificar a Carlos'));
  assert.ok(!html.includes('Ver fotos completas') && !html.includes('Ver la app'));
  assert.equal((html.match(/data-testimonial-slot/g)||[]).length,3);
  assert.ok(html.includes('id="testimonios" aria-labelledby="testimonials-title" hidden'), 'Pending testimonials remain recoverable but hidden');
  assert.ok(css.includes('.testimonial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}'), 'Testimonial columns may shrink below their text intrinsic width');
  assert.ok(css.includes('padding:clamp(20px,2.5vw,28px)') && css.includes('font:800 clamp(28px,4vw,44px)/1 Barlow'), 'Testimonial copy and padding fit intermediate widths without clipping');
  assert.ok(css.includes('.testimonial-placeholder{padding:25px}') && css.includes('.testimonial-placeholder>p{font-size:36px}'), 'Mobile testimonial sizes remain unchanged');
  assert.ok(html.includes('id="galeria"'));
  assert.ok(app.includes("trigger: '.x-gallery'") && !app.includes('pin: true') && !app.includes('anticipatePin'));
  assert.ok(app.includes("start: 'top bottom', end: 'bottom top'"));
  assert.ok(!/wheel|touchmove|scrollTo\(/.test(app), 'Do not intercept or force scrolling');
  assert.ok(app.includes('image.decode()') && app.includes('visibleCanvases.has(canvas)'));
  assert.ok(!/warmGallery|paintGallery|renderGallery|gallerySheets/.test(app), 'V3 never requests or paints gallery atlases');
  assert.ok(!app.includes("trigger: '.ribbon-space'"));
  assert.ok(!css.includes('body[data-motion="on"] .x-gallery'));
  for (const key of Object.keys(galleryCounts)) assert.ok(html.includes('data-clip="' + key + '"'));
  assert.ok(!html.includes('app-showcase') && !html.includes('Siempre a mano.'));
  assert.ok(html.includes('GitHub de Carlos Sánchez Román') && html.includes('Portfolio de Carlos Sánchez Román'));
  assert.ok(!html.includes('photo-edit-note') && !html.includes('Foto anterior editada'));
  assert.ok(html.includes('Carlos antes, imagen editada para retirar a sus acompañantes'));
  for(const name of ['Entreno','Comida','Progreso']) assert.ok(html.includes('Captura App '+name+'.jpeg'));
  assert.ok(html.includes('ScrollTrigger.min.js') && !html.includes('autoplay'));
  assert.equal((html.match(/class="practice-video"/g)||[]).length,5);
  assert.equal((html.match(/type="video\/webm"/g)||[]).length,0);
  assert.equal((html.match(/<source src="assets\/clients-v1\/[^\"]+\.mp4" type="video\/mp4">/g)||[]).length,5);
  assert.ok(css.includes('.story{overflow:clip}'));
  assert.ok(html.includes('id="practice-toggle"') && html.includes('class="pose-triptych"'));
  const story = html.slice(html.indexOf('<section class="section story'), html.indexOf('<section class="section faq'));
  assert.ok(story.includes('Moi vestido taekwondo.png') && story.includes('story-expanded'));
  assert.ok(!story.includes('pose-triptych'), 'Biography is no longer a posing showcase');
  assert.ok(html.indexOf('id="metodo"') < html.indexOf('id="historia"') && html.indexOf('id="progreso"') < html.indexOf('id="historia"'), 'Method and client proof precede the short biography');
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<section id="metodo"'));
  assert.ok(hero.includes('class="hero hero-centered"') && hero.includes('class="hero-portrait"'));
  assert.ok(hero.replace(/<[^>]+>/g, '').includes('Tu cambio. Con mi método.'), 'Moi addresses the client with the approved headline');
  assert.ok(html.includes('contacto directo conmigo') && html.includes('Soy Moi.<br><em>Te acompaño.</em>'));
  assert.ok(!/contacto (?:directo )?con Moi|adaptamos tu planificación|tenemos en cuenta tus horarios/.test(html), 'Commercial copy speaks as Moi, not an external narrator or team');
  assert.ok(html.includes('llamadas cada dos semanas') && html.includes('no implica respuesta inmediata'), 'Personal voice preserves the service boundaries');
  assert.ok(hero.includes('../assets/media/images/derived/foto-portada-moi-transparent.png'), 'Reuse the original approved Moi cutout');
  assert.ok(hero.indexOf('class="hero-copy"') < hero.indexOf('class="hero-media"'), 'The promise and CTA precede the media');
  assert.ok(hero.indexOf('cristina.mp4') < hero.indexOf('class="hero-portrait"') && hero.indexOf('class="hero-portrait"') < hero.indexOf('carlos.mp4'), 'Moi is flanked by the existing row and curl clips');
  assert.equal((hero.match(/<video /g) || []).length, 2, 'No duplicated hero videos');
  assert.ok(css.includes('width:min(100%,1360px)') && css.includes('height:calc(100svh - 117px)') && css.includes('grid-template-rows:auto minmax(0,1fr) auto'), 'Hero allocates the available viewport height to media after copy and navigation');
  assert.ok(css.includes('height:calc(100svh - 97px)') && css.includes('@media(max-height:600px)'), 'Mobile accounts for its header and short windows retain readable content');
  assert.ok(app.includes("if (heading.id === 'hero-title') return;"), 'The hero has one entrance owner');
  const heroTimelines = [];
  const heroHarness = {
    heroIntroduced: false, innerWidth: 1440, window: {},
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 1000 }) }) },
    gsap: { timeline(options) {
      const timeline = { options, calls: [], from(target, values) { this.calls.push({ target, values }); return this; }, to(target, values) { this.calls.push({ target, values }); return this; } };
      heroTimelines.push(timeline); return timeline;
    } }
  };
  const heroMotionSource = app.slice(app.indexOf('function setupHeroMotion()'), app.indexOf('function configureMotion()'));
  const runHero = () => runInNewContext(heroMotionSource + '\nsetupHeroMotion();', heroHarness);
  runHero();
  assert.equal(heroTimelines.length, 2);
  assert.equal(heroTimelines[0].calls[1].target, '.hero-client video', 'Entrance never fights scroll container transforms');
  const opening = heroTimelines[1];
  assert.equal(opening.options.scrollTrigger.pin, undefined, 'No forced scroll distance');
  assert.equal(opening.options.scrollTrigger.invalidateOnRefresh, true);
  const clients = opening.calls[0].values;
  assert.ok(clients.x(0) < 0 && clients.x(1) > 0, 'Footage opens in opposite directions');
  assert.equal(clients.scale(), 1.06);
  heroHarness.innerWidth = 390;
  assert.equal(clients.x(0), -6); assert.equal(clients.y(1), 12); assert.equal(clients.scale(), 1);
  runHero(); assert.equal(heroTimelines.length, 3, 'Resume restores scroll without replaying entrance');
  heroHarness.heroIntroduced = false;
  heroHarness.document.querySelector = () => ({ getBoundingClientRect: () => ({ bottom: -1 }) });
  runHero(); assert.equal(heroTimelines.length, 4, 'Deep links do not animate an offscreen hero');
  heroHarness.window.ExomWelcome = { active: true };
  runHero(); assert.equal(heroTimelines.length, 4, 'Welcome owns the entrance until its curtain opens');
  assert.ok(app.includes('track.children.length % Object.keys(galleryCounts).length'), 'Wide ribbons repeat the current six-clip cycle, not the old eight-clip cycle');
  assert.ok(html.includes('class="section client-practice"') && html.includes('class="pose-triptych"'), 'Client triptych retains the existing entrance choreography');
  assert.ok(css.includes('width:min(100%,720px)'), 'Triptych keeps its approved dimensions');
  assert.ok(!/personal-practice|También<br>al otro|results-note|scroll-cue|film-instruction|compare-help/.test(html));
  assert.ok(html.includes('id="miguel-comparison"') && html.includes('miguel-after after-image'));
  assert.ok(html.includes('assets/progress/miguel-before-approved-v1.png') && html.includes('Miguel antes, imagen editada'), 'Use the approved edit with accurate alternative text');
  const approvedMiguel = fs.readFileSync(path.join(__dirname, 'assets/progress/miguel-before-approved-v1.png'));
  assert.equal(approvedMiguel.readUInt32BE(16), 1086);
  assert.equal(approvedMiguel.readUInt32BE(20), 1448);
  assert.equal(require('node:crypto').createHash('sha256').update(approvedMiguel).digest('hex'), 'cdb5c0d2383230a4f5bb399ca6b9ae1d9ec6d470692869e12862d496e28591fc');
  // Compare stable landmarks in frame-width units; no independent X/Y scaling.
  function miguelPoint(kind, size, point) {
    const rule = css.match(new RegExp('\\.miguel-' + kind + ' img\\{([^}]+)\\}'))[1];
    const percent = name => Number(rule.match(new RegExp('(?:^|;)' + name + ':(-?[\\d.]+)%'))[1]) / 100;
    const scale = percent('width') / size[0];
    const origin = rule.match(/transform-origin:([\d.]+)% ([\d.]+)%/);
    const ox = origin ? Number(origin[1]) / 100 * size[0] : 0;
    const oy = origin ? Number(origin[2]) / 100 * size[1] : 0;
    const angle = Number(rule.match(/rotate\((-?[\d.]+)deg\)/)?.[1] || 0) * Math.PI / 180;
    assert.ok(!/scale|skew|matrix/.test(rule), 'Preserve body proportions');
    return [percent('left') + scale * (ox + (point[0]-ox)*Math.cos(angle) - (point[1]-oy)*Math.sin(angle)),
      percent('top') * 4/3 + scale * (oy + (point[0]-ox)*Math.sin(angle) + (point[1]-oy)*Math.cos(angle))];
  }
  for (const [before, after] of [[[494,500],[592,1050]], [[512,894],[550,1480]]]) {
    const a = miguelPoint('before', [1086,1448], before), b = miguelPoint('after', [1152,2048], after);
    assert.ok(Math.abs(a[0]-b[0]) < .025 && Math.abs(a[1]-b[1]) < .01, 'Chest and navel remain aligned');
    assert.ok(Math.abs(a[0]-.5) < .025 && Math.abs(b[0]-.5) < .025, 'Body axis stays centered');
  }
  for (const [kind,size,head,waist] of [['before',[1086,1448],[475,38],[515,1040]], ['after',[1152,2048],[670,540],[550,1600]]]) {
    assert.ok(miguelPoint(kind,size,head)[1] >= 0, 'Keep the crown visible');
    assert.ok(miguelPoint(kind,size,waist)[1] < 1.15, 'Keep waist and space below it, not a torso-only crop');
  }
  assert.ok(!app.includes('advanceFrame') && !/scrub: 0\./.test(app));
  assert.ok(app.includes('state.current = state.target') && app.includes('page + state.direction'));
  assert.ok(app.includes('video.play()') && app.includes('state.generation') && app.includes('video.pause()'));
  for(const count of Object.values(sequenceCounts)) {
    for(const progress of [0,0.9,0.2,1,0.5,0.5]) assert.equal(sequenceFrame(progress,count),Math.round(progress*(count-1)));
  }
  const build=fs.readFileSync(path.join(__dirname,'build-media.cjs'),'utf8');
  assert.ok(build.includes('tonemapping=bt.2446a') && build.includes('contrast_recovery=0') && build.includes('format=yuv420p') && !build.includes('tonemap=tonemap=hable'));
  assert.ok(build.includes("'main'") && build.includes("'libx264'") && !build.includes("'libvpx-vp9'"));
  assert.ok(app.includes('createSheetCache') && !app.includes('frameImage('));
  assert.ok(app.includes('nearbyScenes.size') && app.includes('sceneSheets.clear()'));

  await require('./gallery-video-checks.cjs')();
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|WebSocket/.test(app));
  assert.ok(html.includes("connect-src 'self'; form-action 'self'"));
  assert.ok(html.includes('1.150 €') && html.includes('1.200 €') && html.includes('2.100 €') && html.includes('525 €'));
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1].startsWith('#')) {
      assert.ok(html.includes(`id="${match[1].slice(1)}"`), `Missing anchor: ${match[1]}`);
    } else {
      if (/^https?:/.test(match[1])) {
        assert.ok(['https://github.com/carsan-dev','https://csroman-dev.vercel.app/'].includes(match[1]), 'Only owner-provided credit links may be external');
        assert.ok(match[0].startsWith('href='), 'External assets are not allowed');
        continue;
      }
      if (match[1] === 'mailto:exom.method@gmail.com') {
        assert.ok(match[0].startsWith('href='), 'Privacy contact is a link, never a remote asset');
        continue;
      }
      const [file, anchor] = match[1].split('#');
      const target = path.resolve(__dirname, file);
      assert.ok(fs.existsSync(target), `Missing asset: ${file}`);
      if (anchor) assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${anchor}"`), `Missing anchor: ${match[1]}`);
    }
  }
  for (const name of ['index.html', 'styles.css', 'motion.js', 'app.js', 'welcome.js', 'welcome-checks.cjs', 'serve.cjs', 'checks.cjs', 'build-media.cjs', 'media-config.cjs']) assert.ok(!fs.readFileSync(path.join(__dirname, name)).includes(13), `CRLF: ${name}`);
  assert.throws(() => resolveFile('/../AGENTS.md'));
  assert.throws(() => resolveFile('/prototype-v4/serve.cjs'));
  assert.throws(() => resolveFile('/prototype-v4/%00'));
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/prototype-v4/')).status, 200);
    const atlas = await fetch(base + '/prototype-v4/assets/gallery-client-v1/lucia/sheet-24.webp');
    assert.equal(atlas.status, 200); assert.equal(atlas.headers.get('content-type'), 'image/webp');
    assert.equal(atlas.headers.get('cache-control'), 'no-store');
    assert.ok((await atlas.arrayBuffer()).byteLength > 0);
    const symbol = await fetch(base + '/prototype-v4/assets/exom-balance.svg');
    assert.equal(symbol.status, 200);
    assert.equal(symbol.headers.get('content-type'), 'image/svg+xml');
    assert.equal(symbol.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((await symbol.text()).includes('<svg'));
    const scene = await fetch(base + '/prototype-v4/assets/scenes-client-v1/coach/sheet-18.webp');
    assert.equal(scene.status, 200); assert.equal(scene.headers.get('content-type'), 'image/webp');
    assert.equal(scene.headers.get('cache-control'), 'no-store');
    assert.ok((await scene.arrayBuffer()).byteLength > 0);
    for (const name of ['carlos', 'cristina', 'jose', 'lucia', 'miguel-polea']) {
      const clip = await fetch(base + '/prototype-v4/assets/clients-v1/' + name + '.mp4', { headers: { Range: 'bytes=0-31' } });
      assert.equal(clip.status,206); assert.equal(clip.headers.get('content-type'),'video/mp4');
      assert.equal((await clip.arrayBuffer()).byteLength,32);
      assert.equal((await fetch(base + '/prototype-v4/assets/clients-v1/' + name + '.webm')).status,404);
    }
    assert.equal((await fetch(base + '/prototype-v4/', { method: 'POST', body: 'demo' })).status, 405);
    assert.equal((await fetch(base + '/prototype-v4/serve.cjs')).status, 404);
    assert.equal((await fetch(base + '/prototype-v4/application-server.cjs')).status, 404);
    assert.equal((await fetch(base + '/prototype-v4/api/solicitudes.mjs')).status, 404);
    const session = await (await fetch(base + '/prototype-v4/api/solicitudes')).json();
    assert.equal(session.simulated, true, 'Local server cannot select a real mail transport');
    const partial = await fetch(base + '/prototype-v4/assets/moi-training.mp4', { headers: { Range: 'bytes=0-31' } });
    assert.equal(partial.status, 206); assert.equal((await partial.arrayBuffer()).byteLength, 32);
    assert.equal((await fetch(base + '/prototype-v4/assets/moi-training.mp4', { headers: { Range: 'bytes=999999999-' } })).status, 416);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: motion boundaries, local assets/anchors, local simulated form isolation, copy, LF, server paths/methods and video ranges.');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
