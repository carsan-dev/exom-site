'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('./form-rules.js');
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const controls = {}, requests = [], replies = [], message = { textContent: '' }, note = { textContent: '' };
  const labels = Array.from({ length: 3 }, () => ({ setAttribute() {}, removeAttribute() {} }));
  const steps = labels.map(() => ({ hidden: false, fieldset: { disabled: true }, heading: { focus() {} }, querySelector(selector) { return selector === 'fieldset' ? this.fieldset : this.heading; } }));
  const button = () => ({ disabled: false, hidden: false, events: {}, addEventListener(event, fn) { this.events[event] = fn; } });
  const next = button(), back = button(), counter = {};
  function input(name, type, value = '') {
    return { name, type, value, checked: false, validationMessage: '', attrs: {},
      setCustomValidity(value) { this.validationMessage = value; }, setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; }, reportValidity() { this.reported = true; } };
  }
  for (const key of ['name', 'age', 'country', 'phone', 'expectations']) controls[key] = [input(key, 'text')];
  for (const [key, values] of Object.entries({ occupation: ['study', 'work', 'other'], ...rules.choices })) controls[key] = values.map(value => input(key, ['occupation', 'obstacles'].includes(key) ? 'checkbox' : 'radio', value));
  const form = {
    action: 'http://127.0.0.1:4176/prototype-v4/api/solicitudes', events: {}, elements: { website: { value: '' } },
    querySelectorAll(selector) { return selector === '.form-step' ? steps : selector === '.form-progress li' ? labels : controls[selector.match(/name="([^"]+)"/)[1]]; },
    querySelector(selector) { return { '#form-next': next, '#form-back': back, '#form-message': message, '.demo-note': note, '#step-count': counter }[selector]; },
    addEventListener(event, fn) { this.events[event] = fn; }, setAttribute() {}, getBoundingClientRect() { return { top: 100 }; },
    reset() { Object.values(controls).flat().forEach(el => { if (el.type === 'text') el.value = ''; else el.checked = false; }); }
  };
  const session = { token: 'test-token', version: 'test-version', simulated: true };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (!options.method) return Response.json(session);
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply() : reply || Response.json({ ok: true, simulated: true });
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/form-client.js', 'utf8'), { document: { querySelector: () => form }, window: { ExomFormRules: rules }, fetch, AbortSignal });
  const submit = () => form.events.submit({ preventDefault() {} });
  const fill = (key, value) => { for (const el of controls[key]) { if (el.type === 'text') el.value = value; else el.checked = (Array.isArray(value) ? value : [value]).includes(el.value); } };
  const fillAll = () => {
    for (const [key, value] of Object.entries({ name: 'Persona ficticia', age: '25', country: 'España', phone: '+34900000000', occupation: ['work'], goal: 'muscle', food: 'none', expectations: 'Organizar mis entrenamientos', obstacles: ['plan'], condition: 'improve', start: 'information' })) fill(key, value);
  };
  return { controls, steps, next, back, note, message, requests, replies, form, submit, fill, fillAll };
}
async function check() {
  const h = harness(); await settle();
  assert.ok(h.note.textContent.includes('datos ficticios'));
  assert.ok(h.steps.every(step => !step.fieldset.disabled));
  await h.submit(); assert.equal(h.requests.length, 1); assert.ok(h.controls.name[0].reported);
  h.fillAll(); h.fill('age', '17'); await h.submit();
  assert.equal(h.requests.length, 1); assert.match(h.message.textContent, /padre, madre o tutor/);
  h.fill('age', '25'); await h.submit(); assert.equal(h.steps[1].hidden, false);
  h.fill('expectations', 'a'.repeat(301)); await h.submit(); assert.equal(h.steps[1].hidden, false);
  h.fill('expectations', 'Organizar mis entrenamientos'); await h.submit(); assert.equal(h.steps[2].hidden, false);
  h.back.events.click(); assert.equal(h.steps[1].hidden, false); assert.equal(h.controls.name[0].value, 'Persona ficticia');
  await h.submit();
  h.replies.push(new Error('offline'));
  await h.submit(); assert.ok(h.message.textContent.includes('Comprueba tu conexión')); assert.equal(h.next.disabled, false);
  const initialBody = h.requests.at(-1).options.body;
  assert.equal(h.controls.name[0].value, 'Persona ficticia');
  let release; h.replies.push(() => new Promise(resolve => { release = resolve; }));
  const pending = h.submit(); await settle();
  assert.ok(h.next.disabled && h.back.disabled && h.steps.every(step => step.fieldset.disabled));
  const count = h.requests.length; await h.submit(); assert.equal(h.requests.length, count, 'Double click sends once');
  release(Response.json({ ok: true, simulated: true })); await pending;
  assert.equal(h.requests.at(-1).options.body, initialBody, 'Retry preserves token and answers');
  assert.ok(h.message.textContent.includes('No se ha enviado ningún correo'));
  assert.ok(h.next.disabled); assert.equal(h.controls.name[0].value, '', 'Clear answers only after confirmed success');
  await h.submit(); assert.equal(h.requests.length, count);
  for (const request of h.requests) {
    assert.ok(!request.url.includes('?') && !request.url.includes('Persona'));
    if (request.options.body) assert.equal(request.options.method, 'POST');
  }
  for (const [status, payload] of [[429, { error: 'Espera diez minutos.' }], [422, { errors: { phone: 'Revisa el teléfono.' } }], [503, { error: 'Reintenta sin cambiar los datos.' }]]) {
    const f = harness(); await settle(); f.fillAll(); await f.submit(); await f.submit();
    f.replies.push(Response.json(payload, { status })); await f.submit();
    assert.equal(f.controls.name[0].value, 'Persona ficticia'); assert.equal(f.next.disabled, false);
    if (status === 422) assert.equal(f.steps[0].hidden, false, 'Server errors reveal the relevant step');
    else assert.equal(f.message.textContent, payload.error);
  }
  const expired = harness(); await settle(); expired.fillAll(); await expired.submit(); await expired.submit();
  expired.replies.push(Response.json({ code: 'expired' }, { status: 409 })); await expired.submit();
  assert.equal(expired.requests.filter(r => r.options.method === 'POST').length, 1, 'Expiry never triggers automatic resubmission');
  assert.ok(expired.message.textContent.includes('caducado')); assert.equal(expired.controls.name[0].value, 'Persona ficticia');
  const uncertain = harness(); await settle(); uncertain.fillAll(); await uncertain.submit(); await uncertain.submit();
  uncertain.replies.push(new Error('response lost')); await uncertain.submit();
  uncertain.replies.push(Response.json({ code: 'expired' }, { status: 409 })); await uncertain.submit();
  assert.equal(uncertain.requests.filter(r => !r.options.method).length, 1, 'Do not renew a key after an uncertain delivery expires');
  assert.ok(uncertain.next.disabled && uncertain.message.textContent.includes('contacta'), 'An uncertain expired operation requires reconciliation, not a new submission');
  console.log('PASS: client three-step validation, minor block, backwards navigation, offline/HTTP errors, duplicate click, stable retry, expiry and clearing only after confirmation.');
}
module.exports = check;
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1; });
