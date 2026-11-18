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

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Notifiche: chiudibili, quelle positive spariscono da sole ----------
  document.querySelectorAll('.main > .flash').forEach(function (toast) {
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'flash-close';
    close.setAttribute('aria-label', 'Chiudi la notifica');
    close.textContent = '×';
    toast.appendChild(close);
    var dismiss = function () {
      if (toast.classList.contains('is-leaving')) return;
      toast.classList.add('is-leaving');
      setTimeout(function () { toast.remove(); }, reduceMotion ? 0 : 300);
    };
    close.addEventListener('click', dismiss);
    if (toast.classList.contains('flash-ok')) {
      var timer = document.createElement('span');
      timer.className = 'flash-timer';
      timer.setAttribute('aria-hidden', 'true');
      toast.appendChild(timer);
      var t = setTimeout(dismiss, 5000);
      // Se il mouse è sopra, la notifica aspetta: si legge con calma.
      toast.addEventListener('mouseenter', function () { clearTimeout(t); timer.style.animationPlayState = 'paused'; });
      toast.addEventListener('mouseleave', function () { t = setTimeout(dismiss, 1500); });
    }
  });

  // ---------- Numeri delle statistiche che contano fino al valore ----------
  if (!reduceMotion) {
    document.querySelectorAll('.stat-value').forEach(function (el) {
      var text = el.textContent.trim();
      var m = /^([^\d]*)([\d.]+)([^\d]*)$/.exec(text);
      if (!m) return; // es. "—" o testi composti: restano come sono
      var target = Number(m[2].replace(/\./g, ''));
      if (!target || target > 1e7) return;
      var start = null;
      var format = function (n) { return m[1] + n.toLocaleString('it-IT') + m[3]; };
      el.textContent = format(0);
      requestAnimationFrame(function frame(t) {
        if (start === null) start = t;
        var p = Math.min(1, (t - start) / 900);
        el.textContent = format(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(frame);
      });
    });
  }

  // ---------- Anteprima dal vivo dell'assistente ----------
  function widgetInstance(id) {
    return window.__aperto && typeof window.__aperto[id] === 'object' ? window.__aperto[id] : null;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-preview-reset]');
    if (!btn) return;
    var w = widgetInstance(btn.getAttribute('data-preview-reset'));
    if (w) { w.reset(); w.open(); }
  });

  // Sugli schermi larghi l'anteprima si apre da sola: lo spazio a destra è riservato.
  document.addEventListener('aperto:ready', function (e) {
    if (document.body.classList.contains('has-preview') && window.innerWidth >= 1240) {
      var w = widgetInstance(e.detail.id);
      if (w) w.open();
    }
  });

  var form = document.querySelector('form[data-live-preview]');
  if (!form) return;
  var id = form.getAttribute('data-live-preview');
  var saveState = form.querySelector('[data-save-state]');
  var saveBar = form.querySelector('.save-bar');
  var dirty = false;

  // Il campione di colore corrispondente al colore scelto resta evidenziato.
  function markSwatch() {
    var value = (form.querySelector('input[name="color"]') || {}).value || '';
    form.querySelectorAll('[data-swatch]').forEach(function (sw) {
      sw.classList.toggle('is-selected', sw.getAttribute('data-swatch').toLowerCase() === value.toLowerCase());
    });
  }
  markSwatch();

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
    if (e.target.name === 'color') markSwatch();
    if (!dirty) {
      dirty = true;
      if (saveState) saveState.textContent = 'Ci sono modifiche non salvate.';
      if (saveBar) saveBar.classList.add('is-dirty');
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
