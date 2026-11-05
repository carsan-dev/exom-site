'use strict';
const runButton = document.querySelector('#run');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');
const results = document.querySelector('#results');
const raw = document.querySelector('#raw');
const localServer = document.querySelector('#local-server');
const localFile = location.protocol === 'file:';
const originMessage = 'El navegador no permite acceder a las páginas de la prueba. Abre el comparador desde el servidor local, no como archivo.';
if (localFile) {
  runButton.disabled = true;
  status.textContent = originMessage;
  localServer.hidden = false;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, fraction) => [...values].sort((a,b) => a-b)[Math.min(values.length-1, Math.floor(values.length*fraction))] || 0;
async function sample(version) {
  if (localFile) throw Error(originMessage);
  const frame = document.createElement('iframe');
  frame.title = 'Prueba del prototipo V' + version;
  frame.allow = 'autoplay';
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('La página no terminó de cargar.')), 15000);
    frame.onload = () => { clearTimeout(timeout); resolve(); };
  });
  frame.src = '../prototype-v' + version + '/?comparison=' + Date.now() + '#performance-test';
  preview.replaceChildren(frame);
  let observer;
  try {
    await loaded;
    frame.scrollIntoView({ block: 'center', behavior: 'instant' });
    const w = frame.contentWindow;
    let d;
    try { d = w.document; }
    catch { localServer.hidden = false; throw Error(originMessage); }
    await d.fonts.ready;
    // Settle above-gallery lazy images before calculating the shared scroll path.
    await Promise.all([...d.querySelectorAll('#metodo img')].map(img => {
      img.loading = 'eager';
      return img.decode().catch(() => {});
    }));
    w.ScrollTrigger?.refresh();
    if (d.body.dataset.motion !== 'on') throw Error('Activa los efectos y desactiva movimiento reducido para comparar.');
    w.performance.setResourceTimingBufferSize(3000);
    d.documentElement.style.scrollBehavior = 'auto';
    const gallery = d.querySelector('.x-gallery');
    const top = gallery.getBoundingClientRect().top + w.scrollY;
    const start = top - w.innerHeight + 1, end = top + gallery.offsetHeight - 150;
    w.scrollTo({ top: start - 700, behavior: 'instant' });
    await delay(500);
    const longTasks = [], phases = [], positions = [];
    const supportsLongTasks = w.PerformanceObserver?.supportedEntryTypes?.includes('longtask') === true;
    if (supportsLongTasks) {
      observer = new w.PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask' });
    }
    for (const reverse of [false, true]) {
      const gaps = [];
      let lastQuarter = -1;
      await new Promise((resolve, reject) => {
        let origin, previous;
        const timeout = setTimeout(() => reject(Error('Prueba interrumpida; mantén esta pestaña visible.')), 12000);
        function tick(now) {
          if (document.hidden) { clearTimeout(timeout); reject(Error('Prueba descartada: la pestaña quedó oculta.')); return; }
          if (origin === undefined) origin = now;
          if (previous !== undefined) gaps.push(now-previous);
          previous = now;
          const p = Math.min(1, (now-origin)/4000);
          w.scrollTo({ top: start + (end-start)*(reverse ? 1-p : p), behavior: 'instant' });
          const quarter = Math.floor(p*4);
          if (quarter !== lastQuarter) {
            lastQuarter = quarter;
            positions.push({ reverse, quarter, y:w.scrollY, galleryTop:gallery.getBoundingClientRect().top, tracks:[...d.querySelectorAll('.ribbon-track')].map(t=>w.getComputedStyle(t).transform), playing:[...d.querySelectorAll('.gallery-video')].filter(v=>!v.paused).length, videoTime:[...d.querySelectorAll('.gallery-video')].reduce((n,v)=>n+v.currentTime,0), atlasFrames:[...d.querySelectorAll('.ribbon-track canvas.is-ready')].map(c=>c.dataset.frame) });
          }
          if (p < 1) w.requestAnimationFrame(tick);
          else { clearTimeout(timeout); resolve(); }
        }
        w.requestAnimationFrame(tick);
      });
      phases.push({ phase: reverse ? 'vuelta' : 'primera bajada', samples: gaps.length, p95ms: +percentile(gaps,.95).toFixed(2), maxMs: +Math.max(...gaps).toFixed(2), over33ms: gaps.filter(n=>n>33.4).length });
    }
    const media = w.performance.getEntriesByType('resource').filter(entry => /gallery-(client|clips)-v1/.test(entry.name));
    const videos = [...d.querySelectorAll('.gallery-video')];
    const quality = videos.map(video => video.getVideoPlaybackQuality());
    if (!positions.some(p => p.galleryTop < 0) || !positions.some(p => p.galleryTop > 0)) throw Error('Recorrido inválido: ' + JSON.stringify({start,end,positions}));
    if (version === 3 && !positions.some(p => p.playing > 0 && p.videoTime > 1)) throw Error('Recorrido inválido: los vídeos no llegaron a reproducirse.');
    if (version === 2 && !positions.some(p => p.atlasFrames.some(frame => Number(frame) > 10))) throw Error('Recorrido inválido: los fotogramas no avanzaron.');
    return { version, viewport: [w.innerWidth,w.innerHeight], phases, positions, longTasks: supportsLongTasks ? longTasks.length : null, longTaskMs: supportsLongTasks ? +longTasks.reduce((a,b)=>a+b,0).toFixed(2) : null, galleryRequests: media.length, completedTransferBytes: media.reduce((sum,entry)=>sum+entry.transferSize,0), galleryDecodedFrames: quality.reduce((sum,q)=>sum+q.totalVideoFrames,0), galleryDroppedFrames: quality.reduce((sum,q)=>sum+q.droppedVideoFrames,0), videoErrors: videos.filter(video=>video.error).length };
  } finally { observer?.disconnect(); frame.remove(); }
}
runButton.addEventListener('click', async () => {
  if (localFile) return;
  runButton.disabled = true;
  results.replaceChildren(); raw.textContent = '';
  const report = { date: new Date().toISOString(), browser: navigator.userAgent, runs: [] };
  try {
    for (const version of [2,3,3,2]) {
      status.textContent = 'Midiendo V' + version + ' · pasada ' + (report.runs.length+1) + '/4';
      report.runs.push(await sample(version));
    }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Versión</th><th>P95 primera bajada</th><th>Intervalos &gt;33 ms</th><th>Tareas largas</th></tr></thead><tbody></tbody>';
    for (const run of report.runs) {
      const row = table.tBodies[0].insertRow();
      for (const value of ['V'+run.version,run.phases[0].p95ms+' ms',run.phases[0].over33ms,run.longTasks ?? 'No disponible']) row.insertCell().textContent = value;
    }
    results.append(table);
    status.textContent = 'Comparación completada. Menos tiempo y menos bloqueos es mejor; revisa también la fluidez visual.';
  } catch (error) { status.textContent = error.message; report.error = error.message; }
  finally { raw.textContent = JSON.stringify(report,null,2); runButton.disabled = false; runButton.scrollIntoView({ block: 'start', behavior: 'instant' }); }
});
