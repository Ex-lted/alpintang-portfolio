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
  var MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  var reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;                        // reduced motion: one still frame, no pointer or click effects
  var STATIC_MS = 4000;                                 // the moment of the wave field that is frozen as the still frame
  var CW, CH, FONT, W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
  var mask = null;                                      // per-cell 0.25..1: quiet behind the text and the art, full strength elsewhere
  var mouse = { x: -99, y: -99, sx: -99, sy: -99, target: 0, s: 0 };
  var ripples = [], onScreen = true, last = 0, raf = 0;

  // ---------- The ASCII art (pre-rendered once, then blitted every frame) ----------
  var ART_RAW = [
    '                                            ---===-===--=------                                     ',
    '                                         ----======-------====----                                  ',
    '                                       ---=-==--==-----------===----                                ',
    '                                     ----=-==--=--------------======--                              ',
    '                                    ----=---------------------=======-                              ',
    '                                   --------------------=-==--=--=-==---                             ',
    '                                  --------------:::---=--=====-----==---                            ',
    '                                  ---------:-:--::---=------------==----                            ',
    '                                  -------:::::------=------------=------                            ',
    '                                --::-:: --:::::: .:-:-===---------------                            ',
    '                                 : .:.. .:.  .::...::::::--==-----------                            ',
    '                                        .   .   .  .      :--==----::--                             ',
    '                                       .                   .-====-:..-                              ',
    '                                                           :---=--..--                              ',
    '                                       ...::.              .-..... ---                              ',
    '                                                            .:  .--=-                               ',
    '                                                            .:-==--                                 ',
    '                                                 .        ...:===-                                  ',
    '                                          :---:      ...::...-==-                                   ',
    '                                          :-:..   .::........--                                     ',
    '                                           ....  ::........                                         ',
    '                                                :..       .                                         ',
    '                                               ::..  ..  .   --                                     ',
    '                             -----            .::::....       ------                                ',
    '                        ---------         .    ......        :-------------                         ',
    '                     -----------.        :--     .....      :------------------                     ',
    '                   -------------.       .-----     ...    .----------------------                   ',
    '                  --------------.       ---------       :-------------------------:                 ',
    '                 --------------=       .------------- -----------------------------                 ',
    '                 -------------..       ---------------------------------------------                ',
    '                 ------------:.         -------------------------------------=-------               ',
    '                 ------------..:      ..------------------------------------=--------               ',
    '                 -----------------------------------------------------------=--------               ',
    '                 -----------------------=-----------------------------------=---------              ',
    '                 -----------------------===--------------------------------=--=-------              ',
    '                 -----------------------====------=------------------------=-=---------             ',
    '                 ----------------------=---=------=------------------------=-=---------             ',
    '                -----------------------==---------=------------------------==---=------             ',
    '                -----------------------===--------------------------------==---=--------            ',
    '                ------------------------===-------=-----------------------===--=--------=           ',
    '                ------------------------====------==----------------------==--==---------           ',
    '               -------------------------=====-----=----------------------===-==----------           ',
    '               ---==---------------------======--------------------------======-----------          ',
    '               --------------------------======--------------------------=====------------          ',
    '               --------------------------========-----------------------=====--------------         ',
    '               -------------------------==========------------------------==---------------         ',
    '               ------------------------=============--------------------====-------======---        ',
    '                ----------------------===--=--=======----------------=--=====-===-------===--       ',
    '                 ---------------------===--------=====-----------------========-------------        ',
    '                 =------------------======----------=====--------------===========----------        ',
    '                  -----------------==-====-------------====-----------========-------------         ',
    '                   ---------------==-=====----------------===-------====---=====----==-----         ',
    '                    -------------=--=====-------------------------=====----==--------------         ',
    '                      ------------=======-----------------------====------=----------------         ',
    '                      -===----===========-------------------=====------===----------------'
  ];
  // trim the shared left indent so the art hugs its own bounding box
  var indent = 1e9, ART_W = 0, ART = [], ai;
  for (ai = 0; ai < ART_RAW.length; ai++) {
    var ln = ART_RAW[ai];
    if (!ln.trim()) continue;
    indent = Math.min(indent, ln.length - ln.replace(/^ +/, '').length);
  }
  for (ai = 0; ai < ART_RAW.length; ai++) {
    var tl = ART_RAW[ai].slice(indent).replace(/\s+$/, '');
    ART.push(tl);
    ART_W = Math.max(ART_W, tl.length);
  }
  var CHAR_A = { '=': 1, '-': 0.78, ':': 0.55, '.': 0.4 };   // denser glyphs read brighter
  var tmp = document.createElement('canvas'), tx = tmp.getContext('2d');   // scratch layer so ripples can cut through the art
  var art = { x: 0, y: 0, w: 0, h: 0, fs: 0, lh: 0, cw: 0, pad: 0, sharp: null, glow: null, hot: null };

  var dark = matchMedia('(prefers-color-scheme: dark)');
  function isLight() {                                  // same rule the theme toggle uses
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'light' : !dark.matches;
  }
  function applyTheme() {
    hero.classList.toggle('ascii-light', isLight());
    buildArt();                                         // art colours depend on the theme
    if (reduce) draw(STATIC_MS);
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (dark.addEventListener) dark.addEventListener('change', applyTheme);

  function smooth(a, b, x) {
    var k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  }

  // Target box for the art, as fractions of the hero (x0, y0, x1, y1). Tweak these to move or resize it.
  var BOX = { x0: 0.44, y0: 0.10, x1: 0.97, y1: 0.99 };
  function layoutArt() {
    var small = W < 760;
    var bx = BOX.x0 * W, by = BOX.y0 * H, bw = (BOX.x1 - BOX.x0) * W, bh = (BOX.y1 - BOX.y0) * H;
    if (small) { bx = W * 0.15; bw = W * 0.8; by = H * 0.5; bh = H * 0.47; }
    var fs = Math.min(bh / ART.length, bw / (ART_W * 0.6));      // fit inside the box, keep the aspect
    art.fs = Math.max(4, fs);
    art.lh = art.fs;
    art.cw = art.fs * 0.6;
    art.w = Math.ceil(ART_W * art.cw);
    art.h = Math.ceil(ART.length * art.lh);
    art.pad = Math.ceil(art.fs * 3);                    // room for the glow to bleed
    art.x = bx + (bw - art.w) / 2;                      // centred in the box
    art.y = by + (bh - art.h);                          // sat on the bottom of the box
  }

  // Build the text-safe mask from where the hero copy actually sits, so the
  // background can run at full contrast everywhere else. The art's area is quieted too.
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
    var AFALL = 70;                                     // px feather around the art
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var m = 1;
        var px = c * CW + CW / 2, py = r * CH + CH / 2;
        if (any) {
          var dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
          m = 0.25 + 0.75 * smooth(0, FALL, Math.hypot(dx, dy));
        } else if (W >= 760) {
          m = 0.5 + 0.5 * Math.min(1, Math.max(0, (c / cols - 0.1) / 0.5));
        } else m = 0.6;
        mask[r * cols + c] = m;
      }
    }
  }

  // Pre-render the art into three offscreen layers: sharp glyphs, a blurred glow, and a bright "hot" copy for ripples.
  function mk(wpx, hpx) {
    var c = document.createElement('canvas');
    c.width = Math.round(wpx * dpr); c.height = Math.round(hpx * dpr);
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.textBaseline = 'top';
    x.font = '600 ' + art.fs + 'px ' + MONO;
    return { c: c, x: x };
  }
  function paintArt(x, rgb, alphaScale, shadow, passes) {
    for (var p = 0; p < passes; p++) {
      if (shadow) { x.shadowColor = 'rgba(' + shadow.rgb + ',' + shadow.a + ')'; x.shadowBlur = shadow.blur; }
      for (var r = 0; r < ART.length; r++) {
        var row = ART[r];
        for (var c = 0; c < row.length; c++) {
          var ch = row.charAt(c), a = CHAR_A[ch];
          if (!a) continue;
          x.fillStyle = 'rgba(' + rgb + ',' + Math.min(1, a * alphaScale).toFixed(3) + ')';
          x.fillText(ch, art.pad + c * art.cw, art.pad + r * art.lh);
        }
      }
    }
    x.shadowBlur = 0; x.shadowColor = 'transparent';
  }
  function buildArt() {
    if (!W || !H) return;
    var light = isLight();
    var tw = art.w + art.pad * 2, th = art.h + art.pad * 2;
    var glowRGB = light ? ACCENT_L : ACCENT;
    var main = light ? INK : WHITE;

    var s = mk(tw, th);                                 // crisp glyphs with a tight halo
    paintArt(s.x, main, light ? 0.92 : 0.85, { rgb: glowRGB, a: 0.55, blur: art.fs * 0.9 }, 1);

    var gl = mk(tw, th);                                // wide soft bloom, stacked passes for strength
    paintArt(gl.x, glowRGB, 1, { rgb: glowRGB, a: 0.9, blur: art.fs * 2.6 }, 2);

    var ht = mk(tw, th);                                // ripple highlight copy
    paintArt(ht.x, glowRGB, 1, { rgb: glowRGB, a: 1, blur: art.fs * 1.4 }, 1);

    art.sharp = s.c; art.glow = gl.c; art.hot = ht.c;
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
    tmp.width = cv.width; tmp.height = cv.height;
    layoutArt();
    buildMask();
    buildArt();
    if (reduce) draw(STATIC_MS);
  }

  function field(c, r, t) {                             // slow drifting waves, 0 to 1
    var v = Math.sin(c * 0.11 + t * 0.7) + Math.sin(r * 0.16 - t * 0.55) +
            Math.sin((c * 0.7 + r) * 0.08 + t * 0.4) +
            Math.sin(Math.hypot(c - cols * 0.7, r - rows * 0.4) * 0.14 - t * 0.9);
    return (v / 4 + 1) / 2;
  }

  // Ring-shaped path for a ripple (same ellipse maths as the wave field: y is squashed by 1.8).
  function ringPath(c, rp, age) {
    var R = age * 34, ro = R + 4, ri = Math.max(0, R - 4);
    var cx = rp.x * CW, cy = rp.y * CH;
    c.beginPath();
    c.ellipse(cx, cy, ro * CW, (ro / 1.8) * CH, 0, 0, Math.PI * 2);
    if (ri > 0) c.ellipse(cx, cy, ri * CW, (ri / 1.8) * CH, 0, 0, Math.PI * 2);
    return { cx: cx, cy: cy };
  }

  // Draw the art: gentle float, slow glow pulse. Ripples punch a hole in it where the ring passes,
  // so the wave field shows through, and a bright, slightly magnified copy of the art rides the ring.
  function drawArt(now, t, cuts) {
    if (!art.sharp) return;
    var light = hero.classList.contains('ascii-light');
    var base = W < 760 ? 0.6 : 1;                       // keep it behind the copy on phones
    var fx = reduce ? 0 : Math.sin(t * 0.45) * 2.5;     // tiny sway
    var fy = reduce ? 0 : Math.sin(t * 0.7) * 5;        // slow bob
    var pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9);   // 0..1
    var x = art.x - art.pad + fx, y = art.y - art.pad + fy;
    var tw = art.w + art.pad * 2, th = art.h + art.pad * 2;
    var rgb = light ? ACCENT_L : ACCENT;

    // soft light pool behind the art
    var cx = art.x + art.w / 2 + fx, cy = art.y + art.h / 2 + fy, rad = Math.max(art.w, art.h) * 0.62;
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    var pa = (light ? 0.16 : 0.10) + pulse * (light ? 0.10 : 0.08);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + (pa * base).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);

    var live = !reduce && ripples.length > 0;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.clearRect(0, 0, tmp.width, tmp.height);
    tx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var c = tx;
    c.globalAlpha = (0.35 + pulse * 0.4) * base;        // breathing bloom
    c.drawImage(art.glow, x, y, tw, th);
    c.globalAlpha = base;
    c.drawImage(art.sharp, x, y, tw, th);
    c.globalAlpha = 1;

    // the background wave field breaks through: wherever it is strong, its cell is carved out of the art
    tx.globalCompositeOperation = 'destination-out';
    for (var q = 0; q < cuts.length; q++) {
      tx.globalAlpha = Math.min(1, cuts[q][2] * 1.8);
      tx.fillRect(cuts[q][0], cuts[q][1], CW, CH);
    }
    tx.globalCompositeOperation = 'source-over';
    tx.globalAlpha = 1;
    if (!live) { g.drawImage(tmp, 0, 0, W, H); return; }

    var i, rp, age, fade;
    tx.globalCompositeOperation = 'destination-out';    // cut the ring out of the art
    for (i = 0; i < ripples.length; i++) {
      rp = ripples[i]; age = (now - rp.t0) / 1000;
      fade = Math.max(0, 1 - age / 1.8);
      ringPath(tx, rp, age);
      tx.globalAlpha = Math.min(1, fade * 1.1);
      tx.fill('evenodd');
    }
    tx.globalCompositeOperation = 'source-over';
    tx.globalAlpha = 1;
    g.drawImage(tmp, 0, 0, W, H);

    var acx = art.x + art.w / 2, acy = art.y + art.h / 2;
    for (i = 0; i < ripples.length; i++) {              // bright, shoved-outward art riding the ring
      rp = ripples[i]; age = (now - rp.t0) / 1000;
      fade = Math.max(0, 1 - age / 1.8);
      g.save();
      var o = ringPath(g, rp, age);
      g.clip('evenodd');
      var vx = acx - o.cx, vy = acy - o.cy, vl = Math.hypot(vx, vy) || 1;
      g.globalAlpha = fade * 0.95 * base;
      g.translate(o.cx + (vx / vl) * 9 * fade, o.cy + (vy / vl) * 9 * fade);   // shockwave shove
      g.scale(1.05, 1.05); g.translate(-o.cx, -o.cy);
      g.drawImage(art.hot, x, y, tw, th);
      g.restore();
    }

    // the ripple itself, drawn OVER the art: dense bright glyphs along the ring so it visibly punches through
    g.font = '700 ' + FONT + 'px ' + MONO;
    var r0 = Math.max(0, Math.floor((art.y - 40) / CH)), r1 = Math.min(rows - 1, Math.ceil((art.y + art.h + 40) / CH));
    var c0 = Math.max(0, Math.floor((art.x - 40) / CW)), c1 = Math.min(cols - 1, Math.ceil((art.x + art.w + 40) / CW));
    var ring = light ? ACCENT_L : '225,245,195';
    for (i = 0; i < ripples.length; i++) {
      rp = ripples[i]; age = (now - rp.t0) / 1000;
      fade = Math.max(0, 1 - age / 1.8);
      var R = age * 34;
      for (var rr = r0; rr <= r1; rr++) {
        for (var cc = c0; cc <= c1; cc++) {
          var dd = Math.abs(Math.hypot(cc - rp.x, (rr - rp.y) * 1.8) - R);
          var k = fade * Math.max(0, 1 - dd / 4);
          if (k < 0.15) continue;
          g.fillStyle = 'rgba(' + ring + ',' + Math.min(1, k * 1.3).toFixed(3) + ')';
          g.fillText(RAMP.charAt(Math.min(9, 5 + Math.floor(k * 5))), cc * CW, rr * CH);
        }
      }
    }
    g.globalAlpha = 1;
  }

  function draw(now) {
    if (!W || !H) return;
    var t = now / 1000;
    mouse.sx += (mouse.x - mouse.sx) * 0.18;
    mouse.sy += (mouse.y - mouse.sy) * 0.18;
    mouse.s += (mouse.target - mouse.s) * 0.08;
    ripples = ripples.filter(function (rp) { return now - rp.t0 < 1800; });

    var white = [], accent = [], cuts = [], i;
    for (i = 0; i < 6; i++) { white.push([]); accent.push([]); }
    var ax0 = art.x - 12, ax1 = art.x + art.w + 12, ay0 = art.y - 14, ay1 = art.y + art.h + 14;

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
        if (c * CW > ax0 && c * CW < ax1 && r * CH > ay0 && r * CH < ay1) cuts.push([c * CW, r * CH, v]);
        if (boost > 0.15) accent[Math.min(5, Math.floor(v * 6))].push(item);
        else white[Math.min(5, Math.floor(v * 6))].push(item);
      }
    }

    g.clearRect(0, 0, W, H);
    var light = hero.classList.contains('ascii-light');
    if (light) glow(t);
    drawArt(now, t, cuts);                              // art first; the wave glyphs are then painted over it
    g.font = (light ? '600 ' : '500 ') + FONT + 'px ' + MONO;
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

  // ---------- Click sound: your recorded "pop" via sound.js, so the mute button controls it ----------
  // Pitch follows where you click: left of the hero is low, right is high, on a
  // pentatonic scale so rapid clicks stay pleasant instead of clashing.
  var SCALE = [0, 2, 4, 7, 9, 12];                      // major pentatonic, semitones
  function ping(x01) {
    if (!window.siteSound) return;                      // sound.js not loaded (yet)
    var step = SCALE[Math.min(SCALE.length - 1, Math.floor(Math.max(0, Math.min(0.999, x01)) * SCALE.length))];
    window.siteSound.play('pop', { rate: 0.8 * Math.pow(2, step / 12), gap: 0.06 });
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
    if (reduce) return;                                 // still frame: the cursor does nothing
    var p = pointer(e);
    if (!p) { mouse.target = 0; return; }
    mouse.x = p.x; mouse.y = p.y; mouse.target = 1;
    if (mouse.sx < -50) { mouse.sx = p.x; mouse.sy = p.y; }          // first move: start at the cursor
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { mouse.target = 0; });
  addEventListener('pointerdown', function (e) {
    if (reduce) return;                                 // still frame: no ripple, no click sound
    var p = pointer(e);
    if (!p) return;
    ripples.push({ x: p.x, y: p.y, t0: performance.now() });
    if (ripples.length > 6) ripples.shift();
    ping(p.x / cols);
  }, { passive: true });

  if (window.IntersectionObserver) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  if (window.ResizeObserver) new ResizeObserver(size).observe(hero); else addEventListener('resize', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);   // re-measure the copy once web fonts land
  hero.classList.toggle('ascii-light', isLight());       // set before the first frame so there's no flash
  size();
  if (!reduce) raf = requestAnimationFrame(frame);

  // If the setting is switched while the page is open, follow it without a reload
  function onReduceChange() {
    reduce = reduceMQ.matches;
    if (reduce) {
      cancelAnimationFrame(raf); raf = 0;
      ripples = []; mouse.target = 0; mouse.s = 0;
      draw(STATIC_MS);
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onReduceChange);
  else if (reduceMQ.addListener) reduceMQ.addListener(onReduceChange);
})();