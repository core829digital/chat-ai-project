// Sito pubblico: animazioni e interazioni. Senza JavaScript la pagina resta completa e leggibile.
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // ---------- Comparsa degli elementi durante lo scroll ----------
  var revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        revealObserver.unobserve(el);
        // Finita la comparsa, il ritardo a scalare non deve rallentare gli effetti al passaggio del mouse.
        setTimeout(function () { el.classList.add('is-done'); }, 1400);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ---------- Testata compatta dopo lo scroll ----------
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------- Numeri che contano fino al valore ----------
  function tween(el, from, to, duration) {
    if (reduceMotion || from === to) { el.textContent = to; return; }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        tween(el, 0, Number(el.getAttribute('data-count')), 1100);
        countObserver.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  // ---------- Prezzi mensili / annuali ----------
  var toggle = document.querySelectorAll('[data-billing]');
  var toggleGroup = document.querySelector('.billing-toggle');
  function placeThumb() {
    var active = document.querySelector('[data-billing].is-active');
    var thumb = document.querySelector('.billing-thumb');
    if (!active || !thumb) return;
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
  }
  if (toggleGroup) {
    toggleGroup.classList.add('has-thumb');
    placeThumb();
    window.addEventListener('resize', placeThumb);
  }
  toggle.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-billing');
      toggle.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      placeThumb();
      document.querySelectorAll('.price-n').forEach(function (el) {
        tween(el, Number(el.textContent), Number(el.getAttribute('data-' + mode)), 420);
      });
      document.querySelectorAll('.price-note').forEach(function (el) {
        el.textContent = el.getAttribute('data-' + mode + '-note');
      });
    });
  });

  // ---------- Copia del codice di esempio ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var label = btn.querySelector('span');
    var done = function () {
      btn.classList.add('is-copied');
      if (label) label.textContent = 'Copiato';
      setTimeout(function () {
        btn.classList.remove('is-copied');
        if (label) label.textContent = 'Copia';
      }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(done, done);
    else done();
  });

  // ---------- Pulsante "fagli una domanda": apre l'assistente vero presente nella pagina ----------
  document.querySelectorAll('[data-open-demo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var api = window.Aperto;
      if (api) api.open();
    });
  });

  // ---------- Menu mobile ----------
  var mobile = document.querySelector('.mobile-nav');
  if (mobile) {
    mobile.addEventListener('click', function (e) {
      if (e.target.closest('a')) mobile.removeAttribute('open');
    });
  }

  // ---------- Pulsanti: onda che parte dal punto del clic ----------
  if (!reduceMotion) {
    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest && e.target.closest('.btn, .demo-tab, .billing-toggle button');
      if (!btn || e.button > 0) return;
      var r = btn.getBoundingClientRect();
      var dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.setProperty('--rx', (e.clientX - r.left) + 'px');
      dot.style.setProperty('--ry', (e.clientY - r.top) + 'px');
      dot.style.setProperty('--rs', String(Math.ceil(Math.hypot(r.width, r.height) / 6)));
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
      btn.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 750);
    });
  }

  // ---------- Moduli: invio con rotellina e senza doppio invio; password visibile a richiesta ----------
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (form.dataset.sending) { e.preventDefault(); return; }
      form.dataset.sending = '1';
      var btn = e.submitter || form.querySelector('[type="submit"]');
      if (btn && btn.classList.contains('btn')) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }
      // se il browser torna indietro sulla pagina (cache), il modulo deve essere di nuovo utilizzabile
      window.addEventListener('pageshow', function () { delete form.dataset.sending; if (btn) btn.classList.remove('is-loading'); }, { once: true });
    });
  });
  var EYE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>';
  document.querySelectorAll('.auth-card input[type="password"]').forEach(function (input) {
    var wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var t = document.createElement('button');
    t.type = 'button';
    t.className = 'pw-toggle';
    t.setAttribute('aria-label', 'Mostra la password');
    t.setAttribute('aria-pressed', 'false');
    t.innerHTML = EYE;
    t.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(show));
      t.setAttribute('aria-label', show ? 'Nascondi la password' : 'Mostra la password');
      input.focus();
    });
    wrap.appendChild(t);
  });

  // ---------- Prezzi: le cifre si rimettono a fuoco quando cambiano ----------
  document.querySelectorAll('[data-billing]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.price-n').forEach(function (el) {
        el.classList.remove('is-changing');
        void el.offsetWidth;
        el.classList.add('is-changing');
      });
    });
  });

  // ---------- Demo animata dell'hero ----------
  var stage = document.querySelector('.hero-stage');
  if (!stage) return;
  var log = stage.querySelector('[data-demo-log]');
  var chat = stage.querySelector('[data-demo-chat]');
  var notify = stage.querySelector('[data-demo-notify]');
  var tabs = stage.querySelectorAll('[data-demo-tab]');
  var scripts = {};
  stage.querySelectorAll('.demo-script').forEach(function (ol) { scripts[ol.getAttribute('data-demo')] = ol; });
  var order = Array.prototype.map.call(tabs, function (t) { return t.getAttribute('data-demo-tab'); });

  var timers = [];
  var autoplay = !reduceMotion;
  var visible = true;
  var current = order[0];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }

  function setText(sel, value) {
    var el = stage.querySelector(sel);
    if (el) el.textContent = value;
  }

  function bubble(who, text) {
    var p = document.createElement('p');
    p.className = 'm-' + who + ' is-new';
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function typing() {
    var t = document.createElement('p');
    t.className = 'm-typing is-new';
    t.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    return t;
  }

  function play(id, instant) {
    clear();
    current = id;
    var ol = scripts[id];
    if (!ol) return;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-demo-tab') === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.classList.toggle('is-playing', on && autoplay && !instant);
    });
    setText('[data-demo-site]', ol.getAttribute('data-site'));
    setText('[data-demo-name]', ol.getAttribute('data-name'));
    setText('[data-demo-title]', ol.getAttribute('data-name'));
    setText('[data-demo-initials]', ol.getAttribute('data-initials'));
    setText('[data-demo-notify-title]', ol.getAttribute('data-notify-title'));
    setText('[data-demo-notify-text]', ol.getAttribute('data-notify-text'));
    chat.style.setProperty('--c', ol.getAttribute('data-color'));
    notify.classList.remove('is-shown');
    log.textContent = '';

    var lines = ol.querySelectorAll('li');
    if (instant) {
      lines.forEach(function (li) { bubble(li.getAttribute('data-who'), li.textContent).classList.remove('is-new'); });
      notify.classList.add('is-shown');
      return;
    }
    var t = 350;
    lines.forEach(function (li) {
      var who = li.getAttribute('data-who');
      var text = li.textContent;
      if (who === 'bot') {
        var dots;
        later(function () { dots = typing(); }, t);
        t += 1100;
        later(function () { if (dots) dots.remove(); bubble('bot', text); }, t);
        t += 1500;
      } else {
        later(function () { bubble('visitor', text); }, t);
        t += 900;
      }
    });
    later(function () { notify.classList.add('is-shown'); }, t);
    if (autoplay) {
      later(function () {
        if (!visible) return;
        var next = order[(order.indexOf(current) + 1) % order.length];
        play(next);
      }, t + 3200);
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      autoplay = false; // chi sceglie un settore vuole leggerlo con calma
      play(tab.getAttribute('data-demo-tab'), reduceMotion);
    });
  });

  // Tastiera: frecce sinistra/destra tra le schede, come da pattern ARIA tablist
  stage.querySelector('.demo-tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = order.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
    var next = tabs[(i + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });

  // La demo parte quando è visibile e si ferma quando esce dallo schermo.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var wasVisible = visible;
      visible = entries[0].isIntersecting;
      if (visible && !wasVisible && autoplay) play(current);
      if (!visible) clear();
    }, { threshold: 0.25 }).observe(stage);
  }
  play(current, reduceMotion);
})();
