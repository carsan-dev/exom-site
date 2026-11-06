(function () {
  'use strict';
  if (!/\biPhone\b/.test(navigator.userAgent) || !/\bGSA\/\d/.test(navigator.userAgent)) return;
  const root = document.documentElement;
  let width = window.innerWidth, resizeTimer;
  function measure() {
    // Some in-app browsers resize even svh/vh with their toolbar; retain the initial layout.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:100svh';
    document.body.append(probe);
    const small = probe.getBoundingClientRect().height;
    probe.style.height = '100vh';
    const large = probe.getBoundingClientRect().height;
    probe.remove();
    if (small > 0 && large > 0) {
      root.style.setProperty('--home-svh', `${small / 100}px`);
      root.style.setProperty('--home-vh', `${large / 100}px`);
    }
  }
  measure();
  window.addEventListener('resize', () => {
    // Toolbar, keyboard and pinch-zoom height changes must not resize the whole document.
    if (window.innerWidth === width) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      measure();
      window.ScrollTrigger?.refresh();
    }, 200);
  }, { passive: true });
})();
