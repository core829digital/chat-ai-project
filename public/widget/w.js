/*!
 * Aperto — widget assistente per siti web.
 * Installazione: <script src="https://DOMINIO/w.js" data-id="wdg_xxx" async></script>
 * Nessuna dipendenza, isolato in Shadow DOM: non eredita né modifica gli stili del sito ospite.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll('script[data-id][src*="w.js"]');
    script = candidates[candidates.length - 1];
  }
  if (!script) return;

  var WIDGET_ID = script.getAttribute('data-id');
  if (!WIDGET_ID) return;
  var BASE = new URL(script.src, location.href).origin;
  var MODE = script.getAttribute('data-mode') === 'page' ? 'page' : 'bubble';
  var PREVIEW = script.hasAttribute('data-preview');
  var OPEN_ON_LOAD = script.hasAttribute('data-open');

  window.__aperto = window.__aperto || {};
  if (window.__aperto[WIDGET_ID]) return;
  window.__aperto[WIDGET_ID] = true;

  // ---------- Archiviazione locale (può non essere disponibile: navigazione privata, blocchi) ----------
  function store(kind) {
    try {
      var s = window[kind];
      var k = '__sp_test';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }
  var local = store('localStorage');
  var session = store('sessionStorage');
  function get(s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(s, k, v) { try { if (s) s.setItem(k, v); } catch (e) { /* pieno o bloccato */ } }

  var KEY = 'aperto:' + WIDGET_ID + (PREVIEW ? ':preview' : '');
  var visitorId = get(local, 'aperto:visitor');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    set(local, 'aperto:visitor', visitorId);
  }

  var state = {
    settings: null,
    brand: null,
    open: false,
    busy: false,
    conversationId: get(session, KEY + ':conv'),
    history: [],
    leadDone: get(session, KEY + ':lead') === '1',
  };
  try {
    state.history = JSON.parse(get(session, KEY + ':history') || '[]');
  } catch (e) {
    state.history = [];
  }

  function saveHistory() {
    set(session, KEY + ':history', JSON.stringify(state.history.slice(-40)));
    if (state.conversationId) set(session, KEY + ':conv', state.conversationId);
  }

  // ---------- Utilità ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function svg(path, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 22);
    s.setAttribute('height', size || 22);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  var ICON_CHAT = 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z';
  var ICON_CLOSE = 'M6 6l12 12M18 6L6 18';
  var ICON_SEND = 'M4 12l16-8-6 16-2.5-6.5z';
  var ICON_DOWN = 'M6 9l6 6 6-6';

  // Testo con link cliccabili, senza mai interpretare HTML.
  function richText(text) {
    var frag = document.createDocumentFragment();
    var re = /(https?:\/\/[^\s<>"')\]]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var value = m[0].replace(/[.,;:!?]+$/, '');
      var isMail = value.indexOf('@') > 0 && value.indexOf('http') !== 0;
      frag.appendChild(el('a', {
        href: isMail ? 'mailto:' + value : value,
        target: isMail ? null : '_blank',
        rel: 'noopener noreferrer nofollow',
        text: value,
      }));
      last = m.index + value.length;
      re.lastIndex = last;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function readableOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    var n = parseInt(m[1], 16);
    var ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return lum > 0.45 ? '#16181a' : '#ffffff';
  }

  function api(path, body) {
    var opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }
      : { method: 'GET' };
    opts.credentials = PREVIEW ? 'same-origin' : 'omit';
    return fetch(BASE + '/api/widget/' + encodeURIComponent(WIDGET_ID) + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || 'Errore ' + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  // ---------- Stili (isolati nello Shadow DOM) ----------
  var CSS = [
    ':host{all:initial}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.sp{--c:#1F5C4A;--on:#fff;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1b1c1a;-webkit-font-smoothing:antialiased}',
    '.launcher-wrap{position:fixed;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px}',
    '.right .launcher-wrap{right:20px;flex-direction:row}',
    '.left .launcher-wrap{left:20px;flex-direction:row-reverse}',
    '.launcher{width:58px;height:58px;border-radius:50%;border:0;background:var(--c);color:var(--on);cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 20px rgba(20,24,22,.22),0 1px 3px rgba(20,24,22,.2);transition:transform .3s cubic-bezier(.34,1.4,.64,1),box-shadow .3s ease;animation:sp-pop .6s cubic-bezier(.34,1.56,.64,1) both .15s}',
    '.launcher:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 10px 26px rgba(20,24,22,.26),0 1px 3px rgba(20,24,22,.2)}',
    '.launcher:active{transform:scale(.95)}',
    '.launcher svg{animation:sp-icon .4s cubic-bezier(.16,1,.3,1)}',
    '.launcher:focus-visible,.btn:focus-visible,.chip:focus-visible,.icon-btn:focus-visible,.send:focus-visible{outline:3px solid #2563eb;outline-offset:2px}',
    '.label{background:#fff;color:#1b1c1a;border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:9px 14px;font-size:14px;box-shadow:0 4px 14px rgba(20,24,22,.12);cursor:pointer;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;animation:sp-label .7s cubic-bezier(.16,1,.3,1) both 1.4s;transition:transform .25s ease}',
    '.label:hover{transform:translateY(-1px)}',
    '.panel{position:fixed;bottom:92px;z-index:2147483001;width:380px;height:min(620px,calc(100vh - 116px));background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(20,24,22,.22),0 2px 6px rgba(20,24,22,.08);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(18px) scale(.94);transform-origin:bottom right;pointer-events:none;visibility:hidden;transition:opacity .18s ease,transform .28s cubic-bezier(.4,0,1,1),visibility 0s linear .28s}',
    '.right .panel{right:20px}.left .panel{left:20px;transform-origin:bottom left}',
    // Apertura: il pannello "cresce" dal pulsante con un leggero rimbalzo; chiusura più rapida.
    '.open .panel{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity .22s ease,transform .5s cubic-bezier(.34,1.3,.64,1)}',
    '.page .panel{position:static;width:100%;height:100%;border-radius:0;box-shadow:none;opacity:1;transform:none;pointer-events:auto;visibility:visible}',
    '.head{background:var(--c);color:var(--on);padding:14px 14px 14px 16px;display:flex;align-items:center;gap:12px;flex:none}',
    '.avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);display:grid;place-items:center;font-weight:600;font-size:14px;letter-spacing:.02em;flex:none}',
    '.titles{flex:1;min-width:0}',
    '.title{font-weight:600;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.subtitle{font-size:12.5px;opacity:.85;display:flex;align-items:center;gap:6px}',
    '.dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 2px rgba(255,255,255,.25)}',
    '.icon-btn{background:transparent;border:0;color:inherit;width:36px;height:36px;border-radius:8px;display:grid;place-items:center;cursor:pointer;flex:none}',
    '.icon-btn:hover{background:rgba(255,255,255,.14)}',
    '.notice{font-size:12px;color:#5b5f5a;background:#f6f5f1;border-bottom:1px solid #ecebe6;padding:7px 16px;flex:none}',
    '.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fbfbf9;overscroll-behavior:contain}',
    '.msg{max-width:84%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;animation:sp-msg .4s cubic-bezier(.16,1,.3,1) both}',
    '.msg.bot{transform-origin:bottom left}.msg.visitor{transform-origin:bottom right}',
    '.msg a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.bot{align-self:flex-start;background:#fff;border:1px solid #e8e6e0;border-bottom-left-radius:4px}',
    '.visitor{align-self:flex-end;background:var(--c);color:var(--on);border-bottom-right-radius:4px}',
    '.error{align-self:center;font-size:13px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px}',
    '.typing{align-self:flex-start;background:#fff;border:1px solid #e8e6e0;border-radius:14px;padding:12px 14px;display:flex;gap:4px;animation:sp-msg .3s cubic-bezier(.16,1,.3,1) both}',
    '.typing i{width:6px;height:6px;border-radius:50%;background:#9a9d97;animation:b 1s infinite ease-in-out}',
    '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes b{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}',
    '.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#fbfbf9;flex:none}',
    '.chip{font:inherit;font-size:13px;border:1px solid var(--c);color:var(--c);background:#fff;border-radius:999px;padding:6px 11px;cursor:pointer;text-align:left;transition:background .2s,color .2s,transform .2s;animation:sp-msg .4s cubic-bezier(.16,1,.3,1) both .25s}',
    '.chip:nth-child(2){animation-delay:.32s}.chip:nth-child(3){animation-delay:.39s}.chip:nth-child(4){animation-delay:.46s}',
    '.chip:active{transform:scale(.96)}',
    '.send{transition:opacity .2s,transform .2s}.send:not(:disabled):hover{transform:scale(1.06)}.send:not(:disabled):active{transform:scale(.94)}',
    '@keyframes sp-pop{from{opacity:0;transform:scale(.5)}}',
    '@keyframes sp-icon{from{opacity:0;transform:rotate(-90deg) scale(.6)}}',
    '@keyframes sp-label{from{opacity:0;transform:translateX(12px)}}',
    '.left .label{animation-name:sp-label-l}@keyframes sp-label-l{from{opacity:0;transform:translateX(-12px)}}',
    '@keyframes sp-msg{from{opacity:0;transform:translateY(8px) scale(.97)}}',
    '.chip:hover{background:var(--c);color:var(--on)}',
    '.composer{display:flex;align-items:flex-end;gap:8px;padding:10px 10px 10px 14px;border-top:1px solid #ecebe6;background:#fff;flex:none}',
    'textarea{flex:1;font:inherit;resize:none;border:0;outline:0;max-height:110px;min-height:24px;padding:8px 0;color:#1b1c1a;background:transparent}',
    'textarea::placeholder{color:#8a8d87}',
    '.send{width:40px;height:40px;border-radius:10px;border:0;background:var(--c);color:var(--on);display:grid;place-items:center;cursor:pointer;flex:none}',
    '.send:disabled{opacity:.4;cursor:default}',
    '.foot{font-size:11.5px;text-align:center;padding:0 0 9px;background:#fff;color:#8a8d87;flex:none}',
    '.foot a{color:inherit}',
    '.lead{align-self:stretch;background:#fff;border:1px solid #e8e6e0;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;animation:sp-msg .45s cubic-bezier(.16,1,.3,1) both}',
    '.lead p{margin:0;font-weight:600;font-size:14px}',
    '.field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#43463f}',
    '.field input{font:inherit;font-size:14px;border:1px solid #d6d4cd;border-radius:9px;padding:9px 11px;color:#1b1c1a;background:#fff}',
    '.field input:focus{outline:2px solid var(--c);outline-offset:0;border-color:transparent}',
    '.field input[aria-invalid="true"]{border-color:#c2410c}',
    '.ferr{color:#c2410c;font-size:12px}',
    '.consent{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#43463f}',
    '.consent input{margin-top:3px;accent-color:var(--c)}',
    '.consent a{color:inherit}',
    '.btn{font:inherit;font-weight:600;border:0;border-radius:10px;padding:11px 14px;background:var(--c);color:var(--on);cursor:pointer}',
    '.btn:disabled{opacity:.6}',
    // Schermi piccoli: classe calcolata in JS (funziona anche sui siti vecchi senza meta viewport).
    '.mobile:not(.page) .panel{right:auto;left:0;top:0;bottom:auto;width:var(--vw,100vw);height:var(--vh,100vh);max-height:none;border-radius:0}',
    '.mobile.open .launcher-wrap{display:none}',
    '.mobile textarea{font-size:16px}',
    '@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}',
  ].join('\n');

  // ---------- Costruzione dell'interfaccia ----------
  var host = el('div', { id: 'aperto-' + WIDGET_ID, 'data-aperto': '' });
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var styleEl = el('style', { text: CSS });
  var wrap = el('div', { class: 'sp ' + (MODE === 'page' ? 'page' : 'right') });
  var ui = {};

  function build() {
    var s = state.settings;
    ui.avatar = el('div', { class: 'avatar', 'aria-hidden': 'true' });
    ui.title = el('div', { class: 'title' });
    ui.subtitle = el('span');
    ui.close = el('button', {
      class: 'icon-btn', type: 'button', 'aria-label': 'Chiudi la chat', onclick: function () { setOpen(false); },
    }, [svg(MODE === 'page' ? ICON_CLOSE : ICON_DOWN, 20)]);
    var head = el('div', { class: 'head' }, [
      ui.avatar,
      el('div', { class: 'titles' }, [ui.title, el('div', { class: 'subtitle' }, [el('span', { class: 'dot' }), ui.subtitle])]),
      MODE === 'page' ? null : ui.close,
    ]);
    // Trasparenza obbligatoria (AI Act, art. 50): sempre visibile, non disattivabile.
    var notice = el('div', { class: 'notice', text: 'Stai parlando con un assistente virtuale: le risposte sono automatiche.' });
    ui.log = el('div', { class: 'log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0' });
    ui.chips = el('div', { class: 'chips' });
    ui.input = el('textarea', {
      rows: '1', placeholder: 'Scrivi un messaggio…', 'aria-label': 'Scrivi un messaggio', maxlength: '1000',
    });
    ui.send = el('button', { class: 'send', type: 'submit', 'aria-label': 'Invia', disabled: true }, [svg(ICON_SEND, 20)]);
    var composer = el('form', { class: 'composer', onsubmit: onSubmit }, [ui.input, ui.send]);
    ui.foot = el('div', { class: 'foot' });
    ui.panel = el('div', {
      class: 'panel', role: MODE === 'page' ? 'main' : 'dialog', 'aria-label': s.title || 'Assistente', 'aria-modal': 'false',
    }, [head, notice, ui.log, ui.chips, composer, ui.foot]);

    if (MODE !== 'page') {
      ui.launcher = el('button', {
        class: 'launcher', type: 'button', 'aria-label': 'Apri la chat', 'aria-expanded': 'false', onclick: function () { setOpen(!state.open); },
      }, [svg(ICON_CHAT, 26)]);
      ui.label = el('button', { class: 'label', type: 'button', onclick: function () { setOpen(true); } });
      ui.label.style.display = 'none';
      wrap.appendChild(el('div', { class: 'launcher-wrap' }, [ui.label, ui.launcher]));
    }
    wrap.appendChild(ui.panel);
    root.appendChild(styleEl);
    root.appendChild(wrap);
    (MODE === 'page' ? script.parentNode : document.body).appendChild(host);
    if (MODE === 'page') host.style.cssText = 'display:block;height:100%';

    ui.input.addEventListener('input', function () {
      ui.send.disabled = !ui.input.value.trim() || state.busy;
      ui.input.style.height = 'auto';
      ui.input.style.height = Math.min(ui.input.scrollHeight, 110) + 'px';
    });
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        onSubmit(e);
      }
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open && MODE !== 'page') setOpen(false);
    });

    applySettings();
    renderHistory();
    adaptToScreen();
    window.addEventListener('resize', adaptToScreen);
    window.addEventListener('orientationchange', adaptToScreen);
  }

  // I siti vecchi senza <meta name="viewport"> vengono mostrati sui telefoni a ~980px e rimpiccioliti:
  // il widget si ingrandisce di conseguenza per restare leggibile e occupare tutto lo schermo.
  function adaptToScreen() {
    if (MODE === 'page') return;
    var screenW = Math.min(window.screen && screen.width ? screen.width : window.innerWidth, window.innerWidth * 4);
    var layoutW = window.innerWidth;
    var small = Math.min(screenW, layoutW) <= 520;
    var zoom = small && layoutW > screenW * 1.15 ? layoutW / screenW : 1;
    wrap.classList.toggle('mobile', small);
    wrap.style.zoom = zoom === 1 ? '' : String(zoom);
    if (small) {
      wrap.style.setProperty('--vw', layoutW / zoom + 'px');
      wrap.style.setProperty('--vh', window.innerHeight / zoom + 'px');
    }
  }

  function applySettings() {
    var s = state.settings;
    wrap.style.setProperty('--c', s.color || '#1F5C4A');
    wrap.style.setProperty('--on', readableOn(s.color));
    if (MODE !== 'page') {
      wrap.classList.toggle('left', s.position === 'left');
      wrap.classList.toggle('right', s.position !== 'left');
    }
    ui.avatar.textContent = (s.avatarText || '').slice(0, 2);
    ui.title.textContent = s.title || 'Assistente';
    ui.subtitle.textContent = s.subtitle || '';
    ui.panel.setAttribute('aria-label', s.title || 'Assistente');
    if (ui.label) {
      ui.label.textContent = s.launcherLabel || '';
      var dismissed = get(session, KEY + ':label') === '0';
      ui.label.style.display = s.launcherLabel && !state.open && !dismissed ? '' : 'none';
    }
    ui.foot.textContent = '';
    if (s.showBranding && state.brand) {
      ui.foot.appendChild(document.createTextNode('Assistente realizzato con '));
      ui.foot.appendChild(el('a', { href: state.brand.url, target: '_blank', rel: 'noopener', text: state.brand.name }));
    }
    ui.foot.style.display = s.showBranding ? '' : 'none';
    renderChips(state.history.length <= 1 ? s.quickReplies : []);
  }

  function renderHistory() {
    ui.log.textContent = '';
    if (!state.history.length) addMessage('bot', state.settings.welcomeMessage, true);
    else state.history.forEach(function (m) { appendBubble(m.role, m.text); });
    renderChips(state.history.length <= 1 ? state.settings.quickReplies : []);
  }

  function appendBubble(role, text) {
    var b = el('div', { class: 'msg ' + role });
    b.appendChild(richText(String(text || '')));
    ui.log.appendChild(b);
    scrollDown();
    return b;
  }

  function addMessage(role, text, silent) {
    state.history.push({ role: role, text: text });
    if (!silent || state.history.length) saveHistory();
    return appendBubble(role, text);
  }

  function scrollDown() {
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  function renderChips(list) {
    ui.chips.textContent = '';
    (list || []).slice(0, 4).forEach(function (q) {
      ui.chips.appendChild(el('button', { class: 'chip', type: 'button', text: q, onclick: function () { send(q); } }));
    });
    ui.chips.style.display = ui.chips.childNodes.length ? '' : 'none';
  }

  function setBusy(b) {
    state.busy = b;
    ui.send.disabled = b || !ui.input.value.trim();
  }

  function showTyping() {
    var t = el('div', { class: 'typing', 'aria-label': 'Sta scrivendo' }, [el('i'), el('i'), el('i')]);
    ui.log.appendChild(t);
    scrollDown();
    return t;
  }

  function onSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    var text = ui.input.value.trim();
    if (!text || state.busy) return;
    ui.input.value = '';
    ui.input.style.height = 'auto';
    send(text);
  }

  function send(text) {
    if (state.busy) return;
    renderChips([]);
    addMessage('visitor', text);
    setBusy(true);
    var typing = showTyping();
    var started = Date.now();
    api('/messages', {
      conversationId: state.conversationId,
      visitorId: visitorId,
      text: text,
      pageUrl: location.href.slice(0, 500),
      preview: PREVIEW || undefined,
    }).then(function (data) {
      // Piccola pausa: una risposta istantanea sembra meno naturale e viene letta peggio.
      var wait = Math.max(0, 450 - (Date.now() - started));
      setTimeout(function () {
        typing.remove();
        state.conversationId = data.conversationId;
        addMessage('bot', data.reply.text);
        if (data.action === 'lead_form' && !state.leadDone) showLeadForm();
        else if (data.suggestions && data.suggestions.length) renderChips(data.suggestions);
        setBusy(false);
        ui.input.focus();
      }, wait);
    }).catch(function (err) {
      typing.remove();
      appendBubble('error', err.status === 429 ? err.message : 'Messaggio non inviato. Controlla la connessione e riprova.');
      setBusy(false);
    });
  }

  function field(label, name, type, autocomplete, required) {
    var id = 'sp-' + name + '-' + Math.random().toString(36).slice(2, 7);
    var input = el('input', { id: id, name: name, type: type, autocomplete: autocomplete, required: required || null });
    var err = el('span', { class: 'ferr', id: id + '-err', 'aria-live': 'polite' });
    input.setAttribute('aria-describedby', id + '-err');
    return { input: input, err: err, node: el('label', { class: 'field', for: id }, [label, input, err]) };
  }

  function showLeadForm() {
    if (ui.log.querySelector('.lead')) return;
    var s = state.settings;
    var name = field('Nome', 'name', 'text', 'name', true);
    var email = field('Email', 'email', 'email', 'email');
    var phone = s.askPhone ? field('Telefono', 'phone', 'tel', 'tel') : null;
    var consentId = 'sp-consent-' + Math.random().toString(36).slice(2, 7);
    var consent = el('input', { type: 'checkbox', id: consentId });
    var consentErr = el('span', { class: 'ferr', 'aria-live': 'polite' });
    var consentLabel = el('label', { class: 'consent', for: consentId }, [
      consent,
      el('span', null, [
        'Acconsento a essere ricontattato per questa richiesta' + (s.privacyUrl ? ' (' : '.'),
        s.privacyUrl ? el('a', { href: s.privacyUrl, target: '_blank', rel: 'noopener', text: 'informativa privacy' }) : null,
        s.privacyUrl ? ').' : null,
      ]),
    ]);
    var submit = el('button', { class: 'btn', type: 'submit', text: 'Invia i miei recapiti' });
    var form = el('form', { class: 'lead', novalidate: true }, [
      el('p', { text: 'Come possiamo ricontattarti?' }),
      name.node, email.node, phone ? phone.node : null, consentLabel, consentErr, submit,
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      [name, email, phone].forEach(function (f) {
        if (!f) return;
        f.err.textContent = '';
        f.input.removeAttribute('aria-invalid');
      });
      consentErr.textContent = '';
      submit.disabled = true;
      api('/leads', {
        conversationId: state.conversationId,
        name: name.input.value,
        email: email.input.value,
        phone: phone ? phone.input.value : '',
        consent: consent.checked,
        preview: PREVIEW || undefined,
      }).then(function (data) {
        state.leadDone = true;
        set(session, KEY + ':lead', '1');
        form.remove();
        addMessage('bot', data.reply.text);
      }).catch(function (err) {
        submit.disabled = false;
        var fields = (err.data && err.data.fields) || {};
        var map = { name: name, email: email, phone: phone };
        var first = null;
        Object.keys(fields).forEach(function (k) {
          if (k === 'consent') {
            consentErr.textContent = fields[k];
            return;
          }
          var f = map[k];
          if (!f) return;
          f.err.textContent = fields[k];
          f.input.setAttribute('aria-invalid', 'true');
          first = first || f.input;
        });
        if (!Object.keys(fields).length) consentErr.textContent = err.message;
        if (first) first.focus();
      });
    });
    ui.log.appendChild(form);
    scrollDown();
    setTimeout(function () { name.input.focus(); }, 50);
  }

  function setOpen(open) {
    if (MODE === 'page') return;
    state.open = open;
    wrap.classList.toggle('open', open);
    ui.launcher.setAttribute('aria-expanded', String(open));
    ui.launcher.setAttribute('aria-label', open ? 'Chiudi la chat' : 'Apri la chat');
    ui.launcher.replaceChildren(svg(open ? ICON_CLOSE : ICON_CHAT, open ? 22 : 26));
    if (open) {
      set(session, KEY + ':label', '0');
      if (ui.label) ui.label.style.display = 'none';
      setTimeout(function () { ui.input.focus(); scrollDown(); }, 60);
    } else {
      ui.launcher.focus();
    }
  }

  // ---------- Avvio ----------
  api('/config').then(function (data) {
    if (!data.active) return;
    state.settings = data.settings;
    state.brand = data.brand;
    build();
    if (MODE === 'page' || OPEN_ON_LOAD) {
      if (MODE !== 'page') setOpen(true);
    }
    // API pubblica minima, usata anche dall'anteprima nella dashboard.
    var instance = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!state.open); },
      update: function (partial) {
        for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) state.settings[k] = partial[k];
        applySettings();
        if (state.history.length <= 1) {
          state.history = [];
          renderHistory();
        }
      },
      reset: function () {
        state.history = [];
        state.conversationId = null;
        state.leadDone = false;
        set(session, KEY + ':history', '[]');
        set(session, KEY + ':conv', '');
        set(session, KEY + ':lead', '');
        renderHistory();
      },
    };
    window.Aperto = window.Aperto || instance;
    window.__aperto[WIDGET_ID] = instance;
    try {
      document.dispatchEvent(new CustomEvent('aperto:ready', { detail: { id: WIDGET_ID } }));
    } catch (e) { /* browser molto vecchi */ }
  }).catch(function (err) {
    if (window.console) console.warn('[Aperto] Widget non caricato: ' + err.message);
  });
})();
