'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve.cjs');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const text = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const utilityPages = ['support', 'privacy', 'eliminar-datos', 'aviso-legal'];
const pages = ['index', 'historia', 'app', ...utilityPages];
const footerLinks = ['support.html', 'privacy.html', 'eliminar-datos.html', 'aviso-legal.html'];
const mainLinks = ['index.html#metodo', 'historia.html', 'app.html', 'index.html#solicitud'];
const hrefs = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);

async function check() {
  for (const page of pages) {
    const html = read(page + '.html');
    assert.deepEqual(hrefs(html.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0]), mainLinks, 'Main navigation stays unchanged');
    const footer = html.match(/<footer>[\s\S]*?<\/footer>/)[0];
    const nav = footer.match(/<nav class="footer-links"[\s\S]*?<\/nav>/)[0];
    assert.deepEqual(hrefs(nav), footerLinks, 'All six pages expose the same utility destinations');
    assert.ok(!html.includes('fuera de esta demostración.'), 'No stale exclusion notice');
    if (utilityPages.includes(page)) assert.ok(nav.includes(`href="${page}.html" aria-current="page"`));
  }
  const appFooter = read('app.html').match(/<footer>[\s\S]*?<\/footer>/)[0];
  assert.equal(read('historia.html').match(/<footer>[\s\S]*?<\/footer>/)[0], appFooter.replace('href="#inicio"', 'href="#historia-contenido"').replace('<p>Fuerza y transformación<br>con método.</p>', ''), 'D96 History keeps every footer link and credit, omitting only the repeated tagline');
  assert.ok(read('historia.html').includes('</main>\n  <footer>'), 'Footer never enters the animated stage');
  const historyCss = read('history.css');
  assert.ok(historyCss.includes('.history-page .footer-top .wordmark { font-size:38px; min-height:44px; }'), 'Only History uses the compact logo with a 44px target');
  assert.ok(historyCss.includes('.history-page .footer-top .text-link { width:auto; min-height:44px; gap:14px; }'), 'The return link remains usable beside the logo on mobile');
  for (const page of pages.filter(page => page !== 'historia')) assert.ok(!read(page + '.html').includes('href="history.css"'), 'Compact footer rules never load on other pages');
  for (const page of utilityPages) {
    const html = read(page + '.html');
    const original = page === 'aviso-legal' ? null : fs.readFileSync(path.join(__dirname, '../..', page, 'index.html'), 'utf8');
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(!/<(?:form|input|video|iframe)\b/.test(html), 'No data collection or invented playback');
    assert.ok(html.includes('noindex, nofollow') && html.includes("connect-src 'none'; form-action 'none'"));
    assert.ok(html.includes('class="utility-document"'), 'Immediate native anchor navigation');
    assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]), ['navigation.js'], 'Only the shared menu needs JavaScript');
    assert.ok(html.includes('<noscript>') && html.includes('utility-noscript-nav'), 'Navigation remains available without JavaScript');
    const originalHero = original?.match(/<h1>([\s\S]*?)<\/h1>\s*<p>([\s\S]*?)<\/p>/);
    if (original) assert.equal(text(html.match(/<p class="utility-lead">([\s\S]*?)<\/p>/)[1]), text(originalHero[1]));
    if (original && page !== 'privacy') assert.equal(text(html.match(/<p class="utility-intro">([\s\S]*?)<\/p>/)[1]), text(originalHero[2]));
    if (page === 'privacy') assert.equal(text(html.match(/<p class="utility-intro">([\s\S]*?)<\/p>/)[1]), 'Moisés Sánchez Román (EXOM) es el responsable del tratamiento. Esta página distingue las solicitudes del formulario web de los datos de la app, cuyas cuentas crea el entrenador.');
    if (page === 'privacy' || page === 'eliminar-datos') assert.ok(!html.includes('EXOM Method'), 'The legal controller identity is unified');
    if (page === 'aviso-legal') {
      for (const value of ['Moisés Sánchez Román (EXOM)', 'Datos identificativos facilitados por el propietario']) assert.ok(html.includes(value));
      const nif = html.match(/<strong>NIF:<\/strong> (\d{8})([A-Z])\.<\/li>/);
      assert.ok(nif, 'The declared NIF has a complete format');
      assert.ok('TRWAGMYFPDXBNJZSQVHLCKE'[Number(nif[1]) % 23] === nif[2], 'The NIF control letter matches; this does not verify ownership');
      assert.ok(/<strong>Domicilio:<\/strong> [^<]*\d[^<]*, \d{5} [^<]+\.<\/li>/.test(html), 'The declared address includes a street number, postcode and locality');
      assert.ok(!html.includes('[PENDIENTE: NIF DEL TITULAR]') && !html.includes('[PENDIENTE: DOMICILIO COMPLETO DEL TITULAR]'), 'Identity placeholders are completed');
      assert.ok(!html.includes('[PENDIENTE:') && !html.includes('informacion-pendiente'), 'L6 owner confirmation removes the obsolete marker and its navigation target');
    } else if (page !== 'support') {
      const oldSections = [...original.matchAll(/<h2>(.*?)<\/h2>([\s\S]*?)(?=<h2>|<\/section>)/g)].map(m => [text(m[1]), text(m[2])]);
      const sourceHtml = html.replace('<p data-web-controller>La identidad del responsable es la misma para la app y el formulario web. Contacto de privacidad: exom.method@gmail.com.</p>', '').replace('Moisés Sánchez Román (EXOM) atiende solicitudes de privacidad en', 'El servicio EXOM Method atiende solicitudes de privacidad en').replace('Responsable del servicio: Moisés Sánchez Román (EXOM).', 'Responsable del servicio: EXOM Method.').replace('<h2 id="datos-tratados">App: datos tratados</h2>', '<h2 id="datos-tratados">Datos tratados</h2>');
      const newSections = [...sourceHtml.matchAll(/<section[^>]*data-source-section>\s*<h2[^>]*>(.*?)<\/h2>([\s\S]*?)<\/section>/g)].map(m => [text(m[1]), text(m[2])]);
      assert.deepEqual(newSections, oldSections, 'Original App sections, dates and deadlines stay verbatim except the exact D98 web-controller addition');
      if (page === 'privacy') {
        assert.ok(html.includes('Preparación local, no publicada.') && html.includes('sin correos ni comunicación con proveedores externos'));
        assert.ok(html.includes('<a href="#solicitudes-web">Solicitudes web</a>'));
        const draft = html.match(/<section[^>]*data-web-application>[\s\S]*?<\/section>/)[0];
        assert.ok(draft.includes('dominio exommethod.com verificado') && draft.includes('región de Irlanda') && draft.includes('No se han enviado correos ni comprobado la entrega real'), 'Account inspection does not imply live delivery or verification of transfer safeguards');
        assert.ok(!draft.includes('La cuenta, el dominio de envío y la configuración efectiva no se han inspeccionado'), 'Do not repeat the superseded account-inspection status');
        for (const required of ['Vercel Hobby', 'Resend Free', 'Gmail gratuito', 'WhatsApp normal (Messenger)', 'exommethod@gmail.com', 'artículo 6.1.b del RGPD', 'máximo de 90 días desde el último intercambio real', 'No hay borrado automático', 'papelera', '30 días', '7 días', 'EE. UU.', 'cláusulas contractuales tipo', 'https://www.aepd.es/', 'menor de 18 años', 'consulta general', 'Google no ofrece un acuerdo de tratamiento de datos ni actúa como encargado', 'sin pasar por el alias', 'el acuerdo de tratamiento publicado cubre Pro y Enterprise, no Hobby', 'no se presenta como implantado un archivo', 'La ejecución del borrado y sus resultados no se han verificado']) assert.ok(draft.includes(required), 'Describe implemented limits and actual chosen providers: ' + required);
        for (const absent of ['se eliminará y no se utilizará', 'prevé pasar a Pro', 'se comprobará la representación', 'Google actúa como responsable', 'garantiza el cumplimiento']) assert.ok(!draft.includes(absent), 'Do not invent safeguards or roles: ' + absent);
        assert.ok(draft.includes('<li>Edad y situación de estudio o trabajo: valorar, mediante una revisión personal, tu posibilidad de asumir el coste del acompañamiento y decidir si continuar con la solicitud. La edad también permite aplicar el procedimiento previsto para menores.</li>'), 'D104 preserves the exact approved economic-review purpose and minor routing');
        for (const obsolete of ['Edad: determinar si puede tramitarse la solicitud', 'adaptar la modalidad y el precio de la propuesta a tu situación de estudio o trabajo', 'No se inferirán tus ingresos ni se descartará tu solicitud solo por esta respuesta.']) assert.ok(!draft.includes(obsolete), 'D104 removes superseded age/occupation purposes: ' + obsolete);
        assert.ok(draft.includes('<li>País de residencia habitual: tener en cuenta el contexto económico del país al valorar, mediante una revisión personal, tu posibilidad de asumir el coste del acompañamiento y decidir si continuar con la solicitud.</li>'), 'D105 preserves the exact approved country-review purpose');
        for (const obsolete of ['valorar una adaptación del precio al contexto económico del país', 'sin atribuirte ingresos a partir de promedios nacionales']) assert.ok(!draft.includes(obsolete), 'D105 removes superseded country-purpose claims: ' + obsolete);
        assert.ok(read('index.html').includes('Prueba local: utiliza solo datos ficticios.'));
        assert.equal((read('index.html').match(/<fieldset disabled>/g) || []).length, 3);
      }
    } else {
      const oldContacts = [...original.matchAll(/<article class="contact-row">([\s\S]*?)<\/article>/g)];
      const newContacts = [...html.matchAll(/<article class="support-contact">([\s\S]*?)<\/article>/g)];
      assert.equal(newContacts.length, oldContacts.length);
      oldContacts.forEach((row, i) => {
        for (const m of row[1].matchAll(/<(?:p|h2|a)\b[^>]*>([\s\S]*?)<\/(?:p|h2|a)>/g)) assert.ok(text(newContacts[i][1]).includes(text(m[1])), 'Preserve every support statement and contact');
      });
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Unique IDs');
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^mailto:/.test(url)) { assert.ok(['mailto:exom.method@gmail.com', 'mailto:csroman.dev@gmail.com'].includes(url)); continue; }
      if (/^https:/.test(url)) { assert.ok(['https://github.com/carsan-dev', 'https://csroman-dev.vercel.app/', ...(page === 'privacy' ? ['https://www.aepd.es/'] : [])].includes(url)); continue; }
      const [file, anchor] = url.split('#');
      const target = file || page + '.html';
      assert.ok(fs.existsSync(path.join(__dirname, target)), 'Local target: ' + url);
      if (anchor) assert.ok(read(target).includes(`id="${anchor}"`), 'Anchor: ' + url);
    }
    assert.ok(!html.includes('\r'), 'LF');
  }
  assert.ok(!/animation:|@keyframes|scroll-snap|scroll-timeline/.test(read('utility-pages.css')), 'Read-first pages have no forced motion');
  assert.ok(read('utility-pages.css').includes('.utility-document { scroll-behavior:auto; }'));
  assert.ok(!read('utility-pages.css').includes('\r'));
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/prototype-v4/`;
    for (const file of [...utilityPages.map(p => p + '.html'), 'utility-pages.css']) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await fetch(base + file, { method: 'POST' })).status, 405);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: utility content parity, seven-page navigation, declared legal identity and remaining notices, local links, menu fallback, isolation, LF and HTTP.');
}
module.exports = check;
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
