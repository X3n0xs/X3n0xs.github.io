// Lightbox gallery
if ('baguetteBox' in window && document.querySelectorAll('[data-bss-baguettebox]').length > 0) {
  baguetteBox.run('[data-bss-baguettebox]', { animation: 'slideIn' });
}

// Scroll reveal for .reveal elements
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  document.documentElement.classList.add('js');

  function showAll() {
    items.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    showAll();
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: '0px 0px 8% 0px', threshold: 0.05 }
  );

  items.forEach(function (el) {
    var grid = el.closest('.project-grid');
    if (grid) {
      var cols = grid.querySelectorAll('.col.reveal');
      var index = Array.prototype.indexOf.call(cols, el);
      if (index >= 0) {
        el.style.setProperty('--reveal-delay', index * 45 + 'ms');
      }
    }
    observer.observe(el);
  });
})();

// Immersive tour — hide nav until scroll or top-edge hover
(function () {
  var hero = document.querySelector('.tour-hero--immersive');
  if (!hero) return;

  var body = document.body;
  var scrollThreshold = 40;
  var stripHover = false;
  var hoverStrip = document.createElement('div');

  hoverStrip.className = 'tour-nav-hover-zone';
  hoverStrip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hoverStrip);

  body.classList.add('has-immersive-tour', 'tour-chrome-hidden');

  function setNavReveal(on) {
    body.classList.toggle('tour-nav-reveal', on);
  }

  function syncNav() {
    setNavReveal(window.scrollY > scrollThreshold || stripHover);
  }

  window.addEventListener(
    'scroll',
    function () {
      syncNav();
    },
    { passive: true }
  );

  hoverStrip.addEventListener('mouseenter', function () {
    stripHover = true;
    syncNav();
  });

  hoverStrip.addEventListener('mouseleave', function () {
    stripHover = false;
    syncNav();
  });

  syncNav();
})();

// 360° tour embed — parent Start/Stop + idle iframe passthrough for scroll
(function () {
  function syncEmbedControls(iframe, active) {
    if (!iframe) return;
    iframe.classList.toggle('is-tour-idle', !active);
    iframe.classList.toggle('is-tour-active', active);
    var wrap = iframe.closest('.tour-embed');
    if (!wrap) return;
    var startBtn = wrap.querySelector('[data-tour-embed-start]');
    var stopBtn = wrap.querySelector('[data-tour-embed-stop]');
    if (startBtn) startBtn.hidden = active;
    if (stopBtn) stopBtn.hidden = !active;
  }

  function sendEmbedMode(iframe, active) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ type: 'panorama-tour-set-mode', active: active }, '*');
    } catch (e) {}
    syncEmbedControls(iframe, active);
  }

  document.querySelectorAll('.tour-embed').forEach(function (wrap) {
    var iframe = wrap.querySelector('iframe');
    if (!iframe) return;
    var startBtn = wrap.querySelector('[data-tour-embed-start]');
    var stopBtn = wrap.querySelector('[data-tour-embed-stop]');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        sendEmbedMode(iframe, true);
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        sendEmbedMode(iframe, false);
      });
    }
    syncEmbedControls(iframe, false);
  });

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'panorama-tour-mode') return;
    var iframes = document.querySelectorAll('.tour-embed iframe');
    for (var i = 0; i < iframes.length; i += 1) {
      if (iframes[i].contentWindow === e.source) {
        syncEmbedControls(iframes[i], !!e.data.active);
        break;
      }
    }
  });
})();
