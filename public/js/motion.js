/*
 * Motion design della landing — "Segnali notturni" (vedi docs/motion-design.md).
 * Tutto generato in codice: nessun video, nessuna libreria. Seme 2240.
 *  - Campo generativo nell'hero che reagisce al cursore
 *  - Racconto a scroll "Una notte": cielo, segnali e interfaccia guidati dallo scroll
 *  - Interazioni: luce che segue il cursore, inclinazione 3D, pulsanti magnetici, barra di lettura
 */
(function () {
  'use strict';

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

  var INK = [26, 27, 24];
  var GREEN = [31, 92, 74];
  var LIVE = [63, 191, 127];
  var TERRA = [168, 80, 42];

  // =====================================================================
  // 1. Campo generativo dell'hero
  // =====================================================================
  var heroCanvas = document.querySelector('[data-field="hero"]');
  if (heroCanvas && !reduceMotion) {
    var hs = surface(heroCanvas);
    var hp = [];
    var mouse = { x: -9999, y: -9999, active: false };
    var tmp = [0, 0];

    var seedHero = function () {
      var r = mulberry32(SEED);
      var count = clamp(Math.round((hs.w * hs.h) / 8500), 70, 190);
      hp = [];
      for (var i = 0; i < count; i++) {
        hp.push({
          x: r() * hs.w, y: r() * hs.h, vx: 0, vy: 0, lit: 0,
          kind: r() < 0.07 ? TERRA : r() < 0.35 ? GREEN : INK,
          size: 0.8 + r() * 1.5, trail: [],
        });
      }
    };
    hs.onResize = seedHero;
    seedHero();

    var hero = heroCanvas.closest('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = heroCanvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    });
    hero.addEventListener('pointerleave', function () { mouse.active = false; });

    tasks.push(function (t) {
      if (!hs.visible) return;
      var ctx = hs.ctx;
      var z = t * 0.00004;
      var fade = 1 - smooth(0, hs.h * 0.9, window.scrollY); // il campo si dissolve scendendo
      ctx.clearRect(0, 0, hs.w, hs.h);
      if (fade <= 0.01) return;
      var R = 170;
      var lit = [];
      for (var i = 0; i < hp.length; i++) {
        var p = hp[i];
        curl(p.x * 0.0016, p.y * 0.0016, z, tmp);
        p.vx = p.vx * 0.9 + tmp[0] * 0.045;
        p.vy = p.vy * 0.9 + tmp[1] * 0.045;
        var target = 0;
        if (mouse.active) {
          var dx = mouse.x - p.x, dy = mouse.y - p.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) {
            var f = (1 - d / R);
            // lente: avvicina e fa orbitare i segnali vicini al cursore
            p.vx += (dx / d) * f * 0.12 - (dy / d) * f * 0.18;
            p.vy += (dy / d) * f * 0.12 + (dx / d) * f * 0.18;
            target = f;
          }
        }
        p.lit += (target - p.lit) * 0.08;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = hs.w + 20; else if (p.x > hs.w + 20) p.x = -20;
        if (p.y < -20) p.y = hs.h + 20; else if (p.y > hs.h + 20) p.y = -20;
        p.trail.push(p.x, p.y);
        if (p.trail.length > 16) p.trail.splice(0, 2);

        // meno presenza dietro al testo, più verso il bordo destro
        var zone = 0.3 + 0.7 * smooth(0.25, 0.7, p.x / hs.w);
        var a = (0.1 + p.lit * 0.55) * zone * fade;
        var col = p.lit > 0.15 ? mixColor(p.kind, LIVE, p.lit) : p.kind;
        ctx.strokeStyle = rgb(col, a * 0.8);
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        var tr = p.trail;
        for (var k = 0; k < tr.length; k += 2) {
          if (k === 0) ctx.moveTo(tr[k], tr[k + 1]);
          else if (Math.abs(tr[k] - tr[k - 2]) < 40 && Math.abs(tr[k + 1] - tr[k - 1]) < 40) ctx.lineTo(tr[k], tr[k + 1]);
          else ctx.moveTo(tr[k], tr[k + 1]);
        }
        ctx.stroke();
        ctx.fillStyle = rgb(col, Math.min(1, a * 1.6));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + p.lit * 1.4, 0, 6.2832);
        ctx.fill();
        if (p.lit > 0.3) lit.push(p);
      }
      // fili tra i segnali accesi: una conversazione che si accende al passaggio
      for (var m = 0; m < lit.length; m++) {
        for (var q = m + 1; q < lit.length; q++) {
          var ax = lit[m].x - lit[q].x, ay = lit[m].y - lit[q].y;
          var dd = ax * ax + ay * ay;
          if (dd < 6400) {
            ctx.strokeStyle = rgb(GREEN, (1 - dd / 6400) * 0.35 * Math.min(lit[m].lit, lit[q].lit) * fade);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lit[m].x, lit[m].y);
            ctx.lineTo(lit[q].x, lit[q].y);
            ctx.stroke();
          }
        }
      }
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

    var NIGHT_TOP = [11, 22, 32], NIGHT_BOT = [26, 44, 53];
    var DAWN_TOP = [233, 180, 143], DAWN_BOT = [246, 220, 192];
    var DAY_TOP = [246, 244, 239], DAY_BOT = [239, 235, 226];
    var tmp2 = [0, 0];

    var drawSky = function (p, t) {
      var ctx = sky.ctx, w = sky.w, h = sky.h;
      var day = smooth(0.62, 0.92, p);
      var top = day < 0.5 ? mixColor(NIGHT_TOP, DAWN_TOP, day * 2) : mixColor(DAWN_TOP, DAY_TOP, (day - 0.5) * 2);
      var bot = day < 0.5 ? mixColor(NIGHT_BOT, DAWN_BOT, day * 2) : mixColor(DAWN_BOT, DAY_BOT, (day - 0.5) * 2);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgb(top));
      g.addColorStop(1, rgb(bot));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // stelle che tremolano e si spengono all'alba
      var starA = 1 - smooth(0.6, 0.8, p);
      if (starA > 0.01) {
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * st.sp + st.ph);
          ctx.fillStyle = 'rgba(255,248,230,' + (tw * starA * 0.85).toFixed(3) + ')';
          ctx.fillRect(st.x * w, st.y * h, st.r, st.r);
        }
        // luna
        var mx = w * 0.84, my = h * 0.17;
        var halo = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
        halo.addColorStop(0, 'rgba(255,244,214,' + (0.22 * starA) + ')');
        halo.addColorStop(1, 'rgba(255,244,214,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(mx - 90, my - 90, 180, 180);
        ctx.fillStyle = 'rgba(255,246,222,' + (0.92 * starA) + ')';
        ctx.beginPath(); ctx.arc(mx, my, 22, 0, 6.2832); ctx.fill();
        ctx.fillStyle = rgb(mixColor(NIGHT_TOP, top, 0.5), starA);
        ctx.beginPath(); ctx.arc(mx + 9, my - 6, 19, 0, 6.2832); ctx.fill();
      }
      // sole che sale lungo un arco
      var sun = smooth(0.7, 1, p);
      if (sun > 0.01) {
        // su schermi stretti il sole sale a destra, lontano dall'orologio
        var narrow = w < 760;
        var sx = narrow ? w * lerp(0.98, 0.84, sun) : w * lerp(0.08, 0.3, sun);
        var sy = h * lerp(0.95, narrow ? 0.13 : 0.22, Math.sin(sun * 1.5708));
        var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 220);
        glow.addColorStop(0, 'rgba(255,214,150,' + (0.55 * sun) + ')');
        glow.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - 220, sy - 220, 440, 440);
        ctx.fillStyle = 'rgba(255,200,120,' + (0.9 * sun) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 6.2832); ctx.fill();
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
        var baseCol = isDay ? GREEN : [255, 238, 205];
        var col = s.lit > 0.05 ? mixColor(baseCol, isDay ? GREEN : LIVE, s.lit) : baseCol;
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

  if (tasks.length) start();
})();
