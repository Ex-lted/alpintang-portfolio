// About page: turns the "My story" timeline into a winding roadmap.
// A road is drawn as you scroll, and each stop (with its card) appears when the road reaches it.
(function () {
  var story = document.querySelector('.story');
  if (!story) return;
  var steps = [].slice.call(story.querySelectorAll('.step'));
  if (!steps.length) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WIDE_AT = 700;      // story width (px) where cards switch to the left/right layout
  var SWING = 64;         // how far the road swings left/right of centre on wide screens
  var TARGET = 0.62;      // road reaches this height of the screen (0 = top, 1 = bottom)

  story.classList.add('roadmap');
  if (reduce) story.classList.add('static');
  steps.forEach(function (s, i) {
    s.classList.remove('rv', 'in');                  // this section handles its own reveal
    s.classList.add(i % 2 ? 'right' : 'left');
  });

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- build the SVG once ---------- */
  var svg = mk('svg', { 'class': 'road', 'aria-hidden': 'true' });
  var defs = mk('defs', {}, svg);
  var grad = mk('linearGradient', { id: 'roadGrad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  mk('stop', { offset: '0', style: 'stop-color:var(--accent-2, var(--accent))' }, grad);
  mk('stop', { offset: '1', style: 'stop-color:var(--accent)' }, grad);

  var bed = mk('path', { 'class': 'bed' }, svg);
  var drawn = mk('path', { 'class': 'drawn', stroke: 'url(#roadGrad)' }, svg);

  var stops = steps.map(function (s, i) {
    var g = mk('g', { 'class': 'stop' + (i === steps.length - 1 ? ' last' : '') }, svg);
    mk('line', { 'class': 'branch' }, g);
    mk('circle', { 'class': 'halo', r: 17 }, g);
    var pip = mk('g', { 'class': 'pip' }, g);
    mk('circle', { 'class': 'ring', r: 17 }, pip);
    mk('circle', { 'class': 'dot', r: 11 }, pip);
    var t = mk('text', { 'class': 'num' }, pip);
    t.textContent = String(i + 1);
    return g;
  });

  var head = mk('g', { 'class': 'head', style: 'opacity:0' }, svg);
  mk('circle', { 'class': 'head-ring', r: 7 }, head);
  mk('circle', { 'class': 'head-dot', r: 7 }, head);

  story.insertBefore(svg, story.firstChild);

  /* ---------- layout: measure cards, build the road ---------- */
  var ready = false, total = 0, ys = [], lens = [], stopLen = [], revealed = [];

  function layout() {
    var W = story.clientWidth, H = story.offsetHeight;
    if (!W || !H) { ready = false; return; }       // About page is hidden right now
    var wide = W >= WIDE_AT;
    var sr = story.getBoundingClientRect();

    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    grad.setAttribute('y2', H);

    var pts = steps.map(function (s, i) {
      var label = s.querySelector('small') || s;
      var r = label.getBoundingClientRect();
      return {
        y: r.top - sr.top + r.height / 2,
        x: wide ? W / 2 + (i % 2 ? SWING : -SWING) : (i % 2 ? 40 : 22),
        dir: wide ? (i % 2 ? 1 : -1) : 1,          // which side the card is on
        tick: wide ? 44 : 0                         // no side line on phones (cards sit right next to the road)
      };
    });

    var first = pts[0], last = pts[pts.length - 1];
    var start = { x: first.x, y: Math.max(0, first.y - 110) };
    var end = { x: wide ? W / 2 : 30, y: Math.min(H, last.y + 150) };

    var d = 'M' + start.x + ' ' + start.y, prev = start;
    pts.concat([end]).forEach(function (p) {
      var dy = (p.y - prev.y) * 0.55;
      d += ' C' + prev.x + ' ' + (prev.y + dy) + ' ' + p.x + ' ' + (p.y - dy) + ' ' + p.x + ' ' + p.y;
      prev = p;
    });
    bed.setAttribute('d', d);
    drawn.setAttribute('d', d);

    total = drawn.getTotalLength();
    drawn.style.strokeDasharray = total + ' ' + total;

    // sample the road so a screen height can be turned into a distance along it
    var n = Math.max(20, Math.ceil(total / 3));
    ys = []; lens = [];
    for (var i = 0; i <= n; i++) {
      var len = total * i / n;
      lens.push(len);
      ys.push(drawn.getPointAtLength(len).y);
    }

    pts.forEach(function (p, i) {
      stops[i].setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')');
      var line = stops[i].querySelector('.branch');
      line.setAttribute('x1', p.dir * 22);  line.setAttribute('y1', 0);
      line.setAttribute('x2', p.dir * (22 + p.tick));  line.setAttribute('y2', 0);
      line.style.display = p.tick ? '' : 'none';
      stopLen[i] = lenAtY(p.y);
    });

    ready = true;
    update();
  }

  function lenAtY(y) {                                   // ys only ever increases
    if (y <= ys[0]) return 0;
    if (y >= ys[ys.length - 1]) return total;
    var lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (ys[mid] <= y) lo = mid; else hi = mid; }
    var f = (y - ys[lo]) / ((ys[hi] - ys[lo]) || 1);
    return lens[lo] + f * (lens[hi] - lens[lo]);
  }

  /* ---------- scroll: draw the road, reveal stops one by one ---------- */
  function reveal(i) {
    if (revealed[i]) return;
    revealed[i] = true;
    steps[i].classList.add('on');
    stops[i].classList.add('on');
    document.dispatchEvent(new CustomEvent('story-step', { detail: i }));
  }

  function update() {
    if (!ready) return;
    var sr = story.getBoundingClientRect();
    if (!sr.height) return;
    var L = reduce ? total : Math.max(0, Math.min(total, lenAtY(innerHeight * TARGET - sr.top)));

    drawn.style.strokeDashoffset = total - L;

    if (L > 1) {
      var p = drawn.getPointAtLength(L);
      head.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')');
      head.style.opacity = (reduce || L >= total - 1) ? 0 : 1;
    } else {
      head.style.opacity = 0;
    }

    for (var i = 0; i < steps.length; i++) {
      if (reduce || L >= stopLen[i] - 4) reveal(i);
    }
  }

  var ticking = false;
  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);

  // Re-measure when the page is shown, the window changes size, or fonts finish loading
  if (window.ResizeObserver) new ResizeObserver(layout).observe(story);
  else addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
})();
