'use strict';

const { clamp, filmState, sequenceFrame, filmProgress, sequenceCounts, sceneSpecs, galleryCounts, galleryTravel, galleryTileCount, sceneTile, createSheetCache } = window.ExomMotion;
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.querySelector('#motion-toggle');
const canvases = [...document.querySelectorAll('canvas[data-sequence]')];
const motionFrames = new Map();
let effectsPaused = false;
let motionContext;
let revealFontsReady = false;
const revealedHeadings = new WeakSet();
const revealedQualifications = new WeakSet();
let headingSplits = [];
let heroIntroduced = false;
const sceneCanvases = canvases;
const nearbyScenes = new Set();
function loadSheet(src) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image.decode().then(() => image);
}
const sceneSheets = createSheetCache(loadSheet);
const visibleCanvases = new Set();

const canvasVisibility = new IntersectionObserver(entries => {
  entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) visibleCanvases.add(target);
    else visibleCanvases.delete(target);
  });
});
canvases.forEach(canvas => canvasVisibility.observe(canvas));
const strategyVideo = document.querySelector('.strategy-video');
strategyVideo.defaultPlaybackRate = strategyVideo.playbackRate = 1.15;
const coachVideo = document.querySelector('.coach-video');
window.ExomGallery.register(strategyVideo, { ready: false, preserveFrame: true });
window.ExomGallery.register(coachVideo, { ready: false, preserveFrame: true });

function fitGallery() {
  document.querySelectorAll('.ribbon-track').forEach(track => {
    const gap = parseFloat(getComputedStyle(track).columnGap);
    const count = galleryTileCount(track.parentElement.clientWidth, track.firstElementChild.offsetWidth, gap);
    track.style.marginLeft = -galleryTravel + 'px';
    while (track.children.length < count) {
      const tile = track.children[track.children.length % Object.keys(galleryCounts).length].cloneNode(true);
      tile.setAttribute('aria-hidden', 'true');
      tile.querySelector('img').alt = '';
      const video = tile.querySelector('video');
      video.removeAttribute('src');
      video.classList.remove('is-playing');
      track.append(tile);
      window.ExomGallery.register(video);
    }
    while (track.children.length > count) {
      const tile = track.lastElementChild;
      window.ExomGallery.unregister(tile.querySelector('video'));
      tile.remove();
    }
  });
}
fitGallery();
const gallerySize = new ResizeObserver(fitGallery);
document.querySelectorAll('.ribbon').forEach(ribbon => gallerySize.observe(ribbon));

function sceneSheet(key, page) {
  return sceneSheets.get('assets/' + sceneSpecs[key].directory + '/' + key + '/sheet-' + String(page).padStart(2, '0') + '.webp');
}

function warmScenes() {
  if (document.hidden || document.body.dataset.motion !== 'on') return;
  // Nearby scenes share three slots; never let an offscreen scene evict the visible one.
  const visible = [...nearbyScenes].find(canvas => visibleCanvases.has(canvas));
  for (const canvas of visible ? [visible] : [...nearbyScenes].slice(0, 1)) {
    const state = motionFrames.get(canvas);
    if (!state) continue;
    const key = canvas.dataset.sequence;
    const page = sceneTile(Math.round(state.current), key).page;
    sceneSheet(key, page);
    // Four-frame sheets need a longer runway without growing the three-sheet cache.
    for (let ahead = 1; ahead <= 2; ahead++) {
      const next = page + state.direction * ahead;
      if (next > 0 && next <= Math.ceil(sequenceCounts[key] / sceneSpecs[key].columns ** 2)) sceneSheet(key, next);
    }
  }
}
const sceneProximity = new IntersectionObserver(entries => {
  entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) nearbyScenes.add(target);
    else nearbyScenes.delete(target);
  });
  if (!nearbyScenes.size) sceneSheets.clear();
  warmScenes();
}, { rootMargin: '1200px 0px' });
sceneCanvases.forEach(canvas => sceneProximity.observe(canvas));

