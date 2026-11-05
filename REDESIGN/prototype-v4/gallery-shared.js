'use strict';
(() => {
  const gallery = document.querySelector('.ribbon-space');
  const tracks = [...document.querySelectorAll('.ribbon-track')];
  if (!gallery || !tracks.length || !window.ExomGallery) return;
  gallery.dataset.renderer = 'native';
  if (!HTMLVideoElement.prototype.captureStream) return;
  const nativePlayback = window.matchMedia('(max-width: 760px), (pointer: coarse)');
  let stopShared = null, failed = false;
  function selectRenderer() {
    if (stopShared) { stopShared(); stopShared = null; }
    if (!nativePlayback.matches && !failed) stopShared = startShared();
  }
  nativePlayback.addEventListener('change', selectRenderer);
  selectRenderer();

  function startShared() {
    const states = new Map(), sources = new Map();
    const bank = document.createElement('div');
    bank.hidden = true; bank.setAttribute('aria-hidden', 'true');
    document.body.append(bank);
    let active = true;
    const enabled = () => active && !document.hidden && document.body.dataset.motion === 'on';
    function fail() {
      if (!active) return;
      failed = true;
      stop();
    }
    function pause(video, state) {
      state.generation++;
      state.pending = false;
      video.pause();
    }
    function play(video, state) {
      if (!video.paused || state.pending) return;
      const generation = ++state.generation;
      state.pending = true;
      video.play().then(() => {
        // A retired display may already belong to native playback or a new pool.
        if (state.source && states.get(video) !== state) return;
        if (!active || !state.wanted) video.pause();
        if (generation === state.generation) state.pending = false;
      }).catch(() => {
        if (generation !== state.generation) return;
        state.pending = false;
        if (active && state.wanted) fail();
      });
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
            if (!source.video.getAttribute('src')) source.video.src = source.src;
            play(source.video, source);
          } else pause(source.video, source);
        }
        for (const [video, state] of states) {
          if (state.wanted && state.source.stream) {
            if (video.srcObject !== state.source.stream) video.srcObject = state.source.stream;
            play(video, state);
          } else { pause(video, state); video.classList.remove('is-playing'); }
        }
      } catch { fail(); }
    }
    function register(video) {
      if (states.has(video)) return;
      const src = video.dataset.src;
      if (!sources.has(src)) {
        const sourceVideo = document.createElement('video');
        sourceVideo.className = 'direct-pool-source';
        sourceVideo.muted = true; sourceVideo.playsInline = true; sourceVideo.loop = true; sourceVideo.preload = 'none';
        const source = { src, video: sourceVideo, stream: null, wanted: false, pending: false, generation: 0 };
        source.ready = () => {
          if (!active || source.stream) return;
          try {
            source.stream = sourceVideo.captureStream();
            if (!source.stream.getVideoTracks().length) throw Error('No captured video track');
            source.stream.getTracks().forEach(track => track.addEventListener('ended', fail));
            sync();
          } catch { fail(); }
        };
        sourceVideo.addEventListener('loadeddata', source.ready);
        sourceVideo.addEventListener('error', fail);
        sources.set(src, source); bank.append(sourceVideo);
      }
      window.ExomGallery.unregister(video);
      const state = { source: sources.get(src), visible: false, wanted: false, pending: false, generation: 0 };
      state.playing = () => {
        if (!active || states.get(video) !== state) return;
        if (state.wanted) video.classList.add('is-playing'); else video.pause();
      };
      video.addEventListener('playing', state.playing);
      video.addEventListener('error', fail);
      states.set(video, state); visibility.observe(video);
    }
    function remove(video, state) {
      state.wanted = false;
      visibility.unobserve(video); pause(video, state);
      video.removeEventListener('playing', state.playing); video.removeEventListener('error', fail);
      video.srcObject = null; video.classList.remove('is-playing');
      states.delete(video);
      video.load();
    }
    function inventory() {
      if (!active) return;
      try {
        for (const [video, state] of states) if (!video.isConnected) remove(video, state);
        gallery.querySelectorAll('.gallery-video').forEach(register);
        sync();
      } catch { fail(); }
    }
    function stop() {
      if (!active) return;
      active = false;
      visibility.disconnect(); inventoryObserver.disconnect(); motionObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      for (const [video, state] of states) {
        remove(video, state);
        if (video.isConnected) window.ExomGallery.register(video);
      }
      for (const source of sources.values()) {
        source.wanted = false; pause(source.video, source);
        source.stream?.getTracks().forEach(track => { track.removeEventListener('ended', fail); track.stop(); });
        source.video.removeEventListener('loadeddata', source.ready);
        source.video.removeEventListener('error', fail);
        source.video.removeAttribute('src'); source.video.load();
      }
      sources.clear(); bank.remove(); gallery.dataset.renderer = 'native';
      window.ExomGallery.sync();
    }
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.get(entry.target);
        if (state) state.visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      }
      sync();
    }, { threshold: [0, .2] });
    const inventoryObserver = new MutationObserver(inventory);
    const motionObserver = new MutationObserver(sync);
    tracks.forEach(track => inventoryObserver.observe(track, { childList: true }));
    motionObserver.observe(document.body, { attributes: true, attributeFilter: ['data-motion'] });
    document.addEventListener('visibilitychange', sync);
    gallery.dataset.renderer = 'direct-pool';
    inventory();
    return stop;
  }
})();
