(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var DEFAULT_ON = false;                      // set to false to start muted

  // Recorded CC0 sounds (see sounds/CREDITS.txt) and their volumes (0 to 1)
  var FILES = { click: 'sounds/click.mp3', nav: 'sounds/nav.mp3', tick: 'sounds/tick.mp3',
                pop: 'sounds/pop.mp3', impact: 'sounds/impact.mp3' };
  var VOL = { click: 0.5, nav: 0.3, tick: 0.12, pop: 0.22, impact: 0.35 };

  var on = DEFAULT_ON;

  var ctx, master, buffers = {}, lastPlayed = {}, quietUntil = 0;

  function decode(data) {
    return new Promise(function (res, rej) { var p = ctx.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
  }

  function load() {
    Object.keys(FILES).forEach(function (name) {
      fetch(FILES[name]).then(function (r) { return r.arrayBuffer(); })
        .then(decode).then(function (b) { buffers[name] = b; console.log('loaded', name); }).catch(function (e) { console.log('FAILED', name, e); });
    });
  }

  function setup() {
    if (ctx) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    load();
  }

  function unlock() {
    setup();
    if (ctx.state === 'suspended') ctx.resume();
  }

  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    addEventListener(ev, unlock, { passive: true });
  });

  // name, options: rate (pitch), vol (multiplier), gap (min seconds between plays of this sound)
  function play(name, o) {
    if (!on || !ctx || ctx.state !== 'running' || !buffers[name] || document.hidden) return;
    o = o || {};
    var now = ctx.currentTime;
    if (o.gap && lastPlayed[name] && now - lastPlayed[name] < o.gap) return;
    lastPlayed[name] = now;
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = o.rate || 1;
    var g = ctx.createGain();
    g.gain.value = VOL[name] * (o.vol || 1);
    src.connect(g); g.connect(master);
    src.start();
  }

  function jitter(base, amount) { return base * (1 + (Math.random() * 2 - 1) * amount); }   // varies repeats

  /* ---------- sound on/off button ---------- */
  var st = document.createElement('style');
  st.textContent =
    '#sound{position:absolute;right:62px;top:50%;margin-top:-15px;width:30px;height:30px;border-radius:50%;' +
    'background:none;border:1px solid var(--line);color:var(--fg);cursor:pointer;display:grid;place-items:center;padding:0;' +
    'transition:background .3s}#sound:hover{background:var(--line)}#sound svg{width:15px;height:15px}' +
    '#sound .off{display:none}#sound[aria-pressed="false"] .on{display:none}#sound[aria-pressed="false"] .off{display:block}';
  document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.id = 'sound';
  btn.type = 'button';
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
    '<g class="on"><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></g>' +
    '<g class="off"><path d="M17 9l5 6"/><path d="M22 9l-5 6"/></g></svg>';

  function paint() {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    btn.title = on ? 'Sound on' : 'Sound off';
  }

  btn.addEventListener('click', function () {
    on = !on;
    paint();
    if (on) play('pop');
  });

  var theme = document.getElementById('theme');
  if (theme && theme.parentNode) theme.parentNode.insertBefore(btn, theme);
  else document.body.appendChild(btn);
  paint();

  /* ---------- hover: soft tick ---------- */
  var HOVER = 'nav a, .btn, .tags i, .proj, #theme, #sound';
  var hovered = null;

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = e.target.closest && e.target.closest(HOVER);
    if (!el || el === hovered) return;
    hovered = el;
    play('tick', { rate: jitter(1, 0.08), gap: 0.05, vol: el.classList.contains('proj') ? 0.6 : 1 });
  }, { passive: true });

  document.addEventListener('pointerout', function (e) {
    if (hovered && !(e.relatedTarget && hovered.contains(e.relatedTarget))) hovered = null;
  }, { passive: true });

  /* ---------- presses ---------- */
  var PAGE_LINK = 'a[href^="#"]';        // About / Projects / Contact links and "See my work"
  var PRESS = 'a.btn, #sound';           // other buttons: external links, email
  var navPressedAt = -1e9;

  function pageChange() {
    quietUntil = performance.now() + 450;                                   // keep reveal pops from stacking on it
    play('nav', { rate: jitter(1, 0.03) });
  }

  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest(PAGE_LINK)) { navPressedAt = performance.now(); pageChange(); return; }   // page-change click
    var el = t.closest(PRESS);
    if (el && el.id !== 'sound') play('click', { rate: jitter(1, 0.04) });
  }, { passive: true });

  // Back/forward buttons and keyboard use change the page without a pointer press
  addEventListener('hashchange', function () {
    if (performance.now() - navPressedAt > 800) pageChange();
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(PRESS);
    if (el && e.detail === 0 && el.id !== 'sound' && !el.matches(PAGE_LINK)) play('click');   // keyboard activation
    if (e.target.closest && e.target.closest('#theme')) {                   // light/dark switch: the "flash"
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      play('impact', { rate: dark ? 0.85 : 1.1 });
    }
  });

  /* ---------- scroll reveals: pop as each block fades in ---------- */
  var revealWatch = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.target.closest && m.target.closest('.story.roadmap')) continue;   // the roadmap plays its own sound
      if (m.target.classList.contains('in') && (m.oldValue || '').split(' ').indexOf('in') < 0) {
        if (performance.now() < quietUntil) return;
        play('pop', { rate: jitter(1, 0.06), gap: 0.25 });
        return;
      }
    }
  });
  document.querySelectorAll('.rv').forEach(function (el) {
    revealWatch.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });

  /* ---------- Roadmap: a pop as each stop appears ---------- */
  document.addEventListener('story-step', function () {
    play('pop', { rate: jitter(1.1, 0.05), gap: 0.25 });
  });

  /* ---------- About page: ticks as the intro words light up, pitch rises as it fills ---------- */
  var words = document.getElementById('words');
  if (words) {
    var wordWatch = new MutationObserver(function (list) {
      var about = document.getElementById('about');
      if (!about || !about.classList.contains('active')) return;
      var up = 0, down = 0;
      list.forEach(function (m) {
        var was = (m.oldValue || '').split(' ').indexOf('on') >= 0;
        var is = m.target.classList.contains('on');
        if (is && !was) up++; else if (!is && was) down++;
      });
      if (!up && !down) return;
      var total = words.querySelectorAll('span').length || 1;
      var p = words.querySelectorAll('span.on').length / total;
      play('tick', { rate: 0.85 + p * 0.55, vol: up ? 1 : 0.6, gap: 0.07 });
    });
    wordWatch.observe(words, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  FILES.riserSynth = 'sounds/riser-synth.mp3';
  var RISER = 1;                 // overall riser volume: 0 = off, 0.6 = quieter, 1.5 = louder
  var RISER_BASE = 0.8;          // base level of the recording (tuned by measurement)
  var SPAN = 4.8;                // seconds of the recording the whole road scrubs through
  var GRAIN = 0.14, HOP = 0.035; // tiny overlapping slices of the recording, 35 ms apart

  var storyEl = document.querySelector('.story');
  var rP = 0, rLastP = 0, rLastT = 0, rSpeed = 0, rLastScroll = 0, rTimer = 0, rRaf = 0;

  function roadProgress() {      // 0 to 1, read from the road roadmap.js draws
    var drawn = document.querySelector('.road .drawn');
    if (!drawn) return 0;
    var total = parseFloat(drawn.style.strokeDasharray);
    if (!total) return 0;
    return Math.max(0, Math.min(1, 1 - (parseFloat(drawn.style.strokeDashoffset) || 0) / total));
  }

  function riserScroll() {
    rRaf = 0;
    var now = performance.now();
    var visible = storyEl && storyEl.offsetHeight > 0;      // About page is showing
    var p = visible ? roadProgress() : 0;
    var dt = (now - rLastT) / 1000;
    if (rLastT && dt > 0 && dt < 0.5) {
      var v = Math.abs(p - rLastP) / dt;                    // road lengths per second
      rSpeed = rSpeed * 0.6 + Math.min(1, v / 0.5) * 0.4;   // 0 = still, 1 = fast scrolling
    }
    var moved = Math.abs(p - rLastP) > 0.0001;
    rP = p; rLastP = p; rLastT = now;
    if (moved) rLastScroll = now;                           // only counts when the road actually moved
    if (!rTimer) rTimer = setInterval(riserGrain, HOP * 1000);
  }

  function riserGrain() {
    var now = performance.now();
    if (now - rLastScroll > 80) rSpeed *= 0.8;              // fade out when you stop
    if (rSpeed < 0.02 && now - rLastScroll > 400) { clearInterval(rTimer); rTimer = 0; return; }
    var buf = buffers.riserSynth;
    if (!on || !ctx || ctx.state !== 'running' || document.hidden || !buf) return;
    if (!storyEl || !storyEl.offsetHeight || rP < 0.003 || rP > 0.997) return;

    var rate = (0.85 + 0.3 * rP) * (1 + 0.22 * rSpeed);     // pitch: rises along the road, bends up with speed
    var gain = RISER * RISER_BASE * (0.25 + 0.75 * rSpeed) * (0.6 + 0.4 * rP) * 0.5;   // volume follows speed
    var pos = Math.max(0, Math.min(buf.duration - GRAIN * rate - 0.05, rP * SPAN + (Math.random() - 0.5) * 0.02));

    var t0 = ctx.currentTime + 0.01;
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + GRAIN / 2);
    g.gain.linearRampToValueAtTime(0, t0 + GRAIN);
    src.connect(g); g.connect(master);
    src.start(t0, pos);
    src.stop(t0 + GRAIN + 0.03);
  }

  addEventListener('scroll', function () {
    if (!rRaf) rRaf = requestAnimationFrame(riserScroll);
  }, { passive: true });

  var hint = null;
  var hintCss = document.createElement('style');
  hintCss.textContent =
    '.sound-hint{position:fixed;z-index:30;pointer-events:none;color:var(--accent);opacity:0;transition:opacity .45s}' +
    '.sound-hint.show{opacity:1}' +
    '.sound-hint svg{display:block;overflow:visible;animation:hintBob 2.4s 1.6s ease-in-out infinite}' +
    '.sound-hint .draw{stroke-dasharray:1;stroke-dashoffset:1;animation:hintDraw .9s .25s cubic-bezier(.4,0,.2,1) forwards}' +
    '.sound-hint .head{stroke-dasharray:1;stroke-dashoffset:1;animation:hintDraw .3s 1s ease-out forwards}' +
    '.sound-hint text{opacity:0;animation:hintText .5s .8s forwards}' +
    '@keyframes hintDraw{to{stroke-dashoffset:0}}@keyframes hintText{to{opacity:1}}' +
    '@keyframes hintBob{50%{transform:translateY(4px)}}' +
    '@media (prefers-reduced-motion:reduce){.sound-hint svg{animation:none}' +
    '.sound-hint .draw,.sound-hint .head{animation:none;stroke-dashoffset:0}.sound-hint text{animation:none;opacity:1}}';
  document.head.appendChild(hintCss);

  function hideHint() {
    var h = hint; hint = null;
    h.classList.remove('show');
    setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 500);
  }

  function placeHint() {
    var r = btn.getBoundingClientRect();
    hint.style.left = Math.max(8, r.left + r.width / 2 - 162) + 'px';
    hint.style.top = (r.bottom + 2) + 'px';
  }

  function showHint() {
    if (on || hint) return;
    hint = document.createElement('div');
    hint.className = 'sound-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML =
      '<svg viewBox="0 0 220 130" width="220" height="130">' +
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="draw" pathLength="1" stroke-width="3" d="M60 92 C 70 56, 118 64, 160 12"/>' +
      '<path class="draw" pathLength="1" stroke-width="1.6" opacity=".45" d="M62 94 C 74 60, 121 68, 161 14"/>' +
      '<path class="head" pathLength="1" stroke-width="3" d="M147 14 L162 8 L160 24"/>' +
      '</g>' +
      '<text x="4" y="118" fill="currentColor" font-size="30" font-weight="600" transform="rotate(-3 4 118)" ' +
      'style="font-family:Caveat,\'Bradley Hand\',\'Segoe Print\',\'Comic Sans MS\',cursive">turn on the sound</text>' +
      '</svg>';
    document.body.appendChild(hint);
    placeHint();
    requestAnimationFrame(function () { if (hint) hint.classList.add('show'); });
  }

  document.addEventListener('click', hideHint, true);
  addEventListener('resize', placeHint);
  addEventListener('scroll', placeHint, { passive: true });
  setTimeout(showHint, 1500);

  setup();
})();