function drawSequence(canvas, frame) {
  if (canvas.dataset.frame === String(frame)) return;
  const tile = sceneTile(frame, canvas.dataset.sequence);
  const { width, height } = sceneSpecs[canvas.dataset.sequence];
  const image = sceneSheet(canvas.dataset.sequence, tile.page);
  if (!image) return;
  if (canvas.width !== width) { canvas.width = width; canvas.height = height; }
  canvas.getContext('2d').drawImage(image, tile.x, tile.y, width, height, 0, 0, width, height);
  canvas.dataset.frame = String(frame);
  canvas.classList.add('is-ready');
}

function paintSequence(canvas, progress) {
  const state = motionFrames.get(canvas);
  const target = sequenceFrame(progress, sequenceCounts[canvas.dataset.sequence]);
  if (target !== state.target) state.direction = Math.sign(target - state.target);
  state.target = target;
}

function renderSequences() {
  if (document.hidden || document.body.dataset.motion !== 'on') return;
  for (const [canvas, state] of motionFrames) {
    if (!visibleCanvases.has(canvas)) { state.current = state.target; continue; }
    state.current = state.target;
    drawSequence(canvas, Math.round(state.current));
  }
  warmScenes();
}

function setupHeadingReveals() {
  if (!revealFontsReady || !window.SplitText) return;
  gsap.registerPlugin(SplitText);
  document.querySelectorAll('main h1, main h2, .gallery-heading h3').forEach(heading => {
    if (heading.id === 'hero-title') return;
    if (revealedHeadings.has(heading)) return;
    if (heading.getBoundingClientRect().bottom <= 0) {
      revealedHeadings.add(heading);
      return;
    }
    const readableText = heading.getAttribute('aria-label') || heading.innerText.replace(/\s+/g, ' ').trim();
    headingSplits.push(SplitText.create(heading, {
      type: 'lines', mask: 'lines', linesClass: 'reveal-line', autoSplit: true, aria: 'auto',
      onSplit(self) {
        heading.setAttribute('aria-label', readableText);
        return gsap.from(self.lines, {
          yPercent: 115, duration: 0.75, stagger: 0.085, ease: 'power3.out',
          scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
          onComplete() {
            revealedHeadings.add(heading);
            self.revert();
          }
        });
      }
    }));
  });
}

function setupFormationMotion() {
  document.querySelectorAll('.qualification-group').forEach(group => {
    if (revealedQualifications.has(group) || group.getBoundingClientRect().bottom <= 0) return;
    gsap.from(group.querySelectorAll('.qualification-item > span'), {
      yPercent: 110, duration: 0.65, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: { trigger: group, start: 'top 88%', once: true },
      onComplete: () => revealedQualifications.add(group)
    });
  });
}

function setupHeroMotion() {
  if (window.ExomWelcome?.active) return;
  const hero = document.querySelector('.hero');
  // Entrance uses the children; scroll owns their containers, so neither overwrites the other.
  if (!heroIntroduced && hero.getBoundingClientRect().bottom > 0) {
    heroIntroduced = true;
    gsap.timeline({ defaults: { duration: 0.8, ease: 'power3.out' } })
      .from('.hero-title-part > *', { yPercent: 115, stagger: 0.14 }, 0)
      .from('.hero-client video', { clipPath: 'inset(0 0 100% 0)', x: index => index ? 32 : -32, stagger: 0.12 }, 0.2);
  }
  const opening = gsap.timeline({
    scrollTrigger: { trigger: '.hero-media', start: 'top 65%', end: 'bottom 40%', scrub: 1, invalidateOnRefresh: true }
  });
  opening.to('.hero-client', {
    x: index => (index ? 1 : -1) * (innerWidth <= 760 ? 6 : Math.min(48, innerWidth * 0.035)),
    y: index => (index ? 1 : -1) * (innerWidth <= 760 ? 12 : 38),
    scale: () => innerWidth <= 760 ? 1 : 1.06, ease: 'none'
  }, 0)
    .to('.hero-portrait', { y: () => innerWidth <= 760 ? 0 : 22, ease: 'none' }, 0)
    .to('.hero-brand', { y: () => innerWidth <= 760 ? 24 : 90, ease: 'none' }, 0);
}

