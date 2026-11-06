'use strict';
(() => {
  const gallery = document.querySelector('.ribbon-space');
  const tracks = [...document.querySelectorAll('.ribbon-track')];
  if (!gallery || !tracks.length || !window.ExomGallery) return;
  gallery.dataset.renderer = 'native';
  // Measured video-to-canvas cost in Gecko favors the existing native controller.
  if (/\brv:[\d.]+.*\bGecko\/\d/.test(navigator.userAgent)) return;
  if (!window.gsap?.ticker) return;
  const nativePlayback = window.matchMedia('(max-width: 760px), (pointer: coarse)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stopShared = null, failed = false;
  function selectRenderer() {
    if (stopShared) { stopShared(); stopShared = null; }
    if (!nativePlayback.matches && !failed) stopShared = startShared();
  }
  nativePlayback.addEventListener('change', selectRenderer);
  selectRenderer();

  function startShared() {
    const states = new Map(), sources = new Map(), bands = [];
    const bank = document.createElement('div');
    bank.hidden = true; bank.setAttribute('aria-hidden', 'true');
    document.body.append(bank);
    let active = true, near = false, warmupTimer = null, ticking = false;
    let dirty = true, layoutDirty = true, dpr = 1, resolution;
    const enabled = () => active && !document.hidden && !reducedMotion.matches && document.body.dataset.motion === 'on';
    function fail() {
      if (!active) return;
      failed = true;
      stop();
    }
    function pause(video, state) {
      state.generation++;
      state.pending = false;
      video.pause();
      if (state.frame !== null) {
        video.cancelVideoFrameCallback(state.frame);
        state.frame = null;
      }
    }
    function play(video, state) {
      if (!video.paused || state.pending) return;
      const generation = ++state.generation;
      state.pending = true;
      video.play().then(() => {
        if (!active || !state.wanted) video.pause();
        if (generation === state.generation) state.pending = false;
      }).catch(() => {
        if (generation !== state.generation) return;
        state.pending = false;
        if (active && state.wanted) fail();
      });
    }
    function watchFrame(source) {
      if (!active || !source.wanted || !source.video.requestVideoFrameCallback || source.frame !== null) return;
      const id = source.video.requestVideoFrameCallback(() => {
        if (!active || source.frame !== id) return;
        source.frame = null;
        dirty = true;
        watchFrame(source);
      });
      source.frame = id;
    }
    function invalidateLayout() { layoutDirty = true; dirty = true; }
    function watchResolution() {
      resolution?.removeEventListener('change', onResolution);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution.addEventListener('change', onResolution);
    }
    function onResolution() { invalidateLayout(); watchResolution(); }
    function measure() {
      dpr = window.devicePixelRatio || 1;
      for (const band of bands) {
        band.width = band.ribbon.clientWidth; band.height = band.ribbon.clientHeight;
        band.canvas.width = Math.round(band.width * dpr);
        band.canvas.height = Math.round(band.height * dpr);
        band.ctx.setTransform(band.canvas.width / band.width, 0, 0, band.canvas.height / band.height, 0, 0);
        band.ctx.imageSmoothingQuality = 'high';
      }
      for (const state of states.values()) {
        const tile = state.video.parentElement;
        let left = 0, top = 0;
        for (let node = tile; node && node !== state.band.ribbon; node = node.offsetParent) {
          left += node.offsetLeft; top += node.offsetTop;
        }
        state.rect = { left, top, width: tile.offsetWidth, height: tile.offsetHeight };
      }
      layoutDirty = false;
    }
    function clear() {
      for (const band of bands) if (band.painted) {
        band.ctx.clearRect(0, 0, band.width, band.height);
        band.painted = false;
      }
    }
    function draw() {
      if (!enabled() || !ticking) return;
      try {
        if (layoutDirty) measure();
        const fallbackFrame = [...sources.values()].some(source => source.wanted && !source.video.paused && !source.video.requestVideoFrameCallback);
        for (const band of bands) {
          const x = Number(window.gsap.getProperty(band.track, 'x'));
          if (!dirty && !fallbackFrame && x === band.lastX) continue;
          band.lastX = x;
          band.ctx.clearRect(0, 0, band.width, band.height);
          band.painted = true;
          for (const state of states.values()) {
            if (state.band !== band || !state.wanted) continue;
            const video = state.source.video, rect = state.rect, left = rect.left + x;
            if (left >= band.width || left + rect.width <= 0 || video.readyState < 2 || !video.videoWidth || !video.videoHeight) continue;
            const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
            const width = video.videoWidth * scale, height = video.videoHeight * scale;
            band.ctx.drawImage(video, left + (rect.width - width) / 2, rect.top + (rect.height - height) / 2, width, height);
          }
        }
        dirty = false;
      } catch { fail(); }
    }
    function prepare(source) {
      source.video.preload = 'auto';
      source.video.src = source.src;
      source.video.load();
    }
    function scheduleWarmup() {
      const next = [...sources.values()].find(source => !source.video.getAttribute('src'));
      if (!enabled() || !near || !next) {
        clearTimeout(warmupTimer); warmupTimer = null;
      } else if (warmupTimer === null) {
        // Spread decoder startup instead of moving one six-video burst earlier.
        warmupTimer = setTimeout(() => {
          warmupTimer = null;
          if (!enabled() || !near) return;
          try { if (!next.video.getAttribute('src')) prepare(next); sync(); }
          catch { fail(); }
        }, 120);
      }
    }
    function sync() {
      if (!active) return;
      try {
        for (const source of sources.values()) source.wanted = false;
        for (const state of states.values()) {
          state.wanted = enabled() && state.visible;
          if (state.wanted) state.source.wanted = true;
        }
        for (const source of sources.values()) {
          if (source.wanted) {
            if (!source.video.getAttribute('src')) prepare(source);
            play(source.video, source);
            watchFrame(source);
          } else pause(source.video, source);
        }
        scheduleWarmup();
        dirty = true;
        const wanted = [...sources.values()].some(source => source.wanted);
        if (wanted && !ticking) {
          ticking = true;
          // Append after GSAP's timeline update; never run a competing animation clock.
          window.gsap.ticker.add(draw);
        } else if (!wanted) {
          window.gsap.ticker.remove(draw); ticking = false; clear();
        }
      } catch { fail(); }
    }
    function register(video, band) {
      if (states.has(video)) return;
      const src = video.dataset.src;
      if (!sources.has(src)) {
        const sourceVideo = document.createElement('video');
        sourceVideo.className = 'direct-pool-source';
        sourceVideo.muted = true; sourceVideo.playsInline = true; sourceVideo.loop = true; sourceVideo.preload = 'none';
        const source = { src, video: sourceVideo, frame: null, wanted: false, pending: false, generation: 0 };
        source.ready = () => {
          if (active) dirty = true;
        };
        sourceVideo.addEventListener('loadeddata', source.ready);
        sourceVideo.addEventListener('error', fail);
        sources.set(src, source); bank.append(sourceVideo);
      }
      window.ExomGallery.unregister(video);
      video.classList.remove('is-playing');
      const state = { video, band, source: sources.get(src), visible: false, wanted: false };
      states.set(video, state); visibility.observe(video);
    }
    function remove(video, state) {
      state.wanted = false;
      visibility.unobserve(video); video.pause();
      video.classList.remove('is-playing');
      states.delete(video);
      video.load();
    }
    function inventory() {
      if (!active) return;
      try {
        for (const [video, state] of states) if (!video.isConnected) remove(video, state);
        for (const band of bands) band.track.querySelectorAll('.gallery-video').forEach(video => register(video, band));
        invalidateLayout();
        sync();
      } catch { fail(); }
    }
    function stop() {
      if (!active) return;
      active = false;
      clearTimeout(warmupTimer); warmupTimer = null;
      visibility.disconnect(); nearby.disconnect(); inventoryObserver.disconnect(); motionObserver.disconnect(); sizeObserver.disconnect();
      window.gsap.ticker.remove(draw); ticking = false;
      if (window.ExomGallery.draw === draw) delete window.ExomGallery.draw;
      resolution?.removeEventListener('change', onResolution);
      reducedMotion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      for (const [video, state] of states) {
        remove(video, state);
        if (video.isConnected) window.ExomGallery.register(video);
      }
      for (const source of sources.values()) {
        source.wanted = false; pause(source.video, source);
        source.video.removeEventListener('loadeddata', source.ready);
        source.video.removeEventListener('error', fail);
        source.video.removeAttribute('src'); source.video.load();
      }
      sources.clear(); bank.remove(); gallery.dataset.renderer = 'native';
      bands.forEach(band => band.canvas.remove());
      window.ExomGallery.sync();
    }
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.get(entry.target);
        if (state) state.visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      }
      sync();
    }, { threshold: [0, .2] });
    const nearby = new IntersectionObserver(entries => {
      near = entries.some(entry => entry.isIntersecting);
      sync();
    }, { rootMargin: '1200px 0px' });
    nearby.observe(gallery);
    const inventoryObserver = new MutationObserver(inventory);
    const motionObserver = new MutationObserver(sync);
    const sizeObserver = new ResizeObserver(invalidateLayout);
    tracks.forEach(track => inventoryObserver.observe(track, { childList: true }));
    motionObserver.observe(document.body, { attributes: true, attributeFilter: ['data-motion'] });
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    try {
      for (const track of tracks) {
        const canvas = document.createElement('canvas'), ribbon = track.parentElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('Canvas 2D unavailable');
        canvas.className = 'ribbon-canvas'; canvas.setAttribute('aria-hidden', 'true');
        ribbon.append(canvas);
        bands.push({ ribbon, track, canvas, ctx, lastX: NaN, painted: false });
        sizeObserver.observe(ribbon);
      }
      watchResolution();
      gallery.dataset.renderer = 'canvas-2d';
      window.ExomGallery.draw = draw;
      inventory();
    } catch { fail(); }
    return active ? stop : null;
  }
})();
