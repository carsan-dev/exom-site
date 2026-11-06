'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
module.exports = async function checkGalleryVideos() {
  const source = fs.readFileSync(path.join(__dirname,'gallery-videos.js'),'utf8');
  const observers = [], buttonEvents = {};
  function video() {
    return { dataset: { src: 'clip.mp4' }, events: {}, classes: new Set(), paused: true, currentTime: 0, loads: 0, calls: 0,
      getAttribute() { return this.src; }, removeAttribute() { this.src = ''; },
      load() { this.loads++; this.error=null; }, pause() { this.paused = true; },
      addEventListener(name,fn) { this.events[name] = fn; }, removeEventListener(name) { delete this.events[name]; },
      dispatchEvent(event) { this.events[event.type]?.(event); },
      play() { this.calls++; return new Promise((resolve,reject) => { this.resolve = () => { this.paused=false; this.events.playing?.(); resolve(); }; this.reject=reject; }); },
      get classList() { return { add: key=>this.classes.add(key), remove: key=>this.classes.delete(key) }; }
    };
  }
  const clip = video();
  const context = { window: {}, Event: class { constructor(type) { this.type = type; } }, document: { hidden: false, body: { dataset: { motion:'off' } }, querySelector:()=>({addEventListener:(name,fn)=>buttonEvents[name]=fn}), querySelectorAll:()=>[clip] },
    IntersectionObserver: class { constructor(callback, options) { this.callback=callback; this.options=options;this.targets=new Set();observers.push(this); } observe(v){this.targets.add(v);} unobserve(v){this.targets.delete(v);} }
  };
  runInNewContext(source,context);
  const api=context.window.ExomGallery;
  const visible=(v,on)=>observers[0].callback([{target:v,isIntersecting:on,intersectionRatio:on?1:0}]);
  const near=(v,on)=>observers[1].callback([{target:v,isIntersecting:on}]);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  near(clip,true); visible(clip,true); assert.equal(clip.loads,0,'Reduced motion does not download videos');
  context.document.body.dataset.motion='on'; api.sync();api.sync();assert.equal(clip.calls,1);assert.equal(clip.loads,1);
  visible(clip,false);clip.resolve();await settle();assert.ok(clip.paused);assert.ok(!clip.classes.has('is-playing'));
  visible(clip,true);clip.reject(Error('blocked'));await settle();api.sync();assert.equal(clip.calls,2,'No retry storm');
  buttonEvents.click();api.sync();clip.resolve();await settle();assert.ok(!clip.paused && clip.classes.has('is-playing'));
  context.document.hidden=true;api.sync();assert.ok(clip.paused && !clip.classes.has('is-playing'));
  context.document.hidden=false;context.document.body.dataset.motion='off';api.sync();assert.ok(clip.paused);
  context.document.body.dataset.motion='on';api.sync();clip.resolve();await settle();clip.error={code:3};clip.events.error();assert.ok(clip.paused && !clip.classes.has('is-playing'),'Decode failure restores poster');
  buttonEvents.click();api.sync();assert.equal(clip.loads,2,'Explicit retry reloads a failed decoder');
  const clone=video();api.register(clone);api.register(clone);visible(clone,true);assert.equal(clone.loads,1,'Visible callback can precede nearby callback');
  api.unregister(clone);clone.resolve();await settle();assert.ok(clone.paused && !clone.src);assert.ok(!observers[0].targets.has(clone) && !observers[1].targets.has(clone));
  const scene = video();
  api.register(scene, { ready: false, preserveFrame: true }); near(scene, true); visible(scene, true);
  assert.equal(scene.loads, 1, 'Prepare the clip during the reveal');
  assert.equal(scene.calls, 0, 'Visibility alone cannot start a gated scene');
  api.setReady(scene, true); assert.equal(scene.calls, 1);
  scene.currentTime = 1.4; api.setReady(scene, false);
  scene.resolve(); await settle();
  assert.ok(scene.paused && !scene.classes.has('is-playing'), 'Late play cannot bypass a closed reveal');
  assert.equal(scene.currentTime, 1.4, 'Closing never rewinds the clip');
  api.setReady(scene, true); scene.resolve(); await settle();
  scene.currentTime = .8; const plays = scene.calls;
  api.setReady(scene, true); api.setReady(scene, true);
  assert.equal(scene.calls, plays, 'Scroll updates after opening do not restart the clip');
  assert.equal(scene.currentTime, .8);
  api.setReady(scene, false);
  assert.ok(scene.paused && scene.classes.has('is-playing'), 'Closing holds the last decoded frame instead of showing the poster');
  assert.equal(scene.currentTime, .8);
  api.setReady(scene, true); scene.resolve(); await settle();
  assert.equal(scene.currentTime, .8, 'Reopening resumes from the preserved position');
  visible(scene, false); assert.ok(scene.paused && scene.classes.has('is-playing')); assert.equal(scene.currentTime, .8, 'Offscreen pauses without rewinding');
  visible(scene, true); scene.resolve(); await settle();
  context.document.hidden = true; api.sync(); assert.ok(scene.paused && scene.classes.has('is-playing'));
  context.document.hidden = false; api.sync();
  api.setReady(scene, false); scene.reject(Error('interrupted')); await settle();
  api.setReady(scene, true); scene.resolve(); await settle();
  assert.ok(!scene.paused, 'Closing during a pending play does not poison the next reveal');
  scene.error = { code: 3 }; scene.events.error();
  assert.ok(scene.paused && !scene.classes.has('is-playing'), 'Even retained frames yield to the error fallback');
  buttonEvents.click(); api.sync(); scene.resolve(); await settle();
  context.document.body.dataset.motion = 'off'; api.sync(); assert.ok(scene.paused && !scene.classes.has('is-playing'));
  api.unregister(scene); context.document.body.dataset.motion = 'on';
  const v2=fs.readFileSync(path.resolve(__dirname,'../prototype-v2/index.html'),'utf8');
  // Form semantics now have dedicated validation/UI tests; all non-form visual bytes retain this parity check.
  const v4=fs.readFileSync(path.join(__dirname,'index.html'),'utf8')
    .replace(/    <section class="section application"[\s\S]*?    <\/section>/, fs.readFileSync(path.join(__dirname, 'fixtures/form-demo-before.html'), 'utf8').trimEnd())
    .replace('  <script defer src="form-client.js"></script>\n', '')
    .replace("connect-src 'self'; form-action 'self'", "connect-src 'none'; form-action 'none'")
    .replace('Prototipo V4 · Formulario local · Sin correos reales', 'Prototipo V4 · Historia inmersiva · Sin envíos');
  const previousV3 = fs.readFileSync(path.resolve(__dirname,'../prototype-v3/index.html'),'utf8');
  // D86/D93/D94/D97 permit navigation, capture wrappers, utility links and the two approved form questions.
  const v3=v4
    .replace('<span class="strategy-word">estrategia.</span>', 'estrategia.')
    .replace('  <script defer src="home-viewport.js"></script>\n', '')
    // Restore only the approved strategy markup for historical comparison.
    .replace('<p class="display strategy-objective strategy-line"><span>Cada</span> <span>objetivo</span></p>', '')
    .replace('<div class="immersive-copy"><p class="display strategy-line"><span class="strategy-connect">necesita una</span><em class="strategy-key">estrategia.<span class="strategy-ink" aria-hidden="true">estrategia.</span></em></p>', '<div class="immersive-copy"><p class="display"><span class="strategy-line"><span>Cada objetivo</span></span><span class="strategy-line"><span class="strategy-connect">necesita una</span></span><span class="strategy-line"><em class="strategy-key">estrategia.<span class="strategy-ink" aria-hidden="true">estrategia.</span></em></span></p>')
    .replace('<div class="exercise-scene" id="estrategia" role="region" aria-label="Cada objetivo necesita una estrategia">', '<div class="exercise-scene">')
    .replace('<p class="strategy-note">Saber qué hacer.<br>Construir una rutina propia.</p>', '<p class="strategy-note"><span class="sr-only">Saber qué hacer. Construir una rutina propia.</span><span class="strategy-typed" aria-hidden="true" data-copy="Saber qué hacer.&#10;Construir una rutina propia.">Saber qué hacer.&#10;Construir una rutina propia.</span></p>')
    // Restore the removed caption only for comparison with the historical page.
    .replace('<button id="practice-toggle"', '<figcaption>Entrenamientos reales · EXOM</figcaption><button id="practice-toggle"')
    // The progress-only decode hint has its own assertion; keep historical visual parity.
    .replace(/<section class="section progress"[\s\S]*?<\/section>/, section => section.replace(/ decoding="async"/g, ''))
    .replace('id="testimonios" aria-labelledby="testimonials-title" hidden', 'id="testimonios" aria-labelledby="testimonials-title"')
    .replace('  <script defer src="gallery-shared.js"></script>\n', '')
    // Restore only retired fallback tags for historical parity; live MP4-only sources are checked separately.
    .replace(/<source src="assets\/clients-v1\/(carlos|cristina|jose|lucia|miguel-polea)\.mp4" type="video\/mp4">/g, (source, name) => source + `<source src="assets/clients-v1/${name}.webm" type="video/webm">`)
    .replace('src="assets/strategy-training-poster.webp"', 'src="assets/scenes-client-v1/training/poster.webp"')
    .replace('<video class="coach-video" data-src="assets/coaching.mp4" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>', '<canvas data-sequence="coach" aria-hidden="true"></canvas>')
    .replace('<video class="strategy-video" data-src="assets/strategy-training.mp4" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>', '<canvas data-sequence="training" aria-hidden="true"></canvas>')
    .replace("<fieldset class=\"choice-group\" id=\"demo-food\" aria-describedby=\"demo-food-help demo-food-medical\"><legend>¿Qué te cuesta más de la alimentación a la hora de alcanzar tu objetivo? *</legend><p class=\"small field-help\" id=\"demo-food-help\">Elige la opción que mejor describe tu principal dificultad.</p><p class=\"small field-help\" id=\"demo-food-medical\">No incluyas diagnósticos, medicación ni otra información médica.</p><label><input type=\"radio\" name=\"food\" value=\"quantities\" required> Las cantidades</label><label><input type=\"radio\" name=\"food\" value=\"schedules\" required> Los horarios</label><label><input type=\"radio\" name=\"food\" value=\"preparation\" required> Preparar las comidas</label><label><input type=\"radio\" name=\"food\" value=\"consistency\" required> Mantener la constancia</label><label><input type=\"radio\" name=\"food\" value=\"other\" required> Otra dificultad</label><label><input type=\"radio\" name=\"food\" value=\"none\" required> Ninguna dificultad</label></fieldset>", "<label for=\"demo-food\">¿Qué te cuesta más de la alimentación a la hora de alcanzar tu objetivo? *</label><p class=\"small field-help\" id=\"demo-food-help\">Por ejemplo, las cantidades, los horarios, preparar las comidas o mantener la constancia.</p><p class=\"small field-help\" id=\"demo-food-medical\">No incluyas diagnósticos, medicación ni otra información médica.</p><textarea id=\"demo-food\" rows=\"3\" placeholder=\"Cuéntamelo con tus propias palabras\" aria-describedby=\"demo-food-help demo-food-medical\" required></textarea>")
    .replace("  <script defer src=\"navigation.js\"></script>\n  <script defer src=\"form-rules.js\"></script>", "  <script defer src=\"navigation.js\"></script>")
    .replace("<input id=\"demo-age\" type=\"number\" placeholder=\"Edad\" min=\"0\" max=\"120\" step=\"1\" aria-describedby=\"demo-age-help demo-age-message\" required><p class=\"small field-help\" id=\"demo-age-help\">Si tienes menos de 18 años, debe contactar con EXOM tu padre, madre o tutor. No envíes tus respuestas por este formulario.</p><p class=\"small\" id=\"demo-age-message\" aria-live=\"polite\"></p>", "<input id=\"demo-age\" type=\"number\" placeholder=\"Edad\" required>")
    .replace("<fieldset class=\"choice-group\" aria-describedby=\"demo-occupation-help demo-occupation-message\"><legend>¿A qué te dedicas actualmente? *</legend><p class=\"small\" id=\"demo-occupation-help\">Puedes marcar estudio y trabajo si compaginas ambos.</p><label><input type=\"checkbox\" name=\"occupation\" value=\"study\" aria-describedby=\"demo-occupation-message\"> Estudio</label><label><input type=\"checkbox\" name=\"occupation\" value=\"work\" aria-describedby=\"demo-occupation-message\"> Trabajo</label><label><input type=\"checkbox\" name=\"occupation\" value=\"other\" aria-describedby=\"demo-occupation-message\"> Otra situación</label><p class=\"small\" id=\"demo-occupation-message\" aria-live=\"polite\"></p></fieldset>", "<fieldset class=\"choice-group\"><legend>¿A qué te dedicas actualmente? *</legend><p class=\"small\">Puedes marcar estudio y trabajo si compaginas ambos.</p><label><input type=\"checkbox\"> Estudio</label><label><input type=\"checkbox\"> Trabajo</label><label><input type=\"checkbox\"> Otra situación</label></fieldset>")
    .replace("<p class=\"small field-help\" id=\"demo-food-medical\">No incluyas diagnósticos, medicación ni otra información médica.</p><textarea id=\"demo-food\" rows=\"3\" placeholder=\"Cuéntamelo con tus propias palabras\" aria-describedby=\"demo-food-help demo-food-medical\" required></textarea>", "<textarea id=\"demo-food\" rows=\"3\" placeholder=\"Cuéntamelo con tus propias palabras\" aria-describedby=\"demo-food-help\" required></textarea>")
    .replace("<p class=\"small field-help\" id=\"demo-goal-help\">Por ejemplo, organizar mejor tus entrenamientos, mantener la constancia o aprender a entrenar.</p><p class=\"small field-help\" id=\"demo-goal-medical\">No incluyas diagnósticos, medicación ni otra información médica.</p><textarea id=\"demo-goal\" rows=\"3\" placeholder=\"Cuéntamelo con tus propias palabras\" aria-describedby=\"demo-goal-help demo-goal-medical\" required></textarea>", "<textarea id=\"demo-goal\" rows=\"3\" placeholder=\"Además del cambio físico, ¿qué te gustaría mejorar en tu día a día?\" required></textarea>")
    .replace("<label><input type=\"checkbox\"> Me falta conocimiento para saber cómo avanzar</label><label><input type=\"checkbox\"> Otro motivo</label></fieldset>", "<label><input type=\"checkbox\"> Me falta conocimiento para saber cómo avanzar</label></fieldset>")
    .replace("<div class=\"form-privacy small\" aria-label=\"Información básica de privacidad, borrador\">\n          <p><strong>Privacidad · Borrador para revisión.</strong> El formulario sigue desactivado.</p>\n          <p><strong>Responsable:</strong> Moisés Sánchez Román (EXOM). <strong>Finalidad:</strong> valorar tu solicitud, preparar una propuesta adaptada y contactarte por WhatsApp. <strong>Base jurídica:</strong> medidas precontractuales a tu petición (art. 6.1.b RGPD). Si no respondes a las preguntas, no podremos valorar tu solicitud.</p>\n          <p><strong>Proveedores:</strong> Vercel, Resend, Google (Gmail) y WhatsApp, con posibles transferencias a EE. UU. <strong>Conservación:</strong> máximo 90 días desde el último contacto si no contratas.</p>\n          <p><strong>Derechos:</strong> <a href=\"mailto:exom.method@gmail.com\">exom.method@gmail.com</a>. <a href=\"privacy.html#solicitudes-web\">Más información en Privacidad</a>.</p>\n        </div>", "<p class=\"small\">La información de privacidad y las condiciones se concretarán antes de activar el formulario.</p>")
    .replace('<a href="aviso-legal.html">Aviso legal</a>', '')
    .replace('EXOM V4 —','EXOM V3 —').replace('Prototipo V4 · Historia inmersiva','Prototipo V3 · Carrusel con vídeos')
    .replace('  <script defer src="navigation.js"></script>\n', '')
    .replace(/<nav id="navigation"[\s\S]*?<\/nav>/, previousV3.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0])
    .replace('<nav class="footer-links" aria-label="Ayuda y legal"><a href="support.html">Ayuda</a><a href="privacy.html">Privacidad</a><a href="eliminar-datos.html">Eliminar datos</a></nav>', '<span>App, soporte y páginas legales: fuera de esta demostración.</span>')
    .replace('<label for="demo-residence-country">País de residencia habitual *</label><input id="demo-residence-country" type="text" placeholder="País donde vives" autocomplete="off" required>', '<label for="demo-nationality">¿Cuál es tu nacionalidad? *</label><input id="demo-nationality" type="text" placeholder="Nacionalidad" autocomplete="off" required>')
    .replace('<label for="demo-food">¿Qué te cuesta más de la alimentación a la hora de alcanzar tu objetivo? *</label><p class="small field-help" id="demo-food-help">Por ejemplo, las cantidades, los horarios, preparar las comidas o mantener la constancia.</p><textarea id="demo-food" rows="3" placeholder="Cuéntamelo con tus propias palabras" aria-describedby="demo-food-help" required></textarea>', '<label for="demo-food">¿Cómo describirías tu relación con la comida? *</label><textarea id="demo-food" rows="3" placeholder="Cuéntamelo con tus propias palabras" required></textarea>')
    .replace(/<span class="app-capture">(<img[^>]+>)<\/span>/g, '$1');
  assert.equal(v3, previousV3, 'V4 preserves V3 landing except version, approved navigation, utility footer links, screenshot crop wrappers and the D94/D97 form questions');
  const story = v3.match(/<section class="section story story-expanded"[\s\S]*?<\/section>/)[0];
  const previousStory = v2.match(/<section class="section story story-compact"[\s\S]*?<\/section>/)[0];
  const historyLink = '<a class="text-link" href="historia.html">Conoce mi historia <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h17m-7-7 7 7-7 7"/></svg></a>';
  assert.equal(story.split(historyLink).length - 1, 1, 'One explicit link to the new history page');
  const restoredStory = story.replace('story-expanded', 'story-compact')
    .replace(historyLink, '')
    .replace(/\n      <div class="story-formation"[\s\S]*$/, '\n    </section>')
    .replace('sin obsesionarte.</p></div>', 'sin obsesionarte.</p><p class="credentials">Cinturón negro 3.º DAN · Entrenador nacional de taekwondo.</p></div>');
  assert.equal(restoredStory, previousStory, 'Original portrait and personal copy are preserved; only formation and the history link are added');
  const symbol = '<img class="brand-symbol" src="assets/exom-balance.svg" width="120" height="112" alt="">';
  assert.equal(v3.split(symbol).length - 1, 2, 'Shared balance symbol appears only in header and footer');
  assert.equal(v3.split('<span class="brand-lettering" aria-hidden="true">E<span>X</span>OM</span>').length - 1, 2, 'Header and footer share the lime X');
  const svg = fs.readFileSync(path.join(__dirname, 'assets/exom-balance.svg'), 'utf8');
  assert.ok(svg.includes('viewBox="0 0 120 112"') && svg.includes('#f2f1e9') && svg.includes('#baf23a'));
  assert.equal((svg.match(/<path /g) || []).length, 2, 'Two vector shapes, not an embedded raster');
  assert.ok(!/<(?:image|script|foreignObject)\b|\bon\w+\s*=/.test(svg));
  const normalized=v3.replace('<span class="strategy-ink" aria-hidden="true">estrategia.</span>', '').replace('<p class="strategy-note"><span class="sr-only">Saber qué hacer. Construir una rutina propia.</span><span class="strategy-typed" aria-hidden="true" data-copy="Saber qué hacer.&#10;Construir una rutina propia.">Saber qué hacer.&#10;Construir una rutina propia.</span></p>', '<p class="strategy-note">Saber qué hacer.<br>Construir una rutina propia.</p>').replace('<span class="strategy-line"><span>Cada objetivo</span></span><span class="strategy-line"><span class="strategy-connect">necesita una</span></span><span class="strategy-line"><em class="strategy-key">estrategia.</em></span>', 'Cada objetivo<br>necesita una <em>estrategia.</em>').replace('<div class="strategy-rule" aria-hidden="true"></div><p class="strategy-note">', '<p>').replace(story, previousStory).replaceAll('EXOM V3','EXOM V2').replace('Prototipo V3 · Carrusel con vídeos','Prototipo V2 · Enfoque en el método').replace('  <script defer src="gallery-videos.js"></script>\n','').replace(/<video class="gallery-video" data-clip="([^"]+)"[^>]*><\/video>/g,(_,key)=>`<canvas data-sequence="${key}" aria-hidden="true"></canvas>`)
    .replaceAll('class="wordmark brand-lockup"', 'class="wordmark"').replaceAll(symbol, '')
    .replace('<span class="brand-lettering" aria-hidden="true">E<span>X</span>OM</span>', 'E<span>X</span>OM')
    .replace('<span class="brand-lettering" aria-hidden="true">E<span>X</span>OM</span>', 'EXOM')
    .replaceAll('<span class="photo-label label-before">Antes</span><span class="photo-label label-after">Después</span>', '<span class="photo-label label-after">Después</span><span class="photo-label label-before">Antes</span>')
    .replaceAll('aria-label="Mostrar antes de', 'aria-label="Mostrar después de')
    .replaceAll('aria-valuetext="50 % antes, 50 % después"', 'aria-valuetext="50 % de la fotografía del después"');
  const coachingCopy = '<div class="film-copy"><p class="display film-title film-title-start">Tu plan.<br><em>A tu medida.</em></p><p class="display film-title film-title-end">Y yo,<br><em>a tu lado.</em></p><p class="film-bridge">No tienes que resolverlo todo por tu cuenta.</p></div>';
  const originalCopy = '<div class="film-caption"><p class="display">Tu plan.<br><em>Contigo.</em></p><p>No tienes que resolverlo todo por tu cuenta.</p></div>';
  const strategyCopy = 'Cada objetivo<br>necesita una <em>estrategia.</em>';
  assert.ok(normalized.includes(coachingCopy), 'D60 coaching copy is preserved');
  assert.ok(normalized.includes(strategyCopy), 'Exercise headline uses the approved strategy copy');
  assert.ok(normalized.includes('alt="Moi realizando un peso muerto a una pierna"'));
  assert.equal(normalized.replace(coachingCopy, originalCopy).replace(strategyCopy, 'Tu esfuerzo.<br>Con <em>dirección.</em>').replace('alt="Moi realizando un peso muerto a una pierna"', 'alt="Persona del método realizando elevaciones con mancuernas"'),v2,'Only gallery playback, version label and approved coaching/exercise content differ');
  const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8').replace(/calc\((\d+(?:\.\d+)?) \* var\(--home-(s?vh), 1\2\)\)/g, '$1$2');
  const previousCss = css.replace('.exercise-scene{height:auto;background', '.exercise-scene{height:360vh;background')
    .replace('  .exercise-scene{height:auto}', '  .exercise-scene{height:360vh}')
    .replaceAll('.film-stage{height:370vh', '.film-stage{height:360vh')
    .replace('.testimonial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}', '.testimonial-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}')
    .replace('padding:clamp(20px,2.5vw,28px)', 'padding:28px')
    .replace('font:800 clamp(28px,4vw,44px)/1 Barlow', 'font:800 44px/1 Barlow')
    .replace('.hero-portrait{position:absolute;top:auto;bottom:0;left:5%;width:90%;height:90%;z-index:3}', '.hero-portrait{position:absolute;top:0;left:10%;width:80%;height:70%;z-index:1}')
    .replace('.hero-client{width:auto;height:45%;max-width:100%;margin-bottom:20px;z-index:2;grid-column:1;grid-row:1;justify-self:start}', '.hero-client{width:auto;height:60%;max-width:100%;margin-bottom:20px;z-index:2;grid-column:1;grid-row:1}')
    .replace('.hero-client:last-child{grid-column:2;margin-bottom:0;justify-self:end}', '.hero-client:last-child{grid-column:2;margin-bottom:0}')
    .replace('.method-steps>li{display:grid;grid-template-columns:38px 1fr;gap:20px;padding:27px 0;border-top:1px solid var(--rule);align-items:baseline}', '.method-steps>li{display:grid;grid-template-columns:38px 1fr;gap:20px;padding:27px 0;border-top:1px solid var(--rule)}')
    .replace('.choice-group input{accent-color:var(--lime);font:inherit;margin:calc((1.5em - 17px) / 2) 0 0;width:17px;height:17px;flex-shrink:0}', '.choice-group input{accent-color:var(--lime);margin:4px 0 0;width:17px;height:17px;flex-shrink:0}');
  assert.ok(previousCss.startsWith(fs.readFileSync(path.resolve(__dirname,'../prototype-v2/styles.css'),'utf8')), 'V4 retains V2 styling except approved scene, hero, alignment and UI-761 testimonial fixes');
  assert.equal(fs.readFileSync(path.join(__dirname,'motion.js'),'utf8').replace('training: 228','training: 144'), fs.readFileSync(path.resolve(__dirname,'../prototype-v2/motion.js'),'utf8'), 'Only the extended training frame count differs');
  assert.deepEqual(fs.readFileSync(path.join(__dirname,'welcome.js')),fs.readFileSync(path.resolve(__dirname,'../prototype-v2/welcome.js')));
  const v3Config = require('./media-config.cjs'), v2Config = require('../prototype-v2/media-config.cjs');
  assert.deepEqual({...v3Config, scenes: [v2Config.scenes[0], [v3Config.scenes[1][0], v3Config.scenes[1][1], v2Config.scenes[1][2], v3Config.scenes[1][3]]]}, v2Config, 'Only the approved training source and coaching start differ from V2');
  const {gallery}=require('./media-config.cjs');
  const calls=[];
  runInNewContext(fs.readFileSync(path.join(__dirname,'build-gallery-clips.cjs'),'utf8'),{__dirname,console:{log(){}},process:{argv:['node','build-gallery-clips.cjs']},require:name=>name==='node:fs'?{mkdirSync(){}}:name==='node:child_process'?{spawnSync(command,args){calls.push(args);return{status:0};}}:require(name)});
  assert.equal(calls.length,6);
  calls.forEach((args,i)=>{assert.equal(args[args.indexOf('-ss')+1],String(gallery[i][2]));assert.equal(args[args.indexOf('-t')+1],String(gallery[i][3]));assert.ok(args.includes('-an'));assert.ok(args.at(-1).startsWith(path.join(__dirname,'assets/gallery-clips-v1')));});
  calls.forEach((args, i) => {
    assert.ok(args[args.indexOf('-vf') + 1].startsWith(`trim=start=0:end=${gallery[i][3]},setpts=PTS-STARTPTS,`), 'Trim before rebasing variable timestamps');
    assert.ok(!args[args.indexOf('-vf') + 1].includes('fps='), 'Do not drop or invent source frames');
    assert.equal(args[args.indexOf('-fps_mode') + 1], 'passthrough');
    assert.equal(args[args.indexOf('-enc_time_base') + 1], 'filter', 'Preserve variable source timestamps');
    assert.equal(args[args.indexOf('-crf') + 1], '20', 'Keep the approved image quality');
  });
  console.log('PASS: V3 gallery visibility, load order, late play, failure, pause, clone disposal, exact intervals and V2 content parity.');
};
