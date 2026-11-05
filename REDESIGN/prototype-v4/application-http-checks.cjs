'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('./serve.cjs');
const { MAX_BODY } = require('./application-server.cjs');
async function check() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, endpoint = base + '/prototype-v4/api/solicitudes';
  try {
    const session = await (await fetch(endpoint)).json();
    assert.equal(session.simulated, true);
    const body = { token: session.token, version: session.version, website: '', answers: {
      name: 'Prueba HTTP ficticia', age: '25', country: 'España', phone: '+34900000000', occupation: ['work'],
      goal: 'muscle', food: 'none', expectations: 'Organizar mis entrenamientos.', obstacles: ['plan'], condition: 'improve', start: 'information'
    } };
    const post = (value, extra = {}) => fetch(endpoint, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(value) });
    for (const method of ['HEAD', 'PUT', 'OPTIONS']) assert.equal((await fetch(endpoint, { method })).status, 405);
    assert.equal((await post(body, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await post(body, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ ...body, excess: 'x'.repeat(MAX_BODY) })).status, 413);
    assert.equal((await fetch(endpoint + '?answers=not-allowed')).status, 400);
    for (const file of ['application-server.cjs', 'api/solicitudes.mjs', 'fixtures/form-demo-before.html']) {
      assert.equal((await fetch(base + '/prototype-v4/' + file)).status, 404, 'Private server/test source is not served');
    }
    const malformed = await new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port: server.address().port, path: 'http://[invalid' }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end();
    });
    assert.equal(malformed, 400, 'Malformed URLs do not crash the preview');
    await new Promise(resolve => setTimeout(resolve, 3100));
    assert.equal((await post({ ...body, answers: { ...body.answers, age: '17' } })).status, 422);
    const accepted = await post(body);
    assert.equal(accepted.status, 200); assert.deepEqual(await accepted.json(), { ok: true, simulated: true });
    const duplicate = await post(body);
    assert.equal(duplicate.status, 200); assert.deepEqual(await duplicate.json(), { ok: true, simulated: true });
    assert.equal((await fetch(base + '/prototype-v4/')).status, 200);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: real loopback HTTP, POST simulation, duplicate acknowledgement, minor/origin/format/size rejection, malformed URL recovery and private-source isolation.');
}
module.exports = check;
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
