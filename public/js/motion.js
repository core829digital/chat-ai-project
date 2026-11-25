/*
 * Motion design della landing — "Notte elettrica" (vedi docs/motion-design.md).
 * Tutto generato in codice: nessuna libreria. Seme 2240.
 *  - Sfera di particelle che attraversa la pagina e cambia forma con lo scroll
 *  - Scorrimento morbido con la rotella
 *  - Racconto a scroll "Una notte": cielo, segnali e interfaccia guidati dallo scroll
 *  - Interazioni: luce che segue il cursore, inclinazione 3D, pulsanti magnetici, barra di lettura
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var SEED = 2240;

  // ---------- Casualità seminata e rumore simplex ----------
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(rand) {
    var perm = [];
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var k = 255; k > 0; k--) {
      var j = Math.floor(rand() * (k + 1));
      var tmp = perm[k]; perm[k] = perm[j]; perm[j] = tmp;
    }
    var p = new Uint8Array(512);
    for (var n = 0; n < 512; n++) p[n] = perm[n & 255];
    var G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    var F2 = 0.5 * (Math.sqrt(3) - 1);
    var G2 = (3 - Math.sqrt(3)) / 6;
    return function (x, y) {
      var s = (x + y) * F2;
      var i0 = Math.floor(x + s), j0 = Math.floor(y + s);
      var t = (i0 + j0) * G2;
      var x0 = x - (i0 - t), y0 = y - (j0 - t);
      var i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      var ii = i0 & 255, jj = j0 & 255;
      var n0 = 0, n1 = 0, n2 = 0, g;
      var t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { g = G[p[ii + p[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      var t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { g = G[p[ii + i1 + p[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      var t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { g = G[p[ii + 1 + p[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  }

  var rand = mulberry32(SEED);
  var noise = makeNoise(rand);

  // Curl del rumore: un campo che scorre senza ammassare né disperdere le particelle.
  function curl(x, y, z, out) {
    var e = 0.0009;
    var a = noise(x, y + e + z) - noise(x, y - e + z);
    var b = noise(x + e, y + z) - noise(x - e, y + z);
    out[0] = a / (2 * e);
    out[1] = -b / (2 * e);
    return out;
  }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mixColor(c1, c2, t) {
    return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
  }
  var rgb = function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')'; };

  // ---------- Canvas con densità controllata e pausa fuori schermo ----------
  function surface(canvas) {
    var ctx = canvas.getContext('2d');
    var s = { canvas: canvas, ctx: ctx, w: 0, h: 0, dpr: 1, visible: true };
    function resize() {
      var r = canvas.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      s.w = Math.max(1, r.width);
      s.h = Math.max(1, r.height);
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      if (s.onResize) s.onResize();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { s.visible = e[0].isIntersecting; }).observe(canvas);
    }
    resize();
    return s;
  }

  var tasks = [];
  var running = false;
  function loop(t) {
    if (document.hidden) { running = false; return; }
    for (var i = 0; i < tasks.length; i++) tasks[i](t);
    requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  var GREEN = [29, 95, 214];   // blu dei contatti (di giorno)
  var LIVE = [92, 225, 255];   // ciano dei segnali accesi

  // =====================================================================
  // 1. La sfera di particelle che attraversa la pagina
  //    Un solo oggetto 3D (anelli di trattini luminosi) che cambia forma, posizione e scala
  //    seguendo i fotogrammi chiave scritti nelle sezioni: data-orb="forma x y scala inclinazione opacità".
  //    Forme: wave (onda piana), sphere (globo a impronta), funnel (corno), ring (aureola).
  //    Tra una sezione e l'altra i valori si fondono; un'inerzia rende il movimento morbido.
  // =====================================================================
  var orbCanvas = document.querySelector('[data-orb-canvas]');
  if (orbCanvas) {
    var os = surface(orbCanvas);
    var TAU = Math.PI * 2;
    var SHAPES = ['wave', 'sphere', 'funnel', 'ring'];
    var compact = window.innerWidth < 760;
    var RINGS = compact ? 30 : 46;
    var PER = compact ? 40 : 60;
    var anchors = [];
    document.querySelectorAll('[data-orb]').forEach(function (el) {
      // sui telefoni si usano i fotogrammi dedicati (data-orb-m), se la sezione li dichiara
      var a = ((compact && el.getAttribute('data-orb-m')) || el.getAttribute('data-orb')).trim().split(/\s+/);
      var k = SHAPES.indexOf(a[0]);
      anchors.push({ el: el, w: SHAPES.map(function (_, i) { return i === k ? 1 : 0; }), x: +a[1], y: +a[2], s: +a[3], tilt: +a[4], alpha: +a[5], from: 0, to: 0 });
    });
    var measureAnchors = function () {
      var vh = window.innerHeight;
      anchors.forEach(function (a) {
        var r = a.el.getBoundingClientRect();
        var top = r.top + window.scrollY;
        var half = Math.min(r.height, vh) / 2;
        a.from = top + half;
        a.to = Math.max(a.from, top + r.height - half);
        if (a.alpha === 0) {
          // sezione opaca: invisibile già quando il bordo alto spunta in basso, di nuovo visibile
          // solo quando il bordo basso è quasi uscito in alto (così non viene mai "tagliata")
          a.from = top - vh * 0.5;
          a.to = top + r.height + vh * 0.3;
        }
      });
    };
    measureAnchors();
    window.addEventListener('resize', measureAnchors);
    window.addEventListener('load', measureAnchors);
    if ('ResizeObserver' in window) new ResizeObserver(measureAnchors).observe(document.body);

    // fotogramma corrente desiderato: si cerca il tratto di pagina in cui cade il centro dello schermo
    var orbTarget = { w: [1, 0, 0, 0], x: 0.5, y: 0.9, s: 1.3, tilt: -0.4, alpha: 1 };
    var orbCur = { w: [1, 0, 0, 0], x: 0.5, y: 0.9, s: 1.3, tilt: -0.4, alpha: 0 };
    var sampleTarget = function () {
      if (!anchors.length) return;
      var c = window.scrollY + window.innerHeight / 2;
      var a = anchors[0], b = anchors[0], t = 0;
      if (c <= anchors[0].to) { a = b = anchors[0]; }
      else {
        for (var i = 0; i < anchors.length; i++) {
          var A = anchors[i], B = anchors[i + 1];
          if (c >= A.from && c <= A.to) { a = b = A; break; }
          if (B && c > A.to && c < B.from) { a = A; b = B; t = smooth(A.to, B.from, c); break; }
          if (!B) { a = b = A; }
        }
      }
      for (var k = 0; k < 4; k++) orbTarget.w[k] = lerp(a.w[k], b.w[k], t);
      orbTarget.x = lerp(a.x, b.x, t); orbTarget.y = lerp(a.y, b.y, t); orbTarget.s = lerp(a.s, b.s, t);
      orbTarget.tilt = lerp(a.tilt, b.tilt, t); orbTarget.alpha = lerp(a.alpha, b.alpha, t);
    };

    // forme: ogni punto è (u = anello 0..1, v = angolo lungo l'anello) → x, y, z
    var shapeAt = function (k, u, v, t, out) {
      if (k === 0) { // onda: anelli concentrici su un piano che ondeggia
        var r = 0.14 + 1.8 * u;
        out[0] = r * Math.cos(v); out[2] = r * Math.sin(v);
        out[1] = 0.12 * Math.sin(r * 4.2 - t * 0.8) * (0.35 + u);
      } else if (k === 1) { // globo: paralleli che respirano come un'impronta digitale
        var lat = (u - 0.5) * Math.PI * 0.94, cl = Math.cos(lat);
        var wob = 1 + 0.04 * Math.sin(5 * v + 9 * u + t * 0.7);
        out[0] = cl * Math.cos(v) * wob; out[1] = Math.sin(lat) * wob; out[2] = cl * Math.sin(v) * wob;
      } else if (k === 2) { // corno: anelli che si allargano lungo un asse
        var rr = (0.07 + 1.05 * Math.pow(u, 2.2)) * (1 + 0.04 * Math.sin(v * 3 + t * 1.2));
        var vv = v + t * 0.22;
        out[0] = -1.3 + 2.6 * u; out[1] = rr * Math.cos(vv); out[2] = rr * Math.sin(vv);
      } else { // aureola: un anello largo e piatto
        var R0 = 0.72 + 0.8 * u;
        out[0] = R0 * Math.cos(v); out[2] = R0 * Math.sin(v);
        out[1] = 0.06 * Math.sin(6 * v + t * 1 + u * 8);
      }
      return out;
    };

    var mouseT = { x: 0, y: 0 }, mouseC = { x: 0, y: 0 };
    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        mouseT.x = e.clientX / window.innerWidth - 0.5;
        mouseT.y = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
    }

    var P = [0, 0, 0], Q = [0, 0, 0], S = [0, 0, 0], tmpP = [0, 0, 0];
    var BUCKETS = 4;
    var COLORS = [[200, 242, 255], [110, 210, 255], [55, 150, 255], [40, 95, 225]];
    var lastOrbT = 0, spin = 0, spinTarget = 0, lastScroll = window.scrollY;

    var drawOrb = function (time, instant) {
      var dt = lastOrbT ? Math.min(64, time - lastOrbT) : 16;
      lastOrbT = time;
      sampleTarget();
      // inerzia: il fotogramma corrente insegue quello desiderato (≈ 0,65 s: il cambio di forma è calmo)
      var f = instant ? 1 : 1 - Math.exp(-dt / 650);
      for (var k = 0; k < 4; k++) orbCur.w[k] += (orbTarget.w[k] - orbCur.w[k]) * f;
      orbCur.x += (orbTarget.x - orbCur.x) * f; orbCur.y += (orbTarget.y - orbCur.y) * f; orbCur.s += (orbTarget.s - orbCur.s) * f;
      orbCur.tilt += (orbTarget.tilt - orbCur.tilt) * f; orbCur.alpha += (orbTarget.alpha - orbCur.alpha) * f;
      mouseC.x += (mouseT.x - mouseC.x) * 0.025; mouseC.y += (mouseT.y - mouseC.y) * 0.025;
      // lo scroll veloce fa girare la sfera un po' di più
      var sy = window.scrollY;
      spinTarget += clamp(sy - lastScroll, -120, 120) * 0.00028;
      spin += (spinTarget - spin) * (instant ? 1 : 1 - Math.exp(-dt / 900));
      lastScroll = sy;

      var ctx = os.ctx, W = os.w, H = os.h;
      ctx.clearRect(0, 0, W, H);
      if (orbCur.alpha < 0.01) return;
      var t = instant ? 0 : time * 0.001;
      var R = orbCur.s * Math.min(W, H * 1.3) * 0.42;
      var cx = orbCur.x * W + mouseC.x * 24, cy = orbCur.y * H + mouseC.y * 16;
      var wf = orbCur.w[2];
      var rotY = (t * 0.09 + spin) * (1 - wf * 0.85) - wf * 0.45 + mouseC.x * 0.25;
      var tilt = orbCur.tilt + mouseC.y * 0.12;
      var cyR = Math.cos(rotY), syR = Math.sin(rotY), cxR = Math.cos(tilt), sxR = Math.sin(tilt);
      var dist = 3.4;

      // alone morbido dietro alla forma
      ctx.globalCompositeOperation = 'lighter';
      var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      halo.addColorStop(0, 'rgba(47,140,255,' + (0.2 * orbCur.alpha).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(47,140,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);

      var paths = [];
      for (var b0 = 0; b0 < BUCKETS; b0++) paths.push(new Path2D());
      var project = function (p, out) {
        var x1 = p[0] * cyR + p[2] * syR, z1 = -p[0] * syR + p[2] * cyR;
        var y2 = p[1] * cxR - z1 * sxR, z2 = p[1] * sxR + z1 * cxR;
        var sc = dist / (dist + z2);
        out[0] = cx + x1 * sc * R; out[1] = cy - y2 * sc * R; out[2] = z2;
        return out;
      };
      var blend = function (u, v, out) {
        out[0] = out[1] = out[2] = 0;
        for (var k = 0; k < 4; k++) {
          var wk = orbCur.w[k];
          if (wk < 0.002) continue;
          shapeAt(k, u, v, t, tmpP);
          out[0] += tmpP[0] * wk; out[1] += tmpP[1] * wk; out[2] += tmpP[2] * wk;
        }
        return out;
      };
      var dv = 0.075;
      for (var i = 0; i < RINGS; i++) {
        var u = i / (RINGS - 1);
        var off = (i % 2) * (Math.PI / PER);
        for (var j = 0; j < PER; j++) {
          var v = (j / PER) * TAU + off;
          project(blend(u, v, P), S);
          var x1 = S[0], y1 = S[1], z = S[2];
          project(blend(u, v + dv, Q), S);
          if (x1 < -40 && S[0] < -40 || x1 > W + 40 && S[0] > W + 40 || y1 < -40 && S[1] < -40 || y1 > H + 40 && S[1] > H + 40) continue;
          var bi = clamp(Math.floor((z + 1.4) / 2.8 * BUCKETS), 0, BUCKETS - 1);
          paths[bi].moveTo(x1, y1);
          paths[bi].lineTo(S[0], S[1]);
        }
      }
      var lw = clamp(R / 260, 0.7, 1.9);
      ctx.lineCap = 'round';
      for (var bk = 0; bk < BUCKETS; bk++) {
        var col = COLORS[bk];
        var depthA = [1, 0.78, 0.5, 0.28][bk] * orbCur.alpha;
        ctx.strokeStyle = rgb(col, 0.16 * depthA);
        ctx.lineWidth = lw * (3.6 - bk * 0.5);
        ctx.stroke(paths[bk]);
        ctx.strokeStyle = rgb(col, 0.9 * depthA);
        ctx.lineWidth = lw * (1.25 - bk * 0.15);
        ctx.stroke(paths[bk]);
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    if (reduceMotion) {
      // nessuna animazione: la forma si ridisegna ferma quando si cambia sezione
      var orbPending = false;
      var orbStill = function () { orbPending = false; drawOrb(performance.now(), true); };
      window.addEventListener('scroll', function () { if (!orbPending) { orbPending = true; requestAnimationFrame(orbStill); } }, { passive: true });
      os.onResize = function () { measureAnchors(); orbStill(); };
      orbStill();
    } else {
      os.onResize = measureAnchors;
      tasks.push(function (time) { drawOrb(time, false); });
    }
  }

  // =====================================================================
  // 1b. Scorrimento morbido con la rotella (solo mouse, solo landing)
  //     La pagina scivola verso la posizione desiderata invece di saltare a scatti.
  //     Tastiera, barra di scorrimento, link interni e touch restano quelli del sistema.
  // =====================================================================
  if (finePointer && !reduceMotion && document.body.classList.contains('landing')) {
    var wheelTarget = window.scrollY, wheelCur = window.scrollY, wheeling = false, wheelLast = 0;
    var scrollableInPath = function (e) {
      var path = e.composedPath ? e.composedPath() : [];
      for (var i = 0; i < path.length; i++) {
        var el = path[i];
        if (!el || el === document.body || el === document.documentElement || el === window || el.nodeType !== 1) continue;
        if (el.scrollHeight > el.clientHeight + 1) {
          var oy = getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll') return true;
        }
      }
      return false;
    };
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollableInPath(e)) return;
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!wheeling) wheelTarget = wheelCur = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      wheelTarget = clamp(wheelTarget + delta, 0, max);
      wheeling = true;
      start();
    }, { passive: false });
    tasks.push(function (time) {
      if (!wheeling) { wheelLast = time; return; }
      // se qualcos'altro ha spostato la pagina (link, tastiera), si lascia fare
      if (Math.abs(window.scrollY - Math.round(wheelCur)) > 3) { wheeling = false; return; }
      var dt = wheelLast ? Math.min(64, time - wheelLast) : 16;
      wheelLast = time;
      wheelCur += (wheelTarget - wheelCur) * (1 - Math.exp(-dt / 110));
      if (Math.abs(wheelTarget - wheelCur) < 0.5) { wheelCur = wheelTarget; wheeling = false; }
      window.scrollTo({ top: wheelCur, behavior: 'instant' });
    });
  }

  // =====================================================================
  // 2. Racconto a scroll: "Una notte, dalle 22:40 alle 8:30"
  // =====================================================================
  var story = document.querySelector('[data-story]');
  if (story) {
    var sticky = story.querySelector('.story-sticky');
    var clock = story.querySelector('[data-clock]');
    var chapters = story.querySelectorAll('[data-chapter]');
    var dots = story.querySelectorAll('.story-progress span');
    var timed = story.querySelectorAll('[data-at]');
    var typing = story.querySelectorAll('[data-from]');
    var counter = story.querySelector('[data-answered]');
    var browserEl = story.querySelector('.story-browser');
    var phoneEl = story.querySelector('.story-phone');
    var skyCanvas = story.querySelector('[data-field="sky"]');
    var bounds = [0, 0.2, 0.45, 0.65, 1];
    // orari chiave in minuti dalla mezzanotte (oltre 1440 = giorno dopo)
    var times = [[0, 1360], [0.42, 1361], [0.62, 1395], [0.92, 1950], [1, 1950]];
    var lastP = -1;

    if (reduceMotion) story.classList.add('is-static');

    var progress = function () {
      if (reduceMotion) return 1;
      var r = story.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      return total > 0 ? clamp(-r.top / total, 0, 1) : 1;
    };

    var clockAt = function (p) {
      for (var i = 1; i < times.length; i++) {
        if (p <= times[i][0]) {
          var a = times[i - 1], b = times[i];
          var mins = Math.round(lerp(a[1], b[1], (p - a[0]) / (b[0] - a[0] || 1))) % 1440;
          var h = Math.floor(mins / 60), m = mins % 60;
          return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        }
      }
      return '08:30';
    };

    var updateDom = function (p) {
      var day = smooth(0.66, 0.86, p);
      sticky.style.setProperty('--day', day.toFixed(3));
      sticky.classList.toggle('is-day', day > 0.5);
      clock.textContent = clockAt(p);
      for (var c = 0; c < chapters.length; c++) {
        var on = p >= bounds[c] && (p < bounds[c + 1] || (c === chapters.length - 1));
        chapters[c].classList.toggle('is-active', on);
        if (dots[c]) dots[c].style.transform = 'scaleX(' + clamp((p - bounds[c]) / (bounds[c + 1] - bounds[c]), 0, 1).toFixed(3) + ')';
      }
      for (var i = 0; i < timed.length; i++) timed[i].classList.toggle('is-on', p >= Number(timed[i].getAttribute('data-at')));
      for (var k = 0; k < typing.length; k++) {
        var from = Number(typing[k].getAttribute('data-from')), to = Number(typing[k].getAttribute('data-to'));
        typing[k].classList.toggle('is-on', p >= from && p < to);
      }
      counter.textContent = Math.round(27 * smooth(0.08, 0.9, p));
    };

    // ---- Cielo e segnali generati ----
    var sky = skyCanvas && !reduceMotion ? surface(skyCanvas) : null;
    var stars = [], signals = [];
    var sr = mulberry32(SEED + 1);
    for (var s = 0; s < 160; s++) stars.push({ x: sr(), y: sr() * 0.75, r: 0.4 + sr() * 1.2, ph: sr() * 6.28, sp: 0.6 + sr() * 1.6 });
    var targets = { browser: [0, 0, 0], phone: [0, 0, 0] };
    var measure = function () {
      if (!sky) return;
      var base = skyCanvas.getBoundingClientRect();
      var b = browserEl.getBoundingClientRect();
      targets.browser = [b.left - base.left + b.width * 0.5, b.top - base.top + b.height * 0.45, Math.max(60, b.width * 0.32)];
      var ph = phoneEl && phoneEl.offsetParent ? phoneEl.getBoundingClientRect() : b;
      targets.phone = [ph.left - base.left + ph.width * 0.5, ph.top - base.top + ph.height * 0.4, Math.max(40, ph.width * 0.3)];
    };
    var spawn = function (p, day, r) {
      p.day = day;
      p.trail = [];
      p.lit = day ? 1 : 0;
      p.life = 0;
      if (day) {
        p.x = targets.browser[0] + (r() - 0.5) * 120;
        p.y = targets.browser[1] + (r() - 0.5) * 120;
      } else {
        p.x = -20 - r() * 120;
        p.y = sky.h * (0.12 + r() * 0.8);
      }
      p.vx = day ? 0 : 1 + r() * 1.2;
      p.vy = 0;
    };
    if (sky) {
      sky.onResize = measure;
      measure();
      var pr = mulberry32(SEED + 2);
      for (var q = 0; q < 70; q++) {
        var sig = { size: 0.9 + pr() * 1.6 };
        spawn(sig, false, pr);
        sig.x = pr() * sky.w * 0.5; // all'avvio sono già in viaggio
        signals.push(sig);
      }
      window.addEventListener('scroll', function () { if (Math.abs(progress() - lastP) > 0.2) measure(); }, { passive: true });
    }

    // Alba elettrica: il cielo resta notte in alto; la luce nasce solo dall'orizzonte (niente "modalità chiara").
    var NIGHT_TOP = [2, 6, 16], NIGHT_BOT = [10, 26, 58];
    var DAWN_TOP = [6, 14, 40], DAWN_BOT = [58, 34, 74];     // blu notte sopra, viola caldo in basso
    var tmp2 = [0, 0];

    var drawSky = function (p, t) {
      var ctx = sky.ctx, w = sky.w, h = sky.h;
      var day = smooth(0.62, 0.95, p);
      var narrow = w < 760;
      var top = mixColor(NIGHT_TOP, DAWN_TOP, day);
      var bot = mixColor(NIGHT_BOT, DAWN_BOT, day);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgb(top));
      g.addColorStop(0.55, rgb(mixColor(top, bot, 0.45)));
      g.addColorStop(1, rgb(bot));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // il sole: nasce dall'orizzonte e sale piano; su telefono a destra, sopra la chat
      var sun = smooth(0.66, 1, p);
      var sx = narrow ? w * 0.8 : w * 0.38;
      var sy = narrow ? h * lerp(0.46, 0.2, sun) : h * lerp(1.12, 0.8, sun);
      var R = narrow ? 30 : 46;
      if (day > 0.01) {
        // fascia calda lungo l'orizzonte (o dietro al sole, su telefono)
        var hx = sx, hy = narrow ? sy + h * 0.12 : h;
        var band = ctx.createRadialGradient(hx, hy, 0, hx, hy, Math.max(w, h) * 0.75);
        band.addColorStop(0, 'rgba(255,150,92,' + (0.55 * day).toFixed(3) + ')');
        band.addColorStop(0.3, 'rgba(236,92,120,' + (0.26 * day).toFixed(3) + ')');
        band.addColorStop(0.62, 'rgba(124,92,255,' + (0.12 * day).toFixed(3) + ')');
        band.addColorStop(1, 'rgba(47,140,255,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }

      // stelle: si diradano ma non spariscono del tutto (in alto resta notte)
      var starA = 1 - 0.75 * smooth(0.6, 0.95, p);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * st.sp + st.ph);
        var a = tw * starA * 0.85 * (1 - day * smooth(0.25, 0.8, st.y)); // vicino all'orizzonte la luce le copre prima
        if (a < 0.02) continue;
        ctx.fillStyle = 'rgba(225,236,255,' + a.toFixed(3) + ')';
        ctx.fillRect(st.x * w, st.y * h, st.r, st.r);
      }
      // la luna tramonta: scende e si spegne mentre il sole sale
      var moonA = 1 - smooth(0.62, 0.86, p);
      if (moonA > 0.01) {
        var mx = w * 0.84, my = h * (0.17 + 0.12 * (1 - moonA));
        var halo = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
        halo.addColorStop(0, 'rgba(220,234,255,' + (0.2 * moonA) + ')');
        halo.addColorStop(1, 'rgba(220,234,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(mx - 90, my - 90, 180, 180);
        ctx.fillStyle = 'rgba(236,242,255,' + (0.92 * moonA) + ')';
        ctx.beginPath(); ctx.arc(mx, my, 22, 0, 6.2832); ctx.fill();
        ctx.fillStyle = rgb(top, moonA);
        ctx.beginPath(); ctx.arc(mx + 9, my - 6, 19, 0, 6.2832); ctx.fill();
      }
      if (sun > 0.01) {
        // corona larga, poi disco caldo con il bordo che sfuma; la luce "respira" appena
        var breath = 1 + 0.04 * Math.sin(t * 0.0012);
        var corona = ctx.createRadialGradient(sx, sy, R * 0.6, sx, sy, R * 7 * breath);
        corona.addColorStop(0, 'rgba(255,190,120,' + (0.5 * sun).toFixed(3) + ')');
        corona.addColorStop(0.35, 'rgba(255,120,110,' + (0.16 * sun).toFixed(3) + ')');
        corona.addColorStop(1, 'rgba(255,120,110,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = corona;
        ctx.fillRect(sx - R * 8, sy - R * 8, R * 16, R * 16);
        ctx.globalCompositeOperation = 'source-over';
        var disc = ctx.createRadialGradient(sx, sy - R * 0.3, R * 0.1, sx, sy, R);
        disc.addColorStop(0, 'rgba(255,240,210,' + sun.toFixed(3) + ')');
        disc.addColorStop(0.7, 'rgba(255,182,110,' + sun.toFixed(3) + ')');
        disc.addColorStop(1, 'rgba(255,140,90,' + (0.85 * sun).toFixed(3) + ')');
        ctx.fillStyle = disc;
        ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();
        if (!narrow) {
          // sul desktop il sole è ancora per metà sotto l'orizzonte: una foschia lo copre morbidamente
          var mist = ctx.createLinearGradient(0, h * 0.86, 0, h);
          mist.addColorStop(0, 'rgba(10,8,30,0)');
          mist.addColorStop(1, 'rgba(10,8,30,' + (0.75 * day).toFixed(3) + ')');
          ctx.fillStyle = mist;
          ctx.fillRect(0, h * 0.86, w, h * 0.14);
        }
      }

      // segnali: di notte le domande vanno al sito, di giorno i contatti vanno al telefono
      var isDay = p > 0.7;
      var night = p > 0.03 && p < 0.7;
      var z = t * 0.00005;
      for (var k = 0; k < signals.length; k++) {
        var s = signals[k];
        if (s.day !== isDay) spawn(s, isDay, sr);
        var tg = isDay ? targets.phone : targets.browser;
        curl(s.x * 0.0022, s.y * 0.0022, z, tmp2);
        var dx = tg[0] - s.x, dy = tg[1] - s.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var pull = isDay ? 0.09 : 0.035 + 0.05 * (1 - Math.min(1, d / 700));
        s.vx = s.vx * 0.94 + tmp2[0] * 0.05 + (dx / d) * pull;
        s.vy = s.vy * 0.94 + tmp2[1] * 0.05 + (dy / d) * pull;
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (d < tg[2]) s.lit = Math.min(1, s.lit + 0.06);
        var arrived = d < tg[2] * 0.35 || (s.lit >= 1 && !isDay && s.life > 60 && d < tg[2]);
        if (arrived || s.life > 1400) spawn(s, isDay, sr);
        s.trail.push(s.x, s.y);
        if (s.trail.length > 22) s.trail.splice(0, 2);

        var vis = isDay ? 1 : night ? 1 : 0.25;
        var baseCol = isDay ? LIVE : [214, 236, 255];
        var col = s.lit > 0.05 ? mixColor(baseCol, isDay ? [255, 200, 150] : LIVE, s.lit) : baseCol;
        var a = (isDay ? 0.55 : 0.5 + s.lit * 0.4) * vis;
        ctx.strokeStyle = rgb(col, a * 0.5);
        ctx.lineWidth = s.size * 0.8;
        ctx.beginPath();
        for (var j = 0; j < s.trail.length; j += 2) {
          if (j === 0) ctx.moveTo(s.trail[j], s.trail[j + 1]); else ctx.lineTo(s.trail[j], s.trail[j + 1]);
        }
        ctx.stroke();
        ctx.fillStyle = rgb(col, Math.min(1, a * 1.5));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size + s.lit * 1.2, 0, 6.2832);
        ctx.fill();
      }
    };

    updateDom(progress());
    tasks.push(function (t) {
      var p = progress();
      if (Math.abs(p - lastP) > 0.0004) {
        lastP = p;
        updateDom(p);
      }
      if (sky && sky.visible) drawSky(p, t);
    });
  }

  // =====================================================================
  // 3. Interazioni in stile SaaS
  // =====================================================================

  // Barra di avanzamento della lettura nella testata
  var bar = document.querySelector('.scroll-progress');
  if (bar) {
    tasks.push(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0).toFixed(4) + ')';
    });
  }

  if (finePointer && !reduceMotion) {
    // Luce che segue il cursore su schede e card
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('[data-spot]');
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    // Inclinazione 3D della demo nell'hero, con inerzia
    var tilt = document.querySelector('[data-tilt]');
    if (tilt) {
      var heroSec = tilt.closest('.hero');
      var cur = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
      heroSec.addEventListener('pointermove', function (e) {
        var r = heroSec.getBoundingClientRect();
        aim.x = ((e.clientY - r.top) / r.height - 0.5) * -7;
        aim.y = ((e.clientX - r.left) / r.width - 0.5) * 9;
      });
      heroSec.addEventListener('pointerleave', function () { aim.x = 0; aim.y = 0; });
      tasks.push(function () {
        cur.x += (aim.x - cur.x) * 0.07;
        cur.y += (aim.y - cur.y) * 0.07;
        if (Math.abs(cur.x) + Math.abs(cur.y) < 0.01 && !aim.x && !aim.y) { tilt.style.transform = ''; return; }
        tilt.style.transform = 'perspective(1400px) rotateX(' + cur.x.toFixed(2) + 'deg) rotateY(' + cur.y.toFixed(2) + 'deg)';
      });
    }

    // Pulsanti magnetici: si avvicinano al cursore quando passa vicino
    document.querySelectorAll('[data-magnetic]').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        btn.style.translate = clamp(dx * 0.22, -8, 8).toFixed(1) + 'px ' + clamp(dy * 0.32, -6, 6).toFixed(1) + 'px';
      });
      btn.addEventListener('pointerleave', function () { btn.style.translate = ''; });
    });
  }

  // =====================================================================
  // 4. Motore di scroll: ogni [data-scroll] riceve tre avanzamenti continui
  //    --pe  entrata  (0 quando il bordo alto tocca il fondo dello schermo, 1 quando arriva al 15% dall'alto)
  //    --p   passaggio (0 entra dal basso, 1 esce dall'alto)
  //    --px  uscita   (0 finché il bordo alto è sotto la testata, 1 quando è uscito di tutta la sua altezza)
  //    Il CSS li usa direttamente: gli effetti seguono lo scroll e si riavvolgono tornando su.
  // =====================================================================
  var scrollEls = Array.prototype.slice.call(document.querySelectorAll('[data-scroll]'));
  var handlers = {
    step: function (el, pe) {
      el.classList.toggle('is-on', pe > 0.42);
    },
    type: function (el, pe) {
      var code = el.querySelector('[data-type]');
      if (!code) return;
      if (!code._full) code._full = code.textContent;
      var n = Math.round(code._full.length * clamp((pe - 0.2) / 0.55, 0, 1));
      if (code._n === n) return;
      code._n = n;
      code.textContent = code._full.slice(0, n);
      el.classList.toggle('is-typed', n >= code._full.length);
    },
  };

  if (scrollEls.length && !reduceMotion) {
    root.classList.add('motion-on');
    var activeEls = new Set();
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activeEls.add(e.target); else activeEls.delete(e.target); });
    }, { rootMargin: '30% 0px 30% 0px' });
    scrollEls.forEach(function (el) { seen.observe(el); });

    var marqueeEl = document.querySelector('[data-scroll="marquee"]');
    var track = marqueeEl && marqueeEl.querySelector('.marquee');
    var lastY = window.scrollY, lastT = 0, velocity = 0, shift = 0;

    var measureEl = function (el, vh) {
      var r = el.getBoundingClientRect();
      var p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      var pe = clamp((vh - r.top) / (vh * 0.85), 0, 1);
      var px = clamp(-r.top / Math.max(1, r.height), 0, 1);
      // --pp: avanzamento mentre la sezione è fissata (sticky) — 0 quando si fissa, 1 quando si sblocca
      var pp = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      // --en: il bordo alto sta ancora entrando (1 = appena comparso in basso, 0 = arrivato in cima)
      // --lv: il bordo basso sta uscendo (0 = ancora fermo in fondo, 1 = salito per un terzo di schermo)
      // servono a sciogliere nel nero i bordi delle sezioni a tutto schermo: nessuna linea di stacco
      // radice quadrata: il velo è già ampio appena il bordo compare, poi cresce più piano
      var en = Math.sqrt(clamp(r.top / (vh * 0.4), 0, 1));
      var lv = Math.sqrt(clamp((vh - r.bottom) / (vh * 0.4), 0, 1));
      var key = (p * 1000 | 0) + ':' + (pe * 1000 | 0) + ':' + (px * 1000 | 0) + ':' + (pp * 1000 | 0) + ':' + (en * 100 | 0) + ':' + (lv * 100 | 0);
      if (el._key === key) return;
      el._key = key;
      el.style.setProperty('--p', p.toFixed(4));
      el.style.setProperty('--pe', pe.toFixed(4));
      el.style.setProperty('--px', px.toFixed(4));
      el.style.setProperty('--pp', pp.toFixed(4));
      el.style.setProperty('--en', en.toFixed(3));
      el.style.setProperty('--lv', lv.toFixed(3));
      var h = handlers[el.getAttribute('data-scroll')];
      if (h) h(el, pe, p, px);
    };
    // prima misura immediata, così niente "salta" al primo fotogramma
    scrollEls.forEach(function (el) { measureEl(el, window.innerHeight); });

    tasks.push(function (t) {
      var vh = window.innerHeight;
      activeEls.forEach(function (el) { measureEl(el, vh); });

      // velocità di scroll levigata: guida inclinazione e spinta della fascia piattaforme
      var y = window.scrollY;
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      var v = (y - lastY) / dt * 16;
      lastY = y;
      velocity += (v - velocity) * 0.1;
      if (track && activeEls.has(marqueeEl)) {
        shift += velocity * 0.9;
        var w = track.scrollWidth / 2 || 1;
        var off = ((shift % w) + w) % w;
        track.style.setProperty('--shift', (-off).toFixed(1) + 'px');
        track.style.setProperty('--skew', clamp(velocity * -0.18, -9, 9).toFixed(2) + 'deg');
      }
    });
  } else {
    // senza animazioni: stato finale, tutto visibile
    document.querySelectorAll('[data-scroll="step"]').forEach(function (s) { s.classList.add('is-on'); });
  }

  // =====================================================================
  // 5. Video di sezione: caricati solo quando stanno per comparire, in pausa fuori schermo
  // =====================================================================
  var videos = document.querySelectorAll('video[data-src]');
  if (videos.length && 'IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (reduceMotion) return; // resta l'immagine fissa
          if (!v.src) { v.src = v.getAttribute('data-src'); v.load(); }
          var play = v.play();
          if (play && play.catch) play.catch(function () { /* autoplay bloccato: resta il poster */ });
          v.parentNode.classList.add('is-playing');
        } else if (v.src) {
          v.pause();
        }
      });
    }, { rootMargin: '20% 0px 20% 0px' });
    videos.forEach(function (v) { vo.observe(v); });
  }

  // =====================================================================
  // 6. Menu che segue lo scroll: evidenzia la sezione in cui ci si trova
  // =====================================================================
  var nav = document.querySelector('.nav');
  var ink = nav && nav.querySelector('.nav-ink');
  if (ink && document.querySelector('.landing')) {
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="/#"]'));
    var byId = {};
    links.forEach(function (a) {
      var target = document.getElementById(a.getAttribute('href').slice(2));
      if (target) byId[target.id] = a;
    });
    var moveInk = function (a, hover) {
      if (!hover) links.forEach(function (l) { l.classList.toggle('is-current', l === a); });
      if (!a) { ink.style.opacity = '0'; return; }
      ink.style.opacity = '1';
      ink.style.width = a.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    };
    var current = null;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) current = e.target.id;
        else if (current === e.target.id) current = null;
      });
      moveInk(current ? byId[current] : null);
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (sid) { spy.observe(document.getElementById(sid)); });
    links.forEach(function (a) { a.addEventListener('pointerenter', function () { moveInk(a, true); }); });
    nav.addEventListener('pointerleave', function () { moveInk(current ? byId[current] : null); });
  }

  if (tasks.length) start();
})();
