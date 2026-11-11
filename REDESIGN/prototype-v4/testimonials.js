(() => {
  'use strict';
  const section = document.getElementById('testimonios');
  if (!section) return;
  const players = [...section.querySelectorAll('[data-testimonial-slot]')].map(slot => ({
    slot,
    video: slot.querySelector('video'),
    button: slot.querySelector('.testimonial-play'),
    message: slot.querySelector('.testimonial-error'),
    pending: false,
    started: false
  }));
  const tabs = [...section.querySelectorAll('[role="tab"]')];
  const stage = section.querySelector('.testimonial-grid');
  const position = section.querySelector('.testimonial-position');
  let selected = 0;
  let active = null;
  let suppressClickUntil = 0;
  function show(index, focusTab = false) {
    const next = (index + players.length) % players.length;
    if (next !== selected) {
      active = null;
      players.forEach(({ video }) => video.pause());
    }
    selected = next;
    players.forEach(({ slot, video, started }, i) => {
      const current = i === selected;
      slot.dataset.position = current ? 'active' : i === (selected + 1) % players.length ? 'next' : 'previous';
      slot.inert = !current;
      slot.setAttribute('aria-hidden', String(!current));
      video.controls = current && started;
      video.tabIndex = current && started ? 0 : -1;
      tabs[i].setAttribute('aria-selected', String(current));
      tabs[i].tabIndex = current ? 0 : -1;
    });
    position.textContent = (selected + 1) + ' de ' + players.length;
    if (focusTab) tabs[selected].focus({ preventScroll: true });
  }
  players.forEach(({ slot }, i) => {
    slot.id = 'testimonial-panel-' + i;
    slot.setAttribute('role', 'tabpanel');
    slot.setAttribute('aria-labelledby', tabs[i].id);
  });
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(i));
    tab.addEventListener('keydown', event => {
      const target = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: players.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      show(target, true);
    });
  });
  section.querySelectorAll('[data-testimonial-step]').forEach(button => {
    button.addEventListener('click', () => show(selected + Number(button.dataset.testimonialStep)));
  });
  let touch = null;
  stage.addEventListener('touchstart', event => {
    touch = null;
    if (event.touches.length !== 1) return;
    const point = event.touches[0];
    const bounds = players[selected].video.getBoundingClientRect();
    // Leave the native seek/volume controls to the browser.
    if (point.clientY >= bounds.bottom - 60 && point.clientY <= bounds.bottom && point.clientX >= bounds.left && point.clientX <= bounds.right) return;
    touch = { x: point.clientX, y: point.clientY };
  }, { passive: true });
  stage.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    if (Math.abs(point.clientX - touch.x) > 12 && Math.abs(point.clientX - touch.x) > Math.abs(point.clientY - touch.y) * 1.3) {
      event.preventDefault();
      active = null;
      players[selected].video.pause();
    }
  }, { passive: false });
  stage.addEventListener('touchend', event => {
    if (!touch) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
    suppressClickUntil = Date.now() + 350;
    show(selected + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('touchcancel', () => { touch = null; });
  stage.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  show(0);
  section.classList.add('is-carousel');
  section.querySelector('.testimonial-navigation').hidden = false;
  section.querySelector('.testimonial-pagination').hidden = false;
  function select(player) {
    active = player;
    players.forEach(other => { if (other !== player) other.video.pause(); });
  }
  players.forEach(player => {
    const { video, button, message } = player;
    const label = button.getAttribute('aria-label');
    const sync = () => {
      // The initial branded Play and native playback controls never overlap.
      button.hidden = player.started;
      video.controls = players[selected] === player && player.started;
      video.tabIndex = video.controls ? 0 : -1;
      button.disabled = player.pending;
      button.setAttribute('aria-label', player.pending ? 'Cargando testimonio' : label);
    };
    const failure = () => {
      player.started = false;
      message.textContent = 'No se ha podido reproducir el vídeo. Pulsa Play para reintentarlo.';
      message.hidden = false;
      sync();
    };
    button.addEventListener('click', async () => {
      if (player.pending || players[selected] !== player || Date.now() < suppressClickUntil) return;
      select(player);
      player.pending = true;
      message.hidden = true;
      video.muted = false;
      if (video.error) video.load();
      if (document.activeElement === button) video.focus({ preventScroll: true });
      sync();
      try {
        await video.play();
        // A delayed start must not revive a testimonial superseded by another one.
        if (active !== player || document.hidden) video.pause();
      } catch {
        if (active === player && !document.hidden) failure();
      } finally {
        player.pending = false;
        sync();
      }
    });
    video.addEventListener('play', () => {
      if (video.paused) return;
      if (document.hidden || players[selected] !== player || (player.pending && active !== player)) video.pause();
      else select(player);
      sync();
    });
    video.addEventListener('playing', () => {
      if (video.paused || document.hidden || players[selected] !== player || active !== player) return;
      player.started = true;
      message.hidden = true;
      sync();
    });
    ['pause', 'ended'].forEach(event => video.addEventListener(event, sync));
    video.addEventListener('error', failure);
    sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      active = null;
      players.forEach(({ video }) => video.pause());
    }
  });
})();
