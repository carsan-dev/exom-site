'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { validateApplication } = require('./form-rules.js');
const { createApplicationHandler, createResendTransport, formatMessage, VERSION, MAX_BODY, TOKEN_TTL } = require('./application-server.cjs');
const origin = 'https://example.test';
const valid = () => ({ name: 'Persona de prueba', age: '25', country: 'España', phone: '+34 900 000 000', occupation: ['work'],
  goal: 'muscle', food: 'none', expectations: 'Organizar mejor mis entrenamientos.', obstacles: ['plan'], condition: 'improve', start: 'information' });

function harness(transport) {
  let time = 1793822400000, calls = [];
  const send = transport || (async mail => { calls.push(mail); });
  const handler = createApplicationHandler({ origin, now: () => time, secret: 'test-only-secret-not-for-production', send });
  const request = (body, headers = {}, method = 'POST', suffix = '') => new Request(origin + '/api/solicitudes' + suffix, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    ...(!['GET', 'HEAD'].includes(method) ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  });
  const submit = (body, headers, address = 'test-client') => handler(request(body, headers), address);
  const prepare = async () => {
    const response = await handler(request(null, {}, 'GET'), 'test-client');
    assert.equal(response.status, 200);
    const { token, version, simulated } = await response.json();
    assert.equal(simulated, true);
    time += 3000;
    return { token, version, website: '', answers: valid() };
  };
  return { handler, request, submit, prepare, calls, advance: ms => { time += ms; } };
}