function strategyPlaybackReady(progress, width, height) {
  if (!width || !height) return false;
  // The 9:16 video can be uncovered before the mask finishes crossing its empty margins.
  const mediaWidth = Math.min(width, height * 9 / 16);
  const insetX = (width - mediaWidth) * 50 / width;
  const insetY = (height - mediaWidth * 16 / 9) / (2 * height);
  const reveal = gsap.parseEase('power2.inOut')(clamp(progress / .6));
  // Match the actual four-decimal polygon coordinates produced by GSAP.
  const edge = Math.round(42 * (1 - reveal) * 1e4) / 1e4;
  return edge - 30 * insetY <= insetX;
}

function createStrategyTimeline(frame, key, ink, rule) {
  // Prepare the complete composition before the first ScrollTrigger update.
  gsap.set(frame, { clipPath: 'polygon(42% 0%,88% 0%,58% 100%,12% 100%)' });
  gsap.set(key, { clipPath: 'polygon(-30% 0%,0% 0%,-30% 100%,-60% 100%)' });
  gsap.set(ink, { clipPath: 'polygon(-30% 0%,0% 0%,-30% 100%,-60% 100%)' });
  gsap.set(rule, { scaleX: 0 });
  return gsap.timeline({ paused: true })
    .to(frame, { clipPath: 'polygon(0% 0%,130% 0%,100% 100%,-30% 100%)', duration: .6, ease: 'power2.inOut' }, 0)
    .to(key, { clipPath: 'polygon(-30% 0%,130% 0%,100% 100%,-60% 100%)', duration: .35, ease: 'none' }, .2)
    .to(ink, { clipPath: 'polygon(-30% 0%,130% 0%,100% 100%,-60% 100%)', duration: .35, ease: 'none' }, .25)
    .to(rule, { scaleX: 1, duration: .25, ease: 'power2.inOut' }, .35)
    // The final 40% drives the reversible writing, not an empty hold.
    .to({}, { duration: .4 }, .6);
}

