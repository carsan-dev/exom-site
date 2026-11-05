(function (root) {
  'use strict';
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  function filmState(progress) {
    const p = clamp(progress);
    const notch = 30 * (1 - p);
    return {
      scale: 0.76 + p * 0.24,
      clip: `polygon(0% 0%,20% 0%,50% ${notch}%,80% 0%,100% 0%,${100 - notch}% 50%,100% 100%,80% 100%,50% ${100 - notch}%,20% 100%,0% 100%,${notch}% 50%)`
    };
  }
  const sequenceCounts = { training: 144, coach: 72 };
  const sceneSpecs = {
    training: { width: 720, height: 1280, columns: 2, directory: 'scenes-client-v1', quality: 82 },
    coach: { width: 720, height: 1280, columns: 2, directory: 'scenes-client-v1', quality: 82 }
  };
  function sequenceFrame(progress, count) {
    return Math.round(clamp(progress) * (count - 1));
  }
  function filmProgress(progress) {
    const p = clamp(progress);
    return { reveal: clamp(p / 0.3), caption: 1 - clamp((p - 0.12) / 0.18), repetition: clamp((p - 0.3) / 0.7) };
  }
  const galleryCounts = { carlos: 96, cristina: 96, jesus: 96, jose: 72, lucia: 96, miguel: 96 };
  const gallerySpec = { width: 360, height: 640, columns: 2, directory: 'gallery-client-v1', quality: 82 };
  function galleryProgress(progress) {
    // These repetitions belong in the visible bands, not the heading's approach.
    return clamp((progress - 0.35) / 0.5);
  }
  const galleryTravel = 120;
  function galleryTileCount(width, tileWidth, gap) {
    return Math.max(12, Math.ceil((width + 2 * galleryTravel + gap) / (tileWidth + gap)));
  }
  function galleryTile(frame) {
    const { width, height, columns } = gallerySpec;
    const size = columns * columns;
    const cell = frame % size;
    return { page: Math.floor(frame / size) + 1, x: cell % columns * width, y: Math.floor(cell / columns) * height };
  }
  function sceneTile(frame, key) {
    const { width, height, columns } = sceneSpecs[key];
    const size = columns * columns;
    const cell = frame % size;
    return { page: Math.floor(frame / size) + 1, x: cell % columns * width, y: Math.floor(cell / columns) * height };
  }
  function createSheetCache(load, capacity = 3, maxPending = 2) {
    const entries = new Map();
    const failed = new Set();
    let pending = 0;
    return {
      get(id) {
        if (entries.has(id)) {
          const entry = entries.get(id);
          entries.delete(id); entries.set(id, entry);
          return entry.image;
        }
        if (failed.has(id) || pending >= maxPending) return null;
        const entry = { image: null };
        entries.set(id, entry);
        while (entries.size > capacity) entries.delete(entries.keys().next().value);
        pending++;
        load(id).then(image => {
          if (entries.get(id) === entry) entry.image = image;
        }).catch(() => {
          if (entries.get(id) === entry) failed.add(id);
        }).finally(() => { pending--; });
        return null;
      },
      clear() { entries.clear(); failed.clear(); }
    };
  }
  const api = { clamp, filmState, sequenceFrame, filmProgress, sequenceCounts, sceneSpecs, galleryCounts, gallerySpec, galleryProgress, galleryTravel, galleryTileCount, galleryTile, sceneTile, createSheetCache };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExomMotion = api;
})(typeof window === 'undefined' ? globalThis : window);