async function check() {
  assert.ok(validateApplication(valid()).data);
  for (const key of Object.keys(valid())) {
    const missing = valid(); delete missing[key];
    assert.ok(validateApplication(missing).errors[key], `Required: ${key}`);
    assert.ok(validateApplication({ ...valid(), [key]: {} }).errors[key], `Type: ${key}`);
  }
  for (const age of [0, '13', 14, 17, -1, '18.5', '1e2', null, true, 121]) assert.ok(validateApplication({ ...valid(), age }).errors.age);
  for (const age of [18, 120, '18', '120']) assert.ok(validateApplication({ ...valid(), age }).data);
  for (const [key, max] of [['name', 100], ['country', 80], ['expectations', 300]]) {
    assert.ok(validateApplication({ ...valid(), [key]: 'a'.repeat(max) }).data);
    assert.ok(validateApplication({ ...valid(), [key]: 'a'.repeat(max + 1) }).errors[key]);
    assert.ok(validateApplication({ ...valid(), [key]: '  ' }).errors[key]);
    assert.ok(validateApplication({ ...valid(), [key]: 'a\u0000b' }).errors[key]);
  }
  for (const phone of ['12345', '+012345678', '+1234567890123456', '+34\n900000000', 'javascript:1', {}]) assert.ok(validateApplication({ ...valid(), phone }).errors.phone);
  assert.equal(validateApplication(valid()).data.phone, '+34900000000');
  assert.equal(validateApplication({ ...valid(), name: ' 李明 ' }).data.name, '李明');
  assert.equal(validateApplication({ ...valid(), name: '<script>example</script>' }).data.name, '<script>example</script>', 'Plain text input is not rendered as HTML');
  for (const key of ['goal', 'food', 'condition', 'start']) assert.ok(validateApplication({ ...valid(), [key]: 'unlisted' }).errors[key]);
  for (const obstacles of [[], ['plan', 'plan'], ['invalid'], 'plan']) assert.ok(validateApplication({ ...valid(), obstacles }).errors.obstacles);
  assert.ok(validateApplication({ ...valid(), occupation: ['other', 'work'] }).errors.occupation);
  assert.ok(validateApplication({ ...valid(), age: { toString: null, valueOf: null } }).errors.age, 'Reject wrong types before coercion');
  assert.ok(validateApplication({ ...valid(), occupation: [{ toString: null }, { toString: null }] }).errors.occupation, 'Reject wrong types before sorting');
  for (const value of [null, [], true, { ...valid(), from: 'attacker@example.test' }, JSON.parse('{"__proto__":{}}')]) assert.ok(Object.keys(validateApplication(value).errors).length);

  const h = harness(), body = await h.prepare();
  assert.equal((await h.handler(h.request(null, {}, 'DELETE'))).status, 405);
  assert.equal((await h.handler(h.request(null, {}, 'GET', '?data=redacted'))).status, 400);
  for (const headers of [{ Origin: 'https://other.test' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await h.submit(body, headers)).status, 403);
  const noOrigin = h.request(body); noOrigin.headers.delete('origin');
  assert.equal((await h.handler(noOrigin)).status, 403);
  assert.equal((await h.submit(body, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await h.submit(body, { 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal((await h.submit(body, { 'Content-Length': String(MAX_BODY + 1) })).status, 413);
  assert.equal((await h.submit('x'.repeat(MAX_BODY + 1))).status, 413);
  assert.equal((await h.submit('{')).status, 400);
  for (const override of [{ website: 'bot' }, { version: 'old' }, { extra: 'ignored?' }]) assert.equal((await h.submit({ ...body, ...override })).status, 400);
  assert.equal((await h.submit({ ...body, token: body.token.slice(0, -1) + (body.token.endsWith('a') ? 'b' : 'a') })).status, 403);
  assert.equal((await h.submit({ ...body, answers: { ...valid(), age: 17 } })).status, 422);
  assert.equal(h.calls.length, 0, 'Invalid requests produce no mail effects');
  const response = await h.submit(body);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, simulated: true });
  assert.equal(h.calls.length, 1);
  const mail = h.calls[0];
  assert.deepEqual(Object.keys(mail).sort(), ['html', 'idempotencyKey', 'subject', 'text', 'to']);
  assert.equal(mail.to, 'exommethod@gmail.com');
  assert.equal(mail.subject, 'EXOM · Nueva solicitud web');
  assert.ok(!mail.subject.includes(valid().name) && mail.text.includes(VERSION));
  assert.ok(mail.text.includes('WhatsApp: +34900000000'));
  assert.ok(!mail.text.includes('test-client'), 'No IP in email content');
  const normalized = validateApplication(valid()).data;
  const reference = mail.idempotencyKey.slice('application/'.length);
  assert.deepEqual({ text: mail.text, html: mail.html }, formatMessage(normalized, reference));
  const plainBefore = `Solicitud: ${reference}\nAviso mostrado: ${VERSION}\n\nNombre: Persona de prueba\n\nEdad: 25\n\nPaís de residencia: España\n\nWhatsApp: +34900000000\n\nOcupación: Trabajo\n\nObjetivo: Ganar masa muscular\n\nAlimentación: Ninguna dificultad\n\nQué desea conseguir: Organizar mejor mis entrenamientos.\n\nObstáculos: No tengo un plan claro\n\nPercepción física: Me cuido, pero podría hacerlo mejor\n\nInicio: Por ahora, solo quiero recibir información`;
  assert.equal(mail.text, plainBefore, 'Keep the previous plain-text alternative byte for byte');
  for (const row of mail.text.split('\n\n').slice(1)) {
    const separator = row.indexOf(': ');
    assert.ok(mail.html.includes('>' + row.slice(0, separator) + '</p>'));
    assert.ok(mail.html.includes('>' + row.slice(separator + 2) + '</p>'), 'Every answer is also in HTML');
  }
  const hostile = formatMessage({ ...normalized, name: '<img src=x onerror="alert(1)">', country: "O'Connor & <España>", expectations: 'Primera línea\n<a href="https://evil.test">texto</a>' }, '<reference&>');
  assert.ok(hostile.text.includes('<img src=x onerror="alert(1)">'), 'Plain text remains plain text');
  for (const escaped of ['&lt;img src=x onerror=&quot;alert(1)&quot;&gt;', 'O&#39;Connor &amp; &lt;España&gt;', 'Primera línea<br>&lt;a href=&quot;https://evil.test&quot;&gt;texto&lt;/a&gt;', '&lt;reference&amp;&gt;']) assert.ok(hostile.html.includes(escaped));
  assert.equal((hostile.html.match(/<img\b/g) || []).length, 1, 'Only the fixed EXOM header is an image');
  assert.ok(!/<(?:script|a|iframe|form|input)\b/.test(hostile.html), 'Answers cannot add markup, controls or links');
  assert.deepEqual([...hostile.html.matchAll(/\bsrc="([^"]+)"/g)].map(match => match[1]), ['cid:exom-header'], 'No external image request or tracking');
  assert.ok(hostile.html.includes('alt="EXOM. Nueva solicitud. Un nuevo punto de partida."'), 'Heading stays available to screen readers and with blocked images');
  const longMail = formatMessage({ ...normalized, name: 'á'.repeat(100), country: '国'.repeat(80), expectations: '&'.repeat(300) }, reference);
  assert.ok(longMail.html.includes('&amp;'.repeat(300)) && Buffer.byteLength(longMail.html) < 100000);
  assert.equal((await h.submit(body)).status, 200); assert.equal(h.calls.length, 1);
  assert.equal((await h.submit({ ...body, answers: { ...valid(), name: 'Changed' } })).status, 409);

  const expiry = harness(), expired = await expiry.prepare();
  expiry.advance(TOKEN_TTL + 1);
  assert.equal((await expiry.submit(expired)).status, 409); assert.equal(expiry.calls.length, 0);
  const fast = harness(), tooFast = await fast.prepare(); fast.advance(-3000);
  assert.equal((await fast.submit(tooFast)).status, 429);
  const unicode = harness(), big = await unicode.prepare();
  assert.equal((await unicode.submit(JSON.stringify(big) + ' '.repeat(MAX_BODY))).status, 413);
  const chunks = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BODY)); controller.enqueue(new Uint8Array(1)); controller.close(); } });
  assert.equal((await unicode.handler(new Request(origin + '/api/solicitudes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: chunks, duplex: 'half' }))).status, 413, 'Stream limit without content-length');
  const malformed = new Request(origin + '/api/solicitudes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) });
  assert.equal((await unicode.handler(malformed)).status, 400, 'Reject malformed UTF-8');
  let cancelled = false;
  const stalled = new ReadableStream({ cancel() { cancelled = true; } });
  assert.equal((await unicode.handler(new Request(origin + '/api/solicitudes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: stalled, duplex: 'half' }))).status, 408, 'Bound time spent waiting for a request body');
  assert.equal(cancelled, true);

  let release, count = 0;
  const concurrent = harness(async () => { count++; await new Promise(resolve => { release = resolve; }); });
  const same = await concurrent.prepare(), first = concurrent.submit(same);
  await new Promise(resolve => setImmediate(resolve));
  const second = concurrent.submit(same);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(count, 1); release();
  assert.equal((await first).status, 200); assert.equal((await second).status, 200); assert.equal(count, 1);
  let fail = true; const attempts = [];
  const retry = harness(async mail => { attempts.push(mail); if (fail) throw Error('secret and response body must never escape'); });
  const retryBody = await retry.prepare(), failure = await retry.submit(retryBody);
  assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('secret'));
  fail = false; assert.equal((await retry.submit(retryBody)).status, 200);
  assert.deepEqual(attempts[0], attempts[1], 'Retry uses identical provider key AND payload, including notice/reference');

  const rate = harness();
  for (let i = 0; i < 3; i++) assert.equal((await rate.submit(await rate.prepare())).status, 200);
  const limited = await rate.submit(await rate.prepare());
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '600');
  rate.advance(10 * 60 * 1000); assert.equal((await rate.submit(await rate.prepare())).status, 200);
  const flood = harness();
  for (let i = 0; i < 30; i++) assert.equal((await flood.handler(flood.request(null, {}, 'GET'))).status, 200);
  assert.equal((await flood.handler(flood.request(null, {}, 'GET'))).status, 429);
  const capacity = harness();
  for (let i = 0; i < 1000; i++) assert.equal((await capacity.handler(capacity.request(null, {}, 'GET'), 'client-' + i)).status, 200);
  assert.equal((await capacity.handler(capacity.request(null, {}, 'GET'), 'overflow')).status, 429, 'Bound client state, not just per-client traffic');
  capacity.advance(10 * 60 * 1000);
  assert.equal((await capacity.handler(capacity.request(null, {}, 'GET'), 'overflow')).status, 200, 'Reclaim expired client state');

  const sent = [], providerKeys = new Set(); let providerDeliveries = 0;
  const transport = createResendTransport({ apiKey: 'fake-test-key', from: 'sender@example.test', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    sent.push({ ...options, signal: undefined });
    if (!providerKeys.has(options.headers['Idempotency-Key'])) { providerKeys.add(options.headers['Idempotency-Key']); providerDeliveries++; }
    return Response.json({ id: randomUUID() });
  } });
  await transport(mail); await transport(mail);
  assert.equal(providerDeliveries, 1, 'Provider contract simulation, not evidence of live Resend behavior');
  assert.deepEqual(sent[0], sent[1]);
  assert.deepEqual(Object.keys(JSON.parse(sent[0].body)).sort(), ['attachments', 'from', 'html', 'subject', 'text', 'to']);
  assert.equal(JSON.parse(sent[0].body).from, 'EXOM <sender@example.test>');
  const payload = JSON.parse(sent[0].body);
  assert.equal(payload.html, mail.html); assert.equal(payload.text, mail.text);
  assert.deepEqual(payload.attachments, [{ filename: 'exom.png', content: fs.readFileSync(__dirname + '/assets/email-header.png').toString('base64'), content_id: 'exom-header' }]);
  const png = Buffer.from(payload.attachments[0].content, 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1104); assert.equal(png.readUInt32BE(20), 380);
  assert.ok(png.length <= 150000, 'Header stays lightweight');
  await assert.rejects(() => transport({ ...mail, to: 'other@example.test' }));
  assert.throws(() => createResendTransport({ apiKey: 'fake', from: 'x@example.test\r\nBcc: someone' }));
  for (const result of [new Response('private provider error', { status: 429 }), Response.json({})]) {
    const broken = createResendTransport({ apiKey: 'fake', from: 'sender@example.test', fetchImpl: async () => result });
    await assert.rejects(() => broken(mail), /^Error: Mail not confirmed$/);
  }
  const offline = createResendTransport({ apiKey: 'fake', from: 'sender@example.test', fetchImpl: async () => { throw new DOMException('Timeout', 'TimeoutError'); } });
  await assert.rejects(() => offline(mail), /Timeout/);
  require('./application-entry-checks.cjs')();
  for (const file of ['application-server.cjs', 'form-client.js', 'api/solicitudes.mjs']) {
    const source = fs.readFileSync(__dirname + '/' + file, 'utf8');
    assert.ok(!/console\.|localStorage|sessionStorage|sendBeacon/.test(source), 'No logs or persistent browser storage: ' + file);
    assert.ok(!source.includes('\r'));
  }
  console.log('PASS: eleven-field validation, minor rejection, bounded body/quotas, origin/token/honeypot, duplicates/concurrency/retry, sanitized errors, fixed mail headers and simulated Resend adapter.');
}
module.exports = check;
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
