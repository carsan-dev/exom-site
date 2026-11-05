(function (root) {
  'use strict';
  const starts = [0, 1.3, 2.6, 4, 5.5, 7, 8.4, 11.3, 12.8];
  // End at the last reveal (12.8 + .04 + .25), without a trailing hold.
  const duration = 13.09;
  const archiveRange = [9.25, 10.85];
  const archiveProgress = (archiveRange[0] + .85) / duration;
  const path = [[0,0],[-.38,-.14],[.14,.18],[.44,.04],[.42,.08],[-.18,.36],[-.44,-.12],[.12,-.25],[0,0]];
  const clamp = value => Math.max(0, Math.min(1, value));
  function chapterAt(progress) {
    const time = clamp(progress) * duration;
    for (let i = starts.length - 1; i >= 0; i--) if (time >= starts[i] - .15) return i;
    return 0;
  }
  function chapterProgress(index) { return index <= 0 ? 0 : index >= starts.length - 1 ? 1 : (starts[index] + .24) / duration; }
  // A shared, C1-continuous spline: no independent camera restart at each chapter.
  function cameraAt(time, width, height) {
    let i = starts.findIndex((start, n) => n < starts.length - 1 && time < starts[n + 1]);
    if (i < 0) return { x: -path[8][0] * width, y: -path[8][1] * height, z: 8 * 1200 };
    const phase = clamp((time - starts[i]) / (starts[i + 1] - starts[i]));
    const t = phase - .85 * Math.sin(phase * Math.PI * 2) / (Math.PI * 2);
    const h = starts[i + 1] - starts[i];
    const coordinate = axis => {
      const prev = Math.max(0, i - 1), next = Math.min(8, i + 2);
      const a = path[i][axis], b = path[i + 1][axis];
      const m0 = i === 0 ? 0 : (b - path[prev][axis]) / (starts[i + 1] - starts[prev]);
      const m1 = i === 7 ? 0 : (path[next][axis] - a) / (starts[next] - starts[i]);
      return (2*t*t*t-3*t*t+1)*a + (t*t*t-2*t*t+t)*h*m0 + (-2*t*t*t+3*t*t)*b + (t*t*t-t*t)*h*m1;
    };
    // Smooth depth crossing keeps photos from snapping at a waypoint.
    const z0 = i * 1200, z1 = (i + 1) * 1200;
    const prev = Math.max(0, i - 1), next = Math.min(8, i + 2);
    const m0 = i === 0 ? 0 : (i + 1 - prev) * 1200 / (starts[i + 1] - starts[prev]);
    const m1 = i === 7 ? 0 : (next - i) * 1200 / (starts[next] - starts[i]);
    const z = (2*t*t*t-3*t*t+1)*z0 + (t*t*t-2*t*t+t)*h*m0 + (-2*t*t*t+3*t*t)*z1 + (t*t*t-t*t)*h*m1;
    return { x: -coordinate(0) * width, y: -coordinate(1) * height, z };
  }
  function createPresentIntro(gsap, memory, link) {
    return gsap.timeline({ paused: true })
      .fromTo(memory.lines, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .55, stagger: .12, ease: 'power2.out' }, 0)
      .fromTo(memory.note, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .35, ease: 'power2.out' }, .3)
      .fromTo(link, { opacity: 0 }, { opacity: 1, duration: .25 }, .55);
  }


  function createJourneyTimeline(gsap, memories, width, height, onUpdate, extras = {}) {
    const mobile = width <= 760;
    const cameras = memories.map(memory => memory.camera);
    const clock = { time: 0 };
    const timeline = gsap.timeline({ paused: true, onUpdate: () => {
      gsap.set(cameras, cameraAt(clock.time, width, height));
      onUpdate?.();
    }});
    timeline.to(clock, { time: duration, duration, ease: 'none' }, 0);
    memories.forEach((memory, index) => {
      const start = starts[index];
      const end = index === 6 ? archiveRange[0] : starts[index + 1];
      memory.photos.forEach(photo => {
        const x = mobile ? Number(photo.dataset.mobileX ?? (index === 8 ? 0 : Number(photo.dataset.x) * .38)) : Number(photo.dataset.x);
        const y = mobile ? Number(photo.dataset.mobileY ?? Number(photo.dataset.y) * .65) : Number(photo.dataset.y);
        gsap.set(photo, { xPercent: -50, yPercent: -50,
          x: (path[index][0] + x) * width,
          y: (path[index][1] + y) * height,
          z: -index * 1200 + Number(photo.dataset.z), opacity: 1, force3D: true });
      });
      gsap.set(memory.space, { autoAlpha: index ? 0 : 1 });
      gsap.set(memory.copy, { opacity: index ? 0 : 1, y: 0 });
      gsap.set(memory.lines, { clipPath: index ? 'inset(0% 0% 100% 0%)' : 'inset(0% 0% 0% 0%)' });
      gsap.set(memory.note, { opacity: index ? 0 : 1, y: index ? 12 : 0 });
      if (index) {
        timeline.to(memory.space, { autoAlpha: 1, duration: .55, ease: 'sine.out' }, start - .65)
          .to(memory.copy, { opacity: 1, duration: .22 }, start - .16)
          .to(memory.lines, { clipPath: 'inset(0% 0% 0% 0%)', duration: .26, stagger: .08, ease: 'power2.out' }, start - .1)
          .to(memory.note, { opacity: 1, y: 0, duration: .25 }, start + .04);
      }
      if (end !== undefined) {
        timeline.to(memory.copy, { opacity: 0, y: -16, duration: .28, ease: 'sine.in' }, end - .48)
          .to(memory.space, { autoAlpha: 0, duration: .5, ease: 'sine.in' }, end - .55);
      }
    });
    const { atmosphere = [], archive, tiles = [], caption } = extras;
    atmosphere.forEach((layer, i) => {
      gsap.set(layer, { opacity: 0, scale: 1.08, xPercent: i % 2 ? 4 : -4 });
      const from = [0, 5.2, 8.25][i], to = [5.9, 8.9, 14.1][i];
      const span = Math.min(to, duration) - from, fraction = span / (to - from);
      timeline.to(layer, { opacity: 1, duration: .8 }, from)
        .to(layer, { xPercent: (i % 2 ? 4 : -4) * (1 - 2 * fraction), scale: 1.08 - .08 * fraction, duration: span, ease: 'none' }, from);
      if (i < 2) timeline.to(layer, { opacity: 0, duration: .8 }, to - .8);
    });
    if (archive) {
      gsap.set(archive, { autoAlpha: 0, scale: 2.2 });
      gsap.set(caption, { opacity: 0, y: 16 });
      gsap.set(tiles, { opacity: 0, y: i => (i % 3 - 1) * height * .1 });
      timeline.to(archive, { autoAlpha: 1, scale: 1, duration: .9, ease: 'power2.out' }, archiveRange[0] - .2)
        .to(tiles, { opacity: 1, y: 0, duration: .55, stagger: { amount: .22, from: 'center' }, ease: 'power2.out' }, archiveRange[0] - .15)
        .to(caption, { opacity: 1, y: 0, duration: .3 }, archiveRange[0] + .5)
        .to(archive, { autoAlpha: 0, scale: .86, duration: .5, ease: 'sine.in' }, archiveRange[1] - .2);
    }
    return timeline;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createJourneyTimeline, createPresentIntro, chapterAt, chapterProgress, duration, path, starts, archiveRange, archiveProgress, cameraAt };
    return;
  }
  const button = document.querySelector('#history-motion');
  const journey = document.querySelector('.history-journey');
  const stage = document.querySelector('.journey-stage');
  const sections = [...document.querySelectorAll('.memory')];
  const links = [...document.querySelectorAll('.journey-stops a')];
  // Labels share the actual chapter destinations, including the longer archive interval.
  function destinationProgress(hash) {
    if (hash === '#recuerdos') return archiveProgress;
    const index = sections.findIndex(section => '#' + section.id === hash);
    return index < 0 ? undefined : chapterProgress(index);
  }
  links.forEach(link => { link.style.left = `${destinationProgress(link.getAttribute('href')) * 100}%`; });
  const progressBar = document.querySelector('.journey-track');
  const progressFill = document.querySelector('.journey-progress');
  const current = document.querySelector('#journey-current');
  const percent = document.querySelector('#journey-percent');
  const videos = [...document.querySelectorAll('#presente video')];
  const retry = document.querySelector('#pose-retry');
  const startLink = document.querySelector('.journey-start');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallHeight = window.matchMedia('(max-height: 560px)');
  const memories = sections.map(section => ({
    space: section.querySelector('.memory-space'), camera: section.querySelector('.memory-camera'), photos: [...section.querySelectorAll('.journey-photo')],
    copy: section.querySelector('.memory-copy'), lines: [...section.querySelectorAll('.memory-line')], note: section.querySelector('.memory-copy > p')
  }));
  const extras = { atmosphere: [...document.querySelectorAll('.atmosphere-layer')], archive: document.querySelector('.memory-archive'), tiles: [...document.querySelectorAll('.archive-photo')], caption: document.querySelector('.archive-caption') };
  let context, timeline, trigger, paused = false, savedProgress = 0, active = -1;
  let playPending = false, playFailed = false, playGeneration = 0, resizeTimer;
  let lastWidth = 0, lastHeight = 0;
  let intro, travel;

  function finishIntro() { intro?.progress(1).kill(); intro = null; }
  function stopTravel() { travel?.kill(); travel = null; }

  function poseAllowed() { return document.body.dataset.historyMotion === 'on' && savedProgress < .075 && !document.hidden && !playFailed; }
  function syncPose() {
    retry.hidden = !playFailed || document.body.dataset.historyMotion !== 'on' || savedProgress >= .075;
    if (!poseAllowed()) { playGeneration++; playPending = false; videos.forEach(video => video.pause()); return; }
    if (playPending || videos.every(video => !video.paused)) return;
    playPending = true;
    const generation = ++playGeneration;
    Promise.all(videos.filter(video => video.paused).map(video => video.play().then(() => {
      if (!poseAllowed()) video.pause();
    }))).then(() => {
      if (generation === playGeneration) playPending = false;
    }).catch(() => {
      if (generation !== playGeneration) return;
      playPending = false; playFailed = true; videos.forEach(video => video.pause()); retry.hidden = false;
    });
  }

  function reflectProgress(value) {
    if (lastWidth && (stage.clientWidth !== lastWidth || Math.abs(stage.clientHeight - lastHeight) > 80)) return;
    if (value > .015) finishIntro();
    savedProgress = value;
    const rounded = Math.round(value * 100);
    progressFill.style.transform = `scaleX(${value})`;
    progressBar.setAttribute('aria-valuenow', String(rounded));
    percent.textContent = String(rounded);
    const index = chapterAt(value);
    const inArchive = value * duration >= archiveRange[0] && value * duration <= archiveRange[1];
    current.textContent = inArchive ? 'Todo forma parte de mí' : sections[index].dataset.label;
    const activeId = inArchive ? 'recuerdos' : sections[index].id;
    if (activeId !== active) {
      active = activeId;

      sections.forEach((section, i) => { section.inert = inArchive || i !== index; section.setAttribute('aria-hidden', String(inArchive || i !== index)); });
      extras.archive.setAttribute('aria-hidden', String(!inArchive));
      links.forEach(link => { if (link.getAttribute('href') === '#' + activeId) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
    }
    syncPose();
  }

  function moveTo(progress, smooth = true) {
    if (!trigger) return;
    clearTimeout(resizeTimer);
    if (stage.clientWidth !== lastWidth || Math.abs(stage.clientHeight - lastHeight) > 80) configure(true);
    stopTravel(); finishIntro();
    const top = trigger.start + progress * (trigger.end - trigger.start);
    if (!smooth) { window.scrollTo({ top, behavior: 'instant' }); return; }
    const scroll = { top: window.scrollY };
    travel = root.gsap.to(scroll, {
      top, duration: 1.8, ease: 'power2.inOut',
      onUpdate: () => window.scrollTo({ top: scroll.top, behavior: 'instant' }),
      onComplete: () => { travel = null; }
    });
  }

  function configure(preserve = false) {
    stopTravel(); finishIntro();
    const progress = savedProgress;
    const restoreProgress = progress;
    const wasAnimated = document.body.dataset.historyMotion === 'on';
    trigger?.kill(); trigger = null;
    context?.revert(); context = null; timeline = null;
    const unavailable = !root.gsap || !root.ScrollTrigger;
    const off = paused || preference.matches || smallHeight.matches || unavailable;
    document.body.dataset.historyMotion = off ? 'off' : 'on';
    button.disabled = preference.matches || smallHeight.matches || unavailable;
    button.textContent = preference.matches ? 'Movimiento reducido' : unavailable || smallHeight.matches ? 'Sin efectos' : off ? 'Activar efectos' : 'Pausar efectos';
    button.setAttribute('aria-pressed', String(off));
    if (off) {
      savedProgress = progress;
      sections.forEach(section => { section.inert = false; section.removeAttribute('aria-hidden'); });
      extras.archive.removeAttribute('aria-hidden');
      if (preserve && wasAnimated) {
        const inArchive = progress * duration >= archiveRange[0] && progress * duration <= archiveRange[1];
        (inArchive ? extras.archive : sections[chapterAt(progress)]).scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      syncPose();
      return;
    }
    root.gsap.registerPlugin(root.ScrollTrigger);
    lastWidth = stage.clientWidth; lastHeight = stage.clientHeight;
    active = -1;
    context = root.gsap.context(() => {
      timeline = createJourneyTimeline(root.gsap, memories, lastWidth, lastHeight, () => { if (timeline) reflectProgress(timeline.progress()); }, extras);
      trigger = root.ScrollTrigger.create({ trigger: journey, start: 'top top', end: 'bottom bottom', animation: timeline, scrub: .7 });
    });
    root.ScrollTrigger.refresh();
    if (preserve) {
      window.scrollTo({ top: trigger.start + restoreProgress * (trigger.end - trigger.start), behavior: 'instant' });
      timeline.progress(restoreProgress);
    } else {
      reflectProgress(timeline.progress());
      if (savedProgress < .015 && !window.location.hash) {
        context.add(() => { intro = createPresentIntro(root.gsap, memories[0], startLink); intro.play(); });
      }
    }
  }

  document.querySelectorAll('.journey-stops a, .journey-start').forEach(link => link.addEventListener('click', event => {
    if (!trigger) return;
    const progress = destinationProgress(link.getAttribute('href'));
    if (progress === undefined) return;
    event.preventDefault(); moveTo(progress);
    // These chapters share one viewport; a native hash would realign it on resize.
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }));
  button.addEventListener('click', () => { paused = !paused; configure(true); });
  retry.addEventListener('click', () => { playFailed = false; syncPose(); });
  preference.addEventListener('change', () => configure(true));
  smallHeight.addEventListener('change', () => configure(true));
  document.addEventListener('visibilitychange', syncPose);
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(name => window.addEventListener(name, stopTravel, { passive: true }));
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (trigger && (stage.clientWidth !== lastWidth || Math.abs(stage.clientHeight - lastHeight) > 80)) configure(true);
    }, 180);
  });
  window.addEventListener('load', () => {
    root.ScrollTrigger?.refresh();
    const progress = destinationProgress(window.location.hash);
    if (progress !== undefined) {
      moveTo(progress, false);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
  document.fonts.ready.then(() => root.ScrollTrigger?.refresh());
  configure();
})(typeof window === 'undefined' ? globalThis : window);
