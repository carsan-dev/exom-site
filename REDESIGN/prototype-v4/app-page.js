(function (root) {
  'use strict';

  function createScreenTimeline(gsap, screens, track) {
    const timeline = gsap.timeline({ paused: true });
    gsap.set(screens[0], { autoAlpha: 1, xPercent: 0 });
    gsap.set(screens.slice(1), { autoAlpha: 0, xPercent: 100 });
    timeline.set(screens[0], { autoAlpha: 1, xPercent: 0 }, 0);
    timeline.set(screens.slice(1), { autoAlpha: 0, xPercent: 100 }, 0);
    screens.slice(1).forEach((screen, i) => {
      const start = i + 1 - .175;
      timeline.addLabel('screen-' + (i + 2), i + 1);
      timeline.set(screen, { autoAlpha: 1 }, start);
      timeline.fromTo(screens[i], { xPercent: 0 }, { xPercent: -100, duration: .35, ease: 'power2.inOut', immediateRender: false }, start);
      timeline.fromTo(screen, { xPercent: 100 }, { xPercent: 0, duration: .35, ease: 'power2.inOut', immediateRender: false }, start);
    });
    timeline.fromTo(track, { scaleX: 0 }, { scaleX: 1, duration: screens.length, ease: 'none' }, 0);
    return timeline;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createScreenTimeline };
  if (!root.document) return;
  const { document, gsap, ScrollTrigger } = root;
  const films = [...document.querySelectorAll('.app-film-video')];
  const portraitFilm = root.matchMedia('(max-width: 600px)');
  const filmPlay = document.querySelector('.app-film-play');
  let pendingFilm = null, failedFilm = null;
  const currentFilm = () => films.find(video => video.classList.contains('app-film-portrait') === portraitFilm.matches);
  function syncFilmButton() {
    const video = currentFilm();
    filmPlay.hidden = !video || (!video.paused && !video.ended);
    filmPlay.disabled = pendingFilm === video;
    filmPlay.setAttribute('aria-label', pendingFilm === video ? 'Cargando vídeo de EXOM' : failedFilm === video ? 'Reintentar reproducción de EXOM' : 'Reproducir presentación de EXOM');
  }
  filmPlay.addEventListener('click', async () => {
    const video = currentFilm();
    if (!video || pendingFilm === video) return;
    if (document.activeElement === filmPlay) video.focus({ preventScroll: true });
    pendingFilm = video; failedFilm = null; syncFilmButton();
    try {
      await video.play();
      if (currentFilm() !== video || document.hidden) video.pause();
    }
    catch { failedFilm = video; }
    finally { if (pendingFilm === video) pendingFilm = null; syncFilmButton(); }
  });
  films.forEach(video => ['playing', 'pause', 'ended', 'error'].forEach(event => video.addEventListener(event, syncFilmButton)));
  portraitFilm.addEventListener('change', syncFilmButton);
  syncFilmButton();
  // A manually started video must not keep playing when its layout or tab is hidden.
  portraitFilm.addEventListener('change', () => films.forEach(video => {
    if (video.classList.contains('app-film-portrait') !== portraitFilm.matches) video.pause();
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) films.forEach(video => video.pause());
  });
  const button = document.getElementById('app-motion');
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = root.matchMedia('(min-width: 901px) and (min-height: 621px)');
  let paused = false, context, introduced = false;
  const stage = document.querySelector('.app-screen-stage');
  const counter = document.querySelector('.app-screen-count');
  const screens = [...stage.querySelectorAll('.app-screen-stack .app-capture')];
  const total = String(screens.length).padStart(2, '0');

  function readingPosition() {
    const elements = [...document.querySelectorAll('[data-reading]')];
    const element = elements.reduce((best, next) => Math.abs(next.getBoundingClientRect().top) < Math.abs(best.getBoundingClientRect().top) ? next : best);
    return { element, top: element.getBoundingClientRect().top };
  }

  function configure(preserve = false) {
    const reading = preserve ? readingPosition() : null;
    context?.revert();
    context = null;
    const active = !paused && !reduced.matches;
    document.body.dataset.appMotion = active ? 'on' : 'off';
    button.disabled = reduced.matches;
    button.textContent = active ? 'Pausar efectos' : 'Sin efectos';
    button.setAttribute('aria-pressed', String(!active));
    counter.textContent = '01 — ' + total;
    if (active) {
      context = gsap.context(() => {
        if (!introduced && root.scrollY < 40 && !root.location.hash) {
          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
          intro.from('.app-title-line>*', { yPercent: 110, duration: .85, stagger: .1 }, 0);
          intro.from('.app-hero-media .app-phone', { y: 120, rotationY: 22, opacity: 0, duration: 1.2, stagger: .12 }, .15);
          intro.from('.app-hero-copy>p, .app-hero-copy>.button', { y: 16, opacity: 0, duration: .6, stagger: .1 }, .5);
        }
        introduced = true;
        const hero = gsap.timeline({ scrollTrigger: { trigger: '.app-hero', start: 'top top', end: 'bottom top', scrub: true } });
        hero.to('.app-phone-left', { xPercent: desktop.matches ? -28 : -8, yPercent: -8, rotation: -20, ease: 'none' }, 0);
        hero.to('.app-phone-right', { xPercent: desktop.matches ? 28 : 8, yPercent: 10, rotation: 20, ease: 'none' }, 0);
        hero.to('.app-phone-main', { yPercent: -12, rotation: 2, ease: 'none' }, 0);
        hero.to('.app-hero-word', { y: 85, ease: 'none' }, 0);
        gsap.from('.app-film-window', { scale: desktop.matches ? .84 : .94, clipPath: 'inset(8% 6% 8% 6%)', ease: 'none', scrollTrigger: { trigger: '.app-film-window', start: 'top 95%', end: 'top 22%', scrub: true } });
        document.querySelectorAll('.app-section-heading h2, .app-daily-intro h2, .app-access-heading h2').forEach(title => {
          gsap.from(title, { y: 45, clipPath: 'inset(0% 0% 100% 0%)', duration: .9, ease: 'power3.out', scrollTrigger: { trigger: title, start: 'top 92%', once: true } });
        });
        if (desktop.matches) {
          const sequence = createScreenTimeline(gsap, screens, document.querySelector('.app-screen-track span'));
          ScrollTrigger.create({ trigger: '.app-features', start: 'top 20%', end: 'bottom bottom', animation: sequence, scrub: true, onUpdate: self => {
            const current = 1 + Object.values(sequence.labels).filter(time => time <= self.progress * sequence.duration()).length;
            counter.textContent = String(current).padStart(2, '0') + ' — ' + total;
          } });
        } else {
          document.querySelectorAll('.app-feature-image').forEach((photo, i) => {
            gsap.from(photo, { y: 45, rotation: i % 2 ? 4 : -4, scale: .94, ease: 'none', scrollTrigger: { trigger: photo, start: 'top 95%', end: 'center 60%', scrub: true } });
          });
        }
      });
    }
    ScrollTrigger.refresh();
    if (reading) root.scrollBy({ top: reading.element.getBoundingClientRect().top - reading.top, behavior: 'instant' });
  }

  button.addEventListener('click', () => { paused = !paused; configure(true); });
  reduced.addEventListener('change', () => configure(true));
  desktop.addEventListener('change', () => configure(true));
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  root.addEventListener('load', () => ScrollTrigger.refresh());
  configure();
})(typeof window === 'undefined' ? globalThis : window);
