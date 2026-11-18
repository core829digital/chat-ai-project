// Comportamenti della dashboard. Tutto funziona anche senza JavaScript: qui ci sono solo miglioramenti.
(function () {
  'use strict';

  // Copia negli appunti
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var value = btn.getAttribute('data-copy');
    var done = function () {
      var original = btn.innerHTML;
      btn.classList.add('is-copied');
      btn.textContent = 'Copiato';
      setTimeout(function () { btn.innerHTML = original; btn.classList.remove('is-copied'); }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done, function () { fallbackCopy(value); done(); });
    } else {
      fallbackCopy(value);
      done();
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* nessuna alternativa */ }
    ta.remove();
  }

  // Conferma per azioni distruttive
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-confirm]');
    if (btn && !window.confirm(btn.getAttribute('data-confirm'))) e.preventDefault();
  });

  // Select che si salvano da sole (stato dei contatti)
  document.querySelectorAll('select[data-autosubmit]').forEach(function (sel) {
    var form = sel.form;
    var btn = form && form.querySelector('.js-hide');
    if (btn) btn.hidden = true;
    sel.addEventListener('change', function () { form.requestSubmit ? form.requestSubmit() : form.submit(); });
  });

  // ---------- Anteprima dal vivo dell'assistente ----------
  function widgetInstance(id) {
    return window.__sportello && typeof window.__sportello[id] === 'object' ? window.__sportello[id] : null;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-preview-reset]');
    if (!btn) return;
    var w = widgetInstance(btn.getAttribute('data-preview-reset'));
    if (w) { w.reset(); w.open(); }
  });

  // Sugli schermi larghi l'anteprima si apre da sola: lo spazio a destra è riservato.
  document.addEventListener('sportello:ready', function (e) {
    if (document.body.classList.contains('has-preview') && window.innerWidth >= 1240) {
      var w = widgetInstance(e.detail.id);
      if (w) w.open();
    }
  });

  var form = document.querySelector('form[data-live-preview]');
  if (!form) return;
  var id = form.getAttribute('data-live-preview');
  var saveState = form.querySelector('[data-save-state]');
  var dirty = false;

  function readSetting(input) {
    var key = input.getAttribute('data-setting');
    if (input.type === 'checkbox') return [key, input.checked];
    if (input.type === 'radio') return input.checked ? [key, input.value] : null;
    if (key === 'quickReplies') {
      return [key, input.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4)];
    }
    return [key, input.value];
  }

  function push(input) {
    var w = widgetInstance(id);
    var pair = readSetting(input);
    if (!w || !pair) return;
    var patch = {};
    patch[pair[0]] = pair[1];
    w.update(patch);
  }

  form.addEventListener('input', function (e) {
    if (e.target.matches('[data-setting]')) push(e.target);
    if (!dirty) {
      dirty = true;
      if (saveState) saveState.textContent = 'Ci sono modifiche non salvate.';
    }
  });
  form.addEventListener('change', function (e) {
    if (e.target.matches('[data-setting]')) push(e.target);
  });

  form.querySelectorAll('[data-swatch]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var input = form.querySelector('input[name="color"]');
      input.value = sw.getAttribute('data-swatch');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  form.addEventListener('submit', function () { dirty = false; });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();
