(function () {
  'use strict';

  // Prezzi mensili / annuali
  var toggle = document.querySelectorAll('[data-billing]');
  toggle.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-billing');
      toggle.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      document.querySelectorAll('.price-n').forEach(function (el) {
        el.textContent = el.getAttribute('data-' + mode);
      });
      document.querySelectorAll('.price-note').forEach(function (el) {
        el.textContent = el.getAttribute('data-' + mode + '-note');
      });
    });
  });

  // Copia del codice di esempio
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var value = btn.getAttribute('data-copy');
    var label = btn.innerHTML;
    var done = function () {
      btn.textContent = 'Copiato';
      setTimeout(function () { btn.innerHTML = label; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value).then(done, done);
    else done();
  });

  // Pulsante "prova la demo": apre l'assistente vero presente nella pagina
  document.querySelectorAll('[data-open-demo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.Sportello) window.Sportello.open();
    });
  });

  // Chiude il menu mobile quando si sceglie una voce
  var mobile = document.querySelector('.mobile-nav');
  if (mobile) {
    mobile.addEventListener('click', function (e) {
      if (e.target.closest('a')) mobile.removeAttribute('open');
    });
  }
})();
