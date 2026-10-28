(function () {
  var pages = ['about', 'projects', 'contact'];
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
    var id = (location.hash || '').replace('#', '');
    if (pages.indexOf(id) < 0) id = 'about';

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
  addEventListener('hashchange', show);

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
  addEventListener('hashchange', function () { setTimeout(progress, 400); });
  progress();

  document.addEventListener('pointermove', function (e) {
    var card = e.target.closest && e.target.closest('.proj');
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();