(function () {
  var hero = document.getElementById('hero');
  if (!hero) return;
  hero.classList.remove('bg-me');                       // no more cover photo

  var style = document.createElement('style');
  style.textContent =
    '.ascii-bg{position:absolute;inset:0;width:100%;height:100%;z-index:-1;display:block;pointer-events:none}' +
    '#hero{transition:background-color .5s ease}' +
    '#hero.ascii-light{background-color:var(--bg);color:var(--fg)}' +
    '#hero.ascii-light::before{background:none}' +
    '#hero.ascii-light h1{color:var(--fg)}' +
    '#hero.ascii-light .eyebrow{color:var(--accent);opacity:1}' +
    '#hero.ascii-light .sub,#hero.ascii-light .cue{color:var(--mute)}';
  document.head.appendChild(style);

  var cv = document.createElement('canvas');
  cv.className = 'ascii-bg';
  cv.setAttribute('aria-hidden', 'true');
  hero.insertBefore(cv, hero.firstChild);
  var g = cv.getContext('2d');

  var RAMP = ' .:-=+*#%@';
  var ACCENT = '168,198,134';                           // matcha (dark mode)
  var WHITE = '255,255,255';
  var INK = '29,29,31', ACCENT_L = '82,112,46';          // light mode: dark ink and a deeper matcha
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CW, CH, FONT, W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
  var mask = null;                                      // per-cell 0.25..1: quiet behind the text, full strength elsewhere
  var mouse = { x: -99, y: -99, sx: -99, sy: -99, target: 0, s: 0 };
  var ripples = [], onScreen = true, last = 0, raf = 0;

  var dark = matchMedia('(prefers-color-scheme: dark)');
  function isLight() {                                  // same rule the theme toggle uses
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'light' : !dark.matches;
  }
  function applyTheme() {
    hero.classList.toggle('ascii-light', isLight());
    if (reduce) draw(performance.now());
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (dark.addEventListener) dark.addEventListener('change', applyTheme);

  function smooth(a, b, x) {
    var k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  }

  // Build the text-safe mask from where the hero copy actually sits, so the
  // background can run at full contrast everywhere else.
  function buildMask() {
    mask = new Float32Array(cols * rows);
    var hr = hero.getBoundingClientRect();
    var els = hero.querySelectorAll('.eyebrow,h1,.sub,.cue');
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    for (var i = 0; i < els.length; i++) {
      var rg = document.createRange();
      rg.selectNodeContents(els[i]);                    // text extent, not the block width
      var b = rg.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      any = true;
      x0 = Math.min(x0, b.left - hr.left); y0 = Math.min(y0, b.top - hr.top);
      x1 = Math.max(x1, b.right - hr.left); y1 = Math.max(y1, b.bottom - hr.top);
    }
    var FALL = 140;                                     // px feather around the copy
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var m = 1;
        if (any) {
          var px = c * CW + CW / 2, py = r * CH + CH / 2;
          var dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
          m = 0.25 + 0.75 * smooth(0, FALL, Math.hypot(dx, dy));
        } else if (W >= 760) {
          m = 0.5 + 0.5 * Math.min(1, Math.max(0, (c / cols - 0.1) / 0.5));
        } else m = 0.6;
        mask[r * cols + c] = m;
      }
    }
  }

  function size() {
    var small = innerWidth < 600;
    CW = small ? 8 : 10; CH = small ? 15 : 18; FONT = small ? 12 : 14;
    W = hero.offsetWidth; H = hero.offsetHeight;
    if (!W || !H) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textBaseline = 'top';
    buildMask();
    if (reduce) draw(performance.now());
  }

  function field(c, r, t) {                             // slow drifting waves, 0 to 1
    var v = Math.sin(c * 0.11 + t * 0.7) + Math.sin(r * 0.16 - t * 0.55) +
            Math.sin((c * 0.7 + r) * 0.08 + t * 0.4) +
            Math.sin(Math.hypot(c - cols * 0.7, r - rows * 0.4) * 0.14 - t * 0.9);
    return (v / 4 + 1) / 2;
  }

  function draw(now) {
    if (!W || !H) return;
    var t = now / 1000;
    mouse.sx += (mouse.x - mouse.sx) * 0.18;
    mouse.sy += (mouse.y - mouse.sy) * 0.18;
    mouse.s += (mouse.target - mouse.s) * 0.08;
    ripples = ripples.filter(function (rp) { return now - rp.t0 < 1800; });

    var white = [], accent = [], i;
    for (i = 0; i < 6; i++) { white.push([]); accent.push([]); }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // contrast curve: the field sits near 0.5, so stretch it into clear ridges
        // and empty gaps instead of one even haze of dots
        var base = smooth(0.32, 0.88, field(c, r, t));
        var level = base * 0.92 * mask[r * cols + c];
        var boost = 0;
        if (mouse.s > 0.01) {
          var d = Math.hypot(c - mouse.sx, (r - mouse.sy) * 1.8);
          boost += mouse.s * Math.pow(Math.max(0, 1 - d / 12), 2);
        }
        for (i = 0; i < ripples.length; i++) {
          var rp = ripples[i], age = (now - rp.t0) / 1000;
          var dd = Math.abs(Math.hypot(c - rp.x, (r - rp.y) * 1.8) - age * 34);
          boost += (1 - age / 1.8) * Math.max(0, 1 - dd / 3.5);
        }
        var v = Math.min(1, level + boost);
        var idx = Math.floor(v * (RAMP.length - 1));
        if (idx < 2) continue;                          // drop the faint '.' specks: more clean space, sharper shapes
        var item = [RAMP.charAt(idx), c * CW, r * CH];
        if (boost > 0.15) accent[Math.min(5, Math.floor(v * 6))].push(item);
        else white[Math.min(5, Math.floor(v * 6))].push(item);
      }
    }

    g.clearRect(0, 0, W, H);
    var light = hero.classList.contains('ascii-light');
    if (light) glow(t);
    g.font = (light ? '600 ' : '500 ') + FONT + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
    for (i = 0; i < 6; i++) {
      var q = (i + 1) / 6;
      if (light) {
        paint(white[i], 'rgba(' + INK + ',' + (0.20 + q * 0.55).toFixed(3) + ')');
        paint(accent[i], 'rgba(' + ACCENT_L + ',' + (0.50 + q * 0.50).toFixed(3) + ')');
      } else {
        paint(white[i], 'rgba(' + WHITE + ',' + (0.16 + q * 0.62).toFixed(3) + ')');
        paint(accent[i], 'rgba(' + ACCENT + ',' + (0.50 + q * 0.50).toFixed(3) + ')');
      }
    }
  }

  // Light-mode version of the dark hero's glow: the same three soft light sources
  // (matcha top-left, warm top-centre, cool bottom-right) but as pastel tints on
  // the cream, so they read as daylight rather than light emitted from the dark.
  var GLOWS = [
    { x: 0.11, y: 0.30, r: 0.34, rgb: '115,138,110', a: 0.6, p: 0.00 },   // sage green
    { x: 0.62, y: 0.14, r: 0.30, rgb: '128,1,31', a: 0.5, p: 2.10 },   // burgundy
    { x: 0.91, y: 0.70, r: 0.34, rgb: '129,118,160', a: 0.6, p: 4.20 }    // purple
  ];
  function glow(t) {
    var span = Math.max(W, H * 1.6);
    for (var k = 0; k < GLOWS.length; k++) {
      var s = GLOWS[k];
      var x = (s.x + Math.sin(t * 0.12 + s.p) * 0.025) * W;      // slow breathing drift
      var y = (s.y + Math.cos(t * 0.10 + s.p) * 0.04) * H;
      var rad = s.r * span;
      var gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(' + s.rgb + ',' + s.a + ')');
      gr.addColorStop(0.45, 'rgba(' + s.rgb + ',' + (s.a * 0.45).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + s.rgb + ',0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
  }

  function paint(list, fill) {
    if (!list.length) return;
    g.fillStyle = fill;
    for (var k = 0; k < list.length; k++) g.fillText(list[k][0], list[k][1], list[k][2]);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;                        // about 30 fps is plenty
    last = now;
    if (!onScreen || document.hidden || !hero.offsetWidth) return;
    draw(now);
  }

  function pointer(e) {
    var rc = hero.getBoundingClientRect();
    if (!rc.width) return null;
    var x = (e.clientX - rc.left) * W / rc.width, y = (e.clientY - rc.top) * H / rc.height;
    if (x < 0 || y < 0 || x > W || y > H) return null;
    return { x: x / CW, y: y / CH };
  }

  addEventListener('pointermove', function (e) {
    var p = pointer(e);
    if (!p) { mouse.target = 0; return; }
    mouse.x = p.x; mouse.y = p.y; mouse.target = 1;
    if (mouse.sx < -50) { mouse.sx = p.x; mouse.sy = p.y; }          // first move: start at the cursor
    if (reduce) draw(performance.now());
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { mouse.target = 0; });
  addEventListener('pointerdown', function (e) {
    var p = pointer(e);
    if (!p) return;
    ripples.push({ x: p.x, y: p.y, t0: performance.now() });
    if (ripples.length > 6) ripples.shift();
  }, { passive: true });

  if (window.IntersectionObserver) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  if (window.ResizeObserver) new ResizeObserver(size).observe(hero); else addEventListener('resize', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);   // re-measure the copy once web fonts land
  hero.classList.toggle('ascii-light', isLight());       // set before the first frame so there's no flash
  size();
  if (!reduce) raf = requestAnimationFrame(frame);
})();