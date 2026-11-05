(function () {
  'use strict';
  const navigation = document.querySelector('#navigation');
  const button = document.querySelector('#menu-toggle');
  function closeMenu() {
    navigation.dataset.open = 'false';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Abrir menú');
  }
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    navigation.dataset.open = String(open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.dataset.open === 'true') {
      closeMenu();
      button.focus();
    }
  });
})();
