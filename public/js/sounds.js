(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var DEFAULT_ON = true;                      // set to false to start muted
  var STORE = 'sound';

  // Recorded CC0 sounds (see sounds/CREDITS.txt) and their volumes (0 to 1)
  var FILES = { click: 'sounds/click.mp3', tick: 'sounds/tick.mp3', pop: 'sounds/pop.mp3',
                whoosh: 'sounds/whoosh.mp3', impact: 'sounds/impact.mp3' };
  var VOL = { click: 0.5, tick: 0.12, pop: 0.22, whoosh: 0.3, impact: 0.35 };

  var on = DEFAULT_ON;
  try { var s = localStorage.getItem(STORE); if (s === 'on') on = true; if (s === 'off') on = false; } catch (e) {}

  var ctx, master, buffers = {}, lastPlayed = {}, quietUntil = 0;

  /* ---------- audio engine ---------- */
  function decode(data) {
    return new Promise(function (res, rej) { var p = ctx.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
  }

  function load() {
    Object.keys(FILES).forEach(function (name) {
      fetch(FILES[name]).then(function (r) { return r.arrayBuffer(); })
        .then(decode).then(function (b) { buffers[name] = b; }).catch(function () {});
    });
  }

  function unlock() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      load();
    }
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
    try { localStorage.setItem(STORE, on ? 'on' : 'off'); } catch (e) {}
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

  /* ---------- presses: click on press (keyboard: on activate) ---------- */
  var PRESS = 'nav a, .btn, #sound';

  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest(PRESS);
    if (el && el.id !== 'sound') play('click', { rate: jitter(1, 0.04) });
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(PRESS);
    if (el && e.detail === 0 && el.id !== 'sound') play('click');          // keyboard activation
    if (e.target.closest && e.target.closest('#theme')) {                   // light/dark switch: the "flash"
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      play('impact', { rate: dark ? 0.85 : 1.1 });
    }
  });

  /* ---------- page change: whoosh ---------- */
  addEventListener('hashchange', function () {
    quietUntil = performance.now() + 450;                                   // keep reveal pops from stacking on it
    play('whoosh', { rate: jitter(1, 0.05) });
  });

  /* ---------- scroll reveals: pop as each block fades in ---------- */
  var revealWatch = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
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
})();
