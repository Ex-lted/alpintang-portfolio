(function () {
  var pages = ['about', 'projects', 'contact'];
  var PATHS = { about: '/about', projects: '/projects', contact: '/contact' };
  var TITLES = { about: 'About - Alpin', projects: 'Projects - Alpin', contact: 'Contact - Alpin' };
  var canonEl = document.querySelector('link[rel="canonical"]');
  var SITE = canonEl ? canonEl.getAttribute('href').replace(/\/+$/, '') : '';
  var links = document.querySelectorAll('nav a');

  function swap(id) {
    pages.forEach(function (page) {
      document.getElementById(page).classList.toggle('active', page === id);
    });
    links.forEach(function (link) {
      link.classList.toggle('on', link.dataset.p === id);
    });
    document.querySelectorAll('.rv').forEach(function (element) {
      element.classList.remove('in');
      io.observe(element);
    });
    window.scrollTo(0, 0);
    upd();
  }

  var leaveT;

  function show() {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var id = 'about';
    pages.forEach(function (page) {
      if (PATHS[page] === path) id = page;
    });
    // old links like /#projects keep working
    var legacy = (location.hash || '').replace('#', '');
    if (path === '/' && pages.indexOf(legacy) >= 0) id = legacy;

    // normalise the address bar (trailing slash, #hash, unknown path)
    if ((location.pathname !== PATHS[id] || location.hash) && history.replaceState) {
      history.replaceState(null, '', PATHS[id] + location.search);
    }

    document.title = TITLES[id];
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', SITE + PATHS[id]);

    var currentPage = document.querySelector('.page.active');
    links.forEach(function (link) {
      link.classList.toggle('on', link.dataset.p === id);
    });
    clearTimeout(leaveT);

    if (currentPage && currentPage.id === id) {
      currentPage.classList.remove('leaving');
      return;
    }

    if (!currentPage || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.page.leaving').forEach(function (page) {
        page.classList.remove('leaving');
      });
      swap(id);
      return;
    }

    currentPage.classList.add('leaving');
    leaveT = setTimeout(function () {
      currentPage.classList.remove('leaving');
      swap(id);
    }, 300);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  var wEl = document.getElementById('words');
  var txt = wEl.textContent.trim().split(/\s+/);
  var frag = document.createDocumentFragment();
  txt.forEach(function (word, index) {
    if (index) frag.appendChild(document.createTextNode(' '));
    var span = document.createElement('span');
    span.textContent = word;
    frag.appendChild(span);
  });
  wEl.replaceChildren(frag);

  var ws = wEl.querySelectorAll('span');
  var hero = document.getElementById('hero');
  var tick = false;

  function upd() {
    tick = false;
    var vh = innerHeight;
    var y = scrollY;
    var t = Math.min(y / (vh * 0.8), 1);
    hero.style.opacity = 1 - t;
    hero.style.transform = 'scale(' + (1 - t * 0.08) + ') translateY(' + (y * 0.15) + 'px)';

    var rect = wEl.getBoundingClientRect();
    var progress = (vh * 0.8 - rect.top) / (rect.height + vh * 0.2);
    progress = Math.max(0, Math.min(1, progress));
    var count = Math.round(progress * ws.length);
    for (var i = 0; i < ws.length; i++) {
      ws[i].classList.toggle('on', i < count);
    }
  }

  addEventListener('scroll', function () {
    if (!tick) {
      tick = true;
      requestAnimationFrame(upd);
    }
  }, { passive: true });
  addEventListener('popstate', show);

  // Page links switch pages without a reload
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[data-p]');
    if (!a || !PATHS[a.dataset.p]) return;
    e.preventDefault();
    var target = PATHS[a.dataset.p];
    if (location.pathname !== target) history.pushState(null, '', target);
    else window.scrollTo(0, 0);
    show();
  });

  var root = document.documentElement;
  var tb = document.getElementById('theme');

  function cur() {
    var theme = root.getAttribute('data-theme');
    if (theme) return theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function paint() {
    tb.textContent = cur() === 'dark' ? '☀︎' : '☾';
  }

  try {
    var storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      root.setAttribute('data-theme', storedTheme);
    }
  } catch (error) {}

  tb.addEventListener('click', function () {
    var nextTheme = cur() === 'dark' ? 'light' : 'dark';
    root.classList.add('theming');
    root.setAttribute('data-theme', nextTheme);
    clearTimeout(window.__tt);
    window.__tt = setTimeout(function () {
      root.classList.remove('theming');
    }, 700);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch (error) {}
    paint();
  });
  paint();

  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var video = entry.target;
      if (entry.isIntersecting) {
        var playback = video.play();
        if (playback && playback.catch) playback.catch(function () {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('video[data-auto]').forEach(function (video) {
    vio.observe(video);
  });

  addEventListener('resize', upd);
  show();
})();

(function () {
  var root = document.documentElement, ticking = false;

  function progress() {
    ticking = false;
    var max = root.scrollHeight - innerHeight;
    root.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max) : 0);
  }

  function queue() {
    if (!ticking) { ticking = true; requestAnimationFrame(progress); }
  }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  addEventListener('popstate', function () { setTimeout(progress, 400); });
  progress();
})();