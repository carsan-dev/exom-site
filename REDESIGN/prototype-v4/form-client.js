'use strict';
(function () {
  const form = document.querySelector('#application-form');
  const steps = [...form.querySelectorAll('.form-step')];
  const labels = [...form.querySelectorAll('.form-progress li')];
  const fieldsets = steps.map(step => step.querySelector('fieldset'));
  const next = form.querySelector('#form-next'), back = form.querySelector('#form-back');
  const message = form.querySelector('#form-message'), note = form.querySelector('.demo-note');
  const stepFields = [['name', 'age', 'country', 'phone', 'occupation'], ['goal', 'food', 'expectations'], ['obstacles', 'condition', 'start']];
  let step = 0, session = null, busy = false, complete = false, uncertain = false, needsContact = false;
  const controls = key => [...form.querySelectorAll(`[name="${key}"]`)];
  function answers() {
    return Object.fromEntries(window.ExomFormRules.fields.map(key => [key,
      ['occupation', 'obstacles'].includes(key) ? controls(key).filter(el => el.checked).map(el => el.value)
        : controls(key).find(el => el.type !== 'radio' || el.checked)?.value || ''
    ]));
  }
  function showStep(focus = true) {
    steps.forEach((el, index) => { el.hidden = index !== step; });
    labels.forEach((el, index) => index === step ? el.setAttribute('aria-current', 'step') : el.removeAttribute('aria-current'));
    back.hidden = step === 0;
    next.textContent = step === 2 ? (session?.simulated ? 'Probar solicitud' : 'Enviar solicitud') : 'Continuar →';
    form.querySelector('#step-count').textContent = `Paso ${step + 1} de 3 · Todos los campos son obligatorios`;
    if (focus) {
      steps[step].querySelector('h3').focus({ preventScroll: true });
      if (form.getBoundingClientRect().top < 80) form.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function showErrors(errors, keys) {
    let first;
    for (const key of keys) {
      const group = controls(key), error = errors[key] || '';
      group[0].setCustomValidity(error);
      group.forEach(el => el.setAttribute('aria-invalid', String(Boolean(error))));
      if (error && !first) first = group[0];
    }
    if (first) {
      message.textContent = first.validationMessage;
      first.reportValidity();
      return false;
    }
    return true;
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    next.disabled = value || complete || needsContact;
    back.disabled = value || complete || needsContact;
    fieldsets.forEach(el => { el.disabled = value || complete || needsContact || !session; });
  }
  async function loadSession() {
    setBusy(true);
    try {
      const response = await fetch(form.action, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(12000) });
      const result = await response.json();
      if (!response.ok || typeof result.token !== 'string' || typeof result.version !== 'string' || typeof result.simulated !== 'boolean') throw Error('Unavailable');
      session = result;
      note.textContent = session.simulated ? 'Prueba local: utiliza datos ficticios. Se validan temporalmente en este ordenador; no se envían correos ni se guardan respuestas.' : 'Solicitud gratuita, sin compra ni cobro. No incluyas información médica.';
      showStep(false);
    } catch {
      message.textContent = 'No se pudo abrir el formulario. Pulsa Reintentar para volver a conectar.';
      next.textContent = 'Reintentar';
    } finally { setBusy(false); }
  }
  form.addEventListener('input', event => {
    const key = event.target.name;
    if (!window.ExomFormRules.fields.includes(key)) return;
    controls(key).forEach(el => { el.setCustomValidity(''); el.removeAttribute('aria-invalid'); });
    message.textContent = '';
  });
  back.addEventListener('click', () => {
    if (busy || complete || needsContact) return;
    step = Math.max(0, step - 1); message.textContent = ''; showStep();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || complete || needsContact) return;
    if (!session) { await loadSession(); return; }
    const input = answers(), { errors } = window.ExomFormRules.validateApplication(input);
    if (!showErrors(errors, stepFields[step])) return;
    if (step < 2) { step++; message.textContent = ''; showStep(); return; }
    const invalidStep = stepFields.findIndex(keys => keys.some(key => errors[key]));
    if (invalidStep !== -1) { step = invalidStep; showStep(); showErrors(errors, stepFields[step]); return; }
    setBusy(true); next.textContent = session.simulated ? 'Comprobando…' : 'Enviando…';
    message.textContent = '';
    try {
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token, version: session.version, website: form.elements.website.value, answers: input })
      });
      const result = await response.json();
      if (response.ok && result.ok === true && typeof result.simulated === 'boolean') {
        complete = true;
        form.reset();
        message.textContent = result.simulated ? 'Prueba completada. No se ha enviado ningún correo ni guardado tus respuestas.' : 'Solicitud enviada. La revisaré y contactaré contigo por WhatsApp.';
      } else if (result.code === 'expired') {
        if (uncertain) {
          needsContact = true;
          message.textContent = 'La sesión ha caducado tras un intento sin confirmar. Para evitar duplicados, contacta con EXOM antes de enviar otra solicitud.';
        } else {
          session = null; await loadSession();
          message.textContent = 'La sesión había caducado. Tus respuestas siguen aquí; vuelve a pulsar el botón para intentarlo.';
        }
      } else {
        if (response.status >= 500 || response.ok) uncertain = true;
        if (response.status === 409) needsContact = true;
        message.textContent = typeof result.error === 'string' ? result.error : 'No se pudo confirmar el envío. Reintenta sin cambiar las respuestas.';
        if (result.errors) {
          const index = stepFields.findIndex(keys => keys.some(key => result.errors[key]));
          if (index !== -1) { step = index; showStep(); showErrors(result.errors, stepFields[step]); }
        }
      }
    } catch {
      uncertain = true;
      message.textContent = 'No se pudo confirmar el envío. Comprueba tu conexión y reintenta sin cambiar las respuestas. No recargues la página.';
    } finally {
      setBusy(false);
      if (complete) next.textContent = session.simulated ? 'Prueba completada' : 'Solicitud enviada';
      else if (needsContact) next.textContent = 'Contacta con EXOM';
      else if (session) showStep(false);
    }
  });
  void loadSession();
}());
