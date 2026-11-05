(function () {
  'use strict';
  const state = window.ExomWelcome = { active: false };
  const dialog = document.querySelector('#welcome');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  // A slow script, restored scroll or direct section link must never add a late barrier.
  if (!dialog?.showModal || !window.gsap || preference.matches || document.hidden ||
      (location.hash && location.hash !== '#inicio') || scrollY > 40 || performance.now() > 1200 ||
      performance.getEntriesByType('navigation')[0]?.type === 'back_forward') return;
  try {
    if (sessionStorage.getItem('exom-welcome-seen') === '1') return;
    sessionStorage.setItem('exom-welcome-seen', '1');
    dialog.showModal();
  } catch { return; }

  state.active = true;
  document.documentElement.classList.add('welcome-open');
  let timeline;
  let finished = false;
  function reveal() {
    if (!state.active) return;
    state.active = false;
    window.dispatchEvent(new Event('exom:welcome-reveal'));
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);
    timeline?.kill();
    dialog.close();
    document.documentElement.classList.remove('welcome-open');
    preference.removeEventListener('change', finish);
    document.removeEventListener('visibilitychange', onVisibility);
    reveal();
  }
  function onVisibility() { if (document.hidden) finish(); }
  const safetyTimer = setTimeout(finish, 2000);
  document.querySelector('#welcome-skip').addEventListener('click', finish);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  preference.addEventListener('change', finish);
  document.addEventListener('visibilitychange', onVisibility);
  try {
    timeline = gsap.timeline({ onComplete: finish })
      .from('.welcome-logo', { yPercent: 110, duration: 0.45, ease: 'power3.out' }, 0)
      .from('#welcome-message', { y: 12, opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.15)
      .call(reveal, [], 0.9)
      .to(dialog, { yPercent: -100, duration: 0.5, ease: 'power3.inOut' }, 0.9);
  } catch { finish(); }
})();
