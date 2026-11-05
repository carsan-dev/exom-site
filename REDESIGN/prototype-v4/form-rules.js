'use strict';

// Shared validation; this module never sends or persists data.
(function () {
  function validateAge(value) {
    if (typeof value === 'string' && /^(0|[1-9]\d{0,2})$/.test(value)) value = Number(value);
    if (!Number.isInteger(value) || value < 0 || value > 120) return 'Introduce una edad entera entre 0 y 120 años.';
    if (value < 14) return 'Si tienes menos de 14 años, debe contactar con EXOM tu padre, madre o tutor.';
    if (value < 18) return 'Si tienes de 14 a 17 años, debe contactar con EXOM tu padre, madre o tutor. No puedes enviar una solicitud directa.';
    return '';
  }

  function validateOccupation(values) {
    if (!Array.isArray(values) || !values.length) return 'Selecciona al menos una situación.';
    if (values.some(value => !['study', 'work', 'other'].includes(value)) || new Set(values).size !== values.length) return 'Selecciona una situación válida.';
    if (values.includes('other') && values.length > 1) return 'Otra situación no se puede combinar con Estudio o Trabajo.';
    return '';
  }

  function validateEligibility(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { age: validateAge(undefined), occupation: validateOccupation(undefined) };
    return { age: validateAge(data.age), occupation: validateOccupation(data.occupation) };
  }

  const choices = {
    goal: ['muscle', 'fat', 'recomposition', 'other'],
    food: ['quantities', 'schedules', 'preparation', 'consistency', 'other', 'none'],
    obstacles: ['consistency', 'plan', 'knowledge', 'other'],
    condition: ['change', 'improve', 'maximize'],
    start: ['soon', 'thinking', 'information']
  };
  const fields = ['name', 'age', 'country', 'phone', 'occupation', 'goal', 'food', 'expectations', 'obstacles', 'condition', 'start'];

  function validateApplication(input) {
    const errors = {}, data = {};
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) {
      return { errors: { form: 'La solicitud contiene campos no válidos.' } };
    }
    for (const [key, max] of [['name', 100], ['country', 80], ['expectations', 300]]) {
      const value = typeof input[key] === 'string' ? input[key].trim().normalize('NFC').replace(/\r\n/g, '\n') : '';
      if (!value || value.length > max || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value) || (key !== 'expectations' && value.includes('\n'))) {
        errors[key] = `Completa este campo con un máximo de ${max} caracteres, sin caracteres de control.`;
      } else data[key] = value;
    }
    const eligibility = validateEligibility(input);
    for (const key of ['age', 'occupation']) if (eligibility[key]) errors[key] = eligibility[key];
    if (!eligibility.age) data.age = Number(input.age);
    if (!eligibility.occupation) data.occupation = [...input.occupation].sort();
    data.phone = typeof input.phone === 'string' && input.phone.length <= 32 && /^\+[\d ()-]+$/.test(input.phone)
      ? input.phone.replace(/[ ()-]/g, '') : '';
    if (!/^\+[1-9]\d{7,14}$/.test(data.phone)) errors.phone = 'Incluye +, el prefijo del país y entre 8 y 15 cifras.';
    for (const key of ['goal', 'food', 'condition', 'start']) {
      if (!choices[key].includes(input[key])) errors[key] = 'Selecciona una de las opciones.';
      else data[key] = input[key];
    }
    const obstacles = input.obstacles;
    if (!Array.isArray(obstacles) || !obstacles.length || obstacles.length > 4 || new Set(obstacles).size !== obstacles.length || obstacles.some(value => !choices.obstacles.includes(value))) {
      errors.obstacles = 'Selecciona al menos un motivo válido, sin repetir opciones.';
    } else data.obstacles = [...obstacles].sort();
    return { errors, data: Object.keys(errors).length ? undefined : data };
  }

  function bindControls(root) {
    const age = root.querySelector('#demo-age');
    const ageMessage = root.querySelector('#demo-age-message');
    const choices = [...root.querySelectorAll('[name="occupation"]')];
    const occupationMessage = root.querySelector('#demo-occupation-message');
    age.addEventListener('input', () => {
      const message = validateAge(age.value);
      age.setCustomValidity(message);
      age.setAttribute('aria-invalid', String(Boolean(message)));
      ageMessage.textContent = message;
    });
    for (const choice of choices) choice.addEventListener('change', () => {
      if (choice.checked) for (const other of choices) {
        if (other !== choice && (choice.value === 'other' || other.value === 'other')) other.checked = false;
      }
      const message = validateOccupation(choices.filter(input => input.checked).map(input => input.value));
      choices[0].setCustomValidity(message);
      for (const input of choices) input.setAttribute('aria-invalid', String(Boolean(message)));
      occupationMessage.textContent = message;
    });
  }

  const api = { validateAge, validateOccupation, validateEligibility, validateApplication, fields, choices, bindControls };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ExomFormRules = api;
  if (typeof document !== 'undefined') bindControls(document);
}());