function createCoachCopyTimeline(start, end, bridge) {
  // One shared sentence travels below the action; mobile keeps its reading position.
  return gsap.timeline({ paused: true })
    .fromTo(start, { opacity: 1, x: 0 }, { opacity: 0, x: () => innerWidth <= 760 ? 0 : -20, duration: 0.18, ease: 'power1.in' }, 0.12)
    .fromTo(bridge, { x: 0 }, { x: () => innerWidth <= 760 ? 0 : end.offsetLeft - start.offsetLeft, duration: 0.66, ease: 'power2.inOut' }, 0.28)
    .fromTo(end, { opacity: 0, x: () => innerWidth <= 760 ? 0 : 24 }, { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out' }, 0.68);
}

function createStrategyTyping(video, note) {
  const copy = note.dataset.copy;
  let started = false, progress = 0, failed = false;
  const render = () => {
    const written = Math.floor(clamp((progress - .6) / .4) * copy.length);
    note.textContent = failed || document.body.dataset.motion !== 'on' ? copy : started ? copy.slice(0, written) : '';
  };
  const finish = () => {
    failed = true;
    render();
  };
  video.addEventListener('playing', () => {
    if (video.paused || document.body.dataset.motion !== 'on' || !video.classList.contains('is-playing')) return;
    started = true;
    render();
  });
  video.addEventListener('error', finish);
  video.addEventListener('exom:playback-failed', finish);
  return { progress(value) { progress = value; render(); }, sync() {
    if (video.error) failed = true;
    render();
  } };
}
function configureMotion() {
  headingSplits.forEach(split => split.revert());
  headingSplits = [];
  motionFrames.clear();
  sceneCanvases.forEach(canvas => motionFrames.set(canvas, { current: 0, target: 0, direction: 1 }));
  sceneCanvases.forEach(canvas => paintSequence(canvas, 0));
  motionContext?.revert();
  window.ExomGallery.setReady(strategyVideo, false);
  window.ExomGallery.setReady(coachVideo, false);
  const paused = effectsPaused || motionPreference.matches || !window.gsap || !window.ScrollTrigger;
  document.body.dataset.motion = paused ? 'off' : 'on';
  strategyTyping.sync();
  motionButton.textContent = motionPreference.matches ? 'Movimiento reducido' : paused ? 'Activar efectos' : 'Pausar efectos';
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.disabled = motionPreference.matches || !window.gsap || !window.ScrollTrigger;
  canvases.forEach(canvas => { canvas.dataset.frame = ''; });
  if (paused) {
    sceneSheets.clear();
    canvases.forEach(canvas => canvas.classList.remove('is-ready'));
    syncPractice();
    window.ExomGallery.sync();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  motionContext = gsap.context(() => {
    setupHeadingReveals();
    setupFormationMotion();
    gsap.from('.pose-panel', {
      x: index => (index - 1) * 65, y: index => index === 1 ? 110 : 60,
      rotation: index => (index - 1) * 12, opacity: 0,
      ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: '.pose-triptych', start: 'top 90%', end: 'center 60%', scrub: true }
    });
    setupHeroMotion();
    const galleryTimeline = gsap.timeline({
      // ScrollTrigger may update outside the ticker; paint after both tracks move.
      onUpdate: () => window.ExomGallery.draw?.(),
      scrollTrigger: {
        trigger: '.x-gallery',
        start: 'top bottom', end: 'bottom top',
        scrub: true, invalidateOnRefresh: true
      }
    });
    document.querySelectorAll('.ribbon-track').forEach(track => {
      const direction = Number(track.dataset.direction);
      galleryTimeline.fromTo(track, { x: -galleryTravel * direction }, {
        x: galleryTravel * direction, duration: 1, ease: 'none'
      }, 0);
    });
    const exerciseState = { progress: 0 };
    const strategyFrame = document.querySelector('.exercise-sequence');
    const strategyTimeline = createStrategyTimeline(
      strategyFrame, document.querySelector('.strategy-key'), document.querySelector('.strategy-ink'),
      document.querySelector('.strategy-rule')
    );
    gsap.to(exerciseState, {
      progress: 1, ease: 'none', onUpdate: () => {
        strategyTimeline.progress(exerciseState.progress);
        window.ExomGallery.setReady(strategyVideo, strategyPlaybackReady(exerciseState.progress, strategyFrame.clientWidth, strategyFrame.clientHeight));
        strategyTyping.progress(exerciseState.progress);
      },
      scrollTrigger: {
        trigger: '.exercise-scene', start: () => innerWidth <= 760 ? 'top top+=70' : 'top top+=86', end: 'bottom bottom', scrub: true,
        onRefresh: () => {
          strategyTimeline.progress(0).invalidate().progress(exerciseState.progress);
          window.ExomGallery.setReady(strategyVideo, strategyPlaybackReady(exerciseState.progress, strategyFrame.clientWidth, strategyFrame.clientHeight));
          strategyTyping.progress(exerciseState.progress);
        }
      }
    });
    const filmStateValue = { progress: 0 };
    const frame = document.querySelector('.film-frame');
    const copyTimeline = createCoachCopyTimeline(
      document.querySelector('.film-title-start'), document.querySelector('.film-title-end'), document.querySelector('.film-bridge')
    );
    const initialShape = filmState(0);
    frame.style.setProperty('--film-scale', initialShape.scale);
    frame.style.setProperty('--film-clip', initialShape.clip);
    gsap.to(filmStateValue, {
      progress: 1, ease: 'none',
      onUpdate: () => {
        const phase = filmProgress(filmStateValue.progress);
        const shape = filmState(phase.reveal);
        frame.style.setProperty('--film-scale', shape.scale);
        frame.style.setProperty('--film-clip', shape.clip);
        copyTimeline.progress(filmStateValue.progress);
        window.ExomGallery.setReady(coachVideo, phase.reveal === 1);
      },
      scrollTrigger: {
        trigger: '.film-stage', start: () => innerWidth <= 760 ? 'top top+=70' : 'top top+=86', end: 'bottom bottom', scrub: true,
        // Rewind before invalidating: otherwise fromTo can retain the finished opacity on resize.
        onRefresh: () => {
          copyTimeline.progress(0).invalidate().progress(filmStateValue.progress);
          window.ExomGallery.setReady(coachVideo, filmProgress(filmStateValue.progress).reveal === 1);
        }
      }
    });
  });
  ScrollTrigger.refresh();
  syncPractice();
  window.ExomGallery.sync();
}
const strategyTyping = createStrategyTyping(strategyVideo, document.querySelector('.strategy-typed'));
motionButton.addEventListener('click', () => { effectsPaused = !effectsPaused; configureMotion(); });
motionPreference.addEventListener('change', configureMotion);
const practiceStates = new Map([...document.querySelectorAll('.practice-video')].map(video => [video, { visible: false, pending: false, failed: false, generation: 0 }]));
const practiceButton = document.querySelector('#practice-toggle');
let practicePaused = false;
function practiceAllowed(state) {
  return state.visible && !state.failed && !practicePaused && !document.hidden && document.body.dataset.motion === 'on';
}
function updatePracticeButton() {
  const failed = [...practiceStates.values()].some(state => state.failed);
  practiceButton.disabled = document.body.dataset.motion !== 'on';
  practiceButton.textContent = failed ? 'Reintentar vídeos' : practicePaused ? 'Reproducir vídeos' : 'Pausar vídeos';
  practiceButton.setAttribute('aria-pressed', String(practicePaused));
}
function syncPractice() {
  for (const [video, state] of practiceStates) {
    if (!practiceAllowed(state)) {
      state.generation++;
      state.pending = false;
      video.pause();
      continue;
    }
    if (!video.paused || state.pending) continue;
    const generation = ++state.generation;
    state.pending = true;
    video.play().then(() => {
      // An old play promise cannot restart an offscreen or paused video.
      if (!practiceAllowed(state)) video.pause();
      if (generation === state.generation) state.pending = false;
    }).catch(() => {
      if (generation !== state.generation) return;
      state.pending = false;
      state.failed = true;
      video.pause();
      updatePracticeButton();
    });
  }
  updatePracticeButton();
}
practiceButton.addEventListener('click', () => {
  const failed = [...practiceStates.values()].some(state => state.failed);
  practicePaused = failed ? false : !practicePaused;
  practiceStates.forEach(state => { state.failed = false; });
  syncPractice();
  window.ExomGallery.sync();
});
const practiceVisibility = new IntersectionObserver(entries => {
  entries.forEach(entry => { practiceStates.get(entry.target).visible = entry.isIntersecting && entry.intersectionRatio >= 0.2; });
  syncPractice();
  window.ExomGallery.sync();
}, { threshold: [0, 0.2] });
practiceStates.forEach((state, video) => practiceVisibility.observe(video));
window.addEventListener('exom:welcome-reveal', () => {
  if (!motionPreference.matches && document.body.dataset.motion === 'on') motionContext?.add(setupHeroMotion);
});
configureMotion();
window.gsap?.ticker.add(renderSequences);
document.addEventListener('visibilitychange', () => {
  syncPractice();
  window.ExomGallery.sync();
  if (!document.hidden) warmScenes();
});
document.fonts.ready.then(() => {
  revealFontsReady = true;
  if (document.body.dataset.motion === 'on') motionContext?.add(setupHeadingReveals);
  window.ScrollTrigger?.refresh();
});

document.querySelectorAll('.comparison input').forEach(slider => {
  function updateComparison() {
    const percent = clamp(Number(slider.value), 0, 100);
    slider.closest('.comparison').style.setProperty('--reveal', `${percent}%`);
    slider.setAttribute('aria-valuetext', `${percent} % antes, ${100 - percent} % después`);
  }
  slider.addEventListener('input', updateComparison);
  updateComparison();
});
