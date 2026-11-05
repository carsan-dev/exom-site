'use strict';
(() => {
  const states = new Map();
  const enabled = () => !document.hidden && document.body.dataset.motion === 'on';
  const allowed = state => enabled() && state.ready && state.visible && !state.failed && states.has(state.video);
  function sync() {
    for (const [video, state] of states) {
      if (enabled() && (state.near || state.visible) && !state.failed && (!video.getAttribute('src') || video.error)) {
        video.src = video.dataset.src;
        video.preload = 'auto';
        video.load();
      }
      if (!allowed(state)) {
        state.generation++;
        state.pending = false;
        video.pause();
        if (!state.preserveFrame || state.failed || document.body.dataset.motion !== 'on') video.classList.remove('is-playing');
        continue;
      }
      if (!video.paused || state.pending) continue;
      const generation = ++state.generation;
      state.pending = true;
      video.play().then(() => {
        if (!allowed(state)) video.pause();
        if (generation === state.generation) state.pending = false;
      }).catch(() => {
        if (generation !== state.generation) return;
        state.pending = false;
        state.failed = true;
        video.pause();
        video.classList.remove('is-playing');
        video.dispatchEvent(new Event('exom:playback-failed'));
      });
    }
  }
  const visible = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) state.visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
    });
    sync();
  }, { threshold: [0, 0.2] });
  const nearby = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) state.near = entry.isIntersecting;
    });
    sync();
  }, { rootMargin: '600px 0px' });
  function register(video, { ready = true, preserveFrame = false } = {}) {
    if (states.has(video)) return;
    video.muted = true;
    const state = { video, ready, preserveFrame, near: false, visible: false, pending: false, failed: false, generation: 0 };
    state.onPlaying = () => {
      if (allowed(state)) video.classList.add('is-playing');
      else video.pause();
    };
    state.onError = () => {
      state.failed = true;
      sync();
    };
    states.set(video, state);
    video.addEventListener('playing', state.onPlaying);
    video.addEventListener('error', state.onError);
    visible.observe(video);
    nearby.observe(video);
  }
  function setReady(video, ready) {
    const state = states.get(video);
    if (!state || state.ready === ready) return;
    state.ready = ready;
    sync();
  }
  function unregister(video) {
    const state = states.get(video);
    if (!state) return;
    state.generation++;
    state.visible = false;
    video.pause();
    video.removeEventListener('playing', state.onPlaying);
    video.removeEventListener('error', state.onError);
    visible.unobserve(video);
    nearby.unobserve(video);
    states.delete(video);
    video.removeAttribute('src');
    video.load();
  }
  document.querySelector('#motion-toggle').addEventListener('click', () => {
    states.forEach(state => { state.failed = false; });
  });
  window.ExomGallery = { register, unregister, setReady, sync };
  document.querySelectorAll('.gallery-video').forEach(video => register(video));
})();
