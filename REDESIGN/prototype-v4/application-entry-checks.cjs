'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

async function isolatedChecks() {
  const origin = 'https://www.exommethod.com';
  const config = {
    EXOM_FORM_ENABLED: 'true', EXOM_FORM_EDGE_LIMIT_VERIFIED: 'true',
    EXOM_FORM_SECRET: 'test-only-secret-not-for-production',
    RESEND_API_KEY: 'fake-test-key', RESEND_FORM_EMAIL: 'contacto@exommethod.com'
  };
  delete process.env.EXOM_FORM_FROM;
  delete process.env.RESEND_FROM_EMAIL;
  Object.assign(process.env, config);
  let calls = 0, sequence = 0, time = 1793822400000;
  Date.now = () => time;
  // This child has synthetic configuration only; no request can reach a real mail service.
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer fake-test-key');
    const mail = JSON.parse(options.body);
    assert.equal(mail.from, 'EXOM <contacto@exommethod.com>');
    assert.deepEqual(mail.to, ['exommethod@gmail.com']);
    assert.equal(mail.subject, 'EXOM · Nueva solicitud web');
    calls++;
    return Response.json({ id: 'simulated-receipt' });
  };
  const freshEntry = async () => (await import(pathToFileURL(__dirname + '/api/solicitudes.mjs').href + '?check=' + sequence++)).default;
  const request = (body, source = origin, headers = {}) => new Request(source + '/api/solicitudes/', {
    method: body ? 'POST' : 'GET',
    headers: { Origin: source, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  for (const key of Object.keys(config)) {
    delete process.env[key];
    assert.equal((await (await freshEntry()).fetch(request())).status, 503, 'Missing required setting: ' + key);
    process.env[key] = config[key];
  }
  for (const [key, value] of [['EXOM_FORM_ENABLED', 'false'], ['EXOM_FORM_EDGE_LIMIT_VERIFIED', 'false'],
    ['EXOM_FORM_SECRET', 'short'], ['RESEND_FORM_EMAIL', 'bad\r\nBcc: other@example.test']]) {
    process.env[key] = value;
    assert.equal((await (await freshEntry()).fetch(request())).status, 503, 'Invalid setting: ' + key);
    process.env[key] = config[key];
  }
  assert.equal(calls, 0);
  const entry = await freshEntry();
  const tokenResponse = await entry.fetch(request());
  assert.equal(tokenResponse.status, 200, 'The observed production www origin and existing sender setting are accepted');
  const { token, version, simulated } = await tokenResponse.json();
  assert.equal(simulated, false, 'Exercise the production entry with a mocked transport, not the local simulation entry');
  const answers = { name: 'Persona de prueba', age: '25', country: 'España', phone: '+34 900 000 000', occupation: ['work'],
    goal: 'muscle', food: 'none', expectations: 'Organizar mejor mis entrenamientos.', obstacles: ['plan'], condition: 'improve', start: 'information' };
  const body = { token, version, website: '', answers };
  time += 3000;
  for (const source of ['https://exommethod.com', 'https://exom-site.vercel.app', 'https://preview.example.test']) {
    assert.equal((await entry.fetch(request(null, source))).status, 403, 'Do not issue tokens to aliases');
    assert.equal((await entry.fetch(request(body, source))).status, 403, 'Do not redirect or forward submitted answers');
    assert.equal((await entry.fetch(request(body, origin, { Origin: source }))).status, 403, 'Reject a mismatched Origin header');
  }
  const untrusted = request(body);
  untrusted.headers.delete('x-vercel-forwarded-for');
  untrusted.headers.set('x-forwarded-for', '192.0.2.2');
  assert.equal((await entry.fetch(untrusted)).status, 503, 'Require the platform-controlled address header');
  assert.equal((await entry.fetch(request({ ...body, answers: { ...answers, age: 17 } }))).status, 422);
  assert.equal(calls, 0, 'No mail attempts for rejected requests');
  const response = await entry.fetch(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, simulated: false });
  assert.equal((await entry.fetch(request(body))).status, 200);
  assert.equal(calls, 1, 'Retry is acknowledged without a second provider call');
  process.env.EXOM_FORM_ENABLED = 'false';
  assert.equal((await entry.fetch(request(body))).status, 503, 'Disabling still closes a warm handler');
  assert.equal(calls, 1);
  const rootEntry = (await import(pathToFileURL(__dirname + '/../../api/solicitudes.mjs').href)).default;
  assert.equal((await rootEntry.fetch(request())).status, 503, 'The root deployment entry is also closed by default');
  process.env.EXOM_FORM_ENABLED = 'true';
  const rootSession = await rootEntry.fetch(request());
  assert.equal(rootSession.status, 200);
  const rootToken = await rootSession.json();
  const rootBody = { ...body, token: rootToken.token, version: rootToken.version };
  time += 3000;
  assert.equal((await rootEntry.fetch(request({ ...rootBody, answers: { ...answers, age: 17 } }))).status, 422);
  assert.equal((await rootEntry.fetch(request(rootBody))).status, 200);
  assert.equal((await rootEntry.fetch(request(rootBody))).status, 200);
  assert.equal(calls, 2, 'Root entry uses the same protected handler and isolated mocked transport');
  process.env.EXOM_FORM_EDGE_LIMIT_VERIFIED = 'false';
  assert.equal((await rootEntry.fetch(request(rootBody))).status, 503);
}

function check() {
  const result = spawnSync(process.execPath, [__filename, '--isolated'], {
    env: process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {},
    encoding: 'utf8', timeout: 15000, windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Isolated entry checks failed');
  console.log('PASS: production entry accepts www and existing sender configuration, rejects aliases/minors/missing gates, and sends only through an isolated mock.');
}
module.exports = check;
if (require.main === module) {
  if (process.argv.includes('--isolated')) isolatedChecks().catch(error => { console.error(error); process.exitCode = 1; });
  else check();
}
