'use strict';
const { createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { validateApplication } = require('./form-rules.js');
const { readFileSync } = require('node:fs');
const VERSION = 'web-2026-11-05-v1';
const MAX_BODY = 8192, TOKEN_TTL = 20 * 60 * 1000, WINDOW = 10 * 60 * 1000;
const RECIPIENT = 'exommethod@gmail.com';
const SUBJECT = 'EXOM · Nueva solicitud web';
const json = (status, body, headers = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers
} });

async function readBody(request) {
  if (request.headers.has('content-length') && (!/^\d+$/.test(request.headers.get('content-length')) || Number(request.headers.get('content-length')) > MAX_BODY)) throw 413;
  if (!request.body) throw 400;
  const reader = request.body.getReader(), chunks = [];
  let size = 0, timer;
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { reject(408); void reader.cancel().catch(() => {}); }, 5000); });
    const read = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) throw 413;
        chunks.push(value);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    };
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

function formatMessage(data, reference) {
  const labels = {
    study: 'Estudio', work: 'Trabajo', other: 'Otra opción', muscle: 'Ganar masa muscular', fat: 'Perder grasa',
    recomposition: 'Recomposición corporal', quantities: 'Las cantidades', schedules: 'Los horarios',
    preparation: 'Preparar las comidas', consistency: 'Mantener la constancia', none: 'Ninguna dificultad',
    plan: 'No tengo un plan claro', knowledge: 'Me falta conocimiento para saber cómo avanzar',
    change: 'No me siento a gusto y quiero cambiarlo', improve: 'Me cuido, pero podría hacerlo mejor',
    maximize: 'Estoy a gusto, pero quiero llevarlo al máximo', soon: 'Quiero empezar cuanto antes',
    thinking: 'Necesito pensarlo', information: 'Por ahora, solo quiero recibir información'
  };
  const answer = value => (Array.isArray(value) ? value : [value]).map(item => labels[item] || item).join(', ');
  const rows = [['Nombre', data.name], ['Edad', data.age], ['País de residencia', data.country], ['WhatsApp', data.phone],
    ['Ocupación', answer(data.occupation)], ['Objetivo', answer(data.goal)], ['Alimentación', answer(data.food)],
    ['Qué desea conseguir', data.expectations], ['Obstáculos', answer(data.obstacles)],
    ['Percepción física', answer(data.condition)], ['Inicio', answer(data.start)]];
  const text = `Solicitud: ${reference}\nAviso mostrado: ${VERSION}\n\n` + rows.map(([label, value]) => `${label}: ${value}`).join('\n\n');
  // Answers only enter escaped text nodes, never attributes, headers or URLs.
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nueva solicitud · EXOM</title></head>
<body style="margin:0;padding:0;background-color:#101111;color:#f2f1e9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#101111"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;table-layout:fixed;background-color:#191b19;color:#f2f1e9;">
<tr><td style="padding:28px 24px;border-top:4px solid #baf23a;">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#f2f1e9;"><img src="cid:exom-header" width="552" height="190" alt="EXOM. Nueva solicitud. Un nuevo punto de partida." style="display:block;width:100%;max-width:552px;height:auto;border:0;color:#f2f1e9;font-family:Arial,Helvetica,sans-serif;font-size:20px;"></h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#b7bcb3;">Estas son las respuestas recibidas desde el formulario de EXOM.</p>
</td></tr>
${rows.map(([label, value]) => `<tr><td style="padding:16px 24px;border-top:1px solid #363b32;word-wrap:break-word;overflow-wrap:anywhere;"><p style="margin:0 0 6px;font-size:13px;line-height:1.5;font-weight:700;color:#baf23a;">${escape(label)}</p><p style="margin:0;font-size:16px;line-height:1.6;color:#f2f1e9;">${escape(value).replace(/\r?\n/g, '<br>')}</p></td></tr>`).join('\n')}
<tr><td style="padding:20px 24px;border-top:1px solid #363b32;font-size:12px;line-height:1.6;color:#b7bcb3;word-wrap:break-word;overflow-wrap:anywhere;">Solicitud: ${escape(reference)}<br>Aviso mostrado: ${escape(VERSION)}</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

function createApplicationHandler({ origin, send, simulated = true, secret = randomBytes(32), now = Date.now } = {}) {
  if (!origin || typeof send !== 'function') throw Error('Explicit origin and transport required');
  const digest = value => createHmac('sha256', secret).update(value).digest('base64url');
  const clients = new Map(), submissions = new Map();
  // shortcut: quotas are per process, configure a verified shared edge limit before a multi-instance deployment.
  let globalWindow = now(), globalSends = 0;
  return async function handle(request, clientAddress = 'unknown') {
    try {
      const url = new URL(request.url);
      if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Método no permitido.' }, { Allow: 'GET, POST' });
      if (url.search) return json(400, { error: 'No envíes respuestas en la URL.' });
      if (url.origin !== origin || (request.headers.has('origin') && request.headers.get('origin') !== origin)
        || (request.method === 'POST' && request.headers.get('origin') !== origin)
        || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))) return json(403, { error: 'Abre el formulario desde este sitio.' });
      const time = now();
      for (const [key, value] of clients) if (time - value.at >= WINDOW) clients.delete(key);
      for (const [key, value] of submissions) if (time > value.expires) submissions.delete(key);
      const client = digest(String(clientAddress));
      if (!clients.has(client)) {
        if (clients.size >= 1000) return json(429, { error: 'Demasiadas solicitudes. Espera diez minutos.' }, { 'Retry-After': '600' });
        clients.set(client, { at: time, requests: 0, sends: 0 });
      }
      const quota = clients.get(client);
      if (++quota.requests > 30) return json(429, { error: 'Demasiados intentos. Espera diez minutos.' }, { 'Retry-After': '600' });
      if (request.method === 'GET') {
        const payload = `${time}.${randomUUID()}`;
        return json(200, { token: `${payload}.${digest(payload)}`, version: VERSION, simulated });
      }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '') || request.headers.has('content-encoding')) {
        return json(415, { error: 'Envía la solicitud en formato JSON sin compresión.' });
      }
      let body;
      try { body = await readBody(request); }
      catch (status) { return json([408, 413].includes(status) ? status : 400, { error: status === 413 ? 'La solicitud es demasiado grande.' : 'No se pudo leer la solicitud. Revisa los datos y reintenta.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['token', 'version', 'website', 'answers'].includes(key))
        || body.version !== VERSION || body.website !== '') return json(400, { error: 'Solicitud no válida.' });
      const token = typeof body.token === 'string' ? body.token : '';
      const match = /^(\d{13})\.([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token);
      if (!match || !timingSafeEqual(Buffer.from(match[3]), Buffer.from(digest(`${match[1]}.${match[2]}`)))) return json(403, { error: 'Verificación no válida. Vuelve a abrir el formulario.' });
      const age = time - Number(match[1]);
      if (age < 3000) return json(429, { error: 'Espera unos segundos antes de enviar.' }, { 'Retry-After': '3' });
      if (age > TOKEN_TTL) return json(409, { code: 'expired', error: 'La sesión del formulario ha caducado. Vuelve a intentarlo.' });
      const { data, errors } = validateApplication(body.answers);
      if (!data) return json(422, { error: 'Revisa los campos indicados.', errors });
      const fingerprint = digest(JSON.stringify(data)), previous = submissions.get(token);
      if (previous && previous.fingerprint !== fingerprint) return json(409, { error: 'Los datos han cambiado tras un intento. No podemos confirmar el envío anterior; contacta con EXOM antes de volver a enviar.' });
      if (previous?.result) return json(200, previous.result);
      if (previous?.pending) return json(200, await previous.pending);
      if (time - globalWindow >= WINDOW) { globalWindow = time; globalSends = 0; }
      if (quota.sends >= 3 || globalSends >= 20 || submissions.size >= 1000) return json(429, { error: 'Límite de envíos alcanzado. Espera diez minutos.' }, { 'Retry-After': '600' });
      quota.sends++; globalSends++;
      const entry = previous || { fingerprint, expires: Number(match[1]) + TOKEN_TTL };
      submissions.set(token, entry);
      entry.pending = (async () => {
        await send({ to: RECIPIENT, subject: SUBJECT, ...formatMessage(data, match[2]), idempotencyKey: `application/${match[2]}` });
        entry.result = { ok: true, simulated };
        return entry.result;
      })();
      try { return json(200, await entry.pending); }
      finally { entry.pending = null; }
    } catch {
      return json(503, { error: 'No podemos confirmar el envío. Reintenta sin cambiar las respuestas; no se enviará de nuevo si ya fue aceptado durante esta sesión.' });
    }
  };
}

function createResendTransport({ apiKey, from, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey || typeof from !== 'string' || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw Error('Invalid mail configuration');
  const header = readFileSync(__dirname + '/assets/email-header.png').toString('base64');
  return async ({ to, subject, text, html, idempotencyKey }) => {
    if (to !== RECIPIENT || subject !== SUBJECT) throw Error('Unapproved mail destination');
    const result = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: `EXOM <${from}>`, to: [RECIPIENT], subject: SUBJECT, text, html,
        attachments: [{ filename: 'exom.png', content: header, content_id: 'exom-header' }] })
    });
    if (!result.ok) { await result.body?.cancel(); throw Error('Mail not confirmed'); }
    const receipt = await result.json();
    if (typeof receipt.id !== 'string' || !receipt.id) throw Error('Mail not confirmed');
  };
}
module.exports = { createApplicationHandler, createResendTransport, formatMessage, VERSION, MAX_BODY, TOKEN_TTL };
