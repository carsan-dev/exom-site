'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validateAge, validateOccupation, validateEligibility } = require('./form-rules.js');
const read = file => fs.readFileSync(__dirname + '/' + file, 'utf8');

module.exports = async function checkForm() {
  for (const value of [undefined, null, '', ' ', true, [], {}, -1, 121, 18.5, '18.5', '1e2', '0x12', '018', '18 ', NaN, Infinity]) assert.ok(validateAge(value), 'Reject malformed or out-of-range age');
  for (let age = 0; age < 14; age++) assert.match(validateAge(age), /padre, madre o tutor/);
  for (let age = 14; age < 18; age++) {
    for (const value of [age, String(age)]) assert.equal(validateAge(value), 'Si tienes de 14 a 17 años, debe contactar con EXOM tu padre, madre o tutor. No puedes enviar una solicitud directa.');
  }
  for (const age of [18, '18', 120, '120']) assert.equal(validateAge(age), '');
  for (const value of [undefined, null, [], 'work', ['invalid'], ['work', 'work'], ['other', 'study'], ['other', 'work'], ['other', 'work', 'study']]) assert.ok(validateOccupation(value));
  for (const value of [['study'], ['work'], ['other'], ['study', 'work']]) assert.equal(validateOccupation(value), '');
  for (const data of [undefined, null, [], '', {}]) assert.ok(validateEligibility(data).age && validateEligibility(data).occupation);
  assert.deepEqual(validateEligibility({ age: 18, occupation: ['study', 'work'] }), { age: '', occupation: '' });
  assert.ok(validateEligibility({ age: 17, occupation: ['work'] }).age, 'Direct server-side invocation rejects minors without trusting browser attributes');

  function control(value) { return { value, checked: false, attrs: {}, addEventListener(event, fn) { this[event] = fn; }, setCustomValidity(message) { this.message = message; }, setAttribute(key, value) { this.attrs[key] = value; } }; }
  const age = control(''), ageMessage = {}, occupationMessage = {};
  const choices = ['study', 'work', 'other'].map(control);
  const document = { querySelector: selector => ({ '#demo-age': age, '#demo-age-message': ageMessage, '#demo-occupation-message': occupationMessage })[selector], querySelectorAll: () => choices };
  vm.runInNewContext(read('form-rules.js'), { document });
  const select = (index, checked = true) => { choices[index].checked = checked; choices[index].change(); };
  select(0); select(1); assert.deepEqual(choices.map(c => c.checked), [true, true, false]);
  select(2); assert.deepEqual(choices.map(c => c.checked), [false, false, true]);
  select(0); assert.deepEqual(choices.map(c => c.checked), [true, false, false]);
  select(2); select(1); assert.deepEqual(choices.map(c => c.checked), [false, true, false]);
  select(1, false); assert.ok(choices[0].message && occupationMessage.textContent);
  select(0); assert.equal(choices[0].message, '');
  for (const value of ['13', '14', '17', '18', '18.5', '120', '121', '']) {
    age.value = value; age.input(); assert.equal(age.message, validateAge(value)); assert.equal(ageMessage.textContent, age.message);
  }

  const html = read('index.html');
  assert.equal((html.match(/<fieldset disabled>/g) || []).length, 3);
  assert.ok(/<form\b/.test(html) && html.includes('type="submit"'));
  assert.ok(!/presupuesto/i.test(html));
  assert.ok(html.includes('name="expectations" maxlength="300"'));
  assert.ok(html.includes("connect-src 'self'; form-action 'self'"));
  assert.ok(html.includes('min="0" max="120" step="1"'));
  assert.ok(html.includes('Si tienes menos de 18 años, debe contactar con EXOM tu padre, madre o tutor. No envíes tus respuestas por este formulario.'));
  assert.ok(!html.includes('hasta definir el procedimiento'));
  assert.equal((html.match(/No incluyas diagnósticos, medicación ni otra información médica\./g) || []).length, 2);
  assert.ok(html.includes('Por ejemplo, organizar mejor tus entrenamientos, mantener la constancia o aprender a entrenar.'));
  const food = html.match(/<fieldset class="choice-group" id="demo-food"[\s\S]*?<\/fieldset>/)[0];
  assert.ok(food.includes('aria-describedby="demo-food-help demo-food-medical"'));
  for (const id of ['demo-food-help', 'demo-food-medical']) assert.ok(food.includes('id="' + id + '"'));
  assert.ok(food.includes('<legend>¿Qué te cuesta más de la alimentación a la hora de alcanzar tu objetivo? *</legend>'));
  assert.ok(!/<textarea|type="(?:text|checkbox)"|\bchecked\b/.test(food), 'Q7 has no free text, multiple choice or default answer');
  const foodChoices = [...food.matchAll(/<label><input type="radio" name="food" value="([^"]+)" required> ([^<]+)<\/label>/g)];
  assert.equal((food.match(/<input\b/g) || []).length, 6);
  assert.deepEqual(foodChoices.map(match => [match[1], match[2]]), [['quantities', 'Las cantidades'], ['schedules', 'Los horarios'], ['preparation', 'Preparar las comidas'], ['consistency', 'Mantener la constancia'], ['other', 'Otra dificultad'], ['none', 'Ninguna dificultad']], 'Every Q7 choice is required in the same native radio group; Other and None never open a text field');
  assert.equal((html.match(/<textarea\b/g) || []).length, 1, 'Only Q8 remains open');
  assert.ok(read('privacy.html').includes('Solo queda abierta la pregunta «¿Qué te gustaría conseguir con EXOM?»'));
  for (const field of ['goal']) {
    const tag = html.match(new RegExp('<textarea id="demo-' + field + '"[^>]+>'))[0];
    const ids = tag.match(/aria-describedby="([^"]+)"/)[1].split(' ');
    assert.ok(ids.includes('demo-' + field + '-medical'));
    ids.forEach(id => assert.ok(html.includes('id="' + id + '"')));
    assert.ok(tag.includes('required'));
  }
  assert.ok(html.includes('<label><input type="checkbox" name="obstacles" value="other"> Otro motivo</label>'));
  const condition = html.match(/<fieldset class="choice-group"><legend>¿Cómo te sientes[\s\S]*?<\/fieldset>/)[0];
  assert.equal((condition.match(/type="radio"/g) || []).length, 3);
  assert.ok(!/<textarea|type="text"/.test(condition));
  for (const expected of ['Moisés Sánchez Román (EXOM)', 'art. 6.1.b RGPD', 'máximo 90 días', 'privacy.html#solicitudes-web']) assert.ok(html.includes(expected));
  const privacy = html.match(/<div class="form-privacy small"[\s\S]*?<\/div>/)[0];
  const privacyBrief = privacy.split('<details>')[0];
  for (const expected of ['Moisés Sánchez Román (EXOM)', 'WhatsApp', 'medidas precontractuales', 'transferencias a EE. UU.', 'ejercer tus derechos', 'mailto:exom.method@gmail.com', 'privacy.html#solicitudes-web']) assert.ok(privacyBrief.includes(expected), 'Basic privacy information stays visible: ' + expected);
  assert.ok(privacy.includes('<details>\n            <summary>Más sobre tus datos</summary>'), 'Additional privacy details use a native, initially closed disclosure');
  assert.ok(!/<details\b[^>]*\bopen/.test(privacy));
  for (const expected of ['<strong>Proveedores:</strong> Vercel, Resend, Gmail y WhatsApp.', 'máximo 90 días', 'no hay borrado automático', 'Si no respondes']) assert.ok(privacy.split('<details>')[1].includes(expected), 'Additional privacy facts preserved: ' + expected);
  assert.ok(!/acepto la política|casilla de consentimiento/i.test(html));
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|console\./.test(read('form-rules.js')));
  const fixture = read('fixtures/form-demo-before.html');
  const application = html.match(/<section class="section application"[\s\S]*?<\/section>/)[0];
  const questionText = value => [...value.matchAll(/<(?:label|legend)[^>]*>([^<]* \*)<\/(?:label|legend)>/g)].map(match => match[1]);
  const optionText = value => [...value.matchAll(/<label><input[^>]*> ([^<]+)<\/label>/g)].map(match => match[1]);
  assert.deepEqual(questionText(application), questionText(fixture), 'All eleven approved question labels are preserved');
  assert.equal(questionText(application).length, 11);
  assert.deepEqual(optionText(application), optionText(fixture), 'Every approved answer label is preserved');
  for (const [name, values] of Object.entries(require('./form-rules.js').choices)) {
    const inputs = [...application.matchAll(new RegExp('<input[^>]*name="' + name + '"[^>]*value="([^"]+)"[^>]*>', 'g'))];
    assert.deepEqual(inputs.map(match => match[1]), values, 'UI values match the server enum: ' + name);
    if (name !== 'obstacles') assert.ok(inputs.every(match => match[0].includes('required')));
  }
  assert.equal(application.match(/<div class="application-copy">[\s\S]*?<\/div>/)[0], fixture.match(/<div class="application-copy">[\s\S]*?<\/div>/)[0]);
  assert.ok(!read('app.js').includes('Demo-only navigation'), 'Only the new controller owns form navigation');
  for (const file of ['form-rules.js', 'form-checks.cjs']) assert.ok(!read(file).includes('\r'));
  console.log('PASS: form eligibility server/browser parity, age boundaries, occupation combinations, help associations, closed questions, exact question/answer parity and disabled-until-ready controls.');
};
if (require.main === module) module.exports().catch(error => { console.error(error); process.exitCode = 1; });
